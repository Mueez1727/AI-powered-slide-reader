/**
 * Custom operational error class.
 * Thrown intentionally in services/controllers and caught by the
 * centralized error-handling middleware.
 */
export class AppError extends Error {
  /**
   * @param {string}  message    — Human-readable error message
   * @param {number}  statusCode — HTTP status code (default 500)
   * @param {string}  [code]     — Optional machine-readable error code
   */
  constructor(message, statusCode = 500, code) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // distinguishes from programming errors

    Error.captureStackTrace(this, this.constructor);
  }

  // ── Convenience factories ───────────────────────────────
  static badRequest(msg = 'Bad request', code) {
    return new AppError(msg, 400, code);
  }

  static unauthorized(msg = 'Unauthorized', code) {
    return new AppError(msg, 401, code);
  }

  static forbidden(msg = 'Forbidden', code) {
    return new AppError(msg, 403, code);
  }

  static notFound(msg = 'Resource not found', code) {
    return new AppError(msg, 404, code);
  }

  static conflict(msg = 'Conflict', code) {
    return new AppError(msg, 409, code);
  }

  static tooMany(msg = 'Too many requests', code) {
    return new AppError(msg, 429, code);
  }

  static internal(msg = 'Internal server error', code) {
    return new AppError(msg, 500, code);
  }
}

// Default export for files using `import AppError from ...`
export default AppError;
