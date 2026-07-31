(function (global) {
    'use strict';

    const GUEST_VIDEOS_KEY = 'anify-guest-videos-watched';
    const GUEST_LIMIT_KEY = 'anify-guest-limit';
    const LAST_WATCHED_KEY = 'anify-last-watched';
    const DEFAULT_GUEST_LIMIT = 4;

    function safeParseJson(value) {
        if (typeof value !== 'string') return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function generateGuestId() {
        return 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    const guestPreviewService = {
        /**
         * Get the guest preview limit (configurable by admin)
         * @returns {number}
         */
        getGuestLimit() {
            const limit = storageService.get(GUEST_LIMIT_KEY);
            return limit ? parseInt(limit, 10) : DEFAULT_GUEST_LIMIT;
        },

        /**
         * Set the guest preview limit (for admin configuration)
         * @param {number} limit
         * @returns {boolean}
         */
        setGuestLimit(limit) {
            const numLimit = parseInt(limit, 10);
            if (!Number.isFinite(numLimit) || numLimit < 1) return false;
            storageService.set(GUEST_LIMIT_KEY, String(numLimit));
            return true;
        },

        /**
         * Get the current guest viewing data
         * @returns {object}
         */
        getGuestData() {
            const data = safeParseJson(storageService.get(GUEST_VIDEOS_KEY));
            if (!data) {
                return {
                    guestId: generateGuestId(),
                    videosWatched: [],
                    count: 0,
                    createdAt: Date.now()
                };
            }
            return data;
        },

        /**
         * Save guest viewing data
         * @param {object} data
         * @returns {boolean}
         */
        saveGuestData(data) {
            try {
                storageService.set(GUEST_VIDEOS_KEY, JSON.stringify(data));
                return true;
            } catch (error) {
                console.error('Failed to save guest data:', error);
                return false;
            }
        },

        /**
         * Get the number of videos watched by guest
         * @returns {number}
         */
        getVideosWatchedCount() {
            const data = this.getGuestData();
            return data.count || 0;
        },

        /**
         * Check if guest can watch more videos
         * @returns {boolean}
         */
        canWatchMore() {
            const count = this.getVideosWatchedCount();
            const limit = this.getGuestLimit();
            return count < limit;
        },

        /**
         * Get remaining videos guest can watch
         * @returns {number}
         */
        getRemainingVideos() {
            const count = this.getVideosWatchedCount();
            const limit = this.getGuestLimit();
            return Math.max(0, limit - count);
        },

        /**
         * Record a video watch for guest
         * @param {string} animeId
         * @param {string|number} episodeId
         * @returns {object}
         */
        recordVideoWatch(animeId, episodeId) {
            const data = this.getGuestData();
            const watchRecord = {
                animeId: String(animeId),
                episodeId: String(episodeId),
                timestamp: Date.now()
            };

            // Always record the watch (even if same video watched multiple times)
            data.videosWatched.push(watchRecord);
            data.count = data.videosWatched.length;
            this.saveGuestData(data);

            return {
                count: data.count,
                limit: this.getGuestLimit(),
                remaining: this.getRemainingVideos(),
                canWatchMore: this.canWatchMore()
            };
        },

        /**
         * Reset guest preview data (clear local storage)
         * @returns {boolean}
         */
        resetGuestData() {
            storageService.remove(GUEST_VIDEOS_KEY);
            return true;
        },

        /**
         * Save last watched anime/episode for resume after registration
         * @param {string} animeId
         * @param {string|number} episodeId
         * @param {number} playbackTime
         * @returns {boolean}
         */
        saveLastWatched(animeId, episodeId, playbackTime = 0) {
            try {
                const lastWatched = {
                    animeId: String(animeId),
                    episodeId: String(episodeId),
                    playbackTime: Number(playbackTime) || 0,
                    timestamp: Date.now()
                };
                storageService.set(LAST_WATCHED_KEY, JSON.stringify(lastWatched));
                return true;
            } catch (error) {
                console.error('Failed to save last watched:', error);
                return false;
            }
        },

        /**
         * Get last watched anime/episode
         * @returns {object|null}
         */
        getLastWatched() {
            return safeParseJson(storageService.get(LAST_WATCHED_KEY));
        },

        /**
         * Clear last watched data
         * @returns {boolean}
         */
        clearLastWatched() {
            storageService.remove(LAST_WATCHED_KEY);
            return true;
        },

        /**
         * Check if user is a guest (not authenticated)
         * @returns {boolean}
         */
        isGuest() {
            return !authService.isAuthenticated();
        },

        /**
         * Get guest preview status for UI display
         * @returns {object}
         */
        getPreviewStatus() {
            const count = this.getVideosWatchedCount();
            const limit = this.getGuestLimit();
            const remaining = this.getRemainingVideos();
            
            return {
                isGuest: this.isGuest(),
                count,
                limit,
                remaining,
                canWatchMore: this.canWatchMore(),
                isLimitReached: count >= limit,
                percentage: Math.min(100, (count / limit) * 100)
            };
        }
    };

    global.GuestPreviewService = guestPreviewService;
    global.guestPreviewService = guestPreviewService;
})(window);
