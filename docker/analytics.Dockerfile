FROM python:3.11-slim

# nginx for routing the 3 analytics services behind one port
# gettext-base provides envsubst (PORT substitution in nginx template)
RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx gettext-base \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY docker/requirements-analytics.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the three analytics service modules
COPY ai-services/risk-profiling  ./risk-profiling
COPY ai-services/disease-trend   ./disease-trend
COPY ai-services/forecasting     ./forecasting

# Remove nginx default site; copy routing template
RUN rm -f /etc/nginx/sites-enabled/default
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template

COPY docker/analytics-start.sh /start.sh
RUN chmod +x /start.sh

# Render injects PORT at runtime; nginx will listen on it
EXPOSE 8000
CMD ["/start.sh"]
