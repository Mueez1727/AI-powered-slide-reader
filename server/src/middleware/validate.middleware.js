import { body, param, validationResult } from 'express-validator';

// ── Generic handler ─────────────────────────────────────────
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array().map((e) => e.msg).join(', '),
      errors: errors.array(),
    });
  }
  next();
};

// ── Auth ────────────────────────────────────────────────────
export const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

export const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required')
    .isJWT().withMessage('Invalid refresh token format'),
];

// ── Chat ────────────────────────────────────────────────────
export const chatMessageValidation = [
  body('documentId')
    .notEmpty().withMessage('Document ID is required')
    .isMongoId().withMessage('Invalid document ID'),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ max: 4000 }).withMessage('Message too long (max 4 000 chars)'),
];

// ── Document / Slide ────────────────────────────────────────
export const mongoIdParam = (paramName = 'id') => [
  param(paramName)
    .isMongoId().withMessage(`Invalid ${paramName}`),
];

export const summarizeValidation = [
  body('documentId')
    .notEmpty().withMessage('Document ID is required')
    .isMongoId().withMessage('Invalid document ID'),
];
