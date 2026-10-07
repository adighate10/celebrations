// Celebrations: anyone can create a stage for someone they want to celebrate, design that
// person's character, and share the link. Everyone who opens it sits in the audience, queues a
// message, and watches it get delivered together.
//
// The server holds every stage in memory, mirrors them to a JSON file, and pushes each stage's
// state to its browsers over Server-Sent Events.
package main

import (
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	mrand "math/rand/v2"
	"net"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode/utf8"
)

//go:embed web
var webFS embed.FS

const (
	maxStages    = 500
	maxMembers   = 300
	maxDelivered = 500
	recentStages = 12 // how many the landing page lists
	maxName      = 16
	maxStarName  = 20
	maxText      = 280
	// How long someone keeps their seat after their last tab closes (covers refreshes).
	seatGrace = 20 * time.Second
)

var (
	hexColor   = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	styles     = []string{"long", "bun", "pigtails", "afro", "spiky", "cap", "short"}
	starStyles = []string{"long", "short", "bun", "spiky", "straight", "curly", "quiff", "buzz"}
	// the scenarios a stage can be set in; the sets themselves live in web/scenes.js
	scenes  = []string{"coder", "biker", "chef", "dj", "teacher", "doctor", "artist", "gardener", "gamer", "astronaut"}
	actions = []string{"", "highfive", "salute", "bow", "confetti", "handshake"}
)

func allHex(colors ...string) bool {
	return !slices.ContainsFunc(colors, func(c string) bool { return !hexColor.MatchString(c) })
}

// Star is the character on stage, designed by whoever created the stage.
type Star struct {
	Name    string `json:"name"`
	Skin    string `json:"skin"`
	Hair    string `json:"hair"`
	Top     string `json:"top"`
	Style   string `json:"style"`
	Glasses bool   `json:"glasses"`
	Scene   string `json:"scene"`  // which scenario; empty means "coder" (stages made before scenes existed)
	Gender  string `json:"gender"` // "girl" or "guy"; empty means "girl"
	// Parts is an AI-drawn look (see avatar.go): shapes per slot, layered onto the fixed character.
	Parts map[string][]Shape `json:"parts,omitempty"`
}

func (s Star) valid() bool {
	return allHex(s.Skin, s.Hair, s.Top) && slices.Contains(starStyles, s.Style) && validParts(s.Parts) &&
		(s.Scene == "" || slices.Contains(scenes, s.Scene)) &&
		slices.Contains([]string{"", "girl", "guy"}, s.Gender)
}

type Avatar struct {
	Skin    string `json:"skin"`
	Hair    string `json:"hair"`
	Shirt   string `json:"shirt"`
	Pants   string `json:"pants"`
	Shoes   string `json:"shoes"`
	Style   string `json:"style"`
	Glasses bool   `json:"glasses"`
	Art     int    `json:"art"`
	Mouth   int    `json:"mouth"`
}

func (a Avatar) valid() bool {
	return allHex(a.Skin, a.Hair, a.Shirt, a.Pants, a.Shoes) &&
		slices.Contains(styles, a.Style) && a.Art >= 0 && a.Art <= 3 && a.Mouth >= 0 && a.Mouth <= 2
}

// Member is one person in a stage's audience. Token is their private key to act as themselves
// and never leaves the server except to its owner.
type Member struct {
	ID     string `json:"id"`
	Token  string `json:"token"`
	Name   string `json:"name"`
	Avatar Avatar `json:"avatar"`
	Seq    int    `json:"seq"`

	conns    int
	lastSeen time.Time
}

type memberView struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Avatar Avatar `json:"avatar"`
}

func (m *Member) view() memberView { return memberView{m.ID, m.Name, m.Avatar} }

type Message struct {
	ID     string `json:"id"`
	From   string `json:"from"` // member ID
	Name   string `json:"name"`
	Text   string `json:"text"`
	Action string `json:"action"`
	Color  string `json:"color"`
	At     int64  `json:"at"`
}

type snapshot struct {
	Members   []memberView `json:"members"`
	Queue     []*Message   `json:"queue"`
	Delivered []*Message   `json:"delivered"`
	Busy      bool         `json:"busy"`
}

// Stage is one shareable show. The exported fields are what gets saved.
type Stage struct {
	ID        string     `json:"id"`
	HostKey   string     `json:"hostKey"`
	Star      Star       `json:"star"`
	Seq       int        `json:"seq"`
	Created   int64      `json:"created"` // when it was made (0 for stages from before this was recorded)
	Touched   int64      `json:"touched"` // last time anything happened here, for retiring old stages
	Saved     []*Member  `json:"members"` // only filled while reading or writing the data file
	Queue     []*Message `json:"queue"`
	Delivered []*Message `json:"delivered"`

	members  map[string]*Member // by token
	busy     bool               // a delivery is playing out on everyone's screen
	subs     map[chan []byte]struct{}
	nextProp time.Time
}

func (st *Stage) init() {
	st.members = map[string]*Member{}
	st.subs = map[chan []byte]struct{}{}
	st.nextProp = time.Now().Add(20 * time.Second)
	for _, m := range st.Saved {
		st.members[m.Token] = m
	}
	st.Saved = nil
}

func (st *Stage) inQueue(memberID string) bool {
	return slices.ContainsFunc(st.Queue, func(m *Message) bool { return m.From == memberID })
}

// snapshot lists who is in the house right now: anyone with the page open, anyone who only
// just left, and anyone still waiting in line (their message outlives their tab).
func (st *Stage) snapshot() snapshot {
	var seated []*Member
	for _, m := range st.members {
		if m.conns > 0 || time.Since(m.lastSeen) < seatGrace || st.inQueue(m.ID) {
			seated = append(seated, m)
		}
	}
	sort.Slice(seated, func(i, j int) bool { return seated[i].Seq < seated[j].Seq })
	s := snapshot{Members: []memberView{}, Queue: st.Queue, Delivered: st.Delivered, Busy: st.busy}
	for _, m := range seated {
		s.Members = append(s.Members, m.view())
	}
	if s.Queue == nil {
		s.Queue = []*Message{}
	}
	if s.Delivered == nil {
		s.Delivered = []*Message{}
	}
	return s
}

func frame(event string, v any) []byte {
	b, _ := json.Marshal(v)
	return []byte("event: " + event + "\ndata: " + string(b) + "\n\n")
}

// send pushes a frame to every open page of this stage. A page that has fallen too far behind
// is dropped; its EventSource reconnects and gets a fresh snapshot.
func (st *Stage) send(f []byte) {
	for ch := range st.subs {
		select {
		case ch <- f:
		default:
			delete(st.subs, ch)
			close(ch)
		}
	}
}

func (st *Stage) sendState() { st.send(frame("state", st.snapshot())) }

func (st *Stage) isHost(key string) bool {
	return key != "" && subtle.ConstantTimeCompare([]byte(key), []byte(st.HostKey)) == 1
}

// Server owns every stage. One lock guards all of them: the work under it is tiny, and it
// keeps saving the data file simple.
type Server struct {
	mu       sync.Mutex
	stages   map[string]*Stage
	dataPath string
	db       *mongoStore // nil when stages are kept in the data file
	ai       *avatarAI   // nil when no Gemini key is configured
}

func randHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// newServer loads every stage from the database when one is configured, otherwise from the data
// file. The first time a database is used it is empty, so stages from the data file move over.
func newServer(dataPath string, db *mongoStore) *Server {
	s := &Server{stages: map[string]*Stage{}, dataPath: dataPath, db: db}
	stages := loadFile(dataPath)
	if db != nil {
		stored, err := db.load()
		if err != nil {
			log.Fatalf("could not read stages from the database: %v", err)
		}
		if len(stored) > 0 {
			stages = stored
		} else if len(stages) > 0 {
			log.Printf("database is empty: moving %d stage(s) over from %s", len(stages), dataPath)
			defer func() {
				for _, st := range s.stages {
					db.save(st)
				}
			}()
		}
	}
	for _, st := range stages {
		st.init()
		s.stages[st.ID] = st
	}
	return s
}

// retireOldest makes room for a new stage by dropping the one nobody has touched for longest,
// skipping any that people are looking at right now. Reports whether it freed a slot.
func (s *Server) retireOldest() bool {
	var oldest *Stage
	for _, st := range s.stages {
		if len(st.subs) == 0 && (oldest == nil || st.Touched < oldest.Touched) {
			oldest = st
		}
	}
	if oldest == nil {
		return false
	}
	delete(s.stages, oldest.ID)
	s.forget(oldest.ID)
	return true
}

// ---------- HTTP ----------

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 128<<10) // a stage with an AI-drawn look is the largest thing sent
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func cleanLine(s string) string { return strings.Join(strings.Fields(s), " ") }

// stage looks up the stage named in the URL. Callers hold s.mu.
func (s *Server) stage(w http.ResponseWriter, r *http.Request) *Stage {
	st := s.stages[r.PathValue("id")]
	if st == nil {
		http.Error(w, "This stage doesn't exist.", http.StatusNotFound)
	}
	return st
}

func (s *Server) handleCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Star Star `json:"star"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	req.Star.Name = cleanLine(req.Star.Name)
	if req.Star.Name == "" || utf8.RuneCountInString(req.Star.Name) > maxStarName {
		http.Error(w, "Give the person on stage a name (up to 20 characters).", http.StatusBadRequest)
		return
	}
	if !req.Star.valid() {
		http.Error(w, "That character isn't valid.", http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.stages) >= maxStages && !s.retireOldest() {
		http.Error(w, "Every stage is in use right now — try again later.", http.StatusServiceUnavailable)
		return
	}
	now := time.Now().Unix()
	st := &Stage{ID: randHex(4), HostKey: randHex(8), Star: req.Star, Created: now, Touched: now}
	st.init()
	s.stages[st.ID] = st
	s.persist(st)
	writeJSON(w, struct {
		ID      string `json:"id"`
		HostKey string `json:"hostKey"`
	}{st.ID, st.HostKey})
}

// handleRecent lists the newest stages for the landing page. Only what the page shows is sent:
// never the host key, the audience or the messages.
func (s *Server) handleRecent(w http.ResponseWriter, r *http.Request) {
	type recent struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Scene   string `json:"scene"`
		Created int64  `json:"created"`
	}
	s.mu.Lock()
	list := make([]recent, 0, len(s.stages))
	for _, st := range s.stages {
		made := st.Created
		if made == 0 {
			made = st.Touched
		}
		list = append(list, recent{st.ID, st.Star.Name, st.Star.Scene, made})
	}
	s.mu.Unlock()
	sort.Slice(list, func(i, j int) bool { return list[i].Created > list[j].Created })
	writeJSON(w, list[:min(len(list), recentStages)])
}

func (s *Server) handleHello(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.stage(w, r)
	if st == nil {
		return
	}
	resp := struct {
		Me     *memberView `json:"me"`
		IsHost bool        `json:"isHost"`
		Star   Star        `json:"star"`
	}{IsHost: st.isHost(r.URL.Query().Get("host")), Star: st.Star}
	if m := st.members[r.URL.Query().Get("token")]; m != nil {
		v := m.view()
		resp.Me = &v
	}
	writeJSON(w, resp)
}

func (s *Server) handleJoin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token  string `json:"token"`
		Name   string `json:"name"`
		Avatar Avatar `json:"avatar"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	name := cleanLine(req.Name)
	if name == "" || utf8.RuneCountInString(name) > maxName {
		http.Error(w, "Please enter a name (up to 16 characters).", http.StatusBadRequest)
		return
	}
	if !req.Avatar.valid() {
		http.Error(w, "That avatar isn't valid.", http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.stage(w, r)
	if st == nil {
		return
	}
	m := st.members[req.Token]
	if m == nil {
		if len(st.members) >= maxMembers {
			http.Error(w, "The house is full!", http.StatusServiceUnavailable)
			return
		}
		st.Seq++
		m = &Member{ID: randHex(6), Token: randHex(16), Seq: st.Seq}
		st.members[m.Token] = m
	}
	m.Name, m.Avatar, m.lastSeen = name, req.Avatar, time.Now()
	st.Touched = time.Now().Unix()
	s.persist(st)
	st.sendState()
	writeJSON(w, struct {
		Token string     `json:"token"`
		Me    memberView `json:"me"`
	}{m.Token, m.view()})
}

func (s *Server) handleMessage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token  string `json:"token"`
		Text   string `json:"text"`
		Action string `json:"action"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	text := strings.TrimSpace(req.Text)
	switch {
	case utf8.RuneCountInString(text) > maxText:
		http.Error(w, "That message is too long.", http.StatusBadRequest)
		return
	case !slices.Contains(actions, req.Action):
		http.Error(w, "Unknown action.", http.StatusBadRequest)
		return
	case text == "" && req.Action == "":
		http.Error(w, "Write a message or pick an action.", http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.stage(w, r)
	if st == nil {
		return
	}
	m := st.members[req.Token]
	if m == nil {
		http.Error(w, "Join the audience first.", http.StatusUnauthorized)
		return
	}
	if st.inQueue(m.ID) {
		http.Error(w, "You're already in line.", http.StatusConflict)
		return
	}
	st.Queue = append(st.Queue, &Message{
		ID: randHex(6), From: m.ID, Name: m.Name, Text: text, Action: req.Action,
		Color: m.Avatar.Shirt, At: time.Now().UnixMilli(),
	})
	st.Touched = time.Now().Unix()
	s.persist(st)
	st.sendState()
	writeJSON(w, struct{}{})
}

// deliveryTime mirrors the stage animation in web/app.js: walk to the desk, hold while the
// message and action play, then clear the spot for the next person.
func deliveryTime(m *Message) time.Duration {
	hold := 2600 + min(utf8.RuneCountInString(m.Text), 140)*25
	if m.Action != "" {
		hold = max(hold, 3600)
	}
	return time.Duration(600+hold+500) * time.Millisecond
}

func (s *Server) handleGo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Host string `json:"host"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.stage(w, r)
	switch {
	case st == nil:
		return
	case !st.isHost(req.Host):
		http.Error(w, "Only the host can press GO.", http.StatusForbidden)
		return
	case st.busy:
		http.Error(w, "Someone is on stage already.", http.StatusConflict)
		return
	case len(st.Queue) == 0:
		http.Error(w, "Nobody is in line.", http.StatusConflict)
		return
	}
	m := st.Queue[0]
	st.Queue = st.Queue[1:]
	st.Delivered = append(st.Delivered, m)
	if len(st.Delivered) > maxDelivered {
		st.Delivered = st.Delivered[len(st.Delivered)-maxDelivered:]
	}
	st.busy = true
	st.Touched = time.Now().Unix()
	s.persist(st)
	st.send(frame("deliver", m))
	st.sendState()
	time.AfterFunc(deliveryTime(m), func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		st.busy = false
		st.sendState()
	})
	writeJSON(w, struct{}{})
}

func (s *Server) handleClear(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Host string `json:"host"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.stage(w, r)
	if st == nil {
		return
	}
	if !st.isHost(req.Host) {
		http.Error(w, "Only the host can clear messages.", http.StatusForbidden)
		return
	}
	st.Delivered = nil
	s.persist(st)
	st.sendState()
	writeJSON(w, struct{}{})
}

// handleEvents is a stage's live feed. While a member has at least one feed open they hold a seat.
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	fl, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}
	s.mu.Lock()
	st := s.stage(w, r)
	if st == nil {
		s.mu.Unlock()
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := make(chan []byte, 64)
	m := st.members[r.URL.Query().Get("token")]
	if m != nil {
		m.conns++
	}
	st.subs[ch] = struct{}{}
	st.sendState() // the newcomer's first frame; everyone else sees them sit down
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(st.subs, ch)
		if m != nil {
			m.conns--
			m.lastSeen = time.Now()
		}
		s.mu.Unlock()
		if m != nil {
			// their seat empties if they don't come back
			time.AfterFunc(seatGrace+time.Second, func() {
				s.mu.Lock()
				defer s.mu.Unlock()
				st.sendState()
			})
		}
	}()

	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case f, open := <-ch:
			if !open {
				return
			}
			if _, err := w.Write(f); err != nil {
				return
			}
			fl.Flush()
		case <-ping.C:
			if _, err := w.Write([]byte(": ping\n\n")); err != nil {
				return
			}
			fl.Flush()
		}
	}
}

// propLoop plays each stage's moving prop now and then (kids wandering in, a pancake flip, a
// rocket flying past…). The server decides when, and in which mood, so every screen shows the same thing.
func (s *Server) propLoop() {
	for range time.Tick(5 * time.Second) {
		s.mu.Lock()
		now := time.Now()
		for _, st := range s.stages {
			if len(st.subs) == 0 || st.busy || now.Before(st.nextProp) {
				continue
			}
			st.nextProp = now.Add(time.Duration(45+mrand.IntN(45)) * time.Second)
			st.send(frame("prop", struct {
				Love bool `json:"love"`
				Line int  `json:"line"`
			}{mrand.IntN(2) == 0, mrand.IntN(4)}))
		}
		s.mu.Unlock()
	}
}

// loadDotEnv reads KEY=value lines from a local settings file into the environment, without
// overriding anything already set. The file is optional.
func loadDotEnv(path string) {
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(b), "\n") {
		key, value, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok || strings.HasPrefix(key, "#") {
			continue
		}
		key, value = strings.TrimSpace(key), strings.Trim(strings.TrimSpace(value), `"'`)
		if _, set := os.LookupEnv(key); !set && key != "" && value != "" {
			os.Setenv(key, value)
		}
	}
}

func lanAddrs() []string {
	var out []string
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		if ipn, ok := a.(*net.IPNet); ok && !ipn.IP.IsLoopback() && ipn.IP.To4() != nil {
			out = append(out, ipn.IP.String())
		}
	}
	return out
}

func main() {
	addr := flag.String("addr", ":8080", "address to listen on")
	data := flag.String("data", "stages.json", "file the stages are saved to")
	dev := flag.Bool("dev", false, "serve web/ from disk instead of the copy built into the binary")
	flag.Parse()

	loadDotEnv(".env")
	var db *mongoStore
	if uri := mongoURI(); uri != "" {
		var err error
		if db, err = openMongo(uri); err != nil {
			log.Fatalf("could not connect to MongoDB: %v", err)
		}
		// send the last writes before exiting, e.g. when a deploy restarts the app
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
		go func() {
			<-stop
			db.close()
			os.Exit(0)
		}()
	}
	s := newServer(*data, db)
	s.ai = newAvatarAI()
	go s.propLoop()

	var web fs.FS = os.DirFS("web")
	if !*dev {
		var err error
		if web, err = fs.Sub(webFS, "web"); err != nil {
			log.Fatal(err)
		}
	}
	static := http.FileServerFS(web)
	noCache := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache")
			h(w, r)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/config", s.handleConfig)
	mux.HandleFunc("POST /api/star/draw", s.handleDraw)
	mux.HandleFunc("POST /api/stages", s.handleCreate)
	mux.HandleFunc("GET /api/stages", s.handleRecent)
	mux.HandleFunc("GET /api/stages/{id}/hello", s.handleHello)
	mux.HandleFunc("GET /api/stages/{id}/events", s.handleEvents)
	mux.HandleFunc("POST /api/stages/{id}/join", s.handleJoin)
	mux.HandleFunc("POST /api/stages/{id}/message", s.handleMessage)
	mux.HandleFunc("POST /api/stages/{id}/go", s.handleGo)
	mux.HandleFunc("POST /api/stages/{id}/clear", s.handleClear)
	// One page serves the landing page (/), the stage creator (/new) and every stage (/s/{id}).
	page := noCache(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, web, "index.html")
	})
	mux.HandleFunc("GET /new", page)
	mux.HandleFunc("GET /s/{id}", page)
	mux.HandleFunc("/", noCache(static.ServeHTTP))

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	fmt.Printf("\nCelebrations is up. Create a stage at:\n\n")
	fmt.Printf("  http://localhost:%d/\n", port)
	for _, ip := range lanAddrs() {
		fmt.Printf("  http://%s:%d/   (same Wi-Fi)\n", ip, port)
	}
	if db != nil {
		fmt.Printf("\nStages are stored in MongoDB (%d loaded).\n", len(s.stages))
	} else {
		fmt.Printf("\nStages are stored in %s (%d loaded). Set MONGODB_URI to use MongoDB.\n", *data, len(s.stages))
	}
	if s.ai == nil {
		fmt.Println("AI avatars are off: set GEMINI_API_KEY to switch them on.")
	} else {
		fmt.Printf("\nAI avatars are on (%s).\n", s.ai.model)
	}
	fmt.Println()
	log.Fatal(http.Serve(ln, mux))
}
