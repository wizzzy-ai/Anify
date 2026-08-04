(function (global) {
    'use strict';

    async function loadAnimeFromApi() {
        console.log('[API LOAD] ========== LOADING ANIME DATA FROM API ==========');
        console.log('[API LOAD] BEFORE - Current animeData length:', global.animeData?.length || 0);
        if (global.animeData && global.animeData.length > 0) {
            console.log('[API LOAD] BEFORE - Sample current anime status:', global.animeData[0]?.status);
        }
        
        try {
            const res = await fetch('/api/anime');
            const data = await res.json().catch(() => ({}));
            console.log('[API LOAD] API response received:', data);
            
            if (res.ok && data.ok && Array.isArray(data.anime)) {
                console.log('[API LOAD] SUCCESS - Updating animeData with', data.anime.length, 'items');
                console.log('[API LOAD] SUCCESS - Sample API anime status:', data.anime[0]?.status);
                
                global.animeData.splice(0, global.animeData.length, ...data.anime);
                
                console.log('[API LOAD] AFTER - New animeData length:', global.animeData.length);
                console.log('[API LOAD] AFTER - Sample new anime status:', global.animeData[0]?.status);
                console.log('[API LOAD] ========== API LOAD COMPLETE ==========');
                return true;
            } else {
                console.error('[API LOAD] ERROR - API response not ok or invalid data:', data);
            }
        } catch (e) {
            console.warn('[API LOAD] ERROR - API fetch failed, using localStorage fallback:', e.message);
        }
        
        // Fallback to localStorage only if API fails
        console.log('[API LOAD] FALLBACK - Loading from localStorage...');
        restoreAdminAnimeData();
        console.log('[API LOAD] FALLBACK - animeData length after restore:', global.animeData?.length || 0);
        console.log('[API LOAD] ========== API LOAD COMPLETE (WITH FALLBACK) ==========');
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
            console.log('[CREATE ANIME] Frontend payload:', JSON.stringify(anime, null, 2));
            
            // Use clientId if id is not available for edit operations
            const animeId = anime.id || anime.clientId;
            if (isEdit && !animeId) {
                console.error('[Anime Management] Cannot edit anime: missing ID');
                throw new Error('Anime ID is required for edit operations');
            }
            
            const url = isEdit ? `/api/anime/${animeId}` : '/api/anime';
            const method = isEdit ? 'PUT' : 'POST';
            console.log('[CREATE TRACE] HTTP METHOD:', method);
            console.log('[CREATE TRACE] URL:', url);
            console.log('[CREATE TRACE] REQUEST BODY:', JSON.stringify(anime, null, 2));
            
            const res = await fetch(url, {
                method: method,
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
