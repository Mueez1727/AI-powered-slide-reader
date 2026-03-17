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
    const { data } = await axios.post(
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

    // Add AI response
    chat.messages.push({ role: 'assistant', content: data.response });
    await chat.save();

    // Return response with source slides for better context
    res.json({
      response: data.response,
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
