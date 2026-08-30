package subscriber

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"mirrorloopai.com/web/api/internal/analytics"
)

type Store interface {
	UpsertPending(context.Context, Record) error
	Confirm(context.Context, string, time.Time) (Record, bool, error)
	Unsubscribe(context.Context, string, time.Time) error
}

type Mailer interface {
	SendConfirmation(context.Context, string, string) error
	SendReflection(context.Context, Record, string) error
	SendOwnerQuizSubmission(context.Context, OwnerQuizSubmission) error
}

type ChallengeVerifier interface {
	Verify(context.Context, string, string) error
}

type Service struct {
	store           Store
	mailer          Mailer
	challenge       ChallengeVerifier
	signer          *TokenSigner
	subscriberKey   []byte
	publicAPIURL    string
	confirmedURL    string
	consentVersion  string
	challengeNeeded bool
	analytics       analytics.Recorder
	now             func() time.Time
}

type ServiceConfig struct {
	SubscriberIDSecret string
	PublicAPIURL       string
	ConfirmedURL       string
	ConsentVersion     string
	ChallengeRequired  bool
	Analytics          analytics.Recorder
}

func NewService(store Store, mailer Mailer, challenge ChallengeVerifier, signer *TokenSigner, cfg ServiceConfig) (*Service, error) {
	if len(cfg.SubscriberIDSecret) < 32 {
		return nil, errors.New("subscriber ID secret must contain at least 32 characters")
	}
	if store == nil || mailer == nil || challenge == nil || signer == nil {
		return nil, errors.New("service dependencies are required")
	}
	recorder := cfg.Analytics
	if recorder == nil {
		recorder = analytics.NoopRecorder{}
	}
	return &Service{
		store: store, mailer: mailer, challenge: challenge, signer: signer,
		subscriberKey: []byte(cfg.SubscriberIDSecret), publicAPIURL: strings.TrimRight(cfg.PublicAPIURL, "/"),
		confirmedURL: cfg.ConfirmedURL, consentVersion: cfg.ConsentVersion,
		challengeNeeded: cfg.ChallengeRequired, analytics: recorder, now: time.Now,
	}, nil
}

func (s *Service) Subscribe(ctx context.Context, req SubscribeRequest, remoteIP string) error {
	if strings.TrimSpace(req.Website) != "" {
		return nil // Honeypot: return the same public success response without writing.
	}
	if !req.Consent || req.ConsentVersion != s.consentVersion {
		return errors.New("consent is required")
	}
	if s.challengeNeeded || req.ChallengeToken != "" {
		if err := s.challenge.Verify(ctx, req.ChallengeToken, remoteIP); err != nil {
			return errors.New("human verification failed")
		}
	}
	email, err := NormalizeEmail(req.Email)
	if err != nil {
		return err
	}
	result, err := Score(req.Answers)
	if err != nil {
		return err
	}
	answerDetails, err := normalizeAnswerDetails(req.AnswerDetails)
	if err != nil {
		return err
	}
	now := s.now().UTC()
	pendingExpiresAt := now.Add(30 * 24 * time.Hour)
	id := s.subscriberID(email)
	record := Record{
		ID: id, Email: email, Status: "pending", ConsentVersion: req.ConsentVersion,
		ConsentAt: now, Source: cleanSource(req.Source), QuizVersion: cleanVersion(req.QuizVersion),
		Result: result, CreatedAt: now, UpdatedAt: now, PendingExpiresAt: &pendingExpiresAt,
	}
	if err := s.store.UpsertPending(ctx, record); err != nil {
		return fmt.Errorf("store pending subscriber: %w", err)
	}
	token, err := s.signer.Sign(id, "verify", 48*time.Hour)
	if err != nil {
		return err
	}
	link := s.publicAPIURL + "/v1/subscribers/verify?token=" + url.QueryEscape(token)
	if err := s.mailer.SendConfirmation(ctx, email, link); err != nil {
		return fmt.Errorf("send confirmation: %w", err)
	}
	if err := s.mailer.SendOwnerQuizSubmission(ctx, OwnerQuizSubmission{
		SubmissionID:  id,
		Email:         email,
		Source:        record.Source,
		QuizVersion:   record.QuizVersion,
		Answers:       append([]string(nil), req.Answers...),
		AnswerDetails: append([]AnswerDetail(nil), answerDetails...),
		Result:        result,
		SubmittedAt:   now,
	}); err != nil {
		slog.ErrorContext(ctx, "owner quiz submission notification failed",
			"subscriber_id", id, "error", err)
	}
	return nil
}

func (s *Service) Confirm(ctx context.Context, token string) (Record, error) {
	id, err := s.signer.Verify(token, "verify")
	if err != nil {
		return Record{}, err
	}
	now := s.now().UTC()
	record, activated, err := s.store.Confirm(ctx, id, now)
	if err != nil {
		return Record{}, err
	}
	if activated {
		if err := s.analytics.Record(ctx, analytics.EventSubscriptionConfirmed, now); err != nil {
			slog.ErrorContext(ctx, "confirmed subscription analytics failed", "error", err)
		}
	}
	unsubscribeToken, err := s.signer.Sign(id, "unsubscribe", 10*365*24*time.Hour)
	if err != nil {
		return Record{}, err
	}
	unsubscribeURL := s.publicAPIURL + "/v1/subscribers/unsubscribe?token=" + url.QueryEscape(unsubscribeToken)
	if err := s.mailer.SendReflection(ctx, record, unsubscribeURL); err != nil {
		slog.ErrorContext(ctx, "confirmed subscriber but reflection delivery failed", "subscriber_id", id, "error", err)
		return Record{}, errors.New("subscription confirmed; reflection delivery is delayed")
	}
	return record, nil
}

func (s *Service) Unsubscribe(ctx context.Context, token string) error {
	id, err := s.signer.Verify(token, "unsubscribe")
	if err != nil {
		return err
	}
	return s.store.Unsubscribe(ctx, id, s.now().UTC())
}

func (s *Service) ValidateToken(token, action string) error {
	_, err := s.signer.Verify(token, action)
	return err
}

func (s *Service) RecordPublicAnalytics(ctx context.Context, value string) error {
	event, err := analytics.ParsePublicEvent(value)
	if err != nil {
		return err
	}
	return s.analytics.Record(ctx, event, s.now().UTC())
}

func (s *Service) subscriberID(email string) string {
	mac := hmac.New(sha256.New, s.subscriberKey)
	_, _ = mac.Write([]byte(email))
	return hex.EncodeToString(mac.Sum(nil))
}

func cleanSource(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 120 {
		return "mirrorloopai.com"
	}
	return value
}

func cleanVersion(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 32 {
		return "unknown"
	}
	return value
}

func (s *Service) ConfirmedURL() string { return s.confirmedURL }
