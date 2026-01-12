from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseAIModel(ABC):
    @property
    @abstractmethod
    def id(self) -> str:
        """Unique identifier for the model."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Display name for the model."""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Description of the model."""
        pass

    @property
    def is_available(self) -> bool:
        """Check if the model is available (e.g. API keys configured)."""
        return True

    @abstractmethod
    def process_content(self, content: str, context: str = "") -> str:
        """Process text content."""
        pass

    @abstractmethod
    def process_image(self, image_path: str, context: str = "", feedback: str = "") -> str:
        """Process a single image."""
        pass
    
    @abstractmethod
    def process_multiple_images(self, images: List[Dict[str, str]], user_prompt: str = "", context: str = "") -> str:
        """Process multiple images together."""
        pass
    
    @abstractmethod
    def extract_table_coordinates(self, image_path: str) -> List[Dict[str, Any]]:
        """Extract table coordinates from an image."""
        pass
