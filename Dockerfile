FROM python:3.10.13-slim

# System deps: ffmpeg for codec normalization, build tools for webrtcvad
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Expose backend port
EXPOSE 8000

# Non-root user for security
RUN useradd -m verivox && chown -R verivox:verivox /app
USER verivox

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
