package subscriber

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func captureResendPayload(t *testing.T, send func(ResendMailer) error) map[string]any {
	t.Helper()
	var payload map[string]any
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body:       io.NopCloser(strings.NewReader(`{"id":"test"}`)),
			Header:     make(http.Header),
		}, nil
	})}
	mailer := ResendMailer{
		APIKey:     "test-key",
		From:       "MIRROR//LOOP <reflection@mirrorloopai.com>",
		ReplyTo:    "constantine@aitrailblazer.com",
		OwnerEmail: "constantine@aitrailblazer.com",
		HTTPClient: client,
	}
	if err := send(mailer); err != nil {
		t.Fatal(err)
	}
	return payload
}

func TestOrderEmailsSetExpectationsAndResendIdempotency(t *testing.T) {
	var payloads []map[string]any
	var keys []string
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		payloads = append(payloads, payload)
		keys = append(keys, req.Header.Get("Idempotency-Key"))
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body:       io.NopCloser(strings.NewReader(`{"id":"test"}`)),
			Header:     make(http.Header),
		}, nil
	})}
	mailer := ResendMailer{
		APIKey: "test-key", From: "MIRROR//LOOP <reflection@mirrorloopai.com>",
		ReplyTo: "constantine@aitrailblazer.com", OwnerEmail: "owner@example.com",
		HTTPClient: client,
	}
	items := []string{"ARC 01 · Horizon Signal — Mono Edition"}
	if err := mailer.SendBuyerOrderReceived(
		context.Background(), "cs_test_order", "buyer@example.com", items,
	); err != nil {
		t.Fatal(err)
	}
	if err := mailer.SendOwnerOrderNotification(
		context.Background(), "cs_test_order", "buyer@example.com", items,
	); err != nil {
		t.Fatal(err)
	}
	if len(payloads) != 2 {
		t.Fatalf("payload count=%d", len(payloads))
	}
	buyerText, _ := payloads[0]["text"].(string)
	for _, phrase := range []string{
		"Thank you", "PLEASE WAIT", "within 24 hours", "ARC 01",
	} {
		if !strings.Contains(buyerText, phrase) {
			t.Errorf("buyer email missing %q", phrase)
		}
	}
	ownerRecipients, ok := payloads[1]["to"].([]any)
	if !ok || len(ownerRecipients) != 1 || ownerRecipients[0] != "owner@example.com" {
		t.Fatalf("owner recipients=%#v", payloads[1]["to"])
	}
	ownerText, _ := payloads[1]["text"].(string)
	for _, phrase := range []string{
		"FULFILLMENT REQUIRED", "buyer@example.com", "cs_test_order", "ARC 01",
	} {
		if !strings.Contains(ownerText, phrase) {
			t.Errorf("owner email missing %q", phrase)
		}
	}
	if keys[0] != "mirrorloop-cs_test_order-buyer" ||
		keys[1] != "mirrorloop-cs_test_order-owner" {
		t.Fatalf("idempotency keys=%#v", keys)
	}
	if payloads[0]["reply_to"] != "constantine@aitrailblazer.com" {
		t.Fatalf("buyer reply_to=%v", payloads[0]["reply_to"])
	}
	if payloads[1]["reply_to"] != "buyer@example.com" {
		t.Fatalf("owner reply_to=%v", payloads[1]["reply_to"])
	}
	if payloads[1]["subject"] != "MIRROR//LOOP order received — action needed" {
		t.Fatalf("owner subject=%v", payloads[1]["subject"])
	}
}

func TestResendMailerAddsReplyTo(t *testing.T) {
	payload := captureResendPayload(t, func(mailer ResendMailer) error {
		return mailer.SendConfirmation(context.Background(), "person@example.com", "https://example.com/confirm")
	})
	if payload["reply_to"] != "constantine@aitrailblazer.com" {
		t.Fatalf("reply_to=%v", payload["reply_to"])
	}
}

func TestConfirmationEmailSetsAccurateExpectationsInHTMLAndText(t *testing.T) {
	link := "https://mirrorloopai.com/api/v1/subscribers/verify?token=signed%2Btoken"
	payload := captureResendPayload(t, func(mailer ResendMailer) error {
		return mailer.SendConfirmation(context.Background(), "person@example.com", link)
	})

	htmlBody, _ := payload["html"].(string)
	textBody, _ := payload["text"].(string)
	for name, body := range map[string]string{"html": htmlBody, "text": textBody} {
		for _, phrase := range []string{
			"reflection you requested",
			"review and confirm",
			"launch list",
			"unsubscribe",
			"48 hours",
			link,
		} {
			if !strings.Contains(strings.ToLower(body), strings.ToLower(phrase)) {
				t.Errorf("%s body missing %q", name, phrase)
			}
		}
	}
	if !strings.Contains(htmlBody, "display:none") {
		t.Error("confirmation HTML is missing a hidden preheader")
	}
	if strings.Contains(strings.ToLower(htmlBody), "<img") {
		t.Error("confirmation email must not add remote images or tracking pixels")
	}
}

func TestReflectionEmailPreservesResultMeaningAndLaunchListContext(t *testing.T) {
	record := Record{
		Email: "person@example.com",
		Result: Result{
			DominantCode:   "01",
			Dominant:       Archetypes["01"],
			DominantCount:  5,
			SecondaryCode:  "11",
			Secondary:      Archetypes["11"],
			SecondaryCount: 3,
		},
	}
	payload := captureResendPayload(t, func(mailer ResendMailer) error {
		return mailer.SendReflection(context.Background(), record, "https://mirrorloopai.com/api/v1/subscribers/unsubscribe?token=abc")
	})

	if subject, _ := payload["subject"].(string); !strings.Contains(subject, "Horizon Signal") {
		t.Errorf("subject=%q; want the primary result name", subject)
	}
	htmlBody, _ := payload["html"].(string)
	textBody, _ := payload["text"].(string)
	for name, body := range map[string]string{"html": htmlBody, "text": textBody} {
		for _, phrase := range []string{
			"Finding direction",
			"You naturally look for a direction worth moving toward.",
			"5 of 12 times",
			"Name the next visible horizon.",
			"Velocity Holder",
			"You trust a small action that can create sustained momentum.",
			"3 of 12 times",
			"launch list",
			"App Store",
			"unsubscribe",
			"not a diagnosis",
		} {
			if !strings.Contains(body, phrase) {
				t.Errorf("%s body missing %q", name, phrase)
			}
		}
	}
	if !strings.Contains(htmlBody, "display:none") {
		t.Error("reflection HTML is missing a hidden preheader")
	}
	if strings.Contains(strings.ToLower(htmlBody), "<img") {
		t.Error("reflection email must not add remote images or tracking pixels")
	}
}

func TestReflectionEmailOmitsUnsupportedSecondaryPattern(t *testing.T) {
	record := Record{
		Email: "person@example.com",
		Result: Result{
			DominantCode: "01",
			Dominant:     Archetypes["01"],
		},
	}
	payload := captureResendPayload(t, func(mailer ResendMailer) error {
		return mailer.SendReflection(context.Background(), record, "https://mirrorloopai.com/unsubscribe")
	})

	for _, field := range []string{"html", "text"} {
		body, _ := payload[field].(string)
		if strings.Contains(strings.ToLower(body), "supporting pattern is") {
			t.Errorf("%s body presented an unsupported secondary pattern", field)
		}
	}
}

func TestReflectionEmailUsesCanonicalCopyForOlderStoredResults(t *testing.T) {
	record := Record{
		Email: "person@example.com",
		Result: Result{
			DominantCode:  "01",
			Dominant:      Archetype{Name: "Old Name", Domain: "Future-Pull Mechanics"},
			DominantCount: 4,
		},
	}
	payload := captureResendPayload(t, func(mailer ResendMailer) error {
		return mailer.SendReflection(context.Background(), record, "https://mirrorloopai.com/unsubscribe")
	})
	htmlBody, _ := payload["html"].(string)
	if !strings.Contains(htmlBody, "Horizon Signal") || !strings.Contains(htmlBody, "Finding direction") {
		t.Fatal("reflection did not resolve canonical copy from the stable result code")
	}
	if strings.Contains(htmlBody, "Old Name") || strings.Contains(htmlBody, "Future-Pull Mechanics") {
		t.Fatal("reflection leaked stale stored presentation copy")
	}
}

func TestOwnerQuizSubmissionEmailContainsOrderedAnswersAndFulfillmentContext(t *testing.T) {
	answers := []string{"01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"}
	answerDetails := make([]AnswerDetail, AnswerCount)
	for index := range answerDetails {
		answerDetails[index] = AnswerDetail{
			Question:  fmt.Sprintf("Question text %d?", index+1),
			Selection: fmt.Sprintf("Selected choice %d", index+1),
		}
	}
	submission := OwnerQuizSubmission{
		SubmissionID:  "0123456789abcdef0123456789abcdef",
		Email:         "participant@example.com",
		Source:        "mirrorloopai.com/quiz",
		QuizVersion:   "2.0.0",
		Answers:       answers,
		AnswerDetails: answerDetails,
		Result: Result{
			DominantCode:  "01",
			Dominant:      Archetypes["01"],
			DominantCount: 1,
		},
		SubmittedAt: time.Date(2026, 8, 30, 7, 45, 0, 0, time.UTC),
	}
	var idempotencyKey string
	var payload map[string]any
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		idempotencyKey = req.Header.Get("Idempotency-Key")
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body:       io.NopCloser(strings.NewReader(`{"id":"test"}`)),
			Header:     make(http.Header),
		}, nil
	})}
	mailer := ResendMailer{
		APIKey:     "test-key",
		From:       "MIRROR//LOOP <reflection@mirrorloopai.com>",
		ReplyTo:    "constantine@aitrailblazer.com",
		OwnerEmail: "constantine@aitrailblazer.com",
		HTTPClient: client,
	}
	if err := mailer.SendOwnerQuizSubmission(context.Background(), submission); err != nil {
		t.Fatal(err)
	}
	recipients, ok := payload["to"].([]any)
	if !ok || len(recipients) != 1 || recipients[0] != "constantine@aitrailblazer.com" {
		t.Fatalf("owner recipients=%#v", payload["to"])
	}
	if payload["reply_to"] != "participant@example.com" {
		t.Fatalf("reply_to=%v", payload["reply_to"])
	}
	if payload["subject"] != "MIRROR//LOOP quiz submitted — manual review available" {
		t.Fatalf("subject=%v", payload["subject"])
	}
	textBody, _ := payload["text"].(string)
	for _, expected := range []string{
		"participant@example.com",
		"Pending email confirmation",
		"Quiz version: 2.0.0",
		"Source: mirrorloopai.com/quiz",
		"Compact result: 01 · Horizon Signal",
		"Q01 · Question text 1?",
		"Selected: Selected choice 1",
		"Code: 01 — Horizon Signal (Finding direction)",
		"Q12 · Question text 12?",
		"Selected: Selected choice 12",
		"Code: 12 — Convergence Seal (Bringing things together)",
		"subscriber database retains the compact result",
	} {
		if !strings.Contains(textBody, expected) {
			t.Errorf("owner notification missing %q", expected)
		}
	}
	if !strings.HasPrefix(idempotencyKey, "mirrorloop-quiz-"+submission.SubmissionID+"-") ||
		!strings.HasSuffix(idempotencyKey, "-owner") {
		t.Fatalf("idempotency key=%q", idempotencyKey)
	}
}
