import Document from '../models/Document.js';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const AI_SERVER = process.env.AI_SERVER_URL || 'http://localhost:8001';

export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const document = await Document.create({
      user: req.user._id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'processing',
    });

    // Send file to AI server for processing (async)
    processDocument(document).catch((err) => {
      console.error(`Processing failed for document ${document._id}:`, err.message);
    });

    res.status(201).json({
      message: 'File uploaded successfully. Processing started.',
      document,
    });
  } catch (error) {
    next(error);
  }
};

async function processDocument(document) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(document.filePath));
    form.append('document_id', document._id.toString());
    form.append('mime_type', document.mimeType);

    const { data } = await axios.post(`${AI_SERVER}/api/process`, form, {
      headers: form.getHeaders(),
      timeout: 300000, // 5 min timeout for large files
    });

    document.slides = (data.slides || []).map((s) => ({
      slideNumber: s.slide_number,
      heading: s.heading || '',
      mainContent: s.main_content || '',
      imageText: s.image_text || '',
    }));
    document.slideCount = data.slides?.length || 0;
    document.vectorIndexId = data.vector_index_id || null;
    document.status = 'ready';
    await document.save();
  } catch (error) {
    document.status = 'error';
    document.processingError = error.message;
    await document.save();
  }
}

export const getDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find({ user: req.user._id })
      .select('-slides')
      .sort({ createdAt: -1 });

    res.json({ documents });
  } catch (error) {
    next(error);
  }
};

export const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json({ document, slides: document.slides });
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete the physical file
    try {
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }
    } catch {
      // Non-critical, log and continue
    }

    // Delete vector index from AI server
    if (document.vectorIndexId) {
      axios
        .delete(`${AI_SERVER}/api/index/${document.vectorIndexId}`)
        .catch(() => {});
    }

    res.json({ message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
};
