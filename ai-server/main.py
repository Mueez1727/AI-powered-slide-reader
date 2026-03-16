"""
Multimodal AI-Powered Slide Reader - AI Server
Main FastAPI application entry point.
"""

import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

# Configure logging so all services emit INFO-level messages
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import process, chat, summarize, speech, query, mcq
from app.services.embedding_service import EmbeddingService
from app.services.ollama_service import OllamaService


@asynccontextmanager
async def lifespan(app: FastAPI):  # pylint: disable=redefined-outer-name
    """Initialize services on startup, cleanup on shutdown."""
    print("🚀 Starting AI Server...")

    # Initialize embedding model (loads into memory once)
    embedding_service = EmbeddingService()
    app.state.embedding_service = embedding_service
    print(f"✅ Embedding model loaded: {os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')}")

    # Initialize Ollama client (async httpx)
    ollama_service = OllamaService()
    app.state.ollama_service = ollama_service
    is_available = await ollama_service.health_check()
    if is_available:
        print(f"✅ Ollama connected with model: {ollama_service.model}")
    else:
        print("⚠️  Ollama is not available. Chat and summarization will fail.")

    # Ensure FAISS index directory exists
    index_dir = os.getenv("FAISS_INDEX_DIR", "./faiss_indices")
    os.makedirs(index_dir, exist_ok=True)

    yield

    # Graceful shutdown
    await ollama_service.close()
    print("🛑 Shutting down AI Server...")


app = FastAPI(
    title="Slide Reader AI Server",
    description="AI processing server for document extraction, embeddings, chat, and speech",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-server"}


# Register routers
app.include_router(process.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(summarize.router, prefix="/api")
app.include_router(mcq.router, prefix="/api")
app.include_router(speech.router, prefix="/api")
