import { Router } from 'express';
import {
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
} from '../controllers/document.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../config/multer.js';

const router = Router();

router.use(protect);

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.delete('/:id', deleteDocument);

export default router;
