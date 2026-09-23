FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY backend/ ./
COPY data/ /app/data/
RUN useradd --create-home appuser && mkdir -p /app/backend/var && chown -R appuser:appuser /app
USER appuser
ENV AKIM_DATABASE_PATH=/app/backend/var/akim.sqlite3
ENV AKIM_DATA_DIR=/app/data/v1
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
