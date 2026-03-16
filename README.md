# Multimodal AI-Powered Conversational Slide Reader

A full-stack web application for uploading presentation slides (PDF/PPT), extracting their content with OCR, and interacting with them through conversational AI — all running **locally** on your machine.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────┐
│   React UI  │────▶│  Node.js API │────▶│  Python AI Svc  │────▶│  Ollama │
│  (Vite)     │     │  (Express)   │     │  (FastAPI)      │     │  (llama-3)│
│  Port 3000  │     │  Port 5000   │     │  Port 8000      │     │  :11434 │
└─────────────┘     └──────────────┘     └─────────────────┘     └─────────┘
                          │                      │
                          ▼                      ▼
                    ┌───────────┐        ┌──────────────┐
                    │  MongoDB  │        │ FAISS Vector │
                    │   Atlas   │        │    Store     │
                    └───────────┘        └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, React Router |
| Backend API | Node.js, Express, MongoDB, JWT Auth, Multer |
| AI Server | Python FastAPI, PyMuPDF, python-pptx, pytesseract |
| Vector DB | FAISS with sentence-transformers embeddings |
| LLM | Ollama (llama-3 model) — runs locally |
| Speech | Whisper (STT), gTTS (TTS) |

## Prerequisites

- **Node.js** ≥ 18.x
- **Python** ≥ 3.10
- **MongoDB Atlas** account (free tier works)
- **Ollama** installed locally
- **Tesseract OCR** installed (for image-heavy PDFs)
- **8GB+ RAM** (optimized for low-resource systems)

## Quick Start

### 1. Clone and Install

```bash
# Install root dependencies
npm install

# Install all sub-project dependencies
npm run install:all
```

### 2. Set Up Ollama

```bash
# Install Ollama from https://ollama.com
# Then pull the llama-3 model:
ollama pull llama3

# Verify it's running:
ollama list
```

### 3. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist your IP (or use `0.0.0.0/0` for development)
5. Copy the connection string

### 4. Configure Environment Variables

```bash
# Root
cp .env.example .env

# Frontend
cp client/.env.example client/.env

# Backend
cp server/.env.example server/.env

# AI Server
cp ai-server/.env.example ai-server/.env
```

Edit each `.env` file with your actual values. **Critically**, update:
- `MONGODB_URI` in `server/.env`
- `JWT_SECRET` in `server/.env` (generate a random string)

### 5. Install Tesseract OCR

**Windows:**
```bash
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
# Add to PATH, or set TESSERACT_CMD in ai-server/.env
```

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt install tesseract-ocr
```

### 6. Set Up Python Virtual Environment

```bash
cd ai-server
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 7. Start All Services

```bash
# From the root directory, start everything:
npm run dev

# Or start individually:
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:5000
npm run dev:ai         # http://localhost:8000
```

### 8. Verify Setup

- Frontend: http://localhost:3000
- Backend health: http://localhost:5000/api/health
- AI Server health: http://localhost:8000/health
- Ollama: http://localhost:11434

## Project Structure

```
slide-reader-ai/
├── client/                          # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Layout.jsx       # Main layout with sidebar
│   │   │   │   ├── Header.jsx       # Top bar with theme toggle
│   │   │   │   └── Sidebar.jsx      # Navigation sidebar
│   │   │   └── ui/
│   │   │       ├── ChatMessage.jsx   # Chat bubble component
│   │   │       ├── ErrorBoundary.jsx # Error boundary fallback
│   │   │       ├── FileUpload.jsx    # Drag-and-drop uploader
│   │   │       ├── LoadingSpinner.jsx
│   │   │       ├── Skeleton.jsx      # Loading skeleton UI
│   │   │       └── VoiceRecorder.jsx # Mic recording component
│   │   ├── context/
│   │   │   ├── AppContext.jsx        # Global app state
│   │   │   ├── AuthContext.jsx       # Authentication state
│   │   │   └── ThemeContext.jsx      # Dark/light mode
│   │   ├── lib/
│   │   │   ├── api.js               # Axios instance with interceptors
│   │   │   └── utils.js             # Helper functions
│   │   ├── pages/
│   │   │   ├── Landing.jsx          # Public landing page
│   │   │   ├── Login.jsx            # Auth: login
│   │   │   ├── Register.jsx         # Auth: register
│   │   │   ├── Dashboard.jsx        # Document management
│   │   │   ├── SlideViewer.jsx      # View slides + auto-read
│   │   │   ├── Chat.jsx             # Chat with document
│   │   │   ├── SummaryQuiz.jsx      # Summary & MCQ quiz
│   │   │   ├── UploadPage.jsx       # File upload page
│   │   │   ├── Settings.jsx         # Theme & accessibility settings
│   │   │   └── NotFound.jsx         # 404 page
│   │   ├── App.jsx                  # Route definitions
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Tailwind + custom styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── server/                          # Node.js Backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                # MongoDB connection
│   │   │   └── multer.js            # File upload config
│   │   ├── controllers/
│   │   │   ├── auth.controller.js   # Register, login, profile
│   │   │   ├── document.controller.js # Upload, CRUD, AI proxy
│   │   │   ├── chat.controller.js   # Chat message handling
│   │   │   └── ai.controller.js     # AI server proxy routes
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js    # JWT verification
│   │   │   ├── error.middleware.js   # Global error handler
│   │   │   └── validate.middleware.js # Request validation
│   │   ├── models/
│   │   │   ├── User.js              # User schema
│   │   │   ├── Document.js          # Document + slides schema
│   │   │   └── Chat.js              # Chat history schema
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── document.routes.js
│   │   │   ├── chat.routes.js
│   │   │   └── ai.routes.js
│   │   └── index.js                 # Express app entry
│   ├── uploads/                     # Uploaded files directory
│   └── package.json
│
├── ai-server/                       # Python AI Server
│   ├── app/
│   │   ├── config.py                # Settings from env vars
│   │   ├── routes/
│   │   │   ├── process.py           # Document extraction + indexing
│   │   │   ├── chat.py              # RAG-based Q&A
│   │   │   ├── query.py             # Vector similarity search
│   │   │   ├── summarize.py         # Structured summarization
│   │   │   ├── mcq.py               # MCQ quiz generation
│   │   │   └── speech.py            # STT + TTS + voice pipeline
│   │   └── services/
│   │       ├── pdf_extractor.py     # PyMuPDF + pytesseract
│   │       ├── ppt_extractor.py     # python-pptx extraction
│   │       ├── ocr_service.py       # Tesseract OCR service
│   │       ├── chunking_service.py  # Text chunking
│   │       ├── embedding_service.py # sentence-transformers + FAISS
│   │       ├── ollama_service.py    # Ollama llama-3 integration
│   │       ├── speech_service.py    # Whisper + gTTS
│   │       └── prompt_templates.py  # LLM prompt engineering
│   ├── faiss_indices/               # Persisted vector indices
│   ├── main.py                      # FastAPI entry point
│   └── requirements.txt
│
├── .env.example                     # Root env template
├── .gitignore
├── package.json                     # Root monorepo scripts
└── README.md
```

## Features

### Document Processing
- **PDF extraction** via PyMuPDF with fallback OCR (pytesseract)
- **PPT/PPTX extraction** via python-pptx (text, tables, notes)
- **Vector indexing** — slide content is embedded and stored in FAISS for semantic search

### Conversational AI (RAG)
- **Retrieval-Augmented Generation**: relevant slide chunks are retrieved from FAISS and injected as context
- **Ollama llama-3**: lightweight LLM that runs on 8GB RAM
- **Context-aware chat**: maintains conversation history

### Summary & Quiz
- **Smart Summarization**: generates structured output — quick overview, detailed explanation, and revision notes
- **MCQ Quiz Generation**: auto-generates 5 multiple-choice questions with instant answer checking and scoring

### Voice Interaction
- **Speech-to-Text**: record questions via microphone → Whisper transcription
- **Text-to-Speech**: listen to AI responses via gTTS
- **Voice pipeline**: speak a question → get a spoken answer (STT → RAG → TTS)
- **Auto-Read Mode**: automatically speaks slide content aloud as you navigate (Web Speech API)

### UI/UX
- **Dark mode** with system preference detection
- **High Contrast mode** for visually impaired users
- **Larger Text mode** with scaled font sizes
- **Accessible**: ARIA labels, focus management, keyboard navigation (arrow keys for slides)
- **Responsive**: mobile-friendly sidebar and layouts
- **Animated**: Framer Motion transitions throughout
- **Error Boundary**: graceful error recovery with fallback UI

## API Reference

### Node.js Backend (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/profile` | Get user profile |
| POST | `/api/documents/upload` | Upload PDF/PPT |
| GET | `/api/documents` | List user documents |
| GET | `/api/documents/:id` | Get document + slides |
| DELETE | `/api/documents/:id` | Delete document |
| GET | `/api/chat/:documentId` | Get chat history |
| POST | `/api/chat/message` | Send chat message |
| POST | `/api/ai/summarize` | Summarize document |
| POST | `/api/ai/generate-mcq` | Generate MCQ quiz |
| POST | `/api/ai/transcribe` | Voice to text |
| POST | `/api/ai/speak` | Text to speech |
| POST | `/api/ai/voice-input` | Voice → RAG → TTS pipeline |
| GET  | `/api/ai/tts-audio/:filename` | Serve TTS audio file |
| POST | `/api/auth/refresh` | Refresh access token |

### Python AI Server (Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/process` | Extract & index document |
| DELETE | `/api/index/:id` | Delete vector index |
| POST | `/api/chat` | RAG-based Q&A |
| POST | `/api/summarize` | Generate structured summary |
| POST | `/api/generate-mcq` | Generate MCQ quiz |
| POST | `/api/transcribe` | Whisper STT |
| POST | `/api/speak` | gTTS TTS |
| POST | `/api/voice-input` | Full voice pipeline (STT→RAG→TTS) |
| GET  | `/api/tts-audio/:filename` | Serve generated audio |

## Performance Notes (8GB RAM)

- **Ollama llama-3**: ~3-4GB RAM usage — leaves room for other services
- **Whisper base model**: ~1GB, loaded lazily on first voice request
- **Embedding model** (all-MiniLM-L6-v2): ~90MB, very lightweight
- **FAISS**: CPU-only variant, memory scales with document count
- Context window set to 2048 tokens to prevent OOM
- Token generation capped at 1024 per response

## Security

- **JWT Authentication** with access + refresh tokens (silent refresh on 401)
- **Helmet** HTTP security headers
- **Rate limiting** on all API routes
- **Input validation** via express-validator on auth, summarize, and MCQ endpoints
- **Protected uploads**: file serving requires valid JWT
- **CORS** configured for frontend origin

## Accessibility

- **WCAG 2.1 AA** target compliance
- **High Contrast mode**: toggle in Settings for increased border/text contrast
- **Larger Text mode**: scales all font sizes by 120%
- **Auto-Read mode**: reads slide content aloud via Web Speech API for visually impaired
- **Keyboard navigation**: arrow keys for slide navigation, keyboard shortcuts for voice recording
- **ARIA attributes**: live regions, roles, labels throughout
- **Focus management**: visible focus indicators with `focus-visible` styles
- **Screen reader support**: semantic HTML, `aria-live` regions for dynamic content

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Ollama not connected | Run `ollama serve` and `ollama pull llama3` |
| OCR not working | Install Tesseract and set `TESSERACT_CMD` path |
| Upload fails | Check `MAX_FILE_SIZE_MB` and MongoDB connection |
| AI responses slow | Normal for CPU inference; try shorter questions |
| Memory issues | Close other apps; llama-3 needs ~3-4GB free |

## License

MIT
