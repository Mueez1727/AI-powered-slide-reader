import axios from 'axios';
import FormData from 'form-data';

const AI_SERVER = process.env.AI_SERVER_URL || 'http://localhost:8001';

/**
 * Proxy: Summarize document
 */
export const summarizeDocument = async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const { data } = await axios.post(
      `${AI_SERVER}/api/summarize`,
      { document_id: documentId },
      { timeout: 300000 }  // 5 min — matches AI server's Ollama timeout
    );
    res.json(data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable' });
    }
    // Surface the AI server's error message if available
    if (error.response?.data?.detail) {
      return res.status(error.response.status || 503).json({
        detail: error.response.data.detail,
      });
    }
    next(error);
  }
};

/**
 * Proxy: Transcribe audio (voice-to-text)
 */
export const transcribeAudio = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }

    const form = new FormData();
    form.append('audio', req.file.buffer, {
      filename: req.file.originalname || 'recording.webm',
      contentType: req.file.mimetype,
    });

    const { data } = await axios.post(`${AI_SERVER}/api/transcribe`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    res.json(data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable' });
    }
    next(error);
  }
};

/**
 * Proxy: Text-to-speech
 */
export const textToSpeech = async (req, res, next) => {
  try {
    const { text, slow } = req.body;
    const { data } = await axios.post(
      `${AI_SERVER}/api/speak`,
      { text, slow: !!slow },
      { responseType: 'arraybuffer', timeout: 30000 }
    );

    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(data));
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable' });
    }
    next(error);
  }
};

/**
 * Proxy: Voice input — full pipeline (STT → RAG → TTS)
 *
 * Accepts multipart/form-data with:
 *   - audio: audio file blob
 *   - document_id: (optional) document to query against
 *
 * Returns: { transcription, ai_response, audio_url, sources }
 */
export const voiceInput = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }

    const form = new FormData();
    form.append('audio', req.file.buffer, {
      filename: req.file.originalname || 'recording.webm',
      contentType: req.file.mimetype,
    });

    // Pass document_id as a form field (matches FastAPI's Form(...))
    if (req.body.document_id) {
      form.append('document_id', req.body.document_id);
    }

    const { data } = await axios.post(`${AI_SERVER}/api/voice-input`, form, {
      headers: form.getHeaders(),
      timeout: 180000, // Long timeout — includes STT + LLM + TTS
    });

    // Rewrite the audio_url to point through the Node proxy
    if (data.audio_url) {
      data.audio_url = `/api/ai${data.audio_url.replace('/api', '')}`;
    }

    res.json(data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable' });
    }
    next(error);
  }
};

/**
 * Proxy: Serve TTS audio file from the AI server
 */
export const serveTtsAudio = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const { data } = await axios.get(
      `${AI_SERVER}/api/tts-audio/${filename}`,
      { responseType: 'arraybuffer', timeout: 15000 }
    );

    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(data));
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable' });
    }
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Audio file not found' });
    }
    next(error);
  }
};

/**
 * Proxy: Generate MCQs from document
 */
export const generateMCQ = async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const { data } = await axios.post(
      `${AI_SERVER}/api/generate-mcq`,
      { document_id: documentId },
      { timeout: 180000 }
    );
    res.json(data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable' });
    }
    next(error);
  }
};
