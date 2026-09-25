"""Gateway settings, read from environment variables or gateway/.env (see .env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# The four platform components, in pipeline order. The slugs match the web app's
# route folders and the contracts/ folders.
COMPONENTS = ("requirement-quality", "story-refinement", "traceability", "effort-estimation")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The gateway's own database (orchestration runs, audit). Components keep their data in their own databases.
    database_url: str = "postgresql+psycopg://platform_user:platform-local@localhost:5440/platform_db"
    cors_origins: list[str] = ["http://localhost:3000"]

    requirement_quality_url: str = "http://localhost:8001"
    story_refinement_url: str = "http://localhost:8002"
    traceability_url: str = "http://localhost:8003"
    effort_estimation_url: str = "http://localhost:8004"

    service_timeout_seconds: float = 30.0
    health_timeout_seconds: float = 2.0

    def component_urls(self) -> dict[str, str]:
        """Base URL of each component service, keyed by slug, in pipeline order."""
        urls = [
            self.requirement_quality_url,
            self.story_refinement_url,
            self.traceability_url,
            self.effort_estimation_url,
        ]
        return {slug: url.rstrip("/") for slug, url in zip(COMPONENTS, urls, strict=True)}


@lru_cache
def get_settings() -> Settings:
    return Settings()
