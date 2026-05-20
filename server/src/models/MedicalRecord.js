import mongoose from 'mongoose';

const issuedMedicineSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    dosage: { type: String, trim: true },
    instructions: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false }
);

const medicalRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    visitDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    symptoms: {
      type: [String],
      required: [true, 'At least one symptom is required'],
      validate: [(v) => v.length > 0, 'Symptoms cannot be empty'],
    },
    diagnosis: {
      type: String,
      required: [true, 'Diagnosis is required'],
      trim: true,
      maxlength: 1000,
    },
    vitals: {
      temperature: Number,
      bloodPressure: String,
      pulse: Number,
      oxygenSaturation: Number,
    },
    prescribedMedicines: [issuedMedicineSchema],
    notes: {
      type: String,
      maxlength: 2000,
    },
    followUpDate: Date,
    attendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'referred'],
      default: 'closed',
    },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ student: 1, visitDate: -1 });
medicalRecordSchema.index({ diagnosis: 'text', symptoms: 'text' });

export const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);
