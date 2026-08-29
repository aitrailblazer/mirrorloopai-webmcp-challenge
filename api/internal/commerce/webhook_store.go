package commerce

import (
	"context"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type MemoryEventStore struct {
	mu        sync.Mutex
	processed map[string]time.Time
}

func NewMemoryEventStore() *MemoryEventStore {
	return &MemoryEventStore{processed: make(map[string]time.Time)}
}

func (s *MemoryEventStore) Processed(_ context.Context, id string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.processed[id]
	return ok, nil
}

func (s *MemoryEventStore) MarkProcessed(
	_ context.Context,
	id string,
	at time.Time,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.processed[id] = at
	return nil
}

type FirestoreEventStore struct {
	client *firestore.Client
}

func NewFirestoreEventStore(client *firestore.Client) *FirestoreEventStore {
	return &FirestoreEventStore{client: client}
}

func (s *FirestoreEventStore) Processed(
	ctx context.Context,
	id string,
) (bool, error) {
	_, err := s.client.Collection("stripe_order_events").Doc(id).Get(ctx)
	switch status.Code(err) {
	case codes.OK:
		return true, nil
	case codes.NotFound:
		return false, nil
	default:
		return false, err
	}
}

func (s *FirestoreEventStore) MarkProcessed(
	ctx context.Context,
	id string,
	at time.Time,
) error {
	_, err := s.client.Collection("stripe_order_events").Doc(id).Set(ctx, map[string]any{
		"status":      "emails_sent",
		"processedAt": at,
	})
	return err
}
