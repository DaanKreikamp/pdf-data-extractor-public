import json
from pathlib import Path
from app.core.config import settings

class SettingsService:
    def __init__(self):
        self.settings_file = Path(settings.DATA_DIR) / "settings.json"
        self._ensure_settings_file()

    def _ensure_settings_file(self):
        if not self.settings_file.exists():
            default_settings = {
                "output_folder": str(Path(settings.DATA_DIR) / "final_output")
            }
            self.save_settings(default_settings)

    def get_settings(self):
        with open(self.settings_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_settings(self, new_settings: dict):
        with open(self.settings_file, "w", encoding="utf-8") as f:
            json.dump(new_settings, f, indent=2)
        return new_settings

    def update_setting(self, key: str, value: any):
        current_settings = self.get_settings()
        current_settings[key] = value
        self.save_settings(current_settings)
        return current_settings

settings_service = SettingsService()
