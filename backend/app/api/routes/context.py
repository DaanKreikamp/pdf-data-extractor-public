from fastapi import APIRouter, HTTPException, Body
from app.services.context_service import context_service
from pydantic import BaseModel

router = APIRouter()

class ContextUpdate(BaseModel):
    text: str

@router.get("/")
async def get_context():
    return context_service.get_context()

@router.post("/")
async def update_context(update: ContextUpdate):
    """Manual update of the global context."""
    context_service.set_context(update.text, context_service.get_summary())
    return {"message": "Context updated"}

@router.delete("/")
async def reset_context():
    """Clear all global context."""
    context_service.clear_context()
    return {"message": "Context cleared"}

@router.delete("/{filename}")
async def remove_context_file(filename: str):
    """Remove context for a specific file."""
    context_service.remove_context(filename)
    return {"message": f"Context for {filename} removed"}
