-- +goose Up
CREATE TABLE user_insights (
    id           bigserial PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type varchar(50) NOT NULL,
    exercise_id  varchar(100),
    payload      jsonb NOT NULL,
    computed_at  timestamptz NOT NULL DEFAULT NOW(),
    valid_until  timestamptz,
    CONSTRAINT user_insights_unique
      UNIQUE (user_id, insight_type, exercise_id)
);

CREATE INDEX user_insights_user_type_idx
  ON user_insights (user_id, insight_type);

-- +goose Down
DROP TABLE IF EXISTS user_insights;
