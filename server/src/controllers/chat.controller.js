import Chat from '../models/Chat.js';
import Document from '../models/Document.js';
import axios from 'axios';

const AI_SERVER = process.env.AI_SERVER_URL || 'http://localhost:8001';

export const getChatHistory = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      document: req.params.documentId,
      user: req.user._id,
    });

    res.json({ messages: chat?.messages || [] });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { documentId, message } = req.body;

    // Verify document ownership
    const document = await Document.findOne({
      _id: documentId,
      user: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.status !== 'ready') {
      return res.status(400).json({ message: 'Document is still processing' });
    }

    // Get or create chat
    let chat = await Chat.findOne({ document: documentId, user: req.user._id });
    if (!chat) {
      chat = await Chat.create({
        document: documentId,
        user: req.user._id,
        messages: [],
      });
    }

    // Add user message
    chat.messages.push({ role: 'user', content: message });

    // Send to AI server
    let data;
    try {
      const resp = await axios.post(
        `${AI_SERVER}/api/chat`,
        {
          document_id: documentId,
          question: message,
          chat_history: chat.messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
        { timeout: 120000 }
      );
      data = resp.data;
    } catch (aiError) {
      if (aiError.code === 'ECONNREFUSED') {
        return res.status(503).json({ message: 'AI server is unavailable. Please ensure it is running.' });
      }
      if (aiError.response?.data?.detail) {
        return res.status(aiError.response.status || 503).json({
          message: aiError.response.data.detail,
        });
      }
      // Fallback: save a failure message so chat doesn't get stuck
      const fallback = 'Sorry, I could not process your question right now. Please try again.';
      chat.messages.push({ role: 'assistant', content: fallback });
      await chat.save();
      return res.json({ response: fallback, sources: [], model: 'fallback' });
    }

    const aiResponse = data.response || 'Sorry, I could not generate a response.';

    // Add AI response
    chat.messages.push({ role: 'assistant', content: aiResponse });
    await chat.save();

    res.json({
      response: aiResponse,
      sources: data.sources || [],
      model: data.model || 'unknown'
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable. Please ensure it is running.' });
    }
    next(error);
  }
};

/**
 * Streaming chat — proxies SSE from FastAPI /api/chat/stream to the client.
 * Uses res.write/flush/end for true streaming.
 */
export const sendMessageStream = async (req, res, next) => {
  try {
    const { documentId, message } = req.body;

    // Verify document ownership
    const document = await Document.findOne({
      _id: documentId,
      user: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.status !== 'ready') {
      return res.status(400).json({ message: 'Document is still processing' });
    }

    // Get or create chat
    let chat = await Chat.findOne({ document: documentId, user: req.user._id });
    if (!chat) {
      chat = await Chat.create({
        document: documentId,
        user: req.user._id,
        messages: [],
      });
    }

    // Add user message to history
    chat.messages.push({ role: 'user', content: message });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Stream from FastAPI
    let aiResponse;
    try {
      aiResponse = await axios.post(
        `${AI_SERVER}/api/chat/stream`,
        {
          document_id: documentId,
          question: message,
          chat_history: chat.messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
        { responseType: 'stream', timeout: 300000 }
      );
    } catch (aiError) {
      const errMsg = aiError.code === 'ECONNREFUSED'
        ? 'AI server is unavailable'
        : (aiError.response?.data?.detail || 'Failed to connect to AI');
      const errorPayload = JSON.stringify({ error: errMsg });
      res.write(`data: ${errorPayload}\n\n`);
      const donePayload = JSON.stringify({ done: true, sources: [], model: 'error' });
      res.write(`data: ${donePayload}\n\n`);
      return res.end();
    }

    let fullContent = '';

    aiResponse.data.on('data', (chunk) => {
      const text = chunk.toString();
      // Forward SSE data as-is to the client
      res.write(text);
      if (typeof res.flush === 'function') res.flush();

      // Parse tokens to accumulate full response for DB save
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.token) {
              fullContent += parsed.token;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    });

    aiResponse.data.on('end', async () => {
      // Save the full AI response to chat history
      if (fullContent.trim()) {
        chat.messages.push({ role: 'assistant', content: fullContent });
      } else {
        chat.messages.push({ role: 'assistant', content: 'Sorry, I could not generate a response.' });
      }
      try {
        await chat.save();
      } catch (saveErr) {
        console.error('Failed to save chat after stream:', saveErr);
      }
      res.end();
    });

    aiResponse.data.on('error', (err) => {
      console.error('Stream error from AI server:', err);
      const errorPayload = JSON.stringify({ error: 'Stream interrupted' });
      res.write(`data: ${errorPayload}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      if (aiResponse?.data?.destroy) aiResponse.data.destroy();
    });
  } catch (error) {
    // If headers already sent (streaming started), end the stream
    if (res.headersSent) {
      const errorPayload = JSON.stringify({ error: 'An unexpected error occurred' });
      res.write(`data: ${errorPayload}\n\n`);
      return res.end();
    }
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI server is unavailable. Please ensure it is running.' });
    }
    next(error);
  }
};
