package telegram

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSendMessageNoopWithoutCredentials(t *testing.T) {
	called := false
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		called = true
		return nil, nil
	})}

	if err := SendMessage(context.Background(), client, "", "", "hello"); err != nil {
		t.Fatalf("SendMessage: %v", err)
	}
	if called {
		t.Fatal("expected no request when credentials missing")
	}
}

func TestSendMessagePostsExpectedPayload(t *testing.T) {
	var gotChatID string
	var gotText string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { _ = r.Body.Close() }()
		if !strings.Contains(r.URL.Path, "/bottoken/sendMessage") {
			t.Fatalf("path = %q", r.URL.Path)
		}
		var body struct {
			ChatID string `json:"chat_id"`
			Text   string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("Decode: %v", err)
		}
		gotChatID = body.ChatID
		gotText = body.Text
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := server.Client()
	oldTransport := client.Transport
	client.Transport = rewriteTransport{base: oldTransport, baseURL: server.URL}

	if err := SendMessage(context.Background(), client, "token", "12345", "hello"); err != nil {
		t.Fatalf("SendMessage: %v", err)
	}
	if gotChatID != "12345" {
		t.Fatalf("chat_id = %q, want 12345", gotChatID)
	}
	if gotText != "hello" {
		t.Fatalf("text = %q, want hello", gotText)
	}
}

func TestSendMessageNon2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	client := server.Client()
	client.Transport = rewriteTransport{base: client.Transport, baseURL: server.URL}

	err := SendMessage(context.Background(), client, "token", "12345", "hello")
	if err == nil {
		t.Fatal("expected error for non-2xx")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type rewriteTransport struct {
	base    http.RoundTripper
	baseURL string
}

func (t rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	base, err := http.NewRequestWithContext(req.Context(), http.MethodPost, t.baseURL+req.URL.Path, req.Body)
	if err != nil {
		return nil, err
	}
	clone.URL = base.URL
	clone.Host = base.Host
	if t.base == nil {
		t.base = http.DefaultTransport
	}
	return t.base.RoundTrip(clone)
}

var _ = time.Second
