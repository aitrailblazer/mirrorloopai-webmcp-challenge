package subscriber

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"mirrorloopai.com/web/api/internal/analytics"
)

type captureMailer struct {
	confirmationLink string
	reflections      int
	ownerSubmissions []OwnerQuizSubmission
	ownerError       error
}

func (m *captureMailer) SendConfirmation(_ context.Context, _ string, link string) error {
	m.confirmationLink = link
	return nil
}
func (m *captureMailer) SendReflection(_ context.Context, _ Record, _ string) error {
	m.reflections++
	return nil
}
func (m *captureMailer) SendOwnerQuizSubmission(_ context.Context, submission OwnerQuizSubmission) error {
	m.ownerSubmissions = append(m.ownerSubmissions, submission)
	return m.ownerError
}

type captureAnalytics struct {
	events []analytics.Event
}

func (a *captureAnalytics) Record(_ context.Context, event analytics.Event, _ time.Time) error {
	a.events = append(a.events, event)
	return nil
}

func TestDoubleOptInFlow(t *testing.T) {
	store := NewMemoryStore()
	mailer := &captureMailer{}
	events := &captureAnalytics{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, err := NewService(store, mailer, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com",
		ConfirmedURL:       "https://example.com/confirmed.html",
		ConsentVersion:     "v1",
		Analytics:          events,
	})
	if err != nil {
		t.Fatal(err)
	}
	answers := make([]string, AnswerCount)
	answerDetails := make([]AnswerDetail, AnswerCount)
	for i := range answers {
		answers[i] = "04"
		answerDetails[i] = AnswerDetail{
			Question:  fmt.Sprintf("Question %d?", i+1),
			Selection: fmt.Sprintf("Selected answer %d", i+1),
		}
	}
	err = service.Subscribe(context.Background(), SubscribeRequest{
		Email: "person@example.com", Consent: true, ConsentVersion: "v1",
		Answers: answers, AnswerDetails: answerDetails, QuizVersion: "2.0.0", Source: "test",
	}, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if mailer.confirmationLink == "" || mailer.reflections != 0 {
		t.Fatalf("confirmation=%q reflections=%d", mailer.confirmationLink, mailer.reflections)
	}
	if len(mailer.ownerSubmissions) != 1 {
		t.Fatalf("owner submissions=%d", len(mailer.ownerSubmissions))
	}
	ownerSubmission := mailer.ownerSubmissions[0]
	if ownerSubmission.Email != "person@example.com" ||
		ownerSubmission.Result.DominantCode != "04" ||
		len(ownerSubmission.Answers) != AnswerCount ||
		len(ownerSubmission.AnswerDetails) != AnswerCount {
		t.Fatalf("owner submission=%+v", ownerSubmission)
	}
	for index, answer := range ownerSubmission.Answers {
		if answer != "04" {
			t.Fatalf("owner answer %d=%q", index+1, answer)
		}
	}
	for _, record := range store.records {
		if record.PendingExpiresAt == nil {
			t.Fatal("pending subscriber must have an expiry")
		}
		if record.Result.DominantCode != "04" || record.Result.DominantCount != AnswerCount {
			t.Fatalf("stored compact result=%+v", record.Result)
		}
		if record.Result.SecondaryCode != "" || record.Result.SecondaryCount != 0 {
			t.Fatalf("stored result invented a supporting pattern: %+v", record.Result)
		}
	}
	token := strings.Split(mailer.confirmationLink, "token=")[1]
	record, err := service.Confirm(context.Background(), token)
	if err != nil {
		t.Fatal(err)
	}
	if record.Result.DominantCode != "04" {
		t.Fatalf("confirmed result=%+v", record.Result)
	}
	if mailer.reflections != 1 {
		t.Fatalf("reflections=%d", mailer.reflections)
	}
	if _, err := service.Confirm(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	if len(events.events) != 1 || events.events[0] != analytics.EventSubscriptionConfirmed {
		t.Fatalf("confirmation analytics=%v", events.events)
	}
	for _, record := range store.records {
		if record.PendingExpiresAt != nil {
			t.Fatal("confirmed subscriber must not retain pending expiry")
		}
	}
}

func TestHoneypotDoesNotWriteOrSend(t *testing.T) {
	store := NewMemoryStore()
	mailer := &captureMailer{}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, _ := NewService(store, mailer, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com", ConfirmedURL: "https://example.com/confirmed.html", ConsentVersion: "v1",
	})
	if err := service.Subscribe(context.Background(), SubscribeRequest{Website: "spam.example"}, "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	if len(store.records) != 0 || mailer.confirmationLink != "" {
		t.Fatal("honeypot request produced side effects")
	}
	if len(mailer.ownerSubmissions) != 0 {
		t.Fatal("honeypot request produced an owner notification")
	}
}

func TestOwnerNotificationFailureDoesNotRejectParticipantSubmission(t *testing.T) {
	store := NewMemoryStore()
	mailer := &captureMailer{ownerError: errors.New("owner mailbox unavailable")}
	signer, _ := NewTokenSigner("01234567890123456789012345678901")
	service, err := NewService(store, mailer, AllowChallenge{}, signer, ServiceConfig{
		SubscriberIDSecret: "abcdefghijklmnopqrstuvwxyz123456",
		PublicAPIURL:       "https://api.example.com",
		ConfirmedURL:       "https://example.com/confirmed.html",
		ConsentVersion:     "v1",
	})
	if err != nil {
		t.Fatal(err)
	}
	answers := make([]string, AnswerCount)
	for index := range answers {
		answers[index] = "03"
	}
	if err := service.Subscribe(context.Background(), SubscribeRequest{
		Email: "person@example.com", Consent: true, ConsentVersion: "v1",
		Answers: answers, QuizVersion: "2.0.0", Source: "test",
	}, "127.0.0.1"); err != nil {
		t.Fatalf("owner-notification failure rejected participant submission: %v", err)
	}
	if mailer.confirmationLink == "" || len(mailer.ownerSubmissions) != 1 {
		t.Fatalf("confirmation=%q owner submissions=%d", mailer.confirmationLink, len(mailer.ownerSubmissions))
	}
}
