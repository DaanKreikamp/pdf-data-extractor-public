from fastapi import APIRouter, Body
from app.services.settings_service import settings_service
from pydantic import BaseModel

router = APIRouter()

class SettingsUpdate(BaseModel):
    output_folder: str

@router.get("/")
async def get_settings():
    return settings_service.get_settings()

@router.post("/")
async def update_settings(settings: SettingsUpdate):
    return settings_service.save_settings(settings.dict())
