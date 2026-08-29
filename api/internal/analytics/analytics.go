package analytics

import (
	"context"
	"errors"
	"time"
)

type Event string

const (
	EventQuizStarted           Event = "quiz_started"
	EventQuizCompleted         Event = "quiz_completed"
	EventSubscriptionConfirmed Event = "subscription_confirmed"
)

var publicEvents = map[Event]struct{}{
	EventQuizStarted:   {},
	EventQuizCompleted: {},
}

type Recorder interface {
	Record(context.Context, Event, time.Time) error
}

type NoopRecorder struct{}

func (NoopRecorder) Record(context.Context, Event, time.Time) error { return nil }

func ParsePublicEvent(value string) (Event, error) {
	event := Event(value)
	if _, ok := publicEvents[event]; !ok {
		return "", errors.New("unsupported analytics event")
	}
	return event, nil
}

func FieldName(event Event) (string, error) {
	switch event {
	case EventQuizStarted:
		return "quizStarted", nil
	case EventQuizCompleted:
		return "quizCompleted", nil
	case EventSubscriptionConfirmed:
		return "subscriptionsConfirmed", nil
	default:
		return "", errors.New("unsupported analytics event")
	}
}

type Totals struct {
	QuizStarted            int64     `firestore:"quizStarted"`
	QuizCompleted          int64     `firestore:"quizCompleted"`
	SubscriptionsConfirmed int64     `firestore:"subscriptionsConfirmed"`
	UpdatedAt              time.Time `firestore:"updatedAt"`
}
