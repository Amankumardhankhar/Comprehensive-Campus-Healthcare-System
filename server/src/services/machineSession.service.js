import crypto from 'crypto';
import mongoose from 'mongoose';

import {
  MachineSession,
  SESSION_STATUS,
  SESSION_TYPES,
  DECISION_ACTIONS,
  RISK_LEVELS,
} from '../models/MachineSession.js';
import { Medicine } from '../models/Medicine.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { aiClient } from './ai.client.js';

// Maps the recommender service's medicine_id strings to Medicine.genericName
// values actually stored by seedOtcMedicines.js.
const RECOMMENDER_TO_GENERIC = Object.freeze({
  paracetamol: 'paracetamol',
  ibuprofen: 'ibuprofen',
  cetirizine: 'cetirizine',
  antacid_gel: 'aluminium-magnesium hydroxide',
  ors: 'oral rehydration salts',
  cough_syrup: 'dextromethorphan',
  vitamin_c: 'ascorbic acid',
  adhesive_bandage: 'bandage',
});

const MAX_OPEN_SESSIONS_PER_USER = 1;

const newSessionId = () => `ms_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

const buildOrchestratorPayload = (session, input = {}) => ({
  text: input.text ?? session.rawInput?.text ?? session.rawInput?.audioTranscript ?? '',
  symptoms: input.symptoms ?? session.rawInput?.quickSelections ?? [],
  vitals: {
    temperature: session.sensorData?.temperature ?? null,
    heart_rate: session.sensorData?.heartRate ?? null,
    spO2: session.sensorData?.spO2 ?? null,
    respiration_rate: session.sensorData?.respirationRate ?? null,
  },
  image_base64: input.imageBase64 ?? undefined,
  age: input.age ?? undefined,
  flags: input.flags ?? [],
  ...(input.minConfidence !== undefined && { min_confidence: input.minConfidence }),
});

const normalizeDecisionAction = (action) => {
  if (action === 'DISPENSE') return DECISION_ACTIONS.DISPENSE;
  if (action === 'REFER_TO_DOCTOR') return DECISION_ACTIONS.CONSULT_DOCTOR;
  return DECISION_ACTIONS.CONSULT_DOCTOR;
};

const resolveCatalog = async (recommendations = []) => {
  if (!recommendations.length) return [];
  const genericNames = recommendations
    .map((r) => RECOMMENDER_TO_GENERIC[r.medicine_id])
    .filter(Boolean);
  if (!genericNames.length) return [];
  const docs = await Medicine.find({
    genericName: { $in: genericNames },
    dispensableByMachine: true,
    isActive: true,
  });
  const byGeneric = new Map(docs.map((d) => [d.genericName, d]));
  return recommendations.map((rec) => {
    const gen = RECOMMENDER_TO_GENERIC[rec.medicine_id];
    const doc = gen ? byGeneric.get(gen) : null;
    return {
      rec,
      medicine: doc || null,
      available: Boolean(doc && doc.quantity > 0),
      quantity: Math.min(rec.max_per_session || 1, doc?.quantity || 0, doc?.maxPerSession || 1),
      unitPrice: doc?.pricePerUnit || 0,
    };
  });
};

const hydrateRecommendationForSession = async (recommendations = []) => {
  const resolved = await resolveCatalog(recommendations);
  return resolved
    .filter((r) => r.medicine)
    .map((r) => ({
      medicine: r.medicine._id,
      medicineName: r.medicine.name,
      dosage: r.rec.dose,
      quantity: Math.max(1, r.quantity || 1),
      reason: (r.rec.reasons || []).join('; '),
    }));
};

export const createSession = async (user, rawInput = {}) => {
  const openCount = await MachineSession.countDocuments({
    user: user._id,
    status: SESSION_STATUS.IN_PROGRESS,
  });
  if (openCount >= MAX_OPEN_SESSIONS_PER_USER) {
    throw ApiError.conflict('You already have an open session. Finish or cancel it first.');
  }

  const session = await MachineSession.create({
    user: user._id,
    sessionId: newSessionId(),
    status: SESSION_STATUS.IN_PROGRESS,
    rawInput: {
      text: rawInput.text?.trim() || '',
      audioTranscript: rawInput.audioTranscript?.trim() || '',
      quickSelections: Array.isArray(rawInput.quickSelections) ? rawInput.quickSelections : [],
      inputMode: rawInput.inputMode || 'text',
      language: rawInput.language || 'en',
    },
  });

  return session;
};

const getOpenSession = async (sessionId, user) => {
  const session = await MachineSession.findOne({ sessionId });
  if (!session) throw ApiError.notFound('Session not found');
  if (!session.user.equals(user._id)) throw ApiError.forbidden('Not your session');
  return session;
};

export const attachSensor = async (sessionId, user, sensor) => {
  const session = await getOpenSession(sessionId, user);
  if (session.status !== SESSION_STATUS.IN_PROGRESS) {
    throw ApiError.badRequest('Session is not in progress');
  }
  session.sensorData = {
    heartRate: sensor.heartRate,
    temperature: sensor.temperature,
    spO2: sensor.spO2,
    respirationRate: sensor.respirationRate,
    capturedImageUrl: sensor.capturedImageUrl || '',
    capturedAt: new Date(),
    source: sensor.source || 'simulated',
  };
  await session.save();
  return session;
};

export const analyzeSession = async (sessionId, user, body = {}) => {
  const session = await getOpenSession(sessionId, user);
  if (session.status !== SESSION_STATUS.IN_PROGRESS) {
    throw ApiError.badRequest('Session is not in progress');
  }

  const cfg = await SystemConfig.getOrCreate();
  const minConfidence = body.minConfidence ?? cfg?.minDiseaseConfidence;

  const payload = buildOrchestratorPayload(session, { ...body, minConfidence });
  const result = await aiClient.analyzeSession(payload);

  const recommendationsForSession = result.decision.action === 'DISPENSE'
    ? await hydrateRecommendationForSession(result.recommendations || [])
    : [];

  session.symptoms = result.symptoms_used || [];
  session.aiResults = {
    disease: result.top_disease
      ? {
          disease: result.top_disease.disease,
          confidence: result.top_disease.confidence,
          alternatives: result.details?.disease?.alternatives || [],
          model: result.details?.disease?.model || 'orchestrator',
        }
      : undefined,
    risk: result.details?.risk
      ? {
          level: result.details.risk.level || result.risk_level || RISK_LEVELS.LOW,
          score: result.details.risk.score,
          flags: result.details.risk.flags || [],
          model: result.details.risk.model,
        }
      : { level: result.risk_level || RISK_LEVELS.LOW },
    anomaly: result.details?.anomaly
      ? {
          isAnomalous: result.details.anomaly.anomaly,
          flaggedFields: result.details.anomaly.outlier_features || [],
          details: result.details.anomaly,
          model: result.details.anomaly.model,
        }
      : undefined,
    image: result.details?.image
      ? {
          condition: (result.details.image.top_imagenet_classes?.[0]?.label) || 'unknown',
          severity: result.image_flags?.length ? 'moderate' : 'none',
          confidence: result.details.image.top_imagenet_classes?.[0]?.confidence ?? 0,
          model: result.details.image.model,
        }
      : { skipped: true },
    recommendation: recommendationsForSession,
  };

  session.decision = {
    action: normalizeDecisionAction(result.decision.action),
    reasons: result.decision.reasons || [],
    thresholdsUsed: {
      minConfidence,
      timingsMs: result.timings_ms,
    },
    decidedAt: new Date(),
  };

  // If referral → short-circuit session to COMPLETED (no payment/dispense).
  if (session.decision.action === DECISION_ACTIONS.CONSULT_DOCTOR) {
    session.status = SESSION_STATUS.COMPLETED;
    session.completedAt = new Date();
    session.durationMs = session.completedAt - session.startedAt;
    session.payment = { method: 'none', amount: 0, status: 'not_applicable' };
  } else {
    const resolved = await resolveCatalog(result.recommendations || []);
    const totalAmount = resolved
      .filter((r) => r.medicine)
      .reduce((sum, r) => sum + (r.unitPrice * Math.max(1, r.quantity || 1)), 0);
    session.payment = {
      method: 'none',
      amount: totalAmount,
      status: 'pending',
    };
  }

  await session.save();
  return { session, analysis: result };
};

export const createPaymentIntent = async (sessionId, user, { method } = {}) => {
  const session = await getOpenSession(sessionId, user);
  const isQuick = session.type === SESSION_TYPES.QUICK;
  const isDispensable = isQuick
    ? session.cart?.length > 0
    : session.decision?.action === DECISION_ACTIONS.DISPENSE;
  if (!isDispensable) {
    throw ApiError.badRequest('No dispensable items in this session');
  }
  if (session.payment?.status === 'success') {
    throw ApiError.conflict('Payment already completed');
  }

  const allowed = ['upi', 'card', 'cash', 'qr'];
  if (!allowed.includes(method)) {
    throw ApiError.badRequest(`method must be one of ${allowed.join(', ')}`);
  }

  const transactionId = `txn_${crypto.randomBytes(6).toString('hex')}`;
  session.payment = {
    method,
    amount: session.payment?.amount || 0,
    status: 'pending',
    transactionId,
  };
  await session.save();

  return {
    transactionId,
    amount: session.payment.amount,
    method,
    // Mock QR / UPI string for kiosk display
    qrPayload: method === 'qr' || method === 'upi'
      ? `upi://pay?pa=kiosk@bank&pn=CampusKiosk&am=${session.payment.amount}&tr=${transactionId}`
      : null,
    expiresAt: new Date(Date.now() + 3 * 60 * 1000),
  };
};

export const confirmPayment = async (sessionId, user, { transactionId } = {}) => {
  const session = await getOpenSession(sessionId, user);
  if (!session.payment?.transactionId) {
    throw ApiError.badRequest('No payment intent for this session');
  }
  if (transactionId && transactionId !== session.payment.transactionId) {
    throw ApiError.badRequest('Transaction id mismatch');
  }
  if (session.payment.status === 'success') return session;

  session.payment.status = 'success';
  session.payment.paidAt = new Date();
  await session.save();
  return session;
};

export const dispenseSession = async (sessionId, user) => {
  const session = await getOpenSession(sessionId, user);
  const isQuick = session.type === SESSION_TYPES.QUICK;
  if (!isQuick && session.decision?.action !== DECISION_ACTIONS.DISPENSE) {
    throw ApiError.badRequest('Session is not dispensable');
  }
  if (session.payment?.status !== 'success') {
    throw ApiError.badRequest('Payment must be completed before dispensing');
  }
  if (session.dispensed?.length) {
    throw ApiError.conflict('Session already dispensed');
  }

  const recs = isQuick
    ? (session.cart || []).map((c) => ({
        medicine: c.medicine,
        medicineName: c.medicineName,
        quantity: c.quantity,
      }))
    : session.aiResults?.recommendation || [];
  if (!recs.length) throw ApiError.badRequest('No items to dispense');

  const dispensed = [];
  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      for (const rec of recs) {
        const med = await Medicine.findById(rec.medicine).session(mongoSession);
        if (!med || !med.dispensableByMachine || !med.isActive) {
          throw ApiError.conflict(`Medicine not dispensable: ${rec.medicineName}`);
        }
        if (med.quantity < rec.quantity) {
          throw ApiError.conflict(`Out of stock: ${med.name}`);
        }
        const quantityBefore = med.quantity;
        med.quantity -= rec.quantity;
        await med.save({ session: mongoSession });

        await InventoryLog.create([{
          medicine: med._id,
          action: 'stock_out',
          quantity: rec.quantity,
          quantityBefore,
          quantityAfter: med.quantity,
          reason: `dispensed via kiosk session ${session.sessionId}`,
          performedBy: user._id,
        }], { session: mongoSession });

        dispensed.push({
          medicine: med._id,
          medicineName: med.name,
          quantity: rec.quantity,
          unitPrice: med.pricePerUnit || 0,
          issuedAt: new Date(),
        });
      }

      session.dispensed = dispensed;
      session.status = SESSION_STATUS.COMPLETED;
      session.completedAt = new Date();
      session.durationMs = session.completedAt - session.startedAt;
      await session.save({ session: mongoSession });
    });
  } catch (err) {
    logger.error('dispense failed', { sessionId, err: err.message });
    throw err;
  } finally {
    await mongoSession.endSession();
  }

  return session;
};

export const cancelSession = async (sessionId, user, { reason } = {}) => {
  const session = await getOpenSession(sessionId, user);
  if (session.status !== SESSION_STATUS.IN_PROGRESS) {
    throw ApiError.badRequest('Session is not in progress');
  }
  session.status = SESSION_STATUS.CANCELLED;
  session.completedAt = new Date();
  session.durationMs = session.completedAt - session.startedAt;
  if (reason) session.error = `cancelled: ${reason}`;
  await session.save();
  return session;
};

export const getDiseaseOutbreaks = async ({ windowDays = 7 } = {}) => {
  const now = new Date();
  const start = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const aggregateForWindow = (from, to) => MachineSession.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lt: to },
        'aiResults.disease.disease': { $exists: true, $nin: [null, '', 'inconclusive', 'unknown'] },
      },
    },
    { $group: { _id: '$aiResults.disease.disease', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const [current, previous] = await Promise.all([
    aggregateForWindow(start, now),
    aggregateForWindow(prevStart, start),
  ]);

  const prevMap = new Map(previous.map((p) => [p._id, p.count]));
  const trends = current.map((c) => ({
    disease: c._id,
    current: c.count,
    previous: prevMap.get(c._id) || 0,
  }));

  return { windowDays, generatedAt: now.toISOString(), trends };
};

export const acknowledgeReferral = async (sessionId, user) => {
  const session = await MachineSession.findOne({ sessionId });
  if (!session) throw ApiError.notFound('Session not found');
  if (!session.user.equals(user._id)) throw ApiError.forbidden('Not your session');
  if (session.decision?.action !== 'CONSULT_DOCTOR') {
    throw ApiError.badRequest('This session has no open referral to acknowledge');
  }
  if (!session.decision.acknowledgedAt) {
    session.decision.acknowledgedAt = new Date();
    await session.save();
  }
  return session;
};

export const getSession = async (sessionId, user, { allowAdmin = false } = {}) => {
  const session = await MachineSession
    .findOne({ sessionId })
    .populate('user', 'name email role')
    .populate('aiResults.recommendation.medicine', 'name genericName pricePerUnit')
    .populate('dispensed.medicine', 'name genericName');
  if (!session) throw ApiError.notFound('Session not found');
  if (!allowAdmin && !session.user._id.equals(user._id)) {
    throw ApiError.forbidden('Not your session');
  }
  return session;
};

export const listSessions = async (query = {}) => {
  const {
    status,
    userId,
    from,
    to,
    decision,
    risk,
    page = 1,
    limit = 20,
    sort = '-createdAt',
  } = query;

  const filter = {};
  if (status) filter.status = status;
  if (userId) filter.user = userId;
  if (decision) filter['decision.action'] = decision;
  if (risk) filter['aiResults.risk.level'] = risk;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    MachineSession
      .find(filter)
      .populate('user', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    MachineSession.countDocuments(filter),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
};
