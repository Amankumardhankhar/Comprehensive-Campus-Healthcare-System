import asyncHandler from 'express-async-handler';
import * as svc from '../services/sensor.service.js';

export const vitals = asyncHandler(async (req, res) => {
  const data = svc.generateVitals({ forceScenario: req.query.scenario });
  res.json({ success: true, data });
});

export const image = asyncHandler(async (req, res) => {
  const data = svc.captureImage({
    sessionId: req.query.sessionId,
    condition: req.query.condition,
  });
  res.json({ success: true, data });
});

export const full = asyncHandler(async (req, res) => {
  const data = svc.captureFullReading({
    sessionId: req.query.sessionId,
    forceScenario: req.query.scenario,
  });
  res.json({ success: true, data });
});
