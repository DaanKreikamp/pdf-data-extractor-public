from fastapi import APIRouter, HTTPException
from app.services.merge_service import merge_service
from pydantic import BaseModel

router = APIRouter()

class MergeExecuteRequest(BaseModel):
    target_filename: str

class ImageItem(BaseModel):
    filename: str
    label: str = ""
    type: str = ""
    pdf_name: str = None
    page: int = 0
    stored_filename: str = None
    full_path: str = None
    path: str = None # Add alias or specific field for local path

class SuggestImagesRequest(BaseModel):
    items: list[ImageItem]
    user_prompt: str = ""

@router.post("/suggest-images")
async def suggest_image_merges(request: SuggestImagesRequest):
    return merge_service.suggest_image_merges([item.dict() for item in request.items])

@router.post("/execute-group")
async def execute_merge_group(request: SuggestImagesRequest):
    try:
        from app.services.image_service import image_service
        # Convert ImageItem to the dict format expected by process_images
        items = [item.dict() for item in request.items]
        print(f"DEBUG: execute_merge_group received items: {items}, prompt: {request.user_prompt}")
        return image_service.process_images(items, user_prompt=request.user_prompt)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/suggestions")
async def get_merge_suggestions():
    return merge_service.suggest_merges()

@router.get("/check/{staging_id}")
async def check_merge_candidates(staging_id: str):
    candidates = merge_service.find_similar_datasets(staging_id)
    return {"candidates": candidates}

@router.post("/execute/{staging_id}")
async def execute_merge(staging_id: str, request: MergeExecuteRequest):
    try:
        result = merge_service.merge_datasets(staging_id, request.target_filename)
        return {"message": "Merge successful", "details": result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
class MergePreviewRequest(BaseModel):
    item_ids: list[str]

@router.post("/preview")
async def preview_merge(request: MergePreviewRequest):
    try:
        result = merge_service.preview_merge_items(request.item_ids)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MergeSaveRequest(BaseModel):
    item_ids: list[str]
    final_csv_name: str
    final_md_name: str

@router.post("/save")
async def save_merged_items(request: MergeSaveRequest):
    try:
        result = merge_service.save_merged_items_as_new(
            request.item_ids, 
            request.final_csv_name, 
            request.final_md_name
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
