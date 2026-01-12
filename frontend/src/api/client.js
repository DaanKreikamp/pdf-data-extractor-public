
import axios from 'axios';

const client = axios.create({
    baseURL: 'http://localhost:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
    // timeout: 300000, // Removed timeout as requested
});

export const uploadPDF = async (file, mode = 'content') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const response = await client.post('/pdf/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const uploadImage = async (file, process = true) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await client.post(`/image/upload?process=${process}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const updateStaging = async (id, csv, markdown, suggestedCsvName = null, suggestedMdName = null) => {
    const response = await client.put(`/approval/staging/${id}`, {
        csv,
        markdown,
        suggested_csv_name: suggestedCsvName,
        suggested_md_name: suggestedMdName
    });
    return response.data;
};

export const approveItem = async (id, csvFilename, mdFilename) => {
    const response = await client.post(`/approval/approve/${id}`, {
        csv_filename: csvFilename,
        md_filename: mdFilename
    });
    return response.data;
};

export const checkMerge = async (stagingId) => {
    const response = await client.get(`/merge/check/${stagingId}`);
    return response.data;
};

export const executeMerge = async (stagingId, targetFilename) => {
    const response = await client.post(`/merge/execute/${stagingId}`, { target_filename: targetFilename });
    return response.data;
};

export const getMergeSuggestions = async () => {
    const response = await client.get('/merge/suggestions');
    return response.data;
};

export const suggestImageMerges = async (items) => {
    const response = await client.post('/merge/suggest-images', { items });
    return response.data;
};

export const executeMergeGroup = async (items, userPrompt = "") => {
    const response = await client.post('/merge/execute-group', { items, user_prompt: userPrompt });
    return response.data;
};

// --- Global Context ---
export const getGlobalContext = async () => {
    const response = await client.get('/context/');
    return response.data;
};

export const updateGlobalContext = async (text) => {
    const response = await client.post('/context/', { text });
    return response.data;
};

export const resetGlobalContext = async () => {
    const response = await client.delete('/context/');
    return response.data;
};

export const removeContextFile = async (filename) => {
    const response = await client.delete(`/context/${filename}`);
    return response.data;
};

export const getApprovedItems = async () => {
    const response = await client.get('/approval/approved');
    return response.data;
};

export const saveAllApproved = async (csvDir = null, mdDir = null) => {
    const response = await client.post('/approval/save-all', { csv_dir: csvDir, md_dir: mdDir });
    return response.data;
};

export const saveApprovedItem = async (id, csvDir = null, mdDir = null) => {
    const response = await client.post(`/approval/approved/${id}/save`, { csv_dir: csvDir, md_dir: mdDir });
    return response.data;
};

export const getApprovedContent = async (id) => {
    const response = await client.get(`/approval/approved/${id}/content`);
    return response.data;
};

export const updateApprovedItem = async (id, csv, markdown, finalCsvName = null, finalMdName = null) => {
    const response = await client.put(`/approval/approved/${id}`, {
        csv,
        markdown,
        final_csv_name: finalCsvName,
        final_md_name: finalMdName
    });
    return response.data;
};

export const deleteApprovedItem = async (id) => {
    const response = await client.delete(`/approval/approved/${id}`);
    return response.data;
};

export const clearApprovedStash = async () => {
    const response = await client.delete(`/approval/approved`);
    return response.data;
};

export const redoImage = async (stagingId, feedback) => {
    const response = await client.post(`/image/redo/${stagingId}`, { feedback });
    return response.data;
};

export const getHistoryItems = async () => {
    const response = await client.get(`/approval/history`);
    return response.data;
};

export const getProposedScreenshots = async (filename) => {
    const response = await client.get(`/pdf/proposed/${filename}`);
    return response.data;
};

export const acceptProposedScreenshot = async (filename, imageFilename) => {
    const response = await client.post(`/pdf/proposed/accept`, {
        filename: filename,
        image_filename: imageFilename
    });
    return response.data;
};

export const getPdfStatus = async (filename) => {
    const response = await client.get(`/pdf/status/${filename}`);
    return response.data;
};

// --- Settings ---
export const getSettings = async () => {
    const response = await client.get('/settings');
    return response.data;
};

export const updateSettings = async (settings) => {
    const response = await client.post('/settings', settings);
    return response.data;
};

// --- Utils ---
export const browseFolder = async () => {
    const response = await client.get('/utils/browse-folder');
    return response.data;
};

export const listImages = async (path) => {
    const response = await client.get(`/utils/list-images?path=${encodeURIComponent(path)}`);
    return response.data;
};

export const processLocalImage = async (path) => {
    // Stub for now, can be implemented if backend has /image/process-local
    console.warn("processLocalImage called but backend route not confirmed.");
    return { error: "Not implemented" };
};

export const extractImages = async (filename) => {
    const response = await client.post(`/pdf/extract/${filename}`);
    return response.data;
};



export default client;
