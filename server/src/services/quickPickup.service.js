import crypto from 'crypto';

import {
  MachineSession,
  SESSION_STATUS,
  SESSION_TYPES,
} from '../models/MachineSession.js';
import { Medicine } from '../models/Medicine.js';
import { ApiError } from '../utils/ApiError.js';

// Quick Pickup eligibility is enforced per-document by Medicine.dispensableByMachine.
// The OTC seed sets this true on every safe-for-self-dispense item; prescription
// stock stays at the default false, so it never appears here.

export const QUICK_PICKUP_CAPS = Object.freeze({
  maxTotalInr: 200,
  maxUnitsPerItem: 2,
  cooldownHours: 24,
  maxOpenPerUser: 1,
});

const MAX_OPEN_SESSIONS_PER_USER = 1;

const newSessionId = () =>
  `qp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

export const listCatalog = async () => {
  const docs = await Medicine.find({
    dispensableByMachine: true,
    isActive: true,
  }).sort({ name: 1 });

  return docs.map((d) => ({
    id: d._id,
    name: d.name,
    genericName: d.genericName,
    category: d.category,
    unit: d.unit,
    pricePerUnit: d.pricePerUnit,
    stock: d.quantity,
    maxPerSession: Math.min(d.maxPerSession || 1, QUICK_PICKUP_CAPS.maxUnitsPerItem),
    indications: d.indications,
    inStock: d.quantity > 0,
  }));
};

const ensureEligible = async (user, preFlight) => {
  if (preFlight.underAge) {
    throw ApiError.badRequest(
      'Quick Pickup is not available for under-12. Please use Consultation.'
    );
  }
  if (preFlight.hasAllergies) {
    throw ApiError.badRequest(
      'Please use Consultation — we need to check your allergies before dispensing.'
    );
  }

  // Rate-limit: 1 completed quick session per 24h
  const cutoff = new Date(Date.now() - QUICK_PICKUP_CAPS.cooldownHours * 60 * 60 * 1000);
  const recent = await MachineSession.countDocuments({
    user: user._id,
    type: SESSION_TYPES.QUICK,
    status: SESSION_STATUS.COMPLETED,
    completedAt: { $gte: cutoff },
  });
  if (recent >= 1) {
    throw ApiError.conflict(
      `Quick Pickup available again in ${QUICK_PICKUP_CAPS.cooldownHours}h. Use Consultation for anything urgent.`
    );
  }

  // Open-session cap (any type)
  const openCount = await MachineSession.countDocuments({
    user: user._id,
    status: SESSION_STATUS.IN_PROGRESS,
  });
  if (openCount >= MAX_OPEN_SESSIONS_PER_USER) {
    throw ApiError.conflict('You already have an open session. Finish or cancel it first.');
  }
};

export const startQuickSession = async (user, body = {}) => {
  const preFlight = {
    underAge: Boolean(body.underAge),
    hasAllergies: Boolean(body.hasAllergies),
    notes: (body.notes || '').trim(),
  };

  await ensureEligible(user, preFlight);

  const session = await MachineSession.create({
    user: user._id,
    sessionId: newSessionId(),
    type: SESSION_TYPES.QUICK,
    status: SESSION_STATUS.IN_PROGRESS,
    preFlight,
    rawInput: { inputMode: 'quick', language: body.language || 'en' },
  });
  return session;
};

const getOwnedQuickSession = async (sessionId, user) => {
  const session = await MachineSession.findOne({ sessionId });
  if (!session) throw ApiError.notFound('Session not found');
  if (!session.user.equals(user._id)) throw ApiError.forbidden('Not your session');
  if (session.type !== SESSION_TYPES.QUICK) {
    throw ApiError.badRequest('Not a Quick Pickup session');
  }
  if (session.status !== SESSION_STATUS.IN_PROGRESS) {
    throw ApiError.badRequest('Session is not in progress');
  }
  return session;
};

export const setCart = async (sessionId, user, { items = [] } = {}) => {
  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('Cart must have at least one item');
  }

  const session = await getOwnedQuickSession(sessionId, user);

  const ids = items.map((i) => i.medicineId).filter(Boolean);
  if (ids.length !== items.length) {
    throw ApiError.badRequest('Each item needs medicineId + quantity');
  }

  const docs = await Medicine.find({
    _id: { $in: ids },
    dispensableByMachine: true,
    isActive: true,
  });
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  const cart = [];
  let total = 0;
  for (const it of items) {
    const med = byId.get(String(it.medicineId));
    if (!med) {
      throw ApiError.badRequest(`Item not allowed in Quick Pickup: ${it.medicineId}`);
    }
    const qty = Number(it.quantity || 0);
    if (!Number.isInteger(qty) || qty < 1) {
      throw ApiError.badRequest(`Invalid quantity for ${med.name}`);
    }
    const capPerItem = Math.min(
      med.maxPerSession || QUICK_PICKUP_CAPS.maxUnitsPerItem,
      QUICK_PICKUP_CAPS.maxUnitsPerItem
    );
    if (qty > capPerItem) {
      throw ApiError.badRequest(`Max ${capPerItem} per session for ${med.name}`);
    }
    if (qty > med.quantity) {
      throw ApiError.conflict(`Out of stock for ${med.name} (have ${med.quantity})`);
    }
    cart.push({
      medicine: med._id,
      medicineName: med.name,
      quantity: qty,
      unitPrice: med.pricePerUnit || 0,
    });
    total += (med.pricePerUnit || 0) * qty;
  }

  if (total > QUICK_PICKUP_CAPS.maxTotalInr) {
    throw ApiError.badRequest(
      `Quick Pickup total capped at ₹${QUICK_PICKUP_CAPS.maxTotalInr}. Current total: ₹${total}.`
    );
  }

  session.cart = cart;
  session.payment = {
    method: session.payment?.method || 'none',
    amount: total,
    status: 'pending',
  };
  await session.save();
  return session;
};
