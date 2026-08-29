package main

import "testing"

func TestPercentage(t *testing.T) {
	if got := percentage(3, 4); got != 75 {
		t.Fatalf("percentage(3, 4) = %v", got)
	}
	if got := percentage(1, 0); got != 0 {
		t.Fatalf("percentage(1, 0) = %v", got)
	}
}
