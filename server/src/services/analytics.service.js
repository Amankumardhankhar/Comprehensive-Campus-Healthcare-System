import { MedicalRecord } from '../models/MedicalRecord.js';
import { Medicine } from '../models/Medicine.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { User, ROLES } from '../models/User.js';
import { AnalyticsResult } from '../models/AnalyticsResult.js';
import { aiClient } from './ai.client.js';
import { ApiError } from '../utils/ApiError.js';

const CACHE_TTL_MS = {
  risk_profile: 24 * 60 * 60 * 1000,
  disease_trend: 60 * 60 * 1000,
  demand_forecast: 6 * 60 * 60 * 1000,
};

const ANTIBIOTIC_KEYWORDS = ['cillin', 'mycin', 'floxacin', 'cycline', 'azole', 'antibiotic'];

const getFresh = async (kind, subject) => {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS[kind]);
  return AnalyticsResult.findOne({
    kind,
    subject,
    createdAt: { $gte: cutoff },
  }).sort('-createdAt');
};

const saveResult = (kind, subject, input, result, userId) =>
  AnalyticsResult.create({
    kind,
    subject,
    input,
    result,
    generatedBy: userId,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS[kind]),
  });

const yearsSince = (dob) => {
  if (!dob) return null;
  const diffMs = Date.now() - new Date(dob).getTime();
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
};

const buildRiskFeatures = async (studentId) => {
  const student = await User.findById(studentId);
  if (!student || student.role !== ROLES.STUDENT) {
    throw ApiError.notFound('Student not found');
  }

  const sixMoAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const records = await MedicalRecord.find({
    student: studentId,
    visitDate: { $gte: sixMoAgo },
  }).populate('prescribedMedicines.medicine', 'name category');

  const visitCount = records.length;

  const totalSymptoms = records.reduce((sum, r) => sum + (r.symptoms?.length || 0), 0);
  const avgSymptoms = visitCount > 0 ? totalSymptoms / visitCount : 1;

  const temps = records
    .map((r) => r.vitals?.temperature)
    .filter((t) => typeof t === 'number');
  const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 98.6;

  const antibioticCount = records.reduce((sum, r) => {
    const hit = (r.prescribedMedicines || []).some((p) => {
      const name = (p.medicineName || p.medicine?.name || '').toLowerCase();
      const cat = (p.medicine?.category || '').toLowerCase();
      return cat === 'antibiotic' || ANTIBIOTIC_KEYWORDS.some((k) => name.includes(k));
    });
    return sum + (hit ? 1 : 0);
  }, 0);

  const age = yearsSince(student.dateOfBirth) ?? 20;

  return {
    age,
    visit_count_6mo: visitCount,
    avg_symptoms_per_visit: Number(avgSymptoms.toFixed(2)),
    chronic_condition_count: student.chronicConditions?.length || 0,
    avg_temperature: Number(avgTemp.toFixed(2)),
    recent_antibiotic_courses: antibioticCount,
  };
};

export const getRiskProfile = async ({ studentId, userId, force = false }) => {
  if (!force) {
    const cached = await getFresh('risk_profile', studentId);
    if (cached) return { cached: true, input: cached.input, result: cached.result };
  }

  const features = await buildRiskFeatures(studentId);
  const result = await aiClient.predictRisk(features);
  await saveResult('risk_profile', studentId, features, result, userId);
  return { cached: false, input: features, result };
};

const buildTrendSeries = async (label, { days = 90 } = {}) => {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const regex = new RegExp(label, 'i');

  const records = await MedicalRecord.find({
    visitDate: { $gte: from },
    $or: [{ symptoms: { $in: [regex] } }, { diagnosis: regex }],
  }).select('visitDate');

  const counts = new Map();
  for (const r of records) {
    const d = r.visitDate.toISOString().slice(0, 10);
    counts.set(d, (counts.get(d) || 0) + 1);
  }

  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    series.push({ date: d, count: counts.get(d) || 0 });
  }
  return series;
};

export const getDiseaseTrend = async ({ label, days = 90, window = 7, zThreshold = 2.0, userId, force = false }) => {
  const subject = `${label}|${days}|${window}|${zThreshold}`;

  if (!force) {
    const cached = await getFresh('disease_trend', subject);
    if (cached) return { cached: true, input: cached.input, result: cached.result };
  }

  const series = await buildTrendSeries(label, { days });
  const input = { label, window, z_threshold: zThreshold, series };
  const result = await aiClient.analyzeTrend(input);
  await saveResult('disease_trend', subject, { label, days, window, zThreshold }, result, userId);
  return { cached: false, input: { label, days, window, zThreshold }, result };
};

const buildDemandHistory = async (medicineId, { days = 60 } = {}) => {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await InventoryLog.find({
    medicine: medicineId,
    action: 'stock_out',
    createdAt: { $gte: from },
  }).select('quantity createdAt');

  const counts = new Map();
  for (const l of logs) {
    const d = l.createdAt.toISOString().slice(0, 10);
    counts.set(d, (counts.get(d) || 0) + l.quantity);
  }

  const history = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    history.push({ date: d, quantity: counts.get(d) || 0 });
  }
  return history;
};

export const getDemandForecast = async ({ medicineId, horizonDays = 14, userId, force = false }) => {
  if (!force) {
    const cached = await getFresh('demand_forecast', medicineId);
    if (cached && cached.input?.horizonDays === horizonDays) {
      return { cached: true, input: cached.input, result: cached.result };
    }
  }

  const medicine = await Medicine.findById(medicineId);
  if (!medicine) throw ApiError.notFound('Medicine not found');

  const history = await buildDemandHistory(medicineId, { days: 60 });

  const nonZero = history.filter((h) => h.quantity > 0).length;
  if (nonZero < 3) {
    const result = {
      medicine_name: medicine.name,
      horizon_days: horizonDays,
      method: 'insufficient_data',
      forecast: [],
      total_predicted_demand: 0,
      reorder_recommendation: {
        needs_reorder: medicine.quantity <= medicine.minStockLevel,
        suggested_order_quantity: 0,
      },
      note: 'Not enough historical data to generate forecast (need at least 3 days of demand)',
    };
    await saveResult('demand_forecast', medicineId, { horizonDays }, result, userId);
    return { cached: false, input: { horizonDays }, result };
  }

  const input = {
    medicine_name: medicine.name,
    history,
    horizon_days: horizonDays,
    current_stock: medicine.quantity,
    min_stock_level: medicine.minStockLevel,
  };
  const result = await aiClient.forecastDemand(input);
  await saveResult('demand_forecast', medicineId, { horizonDays }, result, userId);
  return { cached: false, input: { horizonDays, medicine_name: medicine.name }, result };
};

export const getRiskDistribution = async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await AnalyticsResult.find({
    kind: 'risk_profile',
    createdAt: { $gte: cutoff },
  }).sort('-createdAt');

  const perStudent = new Map();
  for (const r of recent) {
    if (!perStudent.has(r.subject)) perStudent.set(r.subject, r);
  }

  const distribution = { low: 0, medium: 0, high: 0 };
  for (const r of perStudent.values()) {
    const lvl = r.result?.risk_level;
    if (lvl in distribution) distribution[lvl] += 1;
  }

  return {
    totalProfiled: perStudent.size,
    distribution,
    windowDays: 30,
  };
};

export const getAiHealth = () => aiClient.health();
