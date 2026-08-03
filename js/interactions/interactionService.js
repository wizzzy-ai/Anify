(function (global) {
    'use strict';

    const FAVORITES_KEY_PREFIX = 'favorites';
    const RATINGS_KEY_PREFIX = 'ratings';

    let favorites = [];
    let ratings = {};

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

    function isUserActive() {
        if (!global.authService || typeof global.authService.getCurrentUser !== 'function') {
            return false;
        }
        const user = global.authService.getCurrentUser();
        if (!user) return false;
        
        // Check if user is banned or pending
        const status = user.status || 'Active';
        return status === 'Active';
    }

    function getStorageKey(prefix, userId) {
        return `${prefix}_${userId || 'guest'}`;
    }

    function persistFavorites() {
        const userId = getCurrentUserId();
        if (!global.authService || typeof global.authService.isAuthenticated !== 'function' || !global.authService.isAuthenticated()) {
            favorites = [];
            return;
        }
        if (global.storageService && typeof global.storageService.set === 'function') {
            global.storageService.set(getStorageKey(FAVORITES_KEY_PREFIX, userId), JSON.stringify(favorites));
        }
    }

    function persistRatings() {
        const userId = getCurrentUserId();
        if (!global.authService || typeof global.authService.isAuthenticated !== 'function' || !global.authService.isAuthenticated()) {
            ratings = {};
            return;
        }
        if (global.storageService && typeof global.storageService.set === 'function') {
            global.storageService.set(getStorageKey(RATINGS_KEY_PREFIX, userId), JSON.stringify(ratings));
        }
    }

    function loadFavoritesForUser(userId) {
        if (!global.storageService || typeof global.storageService.get !== 'function') {
            favorites = [];
            return favorites;
        }
        const rawValue = global.storageService.get(getStorageKey(FAVORITES_KEY_PREFIX, userId || 'guest'));
        const parsedValue = safeParseJson(rawValue);
        if (!Array.isArray(parsedValue)) {
            favorites = [];
            return favorites;
        }

        favorites = parsedValue
            .map(id => Number(id))
            .filter(id => Number.isFinite(id) && id > 0)
            .filter((id, index, list) => list.indexOf(id) === index);

        return favorites.slice();
    }

    function loadRatingsForUser(userId) {
        if (!global.storageService || typeof global.storageService.get !== 'function') {
            ratings = {};
            return ratings;
        }
        const rawValue = global.storageService.get(getStorageKey(RATINGS_KEY_PREFIX, userId || 'guest'));
        const parsedValue = safeParseJson(rawValue);
        if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
            ratings = {};
            return ratings;
        }

        ratings = Object.entries(parsedValue).reduce((acc, [key, value]) => {
            const id = Number(key);
            const rating = Number(value);
            if (Number.isFinite(id) && Number.isFinite(rating) && rating >= 0 && rating <= 10) {
                acc[String(id)] = rating;
            }
            return acc;
        }, {});

        return { ...ratings };
    }

    const interactionService = {
        getFavorites() {
            return favorites.slice();
        },

        getFavoriteCount() {
            return favorites.length;
        },

        getRatings() {
            return { ...ratings };
        },

        restore() {
            const userId = getCurrentUserId();
            if (!userId) {
                favorites = [];
                ratings = {};
                return { favorites: [], ratings: {} };
            }

            const rawFavorites = loadFavoritesForUser(userId);
            const rawRatings = loadRatingsForUser(userId);
            return { favorites: rawFavorites, ratings: rawRatings };
        },

        save() {
            persistFavorites();
            persistRatings();
            return { favorites: this.getFavorites(), ratings: this.getRatings() };
        },

        hasFavorite(animeId) {
            const id = Number(animeId);
            if (!Number.isFinite(id)) return false;
            return this.getFavorites().some(item => Number(item) === id);
        },

        addFavorite(animeId) {
            const id = Number(animeId);
            if (!Number.isFinite(id)) return false;
            if (!global.authService || typeof global.authService.isAuthenticated !== 'function' || !global.authService.isAuthenticated()) {
                return false;
            }
            if (!isUserActive()) {
                console.warn('User is not active (banned or pending). Cannot add favorite.');
                return false;
            }
            if (this.hasFavorite(id)) return false;
            favorites = [id, ...favorites].filter((item, index, list) => list.indexOf(item) === index);
            persistFavorites();
            return true;
        },

        removeFavorite(animeId) {
            const id = Number(animeId);
            if (!Number.isFinite(id)) return false;
            const before = favorites.length;
            favorites = favorites.filter(item => Number(item) !== id);
            const changed = favorites.length !== before;
            if (changed) persistFavorites();
            return changed;
        },

        toggleFavorite(animeId) {
            return this.hasFavorite(animeId) ? this.removeFavorite(animeId) : this.addFavorite(animeId);
        },

        getRating(animeId) {
            const id = String(Number(animeId));
            if (!Number.isFinite(Number(id))) return null;
            return Object.prototype.hasOwnProperty.call(ratings, id) ? ratings[id] : null;
        },

        setRating(animeId, ratingValue) {
            const id = Number(animeId);
            const rating = Number(ratingValue);
            if (!Number.isFinite(id) || !Number.isFinite(rating) || rating < 0 || rating > 10) {
                return false;
            }
            // Only authenticated users can set ratings
            if (!global.authService || typeof global.authService.isAuthenticated !== 'function' || !global.authService.isAuthenticated()) {
                console.warn('User must be signed in to set ratings.');
                return false;
            }
            if (!isUserActive()) {
                console.warn('User is not active (banned or pending). Cannot set rating.');
                return false;
            }
            ratings[String(id)] = rating;
            persistRatings();
            return true;
        },

        removeRating(animeId) {
            const id = String(Number(animeId));
            if (!Object.prototype.hasOwnProperty.call(ratings, id)) return false;
            delete ratings[id];
            persistRatings();
            return true;
        },
    };

    global.InteractionService = interactionService;
    global.interactionService = interactionService;
})(window);
