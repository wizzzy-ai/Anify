(function (global) {
    'use strict';

    const defaultGenres = [
        'Action',
        'Adventure',
        'Comedy',
        'Drama',
        'Fantasy',
        'Sci-Fi',
        'Romance',
        'Slice of Life',
        'Mystery',
        'Thriller',
        'Horror',
        'Supernatural',
        'Psychological',
        'Sports',
        'Music',
        'Mecha',
        'Military',
        'Historical',
        'Samurai',
        'Martial Arts',
        'Magic',
        'Isekai',
        'School',
        'Shounen',
        'Shoujo',
        'Seinen',
        'Josei',
        'Ecchi',
        'Harem',
        'Reverse Harem',
        'Idol',
        'Cooking',
        'Medical',
        'Detective',
        'Crime',
        'Police',
        'Spy',
        'Family',
        'Vampire',
        'Demons',
        'Monsters',
        'Space',
        'Survival',
        'Game',
        'Parody',
        'Post-Apocalyptic',
        'Superpower',
    ];

    const state = {
        genres: [],
        loading: null,
        loaded: false,
    };

    function normalizeGenre(item) {
        if (!item) return null;
        if (typeof item === 'string') {
            const name = String(item).trim();
            if (!name) return null;
            return {
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name,
                animeCount: 0,
            };
        }

        const name = String(item.name || item.title || '').trim();
        if (!name) return null;
        return {
            id: String(item.id || item._id || item.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
            slug: String(item.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
            name,
            animeCount: Number(item.animeCount || item.count || 0) || 0,
        };
    }

    function getDefaultGenres() {
        return defaultGenres.map((name) => normalizeGenre(name)).filter(Boolean);
    }

    function getGenres() {
        return state.genres.length ? state.genres.slice() : getDefaultGenres();
    }

    function getGenreNames() {
        return getGenres().map((genre) => genre.name);
    }

    function getGenreMap() {
        return new Map(getGenres().map((genre) => [genre.name.toLowerCase(), genre]));
    }

    function getGenreByName(name) {
        const normalized = String(name || '').trim();
        if (!normalized) return null;
        return getGenreMap().get(normalized.toLowerCase()) || null;
    }

    function getGenreBySlug(slug) {
        const normalized = String(slug || '').trim();
        if (!normalized) return null;
        return getGenres().find((genre) => genre.slug === normalized) || null;
    }

    function getGenreLabel(value) {
        if (!value) return '';
        if (typeof value === 'object') return String(value.name || value.title || '').trim();
        return String(value).trim();
    }

    function normalizeGenreList(items) {
        const list = Array.isArray(items) ? items : [];
        const seen = new Set();
        return list
            .map((item) => normalizeGenre(item))
            .filter(Boolean)
            .filter((genre) => {
                const key = `${genre.name}`.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    async function loadGenres(force = false) {
        if (state.loading) return state.loading;
        if (!force && state.loaded) return state.genres;

        state.loading = fetch('/api/genres')
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load genres.');
                const genres = normalizeGenreList(Array.isArray(data.genres) ? data.genres : []);
                state.genres = genres.length ? genres : getDefaultGenres();
                state.loaded = true;
                return state.genres;
            })
            .catch(() => {
                state.genres = getDefaultGenres();
                state.loaded = true;
                return state.genres;
            })
            .finally(() => {
                state.loading = null;
            });

        return state.loading;
    }

    async function ensureGenresLoaded(force = false) {
        return loadGenres(force);
    }

    function getGenreCount(name) {
        const genre = getGenreByName(name);
        return genre ? Number(genre.animeCount || 0) : 0;
    }

    const genreService = {
        defaultGenres,
        getDefaultGenres,
        getGenres,
        getGenreNames,
        getGenreMap,
        getGenreByName,
        getGenreBySlug,
        getGenreLabel,
        normalizeGenreList,
        loadGenres,
        ensureGenresLoaded,
        getGenreCount,
    };

    global.genreService = genreService;
})(window);
