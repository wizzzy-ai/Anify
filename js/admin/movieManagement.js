(function (global) {
    'use strict';

    function getMovies() {
        return (Array.isArray(global.animeData) ? global.animeData : []).filter(a => (a?.type || 'anime') !== 'anime');
    }

    function getMovieById(id) {
        return global.animeData.find(a => Number(a.id) === Number(id));
    }

    function deleteMovie(id) {
        const index = global.animeData.findIndex(a => Number(a.id) === Number(id));
        if (index < 0) return false;
        global.animeData.splice(index, 1);
        global.watchlist = global.watchlist.filter(w => w !== id);
        global.continueWatching = global.continueWatching.filter(cw => cw.id !== id);
        return true;
    }

    const movieManagement = {
        getMovies,
        getMovieById,
        deleteMovie,
    };

    global.movieManagement = movieManagement;
})(window);
