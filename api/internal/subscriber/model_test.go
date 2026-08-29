package subscriber

import "testing"

func TestScoreUsesStableArcCodeTieBreak(t *testing.T) {
	answers := []string{"03", "02", "03", "02", "04", "05", "06", "07", "08", "09", "10", "11"}
	result, err := Score(answers)
	if err != nil {
		t.Fatal(err)
	}
	if result.DominantCode != "02" || result.SecondaryCode != "03" {
		t.Fatalf("got dominant=%s secondary=%s", result.DominantCode, result.SecondaryCode)
	}
	if result.DominantCount != 2 || result.SecondaryCount != 2 {
		t.Fatalf("got dominantCount=%d secondaryCount=%d", result.DominantCount, result.SecondaryCount)
	}
}

func TestScoreDoesNotInventZeroCountSupportingPattern(t *testing.T) {
	answers := make([]string, AnswerCount)
	for i := range answers {
		answers[i] = "01"
	}

	result, err := Score(answers)
	if err != nil {
		t.Fatal(err)
	}
	if result.SecondaryCode != "" {
		t.Fatalf("secondary=%q; want no supporting pattern when every other count is zero", result.SecondaryCode)
	}
	if result.DominantCount != AnswerCount || result.SecondaryCount != 0 {
		t.Fatalf("got dominantCount=%d secondaryCount=%d", result.DominantCount, result.SecondaryCount)
	}
}

func TestReflectionCopyExistsForEveryArchetype(t *testing.T) {
	for code, archetype := range Archetypes {
		copy, ok := ReflectionCopies[code]
		if !ok || copy.Summary == "" || copy.Prompt == "" {
			t.Errorf("%s %q has incomplete reflection copy", code, archetype.Name)
		}
	}
}

func TestScoreRejectsIncompleteAndUnknownAnswers(t *testing.T) {
	if _, err := Score([]string{"01"}); err == nil {
		t.Fatal("expected incomplete answers to fail")
	}
	answers := make([]string, AnswerCount)
	for i := range answers {
		answers[i] = "01"
	}
	answers[4] = "99"
	if _, err := Score(answers); err == nil {
		t.Fatal("expected unknown answer to fail")
	}
}

func TestNormalizeEmail(t *testing.T) {
	got, err := NormalizeEmail("  Person@Example.COM ")
	if err != nil {
		t.Fatal(err)
	}
	if got != "person@example.com" {
		t.Fatalf("got %q", got)
	}
	for _, invalid := range []string{"", "Name <person@example.com>", "not-an-email", "a\n@example.com"} {
		if _, err := NormalizeEmail(invalid); err == nil {
			t.Fatalf("expected %q to fail", invalid)
		}
	}
}
