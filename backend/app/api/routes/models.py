from fastapi import APIRouter, HTTPException, Body
from app.services.ai_service import ai_service
from pydantic import BaseModel

router = APIRouter()

class ModelSelection(BaseModel):
    model_id: str

@router.get("/")
async def get_models():
    """List available AI models."""
    return ai_service.get_available_models()

@router.post("/active")
async def set_active_model(selection: ModelSelection):
    """Set the active reasoning model."""
    success = ai_service.set_active_model(selection.model_id)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid model ID")
    return {"message": f"Active model set to {selection.model_id}"}
