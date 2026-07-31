(function (global) {
    'use strict';

    async function loadAnimeFromApi() {
        try {
            const res = await fetch('/api/anime');
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok && Array.isArray(data.anime)) {
                global.animeData.splice(0, global.animeData.length, ...data.anime);
                return true;
            }
        } catch (e) {
            console.warn('Using local anime data:', e.message);
        }
        return false;
    }

    async function saveAnimeToApi(anime, isEdit = false) {
        try {
            const res = await fetch(isEdit ? `/api/anime/${anime.id}` : '/api/anime', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...anime, clientId: Number(anime.id) || undefined }),
            });
            const data = await res.json().catch(() => ({}));
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
