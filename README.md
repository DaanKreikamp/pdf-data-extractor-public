# PDF Data Extractor

A powerful tool for extracting, analyzing, and structuring data from PDF documents using AI. This application combines a FastAPI backend with a React frontend to provide a seamless workflow for extracting tables and figures from PDFs, analyzing them with Large Language Models (like Gemini), and exporting structured datasets (CSV) and documentation (Markdown).

## 🚀 Key Features

*   **Smart PDF Extraction**: Automatically detects and extracts images, figures, and tables from PDF reports.
*   **AI-Powered Analysis**: Uses Gemini Vision (and other models) to analyze extracted images, generate detailed descriptions, and convert tables into CSV data.
*   **Interactive Review Queue**: A dedicated UI for reviewing AI suggestions, editing metadata, and refining CSV outputs before saving.
*   **Auto-Grouping**: Intelligent algorithms (powered by AI) to group related images across different pages or documents (e.g., "Revenue Table 2023" and "Revenue Table 2024").
*   **Dataset Merging**: Tools to merge multiple processed items into single comprehensive datasets with unified metadata.
*   **Approval Workflow**: A staging-to-approval workflow that ensures only verified data makes it to your final output.
*   **Multi-Model Support**: Switch between different AI models (Gemini 1.5 Flash, Pro, etc.) to balance speed and accuracy.

---

## 🛠️ Architecture

The project is built as a full-stack application:

*   **Frontend**: React (Vite) + Tailwind CSS. Provides a modern, dark-mode interface for uploading files, managing the queue, and reviewing data.
*   **Backend**: Python (FastAPI). Handles PDF processing, image generation, AI API coordination, and file management.
*   **Storage**: Local file system based (`data/` directory) for transparency and portability.
*   **AI Engine**: Integration with Google Gemini (and potentially others) via `google-generativeai`.

---

## 📦 Prerequisites

*   **Python**: 3.10 or higher.
*   **Node.js**: 16.x or higher (for frontend).
*   **Google Cloud API Key**: Access to Gemini API.

---

## ⚡ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd pdf-data-extractor
```

### 2. Backend Setup
Set up the Python environment and dependencies.

```bash
cd backend
python -m venv venv

# Activate Virtual Environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt
```

**Configuration**:
Create a `.env` file in the `backend/` directory:
```env
GOOGLE_API_KEY=your_api_key_here
# Optional:
LOG_LEVEL=INFO
```

### 3. Frontend Setup
Install the Node.js dependencies.

```bash
cd ../frontend
npm install
```

---

## 🏃 Running the Application

You need to run both the backend and frontend servers.

### Start Backend
In the `backend` directory (with venv activated):
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*   API Docs: http://localhost:8000/docs
*   Server: http://localhost:8000

### Start Frontend
In the `frontend` directory:
```bash
npm run dev
```
*   UI: http://localhost:5173 (usually)

---

## 📖 User Guide & Workflows

### 1. Uploading & Extraction
*   **PDF Upload**: Upload PDF files into the "Upload PDF" section.
*   **Modes**:
    *   *Context Only*: Extracts text for RAG/Context purposes without processing images immediately.
    *   *Full Extraction*: Extracts all images and tables from the PDF pages.
*   **Proposed Screenshots**: Extracted images appear in the "Proposed Screenshots" panel, grouped by PDF. You can click any image to view it or add it to the processing queue.

### 2. The Auto-Grouping Workflow
Instead of processing images one by one, use the **Suggestions Manager**:
1.  Open the Suggestions Manager (Star/Sparkles icon).
2.  Click **"✨ Auto-Group"**. The AI will analyze all unorganized images and suggest groups based on visual similarity or content (e.g., grouping "Balance Sheet" from three different PDFs).
3.  Review the groups, rename them if needed, and click **"Queue Group"** to batch process them.

### 3. Review & Approval
Items added to the queue appear in the **Review Queue** (right sidebar).
*   **Processing**: The system sends the image(s) + PDF context to the AI.
*   **Review**: Click an item to open the **Review Panel**.
    *   *Left*: The original image(s).
    *   *Right*: The generated Markdown documentation and the extracted CSV data.
*   **Edit**: You can directly edit the Markdown or CSV content.
*   **Context**: The "Context Panel" shows what text from the PDF was used to inform the AI's analysis (Bottom left of the screen).
*   **Decline & Redo**: Click "Decline & Redo" to remove the item from the queue, append a new prompt and reprocess it.
*   **Save Draft**: Click "Save Draft" to keep changes to the item in the queue. You can approve it later.
*   **Approve**: Click "Approve & Save" to finalize the item. It moves to the "Approved Files" stash.

### 4. Merging Datasets
If you have multiple images (e.g., three separate tables from different years) that should be merged into one file:
1.  Create a group manually or using the Auto-Group feature.
2.  Optional: Append additional instructions to the group.
3.  Click "Add to queue" to combine the images into a combined CSV and Markdown documentation.
4.  This creates a new "Approved" item containing the combined data.

### 5. Output Management
*   **Approved Files**: Located in the top-right text list. These are your finalized artifacts.
*   **Save All**: Click the "Save All" button to export all approved items to your local disk (user-selected directory). The system exports pairs of:
    *   `filename.csv`
    *   `filename.md`

---

## 📂 Project Structure

```
pdf-data-extractor/
├── backend/                # FastAPI Application
│   ├── app/
│   │   ├── api/routes/     # API Endpoints (pdf.py, image.py, etc.)
│   │   ├── services/       # Core Logic (ai_service.py, merge_service.py)
│   │   └── models/         # Pydantic Models
│   └── data/               # Local data storage (input, output, staging)
│
├── frontend/               # React Application
│   ├── src/
│   │   ├── components/     # UI Components (ReviewPanel, Dashboard, etc.)
│   │   ├── pages/          # Main Views
│   │   └── api/            # Axios API wrappers
│   └── public/             # Static assets
│
└── cleanup_archive/        # Archived test scripts and logs
```

## ⚠️ Troubleshooting
*   **"Model Overloaded"**: If you see 503 errors, the AI model might be busy. Try switching models in the UI selector or waiting a moment.
*   **"Network Error"**: Ensure the backend server is running on port 8000.
*   **Data Not Saving**: Check permissions in the `backend/data` directory.
