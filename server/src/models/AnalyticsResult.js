import mongoose from 'mongoose';

export const ANALYTICS_KINDS = ['risk_profile', 'disease_trend', 'demand_forecast'];

const analyticsResultSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ANALYTICS_KINDS,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      index: true,
    },
    input: {
      type: mongoose.Schema.Types.Mixed,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);

analyticsResultSchema.index({ kind: 1, subject: 1, createdAt: -1 });

export const AnalyticsResult = mongoose.model('AnalyticsResult', analyticsResultSchema);
