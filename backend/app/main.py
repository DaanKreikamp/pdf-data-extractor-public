from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PDF Data Extractor")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev to fix static file CORS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import pdf, image, approval, merge, settings

app.include_router(pdf.router, prefix="/api/pdf", tags=["pdf"])
app.include_router(image.router, prefix="/api/image", tags=["image"])
app.include_router(approval.router, prefix="/api/approval", tags=["approval"])
app.include_router(merge.router, prefix="/api/merge", tags=["merge"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])

from app.api.routes import models
app.include_router(models.router, prefix="/api/models", tags=["models"])

from app.api.routes import utils, context
app.include_router(utils.router, prefix="/api/utils", tags=["utils"])
app.include_router(context.router, prefix="/api/context", tags=["context"])

from fastapi.staticfiles import StaticFiles
from app.core.config import settings
import os

# Ensure data dir exists
os.makedirs(settings.DATA_DIR, exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory=settings.DATA_DIR), name="static")

@app.on_event("startup")
async def startup_event():
    from app.core.config import settings
    import os
    print(f"DEBUG: CWD is {os.getcwd()}")
    print(f"DEBUG: settings.DATA_DIR is {settings.DATA_DIR}")
    print(f"DEBUG: Absolute DATA_DIR is {os.path.abspath(settings.DATA_DIR)}")

@app.get("/")
def read_root():
    return {"message": "PDF Data Extractor API is running"}
