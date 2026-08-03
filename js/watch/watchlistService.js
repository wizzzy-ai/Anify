(function (global) {
    'use strict';

    // URL utility to convert HTTP to HTTPS
    function ensureHttps(url) {
        if (!url || typeof url !== 'string') return url;
        return url.replace(/^http:/, 'https:');
    }

    const STORAGE_KEY_PREFIX = 'watchlist';
    const LEGACY_KEY_PREFIX = 'watchlist_';

    let entries = [];

    function safeParseJson(value) {
        if (typeof value !== 'string') return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function getCurrentUserId() {
        if (global.authService && typeof global.authService.getCurrentUserId === 'function') {
            const currentUserId = global.authService.getCurrentUserId();
            if (currentUserId) return String(currentUserId);
            if (global.authService && typeof global.authService.isAuthenticated === 'function' && !global.authService.isAuthenticated()) {
                return 'guest';
            }
        }
        return 'guest';
    }

    function getCurrentUsername() {
        if (global.authService && typeof global.authService.getCurrentUsername === 'function') {
            const currentUsername = global.authService.getCurrentUsername();
            if (currentUsername) return String(currentUsername);
        }
        return null;
    }

    function getStorageKey(userId) {
        return `${STORAGE_KEY_PREFIX}_${userId || 'guest'}`;
    }

    function normalizeEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const animeId = Number(entry.id ?? entry.animeId);
        if (!Number.isFinite(animeId)) return null;

        return {
            id: animeId,
            title: entry.title || entry.name || null,
            image: ensureHttps(entry.image || entry.poster || null),
            type: entry.type || 'anime',
            episodes: entry.episodes || null,
            rating: entry.rating || null,
            genre: entry.genre || (Array.isArray(entry.genres) ? entry.genres[0] : undefined),
            addedAt: Number(entry.addedAt) || Date.now(),
        };
    }

    function normalizeEntries(rawEntries) {
        if (!Array.isArray(rawEntries)) return [];

        const normalized = rawEntries
            .map(normalizeEntry)
            .filter(Boolean);

        return normalized.filter((item, index, list) => list.findIndex(other => other.id === item.id) === index);
    }

    function persistEntries() {
        const storageKey = getStorageKey(getCurrentUserId());
        if (!global.authService || typeof global.authService.isAuthenticated !== 'function' || !global.authService.isAuthenticated()) {
            entries = [];
            return;
        }
        if (global.storageService && typeof global.storageService.set === 'function') {
            global.storageService.set(storageKey, JSON.stringify(entries));
        }
    }

    function loadEntriesForUser(userId) {
        const storageKey = getStorageKey(userId || 'guest');
        const username = getCurrentUsername();
        const legacyKey = username && username !== 'guest' ? `${LEGACY_KEY_PREFIX}${username}` : null;
        if (legacyKey && global.storageService && typeof global.storageService.migrateLegacyKey === 'function') {
            global.storageService.migrateLegacyKey(legacyKey, storageKey);
        }

        const rawValue = global.storageService && typeof global.storageService.get === 'function'
            ? global.storageService.get(storageKey)
            : null;
        const parsedValue = safeParseJson(rawValue);
        entries = normalizeEntries(parsedValue || []);
        return entries.slice();
    }

    const watchlistService = {
        getEntries() {
            return entries.slice();
        },

        restore() {
            const userId = getCurrentUserId();
            if (!userId) {
                entries = [];
                return [];
            }
            return loadEntriesForUser(userId);
        },

        save() {
            persistEntries();
            return this.getEntries();
        },

        add(anime) {
            if (!anime) return false;
            if (!global.authService || typeof global.authService.isAuthenticated !== 'function' || !global.authService.isAuthenticated()) {
                entries = [];
                return false;
            }

            const animeId = Number(anime.id);
            if (!Number.isFinite(animeId)) return false;
            if (this.has(animeId)) return false;

            const entry = {
                id: animeId,
                title: anime.title,
                image: anime.image,
                type: anime.type || 'anime',
                episodes: anime.episodes,
                rating: anime.rating,
                genre: Array.isArray(anime.genres) ? anime.genres[0] : undefined,
                addedAt: Date.now(),
            };

            entries = [entry, ...entries].filter((item, index, list) => list.findIndex(other => Number(other.id) === Number(item.id)) === index);
            persistEntries();
            return true;
        },

        remove(animeId) {
            const id = Number(animeId);
            const before = entries.length;
            entries = entries.filter(item => Number(item.id) !== id);
            const changed = entries.length !== before;
            if (changed) persistEntries();
            return changed;
        },

        clear() {
            entries = [];
            persistEntries();
            return this.getEntries();
        },

        has(animeId) {
            const id = Number(animeId);
            return this.getEntries().some(item => Number(item.id) === id);
        },

        getEntry(animeId) {
            const id = Number(animeId);
            return this.getEntries().find(item => Number(item.id) === id) || null;
        },
    };

    global.WatchlistService = watchlistService;
    global.watchlistService = watchlistService;
})(window);
