package analytics

import "testing"

func TestParsePublicEventAllowlist(t *testing.T) {
	for _, value := range []string{"quiz_started", "quiz_completed"} {
		event, err := ParsePublicEvent(value)
		if err != nil || string(event) != value {
			t.Fatalf("ParsePublicEvent(%q) = %q, %v", value, event, err)
		}
	}
	for _, value := range []string{"subscription_confirmed", "email", "answers", ""} {
		if _, err := ParsePublicEvent(value); err == nil {
			t.Fatalf("ParsePublicEvent(%q) unexpectedly succeeded", value)
		}
	}
}

func TestFieldNameRejectsUnknownEvent(t *testing.T) {
	if _, err := FieldName(Event("visitor_id")); err == nil {
		t.Fatal("unknown event unexpectedly received a storage field")
	}
}
