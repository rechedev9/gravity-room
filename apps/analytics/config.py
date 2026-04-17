from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    compute_interval_hours: int = 6
    internal_secret: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()  # type: ignore[call-arg]
