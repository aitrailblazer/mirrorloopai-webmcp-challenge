package subscriber

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type tokenPayload struct {
	SubscriberID string `json:"sid"`
	Action       string `json:"act"`
	ExpiresUnix  int64  `json:"exp"`
}

type TokenSigner struct {
	secret []byte
	now    func() time.Time
}

func NewTokenSigner(secret string) (*TokenSigner, error) {
	if len(secret) < 32 {
		return nil, errors.New("token secret must contain at least 32 characters")
	}
	return &TokenSigner{secret: []byte(secret), now: time.Now}, nil
}

func (s *TokenSigner) Sign(subscriberID, action string, ttl time.Duration) (string, error) {
	payload, err := json.Marshal(tokenPayload{SubscriberID: subscriberID, Action: action, ExpiresUnix: s.now().Add(ttl).Unix()})
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

func (s *TokenSigner) Verify(token, action string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", errors.New("invalid token")
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("invalid token")
	}
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(parts[0]))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return "", errors.New("invalid token")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", errors.New("invalid token")
	}
	var payload tokenPayload
	if err := json.Unmarshal(raw, &payload); err != nil || payload.SubscriberID == "" || payload.Action != action {
		return "", errors.New("invalid token")
	}
	if s.now().Unix() > payload.ExpiresUnix {
		return "", errors.New("expired token")
	}
	return payload.SubscriberID, nil
}
