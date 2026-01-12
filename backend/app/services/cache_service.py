import json
import hashlib
import os
from pathlib import Path
from typing import Any, Optional
from app.core.config import settings

class CacheService:
    def __init__(self):
        self.cache_dir = Path(settings.DATA_DIR) / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, key: str) -> Path:
        hashed_key = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed_key}.json"

    def get(self, key: str) -> Optional[Any]:
        cache_path = self._get_cache_path(key)
        if cache_path.exists():
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"WARN: Failed to read cache for key {key}: {e}")
                return None
        return None

    def set(self, key: str, data: Any):
        cache_path = self._get_cache_path(key)
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"WARN: Failed to write cache for key {key}: {e}")

    def get_file_hash(self, file_path: str) -> str:
        """Helper to hash a file's content to use as a cache key."""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            buf = f.read()
            hasher.update(buf)
        return hasher.hexdigest()

cache_service = CacheService()
