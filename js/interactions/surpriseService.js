(function (global) {
    'use strict';

    const MOOD_MAPPING = {
        'feelgood': ['Slice of Life', 'Comedy', 'Family'],
        'comedy': ['Comedy', 'Parody'],
        'emotional': ['Drama', 'Romance', 'Post-Apocalyptic'],
        'horror': ['Horror', 'Supernatural', 'Thriller'],
        'action': ['Action', 'Shounen', 'Martial Arts', 'Superpower'],
        'psychological': ['Psychological', 'Mystery', 'Detective'],
        'romance': ['Romance', 'Shoujo', 'Josei'],
        'fantasy': ['Fantasy', 'Adventure', 'Isekai', 'Magic']
    };

    let sessionExcludeIds = [];

    const surpriseService = {
        getRecommendation(filters = {}, mode = 'random') {
            let pool = [...(global.animeData || [])];

            // 1. Basic safety filtering
            pool = pool.filter(a => a.image && a.banner && a.desc);

            // 2. Mode-specific filtering
            if (mode === 'hidden-gem') {
                pool = pool.filter(a => a.rating >= 8.0 && !a.trending);
            } else if (mode === 'editors-pick') {
                pool = pool.filter(a => a.featured);
            }

            // 3. User filters
            if (filters.mood && MOOD_MAPPING[filters.mood]) {
                const targetGenres = MOOD_MAPPING[filters.mood];
                pool = pool.filter(a => a.genres.some(g => targetGenres.includes(g)));
            }

            if (filters.type && filters.type !== 'any') {
                pool = pool.filter(a => {
                    const isMovie = (a.type === 'animated-movie' || a.type === 'live-movie');
                    return filters.type === 'movie' ? isMovie : !isMovie;
                });
            }

            if (filters.minRating && filters.minRating !== 'any') {
                pool = pool.filter(a => a.rating >= Number(filters.minRating));
            }

            if (filters.language && filters.language !== 'any') {
                pool = pool.filter(a => {
                    if (typeof global.isEpisodeAvailable === 'function') {
                        return global.isEpisodeAvailable(a, filters.language, 1);
                    }
                    return true;
                });
            }

            // 4. Session avoidance
            let sessionPool = pool.filter(a => !sessionExcludeIds.includes(a.id));
            if (sessionPool.length > 0) pool = sessionPool;

            // 5. Unwatched bias
            const history = global.continueWatching || [];
            const finishedIds = history.filter(h => h.progress > 95).map(h => h.id);
            
            let unwatchedPool = pool.filter(a => !finishedIds.includes(a.id));
            if (unwatchedPool.length > 0) pool = unwatchedPool;

            // 6. Weighted selection based on history genres
            const favoriteGenres = this.getHistoryGenres(history);
            
            if (favoriteGenres.length > 0 && mode === 'random' && !filters.mood) {
                const biasedPool = [];
                pool.forEach(a => {
                    biasedPool.push(a);
                    if (a.genres.some(g => favoriteGenres.includes(g))) {
                        biasedPool.push(a);
                        biasedPool.push(a);
                    }
                });
                pool = biasedPool;
            }

            if (pool.length === 0) return null;

            const picked = pool[Math.floor(Math.random() * pool.length)];
            
            sessionExcludeIds.push(picked.id);
            if (sessionExcludeIds.length > 15) sessionExcludeIds.shift();

            return picked;
        },

        getHistoryGenres(history) {
            if (!history || history.length === 0) return [];
            const genreCounts = {};
            history.forEach(h => {
                const anime = global.animeData?.find(a => a.id === h.id);
                if (anime && anime.genres) {
                    anime.genres.forEach(g => {
                        genreCounts[g] = (genreCounts[g] || 0) + 1;
                    });
                }
            });
            return Object.entries(genreCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(e => e[0]);
        },

        getCollectionLabel(anime) {
            if (anime.rating >= 9.0) return '🎬 Award Winner';
            if (anime.featured) return '⭐ Editor\'s Pick';
            if (anime.rating >= 8.5) return '👑 Fan Favorite';
            if (anime.rating >= 8.0 && !anime.trending) return '🔥 Hidden Gem';
            if (anime.newEpisode) return '🌸 Seasonal Pick';
            return '✨ Underrated';
        },

        clearSession() {
            sessionExcludeIds = [];
        }
    };

    global.surpriseService = surpriseService;
})(window);