import { Router } from 'express';
import { getChatHistory, sendMessage } from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { chatMessageValidation, handleValidationErrors } from '../middleware/validate.middleware.js';

const router = Router();

router.use(protect);

router.get('/:documentId', getChatHistory);
router.post('/message', chatMessageValidation, handleValidationErrors, sendMessage);

export default router;
