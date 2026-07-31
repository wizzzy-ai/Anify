(function (global) {
    'use strict';

    const categoryManagement = {
        getCategories() {
            return ['All', ...(global.genreService && typeof global.genreService.getGenreNames === 'function'
                ? global.genreService.getGenreNames()
                : [])];
        },

        getGenreOptions(selectedGenres = []) {
            const normalized = selectedGenres.map((g) => String(g || '').trim());
            return (global.genreService && typeof global.genreService.getGenreNames === 'function'
                ? global.genreService.getGenreNames()
                : []).map((genre) => ({
                    genre,
                    selected: normalized.includes(genre),
                }));
        },

        validateGenres(genres) {
            if (!Array.isArray(genres)) return false;
            return genres.every((g) => typeof g === 'string' && g.trim().length > 0);
        },

        validateCategory(category) {
            if (!category) return false;
            return this.getCategories().includes(category);
        },

        normalizeCategory(category) {
            return String(category || '').trim();
        },

        getGenreLabel(genre) {
            return String(genre || '').trim();
        },
    };

    global.categoryManagement = categoryManagement;
})(window);
