(function (global) {
    'use strict';

    const adminUtils = {
        formatDate(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        },

        generateSlug(value) {
            return String(value || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        },

        clampNumber(value, min, max) {
            const number = Number(value);
            if (Number.isNaN(number)) return min;
            return Math.min(Math.max(number, min), max);
        },

        normalizeGenres(rawGenres) {
            if (!Array.isArray(rawGenres)) return [];
            return rawGenres
                .map(g => String(g || '').trim())
                .filter(Boolean)
                .map(g => g[0].toUpperCase() + g.slice(1).toLowerCase());
        },

        escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        isId(value) {
            return value !== null && value !== undefined && value !== '';
        },

        buildAdminButton(label, icon, attrs = '') {
            return `<button type="button" class="p-2 rounded-lg hover:bg-white/10 transition-all" ${attrs}><i data-lucide="${icon}" class="w-4 h-4"></i> <span class="sr-only">${label}</span></button>`;
        },
    };

    global.adminUtils = adminUtils;
})(window);
