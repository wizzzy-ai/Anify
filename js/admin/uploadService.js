(function (global) {
    'use strict';

    const UPLOAD_ENDPOINT = '/api/upload-media';

    async function fetchJson(request) {
        const res = await fetch(request);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            const err = data && data.error ? data.error : `Upload failed (HTTP ${res.status})`;
            throw new Error(err);
        }
        return data;
    }

    async function uploadMedia(file, onProgress = null, options = {}) {
        if (!file) throw new Error('No file provided for upload.');

        const endpoint = options.endpoint || UPLOAD_ENDPOINT;
        const fieldName = options.fieldName || 'media';

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append(fieldName, file);

            // Add video type and metadata for video uploads
            if (options.videoType) {
                formData.append('videoType', options.videoType);
            }
            if (options.metadata) {
                formData.append('metadata', JSON.stringify(options.metadata));
            }

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    const pct = (e.loaded / e.total) * 100;
                    onProgress(pct);
                }
            });

            xhr.addEventListener('load', () => {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
                        resolve(data);
                    } else {
                        reject(new Error(data.error || `Upload failed (${xhr.status})`));
                    }
                } catch (e) {
                    // Log the actual response for debugging
                    console.error('[Upload Service] Server response:', xhr.responseText);
                    console.error('[Upload Service] Status:', xhr.status);
                    console.error('[Upload Service] Content-Type:', xhr.getResponseHeader('Content-Type'));
                    reject(new Error(`Invalid response from server. Status: ${xhr.status}. Response: ${xhr.responseText.substring(0, 200)}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted.')));

            xhr.open('POST', endpoint);
            
            // Add Auth header if available
            if (global.getAuthToken && typeof global.getAuthToken === 'function') {
                const token = global.getAuthToken();
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.send(formData);
        });
    }

    // Episode and movie files are playback content, so the server stores them
    // in Cloudflare R2. Banner videos use uploadMedia directly.
    async function uploadVideo(file, onProgress = null, videoType = 'content', metadata = {}) {
        return uploadMedia(file, onProgress, {
            videoType,
            metadata,
            endpoint: '/api/upload-video',
            fieldName: 'video',
        });
    }

    function validateUploadFile(file, types = ['image/', 'video/'], maxSizeMb = 1024) {
        if (!file) return { valid: false, error: 'No file selected.' };
        if (typeof file.size !== 'number' || file.size <= 0) {
            return { valid: false, error: 'Selected file is invalid.' };
        }
        const sizeMb = file.size / 1024 / 1024;
        if (sizeMb > maxSizeMb) {
            return { valid: false, error: `File must be smaller than ${maxSizeMb}MB.` };
        }
        const mimeType = String(file.type || '').toLowerCase();
        if (!types.some(t => mimeType.startsWith(t))) {
            return { valid: false, error: 'Unsupported file type.' };
        }
        return { valid: true, error: null };
    }

    function getUploadFile(inputId) {
        const input = document.getElementById(inputId);
        return input?.files?.[0] || null;
    }

    const uploadService = {
        uploadMedia,
        uploadVideo,
        validateUploadFile,
        getUploadFile,
    };

    global.uploadService = uploadService;
})(window);
