FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY stripper.py main.py tracker_domains.json ./

# Tracker-stripper SMTP proxy (Postfix -> 20380 -> SimpleLogin 20381)
EXPOSE 20380

ENV STRIPPER_HOST=0.0.0.0 \
    STRIPPER_PORT=20380 \
    SIMPLELOGIN_HOST=127.0.0.1 \
    SIMPLELOGIN_PORT=20381

CMD ["python", "main.py"]
