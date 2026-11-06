// Package mesh contains the loopback-only ForgeMesh event service contract.
// IMPORTANT: x-client-id is a demo routing label, NOT authentication.
// Do not expose this server to the public Internet.
package mesh

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sync"
)

const maxBodyBytes int64 = 64 * 1024

var clientPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{3,64}$`)
var keyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)
var topicPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,63}$`)

// Event is the public, client-scoped record.
type Event struct {
	ID      string `json:"id"`
	Topic   string `json:"topic"`
	Payload string `json:"payload"`
}

type input struct {
	Topic   string `json:"topic"`
	Payload string `json:"payload"`
}

type entry struct {
	Digest string
	Event  Event
}

type stored struct {
	Client string
	Event  Event
}

// Service stores up to maxEntries synthetic events in memory. No queue,
// durable persistence, distributed transport, authentication or gRPC.
type Service struct {
	mu         sync.Mutex
	sequence   uint64
	maxEntries int
	byKey      map[string]entry
	events     []stored
}

func NewService(maxEntries int) *Service {
	if maxEntries < 1 {
		maxEntries = 1000
	}
	return &Service{maxEntries: maxEntries, byKey: make(map[string]entry)}
}

func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func fail(w http.ResponseWriter, status int, code string) {
	respond(w, status, map[string]string{"error": code})
}

func (s *Service) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet && r.URL.Path == "/health" {
		respond(w, http.StatusOK, map[string]any{"ok": true, "service": "ForgeMesh"})
		return
	}
	if r.URL.Path != "/v1/events" || (r.Method != http.MethodGet && r.Method != http.MethodPost) {
		fail(w, http.StatusNotFound, "not_found")
		return
	}
	client := r.Header.Get("X-Client-Id")
	if !clientPattern.MatchString(client) {
		fail(w, http.StatusUnauthorized, "invalid_client_label")
		return
	}
	if r.Method == http.MethodGet {
		topic := r.URL.Query().Get("topic")
		if !topicPattern.MatchString(topic) {
			fail(w, http.StatusUnprocessableEntity, "invalid_topic")
			return
		}
		s.mu.Lock()
		found := make([]Event, 0)
		for _, e := range s.events {
			if e.Client == client && e.Event.Topic == topic {
				found = append(found, e.Event)
			}
		}
		s.mu.Unlock()
		respond(w, http.StatusOK, map[string]any{"events": found})
		return
	}

	key := r.Header.Get("Idempotency-Key")
	if !keyPattern.MatchString(key) {
		fail(w, http.StatusPreconditionRequired, "invalid_idempotency_key")
		return
	}
	defer r.Body.Close()
	// Read at most maxBodyBytes+1 before parsing, so size takes precedence
	// over syntax errors and matches the Node contract on oversized input.
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		fail(w, http.StatusBadRequest, "invalid_json")
		return
	}
	if int64(len(raw)) > maxBodyBytes {
		fail(w, http.StatusRequestEntityTooLarge, "body_too_large")
		return
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var request input
	if err := decoder.Decode(&request); err != nil {
		fail(w, http.StatusBadRequest, "invalid_json")
		return
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		fail(w, http.StatusBadRequest, "invalid_json")
		return
	}
	if !topicPattern.MatchString(request.Topic) || len(request.Payload) == 0 || len(request.Payload) > 1024 {
		fail(w, http.StatusUnprocessableEntity, "invalid_event")
		return
	}
	sum := sha256.Sum256([]byte(request.Topic + "\x00" + request.Payload))
	digest := hex.EncodeToString(sum[:])
	scope := client + "\x00" + key

	s.mu.Lock()
	defer s.mu.Unlock()
	if prior, ok := s.byKey[scope]; ok {
		if prior.Digest != digest {
			fail(w, http.StatusConflict, "idempotency_conflict")
			return
		}
		w.Header().Set("Idempotency-Replayed", "true")
		respond(w, http.StatusOK, prior.Event)
		return
	}
	if len(s.events) >= s.maxEntries {
		fail(w, http.StatusServiceUnavailable, "capacity_exceeded")
		return
	}
	s.sequence++
	event := Event{ID: fmt.Sprintf("evt-%06d", s.sequence), Topic: request.Topic, Payload: request.Payload}
	s.byKey[scope] = entry{Digest: digest, Event: event}
	s.events = append(s.events, stored{Client: client, Event: event})
	respond(w, http.StatusCreated, event)
}
