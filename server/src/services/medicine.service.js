import { Medicine } from '../models/Medicine.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { ApiError } from '../utils/ApiError.js';

export const listMedicines = async (query) => {
  const {
    search,
    category,
    lowStock,
    expiringSoon,
    page = 1,
    limit = 20,
    sort = '-createdAt',
  } = query;

  const filter = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$quantity', '$minStockLevel'] };
  }

  if (expiringSoon === 'true') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 30);
    filter.expiryDate = { $gte: new Date(), $lte: cutoff };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Medicine.find(filter).sort(sort).skip(skip).limit(Number(limit)),
    Medicine.countDocuments(filter),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
};

export const getMedicine = async (id) => {
  const med = await Medicine.findById(id);
  if (!med) throw ApiError.notFound('Medicine not found');
  return med;
};

export const createMedicine = async (data) => Medicine.create(data);

export const updateMedicine = async (id, data) => {
  const med = await Medicine.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!med) throw ApiError.notFound('Medicine not found');
  return med;
};

export const deleteMedicine = async (id) => {
  const med = await Medicine.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!med) throw ApiError.notFound('Medicine not found');
  return med;
};

export const adjustStock = async ({ medicineId, quantity, reason, userId, action = 'adjustment' }) => {
  const med = await Medicine.findById(medicineId);
  if (!med) throw ApiError.notFound('Medicine not found');

  const before = med.quantity;
  const after = before + quantity;
  if (after < 0) {
    throw ApiError.badRequest(`Insufficient stock: have ${before}, trying to remove ${-quantity}`);
  }

  med.quantity = after;
  await med.save();

  await InventoryLog.create({
    medicine: med._id,
    action,
    quantity: Math.abs(quantity),
    quantityBefore: before,
    quantityAfter: after,
    reason,
    performedBy: userId,
  });

  return med;
};

export const getInventoryLogs = async (query) => {
  const { medicineId, action, page = 1, limit = 50 } = query;
  const filter = {};
  if (medicineId) filter.medicine = medicineId;
  if (action) filter.action = action;

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    InventoryLog.find(filter)
      .populate('medicine', 'name unit')
      .populate('performedBy', 'name role')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    InventoryLog.countDocuments(filter),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
};

export const listDispensable = async (query = {}) => {
  const { search, page = 1, limit = 50 } = query;
  const filter = {
    isActive: true,
    otcSafe: true,
    dispensableByMachine: true,
    quantity: { $gt: 0 },
    expiryDate: { $gt: new Date() },
  };
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Medicine.find(filter).sort('name').skip(skip).limit(Number(limit)),
    Medicine.countDocuments(filter),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
};

export const setOtcFlags = async (id, patch) => {
  const allowed = ['otcSafe', 'dispensableByMachine', 'maxPerSession', 'indications', 'contraindications'];
  const update = {};
  for (const k of allowed) if (patch[k] !== undefined) update[k] = patch[k];
  const med = await Medicine.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!med) throw ApiError.notFound('Medicine not found');
  return med;
};

export const getInventoryStats = async () => {
  const [total, lowStock, expiringSoon, expired] = await Promise.all([
    Medicine.countDocuments({ isActive: true }),
    Medicine.countDocuments({
      isActive: true,
      $expr: { $lte: ['$quantity', '$minStockLevel'] },
    }),
    Medicine.countDocuments({
      isActive: true,
      expiryDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    Medicine.countDocuments({
      isActive: true,
      expiryDate: { $lt: new Date() },
    }),
  ]);
  return { total, lowStock, expiringSoon, expired };
};
