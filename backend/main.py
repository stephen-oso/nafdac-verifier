import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import verify, search, health

app = FastAPI(title="NAFDAC Drug Verifier API")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", ""),   # set to Vercel URL after deploy
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(verify.router)
app.include_router(search.router)
app.include_router(health.router)
