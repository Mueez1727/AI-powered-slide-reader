import {
  createSlideRecord,
  getSlidesByUser,
  getSlideById,
  deleteSlide,
} from '../services/slide.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * POST /api/slides/upload-slide
 * Accepts a single PDF or PPT/PPTX file, stores metadata,
 * and forwards the file to the AI server for processing.
 */
export const uploadSlide = async (req, res, next) => {
  try {
    if (!req.file) {
      throw AppError.badRequest('No file uploaded. Please attach a PDF or PPT/PPTX file.', 'NO_FILE');
    }

    const slide = await createSlideRecord(req.user.id, req.file);

    res.status(201).json({
      message: 'File uploaded successfully. Processing started.',
      slide,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/slides
 * List all slides for the authenticated user.
 */
export const listSlides = async (req, res, next) => {
  try {
    const slides = await getSlidesByUser(req.user.id);
    res.json({ slides });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/slides/:id
 * Get a specific slide record.
 */
export const getSlide = async (req, res, next) => {
  try {
    const slide = await getSlideById(req.params.id, req.user.id);
    res.json({ slide });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/slides/:id
 * Delete a slide record, its file, and AI index.
 */
export const removeSlide = async (req, res, next) => {
  try {
    await deleteSlide(req.params.id, req.user.id);
    res.json({ message: 'Slide deleted' });
  } catch (error) {
    next(error);
  }
};
