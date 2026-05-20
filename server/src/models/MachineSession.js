import mongoose from 'mongoose';

export const SESSION_STATUS = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
});

export const SESSION_TYPES = Object.freeze({
  CONSULTATION: 'consultation',
  QUICK: 'quick',
});

export const DECISION_ACTIONS = Object.freeze({
  DISPENSE: 'DISPENSE',
  CONSULT_DOCTOR: 'CONSULT_DOCTOR',
});

export const RISK_LEVELS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

export const INPUT_MODES = ['text', 'voice', 'quick', 'mixed'];
export const PAYMENT_METHODS = ['upi', 'card', 'cash', 'qr', 'none'];
export const PAYMENT_STATUS = ['pending', 'success', 'failed', 'refunded', 'not_applicable'];

const rawInputSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, default: '' },
    audioTranscript: { type: String, trim: true, default: '' },
    quickSelections: { type: [String], default: [] },
    inputMode: { type: String, enum: INPUT_MODES, default: 'text' },
    language: { type: String, default: 'en' },
  },
  { _id: false }
);

const sensorDataSchema = new mongoose.Schema(
  {
    heartRate: { type: Number, min: 0, max: 250 },
    temperature: { type: Number },
    spO2: { type: Number, min: 0, max: 100 },
    respirationRate: { type: Number, min: 0, max: 80 },
    capturedImageUrl: { type: String, default: '' },
    capturedAt: { type: Date, default: () => new Date() },
    source: { type: String, default: 'simulated' },
  },
  { _id: false }
);

const aiDiseaseSchema = new mongoose.Schema(
  {
    disease: String,
    confidence: { type: Number, min: 0, max: 1 },
    alternatives: [
      new mongoose.Schema(
        { disease: String, confidence: Number },
        { _id: false }
      ),
    ],
    model: String,
  },
  { _id: false }
);

const aiRiskSchema = new mongoose.Schema(
  {
    level: { type: String, enum: Object.values(RISK_LEVELS) },
    score: { type: Number, min: 0, max: 1 },
    flags: { type: [String], default: [] },
    model: String,
  },
  { _id: false }
);

const aiAnomalySchema = new mongoose.Schema(
  {
    isAnomalous: { type: Boolean, default: false },
    flaggedFields: { type: [String], default: [] },
    details: { type: mongoose.Schema.Types.Mixed },
    model: String,
  },
  { _id: false }
);

const aiImageSchema = new mongoose.Schema(
  {
    condition: String,
    severity: { type: String, enum: ['none', 'mild', 'moderate', 'severe', 'unknown'], default: 'none' },
    confidence: { type: Number, min: 0, max: 1 },
    model: String,
    skipped: { type: Boolean, default: false },
  },
  { _id: false }
);

const recommendedMedicineSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    medicineName: String,
    dosage: String,
    quantity: { type: Number, default: 1, min: 1 },
    reason: String,
  },
  { _id: false }
);

const decisionSchema = new mongoose.Schema(
  {
    action: { type: String, enum: Object.values(DECISION_ACTIONS) },
    reasons: { type: [String], default: [] },
    thresholdsUsed: { type: mongoose.Schema.Types.Mixed },
    decidedAt: { type: Date, default: () => new Date() },
    acknowledgedAt: { type: Date, default: null },
  },
  { _id: false }
);

const dispensedItemSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineName: String,
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, default: 0 },
    issuedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, default: 'none' },
    amount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: PAYMENT_STATUS, default: 'not_applicable' },
    transactionId: String,
    paidAt: Date,
  },
  { _id: false }
);

const preFlightSchema = new mongoose.Schema(
  {
    underAge: { type: Boolean, default: false },
    hasAllergies: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineName: String,
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const machineSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },

    type: {
      type: String,
      enum: Object.values(SESSION_TYPES),
      default: SESSION_TYPES.CONSULTATION,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.IN_PROGRESS,
      index: true,
    },

    rawInput: { type: rawInputSchema, default: () => ({}) },
    symptoms: { type: [String], default: [] },

    sensorData: { type: sensorDataSchema },

    aiResults: {
      disease: aiDiseaseSchema,
      risk: aiRiskSchema,
      anomaly: aiAnomalySchema,
      image: aiImageSchema,
      recommendation: { type: [recommendedMedicineSchema], default: [] },
    },

    decision: decisionSchema,

    preFlight: { type: preFlightSchema, default: () => ({}) },
    cart: { type: [cartItemSchema], default: [] },

    dispensed: { type: [dispensedItemSchema], default: [] },
    payment: { type: paymentSchema, default: () => ({}) },

    startedAt: { type: Date, default: () => new Date() },
    completedAt: Date,
    durationMs: Number,

    error: { type: String },
  },
  { timestamps: true }
);

machineSessionSchema.index({ createdAt: -1 });
machineSessionSchema.index({ user: 1, createdAt: -1 });
machineSessionSchema.index({ 'decision.action': 1 });
machineSessionSchema.index({ 'aiResults.risk.level': 1 });

export const MachineSession = mongoose.model('MachineSession', machineSessionSchema);
