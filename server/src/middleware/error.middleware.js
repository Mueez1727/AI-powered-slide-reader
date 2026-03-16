import AppError from '../utils/AppError.js';

// ── 404 catch-all ───────────────────────────────────────────
export const notFound = (req, _res, next) => {
  next(AppError.notFound(`Not Found - ${req.originalUrl}`));
};

// ── Central error handler ───────────────────────────────────
export const errorHandler = (err, _req, res, _next) => {
  // Only log unexpected (non-operational) errors at full detail
  if (!err.isOperational) {
    console.error('💥 Unexpected error:', err);
  } else if (process.env.NODE_ENV !== 'production') {
    console.error(`[${err.statusCode}] ${err.message}`);
  }

  // ── Multer file-size ──────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'File too large. Maximum size is 50 MB.' });
  }
  if (err.message?.includes('Invalid file type')) {
    return res.status(400).json({ code: 'INVALID_FILE_TYPE', message: err.message });
  }

  // ── Mongoose validation ───────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: messages.join(', ') });
  }

  // ── Mongoose duplicate key ────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ code: 'DUPLICATE_FIELD', message: `${field} already exists` });
  }

  // ── JWT errors (fallback for any unhandled jwt errors) ────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Token expired' });
  }

  // ── Operational (AppError) or generic ──────────────────────
  const statusCode = err.statusCode || 500;
  const body = {
    code: err.code || 'INTERNAL_ERROR',
    message: err.isOperational ? err.message : 'Internal Server Error',
  };

  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};
