import mongoose from 'mongoose';
import { MedicalRecord } from '../models/MedicalRecord.js';
import { Medicine } from '../models/Medicine.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { User, ROLES } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const populateRecord = (q) =>
  q
    .populate('student', 'name email studentId department')
    .populate('attendedBy', 'name role')
    .populate('prescribedMedicines.medicine', 'name unit');

export const listRecords = async (query, currentUser) => {
  const {
    student,
    search,
    from,
    to,
    status,
    page = 1,
    limit = 20,
    sort = '-visitDate',
  } = query;

  const filter = {};

  if (currentUser.role === ROLES.STUDENT) {
    filter.student = currentUser._id;
  } else if (student) {
    filter.student = student;
  }

  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  if (from || to) {
    filter.visitDate = {};
    if (from) filter.visitDate.$gte = new Date(from);
    if (to) filter.visitDate.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    populateRecord(MedicalRecord.find(filter)).sort(sort).skip(skip).limit(Number(limit)),
    MedicalRecord.countDocuments(filter),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
};

export const getRecord = async (id, currentUser) => {
  const record = await populateRecord(MedicalRecord.findById(id));
  if (!record) throw ApiError.notFound('Record not found');

  if (
    currentUser.role === ROLES.STUDENT &&
    record.student._id.toString() !== currentUser._id.toString()
  ) {
    throw ApiError.forbidden('Cannot access another student\'s record');
  }

  return record;
};

export const createRecord = async (data, currentUser) => {
  const student = await User.findById(data.student);
  if (!student || student.role !== ROLES.STUDENT) {
    throw ApiError.badRequest('Invalid student reference');
  }

  const record = await MedicalRecord.create({
    ...data,
    attendedBy: currentUser._id,
    prescribedMedicines: [],
  });
  return populateRecord(MedicalRecord.findById(record._id));
};

export const updateRecord = async (id, data) => {
  const forbiddenFields = ['prescribedMedicines', 'student', 'attendedBy'];
  for (const f of forbiddenFields) delete data[f];

  const record = await populateRecord(
    MedicalRecord.findByIdAndUpdate(id, data, { new: true, runValidators: true })
  );
  if (!record) throw ApiError.notFound('Record not found');
  return record;
};

export const deleteRecord = async (id) => {
  const record = await MedicalRecord.findByIdAndDelete(id);
  if (!record) throw ApiError.notFound('Record not found');
  return record;
};

export const issueMedicines = async ({ recordId, items, currentUser }) => {
  if (!items?.length) throw ApiError.badRequest('No medicines to issue');

  const session = await mongoose.startSession();
  try {
    let updatedRecord;
    await session.withTransaction(async () => {
      const record = await MedicalRecord.findById(recordId).session(session);
      if (!record) throw ApiError.notFound('Record not found');

      for (const item of items) {
        const med = await Medicine.findById(item.medicine).session(session);
        if (!med || !med.isActive) {
          throw ApiError.badRequest(`Medicine not found: ${item.medicine}`);
        }
        if (med.quantity < item.quantity) {
          throw ApiError.badRequest(
            `Insufficient stock for ${med.name}: have ${med.quantity}, need ${item.quantity}`
          );
        }
        if (med.expiryDate && med.expiryDate < new Date()) {
          throw ApiError.badRequest(`Medicine ${med.name} is expired`);
        }

        const before = med.quantity;
        med.quantity -= item.quantity;
        await med.save({ session });

        await InventoryLog.create(
          [
            {
              medicine: med._id,
              action: 'stock_out',
              quantity: item.quantity,
              quantityBefore: before,
              quantityAfter: med.quantity,
              reason: `Issued for record ${recordId}`,
              performedBy: currentUser._id,
              relatedRecord: record._id,
            },
          ],
          { session }
        );

        record.prescribedMedicines.push({
          medicine: med._id,
          medicineName: med.name,
          quantity: item.quantity,
          dosage: item.dosage,
          instructions: item.instructions,
        });
      }

      await record.save({ session });
      updatedRecord = record;
    });

    return populateRecord(MedicalRecord.findById(updatedRecord._id));
  } finally {
    session.endSession();
  }
};
