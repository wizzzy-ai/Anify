(function (global) {
    'use strict';

    const STORAGE_KEY_PREFIX = 'notifications';
    let notifications = [];

    function safeParseJson(value) {
        if (typeof value !== 'string') return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function getCurrentUserId() {
        if (global.authService && typeof global.authService.isAuthenticated === 'function') {
            if (!global.authService.isAuthenticated()) {
                return 'guest';
            }

            if (typeof global.authService.getCurrentUserId === 'function') {
                const currentUserId = global.authService.getCurrentUserId();
                if (currentUserId) return String(currentUserId);
            }
        }
        return 'guest';
    }

    function getStorageKey(userId) {
        return `${STORAGE_KEY_PREFIX}_${userId || 'guest'}`;
    }

    function generateNotificationId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `notif_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    }

    function normalizeNotification(raw) {
        if (!raw || typeof raw !== 'object') return null;

        const id = raw.id || raw.notificationId || generateNotificationId();
        const type = String(raw.type || raw.category || 'System Message');
        const title = String(raw.title || raw.heading || 'Notification');
        const message = String(raw.message || raw.body || 'You have a new notification.');
        const createdAt = Number(raw.createdAt || raw.timestamp || Date.now());
        const read = Boolean(raw.read);
        const icon = raw.icon || 'bell';
        const action = raw.action && typeof raw.action === 'object' ? raw.action : null;
        const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};

        return {
            id: String(id),
            type,
            title,
            message,
            createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
            read,
            icon,
            action,
            metadata,
        };
    }

    function sortNotifications(list) {
        return [...list].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    }

    function persistNotifications() {
        const userId = getCurrentUserId();
        if (userId === 'guest') return;
        if (!global.storageService || typeof global.storageService.set !== 'function') return;

        global.storageService.set(getStorageKey(userId), JSON.stringify(notifications));
    }

    function loadNotificationsForUser(userId) {
        const key = getStorageKey(userId);
        if (!global.storageService || typeof global.storageService.get !== 'function') {
            notifications = [];
            return notifications.slice();
        }

        const rawValue = global.storageService.get(key);
        const parsed = safeParseJson(rawValue);
        if (!Array.isArray(parsed)) {
            notifications = [];
            return notifications.slice();
        }

        notifications = sortNotifications(parsed.map(normalizeNotification).filter(Boolean));
        return notifications.slice();
    }

    const notificationService = {
        /**
         * Restore notifications for the current authenticated user.
         * @returns {Array<object>}
         */
        restore() {
            const userId = getCurrentUserId();
            if (userId === 'guest') {
                notifications = [];
                return [];
            }
            return loadNotificationsForUser(userId);
        },

        /**
         * Persist the current in-memory notifications.
         * @returns {Array<object>}
         */
        save() {
            persistNotifications();
            return this.getNotifications();
        },

        /**
         * Return a copy of current notifications.
         * @returns {Array<object>}
         */
        getNotifications() {
            return notifications.slice();
        },

        /**
         * Create a normalized notification object.
         * @param {object} payload
         * @returns {object}
         */
        createNotification(payload) {
            return normalizeNotification(payload || {});
        },

        /**
         * Add a notification for the current user.
         * @param {object} notification
         * @returns {object|null}
         */
        addNotification(notification) {
            if (!notification || typeof notification !== 'object') return null;
            const userId = getCurrentUserId();
            if (userId === 'guest') return null;

            const normalized = normalizeNotification(notification);
            const existingIndex = notifications.findIndex(item => item.id === normalized.id);
            if (existingIndex >= 0) {
                notifications[existingIndex] = { ...notifications[existingIndex], ...normalized };
            } else {
                notifications.unshift(normalized);
            }

            notifications = sortNotifications(notifications);
            persistNotifications();
            return normalized;
        },

        /**
         * Remove a notification by id.
         * @param {string|number} notificationId
         * @returns {boolean}
         */
        removeNotification(notificationId) {
            const id = String(notificationId);
            const before = notifications.length;
            notifications = notifications.filter(item => String(item.id) !== id);
            const changed = notifications.length !== before;
            if (changed) persistNotifications();
            return changed;
        },

        /**
         * Mark a single notification as read.
         * @param {string|number} notificationId
         * @returns {boolean}
         */
        markAsRead(notificationId) {
            const id = String(notificationId);
            const idx = notifications.findIndex(item => String(item.id) === id);
            if (idx < 0) return false;
            if (notifications[idx].read) return false;
            notifications[idx] = { ...notifications[idx], read: true };
            persistNotifications();
            return true;
        },

        /**
         * Mark all notifications as read.
         * @returns {Array<object>}
         */
        markAllAsRead() {
            notifications = notifications.map(item => ({ ...item, read: true }));
            persistNotifications();
            return this.getNotifications();
        },

        /**
         * Remove all notifications for the current user.
         * @returns {Array<object>}
         */
        clearNotifications() {
            notifications = [];
            persistNotifications();
            return this.getNotifications();
        },

        /**
         * Alias for clearNotifications.
         * @returns {Array<object>}
         */
        clearAllNotifications() {
            return this.clearNotifications();
        },

        /**
         * Get the current unread notification count.
         * @returns {number}
         */
        getUnreadCount() {
            return this.getNotifications().filter(item => !item.read).length;
        },

        /**
         * Filter notifications by label or read state.
         * @param {string} filter
         * @returns {Array<object>}
         */
        filterNotifications(filter) {
            if (!filter || filter === 'All') {
                return this.getNotifications();
            }

            const normalizedFilter = String(filter).trim();
            if (normalizedFilter === 'Unread') {
                return this.getNotifications().filter(item => !item.read);
            }
            if (normalizedFilter === 'Read') {
                return this.getNotifications().filter(item => item.read);
            }

            return this.getNotifications().filter(item => {
                const typeMatches = String(item.type || '').toLowerCase() === normalizedFilter.toLowerCase();
                const categoryMatches = String(item.metadata?.category || '').toLowerCase() === normalizedFilter.toLowerCase();
                const messageMatches = String(item.title || '').toLowerCase().includes(normalizedFilter.toLowerCase())
                    || String(item.message || '').toLowerCase().includes(normalizedFilter.toLowerCase());
                return typeMatches || categoryMatches || messageMatches;
            });
        },

        /**
         * Search notifications by text.
         * @param {string} query
         * @returns {Array<object>}
         */
        searchNotifications(query) {
            if (!query || !query.trim()) {
                return this.getNotifications();
            }

            const normalizedQuery = String(query).trim().toLowerCase();
            return this.getNotifications().filter(item => {
                return String(item.title || '').toLowerCase().includes(normalizedQuery)
                    || String(item.message || '').toLowerCase().includes(normalizedQuery)
                    || String(item.type || '').toLowerCase().includes(normalizedQuery)
                    || String(item.metadata?.category || '').toLowerCase().includes(normalizedQuery);
            });
        },
    };

    global.NotificationService = notificationService;
    global.notificationService = notificationService;
})(window);
