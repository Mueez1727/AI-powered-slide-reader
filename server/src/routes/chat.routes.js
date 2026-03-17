import { Router } from 'express';
import { getChatHistory, sendMessage, sendMessageStream } from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { chatMessageValidation, handleValidationErrors } from '../middleware/validate.middleware.js';

const router = Router();

router.use(protect);

router.get('/:documentId', getChatHistory);
router.post('/message', chatMessageValidation, handleValidationErrors, sendMessage);
router.post('/message/stream', chatMessageValidation, handleValidationErrors, sendMessageStream);

export default router;
