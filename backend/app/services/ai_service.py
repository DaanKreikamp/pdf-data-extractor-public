from typing import List, Dict, Any
from app.services.model_factory import model_factory
from fastapi import HTTPException

class AIService:
    def __init__(self):
        self.current_model = model_factory.get_default_model()
        if not self.current_model:
             raise Exception("No default model available")

    def get_available_models(self) -> List[Dict[str, Any]]:
        """
        Return list of available models with metadata.
        """
        models = []
        for model in model_factory.get_all_models():
            models.append({
                "id": model.id,
                "name": model.name,
                "description": model.description,
                "is_available": model.is_available,
                "is_active": model.id == self.current_model.id
            })
        return models

    def set_active_model(self, model_id: str) -> bool:
        """
        Switch the active model.
        """
        model = model_factory.get_model(model_id)
        if model: # Allow switching even if not available (to show error later) or check availability here? 
            # Ideally we check availability but user said "Adding a button and getting a message ‘model is not available...’ is also fine"
            # But swapping to a None-key model globally might break things for everyone. 
            # For now, allow switching.
            self.current_model = model
            return True
        return False

    def process_content(self, content: str, context: str = "") -> str:
        """
        Process text content using the active model.
        """
        return self.current_model.process_content(content, context)

    def process_image(self, image_path: str, context: str = "", feedback: str = "") -> str:
        """
        Process an image (screenshot) using the active model.
        """
        return self.current_model.process_image(image_path, context, feedback)

    def process_multiple_images(self, images: list[dict], user_prompt: str = "", feedback: str = "", context: str = "") -> str:
        """
        Process multiple images together using the active model.
        """
        # Note: 'user_prompt' vs 'feedback' argument naming alignment
        prompt = user_prompt or feedback
        return self.current_model.process_multiple_images(images, user_prompt=prompt, context=context)
    
    def extract_table_coordinates(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Extract coordinates using the active model (or delegate if model doesn't support it).
        """
        return self.current_model.extract_table_coordinates(image_path)

ai_service = AIService()
