import asyncHandler from 'express-async-handler';
import * as svc from '../services/adminUser.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await svc.listUsers({
    role: req.query.role,
    search: req.query.search,
    isActive: req.query.isActive,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ success: true, ...data });
});

export const get = asyncHandler(async (req, res) => {
  const user = await svc.getUser(req.params.id);
  res.json({ success: true, data: { user } });
});

export const create = asyncHandler(async (req, res) => {
  const user = await svc.createUser(req.body);
  res.status(201).json({ success: true, data: { user } });
});

export const update = asyncHandler(async (req, res) => {
  const user = await svc.updateUser(req.params.id, req.body, req.user);
  res.json({ success: true, data: { user } });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await svc.deleteUser(req.params.id, req.user);
  res.json({ success: true, data: result });
});
