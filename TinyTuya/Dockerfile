FROM python:3.11-slim

LABEL maintainer="mameisong"
LABEL description="TinyTuya MQTT Controller"
LABEL version="1.0"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV MQTT_HOST=8.134.248.240
ENV MQTT_PORT=1883
ENV MQTT_USERNAME=admin
ENV MQTT_PASSWORD=mms6332628

CMD ["python", "main.py"]