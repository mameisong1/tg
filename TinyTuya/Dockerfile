FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY config.py .
COPY main.py .
COPY tuya_controller.py .
COPY mqtt_client.py .
COPY test_connection.py .
COPY scan_devices.py .

# 创建日志目录
RUN mkdir -p /app/logs

# 启动服务
CMD ["python", "main.py"]