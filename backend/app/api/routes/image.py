from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.image_service import image_service
from pathlib import Path
from app.core.config import settings
import uuid

router = APIRouter()

@router.post("/upload")
async def upload_image(file: UploadFile = File(...), process: bool = True):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        contents = await file.read()
        
        # Save to input directory with unique name to avoid collisions
        input_dir = Path(settings.DATA_DIR) / "input"
        input_dir.mkdir(parents=True, exist_ok=True)
        
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = input_dir / unique_filename
        
        with open(file_path, "wb") as f:
            f.write(contents)
            
        if process:
            # Process with AI
            result = image_service.process_image_upload(contents, file.content_type, file.filename, unique_filename)
            
            return {
                "filename": file.filename,
                "stored_filename": unique_filename,
                "result": result,
                "message": "Image processed successfully"
            }
        else:
            return {
                "filename": file.filename,
                "stored_filename": unique_filename,
                "message": "Image uploaded successfully"
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel

class RedoRequest(BaseModel):
    feedback: str

@router.post("/redo/{staging_id}")
async def redo_image(staging_id: str, request: RedoRequest):
    try:
        result = image_service.redo_image(staging_id, request.feedback)
        return {"message": "Image re-processed successfully", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
