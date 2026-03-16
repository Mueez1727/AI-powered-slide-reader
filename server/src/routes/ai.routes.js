import { Router } from 'express';
import multer from 'multer';
import {
  summarizeDocument,
  transcribeAudio,
  textToSpeech,
  voiceInput,
  serveTtsAudio,
  generateMCQ,
} from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { summarizeValidation, handleValidationErrors } from '../middleware/validate.middleware.js';

const router = Router();
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect);

router.post('/summarize', summarizeValidation, handleValidationErrors, summarizeDocument);
router.post('/generate-mcq', summarizeValidation, handleValidationErrors, generateMCQ);
router.post('/transcribe', memoryUpload.single('audio'), transcribeAudio);
router.post('/speak', textToSpeech);
router.post('/voice-input', memoryUpload.single('audio'), voiceInput);
router.get('/tts-audio/:filename', serveTtsAudio);

export default router;
