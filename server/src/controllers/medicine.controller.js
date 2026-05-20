import asyncHandler from 'express-async-handler';
import * as svc from '../services/medicine.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await svc.listMedicines(req.query);
  res.json({ success: true, ...data });
});

export const get = asyncHandler(async (req, res) => {
  const med = await svc.getMedicine(req.params.id);
  res.json({ success: true, data: med });
});

export const create = asyncHandler(async (req, res) => {
  const med = await svc.createMedicine(req.body);
  res.status(201).json({ success: true, data: med });
});

export const update = asyncHandler(async (req, res) => {
  const med = await svc.updateMedicine(req.params.id, req.body);
  res.json({ success: true, data: med });
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deleteMedicine(req.params.id);
  res.json({ success: true, message: 'Medicine deactivated' });
});

export const adjust = asyncHandler(async (req, res) => {
  const { quantity, reason } = req.body;
  const med = await svc.adjustStock({
    medicineId: req.params.id,
    quantity: Number(quantity),
    reason,
    userId: req.user._id,
    action: quantity > 0 ? 'stock_in' : 'adjustment',
  });
  res.json({ success: true, data: med });
});

export const logs = asyncHandler(async (req, res) => {
  const data = await svc.getInventoryLogs(req.query);
  res.json({ success: true, ...data });
});

export const stats = asyncHandler(async (req, res) => {
  const data = await svc.getInventoryStats();
  res.json({ success: true, data });
});

export const listDispensable = asyncHandler(async (req, res) => {
  const data = await svc.listDispensable(req.query);
  res.json({ success: true, ...data });
});

export const setOtcFlags = asyncHandler(async (req, res) => {
  const med = await svc.setOtcFlags(req.params.id, req.body);
  res.json({ success: true, data: med });
});
