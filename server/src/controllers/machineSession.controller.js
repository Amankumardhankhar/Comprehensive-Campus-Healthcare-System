import asyncHandler from 'express-async-handler';
import * as svc from '../services/machineSession.service.js';
import { ROLES } from '../models/User.js';

export const startSession = asyncHandler(async (req, res) => {
  const session = await svc.createSession(req.user, req.body || {});
  res.status(201).json({ success: true, data: session });
});

export const attachSensor = asyncHandler(async (req, res) => {
  const session = await svc.attachSensor(req.params.id, req.user, req.body || {});
  res.json({ success: true, data: session });
});

export const analyze = asyncHandler(async (req, res) => {
  const { session, analysis } = await svc.analyzeSession(
    req.params.id,
    req.user,
    req.body || {}
  );
  res.json({ success: true, data: { session, analysis } });
});

export const createPaymentIntent = asyncHandler(async (req, res) => {
  const intent = await svc.createPaymentIntent(req.params.id, req.user, req.body || {});
  res.status(201).json({ success: true, data: intent });
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const session = await svc.confirmPayment(req.params.id, req.user, req.body || {});
  res.json({ success: true, data: session });
});

export const dispense = asyncHandler(async (req, res) => {
  const session = await svc.dispenseSession(req.params.id, req.user);
  res.json({ success: true, data: session });
});

export const cancel = asyncHandler(async (req, res) => {
  const session = await svc.cancelSession(req.params.id, req.user, req.body || {});
  res.json({ success: true, data: session });
});

export const get = asyncHandler(async (req, res) => {
  const allowAdmin = req.user?.role === ROLES.ADMIN;
  const session = await svc.getSession(req.params.id, req.user, { allowAdmin });
  res.json({ success: true, data: session });
});

export const acknowledgeReferral = asyncHandler(async (req, res) => {
  const session = await svc.acknowledgeReferral(req.params.id, req.user);
  res.json({ success: true, data: session });
});

export const list = asyncHandler(async (req, res) => {
  // Admin sees all; non-admins see only their own.
  const query = req.user?.role === ROLES.ADMIN
    ? req.query
    : { ...req.query, userId: req.user._id.toString() };
  const data = await svc.listSessions(query);
  res.json({ success: true, ...data });
});
