import tkinter as tk
from tkinter import filedialog
import os
import glob

class UtilsService:
    def browse_folder(self) -> str:
        """
        Open a native folder selection dialog and return the selected path.
        Returns empty string if cancelled.
        """
        try:
            # Create a hidden root window
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', 1) # Ensure dialog is on top
            
            # Open dialog
            folder_path = filedialog.askdirectory()
            
            # Destroy root
            root.destroy()
            
            return folder_path if folder_path else ""
        except Exception as e:
            print(f"Error browsing folder: {e}")
            return ""

    def list_images(self, folder_path: str):
        if not folder_path or not os.path.exists(folder_path):
            return {"error": "Path does not exist"}
        
        images = []
        exts = ('jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP')
        
        try:
            for file in os.listdir(folder_path):
                 if file.lower().endswith(exts):
                     full_path = os.path.join(folder_path, file)
                     if os.path.isfile(full_path):
                        images.append({
                            "name": file,
                            "path": full_path
                        })
        except Exception as e:
            return {"error": str(e)}
        
        return {"images": images}

utils_service = UtilsService()
