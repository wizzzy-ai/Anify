(function (global) {
    'use strict';

    const MIGRATIONS_KEY = 'anify-storage-migrations';

    function safeStorage() {
        try {
            return window.localStorage;
        } catch (error) {
            return null;
        }
    }

    function safeParseJson(value) {
        if (typeof value !== 'string') return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function readMigrations() {
        const raw = storageService.get(MIGRATIONS_KEY);
        const parsed = safeParseJson(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }

    function writeMigrations(migrations) {
        storageService.set(MIGRATIONS_KEY, JSON.stringify(migrations));
    }

    const storageService = {
        /**
         * Retrieve a value from storage by key.
         * @param {string} key
         * @returns {string|null}
         */
        get(key) {
            const storage = safeStorage();
            if (!storage) return null;
            try {
                return storage.getItem(key);
            } catch (error) {
                return null;
            }
        },

        /**
         * Store a value by key.
         * @param {string} key
         * @param {*} value
         */
        set(key, value) {
            const storage = safeStorage();
            if (!storage) return;
            try {
                if (typeof value === 'undefined') {
                    storage.removeItem(key);
                    return;
                }
                const normalizedValue = typeof value === 'string' ? value : JSON.stringify(value);
                storage.setItem(key, normalizedValue);
            } catch (error) {
                // Fail gracefully if storage is unavailable or quota is exceeded.
            }
        },

        /**
         * Remove a value from storage.
         * @param {string} key
         */
        remove(key) {
            const storage = safeStorage();
            if (!storage) return;
            try {
                storage.removeItem(key);
            } catch (error) {
                // Fail gracefully.
            }
        },

        /**
         * Clear all storage values.
         */
        clear() {
            const storage = safeStorage();
            if (!storage) return;
            try {
                storage.clear();
            } catch (error) {
                // Fail gracefully.
            }
        },

        /**
         * Get the current user id from storage or fall back to guest.
         * @returns {string}
         */
        getCurrentUserId() {
            if (global.authService && typeof global.authService.getCurrentUserId === 'function') {
                const authenticatedUserId = global.authService.getCurrentUserId();
                if (authenticatedUserId) return String(authenticatedUserId);
            }
            const userId = this.get('anify-user-id');
            return userId ? String(userId) : 'guest';
        },

        /**
         * Build a user-scoped storage key.
         * @param {string} baseKey
         * @returns {string}
         */
        getUserScopedKey(baseKey, explicitUserId = null) {
            const userId = explicitUserId ? String(explicitUserId) : this.getCurrentUserId();
            return `${baseKey}_${userId}`;
        },

        /**
         * Alias used by user-scoped services.
         * @param {string} baseKey
         * @param {string|null} explicitUserId
         * @returns {string}
         */
        getUserKey(baseKey, explicitUserId = null) {
            return this.getUserScopedKey(baseKey, explicitUserId);
        },

        /**
         * Read a value from a user-scoped storage key.
         * @param {string} baseKey
         * @returns {string|null}
         */
        getUserStorage(baseKey) {
            return this.get(this.getUserScopedKey(baseKey));
        },

        /**
         * Write a value to a user-scoped storage key.
         * @param {string} baseKey
         * @param {*} value
         */
        setUserStorage(baseKey, value) {
            this.set(this.getUserScopedKey(baseKey), value);
        },

        /**
         * Remove a value from a user-scoped storage key.
         * @param {string} baseKey
         */
        removeUserStorage(baseKey) {
            this.remove(this.getUserScopedKey(baseKey));
        },

        /**
         * Migrate a legacy storage key to a new storage key once.
         * @param {string} oldKey
         * @param {string} newKey
         * @returns {boolean}
         */
        migrateLegacyKey(oldKey, newKey) {
            if (!oldKey || !newKey || oldKey === newKey) return false;

            const migrations = readMigrations();
            if (migrations[oldKey] === newKey || migrations[newKey] === oldKey) {
                return false;
            }

            const existingNewValue = this.get(newKey);
            if (existingNewValue !== null) {
                return false;
            }

            const legacyValue = this.get(oldKey);
            if (legacyValue === null) {
                return false;
            }

            this.set(newKey, legacyValue);
            this.remove(oldKey);
            migrations[oldKey] = newKey;
            writeMigrations(migrations);
            return true;
        },
    };

    global.AnifyStorageService = storageService;
    global.storageService = storageService;
})(window);
