from typing import List, Dict, Any
from app.core.config import settings
from .base import BaseAIModel

class ClaudeModel(BaseAIModel):
    def __init__(self):
        self._api_key = settings.ANTHROPIC_API_KEY
        
    @property
    def id(self) -> str:
        return "claude-sonnet"

    @property
    def name(self) -> str:
        return "Claude 3.5 Sonnet"
    
    @property
    def description(self) -> str:
        return "Anthropic's most intelligent model."

    @property
    def is_available(self) -> bool:
        return bool(self._api_key)

    def process_content(self, content: str, context: str = "") -> str:
        if not self.is_available:
            return "Claude model not configured."
        return "[MOCK] Processed by Claude."

    def process_image(self, image_path: str, context: str = "", feedback: str = "") -> str:
        if not self.is_available:
            return "Claude model not configured."
        return "[MOCK] Image processed by Claude."
    
    def process_multiple_images(self, images: List[Dict[str, str]], user_prompt: str = "", context: str = "") -> str:
        if not self.is_available:
            return "Claude model not configured."
        return "[MOCK] Multi-images processed by Claude."

    def extract_table_coordinates(self, image_path: str) -> List[Dict[str, Any]]:
        return []
