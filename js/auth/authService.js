(function (global) {
    'use strict';

    const TOKEN_KEY = 'anify-token';
    const USER_ID_KEY = 'anify-user-id';
    const USER_PROFILE_KEY = 'anify-user-profile';
    const REGISTER_EMAIL_KEY = 'anify-register-email';

    function safeParseJson(value) {
        if (typeof value !== 'string') return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function normalizeUser(user) {
        if (!user || typeof user !== 'object') return null;
        const id = user.id || user.userId || null;
        if (!id) return null;

        return {
            id: String(id),
            username: user.username || user.name || null,
            name: user.name || user.username || null,
            email: user.email || null,
            roles: user.roles || [],
            plan: user.plan || null,
            status: user.status || null,
            isVerified: user.isVerified || false,
            avatar: user.avatar || null,
        };
    }

    function buildUserProfile(user) {
        const normalizedUser = normalizeUser(user);
        if (!normalizedUser) return null;

        return {
            id: normalizedUser.id,
            username: normalizedUser.username,
            name: normalizedUser.name,
            email: normalizedUser.email,
            roles: normalizedUser.roles,
            plan: normalizedUser.plan,
            status: normalizedUser.status,
            isVerified: normalizedUser.isVerified,
            avatar: normalizedUser.avatar,
        };
    }

    function persistProfile(user) {
        const profile = buildUserProfile(user);
        if (profile) {
            storageService.set(USER_PROFILE_KEY, JSON.stringify(profile));
        }
        return profile;
    }

    function dispatchAuthChanged() {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new Event('authChanged'));
        }
        return true;
    }

    const authService = {
        /**
         * Return the currently stored auth token.
         * @returns {string|null}
         */
        getToken() {
            return storageService.get(TOKEN_KEY);
        },

        /**
         * Persist a token and user payload for the active session.
         * @param {string|null} token
         * @param {object|null} user
         * @returns {object|null}
         */
        setToken(token, user) {
            if (token) {
                storageService.set(TOKEN_KEY, token);
            } else {
                storageService.remove(TOKEN_KEY);
            }

            if (user && typeof user === 'object') {
                const normalizedUser = normalizeUser(user);
                if (normalizedUser && normalizedUser.id) {
                    storageService.set(USER_ID_KEY, String(normalizedUser.id));
                    persistProfile(user);
                } else {
                    storageService.remove(USER_ID_KEY);
                    storageService.remove(USER_PROFILE_KEY);
                }
            } else if (!token) {
                storageService.remove(USER_ID_KEY);
                storageService.remove(USER_PROFILE_KEY);
            }

            if (token) {
                dispatchAuthChanged();
            }

            return this.getCurrentUser();
        },

        /**
         * Return the stored current user profile, if any.
         * @returns {object|null}
         */
        getCurrentUser() {
            const profileRaw = storageService.get(USER_PROFILE_KEY);
            const profile = safeParseJson(profileRaw);
            return normalizeUser(profile || {});
        },

        /**
         * Return the current username when available.
         * @returns {string|null}
         */
        getCurrentUsername() {
            const currentUser = this.getCurrentUser();
            return currentUser?.username || currentUser?.name || null;
        },

        /**
         * Return the current user id, if known.
         * @returns {string|null}
         */
        getCurrentUserId() {
            if (!this.isAuthenticated()) return null;

            const profile = this.getCurrentUser();
            if (profile && profile.id) return String(profile.id);

            const storedUserId = storageService.get(USER_ID_KEY);
            return storedUserId ? String(storedUserId) : null;
        },

        /**
         * Check whether the current session is authenticated.
         * @returns {boolean}
         */
        isAuthenticated() {
            return Boolean(this.getToken());
        },

        /**
         * Clear the active session without removing user-specific storage.
         * @returns {boolean}
         */
        clearSession() {
            storageService.remove(TOKEN_KEY);
            storageService.remove(USER_ID_KEY);
            storageService.remove(USER_PROFILE_KEY);
            dispatchAuthChanged();
            return true;
        },

        /**
         * Alias for clearSession.
         * @returns {boolean}
         */
        logout() {
            return this.clearSession();
        },

        /**
         * Dispatch an authChanged event to notify the UI.
         * @returns {boolean}
         */
        dispatchAuthChanged() {
            return dispatchAuthChanged();
        },

        /**
         * Persist the registration email while the OTP flow is pending.
         * @param {string} email
         * @returns {string}
         */
        setRegisterEmail(email) {
            const normalizedEmail = String(email || '').trim().toLowerCase();
            if (normalizedEmail) {
                storageService.set(REGISTER_EMAIL_KEY, normalizedEmail);
            } else {
                storageService.remove(REGISTER_EMAIL_KEY);
            }
            return normalizedEmail;
        },

        /**
         * Retrieve the pending registration email.
         * @returns {string}
         */
        getRegisterEmail() {
            return storageService.get(REGISTER_EMAIL_KEY) || '';
        },

        /**
         * Restore a previously persisted session if it exists.
         * @returns {boolean}
         */
        restoreSession() {
            const token = this.getToken();
            if (!token) return false;

            const userId = this.getCurrentUserId();
            const profile = this.getCurrentUser();
            if (!profile && !userId) {
                this.clearSession();
                return false;
            }

            return true;
        },

        /**
         * Authenticate a user against the backend.
         * @param {{email:string,password:string}} credentials
         * @returns {Promise<object>}
         */
async login(credentials) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials || {}),
    });
    const data = await res.json().catch(() => ({}));
    
    // Handle email verification requirement
    if (data.requiresVerification) {
        const error = new Error(data.error || 'Please verify your email address');
        error.requiresVerification = true;
        error.email = data.email;
        throw error;
    }
    
    if (!res.ok || !data.ok) throw new Error(data.error || 'Login failed');

    this.setToken(data.token, data.user);
    return data;
},

        /**
         * Register a new user account.
         * @param {{username:string,email:string,password:string}} payload
         * @returns {Promise<object>}
         */
        async register(payload) {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || {}),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || 'Register failed');

            this.setRegisterEmail(payload?.email);
            return data;
        },

        /**
         * Verify an OTP code during registration.
         * @param {string} email
         * @param {string} code
         * @returns {Promise<object>}
         */
        async verifyOtp(email, code) {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || 'OTP verification failed');

            this.setToken(data.token, data.user);
            storageService.remove(REGISTER_EMAIL_KEY);
            return data;
        },
    };

    global.AnifyAuthService = authService;
    global.authService = authService;
})(window);
