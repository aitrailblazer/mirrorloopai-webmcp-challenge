package subscriber

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
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
	body := getResponse.Body.String()
	if getResponse.Code != http.StatusOK || !strings.Contains(body, "Confirm and send my reflection") {
		t.Fatalf("GET status=%d body=%q", getResponse.Code, getResponse.Body.String())
	}
	for _, expected := range []string{
		"MIRROR<span>//</span>LOOP",
		"Confirming does two things:",
		"Your saved MIRROR//LOOP reflection is sent to your inbox.",
		"occasional App Store release and product updates",
		"48-hour review window",
		"Return without confirming",
		`rel="stylesheet" href="/confirmation.css?v=20260830-1"`,
		`method="post"`,
	} {
		if !strings.Contains(body, expected) {
			t.Errorf("confirmation page missing %q", expected)
		}
	}
	if strings.Contains(body, "<script") || strings.Contains(body, "<style") || strings.Contains(body, "http://") || strings.Contains(body, "https://") {
		t.Error("confirmation page must not contain scripts or external assets")
	}
	if csp := getResponse.Header().Get("Content-Security-Policy"); !strings.Contains(csp, "style-src 'self'") || strings.Contains(csp, "'unsafe-inline'") || !strings.Contains(csp, "form-action 'self'") || !strings.Contains(csp, "frame-ancestors 'none'") {
		t.Fatalf("confirmation CSP=%q", csp)
	}
	if output := os.Getenv("MIRRORLOOP_CONFIRMATION_HTML_OUT"); output != "" {
		if err := os.WriteFile(output, getResponse.Body.Bytes(), 0o600); err != nil {
			t.Fatal(err)
		}
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
	postBody := postResponse.Body.String()
	if postResponse.Code != http.StatusOK || mailer.reflections != 1 {
		t.Fatalf("POST status=%d reflections=%d", postResponse.Code, mailer.reflections)
	}
	for _, expected := range []string{
		"Your reflection is ready",
		"You do not need to repeat the quiz.",
		"What to remember",
		"Convergence Seal",
		"Bringing things together",
		"You look for the point where different needs can align into one direction.",
		"List what matters most. What single action honors more than one priority?",
		"second email",
		"open that email on any device",
		"remain only in the browser where you completed the quiz",
		"not synchronized",
		"compact result",
	} {
		if !strings.Contains(postBody, expected) {
			t.Errorf("successful confirmation page missing %q", expected)
		}
	}
	for _, private := range []string{"person@example.com", `"answers"`, "12,12,12"} {
		if strings.Contains(postBody, private) {
			t.Errorf("successful confirmation page leaked %q", private)
		}
	}
	if output := os.Getenv("MIRRORLOOP_CONFIRMED_HTML_OUT"); output != "" {
		if err := os.WriteFile(output, postResponse.Body.Bytes(), 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

func TestInvalidConfirmationUsesBrandedRecoveryPage(t *testing.T) {
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(NewMemoryStore(), &captureMailer{}, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed", ConsentVersion: "v1",
	})
	request := httptest.NewRequest(http.MethodGet, "/v1/subscribers/verify?token=invalid", nil)
	response := httptest.NewRecorder()
	NewHTTPHandler(service, nil).ServeHTTP(response, request)

	body := response.Body.String()
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%q", response.Code, body)
	}
	for _, expected := range []string{
		"MIRROR<span>//</span>LOOP",
		"This link is no longer active",
		"Request a new reflection from the quiz",
		"No subscription was activated.",
		"Return to MIRROR//LOOP",
	} {
		if !strings.Contains(body, expected) {
			t.Errorf("invalid-link page missing %q", expected)
		}
	}
	if strings.Contains(body, "<form") {
		t.Error("invalid-link page must not render an action form")
	}
}

func TestActionPageEscapesRequestURI(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, `/v1/subscribers/verify?token=%22%3E%3Cscript%3Ealert(1)%3C/script%3E`, nil)
	response := httptest.NewRecorder()
	renderActionPage(response, request, actionPage{
		Kind:      "confirm",
		Eyebrow:   "Review",
		Title:     "Confirm",
		Message:   "Continue deliberately.",
		Button:    "Confirm",
		Footnote:  "No change before confirmation.",
		LinkLabel: "Return",
		LinkURL:   "/",
	})
	body := response.Body.String()
	if strings.Contains(body, "<script>alert") || !strings.Contains(body, "%3Cscript%3E") {
		t.Fatalf("unsafe action rendering: %q", body)
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
