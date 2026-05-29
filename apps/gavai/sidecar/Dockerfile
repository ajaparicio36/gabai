FROM python:3.12-slim
WORKDIR /app
COPY apps/gavai/sidecar/pyproject.toml apps/gavai/sidecar/uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev
COPY apps/gavai/sidecar/ .
COPY models/ ./models/
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "src.sidecar.main:app", "--host", "0.0.0.0", "--port", "8000"]
