import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';

// ── Token helpers ──────────────────────────────────────────

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Create a server/.env file from .env.example.'
    );
  }
  return secret;
};
const JWT_EXPIRES_IN = () => process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = () => process.env.JWT_REFRESH_SECRET || JWT_SECRET() + '_refresh';
const JWT_REFRESH_EXPIRES_IN = () => process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function signAccessToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET(), { expiresIn: JWT_EXPIRES_IN() });
}

function signRefreshToken(userId) {
  return jwt.sign({ id: userId }, JWT_REFRESH_SECRET(), { expiresIn: JWT_REFRESH_EXPIRES_IN() });
}

function buildUserPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// ── Public API ─────────────────────────────────────────────

/**
 * Register a new user and return tokens.
 */
export async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw AppError.conflict('Email already registered', 'EMAIL_EXISTS');
  }

  const user = await User.create({ name, email, password });

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // Persist refresh token
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken, user: buildUserPayload(user) };
}

/**
 * Authenticate existing user with email + password.
 */
export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken, user: buildUserPayload(user) };
}

/**
 * Issue a new access token using a valid refresh token.
 */
export async function refreshAccessToken(token) {
  if (!token) {
    throw AppError.unauthorized('Refresh token is required', 'NO_REFRESH_TOKEN');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_REFRESH_SECRET());
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    throw AppError.unauthorized('Refresh token revoked or invalid', 'REVOKED_REFRESH_TOKEN');
  }

  const accessToken = signAccessToken(user._id);
  const newRefreshToken = signRefreshToken(user._id);

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Invalidate refresh token (logout).
 */
export async function logoutUser(userId) {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
}

/**
 * Return the sanitized user profile.
 */
export async function getUserProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }
  return buildUserPayload(user);
}

/**
 * Verify an access token and return the associated user.
 * Used by the auth middleware.
 */
export async function verifyAccessToken(token) {
  if (!token) {
    throw AppError.unauthorized('No token provided', 'NO_TOKEN');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET());
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Token expired', 'TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Invalid token', 'INVALID_TOKEN');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw AppError.unauthorized('User no longer exists', 'USER_NOT_FOUND');
  }

  return user;
}
