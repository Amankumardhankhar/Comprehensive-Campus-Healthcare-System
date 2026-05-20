import asyncHandler from 'express-async-handler';
import * as svc from '../services/medicalRecord.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await svc.listRecords(req.query, req.user);
  res.json({ success: true, ...data });
});

export const get = asyncHandler(async (req, res) => {
  const record = await svc.getRecord(req.params.id, req.user);
  res.json({ success: true, data: record });
});

export const create = asyncHandler(async (req, res) => {
  const record = await svc.createRecord(req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

export const update = asyncHandler(async (req, res) => {
  const record = await svc.updateRecord(req.params.id, req.body);
  res.json({ success: true, data: record });
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deleteRecord(req.params.id);
  res.json({ success: true, message: 'Record deleted' });
});

export const issue = asyncHandler(async (req, res) => {
  const record = await svc.issueMedicines({
    recordId: req.params.id,
    items: req.body.items,
    currentUser: req.user,
  });
  res.json({ success: true, data: record });
});
