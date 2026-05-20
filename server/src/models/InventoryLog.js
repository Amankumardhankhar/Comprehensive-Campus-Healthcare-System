import mongoose from 'mongoose';

export const LOG_ACTIONS = ['stock_in', 'stock_out', 'adjustment', 'expired_removal'];

const inventoryLogSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: LOG_ACTIONS,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    quantityBefore: {
      type: Number,
      required: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    relatedRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalRecord',
    },
  },
  { timestamps: true }
);

inventoryLogSchema.index({ createdAt: -1 });
inventoryLogSchema.index({ medicine: 1, createdAt: -1 });

export const InventoryLog = mongoose.model('InventoryLog', inventoryLogSchema);
