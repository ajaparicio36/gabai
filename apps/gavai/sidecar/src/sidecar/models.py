from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiError(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: dict[str, Any] | None = Field(
        None, description="Optional structured error details"
    )


class ApiSuccess[T](BaseModel):
    data: T


class ApiResponse[T](BaseModel):
    data: T | None = None
    error: ApiError | None = None
