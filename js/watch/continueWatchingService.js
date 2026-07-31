(function (global) {
    'use strict';

    const STORAGE_KEY_PREFIX = 'continueWatching';
    const LEGACY_KEY = 'anify-continue-watching';

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
        }
        return null;
    }

    function getStorageKey(userId) {
        return global.storageService && typeof global.storageService.getUserKey === 'function'
            ? global.storageService.getUserKey(STORAGE_KEY_PREFIX, userId)
            : `${STORAGE_KEY_PREFIX}_${userId}`;
    }

    function normalizeEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const animeId = Number(entry.id ?? entry.animeId);
        if (!Number.isFinite(animeId)) return null;

        return {
            id: animeId,
            episode: Number(entry.episode) || 1,
            episodeTitle: entry.episodeTitle || '',
            progress: Math.min(100, Math.max(0, Number(entry.progress) || 0)),
            time: Math.max(0, Math.round(Number(entry.time) || 0)),
            duration: Number(entry.duration) || 0,
            remainingTime: Number(entry.remainingTime) || 0,
            language: entry.language || 'sub',
            quality: entry.quality || '1080p',
            updatedAt: Number(entry.updatedAt) || Date.now(),
        };
    }

    function normalizeEntries(rawEntries) {
        if (!Array.isArray(rawEntries)) return [];

        const normalized = rawEntries
            .map(normalizeEntry)
            .filter(Boolean);

        return normalized
            .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 24); // Increased limit for lazy loading
    }

    const WATCH_HISTORY_KEY_PREFIX = 'watchHistory';

    function persistEntries() {
        const userId = getCurrentUserId();
        if (!userId) {
            entries = [];
            return;
        }
        const storageKey = getStorageKey(userId);
        storageService.set(storageKey, JSON.stringify(entries));
    }

    function loadEntriesForUser(userId) {
        if (!userId) {
            entries = [];
            return [];
        }
        const storageKey = getStorageKey(userId);
        if (global.storageService && typeof global.storageService.migrateLegacyKey === 'function') {
            global.storageService.migrateLegacyKey(LEGACY_KEY, storageKey);
        }

        const rawValue = global.storageService && typeof global.storageService.get === 'function'
            ? global.storageService.get(storageKey)
            : null;
        const parsedValue = safeParseJson(rawValue);
        entries = normalizeEntries(parsedValue || []);
        return entries.slice();
    }

    const continueWatchingService = {
        /**
         * Return a copy of the current in-memory continue-watching entries.
         * @returns {Array<object>}
         */
        getEntries() {
            return entries.slice();
        },

        /**
         * Restore continue-watching entries for the current authenticated user.
         * @returns {Array<object>}
         */
        restore() {
            const userId = getCurrentUserId();
            if (!userId) {
                entries = [];
                return [];
            }
            return loadEntriesForUser(userId);
        },

        /**
         * Persist the current in-memory continue-watching state for the current user.
         * @returns {Array<object>}
         */
        save() {
            persistEntries();
            return this.getEntries();
        },

        /**
         * Update or insert a continue-watching entry for the current user.
         * @param {object} entry
         * @returns {object|null}
         */
        update(entry) {
            const normalizedEntry = normalizeEntry(entry);
            if (!normalizedEntry) return null;

            const existingIndex = entries.findIndex(item => item.id === normalizedEntry.id);
            if (existingIndex >= 0) {
                entries[existingIndex] = { ...entries[existingIndex], ...normalizedEntry };
            } else {
                entries.unshift(normalizedEntry);
            }

            entries = normalizeEntries(entries);
            persistEntries();
            return this.getEntries().find(item => item.id === normalizedEntry.id) || null;
        },

        /**
         * Remove a continue-watching entry for the current user.
         * @param {number|string} animeId
         * @returns {Array<object>}
         */
        remove(animeId) {
            const id = Number(animeId);
            entries = entries.filter(item => Number(item.id) !== id);
            persistEntries();
            return this.getEntries();
        },

        /**
         * Clear in-memory continue-watching state for the current user without deleting stored data.
         * @returns {Array<object>}
         */
        clear() {
            entries = [];
            return this.getEntries();
        },

        /**
         * Return a single entry for the requested anime id, if present.
         * @param {number|string} animeId
         * @returns {object|null}
         */
        getEntry(animeId) {
            const id = Number(animeId);
            return this.getEntries().find(item => Number(item.id) === id) || null;
        },

        addToWatchHistory(animeId, episodeNumber) {
            const userId = getCurrentUserId();
            if (!userId) return;
            const key = `${WATCH_HISTORY_KEY_PREFIX}_${userId}`;
            const historyRaw = global.storageService?.get(key);
            let history = safeParseJson(historyRaw) || [];
            if (!Array.isArray(history)) history = [];
            
            const entry = { id: Number(animeId), episode: Number(episodeNumber), timestamp: Date.now() };
            history.unshift(entry);
            history = history.slice(0, 50); // Keep last 50
            if (global.storageService?.set) {
                global.storageService.set(key, JSON.stringify(history));
            }
        },
    };

    global.addToWatchHistory = continueWatchingService.addToWatchHistory.bind(continueWatchingService);
    global.ContinueWatchingService = continueWatchingService;
    global.continueWatchingService = continueWatchingService;
})(window);
