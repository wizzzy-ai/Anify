(function (global) {
    'use strict';

    async function loadAnimeFromApi() {
        console.log('[Anime Management] Loading anime data from API...');
        try {
            const res = await fetch('/api/anime');
            const data = await res.json().catch(() => ({}));
            console.log('[Anime Management] API response:', data);
            
            if (res.ok && data.ok && Array.isArray(data.anime)) {
                console.log('[Anime Management] Updating animeData with', data.anime.length, 'items');
                console.log('[Anime Management] Sample anime status:', data.anime[0]?.status);
                
                global.animeData.splice(0, global.animeData.length, ...data.anime);
                console.log('[Anime Management] Anime data updated successfully');
                return true;
            } else {
                console.error('[Anime Management] API response not ok or invalid data:', data);
            }
        } catch (e) {
            console.warn('[Anime Management] Using local anime data:', e.message);
        }
        return false;
    }

    async function saveAnimeToApi(anime, isEdit = false) {
        const token = global.authService && typeof global.authService.getToken === 'function'
            ? global.authService.getToken()
            : null;

        if (!token) {
            console.warn('Saved locally only: Missing token');
            return null;
        }

        try {
            console.log('[Anime Management] Sending anime to API:', anime.title);
            console.log('[Anime Management] Anime payload status:', anime.status);
            console.log('[Anime Management] Anime payload keys:', Object.keys(anime));
            console.log('[Anime Management] Anime ID:', anime.id, 'Client ID:', anime.clientId);
            
            // Use clientId if id is not available for edit operations
            const animeId = anime.id || anime.clientId;
            if (isEdit && !animeId) {
                console.error('[Anime Management] Cannot edit anime: missing ID');
                throw new Error('Anime ID is required for edit operations');
            }
            
            const res = await fetch(isEdit ? `/api/anime/${animeId}` : '/api/anime', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(anime),
            });
            const data = await res.json().catch(() => ({}));
            console.log('[Anime Management] API response:', data);
            if (!res.ok || !data.ok) throw new Error(data.error || 'Database save failed.');
            return data.anime;
        } catch (e) {
            console.warn('Saved locally only:', e.message);
            return null;
        }
    }

    async function deleteAnimeFromApi(id) {
        const token = global.authService && typeof global.authService.getToken === 'function'
            ? global.authService.getToken()
            : null;

        if (!token) {
            throw new Error('Missing token');
        }

        const res = await fetch(`/api/anime/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
    }


    function restoreAdminAnimeData() {
        try {
            const saved = JSON.parse(global.storageService.get('anify-admin-anime-data') || 'null');
            if (Array.isArray(saved) && saved.length) {
                global.animeData.splice(0, global.animeData.length, ...saved);
            }
        } catch (e) {
            console.warn('Could not restore admin anime data:', e);
        }
    }

    function saveAdminAnimeData() {
        try {
            global.storageService.set('anify-admin-anime-data', JSON.stringify(global.animeData));
        } catch (e) {
            console.warn('Could not save admin anime data:', e);
        }
    }

    const animeManagement = {
        loadAnimeFromApi,
        saveAnimeToApi,
        deleteAnimeFromApi,
        restoreAdminAnimeData,
        saveAdminAnimeData,
    };

    global.animeManagement = animeManagement;
})(window);
