import { Router } from 'express';
import { register, login, refresh, logout, getProfile } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  handleValidationErrors,
} from '../middleware/validate.middleware.js';

const router = Router();

// Public
router.post('/register', registerValidation, handleValidationErrors, register);
router.post('/login',     loginValidation,    handleValidationErrors, login);
router.post('/refresh',   refreshTokenValidation, handleValidationErrors, refresh);

// Protected
router.post('/logout',  protect, logout);
router.get('/profile',  protect, getProfile);

export default router;
