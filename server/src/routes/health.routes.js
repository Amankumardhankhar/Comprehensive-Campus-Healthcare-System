import { Router } from 'express';
import mongoose from 'mongoose';
import { aiClient } from '../services/ai.client.js';
import { getDiseaseOutbreaks } from '../services/machineSession.service.js';

const router = Router();

router.get('/', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    db: dbStates[mongoose.connection.readyState] || 'unknown',
    env: process.env.NODE_ENV,
  });
});

let aiCache = { at: 0, data: null };
const AI_TTL_MS = 15_000;

router.get('/ai', async (_req, res) => {
  const now = Date.now();
  if (aiCache.data && now - aiCache.at < AI_TTL_MS) {
    return res.json({ success: true, data: aiCache.data, cached: true });
  }
  try {
    const data = await aiClient.health();
    aiCache = { at: now, data };
    res.json({ success: true, data, cached: false });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

let outbreakCache = { at: 0, data: null };
const OUTBREAK_TTL_MS = 5 * 60 * 1000;

router.get('/outbreak-alerts', async (_req, res) => {
  const now = Date.now();
  if (outbreakCache.data && now - outbreakCache.at < OUTBREAK_TTL_MS) {
    return res.json({ success: true, data: outbreakCache.data, cached: true });
  }
  try {
    const data = await getDiseaseOutbreaks({ windowDays: 7 });
    outbreakCache = { at: now, data };
    res.json({ success: true, data, cached: false });
  } catch (err) {
    res.json({ success: false, message: err.message, data: { trends: [] } });
  }
});

export default router;
