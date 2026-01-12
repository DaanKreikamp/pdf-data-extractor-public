import pypdf
from io import BytesIO
from app.services.ai_service import ai_service
from app.services.context_service import context_service
import fitz  # PyMuPDF
from pathlib import Path
from app.core.config import settings
import json
import os
import shutil
import concurrent.futures
from typing import List, Dict, Any

class PDFService:
    def extract_text(self, file_content: bytes, max_pages: int = 5) -> str:
        """
        Extract text from the first `max_pages` of a PDF.
        """
        print(f"DEBUG: Starting PDF text extraction (max_pages={max_pages})...")
        try:
            reader = pypdf.PdfReader(BytesIO(file_content))
            text = ""
            # Limit to first few pages for context extraction to avoid token limits
            num_pages = min(len(reader.pages), max_pages)
            print(f"DEBUG: PDF has {len(reader.pages)} pages. Extracting first {num_pages}...")
            
            for i in range(num_pages):
                try:
                    page = reader.pages[i]
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                except Exception as page_error:
                    print(f"WARN: Failed to extract page {i}: {page_error}")
                    continue
                
            print(f"DEBUG: Extraction complete. Total chars: {len(text)}")
            return text
        except Exception as e:
            print(f"ERROR: PDF Extraction failed: {e}")
            return ""

    def process_pdf_upload(self, file_content: bytes, filename: str, extract_images: bool = True) -> str:
        """
        Extract text and get AI summary/context. Also generates proposed screenshots.
        """
        # Indicate we are starting
        self.update_progress(filename, "analyzing_text", 0, 0)
        
        # Check for existing info/summary to avoid re-processing
        proposed_dir = Path(settings.DATA_DIR) / "proposed" / filename
        info_path = proposed_dir / "info.json"
        context_path = proposed_dir / "context.txt"
        
        summary = None
        text_content = ""
        
        # We need BOTH valid info.json (for summary) AND context.txt (for RAG/Context) to skip
        use_cache = False
        
        if info_path.exists() and context_path.exists():
             try:
                with open(info_path, "r") as f:
                    info = json.load(f)
                    summary = info.get("summary")
                
                # Verify summary is not empty
                if summary:
                    print(f"DEBUG: Found existing summary for {filename}. Checking context...")
                    use_cache = True
             except Exception as e:
                 print(f"WARN: Failed to load existing info/cache: {e}")

        # Only extract text and summarize if we can't use cache
        # FORCE REFRESH: Always ignore cache for summary to ensure fresh AI context
        use_cache = False 
        
        if not use_cache:
            text_content = self.extract_text(file_content)
            print(f"DEBUG: Extracted {len(text_content)} chars. Summarizing with AI...")
            
            # Summarize with AI
            try:
                summary = ai_service.process_content(
                    content=f"Hier is de tekst van het document '{filename}'. Genereer de uitgebreide context analyse en samenvatting zoals gevraagd in de systeem prompt.",
                    context=text_content[:50000], # Truncate context
                )
                print("DEBUG: AI Summary generated successfully.")
            except Exception as e:
                print(f"ERROR: Failed to generate summary: {e}")
                summary = "Kon samenvatting niet genereren door een fout."
            print("DEBUG: AI Summary generated.")
            
            # Store context for image processing (Append so we capture multiple PDFs)
            # Use AI summary as the primary context text as per user request
            # Use update_context to deduplicate by filename
            context_service.update_context(filename, summary)
            
            # Save context to disk for later retrieval (per PDF)
            try:
                context_path.parent.mkdir(parents=True, exist_ok=True)
                with open(context_path, "w", encoding="utf-8") as f:
                    f.write(text_content[:50000])
            except Exception as e:
                print(f"WARN: Failed to save context for {filename}: {e}")
        else:
            # We utilize the cache
            try:
                with open(context_path, "r", encoding="utf-8") as f:
                    text_content = f.read()
                # Use AI summary as the primary context text as per user request
                context_service.update_context(filename, summary)
                print(f"DEBUG: Loaded existing context for {filename} from cache.")
            except Exception as e:
                print(f"WARN: Failed to load context from cache despite check: {e}")
                # Fallback? If we failed to read context, we might want to re-extract, but for now just log.
        
        # Generate proposed screenshots (Async ideally, but sync for now)
        if extract_images:
            try:
                print("DEBUG: Generating proposed screenshots...")
                self.generate_proposed_screenshots(file_content, filename)
            except Exception as e:
                print(f"ERROR: Failed to generate proposed screenshots: {e}")
                # Even if screenshots fail, we should mark as done so frontend stops spinning
                # But we might want to indicate partial success? For now, just done.
        else:
            print("DEBUG: Skipping image extraction (Context Only mode).")
            # If context only, we should hide images so they don't appear in SuggestionsManager
            # But keep them for later (Caching)
            try:
                if proposed_dir.exists():
                    metadata_path = proposed_dir / "metadata.json"
                    backup_path = proposed_dir / "metadata.json.bak"
                    if metadata_path.exists():
                         print(f"DEBUG: Hiding existing metadata for {filename} (Context Mode)...")
                         if backup_path.exists():
                             os.remove(backup_path) 
                         os.rename(metadata_path, backup_path)
            except Exception as e:
                print(f"WARN: Failed to hide stale data: {e}")
        
        # Mark as done and include summary
        # We need to know total pages to set progress correctly
        try:
            doc = fitz.open(stream=file_content, filetype="pdf")
            num_pages = min(len(doc), 350) # Match the limit in generate_proposed_screenshots
        except:
            num_pages = 0
            
        self.update_progress(filename, "done", num_pages, num_pages, summary=summary)
        
        # Save info for reloading later
        self.save_info(filename, {"summary": summary, "num_pages": num_pages})
        
        return summary

    def save_info(self, filename: str, data: dict):
        """Save summary and other info to disk."""
        try:
            info_path = Path(settings.DATA_DIR) / "proposed" / filename / "info.json"
            info_path.parent.mkdir(parents=True, exist_ok=True)
            with open(info_path, "w") as f:
                json.dump(data, f)
        except Exception as e:
            print(f"WARN: Failed to save info: {e}")

    def load_existing(self, filename: str) -> Dict[str, Any]:
        """Load existing project if available."""
        proposed_dir = Path(settings.DATA_DIR) / "proposed" / filename
        info_path = proposed_dir / "info.json"
        
        if not proposed_dir.exists() or not info_path.exists():
            return None
            
        try:
            with open(info_path, "r") as f:
                info = json.load(f)
                
            summary = info.get("summary", "")
            num_pages = info.get("num_pages", 0)
            
            # Restore progress state
            self.update_progress(filename, "done", num_pages, num_pages, summary=summary)
            
            # Restore context (best effort, we don't have full text but summary helps)
            context_service.set_context("", summary)
            
            return info
        except Exception as e:
            print(f"ERROR: Failed to load existing project: {e}")
            return None

    # Progress tracking: {filename: {status: str, progress: int, total: int}}
    progress_tracking = {}

    import time

    def get_progress(self, filename: str):
        # 1. Try memory
        if filename in self.progress_tracking:
            return self.progress_tracking[filename]
        
        # 2. Try disk
        try:
            status_path = Path(settings.DATA_DIR) / "proposed" / filename / "status.json"
            if status_path.exists():
                with open(status_path, "r") as f:
                    data = json.load(f)
                    
                # 3. Check for staleness if processing
                if data.get("status") == "processing":
                    updated_at = data.get("updated_at", 0)
                    # If older than 60 seconds, assume dead
                    if time.time() - updated_at > 60:
                        return {
                            "status": "error",
                            "progress": data.get("progress", 0),
                            "total": data.get("total", 0),
                            "summary": "Processing interrupted (stalled)."
                        }
                return data
        except Exception as e:
            print(f"WARN: Error reading status for {filename}: {e}")
            
        return {"status": "unknown", "progress": 0, "total": 0}

    def update_progress(self, filename: str, status: str, progress: int, total: int, summary: str = None):
        import time
        data = {
            "status": status,
            "progress": progress,
            "total": total,
            "updated_at": time.time()
        }
        if summary:
            data["summary"] = summary
        self.progress_tracking[filename] = data
        
        # Persist to disk
        try:
            status_path = Path(settings.DATA_DIR) / "proposed" / filename / "status.json"
            status_path.parent.mkdir(parents=True, exist_ok=True)
            # Write safely
            temp_path = status_path.with_suffix('.tmp')
            with open(temp_path, "w") as f:
                json.dump(data, f)
            os.replace(temp_path, status_path)
        except Exception as e:
            print(f"WARN: Failed to persist status for {filename}: {e}")

    def _process_page(self, page_num: int, doc_stream: bytes, proposed_dir: Path, zoom: float = 2.0) -> List[Dict[str, Any]]:
        """
        Process a single page: render, extract coordinates, crop.
        This function is designed to be run in a thread.
        """
        # Re-open doc in thread (fitz documents are not thread-safe across contexts usually, safer to open fresh or pass bytes)
        # Actually fitz is thread-safe for reading if we are careful, but opening fresh is safest.
        try:
            doc = fitz.open(stream=doc_stream, filetype="pdf")
            page = doc[page_num]
            
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            page_image_path = proposed_dir / f"page_{page_num + 1}.png"
            pix.save(str(page_image_path))
            
            # Ask Gemini for coordinates (cached)
            items = ai_service.extract_table_coordinates(str(page_image_path))
            
            page_results = []
            
            for idx, item in enumerate(items):
                try:
                    box = item.get("box_2d") # [ymin, xmin, ymax, xmax] 0-1000
                    label = item.get("label", "Unknown")
                    type_ = item.get("type", "unknown")
                    
                    if not box or len(box) != 4:
                        continue
                        
                    # Convert normalized coordinates to pixel coordinates
                    ymin, xmin, ymax, xmax = box
                    
                    height = pix.height
                    width = pix.width
                    
                    y1 = int(ymin / 1000 * height)
                    x1 = int(xmin / 1000 * width)
                    y2 = int(ymax / 1000 * height)
                    x2 = int(xmax / 1000 * width)
                    
                    # Add some padding (increased to 20px)
                    padding = 20
                    y1 = max(0, y1 - padding)
                    x1 = max(0, x1 - padding)
                    y2 = min(height, y2 + padding)
                    x2 = min(width, x2 + padding)
                    
                    # Crop
                    pdf_x1 = x1 / zoom
                    pdf_y1 = y1 / zoom
                    pdf_x2 = x2 / zoom
                    pdf_y2 = y2 / zoom
                    
                    clip_rect = fitz.Rect(pdf_x1, pdf_y1, pdf_x2, pdf_y2)
                    crop_pix = page.get_pixmap(matrix=mat, clip=clip_rect)
                    
                    crop_filename = f"p{page_num + 1}_{idx}_{type_}.png"
                    crop_path = proposed_dir / crop_filename
                    crop_pix.save(str(crop_path))
                    
                    page_results.append({
                        "filename": crop_filename,
                        "page": page_num + 1,
                        "type": type_,
                        "label": label,
                        "path": str(crop_path)
                    })
                    
                except Exception as e:
                    print(f"WARN: Failed to process item {idx} on page {page_num + 1}: {e}")
            
            # Clean up full page image to save space
            try:
                os.remove(page_image_path)
            except:
                pass
                
            return page_results
            
        except Exception as e:
            print(f"ERROR: Failed to process page {page_num}: {e}")
            return []

    def generate_proposed_screenshots(self, file_content: bytes, filename: str):
        """
        Render PDF pages, ask Gemini for coordinates, crop and save images.
        Uses parallelism and caching.
        """
        doc = fitz.open(stream=file_content, filetype="pdf")
        
        # Create output directory
        proposed_dir = Path(settings.DATA_DIR) / "proposed" / filename
        metadata_path = proposed_dir / "metadata.json"
        
        # RESTORE FROM BACKUP IF AVAILABLE (Caching for Context Mode)
        backup_path = proposed_dir / "metadata.json.bak"
        if proposed_dir.exists() and backup_path.exists():
            print(f"DEBUG: Found hidden cache for {filename}. Restoring...")
            try:
                 if metadata_path.exists():
                     os.remove(metadata_path)
                 os.rename(backup_path, metadata_path)
            except Exception as e:
                print(f"WARN: Failed to restore backup metadata: {e}")
        
        # Check if we can reuse existing data
        if proposed_dir.exists() and metadata_path.exists():
            print(f"DEBUG: Found existing data for {filename}. Reusing...")
            # We assume if metadata exists, it's good.
            # We just need to ensure the frontend gets the "done" status which happens in process_pdf_upload
            return

        # Clear existing data if it's partial or corrupt (or if we decided to re-run)
        if proposed_dir.exists():
            shutil.rmtree(proposed_dir)
        proposed_dir.mkdir(parents=True, exist_ok=True)
        
        # Metadata list
        proposed_images = []
        
        # Limit to 350 pages as requested
        max_pages = 350
        num_pages = min(len(doc), max_pages)
        
        self.update_progress(filename, "processing", 0, num_pages)
        
        # Use ThreadPoolExecutor for parallel processing
        # Max workers = 5 to avoid hitting rate limits too hard, but speed up significantly
        max_workers = 5
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all pages
            future_to_page = {
                executor.submit(self._process_page, page_num, file_content, proposed_dir): page_num 
                for page_num in range(num_pages)
            }
            
            completed_pages = 0
            for future in concurrent.futures.as_completed(future_to_page):
                page_num = future_to_page[future]
                try:
                    results = future.result()
                    proposed_images.extend(results)
                except Exception as exc:
                    print(f"Page {page_num} generated an exception: {exc}")
                
                completed_pages += 1
                self.update_progress(filename, f"Processing page {completed_pages}/{num_pages}", completed_pages, num_pages)
                
                # Save metadata incrementally
                self.safe_write_json(metadata_path, proposed_images)
            
        print(f"DEBUG: Proposed screenshots generation complete. Found {len(proposed_images)} items.")

    def safe_write_json(self, path: Path, data: list):
        """
        Safely write JSON data to a file with retries for Windows file locking.
        """
        temp_path = path.with_suffix('.tmp')
        try:
            print(f"DEBUG: Writing metadata to {path} ({len(data)} items)")
            with open(temp_path, "w") as f:
                json.dump(data, f, indent=2)
            
            # Retry rename operation
            max_retries = 3
            for i in range(max_retries):
                try:
                    os.replace(temp_path, path)
                    return
                except PermissionError:
                    if i == max_retries - 1:
                        print(f"WARN: Failed to replace {path} after {max_retries} retries. File might be locked.")
                    else:
                        import time
                        time.sleep(0.1)
        except Exception as e:
            print(f"WARN: Failed to write metadata: {e}")

    def extract_images_delayed(self, file_content: bytes, filename: str):
        """
        Extract images for a PDF that was previously processed with context only.
        """
        try:
            self.generate_proposed_screenshots(file_content, filename)
            
            # Update status to done (total pages is needed? reusing existing or recounting)
            try:
                doc = fitz.open(stream=file_content, filetype="pdf")
                num_pages = min(len(doc), 350)
            except:
                num_pages = 0
                
            # Preserve existing summary if possible
            current_status = self.get_progress(filename)
            summary = current_status.get("summary")
            
            self.update_progress(filename, "done", num_pages, num_pages, summary=summary)
            
        except Exception as e:
            print(f"ERROR: Delayed extraction failed: {e}")
            self.update_progress(filename, "error", 0, 0, summary=str(e))

pdf_service = PDFService()
