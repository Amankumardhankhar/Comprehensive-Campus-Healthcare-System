import mongoose from 'mongoose';

export const DEFAULT_CONFIG = Object.freeze({
  key: 'global',
  minDiseaseConfidence: 0.25,
  maxHighRiskAllowed: 'MEDIUM',
  vitalBands: {
    heartRate: { min: 50, max: 110, criticalMin: 40, criticalMax: 130 },
    temperatureF: { min: 97.0, max: 99.5, criticalMin: 94.0, criticalMax: 103.0 },
    spO2: { min: 95, max: 100, criticalMin: 90, criticalMax: 100 },
  },
  blockDispenseOnSevereImage: true,
  maxMedicinesPerSession: 3,
  currency: 'INR',
});

const bandSchema = new mongoose.Schema(
  {
    min: Number,
    max: Number,
    criticalMin: Number,
    criticalMax: Number,
  },
  { _id: false }
);

const systemConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    minDiseaseConfidence: { type: Number, min: 0, max: 1, default: 0.25 },
    maxHighRiskAllowed: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    vitalBands: {
      heartRate: { type: bandSchema, default: () => DEFAULT_CONFIG.vitalBands.heartRate },
      temperatureF: { type: bandSchema, default: () => DEFAULT_CONFIG.vitalBands.temperatureF },
      spO2: { type: bandSchema, default: () => DEFAULT_CONFIG.vitalBands.spO2 },
    },
    blockDispenseOnSevereImage: { type: Boolean, default: true },
    maxMedicinesPerSession: { type: Number, min: 1, max: 10, default: 3 },
    currency: { type: String, default: 'INR' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

systemConfigSchema.statics.getOrCreate = async function () {
  let doc = await this.findOne({ key: 'global' });
  if (!doc) doc = await this.create({ key: 'global' });
  return doc;
};

export const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
