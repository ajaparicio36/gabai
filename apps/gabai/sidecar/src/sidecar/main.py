from __future__ import annotations

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .exceptions import register_exception_handlers

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GABAI ML Sidecar",
    description="AI-powered Automated Valuation Model for Philippine real estate",
    version="1.0.0",
    docs_url="/v1/docs",
    openapi_url="/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.get("/api/v1/health")
async def health():
    from .models import ApiResponse
    return ApiResponse(data={"status": "ok"})


@app.get("/")
async def root():
    return {"message": "GABAI ML Sidecar"}
