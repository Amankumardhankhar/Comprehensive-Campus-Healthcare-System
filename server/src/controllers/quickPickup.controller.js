import asyncHandler from 'express-async-handler';
import * as svc from '../services/quickPickup.service.js';

export const catalog = asyncHandler(async (_req, res) => {
  const items = await svc.listCatalog();
  res.json({
    success: true,
    data: {
      items,
      caps: svc.QUICK_PICKUP_CAPS,
    },
  });
});

export const start = asyncHandler(async (req, res) => {
  const session = await svc.startQuickSession(req.user, req.body || {});
  res.status(201).json({ success: true, data: session });
});

export const setCart = asyncHandler(async (req, res) => {
  const session = await svc.setCart(req.params.id, req.user, req.body || {});
  res.json({ success: true, data: session });
});
