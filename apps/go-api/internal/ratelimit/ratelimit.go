package ratelimit

import (
	"log/slog"

	goredis "github.com/redis/go-redis/v9"
)

// NewStore returns a RedisStore when rdb is non-nil, otherwise a MemoryStore.
// Matches TS rate-limit.ts initStore() logic.
func NewStore(rdb *goredis.Client, log *slog.Logger) Store {
	if rdb != nil {
		log.Info("rate limiter: using Redis store")
		return NewRedisStore(rdb, log)
	}
	log.Info("rate limiter: using in-memory store")
	return NewMemoryStore()
}
