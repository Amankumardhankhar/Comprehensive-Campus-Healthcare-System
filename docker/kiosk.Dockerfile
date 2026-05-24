FROM python:3.11-slim

# Build tools needed by some wheels
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY docker/requirements-kiosk.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ai-services/orchestrator         ./orchestrator
COPY ai-services/disease-prediction   ./disease-prediction
COPY ai-services/risk-classification  ./risk-classification
COPY ai-services/medicine-recommender ./medicine-recommender
COPY ai-services/image-analysis       ./image-analysis
COPY ai-services/anomaly-detection    ./anomaly-detection
COPY ai-services/nlp-service          ./nlp-service

COPY docker/kiosk-start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8100
CMD ["/start.sh"]
