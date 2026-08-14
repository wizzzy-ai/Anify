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

    // Support/Donation statistics
    async function getSupportStats() {
        try {
            const token = localStorage.getItem('anify-token') || '';
            const response = await fetch('/api/admin/donations/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await response.json();
            if (result.ok) {
                return result.stats;
            }
            return {
                totalSupporters: 0,
                totalDonations: 0,
                totalAmount: 0,
                thisMonthAmount: 0,
                thisMonthDonations: 0
            };
        } catch (error) {
            console.error('Failed to fetch support stats:', error);
            return {
                totalSupporters: 0,
                totalDonations: 0,
                totalAmount: 0,
                thisMonthAmount: 0,
                thisMonthDonations: 0
            };
        }
    }

    const dashboardService = {
        getTotalUsers,
        getDailyViews,
        getPremiumUsers,
        getMonthlyRevenue,
        getTrendingAnime,
        getGenreDistribution,
        getSupportStats
    };

    global.dashboardService = dashboardService;
})(window);
