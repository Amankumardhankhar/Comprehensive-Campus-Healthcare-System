import mongoose from 'mongoose';

export const MEDICINE_CATEGORIES = [
  'analgesic',
  'antibiotic',
  'antacid',
  'antihistamine',
  'antipyretic',
  'cough_cold',
  'vitamin',
  'topical',
  'first_aid',
  'other',
];

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: MEDICINE_CATEGORIES,
      default: 'other',
      index: true,
    },
    manufacturer: {
      type: String,
      trim: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    unit: {
      type: String,
      enum: ['tablet', 'capsule', 'bottle', 'strip', 'tube', 'syringe', 'unit'],
      default: 'tablet',
    },
    pricePerUnit: {
      type: Number,
      min: 0,
      default: 0,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true,
    },
    minStockLevel: {
      type: Number,
      min: 0,
      default: 10,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    otcSafe: {
      type: Boolean,
      default: false,
      index: true,
    },
    dispensableByMachine: {
      type: Boolean,
      default: false,
      index: true,
    },
    maxPerSession: {
      type: Number,
      min: 1,
      default: 2,
    },
    indications: {
      type: [String],
      default: [],
    },
    contraindications: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

medicineSchema.index({ name: 'text', genericName: 'text' });

medicineSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.minStockLevel;
});

medicineSchema.virtual('isExpired').get(function () {
  return this.expiryDate && this.expiryDate < new Date();
});

medicineSchema.virtual('isExpiringSoon').get(function () {
  if (!this.expiryDate) return false;
  const days = (this.expiryDate - new Date()) / (1000 * 60 * 60 * 24);
  return days > 0 && days <= 30;
});

medicineSchema.set('toJSON', { virtuals: true });
medicineSchema.set('toObject', { virtuals: true });

export const Medicine = mongoose.model('Medicine', medicineSchema);
