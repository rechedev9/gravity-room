from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    compute_interval_hours: int = 6
    # Required, >= 16 chars. Guards POST /compute. Making it mandatory means a
    # misconfigured deploy fails loudly at startup instead of booting healthy
    # but silently rejecting every compute request (or, worse, a future refactor
    # flipping the guard open).
    internal_secret: str = Field(min_length=16)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()  # type: ignore[call-arg]
