import json
import shutil
import uuid
import time
import os
from pathlib import Path
from app.core.config import settings
from app.services.settings_service import settings_service

class ApprovalService:
    def __init__(self):
        self.data_dir = Path(settings.DATA_DIR)
        self.staging_dir = self.data_dir / "staging"
        self.approved_dir = self.data_dir / "approved"
        self.staging_dir.mkdir(parents=True, exist_ok=True)
        self.approved_dir.mkdir(parents=True, exist_ok=True)

    def save_to_staging(self, csv_content: str, md_content: str, original_filename: str, suggested_csv_name: str = None, suggested_md_name: str = None, stored_filename: str = None, source_images: list = None) -> str:
        """
        Save extracted content to staging and return a unique ID.
        """
        staging_id = str(uuid.uuid4())
        
        # Save CSV
        with open(self.staging_dir / f"{staging_id}.csv", "w", encoding="utf-8") as f:
            f.write(csv_content)
            
        # Save Markdown
        with open(self.staging_dir / f"{staging_id}.md", "w", encoding="utf-8") as f:
            f.write(md_content)
            
        # Save metadata
        metadata = {
            "original_filename": original_filename,
            "stored_filename": stored_filename,
            "suggested_csv_name": suggested_csv_name,
            "suggested_md_name": suggested_md_name,
            "source_images": source_images or []
        }
        with open(self.staging_dir / f"{staging_id}.meta.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f)
            
        return staging_id

    def get_staging_item(self, staging_id: str):
        """
        Retrieve content from staging.
        """
        csv_path = self.staging_dir / f"{staging_id}.csv"
        md_path = self.staging_dir / f"{staging_id}.md"
        meta_path = self.staging_dir / f"{staging_id}.meta.json"
        
        if not csv_path.exists() or not md_path.exists():
            return None
            
        with open(csv_path, "r", encoding="utf-8") as f:
            csv_content = f.read()
            
        with open(md_path, "r", encoding="utf-8") as f:
            md_content = f.read()
            
        suggested_csv_name = ""
        suggested_md_name = ""
        original_filename = ""
        stored_filename = ""
        source_images = []
        
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                    suggested_csv_name = metadata.get("suggested_csv_name", "")
                    suggested_md_name = metadata.get("suggested_md_name", "")
                    original_filename = metadata.get("original_filename", "")
                    stored_filename = metadata.get("stored_filename", "")
                    source_images = metadata.get("source_images", [])
            except Exception as e:
                print(f"Error reading metadata for {staging_id}: {e}")
            
        return {
            "id": staging_id,
            "csv": csv_content,
            "markdown": md_content,
            "suggested_csv_name": suggested_csv_name,
            "suggested_md_name": suggested_md_name,
            "original_filename": original_filename,
            "stored_filename": stored_filename,
            "source_images": source_images
        }

    def update_staging_item(self, staging_id: str, csv_content: str, md_content: str, suggested_csv_name: str = None, suggested_md_name: str = None):
        """
        Update content in staging (e.g. after manual edit).
        """
        csv_path = self.staging_dir / f"{staging_id}.csv"
        md_path = self.staging_dir / f"{staging_id}.md"
        meta_path = self.staging_dir / f"{staging_id}.meta.json"
        
        if not csv_path.exists() or not md_path.exists():
            raise FileNotFoundError("Staging item not found")
            
        with open(csv_path, "w", encoding="utf-8") as f:
            f.write(csv_content)
            
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        if suggested_csv_name or suggested_md_name:
            try:
                if meta_path.exists():
                    with open(meta_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                else:
                    metadata = {}
                
                if suggested_csv_name:
                    metadata["suggested_csv_name"] = suggested_csv_name
                if suggested_md_name:
                    metadata["suggested_md_name"] = suggested_md_name
                
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f)
            except Exception as e:
                print(f"Error updating staging metadata: {e}")

    def update_approved_item(self, item_id: str, csv_content: str, md_content: str, final_csv_name: str = None, final_md_name: str = None):
        """
        Update content in approved stash (e.g. after manual edit).
        """
        csv_path = self.approved_dir / f"{item_id}.csv"
        md_path = self.approved_dir / f"{item_id}.md"
        meta_path = self.approved_dir / f"{item_id}.meta.json"
        
        if not csv_path.exists() or not md_path.exists():
            raise FileNotFoundError("Approved item not found")
            
        with open(csv_path, "w", encoding="utf-8") as f:
            f.write(csv_content)
            
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        if final_csv_name or final_md_name:
            try:
                if meta_path.exists():
                    with open(meta_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                else:
                    metadata = {}
                
                if final_csv_name:
                    metadata["final_csv_name"] = final_csv_name
                if final_md_name:
                    metadata["final_md_name"] = final_md_name
                
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f)
            except Exception as e:
                print(f"Error updating approved metadata: {e}")

    def approve_item(self, staging_id: str, csv_filename: str, md_filename: str):
        """
        Move item from staging to APPROVED stash with specified filenames.
        Also renames and stashes the input image if available.
        """
        item = self.get_staging_item(staging_id)
        if not item:
            raise FileNotFoundError("Staging item not found")

        # Sanitize filenames
        import re
        def sanitize(name):
            return re.sub(r'[<>:"/\\|?*]', '_', name)

        csv_filename = sanitize(csv_filename)
        md_filename = sanitize(md_filename)

        # Ensure filenames have correct extensions
        if not csv_filename.endswith(".csv"):
            csv_filename += ".csv"
        if not md_filename.endswith(".md"):
            md_filename += ".md"

        approved_id = staging_id # Keep same ID

        # Write content to APPROVED dir
        try:
            with open(self.approved_dir / f"{approved_id}.csv", "w", encoding="utf-8") as f:
                f.write(item["csv"])

            with open(self.approved_dir / f"{approved_id}.md", "w", encoding="utf-8") as f:
                f.write(item["markdown"])
        except Exception as e:
            print(f"CRITICAL ERROR: Failed to write approved content for {approved_id}: {e}")
            raise e

        # Handle Input Image Renaming
        stored_filename = item.get("stored_filename")
        final_image_name = None

        if stored_filename:
            input_dir = Path(settings.DATA_DIR) / "input"
            src_image = input_dir / stored_filename

            if src_image.exists():
                # Determine extension
                ext = src_image.suffix
                # New name: {output_filename}_input_image{ext}
                # We use the CSV filename base for the image name
                base_name = Path(csv_filename).stem
                final_image_name = f"{base_name}_input_image{ext}"

                # Copy to approved dir with new name
                # We store it as {approved_id}_input{ext} physically to avoid collisions in stash,
                # but record the final desired name in metadata.
                # Actually, let's just store it with the ID to be safe.
                dst_image = self.approved_dir / f"{approved_id}_input{ext}"
                shutil.copy2(src_image, dst_image)

        # Save metadata with final filenames
        metadata = {
            "final_csv_name": csv_filename,
            "final_md_name": md_filename,
            "final_image_name": final_image_name,
            "original_filename": item.get("original_filename", ""),
            "image_ext": Path(stored_filename).suffix if stored_filename else ""
        }
        
        try:
            with open(self.approved_dir / f"{approved_id}.meta.json", "w", encoding="utf-8") as f:
                json.dump(metadata, f)
        except Exception as e:
             print(f"CRITICAL ERROR: Failed to save approved metadata for {approved_id}: {e}")
             raise e

        # Remove from staging
        try:
            (self.staging_dir / f"{staging_id}.csv").unlink(missing_ok=True)
            (self.staging_dir / f"{staging_id}.md").unlink(missing_ok=True)
            (self.staging_dir / f"{staging_id}.meta.json").unlink(missing_ok=True)
        except Exception as e:
            print(f"WARNING: Failed to cleanup staging files for {staging_id}: {e}")

        return {
            "id": approved_id,
            "status": "approved"
        }

    def get_approved_items(self) -> list[dict]:
        """
        Get list of items in APPROVED stash.
        """
        items = []
        # List all meta.json files
        for meta_file in self.approved_dir.glob("*.meta.json"):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                
                item_id = meta_file.stem.replace(".meta", "") # remove .meta
                
                items.append({
                    "id": item_id,
                    **metadata
                })
            except Exception as e:
                print(f"Error loading approved item {meta_file}: {e}")
        
        return items

    def get_approved_item_content(self, item_id: str) -> dict:
        """
        Get content of an approved item.
        """
        csv_path = self.approved_dir / f"{item_id}.csv"
        md_path = self.approved_dir / f"{item_id}.md"
        meta_path = self.approved_dir / f"{item_id}.meta.json"
        
        if not csv_path.exists() or not md_path.exists():
            return None
            
        with open(csv_path, "r", encoding="utf-8") as f:
            csv_content = f.read()
            
        with open(md_path, "r", encoding="utf-8") as f:
            md_content = f.read()
            
        suggested_csv_name = ""
        suggested_md_name = ""
        original_filename = ""
        stored_filename = ""
        source_images = []
        image_ext = ""
        
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                    suggested_csv_name = metadata.get("final_csv_name", "")
                    suggested_md_name = metadata.get("final_md_name", "")
                    original_filename = metadata.get("original_filename", "")
                    stored_filename = metadata.get("stored_filename", "") # Might not be in approved meta
                    image_ext = metadata.get("image_ext", "")
                    # source_images might be in metadata if we preserved them
                    source_images = metadata.get("source_images", [])
            except Exception as e:
                print(f"Error reading metadata for {item_id}: {e}")
            
        return {
            "id": item_id,
            "csv": csv_content,
            "markdown": md_content,
            "suggested_csv_name": suggested_csv_name,
            "suggested_md_name": suggested_md_name,
            "original_filename": original_filename,
            "image_ext": image_ext,
            "source_images": source_images
        }

    def get_history_items(self) -> list[dict]:
        """
        Get list of items in history.
        """
        history_dir = self.data_dir / "history"
        if not history_dir.exists():
            return []

        items = []
        # List all meta.json files in history
        for meta_file in history_dir.glob("*.meta.json"):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                
                items.append(metadata)
            except Exception as e:
                print(f"Error loading history item {meta_file}: {e}")

        # Sort by saved_at desc
        items.sort(key=lambda x: x.get("saved_at", 0), reverse=True)
        return items

    def save_all_approved(self, csv_dir: str = None, md_dir: str = None) -> dict:
        """
        Save all approved items to the final output directories.
        Returns detailed result with count, directory, and paths.
        """
        
        default_dir = Path(settings_service.get_settings().get("output_folder"))
        if not default_dir.is_absolute():
            default_dir = Path.home() / default_dir
            
        # Resolve target directories
        target_csv_dir = Path(csv_dir) if csv_dir else default_dir
        target_md_dir = Path(md_dir) if md_dir else default_dir
        
        if not target_csv_dir.is_absolute():
            target_csv_dir = Path.home() / target_csv_dir
        if not target_md_dir.is_absolute():
            target_md_dir = Path.home() / target_md_dir
            
        print(f"Saving CSVs to: {target_csv_dir}")
        print(f"Saving MDs to: {target_md_dir}")
        
        target_csv_dir.mkdir(parents=True, exist_ok=True)
        target_md_dir.mkdir(parents=True, exist_ok=True)
        
        # Ensure history dir exists
        history_dir = self.data_dir / "history"
        history_dir.mkdir(parents=True, exist_ok=True)

        saved_paths = []
        approved_items = self.get_approved_items()

        for item in approved_items:
            # 1. Write to user's output folder
            csv_path = target_csv_dir / item["final_csv_name"]
            md_path = target_md_dir / item["final_md_name"]

            # Optimize: Get content once
            content = self.get_approved_item_content(item["id"])
            if not content:
                print(f"Failed to get content for {item['id']}")
                continue

            try:
                with open(csv_path, "w", encoding="utf-8") as f:
                    f.write(content["csv"])
            except Exception as e:
                print(f"Error writing CSV: {e}")

            try:
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(content["markdown"])
            except Exception as e:
                print(f"Error writing MD: {e}")
                
            saved_paths.append(str(csv_path))
            saved_paths.append(str(md_path))
            
            # Copy image if exists
            if item.get("final_image_name"):
                item_id = item["id"]
                found_img = False
                for f in self.approved_dir.glob(f"{item_id}_input*"):
                    if f.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp']:
                        # Copy only if it's an image
                        shutil.copy2(f, target_md_dir / item["final_image_name"])
                        saved_paths.append(str(target_md_dir / item["final_image_name"]))
                        found_img = True
                        break

            # 2. Move internal files to history
            item_id = item["id"]
            timestamp = int(time.time())
            
            # Source paths
            src_json = self.approved_dir / f"{item_id}.json" # Not used currently? We use meta.json
            src_csv = self.approved_dir / f"{item_id}.csv"
            src_md = self.approved_dir / f"{item_id}.md"
            src_meta = self.approved_dir / f"{item_id}.meta.json"
            
            # Dest paths
            dst_csv = history_dir / f"{timestamp}_{item_id}.csv"
            dst_md = history_dir / f"{timestamp}_{item_id}.md"
            dst_meta = history_dir / f"{timestamp}_{item_id}.meta.json"
            
            if src_meta.exists():
                # Update the JSON with saved_at timestamp before moving
                try:
                    with open(src_meta, "r") as f:
                        data = json.load(f)
                    data["saved_at"] = timestamp
                    data["saved_to_csv"] = str(target_csv_dir)
                    data["saved_to_md"] = str(target_md_dir)
                    with open(dst_meta, "w") as f:
                        json.dump(data, f, indent=2)
                    os.remove(src_meta)
                except Exception as e:
                    print(f"Error moving meta json: {e}")
            
            if src_csv.exists(): shutil.move(str(src_csv), str(dst_csv))
            if src_md.exists(): shutil.move(str(src_md), str(dst_md))
            
            # Move image too
            for f in self.approved_dir.glob(f"{item_id}_input*"):
                dst_img = history_dir / f"{timestamp}_{f.name}"
                shutil.move(str(f), str(dst_img))

        return {
            "count": len(saved_paths),
            "directory": str(target_csv_dir),
            "paths": saved_paths
        }

    def save_approved_item(self, item_id: str, csv_dir: str = None, md_dir: str = None) -> dict:
        """
        Save a single approved item to the final output directories and move to history.
        """
        default_dir = Path(settings_service.get_settings().get("output_folder"))
        if not default_dir.is_absolute():
            default_dir = Path.home() / default_dir
            
        # Resolve target directories
        target_csv_dir = Path(csv_dir) if csv_dir else default_dir
        target_md_dir = Path(md_dir) if md_dir else default_dir
        
        if not target_csv_dir.is_absolute():
            target_csv_dir = Path.home() / target_csv_dir
        if not target_md_dir.is_absolute():
            target_md_dir = Path.home() / target_md_dir
            
        target_csv_dir.mkdir(parents=True, exist_ok=True)
        target_md_dir.mkdir(parents=True, exist_ok=True)
        
        # Ensure history dir exists
        history_dir = self.data_dir / "history"
        history_dir.mkdir(parents=True, exist_ok=True)

        meta_path = self.approved_dir / f"{item_id}.meta.json"
        if not meta_path.exists():
             raise FileNotFoundError(f"Item {item_id} not found in approved stash")

        with open(meta_path, "r", encoding="utf-8") as f:
            item = json.load(f)
            item["id"] = item_id # Ensure ID is present

        saved_paths = []

        # 1. Write to user's output folder
        csv_path = target_csv_dir / item["final_csv_name"]
        md_path = target_md_dir / item["final_md_name"]

        # Optimize: Get content once
        content = self.get_approved_item_content(item_id)
        if not content:
            raise ValueError(f"Failed to get content for {item_id}")

        try:
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write(content["csv"])
        except Exception as e:
            print(f"Error writing CSV: {e}")
            raise e

        try:
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(content["markdown"])
        except Exception as e:
            print(f"Error writing MD: {e}")
            raise e
            
        saved_paths.append(str(csv_path))
        saved_paths.append(str(md_path))
        
        # Copy image if exists
        try:
            if item.get("final_image_name"):
                for f in self.approved_dir.glob(f"{item_id}_input*"):
                    if f.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp']:
                        # Copy only if it's an image
                        shutil.copy2(f, target_md_dir / item["final_image_name"])
                        saved_paths.append(str(target_md_dir / item["final_image_name"]))
                        break
        except Exception as e:
            print(f"Error copying image: {e}")

        # 2. Move internal files to history
        timestamp = int(time.time())
        
        # Source paths
        src_csv = self.approved_dir / f"{item_id}.csv"
        src_md = self.approved_dir / f"{item_id}.md"
        src_meta = self.approved_dir / f"{item_id}.meta.json"
        
        # Dest paths
        dst_csv = history_dir / f"{timestamp}_{item_id}.csv"
        dst_md = history_dir / f"{timestamp}_{item_id}.md"
        dst_meta = history_dir / f"{timestamp}_{item_id}.meta.json"
        
        if src_meta.exists():
            # Update the JSON with saved_at timestamp before moving
            try:
                with open(src_meta, "r") as f:
                    data = json.load(f)
                data["saved_at"] = timestamp
                data["saved_to_csv"] = str(target_csv_dir)
                data["saved_to_md"] = str(target_md_dir)
                with open(dst_meta, "w") as f:
                    json.dump(data, f, indent=2)
                os.remove(src_meta)
            except Exception as e:
                print(f"Error moving meta json: {e}")
        
        if src_csv.exists(): shutil.move(str(src_csv), str(dst_csv))
        if src_md.exists(): shutil.move(str(src_md), str(dst_md))
        
        # Move image too
        for f in self.approved_dir.glob(f"{item_id}_input*"):
            dst_img = history_dir / f"{timestamp}_{f.name}"
            shutil.move(str(f), str(dst_img))

        return {
            "count": len(saved_paths),
            "directory": str(target_csv_dir),
            "paths": saved_paths
        }

    def delete_approved_item(self, item_id: str):
        """
        Delete a single approved item from the stash.
        """
        # Delete CSV, MD, Meta
        (self.approved_dir / f"{item_id}.csv").unlink(missing_ok=True)
        (self.approved_dir / f"{item_id}.md").unlink(missing_ok=True)
        (self.approved_dir / f"{item_id}.meta.json").unlink(missing_ok=True)
        
        # Delete associated images
        for f in self.approved_dir.glob(f"{item_id}_input*"):
            f.unlink(missing_ok=True)

    def clear_approved_stash(self):
        """
        Delete ALL items from the approved stash.
        """
        for f in self.approved_dir.iterdir():
            if f.is_file():
                f.unlink()

    def get_staging_items(self) -> list[dict]:
        """
        Get list of items in STAGING (Drafts).
        """
        items = []
        for meta_file in self.staging_dir.glob("*.meta.json"):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                
                staging_id = meta_file.stem.replace(".meta", "")
                
                # Get basic info for the queue
                items.append({
                    "id": staging_id,
                    **metadata
                })
            except Exception as e:
                print(f"Error loading staging item {meta_file}: {e}")
        
        # Sort by modification time (newest first)
        items.sort(key=lambda x: (self.staging_dir / f"{x['id']}.meta.json").stat().st_mtime, reverse=True)
        return items

approval_service = ApprovalService()
