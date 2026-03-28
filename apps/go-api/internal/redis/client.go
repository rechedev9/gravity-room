package redis

import (
	"context"
	"log/slog"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// Client wraps a go-redis client. Nil-safe: all methods no-op when the
// underlying client is nil (Redis not configured).
type Client struct {
	rdb *goredis.Client
	log *slog.Logger
}

// New creates a Redis client from the URL. Returns a nil-inner Client
// (safe to call methods on) when url is empty.
func New(url string, log *slog.Logger) *Client {
	if url == "" {
		log.Info("redis disabled (no REDIS_URL)")
		return &Client{log: log}
	}
	opts, err := goredis.ParseURL(url)
	if err != nil {
		log.Error("redis URL parse failed, running without redis", "err", err)
		return &Client{log: log}
	}
	opts.MaxRetries = 3 // matches TS maxRetriesPerRequest: 3
	rdb := goredis.NewClient(opts)

	// Verify connectivity (non-blocking: if this fails, we still start).
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Warn("redis ping failed on startup, will retry on use", "err", err)
	} else {
		log.Info("redis connected")
	}

	return &Client{rdb: rdb, log: log}
}

// Available returns true when a Redis connection is configured.
func (c *Client) Available() bool {
	return c != nil && c.rdb != nil
}

// Ping sends a PING and returns latency. Used by health check.
func (c *Client) Ping(ctx context.Context) (time.Duration, error) {
	if !c.Available() {
		return 0, nil
	}
	start := time.Now()
	err := c.rdb.Ping(ctx).Err()
	return time.Since(start), err
}

// Underlying returns the raw go-redis client for use by Lua scripts.
// Returns nil when Redis is not available.
func (c *Client) Underlying() *goredis.Client {
	if c == nil {
		return nil
	}
	return c.rdb
}

// Close disconnects from Redis. Safe to call on nil client.
func (c *Client) Close() error {
	if !c.Available() {
		return nil
	}
	return c.rdb.Close()
}
