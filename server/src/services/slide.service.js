import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import UploadedSlide from '../models/UploadedSlide.js';
import { AppError } from '../utils/AppError.js';

const AI_SERVER = () => process.env.AI_SERVER_URL || 'http://localhost:8001';

/**
 * Persist slide metadata to MongoDB and kick off AI processing.
 * Returns the saved UploadedSlide document (status may still be "processing").
 */
export async function createSlideRecord(userId, file) {
  const slide = await UploadedSlide.create({
    userId,
    fileName: file.originalname,
    filePath: file.path,
    mimeType: file.mimetype,
    fileSize: file.size,
    status: 'processing',
  });

  // Fire-and-forget AI processing — updates the record when done
  processSlideWithAI(slide).catch((err) => {
    console.error(`[slide.service] AI processing failed for ${slide._id}:`, err.message);
  });

  return slide;
}

/**
 * Send the physical file to the Python FastAPI server,
 * then update the UploadedSlide record with the result.
 */
async function processSlideWithAI(slide) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(slide.filePath));
    form.append('document_id', slide._id.toString());
    form.append('mime_type', slide.mimeType);

    const { data } = await axios.post(`${AI_SERVER()}/api/process`, form, {
      headers: form.getHeaders(),
      timeout: 300_000, // 5 min — large decks take time
    });

    slide.slideCount = data.slides?.length ?? 0;
    slide.status = 'completed';
    await slide.save();

    return data;
  } catch (error) {
    slide.status = 'failed';
    await slide.save();
    throw error; // re-throw so the caller can log it
  }
}

/**
 * Retrieve all slides belonging to a user (newest first).
 */
export async function getSlidesByUser(userId) {
  return UploadedSlide.find({ userId }).sort({ uploadDate: -1 });
}

/**
 * Get a single slide record (scoped to the requesting user).
 */
export async function getSlideById(slideId, userId) {
  const slide = await UploadedSlide.findOne({ _id: slideId, userId });
  if (!slide) throw AppError.notFound('Slide not found', 'SLIDE_NOT_FOUND');
  return slide;
}

/**
 * Delete the slide record, its physical file, and the AI vector index.
 */
export async function deleteSlide(slideId, userId) {
  const slide = await UploadedSlide.findOneAndDelete({ _id: slideId, userId });
  if (!slide) throw AppError.notFound('Slide not found', 'SLIDE_NOT_FOUND');

  // Remove physical file (non-critical)
  try {
    if (fs.existsSync(slide.filePath)) fs.unlinkSync(slide.filePath);
  } catch { /* noop */ }

  // Remove vector index from AI server (non-critical)
  axios.delete(`${AI_SERVER()}/api/index/${slide._id}`).catch(() => {});

  return slide;
}
