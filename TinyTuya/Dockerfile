FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ★ 复制所有代码文件（确保不遗漏）
COPY config.py .
COPY main.py .
COPY mqtt_client.py .
COPY tuya_controller.py .
COPY scan_devices.py .
COPY test_connection.py .
COPY requirements.txt .

# 创建日志目录
RUN mkdir -p /app/logs

# 启动服务
CMD ["python", "main.py"]