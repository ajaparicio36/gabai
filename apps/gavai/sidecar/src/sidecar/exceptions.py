from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .models import ApiError, ApiResponse

ERROR_CODES = {
    "NOT_FOUND": "NOT_FOUND.ROUTE",
    "VALIDATION_ERROR": "VALIDATION.INVALID_INPUT",
    "INTERNAL_ERROR": "INTERNAL.UNKNOWN",
    "ML_ERROR": "VALUATION.ML_SIDECAR_ERROR",
    "MODEL_NOT_LOADED": "VALUATION.MODEL_NOT_LOADED",
}


class AppException(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: dict | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(ERROR_CODES["NOT_FOUND"], message, 404)


class ValidationException(AppException):
    def __init__(self, message: str = "Validation error", details: dict | None = None):
        super().__init__(ERROR_CODES["VALIDATION_ERROR"], message, 400, details)


class ModelNotLoadedException(AppException):
    def __init__(self, message: str = "ML model is not loaded"):
        super().__init__(ERROR_CODES["MODEL_NOT_LOADED"], message, 503)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def handle_app_exception(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ApiResponse(
                data=None,
                error=ApiError(
                    code=exc.code,
                    message=exc.message,
                    details=exc.details,
                ),
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def handle_unhandled(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=ApiResponse(
                data=None,
                error=ApiError(
                    code=ERROR_CODES["INTERNAL_ERROR"],
                    message="Internal server error",
                ),
            ).model_dump(),
        )
