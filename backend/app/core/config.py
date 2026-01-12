from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GEMINI_API_KEY: str
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DATA_DIR: str = r"C:\Users\daank\.gemini\antigravity\scratch\pdf-data-extractor\data"

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra fields in .env

settings = Settings()
