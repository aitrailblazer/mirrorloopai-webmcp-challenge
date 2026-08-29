package subscriber

import (
	"testing"
	"time"
)

func TestTokenSignerChecksActionSignatureAndExpiry(t *testing.T) {
	signer, err := NewTokenSigner("01234567890123456789012345678901")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 25, 12, 0, 0, 0, time.UTC)
	signer.now = func() time.Time { return now }
	token, err := signer.Sign("subscriber-1", "verify", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	id, err := signer.Verify(token, "verify")
	if err != nil || id != "subscriber-1" {
		t.Fatalf("verify got id=%q err=%v", id, err)
	}
	if _, err := signer.Verify(token, "unsubscribe"); err == nil {
		t.Fatal("expected wrong action to fail")
	}
	signer.now = func() time.Time { return now.Add(2 * time.Hour) }
	if _, err := signer.Verify(token, "verify"); err == nil {
		t.Fatal("expected expired token to fail")
	}
}
