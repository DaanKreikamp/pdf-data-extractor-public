from google import genai
from google.genai import types
from app.core.config import settings
from app.core.system_prompts import PDF_PROMPT, IMAGE_PROMPT, MERGE_PROCESSING_PROMPT
import json
import hashlib
import time
from typing import List, Dict, Any
from app.services.cache_service import cache_service
from .base import BaseAIModel

class GeminiModel(BaseAIModel):
    def __init__(self):
        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )
        # Add basic timeouts to config
        self.config_fast = types.GenerateContentConfig(
            temperature=0.0
        )
        self.config_reasoning = types.GenerateContentConfig(
            temperature=0.2
        )

    @property
    def id(self) -> str:
        return "gemini-pro"

    @property
    def name(self) -> str:
        return "Gemini 2.5 Pro"
    
    @property
    def description(self) -> str:
        return "Google's latest reasoning model. Excellent for multimodal tasks."

    def _get_stable_hash(self, content: str) -> str:
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def _retry_on_overload(self, func, *args, **kwargs):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                error_str = str(e)
                if "503" in error_str or "overloaded" in error_str.lower():
                    if attempt < max_retries - 1:
                        sleep_time = (attempt + 1) * 2
                        print(f"WARN: Model overloaded (503). Retrying in {sleep_time}s... (Attempt {attempt+1}/{max_retries})")
                        time.sleep(sleep_time)
                        continue
                raise e
            except Exception as e:
                 # Catch other transient errors or timeouts if we want, but for now just pass
                 pass
            if attempt == max_retries -1:
                print("WARN: Max retries reached for Gemini request.")

    def process_content(self, content: str, context: str = "") -> str:
        # Bumped to v2 to invalidate old cache after prompt change
        cache_key = f"process_content_v2_{self._get_stable_hash(content + context)}"
        cached_result = cache_service.get(cache_key)
        if cached_result:
            print("DEBUG: Returning cached content summary.")
            return cached_result

        prompt = f"{PDF_PROMPT}\n\nContext: {context}\n\nTask: {content}"
        
        try:
            print(f"DEBUG: Sending request to Gemini (Reasoning Layer)...")
            def call_api():
                return self.client.models.generate_content(
                    model='models/gemini-2.5-pro',
                    contents=prompt,
                    config=self.config_reasoning
                )
            
            response = self._retry_on_overload(call_api)
            result = response.text
            cache_service.set(cache_key, result)
            return result
        except Exception as e:
            print(f"AI Error: {e}")
            return "Kon samenvatting niet genereren."

    def process_image(self, image_path: str, context: str = "", feedback: str = "") -> str:
        file_hash = cache_service.get_file_hash(image_path)
        cache_key = f"process_image_{file_hash}_{self._get_stable_hash(context + feedback)}"
        
        cached_result = cache_service.get(cache_key)
        if cached_result:
            print("DEBUG: Returning cached image analysis.")
            return cached_result

        try:
             file_ref = self.client.files.upload(file=image_path, config={'display_name': 'Screenshot'})
             print(f"DEBUG: File uploaded. URI: {file_ref.uri}, Name: {file_ref.name}")
        except Exception as e:
            print(f"Error uploading image: {e}")
            return "Kon afbeelding niet uploaden."
            
        prompt_parts = [types.Part.from_text(text=IMAGE_PROMPT)]
        
        if context:
            prompt_parts.append(types.Part.from_text(text=f"CONTEXT UIT PDF RAPPORT:\n{context}\n\nGebruik deze context om de juiste bestandsnaam, jaartal en metadata te bepalen."))
            
        if feedback:
             prompt_parts.append(types.Part.from_text(text=f"BELANGRIJK - FEEDBACK VAN GEBRUIKER OP VORIG RESULTAAT:\n{feedback}\n\nPas het resultaat aan op basis van deze feedback."))
             
        prompt_parts.append(types.Part.from_text(text="Zet deze tabel om naar CSV en Metadata."))
        
        prompt_parts.append(types.Part.from_uri(
            file_uri=file_ref.uri,
            mime_type=file_ref.mime_type
        ))

        try:
            print(f"DEBUG: Sending image request to Gemini (Reasoning Layer)...")
            def call_api():
                return self.client.models.generate_content(
                    model='models/gemini-2.5-pro',
                    contents=[types.Content(parts=prompt_parts)],
                    config=self.config_reasoning
                )
            
            response = self._retry_on_overload(call_api)
            result = response.text
            cache_service.set(cache_key, result)
            return result
        except Exception as e:
            import traceback
            err_msg = f"AI Error: {e}\n{traceback.format_exc()}"
            print(err_msg)
            return "Kon afbeelding niet verwerken."

    def extract_table_coordinates(self, image_path: str) -> List[Dict[str, Any]]:
        file_hash = cache_service.get_file_hash(image_path)
        cache_key = f"coords_{file_hash}"
        
        cached_result = cache_service.get(cache_key)
        if cached_result is not None:
             return cached_result

        try:
             file_ref = self.client.files.upload(file=image_path, config={'display_name': 'Page Image'})
        except Exception as e:
            print(f"Error uploading image for coords: {e}")
            return []
            
        prompt = """
        Analyze this page image from an annual report. Identify all **financial tables** (balance sheets, profit/loss, cash flow, key figures) and **meaningful figures** (charts, graphs, diagrams showing data).
        Ignore tiny tables and decorative elements.
        Return ONLY a JSON array of objects with keys: "type", "box_2d" [ymin, xmin, ymax, xmax], and "label".
        """
        
        try:
            def call_api():
                return self.client.models.generate_content(
                    model='models/gemini-2.5-flash',
                    contents=[
                        types.Content(parts=[
                            types.Part.from_text(text=prompt),
                            types.Part.from_uri(
                                file_uri=file_ref.uri,
                                mime_type=file_ref.mime_type
                            )
                        ])
                    ],
                    config=self.config_fast
                )
            
            response = self._retry_on_overload(call_api)
            
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
                
            result = json.loads(text)
            cache_service.set(cache_key, result)
            return result
        except Exception as e:
            print(f"AI Error (Coordinates): {e}")
            return []

    def process_multiple_images(self, images: List[Dict[str, str]], user_prompt: str = "", context: str = "") -> str:
        prompt_parts = []
        prompt_parts.append(types.Part.from_text(text=MERGE_PROCESSING_PROMPT))
        
        if context:
            prompt_parts.append(types.Part.from_text(text=f"\n\nPDF CONTEXT INFORMATIE:\n{context}\n\nGebruik bovenstaande context."))

        if user_prompt:
             prompt_parts.append(types.Part.from_text(text=f"\n\nEXTRA GEBRUIKERSINSTRUCTIE:\n{user_prompt}\n"))
        
        label_text = "\nLabels van de afbeeldingen:\n"
        for img in images:
            label_text += f"- Label: {img['label']}\n"
        prompt_parts.append(types.Part.from_text(text=label_text))
        
        if not images:
             return "Geen afbeeldingen."

        for i, img in enumerate(images):
            try:
                file_ref = self.client.files.upload(file=img['path'], config={'display_name': img.get('label', 'Image')})
                prompt_parts.append(types.Part.from_uri(
                    file_uri=file_ref.uri,
                    mime_type=file_ref.mime_type
                ))
            except Exception as e:
                print(f"Error uploading file {img['path']}: {e}")
                continue
            
        try:
            def call_api():
                return self.client.models.generate_content(
                    model='models/gemini-2.5-pro',
                    contents=[types.Content(parts=prompt_parts)],
                    config=self.config_reasoning
                )
            
            response = self._retry_on_overload(call_api)
            return response.text
        except Exception as e:
            print(f"AI Error (Multi-Image): {e}")
            return "Kon afbeeldingen niet verwerken."
