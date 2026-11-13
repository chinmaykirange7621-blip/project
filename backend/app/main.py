import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from app.api import admin, chat, eligibility, scholarships, search
from app.database.session import SessionLocal, init_db
from app.knowledge_base.loader import seed_database
from app.rag.vector_store import get_vector_counts, index_all_scholarships
from app.utils.config import PROJECT_ROOT, get_settings

settings = get_settings()
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_INDEX_FILE = FRONTEND_DIST_DIR / "index.html"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with SessionLocal() as db:
        seed_database(db)
        index_all_scholarships(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Your Future. Your Scholarship. One Intelligent Assistant.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    fields = []
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []))
        fields.append({"field": loc, "message": err.get("msg", "Invalid input")})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": "Validation Error",
            "detail": "One or more input fields failed validation.",
            "fields": fields,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Request Error",
            "detail": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, _exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected server error occurred. Please verify your inputs or retry.",
        },
    )


app.include_router(chat.router)
app.include_router(eligibility.router)
app.include_router(scholarships.router)
app.include_router(search.router)
app.include_router(admin.router)


@app.get("/api/health", tags=["System"])
def health_check():
    counts = get_vector_counts()
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "demo_mode": settings.is_demo_mode,
        "chat_model": settings.gemini_chat_model if not settings.is_demo_mode else "DemoProvider",
        "embedding_model": settings.gemini_embedding_model if not settings.is_demo_mode else "DemoEmbeddingProvider",
        **counts,
    }


if FRONTEND_INDEX_FILE.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API endpoint not found.")
        if full_path:
            dist_root = FRONTEND_DIST_DIR.resolve()
            candidate = (FRONTEND_DIST_DIR / full_path).resolve()
            if candidate.is_relative_to(dist_root) and candidate.is_file():
                return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_INDEX_FILE))
else:
    @app.get("/", include_in_schema=False)
    def api_root():
        return {
            "app": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/api/health",
        }
