package mesh

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func call(service *Service, method, path, client, key, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if client != "" {
		req.Header.Set("X-Client-Id", client)
	}
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	w := httptest.NewRecorder()
	service.ServeHTTP(w, req)
	return w
}

func TestHealth(t *testing.T) {
	r := call(NewService(10), "GET", "/health", "", "", "")
	if r.Code != 200 || !strings.Contains(r.Body.String(), "ForgeMesh") {
		t.Fatal(r.Code, r.Body)
	}
}

func TestCreateAndReplay(t *testing.T) {
	svc := NewService(10)
	body := `{"topic":"build-ready","payload":"ok"}`
	a := call(svc, "POST", "/v1/events", "team_01", "request-0001", body)
	b := call(svc, "POST", "/v1/events", "team_01", "request-0001", body)
	if a.Code != 201 || b.Code != 200 || b.Header().Get("Idempotency-Replayed") != "true" {
		t.Fatalf("first %d, replay %d", a.Code, b.Code)
	}
	if !bytes.Equal(a.Body.Bytes(), b.Body.Bytes()) {
		t.Fatal("same key should replay the exact event")
	}
}

func TestConflictAndClientIsolation(t *testing.T) {
	svc := NewService(10)
	if code := call(svc, "POST", "/v1/events", "team_01", "request-0001", `{"topic":"build-ready","payload":"ok"}`).Code; code != 201 {
		t.Fatal(code)
	}
	if code := call(svc, "POST", "/v1/events", "team_01", "request-0001", `{"topic":"build-ready","payload":"changed"}`).Code; code != 409 {
		t.Fatal(code)
	}
	if code := call(svc, "POST", "/v1/events", "team_02", "request-0001", `{"topic":"build-ready","payload":"changed"}`).Code; code != 201 {
		t.Fatal(code)
	}
	res := call(svc, "GET", "/v1/events?topic=build-ready", "team_01", "", "")
	var found struct{ Events []Event `json:"events"` }
	if err := json.Unmarshal(res.Body.Bytes(), &found); err != nil || len(found.Events) != 1 || found.Events[0].Payload != "ok" {
		t.Fatalf("unexpected scoped result: %s / %v", res.Body.String(), err)
	}
}

func TestMalformedAndBoundedRequests(t *testing.T) {
	svc := NewService(10)
	for _, tc := range []struct {
		name, client, key, body string
		want int
	}{
		{"missing client", "", "request-0001", `{"topic":"ok","payload":"x"}`, 401},
		{"missing key", "team_01", "", `{"topic":"ok","payload":"x"}`, 428},
		{"unknown field", "team_01", "request-0001", `{"topic":"ok","payload":"x","command":"shell"}`, 400},
		{"invalid topic", "team_01", "request-0002", `{"topic":"../x","payload":"x"}`, 422},
		{"oversized body", "team_01", "request-0003", strings.Repeat("x", 70000), 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := call(svc, "POST", "/v1/events", tc.client, tc.key, tc.body)
			if got.Code != tc.want {
				t.Fatalf("got %d want %d body %s", got.Code, tc.want, got.Body.String())
			}
		})
	}
}

func TestCapacityAndReplay(t *testing.T) {
	svc := NewService(1)
	body := `{"topic":"build-ready","payload":"ok"}`
	if call(svc, "POST", "/v1/events", "team_01", "request-0001", body).Code != 201 {
		t.Fatal("initial insert failed")
	}
	if call(svc, "POST", "/v1/events", "team_01", "request-0002", body).Code != 503 {
		t.Fatal("capacity not enforced")
	}
	if call(svc, "POST", "/v1/events", "team_01", "request-0001", body).Code != 200 {
		t.Fatal("old idempotency replay should remain available")
	}
}

func TestConcurrentReplaysDoNotCreateDuplicates(t *testing.T) {
	svc := NewService(100)
	var wg sync.WaitGroup
	var mu sync.Mutex
	ids := make([]string, 0, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			response := call(svc, "POST", "/v1/events", "team_01", "request-0001", `{"topic":"build-ready","payload":"ok"}`)
			var event Event
			if response.Code != 200 && response.Code != 201 {
				t.Errorf("unexpected status %d", response.Code)
				return
			}
			if err := json.Unmarshal(response.Body.Bytes(), &event); err != nil {
				t.Error(err)
				return
			}
			mu.Lock()
			ids = append(ids, event.ID)
			mu.Unlock()
		}()
	}
	wg.Wait()
	if len(ids) != 20 {
		t.Fatalf("got %d events", len(ids))
	}
	for _, id := range ids {
		if id != ids[0] {
			t.Fatal("duplicate created in concurrent replay")
		}
	}
}

func TestRealHTTPServer(t *testing.T) {
	svc := NewService(10)
	server := httptest.NewServer(svc)
	defer server.Close()
	client := server.Client()

	health, err := client.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer health.Body.Close()
	if health.StatusCode != http.StatusOK {
		t.Fatalf("health status: %d", health.StatusCode)
	}

	req, err := http.NewRequest(http.MethodPost, server.URL+"/v1/events", strings.NewReader(`{"topic":"build-ready","payload":"verified"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-Client-Id", "team_01")
	req.Header.Set("Idempotency-Key", "request-0001")
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("event status: %d", res.StatusCode)
	}
	var received Event
	if err := json.NewDecoder(res.Body).Decode(&received); err != nil {
		t.Fatal(err)
	}
	if received.ID != "evt-000001" || received.Payload != "verified" {
		t.Fatalf("unexpected live HTTP event: %#v", received)
	}
}
