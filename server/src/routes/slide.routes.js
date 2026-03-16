import { Router } from 'express';
import { uploadSlide, listSlides, getSlide, removeSlide } from '../controllers/slide.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../config/multer.js';
import { mongoIdParam, handleValidationErrors } from '../middleware/validate.middleware.js';

const router = Router();

// All slide routes require authentication
router.use(protect);

// Core upload endpoint
router.post('/upload-slide', upload.single('file'), uploadSlide);

// CRUD helpers
router.get('/', listSlides);
router.get('/:id', mongoIdParam('id'), handleValidationErrors, getSlide);
router.delete('/:id', mongoIdParam('id'), handleValidationErrors, removeSlide);

export default router;
