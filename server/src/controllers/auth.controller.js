import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserProfile,
} from '../services/auth.service.js';

/**
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    console.log(`[Auth] Registration attempt for email: ${email}`);

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are all required',
        code: 'MISSING_FIELDS',
      });
    }

    const result = await registerUser({ name, email, password });
    console.log(`[Auth] Registration successful for email: ${email}`);

    res.status(201).json({
      message: 'Registration successful',
      token: result.accessToken,       // backward-compat key
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    console.error(`[Auth] Registration failed for ${req.body?.email || 'unknown'}:`, error.message);
    console.error(`[Auth] Error details:`, {
      statusCode: error.statusCode,
      code: error.code,
      name: error.name,
      isOperational: error.isOperational,
    });

    // Surface Mongoose validation errors properly
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      return res.status(400).json({
        message: messages.join(', ') || 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    }

    // Surface duplicate key (email already registered)
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    }

    // Surface AppError with its message
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        message: error.message,
        code: error.code || 'REGISTRATION_ERROR',
      });
    }

    // Fallback for unexpected errors — give a descriptive message
    return res.status(500).json({
      message: `Registration failed: ${error.message || 'Internal server error'}`,
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });

    res.json({
      message: 'Login successful',
      token: result.accessToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 */
export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await refreshAccessToken(refreshToken);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    await logoutUser(req.user._id);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await getUserProfile(req.user._id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};
