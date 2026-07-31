(function (global) {
    'use strict';

    const adminService = {
        adminModalMode: 'create',
        editingAnimeId: null,
        uploadTargetAnimeId: null,

        init() {
            global.adminService = this;
        },

        setAdminMode(mode = 'create', animeId = null) {
            this.adminModalMode = String(mode || 'create');
            this.editingAnimeId = this.adminModalMode === 'edit' || this.adminModalMode === 'movie-edit' ? animeId : null;
            this.uploadTargetAnimeId = this.adminModalMode === 'episode' ? animeId : null;
        },

        resetAdminMode() {
            this.adminModalMode = 'create';
            this.editingAnimeId = null;
            this.uploadTargetAnimeId = null;
        },

        isAdminRole() {
            if (!global.authService || typeof global.authService.getCurrentUser !== 'function') return false;
            const user = global.authService.getCurrentUser() || {};
            const roles = Array.isArray(user.roles) ? user.roles : [];
            return roles.includes('admin') || roles.includes('moderator') || roles.includes('shield');
        },

        ensureAdminOrRedirect() {
            if (this.isAdminRole()) return true;
            const content = document.getElementById('main-content');
            if (content) {
                content.innerHTML = `
                    <div class="pt-24 pb-20 min-h-screen flex items-center justify-center">
                        <div class="text-center glass-card rounded-2xl p-8 max-w-md">
                            <h1 class="text-2xl font-black mb-2">Access denied</h1>
                            <p class="text-gray-500">Admin role required.</p>
                            <button onclick="navigate('home')" class="btn-primary mt-6">Back to Home</button>
                        </div>
                    </div>`;
            }
            currentPage = 'home';
            return false;
        },

        getUploadTargetAnimeId() {
            return this.uploadTargetAnimeId;
        },
    };

    global.adminService = adminService;
})(window);
