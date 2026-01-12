from fastapi import APIRouter, HTTPException, Body
from app.services.approval_service import approval_service
from pydantic import BaseModel

router = APIRouter()

class UpdateStagingRequest(BaseModel):
    csv: str
    markdown: str
    suggested_csv_name: str = None
    suggested_md_name: str = None

class ApproveRequest(BaseModel):
    csv_filename: str
    md_filename: str

@router.get("/staging")
async def get_staging_items():
    return approval_service.get_staging_items()

@router.get("/staging/{staging_id}")
async def get_staging_item(staging_id: str):
    item = approval_service.get_staging_item(staging_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/staging/{staging_id}")
async def update_staging_item(staging_id: str, request: UpdateStagingRequest):
    try:
        approval_service.update_staging_item(
            staging_id, 
            request.csv, 
            request.markdown,
            request.suggested_csv_name,
            request.suggested_md_name
        )
        return {"message": "Staging item updated"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Item not found")

@router.post("/approve/{staging_id}")
async def approve_item(staging_id: str, request: ApproveRequest):
    try:
        result = approval_service.approve_item(staging_id, request.csv_filename, request.md_filename)
        return {"message": "Item approved and stashed", "result": result}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Item not found")

@router.get("/approved")
async def get_approved_items():
    return approval_service.get_approved_items()

class SaveAllRequest(BaseModel):
    csv_dir: str = None
    md_dir: str = None

@router.post("/save-all")
async def save_all_approved(request: SaveAllRequest = Body(...)):
    result = approval_service.save_all_approved(request.csv_dir, request.md_dir)
    return {"message": "All approved items saved to disk and moved to history", **result}

@router.post("/approved/{item_id}/save")
async def save_approved_item(item_id: str, request: SaveAllRequest = Body(...)):
    try:
        result = approval_service.save_approved_item(item_id, request.csv_dir, request.md_dir)
        return {"message": "Approved item saved to disk and moved to history", **result}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Approved item not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/approved/{item_id}/content")
async def get_approved_item_content(item_id: str):
    content = approval_service.get_approved_item_content(item_id)
    if not content:
        raise HTTPException(status_code=404, detail="Approved item not found")
    return content

@router.get("/history")
async def get_history():
    return approval_service.get_history_items()

class UpdateApprovedRequest(BaseModel):
    csv: str
    markdown: str
    final_csv_name: str = None
    final_md_name: str = None

@router.put("/approved/{item_id}")
async def update_approved_item(item_id: str, request: UpdateApprovedRequest):
    try:
        approval_service.update_approved_item(
            item_id, 
            request.csv, 
            request.markdown,
            request.final_csv_name,
            request.final_md_name
        )
        return {"message": "Approved item updated"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Approved item not found")

@router.delete("/approved/{item_id}")
async def delete_approved_item(item_id: str):
    approval_service.delete_approved_item(item_id)
    return {"message": "Approved item deleted"}

@router.delete("/approved")
async def clear_approved_stash():
    approval_service.clear_approved_stash()
    return {"message": "Approved stash cleared"}
