import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const DEFAULT_TIMEOUT_MS = 15000;

const postJson = async (url, body, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = {}) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new ApiError(
          res.status === 422 ? 400 : 502,
          `AI service error (${res.status}): ${payload?.detail || res.statusText}`,
          payload
        );
      }
      return payload;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof ApiError && err.statusCode < 500) throw err;
      if (attempt < retries) {
        logger.warn(`AI call to ${url} failed (attempt ${attempt + 1}), retrying...`, err.message);
      }
    }
  }
  throw ApiError.internal(`AI service unreachable after retries: ${lastErr?.message}`);
};

export const aiClient = {
  predictRisk: (features) => postJson(`${config.ai.riskUrl}/predict`, features),
  analyzeTrend: (payload) => postJson(`${config.ai.trendUrl}/analyze`, payload),
  forecastDemand: (payload) => postJson(`${config.ai.forecastUrl}/forecast`, payload, {
    timeoutMs: 30000,
  }),

  analyzeSession: (payload) => postJson(
    `${config.ai.orchestratorUrl}/analyze`,
    payload,
    { timeoutMs: 25000 }
  ),

  health: async () => {
    const check = async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok ? await res.json() : { status: 'error', code: res.status };
      } catch (err) {
        clearTimeout(timer);
        return { status: 'unreachable', error: err.message };
      }
    };
    const [risk, trend, forecast, orchestrator] = await Promise.all([
      check(config.ai.riskUrl),
      check(config.ai.trendUrl),
      check(config.ai.forecastUrl),
      check(config.ai.orchestratorUrl),
    ]);
    return { risk, trend, forecast, orchestrator };
  },
};
