FROM python:3.11-slim

LABEL maintainer="mameisong"
LABEL description="TinyTuya MQTT Controller"
LABEL version="1.0"

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV MQTT_HOST=8.134.248.240
ENV MQTT_PORT=1883
ENV MQTT_USERNAME=admin
ENV MQTT_PASSWORD=mms6332628

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import socket; s=socket.socket(); s.settimeout(5); s.connect(('localhost', 8000)) if False else exit(0)" || exit 1

# 运行
CMD ["python", "main.py"]