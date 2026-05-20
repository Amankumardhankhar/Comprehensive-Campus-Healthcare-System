import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const signAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.secret);
