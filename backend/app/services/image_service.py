import base64
from app.services.ai_service import ai_service
from app.services.context_service import context_service

class ImageService:
    def process_images(self, items: list[dict], user_prompt: str = "") -> dict:
        """
        Process one or more images.
        items: list of { 
            "filename": str,           # Original filename
            "stored_filename": str,    # Filename on disk (in input dir) OR
            "pdf_name": str,           # PDF name (if proposed image)
            "label": str               # Optional label
        }
        user_prompt: Optional user instructions to append to system prompt
        """
        from pathlib import Path
        from app.core.config import settings
        import shutil
        import re
        import traceback

        print(f"DEBUG: process_images called with {len(items)} items. Prompt: {user_prompt}")
        
        base_dir = Path(settings.DATA_DIR)
        input_dir = base_dir / "input"
        proposed_dir = base_dir / "proposed"
        
        # 1. Prepare images (resolve paths and ensure they are in input dir for persistence)
        processed_items = []
        stored_filenames = []
        original_filenames = []
        
        for item in items:
            try:
                # Determine source path
                # Determine source path
                if item.get("full_path"):
                     # Local/Folder image with absolute path
                     import shutil
                     src_path = Path(item["full_path"])
                     
                     if src_path.exists():
                         # Copy to input dir for consistency/persistence if it's not already there
                         # effectively treating it like an uploaded file but sourced locally
                         dst_name = f"local_{src_path.name}"
                         dst_path = input_dir / dst_name
                         
                         if not dst_path.exists():
                             try:
                                 shutil.copy2(src_path, dst_path)
                             except Exception as exc:
                                 print(f"WARN: Failed to copy local file {src_path}: {exc}")
                                 dst_path = src_path

                         processed_items.append({
                             "path": str(dst_path),
                             "label": item.get("label", item.get("filename", src_path.name))
                         })
                         stored_filenames.append(dst_path.name) # Use the name we ended up with
                         original_filenames.append(item.get("filename", src_path.name))
                     else:
                         print(f"WARN: Local image not found: {src_path}")

                elif item.get("pdf_name"):
                    # Proposed image
                    src_path = proposed_dir / item["pdf_name"] / item["filename"]
                    # We need to copy it to input dir to "officialise" it
                    # Use a unique name to avoid collisions if not already provided
                    if item.get("stored_filename"):
                         dst_name = item["stored_filename"]
                    else:
                         dst_name = f"proposed_{item['pdf_name']}_{item['filename']}"
                    
                    dst_path = input_dir / dst_name
                    
                    if src_path.exists():
                        if not dst_path.exists():
                            shutil.copy2(src_path, dst_path)
                        
                        processed_items.append({
                            "path": str(dst_path),
                            "label": item.get("label", item.get("filename"))
                        })
                        stored_filenames.append(dst_name)
                        original_filenames.append(item.get("filename"))
                    else:
                        print(f"WARN: Proposed image not found: {src_path}")

                elif item.get("stored_filename"):
                    # Uploaded image (already in input dir)
                    src_path = input_dir / item["stored_filename"]
                    if src_path.exists():
                        processed_items.append({
                            "path": str(src_path),
                            "label": item.get("label", item.get("filename"))
                        })
                        stored_filenames.append(item["stored_filename"])
                        original_filenames.append(item.get("filename", item["stored_filename"]))
                    else:
                        print(f"WARN: Uploaded image not found: {src_path}")
                else:
                    print(f"WARN: Invalid item format: {item}")

            except Exception as e:
                print(f"ERROR processing item {item}: {e}")
                continue

        if not processed_items:
            raise ValueError("No valid images found to process")

        # 2. Get Context
        # 2. Get Context
        # Instead of global context, we try to fetch context for the specific PDFs involved
        contexts = []
        seen_pdfs = set()
        
        # Check items for pdf_name
        for item in items:
            pdf_name = item.get("pdf_name")
            if pdf_name and pdf_name not in seen_pdfs:
                seen_pdfs.add(pdf_name)
                try:
                    # Try to load context from disk
                    context_path = base_dir / "proposed" / pdf_name / "context.txt"
                    if context_path.exists():
                        with open(context_path, "r", encoding="utf-8") as f:
                            text = f.read()
                            contexts.append(f"--- CONTEXT FROM PDF: {pdf_name} ---\n{text[:10000]}\n") # Limit per PDF to avoid huge prompts
                except Exception as e:
                    print(f"WARN: Failed to load context for {pdf_name}: {e}")
        
        if contexts:
            context = "\n".join(contexts)
            print(f"DEBUG: Loaded specific context for {len(contexts)} PDFs.")
        else:
            # Fallback to global context if no PDF specific context found (e.g. uploaded images or legacy)
            print("DEBUG: Using global last-seen context.")
            ctx_data = context_service.get_context()
            if isinstance(ctx_data, dict):
                context = ctx_data.get("context", "")
            else:
                context = str(ctx_data)

        # 3. Call AI
        try:
            if len(processed_items) == 1:
                # Single Image Mode
                print(f"DEBUG: Processing single image: {processed_items[0]['path']}")
                # Pass user_prompt as feedback for single image
                response = ai_service.process_image(processed_items[0]["path"], context, feedback=user_prompt)
            else:
                # Multi Image Mode
                print(f"DEBUG: Processing {len(processed_items)} images as group")
                # Pass context for multiple images too
                response = ai_service.process_multiple_images(processed_items, user_prompt=user_prompt, context=context)
                
            print(f"DEBUG: AI Response received (length: {len(response)})")
        except Exception as e:
            msg = str(e)
            if "503" in msg and "overloaded" in msg:
                raise Exception("The AI model is currently overloaded. Please try again in a few moments.")
            raise e
        
        # Log RAW response immediately
        try:
            with open(r"c:\Users\daank\.gemini\antigravity\scratch\pdf-data-extractor\backend\debug_raw.log", "a", encoding="utf-8") as f:
                f.write(f"\n--- RAW AI RESPONSE ({len(response)} chars) ---\n{response}\n----------------------------------\n")
        except Exception as e:
            print(f"Failed to log raw response: {e}")

        # 4. Parse Response (Unified Parsing)
        # More robust regex: allows for optional language tags, case insensitive
        code_blocks = re.findall(r"```(?:csv|markdown|md)?\s*(.*?)```", response, re.DOTALL | re.IGNORECASE)

        csv_content = ""
        md_content = ""
        
        if len(code_blocks) >= 2:
            csv_content = code_blocks[0].strip()
            md_content = code_blocks[1].strip()
        elif len(code_blocks) == 1:
            content = code_blocks[0].strip()
            if "," in content and "\n" in content:
                csv_content = content
            else:
                md_content = content
        else:
            # Fallback
            if "Suggested Filename MD:" in response:
                parts = response.split("Suggested Filename MD:")
                if len(parts) > 1:
                    if "Suggested Filename CSV:" in response:
                         subparts = response.split("Suggested Filename CSV:")
                         csv_content = subparts[0].strip()
                         md_content = "Suggested Filename CSV:" + subparts[1].strip()
                    else:
                        md_content = response
            else:
                 md_content = response

        # Extract filenames
        suggested_csv_name = ""
        suggested_md_name = ""
        search_text = md_content + "\n" + response
        
        csv_name_match = re.search(r"(?:Suggested )?Filename CSV:\s*(.*?)(?:\n|$)", search_text, re.IGNORECASE)
        if csv_name_match:
            suggested_csv_name = csv_name_match.group(1).strip()
            
        md_name_match = re.search(r"(?:Suggested )?Filename MD:\s*(.*?)(?:\n|$)", search_text, re.IGNORECASE)
        if md_name_match:
            suggested_md_name = md_name_match.group(1).strip()

        # Append model attribution
        try:
            model_name = ai_service.current_model.name
            md_content += f"\n\nMetadata en CSV gegenereerd met {model_name}"
        except Exception as e:
            print(f"WARN: Could not append model attribution: {e}")

        # 5. Save to Staging
        from app.services.approval_service import approval_service
        
        # Use the first stored filename as the "primary" one for the record, but store all in metadata
        primary_stored = stored_filenames[0]
        combined_original = " + ".join(original_filenames[:3])
        if len(original_filenames) > 3:
            combined_original += f" and {len(original_filenames)-3} more"

        # LOG STEP 3: Saving to staging
        try:
            with open(r"c:\Users\daank\.gemini\antigravity\scratch\pdf-data-extractor\backend\debug_raw.log", "a", encoding="utf-8") as f:
                f.write(f"[STEP 3] Entering save_to_staging...\n")
        except: pass

        staging_id = approval_service.save_to_staging(
            csv_content, 
            md_content, 
            original_filename=combined_original,
            suggested_csv_name=suggested_csv_name,
            suggested_md_name=suggested_md_name,
            stored_filename=primary_stored,
            source_images=stored_filenames
        )
        
        # LOG STEP 4: Saved
        try:
            with open(r"c:\Users\daank\.gemini\antigravity\scratch\pdf-data-extractor\backend\debug_raw.log", "a", encoding="utf-8") as f:
                f.write(f"[STEP 4] Saved to staging ID: {staging_id}\n----------------------------------\n")
        except: pass
        
        # Log Parsed Result
        try:
            with open(r"c:\Users\daank\.gemini\antigravity\scratch\pdf-data-extractor\backend\debug_parsed.log", "a", encoding="utf-8") as f:
                f.write(f"\n--- PARSED RESULT ---\nCSV Len: {len(csv_content)}\nMD Len: {len(md_content)}\nCSV Content: {csv_content}\nMD Content: {md_content}\n---------------------\n")
        except Exception as e:
            print(f"Logging parsed failed: {e}")

        return {
            "id": staging_id,
            "raw_response": response,
            "csv": csv_content,
            "markdown": md_content,
            "suggested_csv_name": suggested_csv_name,
            "suggested_md_name": suggested_md_name,
            "stored_filename": primary_stored,
            "source_images": stored_filenames
        }

    # Wrapper for backward compatibility (if needed) or for simple upload endpoint
    def process_image_upload(self, file_content: bytes, media_type: str, original_filename: str, stored_filename: str) -> dict:
        # Note: file_content is not used because we expect the file to be on disk already (handled by route)
        # But the route saves it to 'input_dir / stored_filename'
        return self.process_images([{
            "filename": original_filename,
            "stored_filename": stored_filename
        }])

    def redo_image(self, staging_id: str, feedback: str) -> dict:
        """
        Redo the image processing with user feedback.
        """
        from app.services.approval_service import approval_service
        from pathlib import Path
        from app.core.config import settings
        import re

        # 1. Get staging item to find original image
        item = approval_service.get_staging_item(staging_id)
        if not item:
            raise ValueError("Staging item not found")
            
        # Support both single stored_filename and source_images list
        source_images = item.get("source_images", [])
        if not source_images and item.get("stored_filename"):
            source_images = [item["stored_filename"]]
            
        if not source_images:
            raise ValueError("Original images not found for this item")
            
        # 2. Prepare paths
        input_dir = Path(settings.DATA_DIR) / "input"
        image_paths = []
        
        for fname in source_images:
            p = input_dir / fname
            if p.exists():
                image_paths.append(str(p))
            
        if not image_paths:
             raise FileNotFoundError("No source images found on disk")

        # 3. Call AI with feedback
        # We need to distinguish single vs multi for the AI call
        ctx_data = context_service.get_context()
        context = ctx_data.get("context", "") if isinstance(ctx_data, dict) else str(ctx_data)
        
        if len(image_paths) == 1:
            response = ai_service.process_image(image_paths[0], context, feedback)
        else:
            # For multi-image redo, we pass the list of paths
            # We need to construct the 'processed_items' format expected by process_multiple_images if we reused that,
            # but ai_service.process_multiple_images expects dicts with 'path'.
            # Let's check ai_service signature. 
            # Assuming process_multiple_images takes list of {"path": str, "label": str}
            
            # We don't have labels easily available here unless we stored them.
            # For now, just pass paths and empty labels.
            formatted_images = [{"path": p, "label": ""} for p in image_paths]
            response = ai_service.process_multiple_images(formatted_images, feedback=feedback) # Need to ensure process_multiple_images accepts feedback

        # 4. Parse response (Reuse logic? Should refactor, but for now copy-paste/adapt)
        code_blocks = re.findall(r"```(?:csv|markdown|md)?\s*(.*?)```", response, re.DOTALL | re.IGNORECASE)
        
        csv_content = ""
        md_content = ""
        
        if len(code_blocks) >= 2:
            csv_content = code_blocks[0].strip()
            md_content = code_blocks[1].strip()
        elif len(code_blocks) == 1:
            content = code_blocks[0].strip()
            if "," in content and "\n" in content:
                csv_content = content
            else:
                md_content = content
        else:
            # Fallback
            if "Suggested Filename MD:" in response:
                parts = response.split("Suggested Filename MD:")
                if len(parts) > 1:
                    if "Suggested Filename CSV:" in response:
                         subparts = response.split("Suggested Filename CSV:")
                         csv_content = subparts[0].strip()
                         md_content = "Suggested Filename CSV:" + subparts[1].strip()
                    else:
                        md_content = response
            else:
                 md_content = response

        # Extract filenames
        suggested_csv_name = ""
        suggested_md_name = ""
        search_text = md_content + "\n" + response
        
        csv_name_match = re.search(r"(?:Suggested )?Filename CSV:\s*(.*?)(?:\n|$)", search_text, re.IGNORECASE)
        if csv_name_match:
            suggested_csv_name = csv_name_match.group(1).strip()
            
        md_name_match = re.search(r"(?:Suggested )?Filename MD:\s*(.*?)(?:\n|$)", search_text, re.IGNORECASE)
        if md_name_match:
            suggested_md_name = md_name_match.group(1).strip()

        # Append model attribution
        try:
            model_name = ai_service.current_model.name
            md_content += f"\n\nMetadata en csv gegenereerd met {model_name}"
        except Exception as e:
            print(f"WARN: Could not append model attribution: {e}")

        # 5. Update staging item
        approval_service.update_staging_item(staging_id, csv_content, md_content)
        
        return {
            "id": staging_id,
            "raw_response": response,
            "csv": csv_content,
            "markdown": md_content,
            "suggested_csv_name": suggested_csv_name,
            "suggested_md_name": suggested_md_name,
            "stored_filename": item.get("stored_filename"),
            "source_images": source_images
        }

image_service = ImageService()
