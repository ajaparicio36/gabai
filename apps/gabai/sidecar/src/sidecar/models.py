from __future__ import annotations

from typing import Any, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiError(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: dict[str, Any] | None = Field(None, description="Optional structured error details")


class ApiSuccess(BaseModel, Generic[T]):
    data: T


class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    error: ApiError | None = None
