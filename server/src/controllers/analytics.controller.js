import asyncHandler from 'express-async-handler';
import * as svc from '../services/analytics.service.js';

export const riskProfile = asyncHandler(async (req, res) => {
  const data = await svc.getRiskProfile({
    studentId: req.params.studentId,
    userId: req.user._id,
    force: req.query.force === 'true',
  });
  res.json({ success: true, ...data });
});

export const diseaseTrend = asyncHandler(async (req, res) => {
  const { label } = req.query;
  const data = await svc.getDiseaseTrend({
    label,
    days: Number(req.query.days) || 90,
    window: Number(req.query.window) || 7,
    zThreshold: Number(req.query.zThreshold) || 2.0,
    userId: req.user._id,
    force: req.query.force === 'true',
  });
  res.json({ success: true, ...data });
});

export const demandForecast = asyncHandler(async (req, res) => {
  const data = await svc.getDemandForecast({
    medicineId: req.params.medicineId,
    horizonDays: Number(req.query.horizonDays) || 14,
    userId: req.user._id,
    force: req.query.force === 'true',
  });
  res.json({ success: true, ...data });
});

export const riskDistribution = asyncHandler(async (_req, res) => {
  const data = await svc.getRiskDistribution();
  res.json({ success: true, data });
});

export const aiHealth = asyncHandler(async (_req, res) => {
  const data = await svc.getAiHealth();
  res.json({ success: true, data });
});
