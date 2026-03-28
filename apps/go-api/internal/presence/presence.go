package presence

import (
	"context"
	"strconv"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

const (
	presenceKey    = "users:online"
	presenceTTLSec = 60
	ttlMs          = presenceTTLSec * 1000
)

// Track marks a user as online for 60 seconds. Fire-and-forget.
// Matches TS presence.ts trackPresence() exactly:
// MULTI { ZADD users:online <now> <userId>, ZREMRANGEBYSCORE users:online -inf <cutoff> }
func Track(ctx context.Context, rdb *goredis.Client, userID string) error {
	now := time.Now().UnixMilli()
	cutoff := now - int64(ttlMs)

	pipe := rdb.TxPipeline()
	pipe.ZAdd(ctx, presenceKey, goredis.Z{Score: float64(now), Member: userID})
	pipe.ZRemRangeByScore(ctx, presenceKey, "-inf", strconv.FormatInt(cutoff, 10))
	_, err := pipe.Exec(ctx)
	return err
}

// CountOnline returns the number of users active in the last 60 seconds.
// Matches TS presence.ts countOnlineUsers() exactly:
// ZREMRANGEBYSCORE then ZCARD.
func CountOnline(ctx context.Context, rdb *goredis.Client) (int64, error) {
	cutoff := time.Now().UnixMilli() - int64(ttlMs)
	if err := rdb.ZRemRangeByScore(ctx, presenceKey, "-inf", strconv.FormatInt(cutoff, 10)).Err(); err != nil {
		return 0, err
	}
	return rdb.ZCard(ctx, presenceKey).Result()
}
