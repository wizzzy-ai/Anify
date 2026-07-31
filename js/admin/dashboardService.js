(function (global) {
    'use strict';

    function getTotalUsers() {
        return 24500;
    }

    function getDailyViews() {
        return 1200000;
    }

    function getPremiumUsers() {
        return 8400;
    }

    function getMonthlyRevenue() {
        return 84000;
    }

    function getTrendingAnime() {
        return (Array.isArray(global.animeData) ? global.animeData : []).filter(a => a.trending).slice(0, 5);
    }

    function getGenreDistribution() {
        return global.categoryManagement.getCategories()
            .filter(c => c !== 'All')
            .map(c => ({
                genre: c,
                count: (Array.isArray(global.animeData) ? global.animeData : []).filter(a => Array.isArray(a.genres) && a.genres.includes(c)).length,
            }));
    }

    const dashboardService = {
        getTotalUsers,
        getDailyViews,
        getPremiumUsers,
        getMonthlyRevenue,
        getTrendingAnime,
        getGenreDistribution,
    };

    global.dashboardService = dashboardService;
})(window);
