import asyncHandler from 'express-async-handler';
import { SystemConfig } from '../models/SystemConfig.js';

export const getConfig = asyncHandler(async (_req, res) => {
  const cfg = await SystemConfig.getOrCreate();
  res.json({ success: true, data: cfg });
});

export const updateConfig = asyncHandler(async (req, res) => {
  const cfg = await SystemConfig.getOrCreate();
  const allowed = [
    'minDiseaseConfidence',
    'maxHighRiskAllowed',
    'vitalBands',
    'blockDispenseOnSevereImage',
    'maxMedicinesPerSession',
    'currency',
  ];
  for (const k of allowed) {
    if (req.body[k] !== undefined) cfg[k] = req.body[k];
  }
  cfg.updatedBy = req.user._id;
  await cfg.save();
  res.json({ success: true, data: cfg });
});
