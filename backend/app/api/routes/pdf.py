from fastapi import APIRouter, UploadFile, File, HTTPException, Body, BackgroundTasks, Form
from app.services.pdf_service import pdf_service
from app.services.image_service import image_service
import shutil
from pathlib import Path
from app.core.config import settings
import json
import uuid

router = APIRouter()

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...), mode: str = Form("content")):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        contents = await file.read()
        
        # Save to input directory
        input_dir = Path(settings.DATA_DIR) / "input"
        input_dir.mkdir(parents=True, exist_ok=True)
        file_path = input_dir / file.filename
        
        from starlette.concurrency import run_in_threadpool
        
        def save_file(path, content):
            with open(path, "wb") as f:
                f.write(content)
                
        await run_in_threadpool(save_file, file_path, contents)
            
        # Process with AI in background
        print(f"DEBUG: Starting background processing for {file.filename} (Mode: {mode})...")
        extract_images = (mode == 'content')
        background_tasks.add_task(pdf_service.process_pdf_upload, contents, file.filename, extract_images=extract_images)
        
        return {
            "filename": file.filename,
            "message": "PDF uploaded. Processing started.",
            "status": "processing"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{filename}")
async def get_pdf_status(filename: str):
    """
    Get processing status of a PDF.
    """
    return pdf_service.get_progress(filename)

@router.get("/proposed/{filename}")
async def get_proposed_screenshots(filename: str):
    """
    Get list of proposed screenshots for a PDF.
    """
    try:
        proposed_dir = Path(settings.DATA_DIR) / "proposed" / filename
        metadata_path = proposed_dir / "metadata.json"
        
        if not metadata_path.exists():
            return []
            
        with open(metadata_path, "r") as f:
            data = json.load(f)
            
        # Verify files exist
        valid_data = []
        for item in data:
            image_path = proposed_dir / item.get("filename", "")
            if image_path.exists():
                valid_data.append(item)
                
        return valid_data
    except Exception as e:
        print(f"Error fetching proposed screenshots: {e}")
        return []

from pydantic import BaseModel

class AcceptRequest(BaseModel):
    filename: str # PDF filename
    image_filename: str # Image filename in proposed dir

@router.post("/proposed/accept")
async def accept_proposed_screenshot(request: AcceptRequest):
    """
    Accept a proposed screenshot and process it as if it was uploaded.
    """
    try:
        proposed_dir = Path(settings.DATA_DIR) / "proposed" / request.filename
        image_path = proposed_dir / request.image_filename
        
        if not image_path.exists():
            print(f"DEBUG: Proposed image not found at {image_path}")
            print(f"DEBUG: request.filename={request.filename}, request.image_filename={request.image_filename}")
            raise HTTPException(status_code=404, detail=f"Proposed image not found at {image_path}")
            
        # Copy to input directory with unique name
        input_dir = Path(settings.DATA_DIR) / "input"
        input_dir.mkdir(parents=True, exist_ok=True)
        
        ext = image_path.suffix
        unique_filename = f"{uuid.uuid4()}{ext}"
        target_path = input_dir / unique_filename
        
        shutil.copy2(image_path, target_path)
        
        # Read content for processing
        with open(target_path, "rb") as f:
            content = f.read()
            
        # Process with ImageService
        # We use the original PDF filename as "original_filename" context, or the image filename?
        # Let's use the image filename but maybe prepend PDF name for clarity in UI
        original_name = f"{request.filename}_{request.image_filename}"
        
        # Determine media type
        media_type = "image/png" # We save as PNG
        
        result = image_service.process_image_upload(content, media_type, original_name, unique_filename)
        
        return {
            "message": "Screenshot accepted and processed",
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_history():
    """List previously processed PDFs."""
    try:
        proposed_dir = Path(settings.DATA_DIR) / "proposed"
        if not proposed_dir.exists():
            return []
        
        # List directories
        projects = []
        for item in proposed_dir.iterdir():
            if item.is_dir():
                # Check for info.json to get details
                info_path = item / "info.json"
                info = {}
                if info_path.exists():
                    try:
                        with open(info_path, "r") as f:
                            info = json.load(f)
                    except:
                        pass
                
                projects.append({
                    "filename": item.name,
                    "summary": info.get("summary", ""),
                    # Could add modification time
                    "last_modified": item.stat().st_mtime
                })
        
        # Sort by last modified desc
        projects.sort(key=lambda x: x["last_modified"], reverse=True)
        return projects
    except Exception as e:
        print(f"Error fetching history: {e}")
        return []

@router.post("/load/{filename}")
async def load_history(filename: str):
    """Load a previously processed PDF."""
    result = pdf_service.load_existing(filename)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "message": "Project loaded",
        "summary": result.get("summary", "")
    }

@router.post("/extract/{filename}")
async def extract_images(filename: str, background_tasks: BackgroundTasks):
    """
    Trigger image extraction for an already uploaded PDF.
    """
    input_dir = Path(settings.DATA_DIR) / "input"
    file_path = input_dir / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found")
        
    try:
        with open(file_path, "rb") as f:
            content = f.read()
            
        print(f"DEBUG: Starting post-hoc image extraction for {filename}...")
        background_tasks.add_task(pdf_service.extract_images_delayed, content, filename)
        
        return {"message": "Image extraction started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
