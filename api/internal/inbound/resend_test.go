package inbound

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestResendForwarderPreservesContentAndAttachments(t *testing.T) {
	var sent map[string]any
	var idempotencyKey string
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		switch {
		case req.Method == http.MethodGet &&
			req.URL.Path == "/emails/receiving/email_123":
			return jsonResponse(http.StatusOK, `{
				"id":"email_123",
				"to":["reflection@mirrorloopai.com"],
				"from":"Reader <reader@example.com>",
				"subject":"A question",
				"html":"<p>Hello</p>",
				"text":"Hello",
				"attachments":[{"id":"att_1","filename":"note.txt","content_type":"text/plain","content_id":""}]
			}`), nil
		case req.Method == http.MethodGet &&
			req.URL.Path == "/emails/receiving/email_123/attachments/att_1":
			return jsonResponse(http.StatusOK, `{"download_url":"https://download.test/note"}`), nil
		case req.Method == http.MethodGet && req.URL.Host == "download.test":
			return jsonResponse(http.StatusOK, "attachment body"), nil
		case req.Method == http.MethodPost && req.URL.Path == "/emails":
			idempotencyKey = req.Header.Get("Idempotency-Key")
			if err := json.NewDecoder(req.Body).Decode(&sent); err != nil {
				t.Fatal(err)
			}
			return jsonResponse(http.StatusOK, `{"id":"sent_123"}`), nil
		default:
			t.Fatalf("unexpected request: %s %s", req.Method, req.URL)
			return nil, nil
		}
	})}
	forwarder := ResendForwarder{
		APIKey:     "re_test",
		From:       "MIRROR//LOOP <reflection@mirrorloopai.com>",
		OwnerEmail: "owner@example.com",
		HTTPClient: client,
	}
	if err := forwarder.Forward(t.Context(), "email_123"); err != nil {
		t.Fatal(err)
	}
	if idempotencyKey != "mirrorloop-inbound-email_123" {
		t.Fatalf("idempotency key=%q", idempotencyKey)
	}
	if sent["reply_to"] != "Reader <reader@example.com>" {
		t.Fatalf("reply_to=%v", sent["reply_to"])
	}
	if sent["subject"] != "[mirrorloopai.com → reflection@mirrorloopai.com] A question" {
		t.Fatalf("subject=%v", sent["subject"])
	}
	to := sent["to"].([]any)
	if len(to) != 1 || to[0] != "owner@example.com" {
		t.Fatalf("to=%v", to)
	}
	attachments := sent["attachments"].([]any)
	attachment := attachments[0].(map[string]any)
	if attachment["content"] != base64.StdEncoding.EncodeToString([]byte("attachment body")) {
		t.Fatalf("attachment=%v", attachment)
	}
}
