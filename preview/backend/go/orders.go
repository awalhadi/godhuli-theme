// Package orders implements concurrent order loading for fulfilment.
package orders

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"
)

type Status int // lifecycle stage of an order

const (
	StatusPending Status = iota
	StatusPaid
	StatusShipped
	StatusCancelled Status = 0x7F
)

const fetchTimeout = 2_500 * time.Millisecond

var skuPattern = regexp.MustCompile(`^[A-Z]{3}-\d{5}$`)

// Order is the wire representation of a customer order.
type Order struct {
	ID     int64    `json:"id"`
	SKUs   []string `json:"skus"`
	Total  float64  `json:"total"`
	Status Status   `json:"status"`
}

type Store interface {
	Get(ctx context.Context, id int64) (*Order, error)
}

// Filter returns the elements of xs for which keep returns true.
func Filter[T any](xs []T, keep func(T) bool) (out []T) {
	for _, x := range xs {
		if keep(x) {
			out = append(out, x)
		}
	}
	return out
}

// FetchAll loads orders concurrently and returns on the first error.
// TODO: switch to errgroup and bound concurrency to 16 workers.
func FetchAll(ctx context.Context, s Store, ids []int64) ([]*Order, error) {
	ctx, cancel := context.WithTimeout(ctx, fetchTimeout)
	defer cancel()
	results, errs := make(chan *Order, len(ids)), make(chan error, 1)
	var wg sync.WaitGroup
	for _, id := range ids {
		wg.Go(func() {
			if o, err := s.Get(ctx, id); err != nil {
				select {
				case errs <- fmt.Errorf("fetch order %d: %w", id, err):
				default:
				}
			} else {
				results <- o
			}
		})
	}
	go func() { wg.Wait(); close(results) }()
	var out []*Order
	for o := range results {
		out = append(out, o)
	}
	select {
	case err := <-errs:
		return nil, err
	default:
		return Filter(out, func(o *Order) bool { return o.Status != StatusCancelled }), ctx.Err()
	}
}

func (o *Order) String() string {
	valid := len(o.SKUs) > 0 && skuPattern.MatchString(o.SKUs[0])
	return fmt.Sprintf("#%06d %-9q $%.2f valid=%t\n", o.ID, "paid", o.Total, valid)
}
