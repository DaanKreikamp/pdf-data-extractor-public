from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import FileResponse
from app.services.utils_service import utils_service
from app.services.context_service import context_service
import os
import urllib.parse

router = APIRouter()

@router.get("/browse-folder")
async def browse_folder():
    path = utils_service.browse_folder()
    return {"path": path}

@router.get("/list-images")
async def list_images(path: str):
    result = utils_service.list_images(path)
    if "error" in result:
        # Check if it's just empty/no path
        if result["error"] == "Path does not exist" and path == "":
             return {"images": []}
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Add preview_url to each image
    for img in result["images"]:
        encoded_path = urllib.parse.quote(img["path"])
        img["preview_url"] = f"/api/utils/view-image?path={encoded_path}"
        
    return result

@router.get("/view-image")
async def view_image(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)

@router.get("/context")
async def get_context():
    """Get global context."""
    return context_service.get_context()

@router.post("/context")
async def update_context(data: dict = Body(...)):
    """Update global context."""
    context = data.get("context", "")
    summary = data.get("summary", "") # Optional update
    context_service.set_context(context, summary if summary else None)
    return {"status": "success", "context": context}
