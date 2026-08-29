package subscriber

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"mirrorloopai.com/web/api/internal/analytics"
)

func TestSubscriberHTTPContractAndCORS(t *testing.T) {
	store := NewMemoryStore()
	mailer := &captureMailer{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(store, mailer, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed.html", ConsentVersion: "v1",
	})
	handler := NewHTTPHandler(service, []string{"https://mirrorloopai.com"})
	answers := make([]string, AnswerCount)
	for i := range answers {
		answers[i] = "01"
	}
	body, _ := json.Marshal(SubscribeRequest{Email: "person@example.com", Consent: true, ConsentVersion: "v1", Answers: answers})
	request := httptest.NewRequest(http.MethodPost, "/v1/subscribers", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://mirrorloopai.com")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusAccepted {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if response.Header().Get("Access-Control-Allow-Origin") != "https://mirrorloopai.com" {
		t.Fatal("expected allowed CORS origin")
	}
}

func TestInvalidSubscriberRequestIsRejected(t *testing.T) {
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(NewMemoryStore(), &captureMailer{}, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed.html", ConsentVersion: "v1",
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/subscribers", bytes.NewBufferString(`{"email":"bad"}`))
	response := httptest.NewRecorder()
	NewHTTPHandler(service, nil).ServeHTTP(response, request.WithContext(context.Background()))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", response.Code)
	}
}

func TestPublicAnalyticsEventContract(t *testing.T) {
	events := &captureAnalytics{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(NewMemoryStore(), &captureMailer{}, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed.html", ConsentVersion: "v1",
		Analytics: events,
	})
	handler := NewHTTPHandler(service, []string{"https://mirrorloopai.com"})

	for _, event := range []string{"quiz_started", "quiz_completed"} {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/events", bytes.NewBufferString(`{"event":"`+event+`"}`))
		request.Header.Set("Origin", "https://mirrorloopai.com")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusNoContent {
			t.Fatalf("event=%q status=%d body=%s", event, response.Code, response.Body.String())
		}
	}
	if len(events.events) != 2 || events.events[0] != analytics.EventQuizStarted || events.events[1] != analytics.EventQuizCompleted {
		t.Fatalf("events=%v", events.events)
	}
}

func TestPublicAnalyticsRejectsSensitiveAndUnknownFields(t *testing.T) {
	events := &captureAnalytics{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(NewMemoryStore(), &captureMailer{}, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed.html", ConsentVersion: "v1",
		Analytics: events,
	})
	handler := NewHTTPHandler(service, []string{"https://mirrorloopai.com"})
	for _, body := range []string{
		`{"event":"subscription_confirmed"}`,
		`{"event":"quiz_started","email":"person@example.com"}`,
		`{"event":"quiz_completed","answers":["01"]}`,
		`{"event":"quiz_started"}{"event":"quiz_completed"}`,
		`{"event":"quiz_started","padding":"` + strings.Repeat("x", 1024) + `"}`,
	} {
		request := httptest.NewRequest(http.MethodPost, "/v1/analytics/events", bytes.NewBufferString(body))
		request.Header.Set("Origin", "https://mirrorloopai.com")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body=%s status=%d", body, response.Code)
		}
	}
	if len(events.events) != 0 {
		t.Fatalf("rejected payloads recorded events=%v", events.events)
	}
}

func TestPublicAnalyticsRejectsUntrustedOrigin(t *testing.T) {
	events := &captureAnalytics{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(NewMemoryStore(), &captureMailer{}, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed.html", ConsentVersion: "v1",
		Analytics: events,
	})
	request := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/events", bytes.NewBufferString(`{"event":"quiz_started"}`))
	request.Header.Set("Origin", "https://attacker.example")
	response := httptest.NewRecorder()
	NewHTTPHandler(service, []string{"https://mirrorloopai.com"}).ServeHTTP(response, request)
	if response.Code != http.StatusForbidden || len(events.events) != 0 {
		t.Fatalf("status=%d events=%v", response.Code, events.events)
	}
}

func TestHealthRouteWorksBehindAPIPrefix(t *testing.T) {
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(NewMemoryStore(), &captureMailer{}, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed.html", ConsentVersion: "v1",
	})
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	response := httptest.NewRecorder()
	NewHTTPHandler(service, nil).ServeHTTP(response, request)
	if response.Code != http.StatusOK || response.Body.String() != "{\"status\":\"ok\"}\n" {
		t.Fatalf("status=%d body=%q", response.Code, response.Body.String())
	}
}

func TestProviderFailureDoesNotLookLikeEmailValidation(t *testing.T) {
	got := publicError(errors.New("send confirmation: email provider unavailable"))
	if got != "We could not process the request. Please try again." {
		t.Fatalf("public error=%q", got)
	}
}

func TestConfirmationGETDoesNotActivateSubscription(t *testing.T) {
	store := NewMemoryStore()
	mailer := &captureMailer{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(store, mailer, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed", ConsentVersion: "v1",
	})
	answers := make([]string, AnswerCount)
	for i := range answers {
		answers[i] = "12"
	}
	if err := service.Subscribe(context.Background(), SubscribeRequest{
		Email: "person@example.com", Consent: true, ConsentVersion: "v1", Answers: answers,
	}, "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	verificationURL, _ := url.Parse(mailer.confirmationLink)
	handler := NewHTTPHandler(service, nil)

	get := httptest.NewRequest(http.MethodGet, verificationURL.RequestURI(), nil)
	getResponse := httptest.NewRecorder()
	handler.ServeHTTP(getResponse, get)
	if getResponse.Code != http.StatusOK || !strings.Contains(getResponse.Body.String(), "Confirm my email") {
		t.Fatalf("GET status=%d body=%q", getResponse.Code, getResponse.Body.String())
	}
	if mailer.reflections != 0 {
		t.Fatal("GET confirmation caused a reflection side effect")
	}
	for _, record := range store.records {
		if record.Status != "pending" {
			t.Fatalf("GET changed status to %q", record.Status)
		}
	}

	post := httptest.NewRequest(http.MethodPost, verificationURL.RequestURI(), nil)
	postResponse := httptest.NewRecorder()
	handler.ServeHTTP(postResponse, post)
	if postResponse.Code != http.StatusSeeOther || mailer.reflections != 1 {
		t.Fatalf("POST status=%d reflections=%d", postResponse.Code, mailer.reflections)
	}
}

func TestUnsubscribeGETDoesNotChangeState(t *testing.T) {
	store := NewMemoryStore()
	mailer := &captureMailer{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(store, mailer, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed", ConsentVersion: "v1",
	})
	store.records["subscriber-1"] = Record{ID: "subscriber-1", Status: "active"}
	token, _ := signer.Sign("subscriber-1", "unsubscribe", time.Hour)
	path := "/v1/subscribers/unsubscribe?token=" + url.QueryEscape(token)
	handler := NewHTTPHandler(service, nil)

	get := httptest.NewRequest(http.MethodGet, path, nil)
	getResponse := httptest.NewRecorder()
	handler.ServeHTTP(getResponse, get)
	if getResponse.Code != http.StatusOK || store.records["subscriber-1"].Status != "active" {
		t.Fatalf("GET status=%d subscriber=%q", getResponse.Code, store.records["subscriber-1"].Status)
	}

	post := httptest.NewRequest(http.MethodPost, path, nil)
	postResponse := httptest.NewRecorder()
	handler.ServeHTTP(postResponse, post)
	if postResponse.Code != http.StatusOK || store.records["subscriber-1"].Status != "unsubscribed" {
		t.Fatalf("POST status=%d subscriber=%q", postResponse.Code, store.records["subscriber-1"].Status)
	}
}
