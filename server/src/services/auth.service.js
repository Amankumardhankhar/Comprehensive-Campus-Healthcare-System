import { User, ROLES } from '../models/User.js';
import { signAccessToken } from './token.service.js';
import { ApiError } from '../utils/ApiError.js';

export const registerUser = async (input) => {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('Email already registered');

  if (input.role === ROLES.ADMIN) {
    throw ApiError.forbidden('Cannot self-register as admin');
  }

  const user = await User.create(input);
  const token = signAccessToken({ sub: user._id.toString(), role: user.role });
  return { user, token };
};

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  const token = signAccessToken({ sub: user._id.toString(), role: user.role });
  return { user, token };
};

export const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const PROFILE_EDITABLE = ['name', 'phone', 'department', 'studentId', 'dateOfBirth', 'chronicConditions'];

export const updateProfile = async (userId, patch) => {
  const update = {};
  for (const key of PROFILE_EDITABLE) {
    if (patch[key] === undefined) continue;
    if (key === 'chronicConditions') {
      update[key] = Array.isArray(patch[key])
        ? patch[key].map((s) => String(s).trim()).filter(Boolean)
        : [];
    } else if (key === 'dateOfBirth') {
      update[key] = patch[key] ? new Date(patch[key]) : null;
    } else if (patch[key] === '' || patch[key] === null) {
      update[key] = null;
    } else {
      update[key] = String(patch[key]).trim();
    }
  }

  if (update.studentId) {
    const clash = await User.findOne({ studentId: update.studentId, _id: { $ne: userId } });
    if (clash) throw ApiError.conflict('Student/Staff ID already in use');
  }

  const user = await User.findByIdAndUpdate(userId, update, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};
