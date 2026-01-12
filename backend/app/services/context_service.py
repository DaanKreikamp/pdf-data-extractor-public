import json
from pathlib import Path
from app.core.config import settings

class ContextService:
    def __init__(self):
        # Dictionary to store context per file: {filename: context_text}
        self._contexts = {} 
        self._summary = "" # Optional overall summary
        self.context_file = Path(settings.DATA_DIR) / "global_context.json"
        self._load_from_disk()

    def _load_from_disk(self):
        try:
            if self.context_file.exists():
                with open(self.context_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Handle migration from old format
                    if "contexts" in data:
                        self._contexts = data.get("contexts", {})
                    else:
                        # Legacy format fallback (or just reset)
                        old_ctx = data.get("context", "")
                        if old_ctx:
                             self._contexts = {"legacy_context": old_ctx}
                        else:
                             self._contexts = {}
                        
                    self._summary = data.get("summary", "")
        except Exception as e:
            print(f"WARN: Failed to load global context: {e}")
            self._contexts = {}

    def _save_to_disk(self):
        try:
            self.context_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.context_file, "w", encoding="utf-8") as f:
                json.dump({
                    "contexts": self._contexts,
                    "summary": self._summary
                }, f, indent=2)
        except Exception as e:
            print(f"WARN: Failed to save global context: {e}")

    def update_context(self, filename: str, text: str):
        """Update or add context for a specific file."""
        # If we are adding a normal file context (not a manual override),
        # we should clear any existing manual override to switch back to 'file mode'.
        if filename != "manual_override":
            self._contexts.pop("manual_override", None)
            
        self._contexts[filename] = text
        self._save_to_disk()

    def remove_context(self, filename: str):
        if filename in self._contexts:
            del self._contexts[filename]
            self._save_to_disk()

    # Deprecated / Backward Compatibility
    def set_context(self, text: str, summary: str = ""):
        # If the user manually updates the context, we treat it as an override.
        # We clear the file-specific contexts to prevent duplication (e.g. File A + Manual copy of File A)
        # and store the entire manual text as a single entry.
        self._contexts = {"manual_override": text}
        if summary:
            self._summary = summary
        self._save_to_disk()

    def append_context(self, text: str, summary: str = ""):
        # This is tricky with the new model. 
        # If we don't have a filename, we append to a generic "appended" key or just fail.
        # But pdf_service calls this. We will update pdf_service to use update_context.
        # For compatibility:
        import uuid
        key = f"appended_{uuid.uuid4().hex[:8]}"
        self.update_context(key, text)

    def get_context(self) -> dict:
        # Concatenate all contexts with headers
        combined_context = ""
        for filename, text in self._contexts.items():
            combined_context += f"--- CONTEXT: {filename} ---\n{text}\n\n"
        
        return {
            "context": combined_context.strip(),
            "summary": self._summary
        }

    def get_summary(self) -> str:
        return self._summary

    def clear_context(self):
        self._contexts = {}
        self._summary = ""
        self._save_to_disk()

context_service = ContextService()
