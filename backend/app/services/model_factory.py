from typing import List, Optional, Dict
from app.services.models.base import BaseAIModel
from app.services.models.gemini import GeminiModel
from app.services.models.openai import OpenAIModel
from app.services.models.claude import ClaudeModel

class ModelFactory:
    def __init__(self):
        self._models: Dict[str, BaseAIModel] = {}
        self._register_models()
        
    def _register_models(self):
        # Instantiate and register all available models
        models = [GeminiModel(), OpenAIModel(), ClaudeModel()]
        for model in models:
            self._models[model.id] = model
            
    def get_model(self, model_id: str) -> Optional[BaseAIModel]:
        return self._models.get(model_id)
        
    def get_all_models(self) -> List[BaseAIModel]:
        return list(self._models.values())
    
    def get_default_model(self) -> BaseAIModel:
        # Default to Gemini
        return self._models.get("gemini-pro")

model_factory = ModelFactory()
