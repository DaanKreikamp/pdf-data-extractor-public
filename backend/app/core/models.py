from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field
import os
from abc import ABC, abstractmethod

class ModelProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"

class ModelCapability(str, Enum):
    FAST = "fast"          # For low latency tasks (coordinates, quick scans)
    REASONING = "reasoning" # For heavy lifting (data extraction, analysis)
    VISION = "vision"       # Supports image input

class AIModel(BaseModel):
    id: str
    name: str
    provider: ModelProvider
    capabilities: List[ModelCapability]
    is_active: bool = False
    api_key_env_var: str # Name of the ENV var that holds the key

    @property
    def api_key(self) -> Optional[str]:
        return os.getenv(self.api_key_env_var)

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    def generate_content(self, prompt: str, context: str = "", model_id: str = None, **kwargs) -> str:
        pass

    @abstractmethod
    def process_image(self, image_path: str, prompt: str, context: str = "", model_id: str = None, **kwargs) -> str:
        """Process a single image."""
        pass
        
    @abstractmethod
    def process_multiple_images(self, images: List[Dict[str, str]], prompt: str, context: str = "", model_id: str = None, **kwargs) -> str:
        """Process multiple images with labels/paths."""
        pass

# Default Configuration for our application
TYPE_MAPPING = {
    "gemini": ModelProvider.GEMINI,
    "openai": ModelProvider.OPENAI,
    "anthropic": ModelProvider.ANTHROPIC
}

# Define available models (Hardcoded for now, could be dynamic later)
AVAILABLE_MODELS = [
    AIModel(
        id="gemini-2.5-pro",
        name="Gemini 2.5 Pro (Active)",
        provider=ModelProvider.GEMINI,
        capabilities=[ModelCapability.REASONING, ModelCapability.VISION, ModelCapability.FAST],
        api_key_env_var="GEMINI_API_KEY",
        is_active=True
    ),
    AIModel(
        id="gemini-3-pro-preview",
        name="Gemini 3 Pro (Preview)",
        provider=ModelProvider.GEMINI,
        capabilities=[ModelCapability.REASONING, ModelCapability.VISION],
        api_key_env_var="GEMINI_API_KEY"
    ),
    AIModel(
        id="gpt-5.2-turbo",
        name="GPT-5.2 Turbo (Placeholder)",
        provider=ModelProvider.OPENAI,
        capabilities=[ModelCapability.REASONING, ModelCapability.VISION],
        api_key_env_var="OPENAI_API_KEY"
    ),
    AIModel(
        id="claude-opus-4.5",
        name="Claude Opus 4.5 (Placeholder)",
        provider=ModelProvider.ANTHROPIC,
        capabilities=[ModelCapability.REASONING, ModelCapability.VISION],
        api_key_env_var="ANTHROPIC_API_KEY"
    )
]

class ModelFactory:
    _instances: Dict[str, Any] = {}
    _active_reasoning_model_id: str = "gemini-2.5-pro"
    
    @classmethod
    def get_available_models(cls) -> List[AIModel]:
        return AVAILABLE_MODELS
    
    @classmethod
    def set_active_model(cls, model_id: str):
        # Validate existence
        if any(m.id == model_id for m in AVAILABLE_MODELS):
            cls._active_reasoning_model_id = model_id
            print(f"ModelFactory: Switched active reasoning model to {model_id}")
            return True
        return False
        
    @classmethod
    def get_active_model_id(cls) -> str:
        return cls._active_reasoning_model_id
        
    @classmethod
    def get_active_model(cls) -> AIModel:
        return next((m for m in AVAILABLE_MODELS if m.id == cls._active_reasoning_model_id), AVAILABLE_MODELS[0])

    @classmethod
    def get_api_key(cls, model_id: str) -> Optional[str]:
        model = next((m for m in AVAILABLE_MODELS if m.id == model_id), None)
        if model:
            return model.api_key
        return None
