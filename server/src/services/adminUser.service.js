import { User, ROLES } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const EDITABLE = ['name', 'phone', 'department', 'studentId', 'dateOfBirth', 'chronicConditions', 'role', 'isActive', 'password'];

const sanitize = (patch) => {
  const out = {};
  for (const key of EDITABLE) {
    if (patch[key] === undefined) continue;
    if (key === 'chronicConditions') {
      out[key] = Array.isArray(patch[key]) ? patch[key].map((s) => String(s).trim()).filter(Boolean) : [];
    } else if (key === 'dateOfBirth') {
      out[key] = patch[key] ? new Date(patch[key]) : null;
    } else if (key === 'isActive') {
      out[key] = Boolean(patch[key]);
    } else if (patch[key] === '' || patch[key] === null) {
      out[key] = null;
    } else {
      out[key] = typeof patch[key] === 'string' ? patch[key].trim() : patch[key];
    }
  }
  return out;
};

export const listUsers = async ({ role, search, isActive, page = 1, limit = 25 }) => {
  const filter = {};
  if (role) filter.role = role;
  if (isActive === 'true' || isActive === true) filter.isActive = true;
  if (isActive === 'false' || isActive === false) filter.isActive = false;
  if (search && search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { studentId: rx }];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
    User.countDocuments(filter),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
};

export const getUser = async (id) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

export const createUser = async (input) => {
  if (!input.email || !input.password || !input.name) {
    throw ApiError.badRequest('name, email and password are required');
  }
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('Email already registered');

  if (input.studentId) {
    const clash = await User.findOne({ studentId: input.studentId });
    if (clash) throw ApiError.conflict('Student/Staff ID already in use');
  }

  const role = input.role && Object.values(ROLES).includes(input.role) ? input.role : ROLES.STUDENT;
  const user = await User.create({ ...input, role });
  return user;
};

export const updateUser = async (id, patch, actor) => {
  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found');

  const update = sanitize(patch);

  if (String(target._id) === String(actor._id)) {
    if (update.role && update.role !== target.role) {
      throw ApiError.badRequest('You cannot change your own role');
    }
    if (update.isActive === false) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }
  }

  if (update.role && update.role !== target.role && target.role === ROLES.ADMIN) {
    const otherAdmins = await User.countDocuments({ role: ROLES.ADMIN, isActive: true, _id: { $ne: target._id } });
    if (otherAdmins === 0) throw ApiError.badRequest('Cannot demote the last active admin');
  }
  if (update.isActive === false && target.role === ROLES.ADMIN) {
    const otherAdmins = await User.countDocuments({ role: ROLES.ADMIN, isActive: true, _id: { $ne: target._id } });
    if (otherAdmins === 0) throw ApiError.badRequest('Cannot deactivate the last active admin');
  }

  if (update.studentId) {
    const clash = await User.findOne({ studentId: update.studentId, _id: { $ne: id } });
    if (clash) throw ApiError.conflict('Student/Staff ID already in use');
  }

  if (update.password) {
    if (String(update.password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
    target.password = update.password;
    delete update.password;
  }

  Object.assign(target, update);
  await target.save();
  return target;
};

export const deleteUser = async (id, actor) => {
  if (String(id) === String(actor._id)) throw ApiError.badRequest('You cannot delete your own account');
  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found');
  if (target.role === ROLES.ADMIN) {
    const otherAdmins = await User.countDocuments({ role: ROLES.ADMIN, isActive: true, _id: { $ne: target._id } });
    if (otherAdmins === 0) throw ApiError.badRequest('Cannot delete the last active admin');
  }
  await User.deleteOne({ _id: id });
  return { id };
};
