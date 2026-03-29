package ratelimit

import (
	"context"
	"log/slog"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// luaSlidingWindow is the atomic sliding-window Lua script.
// Character-identical to TS redis-rate-limit.ts.
var luaSlidingWindow = goredis.NewScript(`
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxReqs  = tonumber(ARGV[3])
local cutoff   = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)

if count >= maxReqs then
  return 0
end

redis.call('ZADD', key, now, now .. ':' .. math.random(1, 1000000))
redis.call('PEXPIRE', key, windowMs)
return 1
`)

// RedisStore is a Redis-backed sliding-window rate limiter.
// Falls open (allows request) when Redis is unavailable.
type RedisStore struct {
	rdb *goredis.Client
	log *slog.Logger
}

func NewRedisStore(rdb *goredis.Client, log *slog.Logger) *RedisStore {
	return &RedisStore{rdb: rdb, log: log}
}

// Check returns true if the request is allowed under the sliding window.
// Fails open on Redis error (allows the request).
func (s *RedisStore) Check(key string, limit int, window time.Duration) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	now := time.Now().UnixMilli()
	result, err := luaSlidingWindow.Run(ctx, s.rdb, []string{key},
		now, window.Milliseconds(), limit,
	).Int()

	if err != nil {
		s.log.Warn("redis rate limit eval failed, allowing request", "err", err, "key", key)
		return true // fail-open, matches TS
	}
	return result == 1
}
