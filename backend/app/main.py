from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, webhook, repos, analysis
from app.api import upload as upload_api
from app.api import report as report_api
from app.core.database import init_db
import uvicorn

app = FastAPI(title="CodeGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(webhook.router, prefix="/api/webhook", tags=["webhook"])
app.include_router(repos.router, prefix="/api/repos", tags=["repos"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
# Module 2 – public upload analyser (no auth)
app.include_router(upload_api.router, prefix="/api", tags=["upload"])
app.include_router(report_api.router, prefix="/api", tags=["report"])

@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/api/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
