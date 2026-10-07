package main

// Where stages are kept between restarts.
//
// By default that is a JSON file next to the server. When MONGODB_URI is set, stages live in
// MongoDB instead: one document per stage in the "stages" collection of the "celebrations"
// database. The server still works from memory; the database is written to after every change
// and read once at start-up.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// fillSaved gets a stage ready to be written out: its members as a list, in joining order.
func (st *Stage) fillSaved() {
	st.Saved = st.Saved[:0]
	for _, m := range st.members {
		st.Saved = append(st.Saved, m)
	}
	sort.Slice(st.Saved, func(i, j int) bool { return st.Saved[i].Seq < st.Saved[j].Seq })
}

// ---------- file ----------

func loadFile(path string) []*Stage {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var file struct {
		Stages []*Stage `json:"stages"`
	}
	if err := json.Unmarshal(b, &file); err != nil {
		log.Fatalf("%s is not valid: %v", path, err)
	}
	return file.Stages
}

// saveFile writes every stage to the data file. Callers hold s.mu.
func (s *Server) saveFile() {
	list := make([]*Stage, 0, len(s.stages))
	for _, st := range s.stages {
		st.fillSaved()
		list = append(list, st)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].ID < list[j].ID })
	b, err := json.MarshalIndent(struct {
		Stages []*Stage `json:"stages"`
	}{list}, "", "  ")
	if err == nil {
		tmp := s.dataPath + ".tmp"
		if err = os.WriteFile(tmp, b, 0o600); err == nil {
			err = os.Rename(tmp, s.dataPath)
		}
	}
	if err != nil {
		log.Printf("could not save %s: %v", s.dataPath, err)
	}
}

// ---------- MongoDB ----------

// A write waiting to go to the database: a stage's new contents, or nil to delete it.
type dbWrite struct {
	id  string
	doc bson.D
}

type mongoStore struct {
	client *mongo.Client
	stages *mongo.Collection
	queue  chan dbWrite  // writes go out in order, off the request path
	done   chan struct{} // closed when the queue has been emptied after close()
}

func openMongo(uri string) (*mongoStore, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetAppName("celebrations"))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}
	m := &mongoStore{
		client: client,
		stages: client.Database("celebrations").Collection("stages"),
		queue:  make(chan dbWrite, 1024),
		done:   make(chan struct{}),
	}
	go m.writer()
	return m, nil
}

func (m *mongoStore) load() ([]*Stage, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cur, err := m.stages.Find(ctx, bson.D{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var out []*Stage
	for cur.Next(ctx) {
		// documents are the same shape as the JSON file's stages, so go through JSON to reuse it
		js, err := bson.MarshalExtJSON(cur.Current, false, false)
		if err != nil {
			return nil, err
		}
		st := &Stage{}
		if err := json.Unmarshal(js, st); err != nil {
			return nil, fmt.Errorf("stage %v in the database is not valid: %w", cur.Current.Lookup("_id"), err)
		}
		out = append(out, st)
	}
	return out, cur.Err()
}

// save queues a stage to be written. The stage is copied into a document here, while the caller
// still holds the server lock, so later changes can't race with the write.
func (m *mongoStore) save(st *Stage) {
	st.fillSaved()
	js, err := json.Marshal(st)
	var doc bson.D
	if err == nil {
		err = bson.UnmarshalExtJSON(js, false, &doc)
	}
	if err != nil {
		log.Printf("database: could not encode stage %s: %v", st.ID, err)
		return
	}
	m.enqueue(dbWrite{st.ID, append(bson.D{{Key: "_id", Value: st.ID}}, doc...)})
}

func (m *mongoStore) remove(id string) { m.enqueue(dbWrite{id: id}) }

func (m *mongoStore) enqueue(w dbWrite) {
	select {
	case m.queue <- w:
	default:
		log.Printf("database: write queue is full, dropping an update to stage %s", w.id)
	}
}

func (m *mongoStore) writer() {
	defer close(m.done)
	for w := range m.queue {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		var err error
		if w.doc == nil {
			_, err = m.stages.DeleteOne(ctx, bson.D{{Key: "_id", Value: w.id}})
		} else {
			_, err = m.stages.ReplaceOne(ctx, bson.D{{Key: "_id", Value: w.id}}, w.doc, options.Replace().SetUpsert(true))
		}
		cancel()
		if err != nil {
			log.Printf("database: could not write stage %s: %v", w.id, err)
		}
	}
}

// close sends whatever is still queued and disconnects. Called once, on shutdown.
func (m *mongoStore) close() {
	close(m.queue)
	select {
	case <-m.done:
	case <-time.After(10 * time.Second):
		log.Print("database: gave up waiting for the last writes")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	m.client.Disconnect(ctx)
}

// ---------- the server's view of storage ----------

// mongoURI returns the configured connection string, or "" when the database isn't set up
// (including when the placeholder password from the template is still in place).
func mongoURI() string {
	uri := strings.TrimSpace(os.Getenv("MONGODB_URI"))
	if strings.Contains(uri, "<db_password>") {
		log.Print("MONGODB_URI still has <db_password> in it; replace that with the real password. Using the data file for now.")
		return ""
	}
	return uri
}

// persist records a stage after it changed; forget records that it was removed. Callers hold s.mu.
func (s *Server) persist(st *Stage) {
	if s.db != nil {
		s.db.save(st)
	} else {
		s.saveFile()
	}
}

func (s *Server) forget(id string) {
	if s.db != nil {
		s.db.remove(id)
	} else {
		s.saveFile()
	}
}
