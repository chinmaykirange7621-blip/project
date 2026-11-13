from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

# c:\project\scholarai\backend\app\utils\config.py -> parents[3] is c:\project\scholarai
PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = PROJECT_ROOT / "backend"
DATA_DIR = PROJECT_ROOT / "data"


def _find_env_file() -> str | None:
    for candidate in (BACKEND_DIR / ".env", PROJECT_ROOT / ".env"):
        if candidate.exists():
            return str(candidate)
    return None


class Settings(BaseSettings):
    app_name: str = "ScholarAI API"
    app_version: str = "1.0.0"

    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-3.8-flash"
    gemini_embedding_model: str = "gemini-embedding-001"

    database_url: str = "sqlite:///data/scholarai.db"
    chroma_persist_dir: str = "data/chroma_db"

    jwt_secret_key: str = "scholarai-dev-secret-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    admin_username: str = "admin"
    admin_password: str = "ScholarAdmin@2026"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_origin_regex: str = ""

    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_demo_mode(self) -> bool:
        key = (self.gemini_api_key or "").strip()
        return not key or key.lower().startswith("your_")

    @property
    def resolved_database_url(self) -> str:
        url = (self.database_url or "").strip()
        # Render PostgreSQL injects postgres://, while SQLAlchemy 2.0 requires postgresql://
        if url.startswith("postgres://"):
            return "postgresql://" + url[len("postgres://"):]
        if url.startswith("sqlite:////"):
            abs_sqlite_path = Path(url[len("sqlite:///"):])
            abs_sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            return url
        if url.startswith("sqlite:///"):
            rel_path = url[len("sqlite:///"):]
            abs_path = (PROJECT_ROOT / rel_path).resolve()
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{abs_path.as_posix()}"
        return url

    @property
    def resolved_chroma_dir(self) -> Path:
        p = Path(self.chroma_persist_dir)
        if not p.is_absolute():
            p = (PROJECT_ROOT / p).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
