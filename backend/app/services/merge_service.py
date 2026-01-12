import pandas as pd
from pathlib import Path
from app.core.config import settings
import io
import json
from app.services.approval_service import approval_service

class MergeService:
    def __init__(self):
        self.output_dir = Path(settings.DATA_DIR) / "output"

    def find_similar_datasets(self, staging_id: str):
        """
        Compare the CSV in staging with existing CSVs in output.
        Returns a list of candidates with similarity scores.
        """
        staging_item = approval_service.get_staging_item(staging_id)
        if not staging_item:
            return []

        try:
            staging_df = pd.read_csv(io.StringIO(staging_item["csv"]))
            staging_cols = set(staging_df.columns)
        except Exception as e:
            print(f"Error reading staging CSV: {e}")
            return []

        candidates = []
        
        if not self.output_dir.exists():
            return []

        for csv_file in self.output_dir.glob("*.csv"):
            try:
                existing_df = pd.read_csv(csv_file)
                existing_cols = set(existing_df.columns)
                
                # Calculate Jaccard similarity of column names
                intersection = staging_cols.intersection(existing_cols)
                union = staging_cols.union(existing_cols)
                
                if not union:
                    continue
                    
                similarity = len(intersection) / len(union)
                
                # Threshold for "similarity" - can be tuned
                if similarity > 0.6:
                    candidates.append({
                        "filename": csv_file.name,
                        "path": str(csv_file),
                        "similarity": round(similarity, 2),
                        "common_columns": list(intersection),
                        "row_count": len(existing_df)
                    })
            except Exception as e:
                print(f"Error reading {csv_file}: {e}")
                continue
                
        return sorted(candidates, key=lambda x: x["similarity"], reverse=True)

    def merge_datasets(self, staging_id: str, target_filename: str):
        """
        Merge the staging CSV into the target CSV.
        """
        staging_item = approval_service.get_staging_item(staging_id)
        if not staging_item:
            raise ValueError("Staging item not found")

        target_path = self.output_dir / target_filename
        if not target_path.exists():
            raise FileNotFoundError(f"Target file {target_filename} not found")

        # Load DataFrames
        staging_df = pd.read_csv(io.StringIO(staging_item["csv"]))
        target_df = pd.read_csv(target_path)

        # Concatenate
        # ensure we don't have completely duplicate rows
        merged_df = pd.concat([target_df, staging_df], ignore_index=True)
        merged_df = merged_df.drop_duplicates()
        
        # Save back to target
        merged_df.to_csv(target_path, index=False)
        
        # Handle Markdown
        # For now, we will append the new metadata to the existing markdown file
        # assuming the markdown file has the same basename
        target_md_path = target_path.with_suffix(".md")
        if target_md_path.exists():
            with open(target_md_path, "a", encoding="utf-8") as f:
                f.write("\n\n---\n\n# Merged Update\n\n")
                f.write(staging_item["markdown"])
        
        # Clean up staging
        (approval_service.staging_dir / f"{staging_id}.csv").unlink()
        (approval_service.staging_dir / f"{staging_id}.md").unlink()

        return {
            "merged_file": str(target_path),
            "row_count": len(merged_df)
        }

    def merge_csvs(self, csv_contents: list[str]) -> str:
        """
        Merge multiple CSV strings into a single CSV string.
        Assumes all CSVs have the same structure/headers.
        """
        dfs = []
        for csv_str in csv_contents:
            try:
                if not csv_str.strip():
                    continue
                df = pd.read_csv(io.StringIO(csv_str))
                dfs.append(df)
            except Exception as e:
                print(f"Error parsing CSV for merge: {e}")
                
        if not dfs:
            return ""
            
        merged_df = pd.concat(dfs, ignore_index=True)
        return merged_df.to_csv(index=False)

    def merge_markdowns(self, md_contents: list[str]) -> str:
        """
        Merge multiple Markdown strings into a single Markdown string.
        Separates them with newlines and a separator.
        """
        merged_md = ""
        for i, md in enumerate(md_contents):
            if i > 0:
                merged_md += "\n\n---\n\n"
            merged_md += md
        return merged_md

    def preview_merge_items(self, item_ids: list[str]) -> dict:
        """
        Generate a preview of the merged content from a list of staging/approved items.
        """
        items = []
        for item_id in item_ids:
            # Try staging first, then approved
            item = approval_service.get_staging_item(item_id)
            if not item:
                # Check approved items
                csv_path = approval_service.approved_dir / f"{item_id}.csv"
                md_path = approval_service.approved_dir / f"{item_id}.md"
                if csv_path.exists():
                    with open(csv_path, "r", encoding="utf-8") as f:
                        csv = f.read()
                    with open(md_path, "r", encoding="utf-8") as f:
                        md = f.read()
                    item = {"csv": csv, "markdown": md}
            
            if item:
                items.append(item)

        csv_list = [item['csv'] for item in items if item.get('csv')]
        md_list = [item['markdown'] for item in items if item.get('markdown')]
        
        merged_csv = self.merge_csvs(csv_list)
        merged_md = self.merge_markdowns(md_list)
        
        return {
            "merged_csv": merged_csv,
            "merged_markdown": merged_md
        }

    def save_merged_items_as_new(self, item_ids: list[str], final_csv_name: str, final_md_name: str) -> dict:
        """
        Merge items and save as a new approved item.
        """
        # 1. Generate merged content
        preview = self.preview_merge_items(item_ids)
        merged_csv = preview["merged_csv"]
        merged_md = preview["merged_markdown"]
        
        if not merged_csv:
            raise ValueError("No CSV content to merge")

        # 2. Create a temporary staging item
        # We don't have a single original filename, so we can join them or use a generic one
        original_filenames = []
        for item_id in item_ids:
            item = approval_service.get_staging_item(item_id)
            if item and item.get("original_filename"):
                original_filenames.append(item["original_filename"])
        
        combined_original_name = " + ".join(original_filenames[:3])
        if len(original_filenames) > 3:
            combined_original_name += f" and {len(original_filenames) - 3} more"

        staging_id = approval_service.save_to_staging(
            csv_content=merged_csv,
            md_content=merged_md,
            original_filename=combined_original_name,
            suggested_csv_name=final_csv_name,
            suggested_md_name=final_md_name
        )

        # 3. Approve it immediately
        result = approval_service.approve_item(
            staging_id=staging_id,
            csv_filename=final_csv_name,
            md_filename=final_md_name
        )
        
        # 4. Cleanup original staging items? 
        # Maybe we should leave them or mark them as merged?
        # For now, let's leave them in staging so the user can still access them if needed,
        # or the frontend can decide to remove them from the list.
        # Actually, if we are "merging" them, usually we want to consume them.
        # But let's be safe and keep them for now.
        
        return result

    def suggest_merges(self) -> list[dict]:
        """
        Use AI to analyze all staging items and suggest merge groups.
        """
        from app.services.ai_service import ai_service
        from app.core.system_prompts import MERGE_SUGGESTION_PROMPT
        
        # 1. Gather info on all staging items
        staging_files = list(approval_service.staging_dir.glob("*.meta.json"))
        if not staging_files:
            return []
            
        dataset_info = []
        for meta_file in staging_files:
            try:
                item_id = meta_file.stem.replace(".meta", "")
                item = approval_service.get_staging_item(item_id)
                if not item: continue
                
                # Parse CSV headers
                try:
                    df = pd.read_csv(io.StringIO(item["csv"]), nrows=0)
                    columns = list(df.columns)
                except:
                    columns = []
                    
                # Extract title from markdown (simple heuristic)
                title = item.get("suggested_md_name", "").replace(".md", "")
                # Or try to parse first line of MD
                if item["markdown"].startswith("#"):
                    title = item["markdown"].split("\n")[0].replace("#", "").strip()
                
                dataset_info.append({
                    "id": item["id"],
                    "filename": item.get("suggested_csv_name") or item.get("original_filename"),
                    "columns": columns,
                    "title": title
                })
            except Exception as e:
                print(f"Error processing item for merge suggestion: {e}")
                
        if len(dataset_info) < 2:
            return []
            
        # 2. Call AI
        try:
            prompt_content = f"Hier zijn de datasets:\n{json.dumps(dataset_info, indent=2)}"
            response = ai_service.process_content(
                content=prompt_content,
                context=MERGE_SUGGESTION_PROMPT
            )
            
            # 3. Parse JSON response
            # Clean up potential markdown code blocks
            clean_response = response.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_response)
            return data.get("suggestions", [])
            
        except Exception as e:
            print(f"Error generating merge suggestions: {e}")
            return []

    def suggest_image_merges(self, items: list[dict]) -> list[dict]:
        """
        Use AI to group proposed images based on their labels and types.
        """
        from app.services.ai_service import ai_service
        
        if len(items) < 2:
            return []
            
        # Prepare prompt
        prompt = """
        You are a data organization assistant. You have a list of images extracted from PDF reports.
        Your task is to group images that likely represent the SAME data table or figure but from DIFFERENT years, reports, or pages.
        
        Input List:
        {items_json}
        
        Output Format (JSON):
        {
          "groups": [
            {
              "title": "Revenue Tables (2023-2024)",
              "reason": "Matching labels indicating revenue data.",
              "items": [
                {"filename": "file1.png", "pdf": "report2023.pdf"},
                {"filename": "file2.png", "pdf": "report2024.pdf"}
              ]
            }
          ]
        }
        
        Rules:
        - Group items that are semantically similar.
        - Look for similar titles (e.g., "Balance Sheet 2023" and "Balance Sheet 2024").
        - **CRITICAL**: If labels are generic (e.g. "Untitled", "Table"), rely heavily on the FILENAME and PDF NAME.
        - **FOR LOCAL FILES**: Use the 'path' or 'filename' to group files that are in the same directory or share naming conventions.
        - Group items if they appear to be the same type of data from different years or sources.
        - Be lenient: if two items look like they belong to the same series (e.g. "Table 1" and "Table 1 (continued)"), group them.
        - If you are unsure, err on the side of grouping them if they share keywords.
        - Return ONLY JSON.
        """
        
        # Minify items for prompt
        mini_items = []
        for item in items:
            mini_items.append({
                "filename": item.get("filename"),
                "label": item.get("label"),
                "type": item.get("type"),
                "pdf": item.get("pdf_name"),
                "path": item.get("path") or item.get("full_path")
            })
            
        try:
            print(f"DEBUG: suggest_image_merges input items: {len(mini_items)}")
            # print(f"DEBUG: suggest_image_merges input payload: {json.dumps(mini_items, indent=2)}") # Uncomment for verbose logging

            prompt_content = prompt.replace("{items_json}", json.dumps(mini_items, indent=2))
            response = ai_service.process_content(
                content=prompt_content,
                context="Grouping task based on labels."
            )
            
            print(f"DEBUG: suggest_image_merges raw AI response: {response}")

            clean_response = response.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_response)
            groups = data.get("groups", [])
            print(f"DEBUG: suggest_image_merges parsed groups: {len(groups)}")
            return groups
            
        except Exception as e:
            print(f"Error suggesting image merges: {e}")
            return []

merge_service = MergeService()
