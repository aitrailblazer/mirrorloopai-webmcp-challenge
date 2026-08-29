package subscriber

import (
	"errors"
	"fmt"
	"net/mail"
	"sort"
	"strings"
	"time"
)

const AnswerCount = 12

var Archetypes = map[string]Archetype{
	"01": {Name: "Horizon Signal", Domain: "Finding direction", Glyph: "◯"},
	"02": {Name: "Field Architect", Domain: "Your surroundings", Glyph: "△"},
	"03": {Name: "Shape-Shifter", Domain: "Sense of self", Glyph: "◇"},
	"04": {Name: "Silent Gate", Domain: "Emotional balance", Glyph: "□"},
	"05": {Name: "Temporal Navigator", Domain: "Looking ahead", Glyph: "⌘"},
	"06": {Name: "Fracture Path", Domain: "Decisions under pressure", Glyph: "✦"},
	"07": {Name: "Duality Weaver", Domain: "Conflicting truths", Glyph: "✿"},
	"08": {Name: "Phantom Contract", Domain: "Repeating expectations", Glyph: "▣"},
	"09": {Name: "Flame of Reversal", Domain: "Energy shifts", Glyph: "★"},
	"10": {Name: "Shattered Compass", Domain: "When plans break", Glyph: "✧"},
	"11": {Name: "Velocity Holder", Domain: "Keeping momentum", Glyph: "↑"},
	"12": {Name: "Convergence Seal", Domain: "Bringing things together", Glyph: "Ω"},
}

var ReflectionCopies = map[string]ReflectionCopy{
	"01": {Summary: "You naturally look for a direction worth moving toward.", Prompt: "Name the next visible horizon. What is one step that points toward it?"},
	"02": {Summary: "You first improve the conditions around a problem so steadiness can return.", Prompt: "Change one part of your environment that would make the next choice easier."},
	"03": {Summary: "You respond by reconsidering who you are becoming in the situation.", Prompt: "Ask: what version of me can meet this without repeating the old role?"},
	"04": {Summary: "You seek enough inner calm to choose rather than react.", Prompt: "Pause for one minute. Name the feeling, then name the choice beneath it."},
	"05": {Summary: "You zoom out and place the moment inside a longer story.", Prompt: "Imagine looking back in six months. What would make this moment useful?"},
	"06": {Summary: "You regain movement by choosing a clear fork and committing to it.", Prompt: "Write the two real options. Choose the smallest reversible commitment."},
	"07": {Summary: "You can hold competing truths long enough for a wider answer to appear.", Prompt: "Complete both sentences: “It is true that…” and “It is also true that…”"},
	"08": {Summary: "You look for the unspoken expectation or agreement shaping the moment.", Prompt: "Name the hidden rule. Is it still fair, mutual, and necessary?"},
	"09": {Summary: "You look for the spark that can rapidly change the emotional state.", Prompt: "Choose one healthy action that changes your energy within five minutes."},
	"10": {Summary: "You seek the signal inside what failed, broke, or became unclear.", Prompt: "Separate the event from the story. What fact is the clearest signal?"},
	"11": {Summary: "You trust a small action that can create sustained momentum.", Prompt: "Choose a step small enough to begin now and useful enough to repeat tomorrow."},
	"12": {Summary: "You look for the point where different needs can align into one direction.", Prompt: "List what matters most. What single action honors more than one priority?"},
}

type Archetype struct {
	Name   string `json:"name" firestore:"name"`
	Domain string `json:"domain" firestore:"domain"`
	Glyph  string `json:"glyph" firestore:"glyph"`
}

type ReflectionCopy struct {
	Summary string `json:"summary" firestore:"summary"`
	Prompt  string `json:"prompt" firestore:"prompt"`
}

type Result struct {
	DominantCode   string    `json:"dominantCode" firestore:"dominantCode"`
	Dominant       Archetype `json:"dominant" firestore:"dominant"`
	DominantCount  int       `json:"dominantCount" firestore:"dominantCount"`
	SecondaryCode  string    `json:"secondaryCode,omitempty" firestore:"secondaryCode,omitempty"`
	Secondary      Archetype `json:"secondary,omitempty" firestore:"secondary,omitempty"`
	SecondaryCount int       `json:"secondaryCount,omitempty" firestore:"secondaryCount,omitempty"`
}

type SubscribeRequest struct {
	Email          string   `json:"email"`
	Consent        bool     `json:"consent"`
	ConsentVersion string   `json:"consentVersion"`
	Website        string   `json:"website"`
	Source         string   `json:"source"`
	QuizVersion    string   `json:"quizVersion"`
	Answers        []string `json:"answers"`
	ChallengeToken string   `json:"challengeToken"`
}

type Record struct {
	ID               string     `json:"id" firestore:"id"`
	Email            string     `json:"-" firestore:"email"`
	Status           string     `json:"status" firestore:"status"`
	ConsentVersion   string     `json:"consentVersion" firestore:"consentVersion"`
	ConsentAt        time.Time  `json:"consentAt" firestore:"consentAt"`
	Source           string     `json:"source" firestore:"source"`
	QuizVersion      string     `json:"quizVersion" firestore:"quizVersion"`
	Result           Result     `json:"result" firestore:"result"`
	CreatedAt        time.Time  `json:"createdAt" firestore:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt" firestore:"updatedAt"`
	PendingExpiresAt *time.Time `json:"pendingExpiresAt,omitempty" firestore:"pendingExpiresAt,omitempty"`
	ConfirmedAt      time.Time  `json:"confirmedAt,omitempty" firestore:"confirmedAt,omitempty"`
	UnsubscribedAt   time.Time  `json:"unsubscribedAt,omitempty" firestore:"unsubscribedAt,omitempty"`
}

func NormalizeEmail(raw string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "" || len(value) > 254 || strings.ContainsAny(value, "\r\n") {
		return "", errors.New("enter a valid email address")
	}
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value {
		return "", errors.New("enter a valid email address")
	}
	return value, nil
}

func Score(answers []string) (Result, error) {
	if len(answers) != AnswerCount {
		return Result{}, fmt.Errorf("exactly %d answers are required", AnswerCount)
	}
	counts := make(map[string]int, len(Archetypes))
	for code := range Archetypes {
		counts[code] = 0
	}
	for _, code := range answers {
		if _, ok := Archetypes[code]; !ok {
			return Result{}, fmt.Errorf("unknown answer code %q", code)
		}
		counts[code]++
	}
	codes := make([]string, 0, len(counts))
	for code := range counts {
		codes = append(codes, code)
	}
	sort.Slice(codes, func(i, j int) bool {
		if counts[codes[i]] == counts[codes[j]] {
			return codes[i] < codes[j]
		}
		return counts[codes[i]] > counts[codes[j]]
	})
	result := Result{
		DominantCode:  codes[0],
		Dominant:      Archetypes[codes[0]],
		DominantCount: counts[codes[0]],
	}
	if counts[codes[1]] > 0 {
		result.SecondaryCode = codes[1]
		result.Secondary = Archetypes[codes[1]]
		result.SecondaryCount = counts[codes[1]]
	}
	return result, nil
}
