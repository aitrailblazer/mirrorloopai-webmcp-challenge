package subscriber

import (
	"context"
	"errors"
	"sync"
	"time"
)

type MemoryStore struct {
	mu      sync.RWMutex
	records map[string]Record
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{records: make(map[string]Record)}
}

func (s *MemoryStore) UpsertPending(_ context.Context, record Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.records[record.ID]; ok {
		record.CreatedAt = existing.CreatedAt
		if existing.Status == "active" {
			record.Status = "active"
			record.ConfirmedAt = existing.ConfirmedAt
			record.PendingExpiresAt = nil
		}
	}
	s.records[record.ID] = record
	return nil
}

func (s *MemoryStore) Confirm(_ context.Context, id string, now time.Time) (Record, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.records[id]
	if !ok {
		return Record{}, false, errors.New("subscriber not found")
	}
	if record.Status == "active" {
		return record, false, nil
	}
	record.Status = "active"
	record.ConfirmedAt = now
	record.UpdatedAt = now
	record.PendingExpiresAt = nil
	s.records[id] = record
	return record, true, nil
}

func (s *MemoryStore) Unsubscribe(_ context.Context, id string, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.records[id]
	if !ok {
		return nil
	}
	record.Status = "unsubscribed"
	record.UnsubscribedAt = now
	record.UpdatedAt = now
	s.records[id] = record
	return nil
}
