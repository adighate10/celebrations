package main

// AI-drawn looks for the person on stage.
//
// The stage creator can describe someone; Gemini answers with colours plus small SVG drawings
// for a few fixed slots (hair, face, headwear, top). The body, face and arms stay ours, so every
// reaction still animates. Whatever comes back is model output shown to every visitor, so it
// is never passed through as markup: it is parsed into plain shapes and each attribute is checked.

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

// Shape is one drawn element in a slot: a tag and its checked attributes.
type Shape struct {
	T string            `json:"t"`
	A map[string]string `json:"a"`
}

const (
	maxShapesPerSlot = 16
	maxDescription   = 300
)

var (
	slotNames = []string{"hairBack", "top", "face", "hairFront", "headwear"}
	shapeTags = []string{"path", "circle", "ellipse", "rect", "line", "polygon", "polyline"}
	numAttrs  = []string{"cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height",
		"stroke-width", "opacity", "fill-opacity", "stroke-opacity"}

	numRe       = regexp.MustCompile(`^-?[0-9]*\.?[0-9]+$`)
	pathRe      = regexp.MustCompile(`^[MmLlHhVvCcSsQqTtAaZz0-9eE,.\s+-]+$`)
	pointsRe    = regexp.MustCompile(`^[0-9eE,.\s+-]+$`)
	transformRe = regexp.MustCompile(`^(\s*(rotate|translate|scale)\([-0-9., ]+\))+\s*$`)
	// HAIR, SKIN and TOP are placeholders the page swaps for the character's current colours.
	paintRe = regexp.MustCompile(`^(none|HAIR|SKIN|TOP|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$`)
)

func attrOK(name, v string) bool {
	switch name {
	case "d":
		return len(v) <= 4000 && pathRe.MatchString(v)
	case "points":
		return len(v) <= 2000 && pointsRe.MatchString(v)
	case "fill", "stroke":
		return paintRe.MatchString(v)
	case "stroke-linecap":
		return slices.Contains([]string{"round", "butt", "square"}, v)
	case "stroke-linejoin":
		return slices.Contains([]string{"round", "miter", "bevel"}, v)
	case "transform":
		return len(v) <= 120 && transformRe.MatchString(v)
	}
	return slices.Contains(numAttrs, name) && len(v) <= 12 && numRe.MatchString(v)
}

// validParts checks parts sent back by a browser when a stage is created. It is strict: the
// page only ever sends what the server produced, so anything unexpected is a reason to refuse.
func validParts(parts map[string][]Shape) bool {
	for slot, shapes := range parts {
		if !slices.Contains(slotNames, slot) || len(shapes) > maxShapesPerSlot {
			return false
		}
		for _, s := range shapes {
			if !slices.Contains(shapeTags, s.T) {
				return false
			}
			for name, v := range s.A {
				if !attrOK(name, v) {
					return false
				}
			}
		}
	}
	return true
}

// parseSlot turns a fragment of model-written SVG into shapes, keeping only known tags and
// attributes whose values pass the checks. Anything else (groups, text, scripts, links) is dropped.
func parseSlot(fragment string) []Shape {
	shapes := []Shape{}
	dec := xml.NewDecoder(strings.NewReader("<svg>" + fragment + "</svg>"))
	dec.Strict = false
	for len(shapes) < maxShapesPerSlot {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		se, ok := tok.(xml.StartElement)
		if !ok || !slices.Contains(shapeTags, se.Name.Local) {
			continue
		}
		s := Shape{T: se.Name.Local, A: map[string]string{}}
		for _, a := range se.Attr {
			if v := strings.TrimSpace(a.Value); a.Name.Space == "" && attrOK(a.Name.Local, v) {
				s.A[a.Name.Local] = v
			}
		}
		if len(s.A) > 0 {
			shapes = append(shapes, s)
		}
	}
	return shapes
}

const drawingBrief = `You style a cartoon character for a celebration web app. From a short description of a person you choose colours and draw a few small SVG pieces that are layered onto a fixed cartoon body. Always produce a friendly, flattering cartoon. If the description is unclear, unrelated or inappropriate, ignore the bad parts and return a pleasant neutral look.

THE FIXED CHARACTER (already drawn, do not redraw it)
A person facing the viewer, sitting behind a desk with a laptop. SVG user units, y grows downward.
- Head: ellipse centred (0,285), rx 42, ry 45. Top of the skull y=240, chin y=330, sides x=-42 and x=42.
- Eyes: centres (-16,288) and (16,288), radius 9. Eyebrows at y=268. Nose y=300. Mouth y=305..320, x=-12..12.
- Neck: x=-10..10, y=320..345. Shoulders run from (-52,360) to (52,360); the neckline is at y=337.
- A laptop hides the body for x=-58..58 below y=343. The desk hides everything below y=398.
- Style: flat colours, rounded shapes. Every shape automatically gets a dark outline (stroke #1d0f26, width 3, round joins). Add stroke="none" on small details that should have no outline.

WHAT YOU DRAW: five slots, each a string of SVG elements (or "" when not needed)
- hairBack: hair BEHIND the head and body: long hair, afro volume, ponytail, bun, braids. Stay within x=-85..85, y=200..425.
- hairFront: hair IN FRONT of the skull: hairline, fringe, side locks. For |x|<36 it must stay above y=270 so the eyes and brows stay visible. At the sides (36<=|x|<=58) it may come down as far as y=420.
- face: glasses (fill="none"), beard, moustache, freckles, earrings (near x=-44 or 44, y=300). Never put an opaque shape over the eyes. A beard must leave the mouth visible: keep it below y=322 in the middle.
- headwear: hat, cap, crown, headband, bow, flower, headphones, hijab or turban. Usually y=195..275.
- top: details on the clothing that show above the laptop: collar, necklace, scarf, tie knot, hood, hoodie strings. Visible area x=-52..52, y=322..345, plus the shoulders at |x|>58 down to y=395.
A bald person gets "" for hairBack and hairFront. Someone with a full head covering may get "" for both hair slots too.

RULES FOR THE SVG
- Only these elements: path, circle, ellipse, rect, line, polygon, polyline. No g, text, defs, style, image, use, gradients or filters.
- Only these attributes: d, points, cx, cy, r, rx, ry, x, y, x1, y1, x2, y2, width, height, fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, opacity, transform (rotate/translate/scale only).
- Colours: use fill="HAIR" for anything hair-coloured (including beards and brows), fill="SKIN" for skin, fill="TOP" for the main clothing colour. Every other colour must be a hex value like #e63946. No colour names.
- At most 12 elements per slot. Keep paths simple and mostly left-right symmetric.

COLOURS
- skin, hair, top: hex colours that match the description. If the description does not say, pick natural, pleasant ones. top is the main clothing colour.

ANSWER
Return only a JSON object with exactly these string fields: skin, hair, top, hairBack, hairFront, face, headwear, topDetail.

EXAMPLE 1. Description: "long wavy brown hair, round glasses, pink hair clip, red scarf"
{"skin":"#f2c9a0","hair":"#5a3418","top":"#ffe2a8","hairBack":"<path d=\"M-46,285 C-54,222 54,222 46,285 C56,330 62,380 58,424 L-58,424 C-62,380 -56,330 -46,285Z\" fill=\"HAIR\"/>","hairFront":"<path d=\"M-43,278 C-56,320 -58,372 -52,416 L-33,416 C-38,372 -40,330 -37,296Z\" fill=\"HAIR\"/><path d=\"M43,278 C56,320 58,372 52,416 L33,416 C38,372 40,330 37,296Z\" fill=\"HAIR\"/><path d=\"M-44,292 C-52,238 -8,226 6,242 C26,230 52,246 44,292 C38,264 24,254 6,256 C-12,264 -34,262 -44,292Z\" fill=\"HAIR\"/>","face":"<circle cx=\"-16\" cy=\"288\" r=\"12\" fill=\"none\" stroke-width=\"2.5\"/><circle cx=\"16\" cy=\"288\" r=\"12\" fill=\"none\" stroke-width=\"2.5\"/><path d=\"M-4,288 h8\" fill=\"none\" stroke-width=\"2.5\"/>","headwear":"<rect x=\"24\" y=\"258\" width=\"14\" height=\"6\" rx=\"3\" fill=\"#ff7aa8\" stroke-width=\"2\" transform=\"rotate(20 31 261)\"/>","topDetail":"<path d=\"M-26,333 Q0,352 26,333 L28,345 Q0,364 -28,345Z\" fill=\"#e63946\"/>"}

EXAMPLE 2. Description: "guy with short black hair, a beard and a blue baseball cap, green hoodie"
{"skin":"#c98a5e","hair":"#1d1418","top":"#3a9d5d","hairBack":"<path d=\"M-47,292 C-56,222 56,222 47,292 C47,304 45,312 42,318 L-42,318 C-45,312 -47,304 -47,292Z\" fill=\"HAIR\"/>","hairFront":"","face":"<path d=\"M-41,292 C-44,350 44,350 41,292 C36,312 26,322 14,324 Q0,330 -14,324 C-26,322 -36,312 -41,292Z\" fill=\"HAIR\"/><path d=\"M-14,304 Q0,297 14,304 Q0,308 -14,304Z\" fill=\"HAIR\" stroke-width=\"2\"/>","headwear":"<path d=\"M-45,264 C-46,220 46,220 45,264Z\" fill=\"#2a6f97\"/><path d=\"M-12,264 H60 q7,0 4,9 H-12Z\" fill=\"#245d80\"/><circle cx=\"0\" cy=\"229\" r=\"3\" fill=\"#ffffff\" stroke-width=\"2\"/>","topDetail":"<path d=\"M-30,336 Q0,356 30,336 L36,350 Q0,372 -36,350Z\" fill=\"TOP\"/><line x1=\"-8\" y1=\"346\" x2=\"-9\" y2=\"343\" stroke=\"#ffffff\" stroke-width=\"3\"/><line x1=\"8\" y1=\"346\" x2=\"9\" y2=\"343\" stroke=\"#ffffff\" stroke-width=\"3\"/>"}`

// avatarAI talks to Gemini and keeps the usage limits. nil means the feature is switched off.
type avatarAI struct {
	key, model string
	fallback   string // used when the main model is overloaded
	baseURL    string // overridable with GEMINI_BASE_URL, for tests and proxies
	client     *http.Client

	mu    sync.Mutex
	hits  map[string][]time.Time // recent requests per visitor
	day   string
	today int
}

const (
	perVisitor       = 6 // drawings per visitor…
	perVisitorWindow = 10 * time.Minute
	perDay           = 400 // …and for the whole site per day, so a public page can't run up the bill

	attemptTimeout = 25 * time.Second // one try at one model
	drawTimeout    = 80 * time.Second // the whole request, across retries
)

func newAvatarAI() *avatarAI {
	key := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if key == "" {
		return nil
	}
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-3.8-flash"
	}
	base := strings.TrimRight(os.Getenv("GEMINI_BASE_URL"), "/")
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}
	fallback := os.Getenv("GEMINI_FALLBACK_MODEL")
	if fallback == "" && model != "gemini-3.6-flash" {
		fallback = "gemini-3.6-flash"
	}
	return &avatarAI{key: key, model: model, fallback: fallback, baseURL: base, client: &http.Client{Timeout: drawTimeout}, hits: map[string][]time.Time{}}
}

func (a *avatarAI) allow(visitor string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	if day := now.Format(time.DateOnly); day != a.day {
		a.day, a.today, a.hits = day, 0, map[string][]time.Time{}
	}
	recent := slices.DeleteFunc(a.hits[visitor], func(t time.Time) bool { return now.Sub(t) > perVisitorWindow })
	switch {
	case a.today >= perDay:
		return errors.New("The AI artist is done for today — please use the options below.")
	case len(recent) >= perVisitor:
		return errors.New("That's a lot of drawings! Give it a few minutes and try again.")
	}
	a.hits[visitor] = append(recent, now)
	a.today++
	return nil
}

func hexOr(v, fallback string) string {
	if hexColor.MatchString(v) {
		return v
	}
	return fallback
}

// ask sends one request to one model. retry reports whether the failure looks temporary.
func (a *avatarAI) ask(ctx context.Context, model string, body []byte) (raw []byte, retry bool, err error) {
	url := a.baseURL + "/v1beta/models/" + model + ":generateContent"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, false, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", a.key)
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, true, err
	}
	defer resp.Body.Close()
	raw, _ = io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		busy := resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500
		return nil, busy, fmt.Errorf("gemini (%s) answered %d: %.300s", model, resp.StatusCode, raw)
	}
	return raw, false, nil
}

// draw asks Gemini for a look and returns it as a checked Star (without a name).
func (a *avatarAI) draw(ctx context.Context, description string) (Star, error) {
	// This is a small drawing job, so ask the model to keep its thinking short; left at the
	// default it can take the best part of a minute.
	request := func(thinking bool) []byte {
		config := map[string]any{"responseMimeType": "application/json", "temperature": 0.9, "maxOutputTokens": 8192}
		if thinking {
			config["thinkingConfig"] = map[string]any{"thinkingLevel": "low"}
		}
		b, _ := json.Marshal(map[string]any{
			"systemInstruction": map[string]any{"parts": []map[string]string{{"text": drawingBrief}}},
			"contents":          []map[string]any{{"role": "user", "parts": []map[string]string{{"text": "Description: " + description}}}},
			"generationConfig":  config,
		})
		return b
	}
	// Google's models are sometimes overloaded or slow: alternate between the chosen model and the
	// fallback, giving each attempt a limited time, before giving up.
	var raw []byte
	var err error
	for attempt, model := range []string{a.model, a.fallback, a.model, a.fallback} {
		if model == "" {
			continue
		}
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return Star{}, ctx.Err()
			case <-time.After(1200 * time.Millisecond):
			}
		}
		var retry bool
		started := time.Now()
		try, cancel := context.WithTimeout(ctx, attemptTimeout)
		raw, retry, err = a.ask(try, model, request(true))
		if err != nil && !retry && strings.Contains(strings.ToLower(err.Error()), "thinking") {
			raw, retry, err = a.ask(try, model, request(false)) // a model that doesn't take the setting
		}
		cancel()
		if err == nil {
			log.Printf("avatar: %s drew it in %.1fs", model, time.Since(started).Seconds())
			break
		}
		if !retry || ctx.Err() != nil {
			break
		}
		log.Printf("avatar: %s failed after %.1fs, trying again (%v)", model, time.Since(started).Seconds(), err)
	}
	if err != nil {
		return Star{}, err
	}
	var out struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text    string `json:"text"`
					Thought bool   `json:"thought"`
				} `json:"parts"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || len(out.Candidates) == 0 {
		return Star{}, fmt.Errorf("gemini sent no candidates: %.300s", raw)
	}
	var text strings.Builder
	for _, p := range out.Candidates[0].Content.Parts {
		if !p.Thought {
			text.WriteString(p.Text)
		}
	}
	// tolerate a fenced or chatty answer: take the outermost JSON object
	answer := text.String()
	if i, j := strings.Index(answer, "{"), strings.LastIndex(answer, "}"); i >= 0 && j > i {
		answer = answer[i : j+1]
	}
	var look struct {
		Skin, Hair, Top, HairBack, HairFront, Face, Headwear, TopDetail string
	}
	if err := json.Unmarshal([]byte(answer), &look); err != nil {
		return Star{}, fmt.Errorf("gemini's answer was not the expected JSON (finish: %s): %.200s", out.Candidates[0].FinishReason, answer)
	}
	return Star{
		Skin:  hexOr(look.Skin, "#fbd9bd"),
		Hair:  hexOr(look.Hair, "#3b2314"),
		Top:   hexOr(look.Top, "#ffe2a8"),
		Style: "long",
		Parts: map[string][]Shape{
			"hairBack":  parseSlot(look.HairBack),
			"hairFront": parseSlot(look.HairFront),
			"face":      parseSlot(look.Face),
			"headwear":  parseSlot(look.Headwear),
			"top":       parseSlot(look.TopDetail),
		},
	}, nil
}

// visitorAddr identifies who is asking, for the usage limit. In production only CloudFront can
// reach the server and it appends the real visitor address to X-Forwarded-For, so the last entry
// is the one to trust.
func visitorAddr(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, struct {
		AIAvatar bool `json:"aiAvatar"`
	}{s.ai != nil})
}

func (s *Server) handleDraw(w http.ResponseWriter, r *http.Request) {
	if s.ai == nil {
		http.Error(w, "AI avatars aren't switched on.", http.StatusNotFound)
		return
	}
	var req struct {
		Description string `json:"description"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	description := cleanLine(req.Description)
	if n := utf8.RuneCountInString(description); n < 3 || n > maxDescription {
		http.Error(w, "Describe them in a sentence or two (up to 300 characters).", http.StatusBadRequest)
		return
	}
	if err := s.ai.allow(visitorAddr(r)); err != nil {
		http.Error(w, err.Error(), http.StatusTooManyRequests)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), drawTimeout)
	defer cancel()
	star, err := s.ai.draw(ctx, description)
	if err != nil {
		log.Printf("avatar: %v", err)
		http.Error(w, "The AI artist couldn't draw that one — please try again.", http.StatusBadGateway)
		return
	}
	writeJSON(w, struct {
		Star Star `json:"star"`
	}{star})
}
