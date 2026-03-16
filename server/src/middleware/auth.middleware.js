import { verifyAccessToken } from '../services/auth.service.js';
import AppError from '../utils/AppError.js';

/**
 * Protect routes – verifies Bearer access-token and attaches user to req.
 */
export const protect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer')) {
      throw AppError.unauthorized('Not authorized, no token provided');
    }

    const token = authHeader.split(' ')[1];
    req.user = await verifyAccessToken(token);   // returns sanitised user
    next();
  } catch (error) {
    next(error instanceof AppError ? error : AppError.unauthorized(error.message));
  }
};

/**
 * Restrict to specific roles – must be used AFTER protect.
 *   e.g. restrictTo('admin')
 */
export const restrictTo = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(AppError.forbidden('You do not have permission to perform this action'));
  }
  next();
};
