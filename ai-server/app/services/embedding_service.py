"""
Embedding service using Ollama embeddings and FAISS for vector storage.

Uses the nomic-embed-text model served by Ollama for generating embeddings,
paired with FAISS IndexFlatIP for cosine similarity search.

Responsibilities:
  - Encode text chunks into dense vectors via Ollama /api/embeddings
  - Build / persist / reload FAISS indices (one per document)
  - Similarity search for the RAG pipeline
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import faiss
import httpx
import numpy as np

from app.config import settings

# FAISS SWIG bindings have broken type stubs — IndexFlatIP(d) works at
# runtime but Pylance/Pylint reject the call because the stubs declare
# a SWIG-internal parameter.  Fetching via getattr() returns Any, which
# both type checkers accept with any arguments.
_IndexFlatIP: Any = getattr(faiss, "IndexFlatIP")

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Manages text embeddings and FAISS vector indices."""

    def __init__(self) -> None:
        self.model_name: str = settings.embedding_model
        self.base_url: str = settings.ollama_base_url.rstrip("/")
        self.dimension: int = 0
        self.indices: dict[str, dict] = {}  # doc_id -> {index, texts, metadata}
        self.index_dir: str = settings.faiss_index_dir
        os.makedirs(self.index_dir, exist_ok=True)

        # Probe embedding dimension
        logger.info("Initializing Ollama embedding model: %s ...", self.model_name)
        try:
            test_vec = self.embed_text("hello")
            self.dimension = len(test_vec)
            logger.info(
                "Embedding model ready: %s (dimension=%d)",
                self.model_name,
                self.dimension,
            )
        except Exception as exc:
            logger.error("Failed to initialize embedding model: %s", exc)
            self.dimension = 768  # fallback for nomic-embed-text

    # ─────────────────────────────────────────
    # Ollama embedding calls
    # ─────────────────────────────────────────

    def embed_text(self, text: str) -> np.ndarray:
        """
        Embed a single text string via Ollama /api/embeddings.

        Returns a normalized float32 numpy vector.
        """
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model_name, "prompt": text},
            )
            resp.raise_for_status()
            data = resp.json()

        vec = np.array(data["embedding"], dtype=np.float32)

        # Normalize vector (cosine similarity)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        return vec

    def embed_texts(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        """
        Embed multiple texts.

        Returns (N, D) numpy matrix.
        """
        all_vecs: list[np.ndarray] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]

            for text in batch:
                try:
                    vec = self.embed_text(text)
                    all_vecs.append(vec)
                except Exception as exc:
                    logger.warning(
                        "Embedding failed for text (len=%d): %s",
                        len(text),
                        exc,
                    )

                    if self.dimension > 0:
                        all_vecs.append(
                            np.zeros(self.dimension, dtype=np.float32)
                        )

            logger.debug(
                "Embedded %d/%d texts",
                min(i + batch_size, len(texts)),
                len(texts),
            )

        if not all_vecs:
            return np.empty((0, self.dimension), dtype=np.float32)

        return np.vstack(all_vecs).astype(np.float32)

    # ─────────────────────────────────────────
    # Index lifecycle
    # ─────────────────────────────────────────

    def create_index(self, document_id: str, chunks: list[dict]) -> str:
        """
        Create FAISS index for document chunks.
        """

        texts = [c["text"] for c in chunks if c.get("text", "").strip()]
        metadata = [c.get("metadata", {}) for c in chunks if c.get("text", "").strip()]

        if not texts:
            logger.warning(
                "No text found for document %s — skipping index.",
                document_id,
            )
            return document_id

        embeddings_np = self.embed_texts(texts)

        if embeddings_np.shape[0] == 0:
            logger.warning("All embeddings failed for document %s", document_id)
            return document_id

        # Update dimension from embeddings
        self.dimension = int(embeddings_np.shape[1])

        # Create cosine similarity FAISS index
        # _IndexFlatIP is fetched via getattr() at module level to bypass
        # broken SWIG type stubs that cause false Pylint/Pylance errors.
        index = _IndexFlatIP(self.dimension)

        # Add vectors to index (must be float32 for FAISS)
        vectors = np.asarray(embeddings_np, dtype=np.float32)
        index.add(vectors)

        # Cache in memory
        self.indices[document_id] = {
            "index": index,
            "texts": texts,
            "metadata": metadata,
        }

        # Save to disk
        self._save_to_disk(document_id, index, texts, metadata)

        logger.info(
            "Created FAISS index for %s — %d vectors (%d dims)",
            document_id,
            index.ntotal,
            self.dimension,
        )

        return document_id

    def delete_index(self, document_id: str) -> None:
        """Remove document index."""
        self.indices.pop(document_id, None)

        for ext in [".faiss", ".texts.npy", ".meta.json"]:
            path = os.path.join(self.index_dir, f"{document_id}{ext}")
            if os.path.exists(path):
                os.remove(path)

        logger.info("Deleted index for %s", document_id)

    # ─────────────────────────────────────────
    # Search
    # ─────────────────────────────────────────

    def search(self, document_id: str, query: str, top_k: int = 5) -> list[dict]:
        """
        Retrieve relevant chunks using cosine similarity.
        """

        self._ensure_loaded(document_id)

        entry = self.indices.get(document_id)
        if not entry:
            return []

        query_vec = self.embed_text(query).reshape(1, -1).astype(np.float32)

        k = min(top_k, entry["index"].ntotal)

        if k == 0:
            return []

        scores, idx_array = entry["index"].search(query_vec, k)

        results: list[dict] = []

        for score, idx in zip(scores[0], idx_array[0]):
            if 0 <= idx < len(entry["texts"]):
                results.append(
                    {
                        "text": entry["texts"][idx],
                        "score": round(float(score), 4),
                        "metadata": (
                            entry["metadata"][idx]
                            if idx < len(entry["metadata"])
                            else {}
                        ),
                    }
                )

        return results

    # ─────────────────────────────────────────
    # Utilities
    # ─────────────────────────────────────────

    def get_index_stats(self, document_id: str) -> Optional[dict]:
        """Return index statistics."""
        self._ensure_loaded(document_id)

        entry = self.indices.get(document_id)

        if not entry:
            return None

        return {
            "document_id": document_id,
            "total_vectors": entry["index"].ntotal,
            "dimension": self.dimension,
            "total_chunks": len(entry["texts"]),
        }

    # ─────────────────────────────────────────
    # Persistence
    # ─────────────────────────────────────────

    def _save_to_disk(
        self,
        document_id: str,
        index: object,
        texts: list[str],
        metadata: list[dict],
    ) -> None:

        base = os.path.join(self.index_dir, document_id)

        faiss.write_index(index, f"{base}.faiss")

        np.save(
            f"{base}.texts.npy",
            np.array(texts, dtype=object),
        )

        with open(f"{base}.meta.json", "w", encoding="utf-8") as fh:
            json.dump(metadata, fh, ensure_ascii=False)

    def _load_from_disk(self, document_id: str) -> bool:
        """Load index from disk."""

        base = os.path.join(self.index_dir, document_id)

        index_path = f"{base}.faiss"
        texts_path = f"{base}.texts.npy"
        meta_path = f"{base}.meta.json"

        if not (os.path.exists(index_path) and os.path.exists(texts_path)):
            return False

        index = faiss.read_index(index_path)

        texts = np.load(texts_path, allow_pickle=True).tolist()

        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as fh:
                metadata = json.load(fh)
        else:
            metadata = [{} for _ in texts]

        self.indices[document_id] = {
            "index": index,
            "texts": texts,
            "metadata": metadata,
        }

        self.dimension = index.d

        logger.info(
            "Loaded index from disk for %s (%d vectors)",
            document_id,
            index.ntotal,
        )

        return True

    def _ensure_loaded(self, document_id: str) -> None:
        """Ensure index is loaded into memory."""

        if document_id not in self.indices:
            self._load_from_disk(document_id)
