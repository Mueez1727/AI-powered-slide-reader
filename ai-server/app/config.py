"""
Configuration settings loaded from environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ai_port: int = 8000
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2:1.5b"
    embedding_model: str = "nomic-embed-text"
    whisper_model: str = "base"
    faiss_index_dir: str = "./faiss_indices"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
