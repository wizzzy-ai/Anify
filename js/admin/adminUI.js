(function (global) {
    'use strict';

    // URL utility to convert HTTP to HTTPS
    function ensureHttps(url) {
        if (!url || typeof url !== 'string') return url;
        return url.replace(/^http:/, 'https:');
    }

    // Admins may enter either raw seconds ("92") or a normal timestamp
    // ("1:32" / "01:32" / "1:02:05"). Storage remains numeric seconds.
    function parseTimestampInput(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return 0;
        if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
        const parts = raw.split(':');
        if (parts.length < 2 || parts.length > 3 || parts.some(part => !/^\d+$/.test(part))) return null;
        const numbers = parts.map(Number);
        if (numbers.slice(1).some(part => part >= 60)) return null;
        return numbers.reduce((total, part) => total * 60 + part, 0);
    }

    function formatTimestampInput(seconds) {
        const safe = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(safe / 3600);
        const minutes = Math.floor((safe % 3600) / 60);
        const secs = safe % 60;
        return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    // Helper function to format time ago
    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        return 'Just now';
    }

    // Quick action functions
    function refreshDashboard() {
        renderAdminDashboard();
    }

    function exportDashboardData() {
        // Export current dashboard data as JSON
        fetch('/api/admin/stats')
            .then(response => response.json())
            .then(data => {
                const dataStr = JSON.stringify(data, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `anify-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Export failed:', error);
                alert('Failed to export dashboard data');
            });
    }



    function ensureAdminOrRedirect() {
        if (global.adminService && typeof global.adminService.ensureAdminOrRedirect === 'function') {
            return global.adminService.ensureAdminOrRedirect();
        }
        return false;
    }

    function renderAdmin() {
        return `
    <div class="pt-16 min-h-screen flex">
        <!-- Sidebar -->
        <aside class="admin-sidebar w-64 hidden lg:flex flex-col p-4 sticky top-16 h-[calc(100vh-4rem)]">
            <div class="mb-6 mt-2">
                <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-3">Admin Panel</p>
                <div class="space-y-1">
                    <button onclick="switchAdminTab('dashboard')" class="admin-nav-item active" data-admin-nav="dashboard">
                        <i data-lucide="layout-dashboard" class="w-4 h-4"></i> Dashboard
                    </button>
                    <button onclick="switchAdminTab('support')" class="admin-nav-item" data-admin-nav="support">
                        <i data-lucide="heart" class="w-4 h-4"></i> Support
                    </button>
                    <button onclick="switchAdminTab('anime')" class="admin-nav-item" data-admin-nav="anime">
                        <i data-lucide="tv" class="w-4 h-4"></i> Anime Management
                    </button>
                    <button onclick="switchAdminTab('users')" class="admin-nav-item" data-admin-nav="users">
                        <i data-lucide="users" class="w-4 h-4"></i> User Management
                    </button>
                    <button onclick="switchAdminTab('bans')" class="admin-nav-item" data-admin-nav="bans">
                        <i data-lucide="shield-ban" class="w-4 h-4"></i> Banned Users
                    </button>
                    <button onclick="switchAdminTab('announcements')" class="admin-nav-item" data-admin-nav="announcements">
                        <i data-lucide="megaphone" class="w-4 h-4"></i> Announcements
                    </button>
                    <button onclick="switchAdminTab('analytics')" class="admin-nav-item" data-admin-nav="analytics">
                        <i data-lucide="bar-chart-3" class="w-4 h-4"></i> Analytics
                    </button>
                    <button onclick="switchAdminTab('subscriptions')" class="admin-nav-item" data-admin-nav="subscriptions">
                        <i data-lucide="credit-card" class="w-4 h-4"></i> Subscriptions
                    </button>
                    <button onclick="switchAdminTab('reports')" class="admin-nav-item" data-admin-nav="reports">
                        <i data-lucide="flag" class="w-4 h-4"></i> Reports
                    </button>
                    <button onclick="switchAdminTab('settings')" class="admin-nav-item" data-admin-nav="settings">
                        <i data-lucide="settings" class="w-4 h-4"></i> Settings
                    </button>
                </div>
            </div>
            <div class="mt-auto">
                <button onclick="navigate('home')" class="admin-nav-item w-full text-left">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Site
                </button>
            </div>
        </aside>

        <!-- Mobile Admin Nav -->
        <div class="lg:hidden fixed bottom-0 left-0 right-0 z-40 nav-glass border-t border-white/5 px-2 py-2">
            <div class="flex justify-around">
                <button onclick="switchAdminTab('dashboard')" class="flex flex-col items-center gap-0.5 p-2 text-gold-400" data-admin-nav-mobile="dashboard">
                    <i data-lucide="layout-dashboard" class="w-5 h-5"></i><span class="text-[10px]">Dashboard</span>
                </button>
                <button onclick="switchAdminTab('anime')" class="flex flex-col items-center gap-0.5 p-2 text-gray-500" data-admin-nav-mobile="anime">
                    <i data-lucide="tv" class="w-5 h-5"></i><span class="text-[10px]">Anime</span>
                </button>
                <button onclick="switchAdminTab('users')" class="flex flex-col items-center gap-0.5 p-2 text-gray-500" data-admin-nav-mobile="users">
                    <i data-lucide="users" class="w-5 h-5"></i><span class="text-[10px]">Users</span>
                </button>
                <button onclick="switchAdminTab('bans')" class="flex flex-col items-center gap-0.5 p-2 text-gray-500" data-admin-nav-mobile="bans">
                    <i data-lucide="shield-ban" class="w-5 h-5"></i><span class="text-[10px]">Bans</span>
                </button>
                <button onclick="switchAdminTab('analytics')" class="flex flex-col items-center gap-0.5 p-2 text-gray-500" data-admin-nav-mobile="analytics">
                    <i data-lucide="bar-chart-3" class="w-5 h-5"></i><span class="text-[10px]">Analytics</span>
                </button>
                <button onclick="switchAdminTab('settings')" class="flex flex-col items-center gap-0.5 p-2 text-gray-500" data-admin-nav-mobile="settings">
                    <i data-lucide="settings" class="w-5 h-5"></i><span class="text-[10px]">Settings</span>
                </button>
            </div>
        </div>

        <!-- Content -->
        <main class="flex-1 p-4 md:p-8 pb-24 lg:pb-8" id="admin-content">
            ${renderAdminDashboard()}
        </main>
    </div>`;
    }

    async function switchAdminTab(tab) {
        document.querySelectorAll('[data-admin-nav]').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('[data-admin-nav-mobile]').forEach(n => {
            n.classList.remove('text-gold-400');
            n.classList.add('text-gray-500');
        });
        
        const activeNav = document.querySelector(`[data-admin-nav="${tab}"]`);
        const activeMobile = document.querySelector(`[data-admin-nav-mobile="${tab}"]`);
        if (activeNav) activeNav.classList.add('active');
        if (activeMobile) {
            activeMobile.classList.remove('text-gray-500');
            activeMobile.classList.add('text-gold-400');
        }

        const content = document.getElementById('admin-content');

        if (tab === 'anime') {
            loadAnimeFromApi().finally(() => {
                if (!content) return;
                // Use new catalogue management if available, otherwise fall back to old system
                if (window.renderCatalogueManagement) {
                    content.innerHTML = window.renderCatalogueManagement();
                    bindCatalogueActions();
                } else {
                    content.innerHTML = renderAdminAnime();
                }
                if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
                bindAdminAnimeActions();
            });
            return;
        }

        switch(tab) {
            case 'dashboard': 
                await renderAdminDashboard();
                break;
            case 'support':
                content.innerHTML = renderAdminSupport();
                setTimeout(loadAdminSupportTable, 0);
                break;
            case 'anime': content.innerHTML = renderAdminAnime(); break;
            case 'users':
                content.innerHTML = renderAdminUsers();
                setTimeout(loadAdminUsersTable, 0);
                break;
            case 'bans':
                content.innerHTML = renderBannedUsers();
                setTimeout(loadBannedUsersTable, 0);
                break;
            case 'announcements':
                content.innerHTML = renderAnnouncementManager();
                setTimeout(loadAdminAnnouncements, 0);
                break;
            case 'analytics':
                content.innerHTML = renderAdminAnalytics();
                break;
            case 'subscriptions':
                content.innerHTML = renderAdminSubscriptions();
                break;
            case 'reports':
                content.innerHTML = renderAdminReports();
                break;
            case 'settings':
                content.innerHTML = renderAdminSettings();
                break;
        }

        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        if (tab === 'anime') bindAdminAnimeActions();
    }

    async function renderAdminDashboard() {
        const content = document.getElementById('admin-content');
        if (!content) return;

        // Show loading state
        content.innerHTML = `
            <div class="mb-6">
                <h1 class="text-2xl md:text-3xl font-black">Dashboard</h1>
                <p class="text-gray-500 text-sm mt-1">Loading statistics...</p>
            </div>
        `;

        try {
            const response = await fetch('/api/admin/stats');
            const data = await response.json();

            if (!data.ok) {
                throw new Error(data.error || 'Failed to load statistics');
            }

            const stats = data.stats || {};
            const recentActivity = data.recentActivity || [];
            const recentAnime = data.recentAnime || [];
            const topRatedAnime = data.topRatedAnime || [];
            const mostActiveUsers = data.mostActiveUsers || [];
            const hourlyActivity = stats.hourlyActivity || [];
            const dayOfWeekActivity = stats.dayOfWeekActivity || [];
            const seasonalTrends = stats.seasonalTrends || [];

            content.innerHTML = `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black anim-slide-up">Dashboard</h1>
        <p class="text-gray-500 text-sm mt-1 anim-slide-up anim-delay-1">Welcome back! Here's your overview.</p>
    </div>

    <!-- Quick Actions -->
    <div class="glass-card rounded-2xl p-5 mb-8 anim-fade-in">
        <h3 class="font-bold mb-4">Quick Actions</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <button onclick="switchAdminTab('anime')" class="flex flex-col items-center gap-2 p-3 rounded-xl bg-gold-400/10 hover:bg-gold-400/20 transition-all group">
                <div class="w-10 h-10 rounded-lg bg-gold-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="tv" class="w-5 h-5 text-gold-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Manage Anime</span>
            </button>
            
            <button onclick="switchAdminTab('users')" class="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-400/10 hover:bg-blue-400/20 transition-all group">
                <div class="w-10 h-10 rounded-lg bg-blue-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="users" class="w-5 h-5 text-blue-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Manage Users</span>
            </button>
            
            <button onclick="refreshDashboard()" class="flex flex-col items-center gap-2 p-3 rounded-xl bg-green-400/10 hover:bg-green-400/20 transition-all group">
                <div class="w-10 h-10 rounded-lg bg-green-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="refresh-cw" class="w-5 h-5 text-green-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Refresh Data</span>
            </button>
            
            <button onclick="switchAdminTab('analytics')" class="flex flex-col items-center gap-2 p-3 rounded-xl bg-orange-400/10 hover:bg-orange-400/20 transition-all group">
                <div class="w-10 h-10 rounded-lg bg-orange-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="bar-chart-3" class="w-5 h-5 text-orange-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Analytics</span>
            </button>
            
            <button onclick="switchAdminTab('settings')" class="flex flex-col items-center gap-2 p-3 rounded-xl bg-pink-400/10 hover:bg-pink-400/20 transition-all group">
                <div class="w-10 h-10 rounded-lg bg-pink-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="settings" class="w-5 h-5 text-pink-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Settings</span>
            </button>
        </div>
        
        <!-- Secondary Quick Actions -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <button onclick="switchAdminTab('reports')" class="flex items-center gap-2 p-3 rounded-xl bg-red-400/10 hover:bg-red-400/20 transition-all group">
                <div class="w-8 h-8 rounded-lg bg-red-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="flag" class="w-4 h-4 text-red-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">View Reports</span>
            </button>
            
            <button onclick="switchAdminTab('subscriptions')" class="flex items-center gap-2 p-3 rounded-xl bg-yellow-400/10 hover:bg-yellow-400/20 transition-all group">
                <div class="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="credit-card" class="w-4 h-4 text-yellow-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Subscriptions</span>
            </button>
            
            <button onclick="exportDashboardData()" class="flex items-center gap-2 p-3 rounded-xl bg-indigo-400/10 hover:bg-indigo-400/20 transition-all group">
                <div class="w-8 h-8 rounded-lg bg-indigo-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="download" class="w-4 h-4 text-indigo-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Export Data</span>
            </button>
            
            <button onclick="navigate('home')" class="flex items-center gap-2 p-3 rounded-xl bg-gray-400/10 hover:bg-gray-400/20 transition-all group">
                <div class="w-8 h-8 rounded-lg bg-gray-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-gray-400"></i>
                </div>
                <span class="text-xs font-semibold text-gray-300">Back to Site</span>
            </button>
        </div>
    </div>

    <!-- Enhanced Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="stat-card anim-slide-up anim-delay-1">
            <div class="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center mb-3">
                <i data-lucide="users" class="w-5 h-5 text-gold-400"></i>
            </div>
            <p class="text-2xl font-black">${stats.totalUsers || 0}</p>
            <p class="text-xs text-gray-500">Total Users</p>
            <p class="text-xs text-green-400">+${stats.newUsersToday || 0} today</p>
        </div>
        <div class="stat-card anim-slide-up anim-delay-2">
            <div class="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center mb-3">
                <i data-lucide="tv" class="w-5 h-5 text-purple-400"></i>
            </div>
            <p class="text-2xl font-black">${stats.totalAnime || 0}</p>
            <p class="text-xs text-gray-500">Total Anime</p>
            <p class="text-xs text-blue-400">${stats.featuredAnime || 0} featured</p>
        </div>
        <div class="stat-card anim-slide-up anim-delay-3">
            <div class="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center mb-3">
                <i data-lucide="crown" class="w-5 h-5 text-blue-400"></i>
            </div>
            <p class="text-2xl font-black">${stats.premiumUsers || 0}</p>
            <p class="text-xs text-gray-500">Premium Users</p>
            <p class="text-xs text-purple-400">${stats.premiumAnime || 0} premium anime</p>
        </div>
        <div class="stat-card anim-slide-up anim-delay-4">
            <div class="w-10 h-10 rounded-xl bg-green-400/10 flex items-center justify-center mb-3">
                <i data-lucide="trending-up" class="w-5 h-5 text-green-400"></i>
            </div>
            <p class="text-2xl font-black">${stats.trendingAnime || 0}</p>
            <p class="text-xs text-gray-500">Trending Anime</p>
            <p class="text-xs text-orange-400">${stats.newEpisodesAnime || 0} new episodes</p>
        </div>
    </div>

    <!-- Episode Analytics & Most Viewed Section -->
    <div class="glass-card rounded-2xl p-6 mb-8 anim-fade-in border border-gold-400/20 bg-gradient-to-br from-gold-400/5 via-transparent to-transparent">
        <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gold-400/20 flex items-center justify-center">
                    <i data-lucide="play-circle" class="w-5 h-5 text-gold-400"></i>
                </div>
                <div>
                    <h3 class="font-bold text-lg text-black dark:text-white">Episode Analytics</h3>
                    <p class="text-xs text-gray-400">Real-time YouTube-style view metrics across all episodes</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs font-semibold px-3 py-1 rounded-full bg-gold-400/10 text-gold-400 border border-gold-400/20 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-gold-400 animate-pulse"></span> Live Tracking
                </span>
            </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-black/5 dark:bg-black/20 p-4 rounded-xl border border-black/5 dark:border-white/5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Views</p>
                <p class="text-2xl lg:text-3xl font-black text-black dark:text-white mt-1.5">${typeof formatViewCount === 'function' ? formatViewCount(stats.totalViews || 0, { withSuffix: false }) : (stats.totalViews || 0).toLocaleString()}</p>
                <p class="text-[11px] text-gold-400 mt-1">${(stats.totalViews || 0).toLocaleString()} total plays</p>
            </div>
            <div class="bg-black/5 dark:bg-black/20 p-4 rounded-xl border border-black/5 dark:border-white/5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold">Today</p>
                <p class="text-2xl lg:text-3xl font-black text-green-400 mt-1.5">${(stats.viewsToday || 0).toLocaleString()}</p>
                <p class="text-[11px] text-gray-400 mt-1">24h qualified views</p>
            </div>
            <div class="bg-black/5 dark:bg-black/20 p-4 rounded-xl border border-black/5 dark:border-white/5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold">This Week</p>
                <p class="text-2xl lg:text-3xl font-black text-blue-400 mt-1.5">${(stats.viewsThisWeek || 0).toLocaleString()}</p>
                <p class="text-[11px] text-gray-400 mt-1">Last 7 days</p>
            </div>
            <div class="bg-black/5 dark:bg-black/20 p-4 rounded-xl border border-black/5 dark:border-white/5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold">Most Viewed Episode</p>
                ${stats.mostViewedEpisode ? `
                    <p class="text-sm font-black text-black dark:text-white mt-1.5 truncate" title="${stats.mostViewedEpisode.animeTitle} — Episode ${stats.mostViewedEpisode.episodeNumber}">
                        ${stats.mostViewedEpisode.animeTitle}
                    </p>
                    <p class="text-[11px] text-gold-400 mt-0.5 font-bold">
                        Ep ${stats.mostViewedEpisode.episodeNumber} • ${typeof formatViewCount === 'function' ? formatViewCount(stats.mostViewedEpisode.views || 0) : stats.mostViewedEpisode.views + ' views'}
                    </p>
                ` : `
                    <p class="text-sm font-semibold text-gray-500 mt-1.5">No view data yet</p>
                    <p class="text-[11px] text-gray-500 mt-1">Waiting for plays</p>
                `}
            </div>
        </div>

        <!-- Most Viewed Episodes Leaderboard -->
        <div>
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-bold text-sm text-black dark:text-white flex items-center gap-2">
                    <span>🔥</span> Most Viewed Episodes
                </h4>
                <span class="text-xs text-gray-400">Top Leaderboard</span>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
                ${Array.isArray(stats.mostViewedEpisodes) && stats.mostViewedEpisodes.length > 0 ? stats.mostViewedEpisodes.map((item, idx) => `
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors border border-black/5 dark:border-white/5">
                        <span class="text-sm font-black w-6 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-500'}">
                            #${idx + 1}
                        </span>
                        <img src="${ensureHttps(item.thumbnail)}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-black/40" alt="${item.animeTitle}">
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-black text-black dark:text-white truncate">${item.animeTitle}</p>
                            <p class="text-[11px] text-gray-400 mt-0.5">${item.type === 'anime' ? `Episode ${item.episodeNumber}` : 'Full Movie'}</p>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <span class="text-xs font-bold text-gold-400 px-2.5 py-1 rounded-lg bg-gold-400/10">
                                ▶ ${typeof formatViewCount === 'function' ? formatViewCount(item.views || 0) : item.views + ' views'}
                            </span>
                        </div>
                    </div>
                `).join('') : `
                    <div class="col-span-2 text-center py-6 text-gray-500 text-sm">
                        No episode views recorded yet. Video plays will appear here in real time.
                    </div>
                `}
            </div>
        </div>
    </div>

    <!-- Content Analytics Section -->
    <div class="grid lg:grid-cols-3 gap-6 mb-8">
        <!-- Anime Status Distribution -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Anime Status</h3>
            <div class="space-y-3">
                ${Object.entries(stats.animeStatusDistribution || {}).map(([status, count]) => {
                    const colors = {
                        ongoing: 'from-green-400 to-green-500',
                        completed: 'from-blue-400 to-blue-500',
                        upcoming: 'from-purple-400 to-purple-500'
                    };
                    const total = stats.totalAnime || 1;
                    const percentage = Math.round((count / total) * 100);
                    return `
                        <div>
                            <div class="flex justify-between text-sm mb-1">
                                <span class="capitalize">${status}</span>
                                <span class="text-gray-500">${count} (${percentage}%)</span>
                            </div>
                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r ${colors[status] || 'from-gray-400 to-gray-500'} rounded-full" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- Top Rated Anime -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Top Rated Anime</h3>
            <div class="space-y-3">
                ${topRatedAnime.length > 0 ? topRatedAnime.slice(0, 5).map((anime, i) => `
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold w-5 text-gold-400">#${i + 1}</span>
                        <img src="${ensureHttps(anime.image)}" class="w-10 h-14 rounded-lg object-cover" alt="${anime.title}">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-sm truncate">${anime.title}</p>
                            <p class="text-xs text-gray-500">⭐ ${anime.averageRating?.toFixed(1) || 'N/A'} (${anime.ratingCount || 0} votes)</p>
                        </div>
                    </div>
                `).join('') : '<p class="text-gray-500 text-sm">No ratings yet</p>'}
            </div>
        </div>

        <!-- Recently Added Anime -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Recently Added</h3>
            <div class="space-y-3">
                ${recentAnime.length > 0 ? recentAnime.slice(0, 5).map(anime => `
                    <div class="flex items-center gap-3">
                        <img src="${ensureHttps(anime.image)}" class="w-10 h-14 rounded-lg object-cover" alt="${anime.title}">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-sm truncate">${anime.title}</p>
                            <p class="text-xs text-gray-500">${formatTimeAgo(anime.createdAt)}</p>
                        </div>
                        <span class="text-xs px-2 py-1 rounded-full ${anime.status === 'Ongoing' ? 'bg-green-400/10 text-green-400' : anime.status === 'Completed' ? 'bg-blue-400/10 text-blue-400' : 'bg-purple-400/10 text-purple-400'}">${anime.status}</span>
                    </div>
                `).join('') : '<p class="text-gray-500 text-sm">No anime added yet</p>'}
            </div>
        </div>
    </div>

    <!-- Genre Distribution & Growth Charts -->
    <div class="grid lg:grid-cols-2 gap-6 mb-8">
        <!-- Genre Distribution -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Genre Distribution</h3>
            <div class="space-y-2">
                ${Object.entries(stats.genreDistribution || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([genre, count]) => {
                    const total = stats.totalAnime || 1;
                    const percentage = Math.round((count / total) * 100);
                    return `
                        <div class="flex items-center gap-3">
                            <div class="flex-1">
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="truncate">${genre}</span>
                                    <span class="text-gray-500">${count}</span>
                                </div>
                                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-gold-400 to-gold-500 rounded-full" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- User Growth Chart -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">User Growth (7 Days)</h3>
            <div class="space-y-2">
                ${stats.userGrowth?.map(day => {
                    const maxGrowth = Math.max(...stats.userGrowth.map(d => d.count), 1);
                    const height = Math.round((day.count / maxGrowth) * 100);
                    const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                    return `
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 w-12">${date}</span>
                            <div class="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden flex items-end">
                                <div class="w-full bg-gradient-to-t from-gold-400 to-gold-500 rounded-lg transition-all" style="height: ${Math.max(height, 5)}%"></div>
                            </div>
                            <span class="text-xs font-bold w-8 text-right">${day.count}</span>
                        </div>
                    `;
                }).join('') || '<p class="text-gray-500 text-sm">No growth data available</p>'}
            </div>
        </div>
    </div>

    <!-- User Analytics & Recent Activity -->
    <div class="grid lg:grid-cols-2 gap-6 mb-8">
        <!-- User Plan Distribution -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">User Plan Distribution</h3>
            <div class="grid grid-cols-2 gap-4">
                ${Object.entries(stats.userPlanDistribution || {}).map(([plan, count]) => {
                    const colors = {
                        free: 'bg-gray-400/10 text-gray-400',
                        basic: 'bg-blue-400/10 text-blue-400',
                        premium: 'bg-purple-400/10 text-purple-400',
                        vip: 'bg-gold-400/10 text-gold-400'
                    };
                    return `
                        <div class="p-3 rounded-xl ${colors[plan] || 'bg-gray-400/10 text-gray-400'}">
                            <p class="text-2xl font-black">${count}</p>
                            <p class="text-xs capitalize">${plan}</p>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Recent Activity</h3>
            <div class="space-y-3">
                ${recentActivity.length > 0 ? recentActivity.map(a => `
                    <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all">
                        <div class="w-8 h-8 rounded-lg ${a.color.replace('text-', 'bg-').replace('400', '400/10')} flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${a.icon}" class="w-4 h-4 ${a.color}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm">${a.text}</p>
                        </div>
                        <span class="text-xs text-gray-500 whitespace-nowrap">${a.time}</span>
                    </div>
                `).join('') : '<p class="text-gray-500 text-sm">No recent activity</p>'}
            </div>
        </div>
    </div>

    <!-- User Analytics Section -->
    <div class="grid lg:grid-cols-3 gap-6 mb-8">
        <!-- User Activity Distribution -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">User Activity</h3>
            <div class="space-y-3">
                ${Object.entries(stats.userActivityDistribution || {}).map(([period, count]) => {
                    const colors = {
                        lastDay: 'from-green-400 to-green-500',
                        lastWeek: 'from-blue-400 to-blue-500',
                        lastMonth: 'from-purple-400 to-purple-500'
                    };
                    const total = stats.totalUsers || 1;
                    const percentage = Math.round((count / total) * 100);
                    return `
                        <div>
                            <div class="flex justify-between text-sm mb-1">
                                <span class="capitalize">${period.replace('last', 'Last ')}</span>
                                <span class="text-gray-500">${count} (${percentage}%)</span>
                            </div>
                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r ${colors[period] || 'from-gray-400 to-gray-500'} rounded-full" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- Monthly User Registrations -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Monthly Registrations</h3>
            <div class="space-y-2">
                ${stats.monthlyRegistrations?.map(month => {
                    const maxRegistrations = Math.max(...stats.monthlyRegistrations.map(m => m.count), 1);
                    const height = Math.round((month.count / maxRegistrations) * 100);
                    return `
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 w-12">${month.month}</span>
                            <div class="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden flex items-end">
                                <div class="w-full bg-gradient-to-t from-gold-400 to-gold-500 rounded-lg transition-all" style="height: ${Math.max(height, 5)}%"></div>
                            </div>
                            <span class="text-xs font-bold w-6 text-right">${month.count}</span>
                        </div>
                    `;
                }).join('') || '<p class="text-gray-500 text-sm">No registration data</p>'}
            </div>
        </div>

        <!-- User Retention -->
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">User Retention</h3>
            <div class="text-center mb-4">
                <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-500 p-1">
                    <div class="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                        <span class="text-2xl font-black text-green-400">${stats.retentionRate || 0}%</span>
                    </div>
                </div>
                <p class="text-sm text-gray-500 mt-2">Retention Rate</p>
            </div>
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500">Active Watchers</span>
                    <span class="font-bold">${stats.activeWatchers || 0}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500">New This Week</span>
                    <span class="font-bold">${stats.newUsersThisWeek || 0}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Most Active Users -->
    <div class="glass-card rounded-2xl p-5 anim-fade-in mb-8">
        <h3 class="font-bold mb-4">Most Active Users</h3>
        <div class="space-y-3">
            ${mostActiveUsers?.length > 0 ? mostActiveUsers.slice(0, 5).map((user, i) => `
                <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all">
                    <div class="w-8 h-8 rounded-lg bg-gold-400/10 flex items-center justify-center">
                        <span class="text-sm font-bold text-gold-400">#${i + 1}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-sm truncate">${user.username}</p>
                        <p class="text-xs text-gray-500">Member since ${user.memberSince}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs px-2 py-1 rounded-full ${user.plan === 'Free' ? 'bg-gray-400/10 text-gray-400' : user.plan === 'Premium' ? 'bg-purple-400/10 text-purple-400' : 'bg-gold-400/10 text-gold-400'}">${user.plan}</span>
                        <p class="text-xs text-gray-500 mt-1">Active ${user.lastActive}</p>
                    </div>
                </div>
            `).join('') : '<p class="text-gray-500 text-sm">No user activity data</p>'}
        </div>
    </div>

    <!-- Time-based Analytics Section -->
    <div class="glass-card rounded-2xl p-5 anim-fade-in mb-8">
        <h3 class="font-bold mb-4">Time-based Analytics</h3>
        
        <!-- Peak Usage Summary -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="p-4 rounded-xl bg-gold-400/10 text-center">
                <i data-lucide="clock" class="w-6 h-6 text-gold-400 mx-auto mb-2"></i>
                <p class="text-2xl font-black">${stats.peakUsage?.hour || 'N/A'}</p>
                <p class="text-xs text-gray-500">Peak Hour</p>
            </div>
            <div class="p-4 rounded-xl bg-purple-400/10 text-center">
                <i data-lucide="calendar" class="w-6 h-6 text-purple-400 mx-auto mb-2"></i>
                <p class="text-2xl font-black">${stats.peakUsage?.day || 'N/A'}</p>
                <p class="text-xs text-gray-500">Peak Day</p>
            </div>
            <div class="p-4 rounded-xl bg-blue-400/10 text-center">
                <i data-lucide="activity" class="w-6 h-6 text-blue-400 mx-auto mb-2"></i>
                <p class="text-2xl font-black">${stats.peakUsage?.hourCount || 0}</p>
                <p class="text-xs text-gray-500">Peak Hour Activity</p>
            </div>
            <div class="p-4 rounded-xl bg-green-400/10 text-center">
                <i data-lucide="trending-up" class="w-6 h-6 text-green-400 mx-auto mb-2"></i>
                <p class="text-2xl font-black">${stats.peakUsage?.dayCount || 0}</p>
                <p class="text-xs text-gray-500">Peak Day Activity</p>
            </div>
        </div>

        <!-- Peak Usage Hours Chart -->
        <div class="mb-6">
            <h4 class="font-semibold mb-3">Peak Usage Hours (24h)</h4>
            <div class="h-32 flex items-end gap-1">
                ${hourlyActivity?.map((hour, i) => {
                    const maxActivity = Math.max(...hourlyActivity.map(h => h.count), 1);
                    const height = Math.round((hour.count / maxActivity) * 100);
                    const isPeak = hour.hour === parseInt(stats.peakUsage?.hour?.split(':')[0]);
                    return `
                        <div class="flex-1 flex flex-col items-center gap-1 group">
                            <div class="w-full rounded-t-lg transition-all ${isPeak ? 'bg-gradient-to-t from-gold-400 to-gold-500' : 'bg-gradient-to-t from-gray-600 to-gray-500'} group-hover:from-gold-400 group-hover:to-gold-500" style="height: ${Math.max(height, 2)}%"></div>
                            <span class="text-xs text-gray-500">${i % 3 === 0 ? hour.label : ''}</span>
                        </div>
                    `;
                }).join('') || '<p class="text-gray-500 text-sm">No hourly data</p>'}
            </div>
        </div>

        <!-- Day-of-Week Activity -->
        <div class="mb-6">
            <h4 class="font-semibold mb-3">Day-of-Week Activity Patterns</h4>
            <div class="grid grid-cols-7 gap-2">
                ${dayOfWeekActivity?.map((day, i) => {
                    const maxActivity = Math.max(...dayOfWeekActivity.map(d => d.count), 1);
                    const height = Math.round((day.count / maxActivity) * 100);
                    const isPeak = day.day === stats.peakUsage?.day;
                    return `
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-full h-24 rounded-lg flex items-end">
                                <div class="w-full rounded-b-lg transition-all ${isPeak ? 'bg-gradient-to-t from-gold-400 to-gold-500' : 'bg-gradient-to-t from-gray-600 to-gray-500'}" style="height: ${Math.max(height, 5)}%"></div>
                            </div>
                            <div class="text-center">
                                <p class="text-xs font-semibold ${isPeak ? 'text-gold-400' : 'text-gray-400'}">${day.day.slice(0, 3)}</p>
                                <p class="text-xs text-gray-500">${day.count}</p>
                            </div>
                        </div>
                    `;
                }).join('') || '<p class="text-gray-500 text-sm">No day data</p>'}
            </div>
        </div>

        <!-- Seasonal Trends -->
        <div>
            <h4 class="font-semibold mb-3">Seasonal Trends (12 Months)</h4>
            <div class="space-y-2">
                ${seasonalTrends?.map(trend => {
                    const maxNewUsers = Math.max(...seasonalTrends.map(t => t.newUsers), 1);
                    const maxActiveUsers = Math.max(...seasonalTrends.map(t => t.activeUsers), 1);
                    const newUsersHeight = Math.round((trend.newUsers / maxNewUsers) * 100);
                    const activeUsersHeight = Math.round((trend.activeUsers / maxActiveUsers) * 100);
                    return `
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 w-16">${trend.month}</span>
                            <div class="flex-1 flex gap-1">
                                <div class="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden flex items-end relative">
                                    <div class="w-full bg-gradient-to-t from-blue-400 to-blue-500 rounded-lg" style="height: ${Math.max(newUsersHeight, 3)}%"></div>
                                    <span class="absolute top-1 left-2 text-xs font-bold text-blue-400">${trend.newUsers}</span>
                                </div>
                                <div class="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden flex items-end relative">
                                    <div class="w-full bg-gradient-to-t from-green-400 to-green-500 rounded-lg" style="height: ${Math.max(activeUsersHeight, 3)}%"></div>
                                    <span class="absolute top-1 left-2 text-xs font-bold text-green-400">${trend.activeUsers}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('') || '<p class="text-gray-500 text-sm">No seasonal data</p>'}
            </div>
            <div class="flex gap-4 mt-3 text-xs">
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded bg-blue-400"></div>
                    <span class="text-gray-400">New Users</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded bg-green-400"></div>
                    <span class="text-gray-400">Active Users</span>
                </div>
            </div>
        </div>
    </div>`;

            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

        } catch (error) {
            console.error('Failed to load admin stats:', error);
            content.innerHTML = `
                <div class="mb-6">
                    <h1 class="text-2xl md:text-3xl font-black">Dashboard</h1>
                    <p class="text-gray-500 text-sm mt-1">Failed to load statistics. Please try again.</p>
                </div>
                <button onclick="switchAdminTab('dashboard')" class="btn-primary">Retry</button>
            `;
        }
    }

    async function renderAdminSupport() {
        const content = document.getElementById('admin-content');
        if (!content) return;

        // Show loading state
        content.innerHTML = `
            <div class="mb-6">
                <h1 class="text-2xl md:text-3xl font-black">Support / Donations</h1>
                <p class="text-gray-500 text-sm mt-1">Loading donation statistics...</p>
            </div>
        `;

        try {
            const token = localStorage.getItem('anify-token') || '';
            const [statsResponse, donationsResponse] = await Promise.all([
                fetch('/api/admin/donations/stats', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }),
                fetch('/api/admin/donations?limit=20', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
            ]);

            console.log('Stats response status:', statsResponse.status);
            console.log('Donations response status:', donationsResponse.status);

            const statsResult = await statsResponse.json();
            const donationsResult = await donationsResponse.json();

            console.log('Stats result:', statsResult);
            console.log('Donations result:', donationsResult);

            const stats = statsResult.stats || {};
            const donations = donationsResult.donations || [];

            console.log('Donations count:', donations.length);
            console.log('Donations:', donations);

            content.innerHTML = `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Support / Donations</h1>
        <p class="text-gray-500 text-sm mt-1">Manage community support and donations</p>
    </div>

    <!-- Support Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="stat-card">
            <div class="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center mb-3">
                <i data-lucide="heart" class="w-5 h-5 text-gold-400"></i>
            </div>
            <p class="text-2xl font-black">${stats.totalSupporters || 0}</p>
            <p class="text-xs text-gray-500">Total Supporters</p>
        </div>
        <div class="stat-card">
            <div class="w-10 h-10 rounded-xl bg-green-400/10 flex items-center justify-center mb-3">
                <i data-lucide="users" class="w-5 h-5 text-green-400"></i>
            </div>
            <p class="text-2xl font-black">${stats.totalDonations || 0}</p>
            <p class="text-xs text-gray-500">Successful Donations</p>
        </div>
        <div class="stat-card">
            <div class="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center mb-3">
                <i data-lucide="naira-sign" class="w-5 h-5 text-blue-400"></i>
            </div>
            <p class="text-2xl font-black">₦${(stats.totalAmount || 0).toLocaleString()}</p>
            <p class="text-xs text-gray-500">Total Support</p>
        </div>
        <div class="stat-card">
            <div class="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center mb-3">
                <i data-lucide="calendar" class="w-5 h-5 text-purple-400"></i>
            </div>
            <p class="text-2xl font-black">₦${(stats.thisMonthAmount || 0).toLocaleString()}</p>
            <p class="text-xs text-gray-500">This Month</p>
        </div>
    </div>

    <!-- Recent Donations -->
    <div class="glass-card rounded-2xl p-6">
        <h3 class="font-bold mb-4">Recent Donations</h3>
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead>
                    <tr class="border-b border-white/10">
                        <th class="pb-3 text-xs font-semibold text-gray-400">Email</th>
                        <th class="pb-3 text-xs font-semibold text-gray-400">Amount</th>
                        <th class="pb-3 text-xs font-semibold text-gray-400">Status</th>
                        <th class="pb-3 text-xs font-semibold text-gray-400">Date</th>
                        <th class="pb-3 text-xs font-semibold text-gray-400">Reference</th>
                        <th class="pb-3 text-xs font-semibold text-gray-400">Actions</th>
                    </tr>
                </thead>
                <tbody id="support-table-body">
                    <!-- Populated by loadAdminSupportTable -->
                </tbody>
            </table>
        </div>
    </div>
`;

            // Store donations for table rendering
            window.currentDonations = donations;
            
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

            // Wait for DOM to be ready, then render table
            setTimeout(() => {
                loadAdminSupportTable();
            }, 100);

        } catch (error) {
            console.error('Failed to load support data:', error);
            content.innerHTML = `
                <div class="mb-6">
                    <h1 class="text-2xl md:text-3xl font-black">Support / Donations</h1>
                    <p class="text-gray-500 text-sm mt-1">Failed to load donation data. Please try again.</p>
                </div>
                <button onclick="switchAdminTab('support')" class="btn-primary">Retry</button>
            `;
        }
    }

    function loadAdminSupportTable() {
        const tableBody = document.getElementById('support-table-body');
        console.log('Loading admin support table...');
        console.log('Table body element:', tableBody);
        console.log('Current donations:', window.currentDonations);
        
        if (!tableBody) {
            console.error('Table body element not found!');
            return;
        }
        
        if (!window.currentDonations) {
            console.error('No current donations data!');
            return;
        }

        const donations = window.currentDonations;
        console.log('Rendering donations:', donations);
        
        if (donations.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-gray-500">No donations yet</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = donations.map(donation => `
            <tr class="border-b border-white/5 hover:bg-white/5">
                <td class="py-3 text-sm">${donation.email || 'N/A'}</td>
                <td class="py-3 text-sm font-bold text-gold-400">₦${donation.amount.toLocaleString()}</td>
                <td class="py-3">
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                        donation.status === 'success' ? 'bg-green-400/20 text-green-400' :
                        donation.status === 'pending' ? 'bg-yellow-400/20 text-yellow-400' :
                        donation.status === 'failed' ? 'bg-red-400/20 text-red-400' :
                        'bg-gray-400/20 text-gray-400'
                    }">
                        ${donation.status.charAt(0).toUpperCase() + donation.status.slice(1)}
                    </span>
                </td>
                <td class="py-3 text-sm text-gray-400">${new Date(donation.createdAt).toLocaleDateString()}</td>
                <td class="py-3 text-sm font-mono text-gray-400">${donation.reference}</td>
                <td class="py-3">
                    ${donation.status !== 'success' ? `
                        <button onclick="manuallyVerifyDonation('${donation._id}')" class="text-xs text-gold-400 hover:text-gold-300 mr-2">Verify</button>
                    ` : ''}
                    ${donation.manuallyVerified ? '<span class="text-xs text-gray-500">(Manual)</span>' : ''}
                </td>
            </tr>
        `).join('');
        
        console.log('Table rendered successfully');
    }

    async function manuallyVerifyDonation(donationId) {
        if (!confirm('Are you sure you want to manually verify this donation? This should only be done for donations that were successfully processed but not automatically verified.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/donations/${donationId}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('anify-token') || ''}`
                }
            });

            const result = await response.json();

            if (result.ok) {
                alert('Donation verified successfully');
                // Reload the support section
                switchAdminTab('support');
            } else {
                alert('Failed to verify donation: ' + result.error);
            }
        } catch (error) {
            console.error('Manual verification error:', error);
            alert('Failed to verify donation. Please try again.');
        }
    }

    function showUploadModal(mode = 'create', animeId = null) {
        if (global.adminService && typeof global.adminService.setAdminMode === 'function') {
            global.adminService.setAdminMode(mode, animeId);
        }

        const modal = document.getElementById('upload-modal');
        if (!modal) return;

        const isMovieMode = mode === 'movie-create' || mode === 'movie-edit';
        const isEpisodeMode = mode === 'episode';

        // Only reuse the episode hub anime for episode actions. Edit actions
        // must resolve the requested ID to avoid editing stale hub data.
        let anime = isEpisodeMode ? window.currentHubAnime : null;
        
        // If not found in currentHubAnime, search in animeData with flexible ID matching
        if (!anime && animeId) {
            anime = animeData.find(a => 
                a?._id === animeId || 
                a?.id === animeId || 
                a?.clientId === animeId ||
                String(a?._id) === String(animeId) ||
                String(a?.clientId) === String(animeId)
            );
        }
        
        if (isEpisodeMode) {
            if (!anime) {
                console.error('Anime not found for episode management. ID:', animeId);
                alert('Anime not found. Please try refreshing the anime list.');
                return;
            }
            return renderEpisodeManagementHub(anime);
        }

        const forcedMovieType = isMovieMode ? (anime?.type || 'animated-movie') : undefined;

        modal.innerHTML = `
        <div class="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up shadow-2xl border-white/10">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center">
                        <i data-lucide="${isMovieMode ? 'film' : 'tv'}" class="w-5 h-5 text-gold-400"></i>
                    </div>
                    <h2 class="text-xl font-bold" id="admin-modal-title">${mode === 'edit' || mode === 'movie-edit' ? 'Edit Content' : 'Add New Content'}</h2>
                </div>
                <button onclick="hideUploadModal()" class="p-2 rounded-xl hover:bg-white/10 transition-all"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="space-y-4">
                <div data-admin-metadata>
                    <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Basic Information</label>
                    <div class="space-y-3">
                        <input id="admin-anime-title" type="text" class="input-field" placeholder="Title (English)">
                        <input id="admin-anime-title-jp" type="text" class="input-field" placeholder="Japanese Title">
                        <textarea id="admin-anime-desc" class="input-field resize-none" rows="3" placeholder="Synopsis/Description..."></textarea>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div data-admin-metadata>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Release Year</label>
                        <input id="admin-anime-year" type="number" class="input-field" placeholder="2024">
                    </div>
                    <div data-admin-metadata>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Content Type</label>
                        ${isMovieMode ? `
                            <select id="admin-anime-type" class="input-field" disabled>
                                <option value="animated-movie" ${forcedMovieType === 'animated-movie' ? 'selected' : ''}>Animated Movie</option>
                                <option value="live-movie" ${forcedMovieType === 'live-movie' ? 'selected' : ''}>Live Movie</option>
                            </select>
                            <input type="hidden" id="admin-anime-type-forced" value="${forcedMovieType || 'animated-movie'}" />
                        ` : `
                            <select id="admin-anime-type" class="input-field">
                                <option value="anime">Anime Series</option>
                                <option value="animated-movie">Animated Movie</option>
                                <option value="live-movie">Live Movie</option>
                            </select>
                        `}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4" data-admin-metadata>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Studio</label>
                        <input id="admin-anime-studio" type="text" class="input-field" placeholder="e.g. MAPPA">
                    </div>
                </div>

                <div data-admin-metadata>
                    <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Genres</label>
                    <div class="flex flex-wrap gap-2">
                        ${categories.filter(c => c !== 'All').map(c => `
                            <label class="flex items-center gap-1.5 text-[10px] bg-white/5 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-gold-400/10 transition-all border border-white/5">
                                <input type="checkbox" class="accent-gold-400 rounded" data-admin-genre value="${c}">
                                ${c}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4" data-admin-metadata>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Poster Image</label>
                        <input id="admin-poster-image" type="file" class="input-field text-xs" accept="image/*">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Banner Image</label>
                        <input id="admin-banner-image" type="file" class="input-field text-xs" accept="image/*">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4" data-admin-metadata>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Trailer URL</label>
                        <input id="admin-anime-trailer" type="url" class="input-field text-xs" placeholder="https://youtube.com/...">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Banner Video</label>
                        <input id="admin-banner-video" type="file" class="input-field text-xs" accept="video/*">
                    </div>
                </div>

                ${isMovieMode ? `
                <div class="space-y-4 pt-2">
                    <div class="p-4 rounded-xl bg-blue-400/5 border border-blue-400/10">
                        <label class="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 block">Movie Master File (1080p)</label>
                        <input id="admin-movie-video-1080p-file" type="file" class="input-field" accept="video/*" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-xs text-gray-500 mb-1 block">Intro Start</label><input id="admin-intro-start" type="text" inputmode="numeric" class="input-field" placeholder="0:00 or 0"></div>
                        <div><label class="text-xs text-gray-500 mb-1 block">Intro End</label><input id="admin-intro-end" type="text" inputmode="numeric" class="input-field" placeholder="1:30 or 90"></div>
                        <div><label class="text-xs text-gray-500 mb-1 block">Outro Start</label><input id="admin-outro-start" type="text" inputmode="numeric" class="input-field" placeholder="23:41"></div>
                        <div><label class="text-xs text-gray-500 mb-1 block">Outro End</label><input id="admin-outro-end" type="text" inputmode="numeric" class="input-field" placeholder="24:30"></div>
                    </div>
                </div>
                ` : `
                <div class="hidden">
                    <input id="admin-movie-video-1080p-file" type="file">
                    <input id="admin-intro-start" type="text" value="0:00">
                    <input id="admin-intro-end" type="text" value="1:30">
                    <input id="admin-outro-start" type="text" value="0:00">
                    <input id="admin-outro-end" type="text" value="0:00">
                </div>
                `}

                <div class="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 mt-2" data-admin-metadata>
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 text-sm cursor-pointer group"><input id="admin-anime-premium" type="checkbox" class="accent-gold-400 rounded"><span class="group-hover:text-gold-400 transition-colors text-xs font-bold uppercase">Premium Only</span></label>
                        <label class="flex items-center gap-2 text-sm cursor-pointer group"><input id="admin-anime-featured" type="checkbox" class="accent-gold-400 rounded"><span class="group-hover:text-gold-400 transition-colors text-xs font-bold uppercase">Featured</span></label>
                        <label class="flex items-center gap-2 text-sm cursor-pointer group"><input id="admin-anime-trending" type="checkbox" class="accent-gold-400 rounded"><span class="group-hover:text-gold-400 transition-colors text-xs font-bold uppercase">Trending</span></label>
                        <label class="flex items-center gap-2 text-sm cursor-pointer group"><input id="admin-anime-new-episode" type="checkbox" class="accent-gold-400 rounded"><span class="group-hover:text-gold-400 transition-colors text-xs font-bold uppercase">New Episode</span></label>
                    </div>
                    <div class="admin-banner-toggle scale-75 origin-right">
                        <input id="admin-banner-display-image" type="radio" name="admin-banner-display" value="image" checked>
                        <label for="admin-banner-display-image" title="Show Image"><i data-lucide="image" class="w-4 h-4"></i></label>
                        <input id="admin-banner-display-video" type="radio" name="admin-banner-display" value="video">
                        <label for="admin-banner-display-video" title="Show Video"><i data-lucide="film" class="w-4 h-4"></i></label>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4" data-admin-metadata>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Status</label>
                        <select id="admin-anime-status" class="input-field">
                            <option value="Airing">Airing</option>
                            <option value="Coming Soon">Coming Soon</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Release Date</label>
                        <input type="date" id="admin-anime-release-date" class="input-field">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4" data-admin-metadata>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Release Time</label>
                        <input type="text" id="admin-anime-release-time" class="input-field" placeholder="e.g., 7:00 PM">
                    </div>
                </div>

                <div class="pt-4 flex gap-3">
                    <button onclick="hideUploadModal()" class="flex-1 btn-secondary py-3 text-xs font-black uppercase tracking-widest">Cancel</button>
                    <button class="flex-[2] btn-primary py-3 text-xs font-black uppercase tracking-widest shadow-xl" onclick="uploadAdminVideo()" id="admin-submit-label">${mode.includes('edit') ? 'Save Changes' : 'Create Content'}</button>
                </div>
            </div>
        </div>`;

        // Auto-populate values
        const titleIn = document.getElementById('admin-anime-title');
        if (titleIn) titleIn.value = anime?.title || '';
        const titleJpIn = document.getElementById('admin-anime-title-jp');
        if (titleJpIn) titleJpIn.value = anime?.titleJp || '';
        const descIn = document.getElementById('admin-anime-desc');
        if (descIn) descIn.value = anime?.desc ?? anime?.description ?? '';
        const yearIn = document.getElementById('admin-anime-year');
        if (yearIn) yearIn.value = anime?.year || new Date().getFullYear();
        const studioIn = document.getElementById('admin-anime-studio');
        if (studioIn) studioIn.value = anime?.studio || '';
        const statusIn = document.getElementById('admin-anime-status');
        if (statusIn) statusIn.value = anime?.status || 'Airing';
        const releaseDateIn = document.getElementById('admin-anime-release-date');
        if (releaseDateIn && anime?.releaseDate) {
            releaseDateIn.value = new Date(anime.releaseDate).toISOString().split('T')[0];
        }
        const releaseTimeIn = document.getElementById('admin-anime-release-time');
        if (releaseTimeIn) releaseTimeIn.value = anime?.releaseTime || '';
        const trailerIn = document.getElementById('admin-anime-trailer');
        if (trailerIn) trailerIn.value = anime?.trailer || '';
        const premIn = document.getElementById('admin-anime-premium');
        if (premIn) premIn.checked = Boolean(anime?.premium);
        const featIn = document.getElementById('admin-anime-featured');
        if (featIn) featIn.checked = Boolean(anime?.featured);
        const trendingIn = document.getElementById('admin-anime-trending');
        if (trendingIn) trendingIn.checked = Boolean(anime?.trending);
        const newEpisodeIn = document.getElementById('admin-anime-new-episode');
        if (newEpisodeIn) newEpisodeIn.checked = Boolean(anime?.newEpisode);
        const typeIn = document.getElementById('admin-anime-type');
        if (typeIn) typeIn.value = anime?.type || 'anime';
        
        if (isMovieMode) {
            const iStart = document.getElementById('admin-intro-start');
            if (iStart) iStart.value = formatTimestampInput(anime?.introStart);
            const iEnd = document.getElementById('admin-intro-end');
            if (iEnd) iEnd.value = formatTimestampInput(anime?.introEnd);
            const oStart = document.getElementById('admin-outro-start');
            if (oStart) oStart.value = formatTimestampInput(anime?.outroStart);
            const oEnd = document.getElementById('admin-outro-end');
            if (oEnd) oEnd.value = formatTimestampInput(anime?.outroEnd);
        }

        const bannerDisplay = anime?.bannerDisplay || (anime?.bannerVideo ? 'video' : 'image');
        const bInput = document.getElementById(`admin-banner-display-${bannerDisplay}`);
        if (bInput) bInput.checked = true;

        document.querySelectorAll('[data-admin-genre]').forEach(input => {
            input.checked = Boolean(anime?.genres?.includes(input.value));
        });

        modal.classList.remove('hidden');
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    function calculateNextEpisodeNumber() {
        const anime = window.currentHubAnime;
        if (!anime) return 1;
        
        const episodes = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
        const existingNumbers = episodes.map(e => Number(e.episodeNumber));
        
        // Start from 1 and find the first available number
        let nextNum = 1;
        while (existingNumbers.includes(nextNum)) {
            nextNum++;
        }
        
        return nextNum;
    }

    function renderEpisodeManagementHub(anime) {
        console.log('[Episode Hub] Rendering episode management hub for anime:', anime.title);
        const modal = document.getElementById('upload-modal');
        if (!modal || !anime) return;

        const episodes = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
        const nextEpNum = calculateNextEpisodeNumber();
        console.log('[Episode Hub] Current episodes:', episodes.map(e => e.episodeNumber), 'Next episode number:', nextEpNum);

        modal.innerHTML = `
        <div class="glass-card rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden anim-slide-up shadow-2xl border-white/10">
            <!-- Hub Header -->
            <div class="p-6 border-b border-white/10 flex items-center justify-between bg-white/3 dark:bg-white/5">
                <div class="flex items-center gap-4">
                    <img src="${ensureHttps(anime.image)}" class="w-12 h-16 rounded-lg object-cover shadow-lg border border-white/10" alt="">
                    <div>
                        <h2 class="text-xl font-black text-black dark:text-white leading-tight">${anime.title}</h2>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-xs font-bold text-gold-400 uppercase tracking-widest">Manage Episodes</span>
                            <span class="w-1 h-1 rounded-full bg-black/10 dark:bg-white/20"></span>
                            <span class="text-xs text-gray-500 font-bold">${episodes.length} Episodes Total</span>
                        </div>
                    </div>
                </div>
                <button onclick="hideUploadModal()" class="p-2.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/10 transition-all text-gray-400 hover:text-black dark:hover:text-white border border-transparent hover:border-black/5 dark:hover:border-white/10">
                    <i data-lucide="x" class="w-6 h-6"></i>
                </button>
            </div>

            <div class="flex flex-1 overflow-hidden">
                <!-- Left Pane: Episode History -->
                <div class="w-80 border-r border-white/10 flex flex-col bg-black/5 dark:bg-black/20">
                    <div class="p-4 border-b border-white/5 flex items-center justify-between">
                        <span class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">History</span>
                        <i data-lucide="history" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-600"></i>
                    </div>
                    <div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar" id="hub-episode-list">
                        ${episodes.length > 0 ? episodes.sort((a, b) => b.episodeNumber - a.episodeNumber).map(e => `
                            <div class="group p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent dark:border-white/5 hover:border-gold-400/30 hover:bg-black/8 dark:hover:bg-white/8 transition-all flex items-center justify-between cursor-pointer" onclick="loadEpisodeIntoWorkspace(${e.episodeNumber})">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg bg-green-400/10 flex items-center justify-center border border-green-400/20">
                                        <i data-lucide="check" class="w-4 h-4 text-green-400"></i>
                                    </div>
                                    <div>
                                        <p class="text-sm font-bold text-black dark:text-white">Episode ${e.episodeNumber}</p>
                                        <p class="text-[10px] text-gray-500 font-bold uppercase">${Object.keys(e.sub?.qualities || {}).length > 0 ? 'Sub' : ''} ${Object.keys(e.dub?.qualities || {}).length > 0 ? '• Dub' : ''} • ${(typeof formatViewCount === 'function' ? formatViewCount(e.views || 0) : ((e.views || 0) + ' views'))}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-gold-400"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                                    <button class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400" onclick="deleteHubEpisode(${e.episodeNumber}, event)"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                                </div>
                            </div>
                        `).join('') : `
                            <div class="flex flex-col items-center justify-center py-10 text-center opacity-40">
                                <i data-lucide="inbox" class="w-10 h-10 mb-2"></i>
                                <p class="text-xs font-bold text-black dark:text-white">No episodes yet</p>
                            </div>
                        `}
                    </div>
                    <div class="p-4 bg-black/10 dark:bg-white/3 border-t border-white/10">
                        <button class="w-full btn-primary py-3 flex items-center justify-center gap-2 shadow-xl text-xs font-black uppercase" id="add-new-episode-btn">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i>
                            <span>Add New Episode</span>
                        </button>
                    </div>
                </div>

                <!-- Right Pane: Active Workspace -->
                <div class="flex-1 flex flex-col bg-black/10 dark:bg-black/40 overflow-y-auto p-8 relative custom-scrollbar" id="hub-workspace">
                    ${renderWorkspaceForm(anime, nextEpNum)}
                </div>
            </div>
        </div>`;

        modal.classList.remove('hidden');
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        
        // Set current active anime for workspace use
        window.currentHubAnime = anime;
        bindWorkspaceInteractions();
        
        // Bind the Add New Episode button
        const addEpisodeBtn = document.getElementById('add-new-episode-btn');
        if (addEpisodeBtn) {
            addEpisodeBtn.onclick = () => resetWorkspaceForNewEpisode(calculateNextEpisodeNumber());
            console.log('[Episode Hub] Add New Episode button bound');
        }
    }

    function renderWorkspaceForm(anime, epNum, existingData = null) {
        const isEdit = !!existingData;
        return `
        <div class="max-w-2xl mx-auto w-full">
            <div class="mb-8 flex items-center justify-between">
                <div>
                    <div class="flex items-center gap-3">
                        <h3 class="text-2xl font-black text-black dark:text-white" id="workspace-title">${isEdit ? 'Edit Episode ' + epNum : 'Upload Episode ' + epNum}</h3>
                        ${isEdit ? `<span class="px-2.5 py-1 rounded-full bg-gold-400/10 border border-gold-400/20 text-gold-400 text-xs font-bold flex items-center gap-1.5"><i data-lucide="play" class="w-3 h-3 fill-current"></i> ${(typeof formatViewCount === 'function' ? formatViewCount(existingData?.views || 0) : ((existingData?.views || 0) + ' views'))}</span>` : ''}
                    </div>
                    <p class="text-gray-500 text-sm mt-1 font-medium">Configure video files and metadata for this episode.</p>
                </div>
                <div id="upload-status-indicator" class="hidden">
                    <div class="flex items-center gap-3 bg-gold-400/10 border border-gold-400/20 px-4 py-2 rounded-2xl">
                        <div class="w-2 h-2 rounded-full bg-gold-400 animate-pulse"></div>
                        <span class="text-xs font-bold text-gold-400 uppercase tracking-wider">Uploading...</span>
                    </div>
                </div>
            </div>

            <!-- Progress Bar (Hidden by default) -->
            <div id="hub-progress-container" class="hidden mb-8">
                <div class="flex items-center justify-between mb-2">
                    <span id="hub-progress-text" class="text-xs font-bold text-gold-400 uppercase tracking-widest">Uploading Media...</span>
                    <span id="hub-progress-percent" class="text-xs font-black text-black dark:text-white">0%</span>
                </div>
                <div class="h-3 bg-black/5 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/10 overflow-hidden p-0.5">
                    <div id="hub-progress-bar" class="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all duration-300" style="width: 0%"></div>
                </div>
            </div>

            <div class="space-y-6">
                <!-- Episode Number & Conflict Warning -->
                <div class="relative">
                    <label class="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Episode Number</label>
                    <input id="admin-episode-number" type="number" min="1" step="1" class="input-field text-lg font-black h-14" value="${Math.max(1, Number(epNum) || 1)}" oninput="checkEpisodeConflict(this.value)">
                    <div id="conflict-warning" class="hidden absolute top-0 right-0">
                        <div class="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                            <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-red-500"></i>
                            <span class="text-[10px] font-bold text-red-500 uppercase">Existing episode detected</span>
                        </div>
                    </div>
                </div>

                <!-- Video Quality Accordions -->
                <div class="space-y-4">
                    <!-- 1080p Section -->
                    <div class="glass-card rounded-2xl border-white/5 overflow-hidden">
                        <button class="w-full p-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onclick="toggleAccordion('acc-1080')">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center text-blue-400 font-bold text-[10px]">HD</div>
                                <span class="font-black text-sm text-black dark:text-white">1080p Resolution</span>
                            </div>
                            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-500 transition-transform duration-300" id="icon-acc-1080"></i>
                        </button>
                        <div class="p-4 grid grid-cols-2 gap-4 bg-black/5 dark:bg-black/20" id="acc-1080">
                            ${renderDropZone('admin-video-file', 'Subbed Video (1080p)', existingData?.sub?.qualities?.['1080p'])}
                            ${renderDropZone('admin-dub-video-file', 'Dubbed Video (1080p)', existingData?.dub?.qualities?.['1080p'])}
                        </div>
                    </div>

                    <!-- 720p Section -->
                    <div class="glass-card rounded-2xl border-white/5 overflow-hidden">
                        <button class="w-full p-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onclick="toggleAccordion('acc-720')">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-purple-400/10 flex items-center justify-center text-purple-400 font-bold text-[10px]">SD</div>
                                <span class="font-black text-sm text-black dark:text-white">720p Resolution</span>
                            </div>
                            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-500 transition-transform duration-300 rotate-180" id="icon-acc-720"></i>
                        </button>
                        <div class="p-4 grid grid-cols-2 gap-4 bg-black/5 dark:bg-black/20 hidden" id="acc-720">
                            ${renderDropZone('admin-sub-720-video-file', 'Subbed Video (720p)', existingData?.sub?.qualities?.['720p'])}
                            ${renderDropZone('admin-dub-720-video-file', 'Dubbed Video (720p)', existingData?.dub?.qualities?.['720p'])}
                        </div>
                    </div>
                </div>

                <!-- Timestamps -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-2xl bg-black/5 dark:bg-white/3 border border-black/5 dark:border-white/5">
                    <div>
                        <label class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Intro Start <span class="normal-case tracking-normal">(mm:ss)</span></label>
                        <div class="relative">
                            <i data-lucide="play" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600"></i>
                            <input id="admin-intro-start" type="text" inputmode="numeric" class="input-field pl-10 h-10" placeholder="0:00" value="${formatTimestampInput(existingData?.introStart)}">
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Intro End <span class="normal-case tracking-normal">(mm:ss)</span></label>
                        <div class="relative">
                            <i data-lucide="fast-forward" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600"></i>
                            <input id="admin-intro-end" type="text" inputmode="numeric" class="input-field pl-10 h-10" placeholder="1:30" value="${formatTimestampInput(existingData?.introEnd ?? 90)}">
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Outro Start <span class="normal-case tracking-normal">(mm:ss)</span></label>
                        <div class="relative">
                            <i data-lucide="skip-forward" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600"></i>
                            <input id="admin-outro-start" type="text" inputmode="numeric" class="input-field pl-10 h-10" placeholder="23:41" value="${formatTimestampInput(existingData?.outroStart)}">
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Outro End <span class="normal-case tracking-normal">(mm:ss)</span></label>
                        <div class="relative">
                            <i data-lucide="square" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600"></i>
                            <input id="admin-outro-end" type="text" inputmode="numeric" class="input-field pl-10 h-10" placeholder="24:30" value="${formatTimestampInput(existingData?.outroEnd)}">
                        </div>
                    </div>
                </div>

                <div class="pt-6">
                    <button class="w-full btn-primary h-14 text-base font-black shadow-2xl shadow-gold-500/10 flex items-center justify-center gap-3 transition-all active:scale-95" onclick="uploadAdminVideo()">
                        <i data-lucide="cloud-upload" class="w-5 h-5"></i>
                        <span>${isEdit ? 'Update Existing Episode' : 'Upload Episode Content'}</span>
                    </button>
                </div>

                <section class="mt-8 pt-6 border-t border-white/10">
                    <div class="flex items-start justify-between gap-4 mb-4">
                        <div><h4 class="font-black text-black dark:text-white">🚀 Batch episode uploader</h4><p class="text-xs text-gray-500 mt-1">Add as many anime batches as you need. All batches share this safe upload limit, so only four videos upload at once.</p></div>
                        <select id="batch-upload-concurrency" class="input-field h-9 text-xs w-24"><option value="2">2 at once</option><option value="4" selected>4 at once</option><option value="6">6 at once</option></select>
                    </div>
                    <div id="batch-upload-drop" class="rounded-2xl border-2 border-dashed border-gold-400/30 bg-gold-400/5 p-5 text-center">
                        <input id="batch-episode-files" type="file" accept="video/*" multiple class="hidden">
                        <p class="font-bold text-sm">🎞️ Drop episode files here</p><p class="text-xs text-gray-500 mt-1">or <label for="batch-episode-files" class="text-gold-400 cursor-pointer font-bold">browse files</label> — episode numbers are detected from filenames.</p>
                    </div>
                    <div id="batch-upload-summary" class="text-xs text-gray-500 mt-4"></div>
                    <p class="text-[10px] text-gray-500 mt-2">ℹ️ You see only this anime’s files here. Other anime batches continue safely in the background and share the global upload limit.</p>
                    <div id="batch-upload-list" class="space-y-2 mt-3 max-h-80 overflow-y-auto custom-scrollbar"></div>
                    <div class="flex flex-wrap gap-3 mt-4"><button id="batch-upload-start" type="button" class="btn-primary px-4 py-2 text-xs font-black">🚀 Upload all</button><button id="batch-upload-auto-number" type="button" class="px-4 py-2 text-xs font-black rounded-xl border border-gold-400/30 text-gold-400">🔢 Auto-number missing files</button><label class="flex items-center gap-2 text-xs text-gray-500">Start at <input id="batch-upload-start-episode" type="number" min="1" step="1" value="1" class="input-field w-16 h-9 text-xs"></label><button id="batch-upload-apply-start" type="button" class="px-3 py-2 text-xs font-black rounded-xl border border-gold-400/30 text-gold-400">✓ Apply</button><button id="batch-upload-pause-all" type="button" class="px-4 py-2 text-xs font-black rounded-xl border border-white/10">⏸ Pause all</button></div>
                </section>
            </div>
        </div>`;
    }

    function renderDropZone(id, label, existingUrl = null) {
        const hasExisting = existingUrl && typeof existingUrl === 'string' && existingUrl.length > 0;
        return `
        <div class="drop-zone group relative h-32 rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 hover:border-gold-400/40 bg-black/5 dark:bg-white/3 hover:bg-gold-400/5 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden" 
             onclick="document.getElementById('${id}').click()" 
             data-drop-target="${id}">
            <input id="${id}" type="file" class="hidden" accept="video/*" onchange="handleFileSelect('${id}', this.files[0])">
            <div class="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform duration-500 ${hasExisting ? 'hidden' : ''}" id="label-${id}">
                <div class="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-1">
                    <i data-lucide="upload-cloud" class="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gold-400"></i>
                </div>
                <span class="text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-wider text-center px-4">${label}</span>
            </div>
            <div id="file-info-${id}" class="${hasExisting ? '' : 'hidden'} absolute inset-0 bg-gold-400/10 flex flex-col items-center justify-center p-4">
                <i data-lucide="file-video" class="w-6 h-6 text-gold-400 mb-1"></i>
                <span class="text-[9px] font-bold text-black dark:text-white truncate w-full text-center" id="name-${id}">${hasExisting ? 'Video uploaded' : 'filename.mp4'}</span>
                <button class="mt-2 text-[8px] font-black text-red-400 uppercase tracking-widest hover:text-red-300" onclick="clearFile('${id}', event)">${hasExisting ? 'Replace' : 'Remove'}</button>
            </div>
        </div>`;
    }

    function toggleAccordion(id) {
        const el = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (el) el.classList.toggle('hidden');
        if (icon) icon.classList.toggle('rotate-180');
    }

    function handleFileSelect(id, file) {
        if (!file) return;
        const label = document.getElementById('label-' + id);
        const info = document.getElementById('file-info-' + id);
        const name = document.getElementById('name-' + id);
        if (label) label.classList.add('hidden');
        if (info) info.classList.remove('hidden');
        if (name) name.textContent = file.name;
    }

    function clearFile(id, event) {
        if (event) event.stopPropagation();
        const input = document.getElementById(id);
        const label = document.getElementById('label-' + id);
        const info = document.getElementById('file-info-' + id);
        if (input) input.value = '';
        if (label) label.classList.remove('hidden');
        if (info) info.classList.add('hidden');
    }

    function checkEpisodeConflict(val) {
        const anime = window.currentHubAnime;
        const warning = document.getElementById('conflict-warning');
        if (!anime || !warning) return;
        const episodes = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
        const exists = episodes.some(e => Number(e.episodeNumber) === Number(val));
        warning.classList.toggle('hidden', !exists);
    }

    async function resetWorkspaceForNewEpisode(nextNum) {
        console.log('[Add New Episode] Button clicked, next episode number:', nextNum);
        
        const workspace = document.getElementById('hub-workspace');
        if (!workspace || !window.currentHubAnime) {
            console.error('[Add New Episode] Missing workspace or currentHubAnime');
            return;
        }

        const anime = window.currentHubAnime;
        console.log('[Add New Episode] Current anime:', anime.title, 'ID:', anime.id);

        // Recalculate next episode number to avoid conflicts
        const episodes = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
        const existingNumbers = episodes.map(e => Number(e.episodeNumber));
        let calculatedNextNum = nextNum;
        
        // Find the next available episode number
        while (existingNumbers.includes(calculatedNextNum)) {
            calculatedNextNum++;
        }
        
        if (calculatedNextNum !== nextNum) {
            console.log('[Add New Episode] Adjusted episode number from', nextNum, 'to', calculatedNextNum, 'to avoid conflict');
        }

        // Create the new episode in the database
        try {
            console.log('[Add New Episode] Creating episode in database...');
            const token = global.authService && typeof global.authService.getToken === 'function'
                ? global.authService.getToken()
                : null;

            if (!token) {
                console.error('[Add New Episode] No auth token available');
                alert('Authentication required. Please log in again.');
                return;
            }

            const response = await fetch(`/api/anime/${anime.id}/episodes/${calculatedNextNum}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    episodeNumber: calculatedNextNum,
                    episodeTitle: '',
                    sub: { qualities: {} },
                    dub: { qualities: {} }
                })
            });

            console.log('[Add New Episode] API response status:', response.status);
            const data = await response.json();
            console.log('[Add New Episode] API response data:', data);

            if (!response.ok || !data.ok) {
                console.error('[Add New Episode] Failed to create episode:', data.error);
                alert('Failed to create episode: ' + (data.error || 'Unknown error'));
                return;
            }

            console.log('[Add New Episode] Episode created successfully in database');

            // Update the local anime data with the response
            if (data.anime) {
                window.currentHubAnime = data.anime;
                console.log('[Add New Episode] Updated local anime data, episodes count:', data.anime.episodesMedia?.length || 0);
            }

            // Refresh the episode list in the sidebar
            const episodeList = document.getElementById('hub-episode-list');
            if (episodeList) {
                const episodes = Array.isArray(window.currentHubAnime.episodesMedia) ? window.currentHubAnime.episodesMedia : [];
                console.log('[Add New Episode] Refreshing sidebar with episodes:', episodes.map(e => e.episodeNumber));
                
                episodeList.innerHTML = episodes.length > 0 ? episodes.sort((a, b) => b.episodeNumber - a.episodeNumber).map(e => `
                    <div class="group p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent dark:border-white/5 hover:border-gold-400/30 hover:bg-black/8 dark:hover:bg-white/8 transition-all flex items-center justify-between cursor-pointer ${Number(e.episodeNumber) === Number(calculatedNextNum) ? 'hub-episode-active' : ''}" onclick="loadEpisodeIntoWorkspace(${e.episodeNumber})">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-green-400/10 flex items-center justify-center border border-green-400/20">
                                <i data-lucide="check" class="w-4 h-4 text-green-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-black dark:text-white">Episode ${e.episodeNumber}</p>
                                <p class="text-[10px] text-gray-500 font-bold uppercase">${Object.keys(e.sub?.qualities || {}).length > 0 ? 'Sub' : ''} ${Object.keys(e.dub?.qualities || {}).length > 0 ? '• Dub' : ''} • ${(typeof formatViewCount === 'function' ? formatViewCount(e.views || 0) : ((e.views || 0) + ' views'))}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-gold-400"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                            <button class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400" onclick="deleteHubEpisode(${e.episodeNumber}, event)"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="flex flex-col items-center justify-center py-10 text-center opacity-40">
                        <i data-lucide="inbox" class="w-10 h-10 mb-2"></i>
                        <p class="text-xs font-bold text-black dark:text-white">No episodes yet</p>
                    </div>
                `;
                
                // Re-initialize icons for the updated sidebar
                if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
            }

            // Update the workspace form for the new episode
            workspace.innerHTML = renderWorkspaceForm(window.currentHubAnime, calculatedNextNum);
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        bindWorkspaceInteractions();
        if (typeof global.initBatchEpisodeUpload === 'function') global.initBatchEpisodeUpload();

            console.log('[Add New Episode] Workspace updated for episode:', calculatedNextNum);

        } catch (error) {
            console.error('[Add New Episode] Error creating episode:', error);
            alert('Error creating episode: ' + error.message);
        }
    }

    function loadEpisodeIntoWorkspace(num) {
        console.log('[Load Episode] Loading episode into workspace:', num);
        const anime = window.currentHubAnime;
        if (!anime) {
            console.error('[Load Episode] No current anime found');
            return;
        }
        
        const ep = (anime.episodesMedia || []).find(e => Number(e.episodeNumber) === Number(num));
        console.log('[Load Episode] Found episode data:', ep ? 'Yes' : 'No');
        
        const workspace = document.getElementById('hub-workspace');
        if (workspace && ep) {
            workspace.innerHTML = renderWorkspaceForm(anime, num, ep);
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
            bindWorkspaceInteractions();

            // Initialize existing video indicators
            initializeExistingVideos(ep);

            // UI feedback in list
            document.querySelectorAll('#hub-episode-list > div').forEach(el => {
                const isTarget = el.querySelector('p')?.textContent.includes('Episode ' + num);
                el.classList.toggle('hub-episode-active', isTarget);
            });
            
            console.log('[Load Episode] Episode loaded successfully');
        } else {
            console.error('[Load Episode] Failed to load episode - workspace or episode data missing');
        }
    }

    function initializeExistingVideos(ep) {
        // Mark all quality inputs that have existing videos
        const qualities = ['1080p', '720p'];
        const languages = ['sub', 'dub'];
        
        qualities.forEach(quality => {
            languages.forEach(lang => {
                const url = ep?.[lang]?.qualities?.[quality];
                if (url) {
                    const inputId = lang === 'sub' 
                        ? (quality === '1080p' ? 'admin-video-file' : 'admin-sub-720-video-file')
                        : (quality === '1080p' ? 'admin-dub-video-file' : 'admin-dub-720-video-file');
                    
                    const input = document.getElementById(inputId);
                    const nameEl = document.getElementById(`name-${inputId}`);
                    if (input && nameEl) {
                        // Store the existing URL as a data attribute
                        input.dataset.existingUrl = url;
                        nameEl.textContent = 'Video uploaded (click to replace)';
                    }
                }
            });
        });
    }

    async function deleteHubEpisode(num, event) {
        console.log('[Delete Episode] Attempting to delete episode:', num);
        if (event) event.stopPropagation();
        const anime = window.currentHubAnime;
        if (!anime) {
            console.error('[Delete Episode] No current anime found');
            return;
        }
        if (!confirm(`Delete Episode ${num} permanently?`)) {
            console.log('[Delete Episode] Delete cancelled by user');
            return;
        }

        try {
            console.log('[Delete Episode] Sending delete request to server...');
            const token = getAuthToken();
            const res = await fetch(`/api/anime/${anime.id}/episodes/${num}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const data = await res.json().catch(() => ({}));
            console.log('[Delete Episode] Server response:', data);
            
            if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed');

            console.log('[Delete Episode] Episode deleted successfully, refreshing UI...');

            // Refresh local data
            if (typeof updateLocalAnimeData === 'function') updateLocalAnimeData(data.anime);
            window.currentHubAnime = data.anime;
            
            // Re-render Hub
            renderEpisodeManagementHub(data.anime);
            
            // Re-bind the Add New Episode button after re-render
            const addEpisodeBtn = document.getElementById('add-new-episode-btn');
            if (addEpisodeBtn) {
                addEpisodeBtn.onclick = () => resetWorkspaceForNewEpisode(calculateNextEpisodeNumber());
                console.log('[Delete Episode] Add New Episode button rebound after deletion');
            }
            
            showToast(`Episode ${num} deleted.`);
            console.log('[Delete Episode] UI refreshed successfully');
        } catch (e) {
            console.error('[Delete Episode] Error deleting episode:', e);
            alertGold('Error deleting episode: ' + e.message);
        }
    }

    function bindWorkspaceInteractions() {
        const workspace = document.getElementById('hub-workspace');
        if (!workspace) return;

        // The batch uploader lives in the same workspace and must be bound on
        // the initial Episode Hub render as well as every workspace refresh.
        if (typeof global.initBatchEpisodeUpload === 'function') global.initBatchEpisodeUpload();

        const zones = workspace.querySelectorAll('.drop-zone');
        zones.forEach(zone => {
            const id = zone.dataset.dropTarget;
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('active');
            });
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('active');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('active');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('video/')) {
                    const input = document.getElementById(id);
                    if (input) {
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                        handleFileSelect(id, file);
                    }
                }
            });
        });
    }

    function updateHubProgress(pct, text = 'Uploading...') {
        const container = document.getElementById('hub-progress-container');
        const bar = document.getElementById('hub-progress-bar');
        const percent = document.getElementById('hub-progress-percent');
        const statusText = document.getElementById('hub-progress-text');
        const indicator = document.getElementById('upload-status-indicator');

        if (container) container.classList.remove('hidden');
        if (indicator) indicator.classList.remove('hidden');
        if (bar) bar.style.width = pct + '%';
        if (percent) percent.textContent = Math.round(pct) + '%';
        if (statusText) statusText.textContent = text;

        if (pct >= 100) {
            setTimeout(() => {
                if (container) container.classList.add('hidden');
                if (indicator) indicator.classList.add('hidden');
            }, 1000);
        }
    }

    function getAdminAnimePayload() {
        console.log('[Edit Anime] Gathering form data...');
        
        const title = document.getElementById('admin-anime-title')?.value.trim() || '';
        const year = Number(document.getElementById('admin-anime-year')?.value || new Date().getFullYear());
        const selectedGenres = [...new Set([...document.querySelectorAll('[data-admin-genre]:checked')].map(g => g.value).filter(Boolean))];
        
        const statusInput = document.getElementById('admin-anime-status');
        const statusValue = statusInput?.value || 'Airing';
        
        console.log('[Edit Anime] Status input value:', statusValue);
        console.log('[Edit Anime] Status input element:', statusInput);
        
        const typeInput = document.getElementById('admin-anime-type');
        const typeValue = typeInput?.value || 'anime';
        
        const payload = {
            title,
            titleJp: document.getElementById('admin-anime-title-jp')?.value.trim() || title,
            desc: document.getElementById('admin-anime-desc')?.value.trim() ?? '',
            year: Number.isFinite(year) ? year : new Date().getFullYear(),
            studio: document.getElementById('admin-anime-studio')?.value.trim() || 'Unknown Studio',
            genres: selectedGenres.length ? selectedGenres : ['Action'],
            status: statusValue,
            releaseDate: document.getElementById('admin-anime-release-date')?.value ? new Date(document.getElementById('admin-anime-release-date').value) : null,
            releaseTime: document.getElementById('admin-anime-release-time')?.value.trim() || '',
            premium: Boolean(document.getElementById('admin-anime-premium')?.checked),
            featured: Boolean(document.getElementById('admin-anime-featured')?.checked),
            trending: Boolean(document.getElementById('admin-anime-trending')?.checked),
            newEpisode: Boolean(document.getElementById('admin-anime-new-episode')?.checked),
            bannerDisplay: document.querySelector('input[name="admin-banner-display"]:checked')?.value || 'image',
            trailer: document.getElementById('admin-anime-trailer')?.value.trim() || '',
            type: typeValue,
            introStart: parseTimestampInput(document.getElementById('admin-intro-start')?.value),
            introEnd: parseTimestampInput(document.getElementById('admin-intro-end')?.value),
            outroStart: parseTimestampInput(document.getElementById('admin-outro-start')?.value),
            outroEnd: parseTimestampInput(document.getElementById('admin-outro-end')?.value),
        };
        
        console.log('[Edit Anime] Form data collected:', payload);
        console.log('[Edit Anime] Status in payload:', payload.status);
        console.log('[Edit Anime] Trending in payload:', payload.trending);
        console.log('[Edit Anime] New Episode in payload:', payload.newEpisode);
        console.log('[Edit Anime] Type in payload:', payload.type);
        return payload;
    }

    async function uploadAdminMedia() {
        console.log('[Edit Anime] Starting media upload...');
        
        const posterInput = document.getElementById('admin-poster-image');
        const bannerInput = document.getElementById('admin-banner-image');
        const bannerVideoInput = document.getElementById('admin-banner-video');
    
        const posterFile = posterInput?.files?.[0] || null;
        const bannerFile = bannerInput?.files?.[0] || null;
        const bannerVideoFile = bannerVideoInput?.files?.[0] || null;
        const uploadTargetId = adminService.editingAnimeId || adminService.uploadTargetAnimeId;
        const uploadTarget = animeData.find(a =>
            String(a?.id) === String(uploadTargetId) ||
            String(a?.clientId) === String(uploadTargetId) ||
            String(a?._id) === String(uploadTargetId)
        );
        const uploadMetadata = {
            animeId: uploadTarget?.id || uploadTargetId || null,
            animeTitle: uploadTarget?.title || document.getElementById('admin-anime-title')?.value.trim() || null
        };
        
        // Add progress tracking for each upload
        const uploadProgress = {
            poster: 0,
            banner: 0,
            bannerVideo: 0
        };
        
        const updateTotalProgress = () => {
            const total = uploadProgress.poster + uploadProgress.banner + uploadProgress.bannerVideo;
            const count = [posterFile, bannerFile, bannerVideoFile].filter(Boolean).length;
            const avgProgress = count > 0 ? total / count : 0;
            if (window.updateHubProgress) updateHubProgress(avgProgress, `Uploading ${Math.round(avgProgress)}%...`);
        };
    
        const [uploadedPoster, uploadedBanner, uploadedBannerVideo] = await Promise.all([
            posterFile ? uploadService.uploadMedia(posterFile, (p) => {
                uploadProgress.poster = p;
                updateTotalProgress();
            }, { metadata: uploadMetadata }) : Promise.resolve(null),
            bannerFile ? uploadService.uploadMedia(bannerFile, (p) => {
                uploadProgress.banner = p;
                updateTotalProgress();
            }, { metadata: uploadMetadata }) : Promise.resolve(null),
            bannerVideoFile ? uploadService.uploadMedia(bannerVideoFile, (p) => {
                uploadProgress.bannerVideo = p;
                updateTotalProgress();
            }, { metadata: { ...uploadMetadata, videoType: 'banner' } }) : Promise.resolve(null),
        ]);
        
        console.log('[Edit Anime] Media upload completed:', { uploadedPoster, uploadedBanner, uploadedBannerVideo });
    
        return { uploadedPoster, uploadedBanner, uploadedBannerVideo };
    }

    async function uploadAdminVideo() {
        console.log('[EDIT FLOW] ========== STARTING EDIT ANIME SAVE ==========');
        console.log('[EDIT FLOW] Mode:', adminService.adminModalMode);
        console.log('[EDIT FLOW] Editing ID:', adminService.editingAnimeId);
        
        if (adminService.adminModalMode === 'movie-create' || adminService.adminModalMode === 'movie-edit') {
            return uploadAdminMovie();
        }
    
        const fileInput = document.getElementById('admin-video-file');
        const dubInput = document.getElementById('admin-dub-video-file');
        const sub720Input = document.getElementById('admin-sub-720-video-file');
        const dub720Input = document.getElementById('admin-dub-720-video-file');
        
        const file = fileInput?.files?.[0] || null;
        const dubFile = dubInput?.files?.[0] || null;
        const sub720File = sub720Input?.files?.[0] || null;
        const dub720File = dub720Input?.files?.[0] || null;
    
        const episodeNumberRaw = document.getElementById('admin-episode-number')?.value;
        const episodeNumber = Number(episodeNumberRaw);
    
        if (adminService.adminModalMode === 'episode' && (episodeNumberRaw == null || episodeNumberRaw === '')) {
            return alert('Please enter Episode Number.');
        }
    
        if (adminService.adminModalMode === 'episode' && (!file && !dubFile && !sub720File && !dub720File)) {
            return alert('Please choose at least one video file.');
        }

        const timingValues = {
            introStart: parseTimestampInput(document.getElementById('admin-intro-start')?.value),
            introEnd: parseTimestampInput(document.getElementById('admin-intro-end')?.value),
            outroStart: parseTimestampInput(document.getElementById('admin-outro-start')?.value),
            outroEnd: parseTimestampInput(document.getElementById('admin-outro-end')?.value),
        };
        if (Object.values(timingValues).some(value => value === null)) {
            return alertGold('Use seconds or a timestamp such as 1:32 or 1:02:05 for intro/outro times.');
        }
    
        try {
            const fileCount = [file, dubFile, sub720File, dub720File].filter(Boolean).length;
            const uploadTargetId = adminService.editingAnimeId || adminService.uploadTargetAnimeId;
            const uploadTarget = animeData.find(a =>
                String(a?.id) === String(uploadTargetId) ||
                String(a?.clientId) === String(uploadTargetId) ||
                String(a?._id) === String(uploadTargetId)
            );
            const uploadMetadata = {
                animeId: uploadTarget?.id || adminService.editingAnimeId || adminService.uploadTargetAnimeId || null,
                animeTitle: uploadTarget?.title || null,
                episodeNumber
            };
            const fileProgress = new Map();
    
            const trackProgress = (id, pct) => {
                fileProgress.set(id, pct);
                const totalPct = Array.from(fileProgress.values()).reduce((a, b) => a + b, 0) / (fileCount || 1);
                if (window.updateHubProgress) updateHubProgress(totalPct, `Uploading ${Math.round(totalPct)}%...`);
            };
    
            const [uploadedVideo, uploadedDub, uploadedSub720, uploadedDub720] = await Promise.all([
                file ? uploadService.uploadVideo(file, (p) => trackProgress('sub1080', p), 'content', uploadMetadata, 600000) : Promise.resolve(null),
                dubFile ? uploadService.uploadVideo(dubFile, (p) => trackProgress('dub1080', p), 'content', uploadMetadata, 600000) : Promise.resolve(null),
                sub720File ? uploadService.uploadVideo(sub720File, (p) => trackProgress('sub720', p), 'content', uploadMetadata, 600000) : Promise.resolve(null),
                dub720File ? uploadService.uploadVideo(dub720File, (p) => trackProgress('dub720', p), 'content', uploadMetadata, 600000) : Promise.resolve(null),
            ]);
    
            const existingId = adminService.editingAnimeId || adminService.uploadTargetAnimeId;
            const existing = animeData.find(a =>
                String(a?.id) === String(existingId) ||
                String(a?.clientId) === String(existingId) ||
                String(a?._id) === String(existingId)
            );
    
            if (adminService.adminModalMode === 'episode') {
                if (!existing) return alert('Anime not found.');
    
                const token = getAuthToken();
                if (!token) {
                    console.error('[Frontend Upload] No auth token');
                    return alert('Authentication required. Please login.');
                }
    

                const episodePayload = {
                    sub: {
                        qualities: {
                            ...(uploadedVideo ? { '1080p': uploadedVideo.url } : {}),
                            ...(uploadedSub720 ? { '720p': uploadedSub720.url } : {}),
                        },
                        keys: {
                            ...(uploadedVideo ? { '1080p': uploadedVideo.key } : {}),
                            ...(uploadedSub720 ? { '720p': uploadedSub720.key } : {}),
                        },
                        storageProvider: uploadedVideo?.storage || uploadedSub720?.storage || 'r2',
                        sizes: {
                            ...(uploadedVideo ? { '1080p': uploadedVideo.size } : {}),
                            ...(uploadedSub720 ? { '720p': uploadedSub720.size } : {}),
                        },
                        mimeTypes: {
                            ...(uploadedVideo ? { '1080p': uploadedVideo.mimeType } : {}),
                            ...(uploadedSub720 ? { '720p': uploadedSub720.mimeType } : {}),
                        },
                    },
                    dub: {
                        qualities: {
                            ...(uploadedDub ? { '1080p': uploadedDub.url } : {}),
                            ...(uploadedDub720 ? { '720p': uploadedDub720.url } : {}),
                        },
                        keys: {
                            ...(uploadedDub ? { '1080p': uploadedDub.key } : {}),
                            ...(uploadedDub720 ? { '720p': uploadedDub720.key } : {}),
                        },
                        storageProvider: uploadedDub?.storage || uploadedDub720?.storage || 'r2',
                        sizes: {
                            ...(uploadedDub ? { '1080p': uploadedDub.size } : {}),
                            ...(uploadedDub720 ? { '720p': uploadedDub720.size } : {}),
                        },
                        mimeTypes: {
                            ...(uploadedDub ? { '1080p': uploadedDub.mimeType } : {}),
                            ...(uploadedDub720 ? { '720p': uploadedDub720.mimeType } : {}),
                        },
                    },
                    status: 'Airing',
                    ...timingValues,
                };
    

                const res = await fetch(`/api/anime/${existing.id}/episodes/${episodeNumber}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(episodePayload),
                });
                const data = await res.json().catch(() => ({}));

                
                if (!res.ok || !data.ok) {
                    throw new Error(data.error || `HTTP ${res.status}`);
                }
    
                if (typeof updateLocalAnimeData === 'function') updateLocalAnimeData(data.anime);
                if (window.renderEpisodeManagementHub && window.currentHubAnime) {
                    // Find the updated anime from local data
                    const updated = animeData.find(a => a.id === existing.id);
                    // Update the current hub anime with the latest data
                    window.currentHubAnime = updated || data.anime;
                    // Re-render the episode management hub with the updated data
                    renderEpisodeManagementHub(window.currentHubAnime);
                } else {
                    hideUploadModal();
                    switchAdminTab('anime');
                }
                
                if (window.showToast) showToast(`Episode ${episodeNumber} saved successfully.`);
                else alert(`Episode ${episodeNumber} saved successfully.`);
                return;
            }
    
            const payload = getAdminAnimePayload();
            console.log('[EDIT FLOW] BEFORE SAVE - Form payload status:', payload.status);
            console.log('[EDIT FLOW] BEFORE SAVE - Form payload rating:', payload.rating);
            console.log('[EDIT FLOW] BEFORE SAVE - Form payload trending:', payload.trending);
            console.log('[EDIT FLOW] BEFORE SAVE - Form payload newEpisode:', payload.newEpisode);
            
            const { uploadedPoster, uploadedBanner, uploadedBannerVideo } = await uploadAdminMedia();
            console.log('[Edit Anime] Media upload results:', { uploadedPoster, uploadedBanner, uploadedBannerVideo });
    
            if (adminService.adminModalMode === 'edit' && existing) {
                console.log('[EDIT FLOW] EDIT MODE - Updating existing anime:', existing.id);
                console.log('[EDIT FLOW] BEFORE UPDATE - Existing anime status:', existing.status);
                console.log('[EDIT FLOW] BEFORE UPDATE - Existing anime rating:', existing.rating);
                
                // Create update payload that only includes changed fields
                const updatePayload = { ...payload };
                
                // Only update media URLs if new files were uploaded
                if (uploadedPoster) updatePayload.image = uploadedPoster.url;
                else if (existing.image) updatePayload.image = existing.image;
                
                if (uploadedBanner) updatePayload.banner = uploadedBanner.url;
                else if (existing.banner) updatePayload.banner = existing.banner;
                
                if (uploadedBannerVideo) updatePayload.bannerVideo = uploadedBannerVideo.url;
                else if (existing.bannerVideo) updatePayload.bannerVideo = existing.bannerVideo;
                
                // Preserve existing fields that aren't in the form
                updatePayload.episodes = existing.episodes || 1;
                
                // Preserve timing fields if they exist
                if (existing.introStart !== undefined) updatePayload.introStart = existing.introStart;
                if (existing.introEnd !== undefined) updatePayload.introEnd = existing.introEnd;
                if (existing.outroStart !== undefined) updatePayload.outroStart = existing.outroStart;
                if (existing.outroEnd !== undefined) updatePayload.outroEnd = existing.outroEnd;
                
                // Preserve media arrays
                if (existing.episodesMedia) updatePayload.episodesMedia = existing.episodesMedia;
                if (existing.movieMedia) updatePayload.movieMedia = existing.movieMedia;
                
                // Clean the payload to remove MongoDB internal fields
                const cleanPayload = {
                    id: existing.id || existing.clientId,
                    clientId: existing.clientId || existing.id,
                    title: updatePayload.title,
                    titleJp: updatePayload.titleJp,
                    desc: updatePayload.desc,
                    year: updatePayload.year,
                    studio: updatePayload.studio,
                    genres: updatePayload.genres,
                    status: updatePayload.status,
                    releaseDate: updatePayload.releaseDate,
                    releaseTime: updatePayload.releaseTime,
                    premium: updatePayload.premium,
                    featured: updatePayload.featured,
                    rating: updatePayload.rating,
                    trending: updatePayload.trending,
                    newEpisode: updatePayload.newEpisode,
                    bannerDisplay: updatePayload.bannerDisplay,
                    trailer: updatePayload.trailer,
                    introStart: updatePayload.introStart,
                    introEnd: updatePayload.introEnd,
                    outroStart: updatePayload.outroStart,
                    outroEnd: updatePayload.outroEnd,
                    type: updatePayload.type,
                    image: updatePayload.image,
                    banner: updatePayload.banner,
                    bannerVideo: updatePayload.bannerVideo,
                    episodes: updatePayload.episodes,
                    episodesMedia: updatePayload.episodesMedia,
                    movieMedia: updatePayload.movieMedia,
                };
                
                console.log('[EDIT FLOW] PUT REQUEST - Clean payload being sent to API:', cleanPayload);
                console.log('[EDIT FLOW] PUT REQUEST - Status in payload:', cleanPayload.status);
                console.log('[EDIT FLOW] PUT REQUEST - Sending to API for save...');
                
                const savedAnime = await saveAnimeToApi(cleanPayload, true);
                console.log('[EDIT FLOW] API RESPONSE - Received from API:', savedAnime);
                console.log('[EDIT FLOW] API RESPONSE - Status:', savedAnime?.status);
                console.log('[EDIT FLOW] API RESPONSE - Rating:', savedAnime?.rating);
                console.log('[EDIT FLOW] API RESPONSE - Trending:', savedAnime?.trending);
                console.log('[EDIT FLOW] API RESPONSE - New Episode:', savedAnime?.newEpisode);
                
                console.log('[EDIT FLOW] LOCAL UPDATE - Before Object.assign - existing status:', existing.status);
                Object.assign(existing, savedAnime);
                console.log('[EDIT FLOW] LOCAL UPDATE - After Object.assign - existing status:', existing.status);
                console.log('[EDIT FLOW] LOCAL UPDATE - Anime updated successfully with ID:', savedAnime.id);
            } else {
                const id = Math.max(0, ...animeData.map(a => a.id)) + 1;
                console.log('[CREATE TRACE] adminUI.js CREATE MODE - Building newAnime object');
                console.log('[CREATE TRACE] adminUI.js payload.rating:', payload.rating);
                console.log('[CREATE TRACE] adminUI.js payload.trending:', payload.trending);
                console.log('[CREATE TRACE] adminUI.js payload.newEpisode:', payload.newEpisode);
                
                const newAnime = {
                    title: payload.title,
                    titleJp: payload.titleJp,
                    desc: payload.desc,
                    year: payload.year,
                    studio: payload.studio,
                    genres: payload.genres,
                    status: payload.status,
                    releaseDate: payload.releaseDate,
                    releaseTime: payload.releaseTime,
                    premium: payload.premium,
                    featured: payload.featured,
                    bannerDisplay: payload.bannerDisplay,
                    trailer: payload.trailer,
                    type: 'anime',
                    id,
                    rating: payload.rating,
                    image: uploadedPoster?.url || `http://static.photos/technology/640x360/${id}`,
                    banner: uploadedBanner?.url || `http://static.photos/technology/1200x630/${id}`,
                    bannerVideo: uploadedBannerVideo?.url || '',
                    trending: payload.trending,
                    newEpisode: payload.newEpisode,
                    episodes: 1,
                    introStart: 0,
                    introEnd: 90,
                    outroStart: 0,
                    outroEnd: 0,
                };
                console.log('[Edit Anime] New anime payload:', newAnime);
                console.log('[CREATE TRACE] adminUI.js newAnime.rating:', newAnime.rating);
                console.log('[CREATE TRACE] adminUI.js newAnime.trending:', newAnime.trending);
                console.log('[CREATE TRACE] adminUI.js newAnime.newEpisode:', newAnime.newEpisode);
                const savedAnime = await saveAnimeToApi(newAnime, false);
                if (typeof updateLocalAnimeData === 'function') updateLocalAnimeData(savedAnime || newAnime);
            }
    
            // Single reload of anime data from API to ensure UI shows the latest data
            if (typeof loadAnimeFromApi === 'function') {
                console.log('[EDIT FLOW] RELOAD FROM API - Starting reload...');
                console.log('[EDIT FLOW] RELOAD FROM API - animeData before reload:', animeData.length);
                await loadAnimeFromApi();
                console.log('[EDIT FLOW] RELOAD FROM API - animeData after reload:', animeData.length);
                
                // Check if our specific anime was updated
                const targetId = adminService.editingAnimeId || adminService.uploadTargetAnimeId;
                if (targetId) {
                    const updatedAnime = animeData.find(a => a.id === targetId || a.clientId === targetId);
                    if (updatedAnime) {
                        console.log('[EDIT FLOW] RELOAD FROM API - Found target anime in reloaded data');
                        console.log('[EDIT FLOW] RELOAD FROM API - Target anime status:', updatedAnime.status);
                        console.log('[EDIT FLOW] RELOAD FROM API - Target anime rating:', updatedAnime.rating);
                        console.log('[EDIT FLOW] RELOAD FROM API - Target anime trending:', updatedAnime.trending);
                        console.log('[EDIT FLOW] RELOAD FROM API - Target anime newEpisode:', updatedAnime.newEpisode);
                    } else {
                        console.error('[EDIT FLOW] RELOAD FROM API - Could not find target anime in reloaded data! ID:', targetId);
                    }
                }
            }
            
            console.log('[EDIT FLOW] SAVE TO LOCALSTORAGE - Saving animeData to localStorage...');
            saveAdminAnimeData();
            
            console.log('[EDIT FLOW] CLOSE MODAL - Hiding upload modal...');
            hideUploadModal();
            
            console.log('[EDIT FLOW] RE-RENDER UI - Switching to anime tab...');
            switchAdminTab('anime');
            
            if (window.showToast) showToast('Anime saved successfully.');
            console.log('[EDIT FLOW] ========== EDIT ANIME SAVE COMPLETE ==========');
        } catch (e) {
            console.error('[Edit Anime] ❌ SAVE CHANGES FAILED:', e);
            alert('Save error: ' + (e?.message || e));
        }
    }

    async function uploadAdminMovie() {
        console.log('[Edit Movie] Starting movie upload/save...');
        
        const payload = getAdminAnimePayload();
        console.log('[Edit Movie] Form payload:', payload);
        
        if (!payload.title) return alertGold('Please enter a movie title.');
        if ([payload.introStart, payload.introEnd, payload.outroStart, payload.outroEnd].some(value => value === null)) {
            return alertGold('Use seconds or a timestamp such as 1:32 or 1:02:05 for intro/outro times.');
        }
    
        const forcedType = document.getElementById('admin-anime-type-forced')?.value;
        if (!forcedType || (forcedType !== 'animated-movie' && forcedType !== 'live-movie')) {
            return alertGold('Movie type not set.');
        }
    
        const bannerDisplay = document.querySelector('input[name="admin-banner-display"]:checked')?.value || 'image';
    
        const movieFileInput = document.getElementById('admin-movie-video-1080p-file');
        const movieFile = movieFileInput?.files?.[0] || null;
        if (!movieFile && adminService.adminModalMode === 'movie-create') {
            return alertGold('Please choose a Movie Video (1080p) file first.');
        }
    
        try {
            const token = getAuthToken();
            if (!token) return alertGold('Please login first.');
    
            let movieId = adminService.editingAnimeId || adminService.uploadTargetAnimeId;
            const isMovieCreate = adminService.adminModalMode === 'movie-create';
            const isMovieEdit = adminService.adminModalMode === 'movie-edit';
            
            console.log('[Edit Movie] Mode:', adminService.adminModalMode, 'Movie ID:', movieId);
            
            // Upload media first for both create and edit modes
            const { uploadedPoster, uploadedBanner, uploadedBannerVideo } = await uploadAdminMedia();
            console.log('[Edit Movie] Media upload completed:', { uploadedPoster, uploadedBanner, uploadedBannerVideo });
    
            if (isMovieCreate && !movieId) {
                const nextId = Math.max(0, ...animeData.map(a => Number(a.id) || 0)) + 1;
                movieId = nextId;
    
                const createRes = await fetch('/api/anime', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        ...payload, id: movieId, clientId: movieId, type: forcedType, rating: 0, trending: false, newEpisode: false,
                        image: `http://static.photos/technology/640x360/${movieId}`, banner: `http://static.photos/technology/1200x630/${movieId}`,
                        episodesMedia: [], movieMedia: { qualities: {} },
                    }),
                });
                const createData = await createRes.json().catch(() => ({}));
                if (!createRes.ok || !createData.ok) throw new Error(createData.error || `HTTP ${createRes.status}`);
                if (typeof updateLocalAnimeData === 'function') updateLocalAnimeData(createData.anime);
                saveAdminAnimeData();
            }
    
            if (!movieId) return alertGold('Movie ID not found for upload.');
    
            const existing = animeData.find(a => Number(a.id) === Number(movieId)) || null;
            console.log('[Edit Movie] Existing movie:', existing?.title);
            
            if (isMovieEdit && existing) {
                console.log('[Edit Movie] EDIT MODE - Updating existing movie');
                
                // Create update payload that only includes changed fields
                const updatePayload = { ...payload };
                
                // Only update media URLs if new files were uploaded
                if (uploadedPoster) updatePayload.image = uploadedPoster.url;
                if (uploadedBanner) updatePayload.banner = uploadedBanner.url;
                if (uploadedBannerVideo) updatePayload.bannerVideo = uploadedBannerVideo.url;
                
                // Preserve existing fields that aren't in the form
                updatePayload.type = existing.type || forcedType;
                updatePayload.episodes = existing.episodes || 1;
                updatePayload.rating = existing.rating || 0;
                updatePayload.trending = existing.trending || false;
                updatePayload.newEpisode = existing.newEpisode || false;
                
                // Preserve timing fields if they exist
                if (existing.introStart !== undefined) updatePayload.introStart = existing.introStart;
                if (existing.introEnd !== undefined) updatePayload.introEnd = existing.introEnd;
                if (existing.outroStart !== undefined) updatePayload.outroStart = existing.outroStart;
                if (existing.outroEnd !== undefined) updatePayload.outroEnd = existing.outroEnd;
                
                // Preserve media arrays
                if (existing.episodesMedia) updatePayload.episodesMedia = existing.episodesMedia;
                if (existing.movieMedia) updatePayload.movieMedia = existing.movieMedia;
                
                // Clean the payload to remove MongoDB internal fields
                const cleanPayload = {
                    id: existing.id || existing.clientId,
                    clientId: existing.clientId || existing.id,
                    title: updatePayload.title,
                    titleJp: updatePayload.titleJp,
                    desc: updatePayload.desc,
                    year: updatePayload.year,
                    studio: updatePayload.studio,
                    genres: updatePayload.genres,
                    status: updatePayload.status,
                    premium: updatePayload.premium,
                    featured: updatePayload.featured,
                    rating: updatePayload.rating,
                    trending: updatePayload.trending,
                    newEpisode: updatePayload.newEpisode,
                    bannerDisplay: updatePayload.bannerDisplay,
                    trailer: updatePayload.trailer,
                    introStart: updatePayload.introStart,
                    introEnd: updatePayload.introEnd,
                    outroStart: updatePayload.outroStart,
                    outroEnd: updatePayload.outroEnd,
                    type: updatePayload.type,
                    image: updatePayload.image,
                    banner: updatePayload.banner,
                    bannerVideo: updatePayload.bannerVideo,
                    episodes: updatePayload.episodes,
                    episodesMedia: updatePayload.episodesMedia,
                    movieMedia: updatePayload.movieMedia,
                };
                
                console.log('[Edit Movie] Clean payload being sent to API:', cleanPayload);
                console.log('[Edit Movie] Status in clean payload:', cleanPayload.status);
                console.log('[Edit Movie] Sending movie metadata update to API...');
                const savedAnime = await saveAnimeToApi(cleanPayload, true);
                console.log('[Edit Movie] Movie metadata updated:', savedAnime?.title);
                
                if (savedAnime) {
                    Object.assign(existing, savedAnime);
                }
            }
            
            alertGold('Uploading movie...');
    
            let uploadedMovie = null;
            if (movieFile) {
                // Use 10 minute timeout for movie uploads (larger files) with progress tracking
                uploadedMovie = await uploadService.uploadVideo(
                    movieFile, 
                    (progress) => {
                        if (window.updateHubProgress) {
                            window.updateHubProgress(progress, `Uploading movie ${Math.round(progress)}%...`);
                        }
                    }, 
                    'content', 
                    {}, 
                    600000
                );
                
                if (!uploadedMovie?.url) throw new Error('Video upload failed to return a URL.');
            }
    
            const qualities = { ...(existing?.movieMedia?.qualities || {}) };
            if (uploadedMovie) {
                qualities['1080p'] = uploadedMovie.url;
            }
    
            console.log('[Edit Movie] Updating movie media qualities...');
            const res = await fetch(`/api/anime/${movieId}/movieMedia`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ qualities }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
            console.log('[Edit Movie] Movie media updated');
    
            // For create mode, we need to set up the full movie data
            if (!isMovieEdit) {
                const patch = {
                    title: payload.title,
                    titleJp: payload.titleJp,
                    desc: payload.desc,
                    year: payload.year,
                    studio: payload.studio,
                    genres: payload.genres,
                    status: payload.status,
                    premium: payload.premium,
                    featured: payload.featured,
                    bannerDisplay: payload.bannerDisplay,
                    trailer: payload.trailer,
                    type: forcedType,
                    image: uploadedPoster?.url || existing?.image,
                    banner: uploadedBanner?.url || existing?.banner,
                    bannerVideo: bannerDisplay === 'video' ? (uploadedBannerVideo?.url || existing?.bannerVideo || '') : '',
                    movieMedia: { qualities },
                };
        
                console.log('[Edit Movie] Final movie create payload:', patch);
                console.log('[Edit Movie] Status in movie create payload:', patch.status);
                console.log('[Edit Movie] Movie ID for update:', movieId);
                
                if (!movieId) {
                    throw new Error('Movie ID is missing for update operation');
                }
                
                const updateRes = await fetch(`/api/anime/${movieId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(patch),
                });
                const updateData = await updateRes.json().catch(() => ({}));
                if (!updateRes.ok || !updateData.ok) throw new Error(updateData.error || `HTTP ${updateRes.status}`);
                console.log('[Edit Movie] Movie created successfully');

                const savedUrl = updateData?.anime?.movieMedia?.qualities?.['1080p'];
                if (uploadedMovie && savedUrl !== uploadedMovie.url) {
                    throw new Error('Movie upload completed, but MongoDB did not return the saved R2 playback URL.');
                }

                if (typeof updateLocalAnimeData === 'function') updateLocalAnimeData(updateData.anime);
            }

            // Refresh from MongoDB so the Movies UI always shows the newly
            // published title instead of relying on stale local data.
            console.log('[Edit Movie] Reloading anime data from API...');
            if (typeof loadAnimeFromApi === 'function') await loadAnimeFromApi();
            
            saveAdminAnimeData();
            hideUploadModal();
            switchAdminTab('anime');
            
            if (isMovieEdit) {
                alertGold('Movie updated successfully.');
                console.log('[Edit Movie] ✅ MOVIE EDIT COMPLETE');
            } else {
                alertGold('Movie published successfully.');
                console.log('[Edit Movie] ✅ MOVIE CREATE COMPLETE');
            }
        } catch (e) {
            console.error('[Edit Movie] ❌ MOVIE SAVE FAILED:', e);
            alertGold('Movie upload error: ' + (e?.message || e));
        }
    }

    function hideUploadModal() {
        const modal = document.getElementById('upload-modal');
        if (modal) modal.classList.add('hidden');
        if (global.adminService && typeof global.adminService.resetAdminMode === 'function') {
            global.adminService.resetAdminMode();
        }
    }

function editAdminAnime(id) {
        // Keep both admin modules in sync (modal UI is in this file, save logic is in script.js)
        if (typeof window.showUploadModal === 'function') {
            window.showUploadModal('edit', id);
        }
        if (typeof window.adminModalMode !== 'undefined') window.adminModalMode = 'edit';
        if (typeof window.editingAnimeId !== 'undefined') window.editingAnimeId = id;
        if (typeof window.uploadTargetAnimeId !== 'undefined') window.uploadTargetAnimeId = null;
    }


    function uploadAdminEpisode(id) {
        showUploadModal('episode', id);
    }

    async function deleteAdminAnime(id) {
        console.log('deleteAdminAnime() start', { id });

        // animeData can contain both Mongo _id and numeric clientId, but the table might pass either.
        // Don't abort deletion if we can't find it locally.
        const idStr = String(id);
        const anime = (Array.isArray(animeData) ? animeData : []).find(a =>
            String(a?.id) === idStr || String(a?.clientId) === idStr || String(a?._id) === idStr
        );

        const title = anime?.title || 'this anime';
        if (!confirm(`Delete "${title}" from the anime list? This action is permanent.`)) return;


        try {
            console.log('About to call deleteAnimeFromApi', { id });
            await deleteAnimeFromApi(id);
            console.log('deleteAnimeFromApi completed', { id });

            const index = animeData.findIndex(a => a.id === id);
            if (index >= 0) {
                animeData.splice(index, 1);
            }
            if (window.watchlistService) window.watchlistService.remove(id);
            if (window.continueWatchingService) window.continueWatchingService.remove(id);

            saveAdminAnimeData();
            // Reload fresh list from DB
            switchAdminTab('anime');
        } catch (e) {
            console.error(e);
            alert(`Delete failed: ${String(e?.message || e)}`);
            return;
        }
    }

    function bindAdminAnimeActions() {
        const root = document.getElementById('admin-content');
        if (!root) return;

        bindAdminAnimeFilters(root);

        const editButtons = root.querySelectorAll('[data-admin-anime-action="edit"]');
        editButtons.forEach(btn => {
            btn.onclick = () => editAdminAnime(Number(btn.dataset.animeId));
        });

        // Use delegation so buttons remain clickable after dynamic re-render.
        if (!root.dataset.animeDeleteDelegated) {
            root.dataset.animeDeleteDelegated = '1';
            root.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-admin-anime-action="delete"]');
                if (!btn) return;
                const animeId = btn.dataset.animeId;
                console.log('Delete button clicked', { animeId });
                deleteAdminAnime(animeId);
            });
        }

        const episodeButtons = root.querySelectorAll('[data-admin-anime-action="episode"]');
        episodeButtons.forEach(btn => {
            btn.onclick = () => uploadAdminEpisode(Number(btn.dataset.animeId));
        });

        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    function bindAdminAnimeFilters(root) {
        const search = root.querySelector('#admin-anime-search');
        const status = root.querySelector('#admin-anime-filter-status');
        const visibility = root.querySelector('#admin-anime-filter-visibility');
        const genre = root.querySelector('#admin-anime-filter-genre');
        const rating = root.querySelector('#admin-anime-filter-rating');
        const sort = root.querySelector('#admin-anime-sort');
        const count = root.querySelector('#admin-anime-result-count');
        const clear = root.querySelector('#admin-anime-filter-clear');
        if (!search || !status || !visibility || !count) return;

        const apply = () => {
            const query = search.value.trim().toLowerCase();
            const selectedStatus = status.value;
            const selectedVisibility = visibility.value;
            const selectedGenre = (genre?.value || '').toLowerCase().replace(/\s+/g, '-');
            const minimumRating = Number(rating?.value || 0);
            const selectedSort = sort?.value || 'newest';
            let shown = 0;
            const rows = [...root.querySelectorAll('[data-admin-anime-row]')];
            rows.sort((left, right) => {
                if (selectedSort === 'title') return left.dataset.animeTitle.localeCompare(right.dataset.animeTitle);
                if (selectedSort === 'rating') return Number(right.dataset.animeRating) - Number(left.dataset.animeRating);
                if (selectedSort === 'episodes') return Number(right.dataset.animeEpisodes) - Number(left.dataset.animeEpisodes);
                return Number(right.dataset.animeCreated) - Number(left.dataset.animeCreated);
            });
            rows.forEach((row) => {
                const matchesQuery = !query || row.dataset.animeSearch.includes(query);
                const matchesStatus = !selectedStatus || row.dataset.animeStatus === selectedStatus;
                const matchesVisibility = !selectedVisibility || row.dataset.animeVisibility.split(' ').includes(selectedVisibility);
                const matchesGenre = !selectedGenre || row.dataset.animeGenres.split(' ').includes(selectedGenre);
                const matchesRating = !minimumRating || Number(row.dataset.animeRating) >= minimumRating;
                const visible = matchesQuery && matchesStatus && matchesVisibility && matchesGenre && matchesRating;
                row.classList.toggle('hidden', !visible);
                if (visible) shown++;
                row.parentElement.appendChild(row);
            });
            count.textContent = `${shown} result${shown === 1 ? '' : 's'}`;
        };
        search.oninput = apply;
        status.onchange = apply;
        visibility.onchange = apply;
        if (genre) genre.onchange = apply;
        if (rating) rating.onchange = apply;
        if (sort) sort.onchange = apply;
        if (clear) clear.onclick = () => {
            search.value = '';
            status.value = '';
            visibility.value = '';
            if (genre) genre.value = '';
            if (rating) rating.value = '';
            if (sort) sort.value = 'newest';
            apply();
            search.focus();
        };
        apply();
    }

    /* Movie management has been retired.
    function renderAdminMovies() {
        const movies = animeData.filter(a => (a?.type || 'anime') !== 'anime');

        return `
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
            <h1 class="text-2xl md:text-3xl font-black anim-slide-up">Movie Management</h1>
            <p class="text-gray-500 text-sm mt-1">${movies.length} total movies</p>
        </div>
        <button type="button" onclick="showUploadModal('movie-create')" class="btn-primary flex items-center gap-2 anim-slide-up anim-delay-1" data-admin-upload-movie-create>
            <i data-lucide="plus" class="w-4 h-4"></i> Upload Movie
        </button>
    </div>

    <div class="glass-card rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-3 anim-fade-in">
        <div class="relative flex-1 min-w-[220px]">
            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input id="admin-anime-search" type="search" class="input-field h-10 pl-9 text-sm" placeholder="Search title, studio, genre, or year…">
        </div>
        <select id="admin-anime-filter-status" class="input-field h-10 text-sm min-w-32"><option value="">All statuses</option><option value="Airing">Airing</option><option value="Completed">Completed</option><option value="Coming Soon">Coming Soon</option></select>
        <select id="admin-anime-filter-visibility" class="input-field h-10 text-sm min-w-32"><option value="">All content</option><option value="featured">Featured</option><option value="premium">Premium</option><option value="trending">Trending</option><option value="new">New episode</option></select>
        <span id="admin-anime-result-count" class="text-xs font-bold text-gray-500 whitespace-nowrap"></span>
        <button id="admin-anime-filter-clear" type="button" class="text-xs font-bold text-gold-400 hover:text-gold-300">Clear</button>
    </div>

    <div class="glass-card rounded-2xl overflow-hidden anim-fade-in">
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-white/5 text-left">
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Movie</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${movies.map(a => {
                        const movieTypeLabel = a.type === 'live-movie' ? 'Live' : 'Animated';
                        return `
                        <tr data-admin-anime-row data-anime-search="${[a?.title, a?.titleJp, a?.studio, a?.year, ...(Array.isArray(a?.genres) ? a.genres : [])].filter(Boolean).join(' ').toLowerCase().replace(/"/g, '&quot;')}" data-anime-status="${status}" data-anime-visibility="${[a?.featured && 'featured', a?.premium && 'premium', a?.trending && 'trending', a?.newEpisode && 'new'].filter(Boolean).join(' ')}" class="border-b border-white/5 hover:bg-white/3 transition-colors">
                            <td class="p-4">
                                <div class="flex items-center gap-3">
                                    <img src="${ensureHttps(a.image)}" class="w-10 h-14 rounded-lg object-cover" alt="${a.title}">
                                    <div>
                                        <p class="font-semibold text-sm">${a.title}</p>
                                        <p class="text-xs text-gray-500">${a.studio || 'Unknown'} · ${a.year || ''}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="p-4 hidden md:table-cell">
                                <span class="text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-300">${movieTypeLabel}</span>
                            </td>
                            <td class="p-4">
                                <span class="text-xs px-2.5 py-1 rounded-full ${a.status === 'Airing' ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'}">${a.status || 'Airing'}</span>
                            </td>
                            <td class="p-4">
                                <div class="flex items-center gap-2">
                                    <button class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold" title="Edit Movie" data-admin-movie-action="edit" data-anime-id="${a.id}">
                                        <i data-lucide="pencil" class="w-3.5 h-3.5 text-gold-400"></i>
                                        <span>Edit Movie</span>
                                    </button>
                                    <button class="px-3 py-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-all flex items-center gap-1.5 text-xs font-semibold" title="Delete Movie" data-admin-movie-action="delete" data-anime-id="${a.id}">
                                        <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-400"></i>
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>

            ${movies.length === 0 ? `
                <div class="p-10 text-center">
                    <div class="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                        <i data-lucide="film" class="w-8 h-8 text-gray-600"></i>
                    </div>
                    <p class="text-lg font-bold mb-1">No movies yet</p>
                    <p class="text-sm text-gray-500 mb-6">Upload your first animated/live movie.</p>
                    <button onclick="showUploadModal('movie-create')" class="btn-primary px-6 py-3">Upload Movie</button>
                </div>
            ` : ''}
        </div>
    </div>`;
    }

    function bindAdminMoviesActions() {
        const root = document.getElementById('admin-content');
        if (!root) return;

        const editButtons = root.querySelectorAll('[data-admin-movie-action="edit"]');
        editButtons.forEach(btn => {
            btn.onclick = () => editAdminMovie(Number(btn.dataset.animeId));
        });

        const delButtons = root.querySelectorAll('[data-admin-movie-action="delete"]');
        delButtons.forEach(btn => {
            btn.onclick = () => deleteAdminMovie(Number(btn.dataset.animeId));
        });

        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    function editAdminMovie(id) {
        showUploadModal('movie-edit', id);
    }

    async function deleteAdminMovie(id) {
        const movie = animeData.find(a => a.id === id);
        if (!movie) return;
        if (!confirm(`Delete "${movie.title}" movie?`)) return;

        try {
            await deleteAnimeFromApi(id);
            const index = animeData.findIndex(a => a.id === id);
            if (index >= 0) {
                animeData.splice(index, 1);
            }
            if (window.watchlistService) window.watchlistService.remove(id);
            if (window.continueWatchingService) window.continueWatchingService.remove(id);
            saveAdminAnimeData();
            switchAdminTab('movies');
        } catch (e) {
            alert(`Failed to delete movie: ${e.message}`);
        }
    }

    */
    function renderAdminAnime() {
        // Keep series and supported movie records visible in one content manager.
        const list = (Array.isArray(animeData) ? animeData : [])
            .filter(a => a && typeof a === 'object');

        const sorted = list.sort((a, b) => {
            const at = new Date(a?.createdAt || 0).getTime();
            const bt = new Date(b?.createdAt || 0).getTime();
            return bt - at;
        });

        const genres = [...new Set(sorted.flatMap(a => Array.isArray(a?.genres) ? a.genres : []))]
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b)));

        return `
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
            <h1 class="text-2xl md:text-3xl font-black anim-slide-up">Anime & Movie Management</h1>
            <p class="text-gray-500 text-sm mt-1">${sorted.length} total titles</p>
        </div>
        <button type="button" onclick="showUploadModal()" class="btn-primary flex items-center gap-2 anim-slide-up anim-delay-1">
            <i data-lucide="plus" class="w-4 h-4"></i> Upload Anime
        </button>
    </div>

    <section class="glass-card rounded-2xl p-4 md:p-5 mb-5 anim-fade-in" aria-label="Anime search and filters">
        <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-gold-400/10 flex items-center justify-center">
                    <i data-lucide="sliders-horizontal" class="w-4 h-4 text-gold-400"></i>
                </div>
                <div>
                    <h2 class="text-sm font-bold">Find anime</h2>
                    <p class="text-xs text-gray-500 mt-0.5">Search details or narrow the catalog</p>
                </div>
            </div>
            <span id="admin-anime-result-count" class="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-400"></span>
        </div>
        <div class="relative mb-3">
            <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input id="admin-anime-search" type="search" class="input-field h-11 w-full pl-10 pr-4 text-sm" placeholder="Search title, ID, studio, genre, year, or description" autocomplete="off">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <select id="admin-anime-filter-status" class="input-field h-10 text-sm"><option value="">All statuses</option><option value="Airing">Airing</option><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option><option value="Upcoming">Upcoming</option><option value="Coming Soon">Coming Soon</option></select>
            <select id="admin-anime-filter-visibility" class="input-field h-10 text-sm"><option value="">All content</option><option value="featured">Featured</option><option value="premium">Premium</option><option value="trending">Trending</option><option value="new">New episode</option></select>
            <select id="admin-anime-filter-genre" class="input-field h-10 text-sm"><option value="">All genres</option>${genres.map(value => `<option value="${String(value).replace(/"/g, '&quot;')}">${value}</option>`).join('')}</select>
            <select id="admin-anime-filter-rating" class="input-field h-10 text-sm"><option value="">Any rating</option><option value="8">8+ rating</option><option value="7">7+ rating</option><option value="5">5+ rating</option></select>
            <select id="admin-anime-sort" class="input-field h-10 text-sm" aria-label="Sort anime"><option value="newest">Sort: Newest</option><option value="title">Sort: Title A-Z</option><option value="rating">Sort: Highest rated</option><option value="episodes">Sort: Most episodes</option></select>
        </div>
        <div class="flex justify-end mt-3">
            <button id="admin-anime-filter-clear" type="button" class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-gray-500 hover:text-gold-400 transition-colors">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Reset filters
            </button>
        </div>
    </div>

    <div class="glass-card rounded-2xl overflow-hidden anim-fade-in">
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-white/5 bg-white/[0.02] text-left">
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Title & details</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Type</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden lg:table-cell">Episodes</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(a => {
                        const isMovie = (a?.type || 'anime') !== 'anime';
                        const typeLabel = !isMovie ? 'Series' : (a?.type === 'live-movie' ? 'Live Movie' : 'Animated Movie');
                        const status = a?.status || 'Airing';
                        const rating = Number(a?.averageRating || a?.rating || 0);
                        const episodesLabel = Array.isArray(a?.episodesMedia)
                                ? Math.max(1, a.episodesMedia.length)
                                : (Number.isFinite(Number(a?.episodes)) ? Number(a.episodes) : (a?.episodes || 0));
                        const genreTokens = (Array.isArray(a?.genres) ? a.genres : [])
                            .filter(Boolean)
                            .map(value => String(value).toLowerCase().replace(/\s+/g, '-'));
                        return `
                        <tr data-admin-anime-row data-anime-search="${[a?.id, a?.clientId, a?.title, a?.titleJp, a?.studio, a?.year, a?.desc, status, rating, episodesLabel, ...(Array.isArray(a?.genres) ? a.genres : [])].filter(Boolean).join(' ').toLowerCase().replace(/"/g, '&quot;')}" data-anime-title="${String(a?.title || '').toLowerCase().replace(/"/g, '&quot;')}" data-anime-rating="${rating}" data-anime-episodes="${Number(episodesLabel) || 0}" data-anime-created="${new Date(a?.createdAt || 0).getTime() || 0}" data-anime-genres="${genreTokens.join(' ')}" data-anime-status="${status}" data-anime-visibility="${[a?.featured && 'featured', a?.premium && 'premium', a?.trending && 'trending', a?.newEpisode && 'new'].filter(Boolean).join(' ')}" class="border-b border-white/5 hover:bg-white/3 transition-colors">
                            <td class="p-4">
                                <div class="flex items-center gap-3">
                                    <img src="${ensureHttps(a?.image || '')}" class="w-10 h-14 rounded-lg object-cover" alt="${a?.title || ''}">
                                    <div class="min-w-0">
                                        <p class="font-semibold text-sm truncate">${a?.title || 'Untitled'}</p>
                                        <p class="text-xs text-gray-500 truncate">${(a?.studio || 'Unknown Studio')} · ${(a?.year || '')} · ${rating ? `★ ${rating.toFixed(1)}` : 'No rating'}</p>
                                        <p class="text-[11px] text-gray-600 truncate">${Array.isArray(a?.genres) && a.genres.length ? a.genres.join(', ') : 'No genres listed'}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="p-4 hidden md:table-cell">
                                <span class="text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-300">${typeLabel}</span>
                            </td>
                            <td class="p-4">
                                <span class="text-xs px-2.5 py-1 rounded-full ${status === 'Airing' ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'}">${status}</span>
                            </td>
                            <td class="p-4 hidden lg:table-cell">
                                <span class="text-xs text-gray-300">${episodesLabel || 0}</span>
                            </td>
                            <td class="p-4">
                                <div class="flex items-center gap-2">
                                    <button class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold" title="Edit Details" data-admin-anime-action="edit" data-anime-id="${a?.id}">
                                        <i data-lucide="pencil" class="w-3.5 h-3.5 text-gold-400"></i>
                                        <span>Edit Anime</span>
                                    </button>
                                    <button class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold" title="Manage Episodes" data-admin-anime-action="episode" data-anime-id="${a?.id}">
                                        <i data-lucide="list-video" class="w-3.5 h-3.5 text-blue-400"></i>
                                        <span>Manage Episodes</span>
                                    </button>
                                    <button class="px-3 py-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-all flex items-center gap-1.5 text-xs font-semibold" title="Delete Anime" data-admin-anime-action="delete" data-anime-id="${a?.id}">
                                        <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-400"></i>
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        ${sorted.length === 0 ? `
            <div class="p-10 text-center">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                    <i data-lucide="tv" class="w-8 h-8 text-gray-600"></i>
                </div>
                <p class="text-lg font-bold mb-1">No titles yet</p>
                <p class="text-sm text-gray-500 mb-6">Upload your first anime or movie to manage it here.</p>
                <button type="button" onclick="showUploadModal()" class="btn-primary px-6 py-3">Upload Anime</button>
            </div>
        ` : ''}
    </div>`;
    }

    function renderAdminUsers() {
        return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black anim-slide-up">User Management</h1>
        <p class="text-gray-500 text-sm mt-1">Manage plan, status and roles</p>
    </div>
    <div class="glass-card rounded-2xl overflow-hidden anim-fade-in">
        <div id="admin-users-table" class="overflow-x-auto"></div>
    </div>
    ${renderBanModal()}${renderUserDetailsModal()}`;
    }

    async function handleAdminUserAction(userId, patch) {
        if (!ensureAdminOrRedirect()) return;
        try {
            await updateAdminUser(userId, patch);
            await loadAdminUsersTable();
            if (window.showToast) showToast('User updated');
        } catch (e) {
            alert(String(e?.message || e));
        }
    }

    async function updateAdminUser(userId, patch) {
        const token = getAuthToken();
        if (!token) throw new Error('Not logged in');

        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(patch),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data.user;
    }

    async function loadAdminUsersTable() {
        const target = document.getElementById('admin-users-table');
        if (!target) return;

        const token = getAuthToken();
        try {
            const res = await fetch('/api/users', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

            const users = Array.isArray(data.users) ? data.users : [];
            target.innerHTML = `
            <table class="w-full">
                <thead>
                    <tr class="border-b border-white/5 text-left">
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">User</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Email</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Plan</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Joined</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => {
                        const roles = Array.isArray(u?.roles) ? u.roles : [];
                        const isSeedAdmin = roles.includes('admin') && String(u?.email || '').toLowerCase() === 'anify@gmail.com';
                        if (isSeedAdmin) return '';

                        const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '';
                        const plan = u.plan || 'Free';
                        const status = u.status || 'Active';
                        const name = u.username || u.name || 'User';
                        const avatar = typeof getProfileAvatarUrl === 'function' ? getProfileAvatarUrl(u.avatarId) : u.avatar;
                        return `
                            <tr class="border-b border-white/5 hover:bg-white/3 transition-colors">
                                <td class="p-4">
                                    <div class="flex items-center gap-3">
                                        <img src="${avatar}" class="w-8 h-8 rounded-lg" alt="${name}">
                                        <span class="font-medium text-sm">${name}</span>
                                    </div>
                                </td>
                                <td class="p-4 text-sm text-gray-400 hidden md:table-cell">${u.email || ''}</td>
                                <td class="p-4"><span class="text-xs px-2.5 py-1 rounded-full ${plan === 'Premium' ? 'bg-gold-400/10 text-gold-400' : 'bg-white/5 text-gray-400'}">${plan}</span></td>
                                <td class="p-4"><span class="text-xs px-2.5 py-1 rounded-full ${status === 'Active' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}">${status}</span></td>
                                <td class="p-4 text-sm text-gray-400 hidden sm:table-cell">${joined}</td>
                                <td class="p-4">
                                    <div class="flex flex-wrap gap-2">
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Free" onclick="handleAdminUserAction('${u._id || ''}', { plan: 'Free' })">
                                            <i data-lucide="corner-down-left" class="w-4 h-4 text-gray-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Premium" onclick="handleAdminUserAction('${u._id || ''}', { plan: 'Premium' })">
                                            <i data-lucide="crown" class="w-4 h-4 text-gold-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Active" onclick="handleAdminUserAction('${u._id || ''}', { status: 'Active' })">
                                            <i data-lucide="check" class="w-4 h-4 text-green-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Pending" onclick="handleAdminUserAction('${u._id || ''}', { status: 'Pending' })">
                                            <i data-lucide="clock" class="w-4 h-4 text-yellow-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Ban user" onclick="openBanUserModal('${u._id || ''}', '${name.replace(/'/g, "\\'")}')">
                                            <i data-lucide="x" class="w-4 h-4 text-red-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="View profile & activity" onclick="viewAdminUser('${u._id || ''}')"><i data-lucide="eye" class="w-4 h-4 text-blue-400"></i></button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Change role" onclick="changeUserRole('${u._id || ''}', '${roles[0] || 'user'}')"><i data-lucide="shield" class="w-4 h-4 text-purple-400"></i></button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Reset password" onclick="resetUserPassword('${u._id || ''}')"><i data-lucide="key-round" class="w-4 h-4 text-gold-400"></i></button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Force logout" onclick="forceUserLogout('${u._id || ''}')"><i data-lucide="log-out" class="w-4 h-4 text-orange-400"></i></button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Delete user" onclick="deleteAdminUser('${u._id || ''}')"><i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i></button>
                                    </div>
                                </td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        } catch (e) {
            target.innerHTML = `<p class="p-4 text-sm text-red-400">Failed to load users: ${String(e?.message || e)}</p>`;
        }
    }

    function renderBanModal() {
        return `
        <div id="ban-user-modal" class="hidden fixed inset-0 z-[100] items-center justify-center bg-black/70 p-4">
            <form onsubmit="submitBanForm(event)" class="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141225] p-6 shadow-2xl">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Ban management</p>
                        <h2 class="mt-1 text-xl font-black">Ban <span id="ban-user-name">user</span></h2>
                    </div>
                    <button type="button" onclick="closeBanUserModal()" class="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Close">×</button>
                </div>
                <input id="ban-user-id" type="hidden">
                <label class="mt-5 block text-sm font-medium text-gray-300">Reason</label>
                <textarea id="ban-reason" required maxlength="500" rows="3" placeholder="Explain why this account is being banned..." class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-red-400/60"></textarea>
                <div class="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                        <label class="block text-sm font-medium text-gray-300">Ban type</label>
                        <select id="ban-type" onchange="toggleBanExpiry()" class="mt-2 w-full rounded-xl border border-white/10 bg-[#1c1930] px-3 py-3 text-sm outline-none focus:border-red-400/60">
                            <option value="permanent">Permanent ban</option>
                            <option value="temporary">Temporary ban</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300">Expires</label>
                        <input id="ban-expiry" type="datetime-local" disabled class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-40 focus:border-red-400/60">
                    </div>
                </div>
                <p class="mt-3 text-xs text-gray-500">IP and device restrictions are not enabled because this platform does not yet store reliable device or IP records.</p>
                <div class="mt-6 flex justify-end gap-3">
                    <button type="button" onclick="closeBanUserModal()" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10">Cancel</button>
                    <button type="submit" class="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-400">Ban user</button>
                </div>
            </form>
        </div>`;
    }

    function renderUserDetailsModal() {
        return `
        <div id="admin-user-details-modal" class="hidden fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm p-4">
            <div class="mx-auto my-8 w-full max-w-5xl rounded-2xl border border-gold-400/20 bg-gradient-to-br from-[#141225] via-[#1a1a3e] to-[#141225] p-6 shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-black text-white">User Profile & Activity</h2>
                    <button onclick="closeAdminUserDetails()" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div id="admin-user-details-content" class="space-y-6"></div>
            </div>
        </div>`;
    }

    async function viewAdminUser(userId) {
        const modal = document.getElementById('admin-user-details-modal'), target = document.getElementById('admin-user-details-content');
        modal?.classList.remove('hidden'); target.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-400"></div>
                <span class="ml-3 text-gray-400">Loading profile…</span>
            </div>
        `;
        try {
            const res = await fetch(`/api/admin/users/${userId}/details`, { 
                headers: { Authorization: `Bearer ${getAuthToken()}` } 
            });
            const data = await res.json();
            
            if (!res.ok || !data.ok) throw new Error(data.error);
            
            target.innerHTML = renderEnhancedUserProfile(data, userId);
            
            // Reinitialize icons
            if (window.lucide && typeof lucide.createIcons === 'function') {
                lucide.createIcons();
            }
        } catch (e) {
            target.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="alert-circle" class="w-8 h-8 text-red-400"></i>
                    </div>
                    <p class="text-red-400 font-semibold">Error loading profile</p>
                    <p class="text-gray-500 text-sm mt-2">${String(e.message || e)}</p>
                </div>
            `;
            if (window.lucide && typeof lucide.createIcons === 'function') {
                lucide.createIcons();
            }
        }
    }
    function closeAdminUserDetails() { document.getElementById('admin-user-details-modal')?.classList.add('hidden'); }

    function renderEnhancedUserProfile(data, userId) {
        const { user, statistics, watchHistory, comments, ratings, mostWatchedAnime, timeline } = data;
        
        const statusColors = {
            green: 'bg-green-500/20 text-green-400 border-green-500/30',
            yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            red: 'bg-red-500/20 text-red-400 border-red-500/30',
            gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };
        
        const statusColor = statusColors[user.statusColor] || statusColors.gray;
        
        const formatDate = (date) => {
            if (!date) return 'Unknown';
            return new Date(date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
        };

        const getActivityIcon = (type) => {
            const icons = {
                watch: 'play-circle',
                comment: 'message-circle',
                rating: 'star',
                account_created: 'user-plus'
            };
            return icons[type] || 'activity';
        };

        const getActivityColor = (type) => {
            const colors = {
                watch: 'text-green-400',
                comment: 'text-blue-400',
                rating: 'text-yellow-400',
                account_created: 'text-purple-400'
            };
            return colors[type] || 'text-gray-400';
        };

        return `
        <!-- User Overview Section -->
        <div class="glass-card rounded-2xl p-6 border border-gold-400/20 bg-gradient-to-br from-gold-400/5 via-transparent to-transparent">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-gold-400/20 to-purple-400/20 flex items-center justify-center border border-gold-400/30">
                        <i data-lucide="user" class="w-8 h-8 text-gold-400"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-white">${user.username || user.name || 'User'}</h3>
                        <p class="text-sm text-gray-400">${user.email}</p>
                        <div class="flex items-center gap-2 mt-2">
                            <span class="text-xs font-semibold px-2 py-1 rounded-full ${statusColor} border">
                                ● ${user.status}
                            </span>
                            <span class="text-xs text-gray-500">
                                ${(user.roles || ['user']).join(', ').toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">User ID</p>
                    <p class="text-sm font-mono text-gold-400">#${String(user._id).slice(-6)}</p>
                    <p class="text-xs text-gray-500 mt-1">Joined</p>
                    <p class="text-sm text-gray-300">${formatDate(user.createdAt)}</p>
                </div>
            </div>
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div class="glass-card rounded-xl p-4 border border-white/5 bg-white/5">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="play" class="w-4 h-4 text-green-400"></i>
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Watched</p>
                </div>
                <p class="text-2xl font-black text-white">${statistics.totalWatchEntries}</p>
                <p class="text-xs text-gray-500">episodes</p>
            </div>
            
            <div class="glass-card rounded-xl p-4 border border-white/5 bg-white/5">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="clock" class="w-4 h-4 text-blue-400"></i>
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Views</p>
                </div>
                <p class="text-2xl font-black text-white">${statistics.totalViews}</p>
                <p class="text-xs text-gray-500">total</p>
            </div>
            
            <div class="glass-card rounded-xl p-4 border border-white/5 bg-white/5">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="star" class="w-4 h-4 text-yellow-400"></i>
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Ratings</p>
                </div>
                <p class="text-2xl font-black text-white">${statistics.totalRatings}</p>
                <p class="text-xs text-gray-500">given</p>
            </div>
            
            <div class="glass-card rounded-xl p-4 border border-white/5 bg-white/5">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="message-circle" class="w-4 h-4 text-purple-400"></i>
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Comments</p>
                </div>
                <p class="text-2xl font-black text-white">${statistics.totalComments}</p>
                <p class="text-xs text-gray-500">posted</p>
            </div>
            
            <div class="glass-card rounded-xl p-4 border border-white/5 bg-white/5">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="check-circle" class="w-4 h-4 text-green-400"></i>
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Completed</p>
                </div>
                <p class="text-2xl font-black text-white">${statistics.episodesCompleted}</p>
                <p class="text-xs text-gray-500">episodes</p>
            </div>
            
            <div class="glass-card rounded-xl p-4 border border-white/5 bg-white/5">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="percent" class="w-4 h-4 text-gold-400"></i>
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Rate</p>
                </div>
                <p class="text-2xl font-black text-white">${statistics.completionRate}%</p>
                <p class="text-xs text-gray-500">completion</p>
            </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
            <!-- Activity Timeline -->
            <div class="glass-card rounded-2xl p-6 border border-white/10 bg-white/5">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-white flex items-center gap-2">
                        <i data-lucide="activity" class="w-5 h-5 text-gold-400"></i>
                        Recent Activity
                    </h4>
                    <span class="text-xs text-gray-500">Last 15 events</span>
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                    ${timeline.length > 0 ? timeline.map(activity => `
                        <div class="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                            <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="${getActivityIcon(activity.type)}" class="w-4 h-4 ${getActivityColor(activity.type)}"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm text-white font-medium truncate">
                                    ${activity.type === 'account_created' ? 'Account created' : 
                                      activity.type === 'watch' ? `Watched ${activity.animeTitle}` :
                                      activity.type === 'comment' ? `Commented on ${activity.animeTitle}` :
                                      `Rated ${activity.animeTitle}`}
                                </p>
                                ${activity.type === 'watch' ? `
                                    <p class="text-xs text-gray-400">Episode ${activity.episode} • ${activity.progress}%</p>
                                ` : ''}
                                ${activity.type === 'comment' ? `
                                    <p class="text-xs text-gray-400 truncate">"${activity.text}"</p>
                                ` : ''}
                                ${activity.type === 'rating' ? `
                                    <p class="text-xs text-yellow-400">★ ${activity.rating}/10</p>
                                ` : ''}
                                <p class="text-xs text-gray-500 mt-1">${activity.timeAgo}</p>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="text-center py-8">
                            <i data-lucide="clock" class="w-8 h-8 text-gray-600 mx-auto mb-2"></i>
                            <p class="text-sm text-gray-500">No recent activity</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- Most Watched Anime -->
            <div class="glass-card rounded-2xl p-6 border border-white/10 bg-white/5">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-white flex items-center gap-2">
                        <i data-lucide="flame" class="w-5 h-5 text-orange-400"></i>
                        Most Watched Anime
                    </h4>
                    <span class="text-xs text-gray-500">Top 5</span>
                </div>
                <div class="space-y-3">
                    ${mostWatchedAnime.length > 0 ? mostWatchedAnime.map((anime, idx) => `
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                            <span class="text-sm font-black w-6 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-500'}">
                                #${idx + 1}
                            </span>
                            <img src="${anime.image || ''}" class="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-black/40" alt="${anime.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22%3E%3Crect x=%222%22 y=%222%22 width=%2220%22 height=%2220%22 rx=%222%22/%3E%3C/svg%3E'">
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold text-white truncate">${anime.title}</p>
                                <p class="text-xs text-gray-400">${anime.count} episodes</p>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="text-center py-8">
                            <i data-lucide="film" class="w-8 h-8 text-gray-600 mx-auto mb-2"></i>
                            <p class="text-sm text-gray-500">No watch history</p>
                        </div>
                    `}
                </div>
            </div>
        </div>

        <!-- Watch History Section -->
        <div class="glass-card rounded-2xl p-6 border border-white/10 bg-white/5">
            <div class="flex items-center justify-between mb-4">
                <h4 class="font-bold text-white flex items-center gap-2">
                    <i data-lucide="history" class="w-5 h-5 text-blue-400"></i>
                    Watch History
                </h4>
                <span class="text-xs text-gray-500">${watchHistory.length} entries</span>
            </div>
            <div class="space-y-2 max-h-64 overflow-y-auto">
                ${watchHistory.length > 0 ? watchHistory.slice(0, 10).map(w => `
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <img src="${w.animeImage || ''}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-black/40" alt="${w.animeTitle}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22%3E%3Crect x=%222%22 y=%222%22 width=%2220%22 height=%2220%22 rx=%222%22/%3E%3C/svg%3E'">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-white truncate">${w.animeTitle}</p>
                            <p class="text-xs text-gray-400">Episode ${w.episode} • ${w.progress}% complete</p>
                        </div>
                        <div class="text-right">
                            <span class="text-xs px-2 py-1 rounded-full ${w.progress >= 95 ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}">
                                ${w.progress >= 95 ? 'Completed' : 'Watching'}
                            </span>
                            <p class="text-xs text-gray-500 mt-1">${formatDate(w.updatedAt)}</p>
                        </div>
                    </div>
                `).join('') : `
                    <div class="text-center py-8">
                        <i data-lucide="clock" class="w-8 h-8 text-gray-600 mx-auto mb-2"></i>
                        <p class="text-sm text-gray-500">No watch history</p>
                    </div>
                `}
            </div>
        </div>

        <!-- Ratings & Comments -->
        <div class="grid gap-6 md:grid-cols-2">
            <!-- Ratings -->
            <div class="glass-card rounded-2xl p-6 border border-white/10 bg-white/5">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-white flex items-center gap-2">
                        <i data-lucide="star" class="w-5 h-5 text-yellow-400"></i>
                        Ratings
                    </h4>
                    <div class="flex items-center gap-2">
                        ${statistics.averageRating ? `
                            <span class="text-xs text-gray-500">Avg: </span>
                            <span class="text-sm font-bold text-yellow-400">${statistics.averageRating}/10</span>
                        ` : ''}
                        <span class="text-xs text-gray-500">${ratings.length} total</span>
                    </div>
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                    ${ratings.length > 0 ? ratings.slice(0, 5).map(r => `
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                            <img src="${r.animeImage || ''}" class="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-black/40" alt="${r.animeTitle}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22%3E%3Crect x=%222%22 y=%222%22 width=%2220%22 height=%2220%22 rx=%222%22/%3E%3C/svg%3E'">
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold text-white truncate">${r.animeTitle}</p>
                                <p class="text-xs text-yellow-400">★ ${r.rating}/10</p>
                            </div>
                            <p class="text-xs text-gray-500">${formatDate(r.updatedAt)}</p>
                        </div>
                    `).join('') : `
                        <div class="text-center py-6">
                            <i data-lucide="star" class="w-6 h-6 text-gray-600 mx-auto mb-2"></i>
                            <p class="text-sm text-gray-500">No ratings</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- Comments -->
            <div class="glass-card rounded-2xl p-6 border border-white/10 bg-white/5">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-white flex items-center gap-2">
                        <i data-lucide="message-circle" class="w-5 h-5 text-purple-400"></i>
                        Comments
                    </h4>
                    <span class="text-xs text-gray-500">${comments.length} total</span>
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                    ${comments.length > 0 ? comments.slice(0, 5).map(c => `
                        <div class="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                            <div class="flex items-center justify-between mb-1">
                                <p class="text-xs font-bold text-white truncate">${c.animeTitle}</p>
                                ${c.rating ? `<span class="text-xs text-yellow-400">★ ${c.rating}/5</span>` : ''}
                            </div>
                            <p class="text-xs text-gray-300 line-clamp-2">"${c.text}"</p>
                            <p class="text-xs text-gray-500 mt-1">${formatDate(c.createdAt)}</p>
                        </div>
                    `).join('') : `
                        <div class="text-center py-6">
                            <i data-lucide="message-circle" class="w-6 h-6 text-gray-600 mx-auto mb-2"></i>
                            <p class="text-sm text-gray-500">No comments</p>
                        </div>
                    `}
                </div>
            </div>
        </div>

        <!-- Account Activity & Info -->
        <div class="glass-card rounded-2xl p-6 border border-white/10 bg-white/5">
            <h4 class="font-bold text-white flex items-center gap-2 mb-4">
                <i data-lucide="shield" class="w-5 h-5 text-green-400"></i>
                Account Activity
            </h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p class="text-xs text-gray-500">Last Active</p>
                    <p class="text-sm text-white font-medium">${user.lastActive || 'Unknown'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Account Status</p>
                    <p class="text-sm text-white font-medium">${user.status}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Country</p>
                    <p class="text-sm text-white font-medium">${user.country || 'Unknown'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Plan</p>
                    <p class="text-sm text-white font-medium">${user.plan || 'Free'}</p>
                </div>
            </div>
            <div class="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p class="text-xs text-yellow-400 flex items-center gap-2">
                    <i data-lucide="info" class="w-4 h-4"></i>
                    Bookmarks are stored locally on the user's device and are not available to administrators.
                </p>
            </div>
        </div>

        <!-- Admin Actions -->
        <div class="glass-card rounded-2xl p-6 border border-white/10 bg-white/5">
            <h4 class="font-bold text-white flex items-center gap-2 mb-4">
                <i data-lucide="settings" class="w-5 h-5 text-gray-400"></i>
                Admin Actions
            </h4>
            <div class="flex flex-wrap gap-3">
                <button onclick="changeUserRole('${userId}', '${(user.roles || ['user'])[0]}')" class="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="shield" class="w-4 h-4"></i> Change Role
                </button>
                <button onclick="resetUserPassword('${userId}')" class="px-4 py-2 rounded-xl bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-colors text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="key" class="w-4 h-4"></i> Reset Password
                </button>
                <button onclick="forceUserLogout('${userId}')" class="px-4 py-2 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="log-out" class="w-4 h-4"></i> Force Logout
                </button>
                <button onclick="handleAdminUserAction('${userId}', { status: 'suspended' })" class="px-4 py-2 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="alert-triangle" class="w-4 h-4"></i> Suspend
                </button>
                <button onclick="openBanUserModal('${userId}', '${user.username || user.name || 'User'}')" class="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="ban" class="w-4 h-4"></i> Ban User
                </button>
                <button onclick="deleteAdminUser('${userId}')" class="px-4 py-2 rounded-xl bg-red-600/20 text-red-500 hover:bg-red-600/30 transition-colors text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="trash-2" class="w-4 h-4"></i> Delete User
                </button>
            </div>
        </div>
        `;
    }
    async function changeUserRole(id, current) { const role = prompt('Role: user, moderator, shield, or admin', current); if (!role) return; await handleAdminUserAction(id, { roles: [role.trim().toLowerCase()] }); }
    async function resetUserPassword(id) { const password = prompt('Enter a new temporary password (at least 8 characters):'); if (!password) return; const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` }, body: JSON.stringify({ password }) }); const d = await res.json(); if (!res.ok || !d.ok) return alert(d.error || 'Could not reset password'); if (window.showToast) showToast('Password reset and session ended'); }
    async function forceUserLogout(id) { if (!confirm('End this user’s active session?')) return; const res = await fetch(`/api/admin/users/${id}/force-logout`, { method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` } }); const d = await res.json(); if (!res.ok || !d.ok) return alert(d.error || 'Could not force logout'); if (window.showToast) showToast('User logged out'); }
    async function deleteAdminUser(id) { if (!confirm('Permanently delete this user and their history?')) return; const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getAuthToken()}` } }); const d = await res.json(); if (!res.ok || !d.ok) return alert(d.error || 'Could not delete user'); await loadAdminUsersTable(); if (window.showToast) showToast('User deleted'); }

    function renderBannedUsers() {
        return `
        <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 class="text-2xl md:text-3xl font-black">Banned Users</h1>
                <p class="mt-1 text-sm text-gray-500">Review active bans, reasons and expiry dates.</p>
            </div>
            <button onclick="switchAdminTab('users')" class="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20">
                Manage users
            </button>
        </div>
        <div class="glass-card overflow-hidden rounded-2xl anim-fade-in">
            <div id="banned-users-table" class="overflow-x-auto"></div>
        </div>
        ${renderBanModal()}`;
    }

    async function loadBannedUsersTable() {
        const target = document.getElementById('banned-users-table');
        if (!target) return;
        const token = getAuthToken();
        try {
            const response = await fetch('/api/admin/banned-users', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
            const users = Array.isArray(data.users) ? data.users : [];
            if (!users.length) {
                target.innerHTML = `<div class="p-10 text-center"><i data-lucide="shield-check" class="mx-auto mb-3 h-9 w-9 text-green-400"></i><p class="font-bold">No active bans</p><p class="mt-1 text-sm text-gray-500">There are no users currently blocked from the platform.</p></div>`;
            } else {
                target.innerHTML = `<table class="w-full min-w-[680px]">
                    <thead><tr class="border-b border-white/5 text-left">
                        <th class="p-4 text-xs font-semibold uppercase text-gray-400">User</th>
                        <th class="p-4 text-xs font-semibold uppercase text-gray-400">Reason</th>
                        <th class="p-4 text-xs font-semibold uppercase text-gray-400">Banned</th>
                        <th class="p-4 text-xs font-semibold uppercase text-gray-400">Expires</th>
                        <th class="p-4 text-xs font-semibold uppercase text-gray-400">Action</th>
                    </tr></thead>
                    <tbody>${users.map((user) => {
                        const name = user.username || user.name || user.email || 'User';
                        const info = user.banInfo || {};
                        const date = info.bannedAt ? new Date(info.bannedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                        const expires = info.banEnds ? new Date(info.banEnds).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Permanent';
                        return `<tr class="border-b border-white/5 hover:bg-white/[0.03]">
                            <td class="p-4"><p class="font-semibold text-sm">${name}</p><p class="mt-0.5 text-xs text-gray-500">${user.email || ''}</p></td>
                            <td class="max-w-xs p-4 text-sm text-gray-300">${info.reason || 'No reason supplied'}</td>
                            <td class="p-4 text-sm text-gray-400">${date}</td>
                            <td class="p-4"><span class="rounded-full px-2.5 py-1 text-xs font-semibold ${info.banEnds ? 'bg-amber-400/10 text-amber-300' : 'bg-red-500/10 text-red-300'}">${expires}</span></td>
                            <td class="p-4"><button onclick="unbanUser('${user._id}')" class="rounded-lg bg-green-400/10 px-3 py-2 text-xs font-bold text-green-300 transition hover:bg-green-400/20">Unban</button></td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>`;
            }
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        } catch (error) {
            target.innerHTML = `<p class="p-5 text-sm text-red-400">Failed to load banned users: ${String(error?.message || error)}</p>`;
        }
    }

    function openBanUserModal(userId, name) {
        const modal = document.getElementById('ban-user-modal');
        if (!modal) return;
        document.getElementById('ban-user-id').value = userId;
        document.getElementById('ban-user-name').textContent = name || 'user';
        document.getElementById('ban-reason').value = '';
        document.getElementById('ban-type').value = 'permanent';
        document.getElementById('ban-expiry').value = '';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        toggleBanExpiry();
    }

    function closeBanUserModal() {
        const modal = document.getElementById('ban-user-modal');
        modal?.classList.add('hidden');
        modal?.classList.remove('flex');
    }

    function toggleBanExpiry() {
        const temporary = document.getElementById('ban-type')?.value === 'temporary';
        const expiry = document.getElementById('ban-expiry');
        if (expiry) expiry.disabled = !temporary;
    }

    async function submitBanForm(event) {
        event.preventDefault();
        const userId = document.getElementById('ban-user-id')?.value;
        const reason = document.getElementById('ban-reason')?.value.trim();
        const temporary = document.getElementById('ban-type')?.value === 'temporary';
        const expiry = document.getElementById('ban-expiry')?.value;
        if (!userId || !reason) return;
        if (temporary && !expiry) return alert('Choose an expiry date for a temporary ban.');
        try {
            await updateAdminUser(userId, { status: 'Banned', banInfo: { reason, banEnds: temporary ? new Date(expiry).toISOString() : null } });
            closeBanUserModal();
            await loadBannedUsersTable();
            if (window.showToast) showToast('User banned');
        } catch (error) {
            alert(String(error?.message || error));
        }
    }

    async function unbanUser(userId) {
        if (!confirm('Unban this user and restore account access?')) return;
        try {
            await updateAdminUser(userId, { status: 'Active' });
            await loadBannedUsersTable();
            if (window.showToast) showToast('User unbanned');
        } catch (error) {
            alert(String(error?.message || error));
        }
    }

    function renderAnnouncementManager() {
        const animeOptions = (Array.isArray(animeData) ? animeData : []).map(a => `<option value="${a.id}">${a.title}</option>`).join('');
        return `<div class="mb-6"><h1 class="text-2xl md:text-3xl font-black">Announcements & Notifications</h1><p class="mt-1 text-sm text-gray-500">Publish platform announcements and user notifications.</p></div>
        <div class="grid gap-6 lg:grid-cols-2">
          <form onsubmit="publishAnnouncement(event)" class="glass-card rounded-2xl p-6 space-y-4">
            <h2 class="font-bold text-lg">Create Announcement</h2>
            <select id="announcement-type" class="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm"><option value="announcement">Platform announcement</option><option value="new_episode">New episode notification</option><option value="new_anime">New anime notification</option><option value="maintenance">Maintenance notification</option></select>
            <input id="announcement-title" required maxlength="120" placeholder="Title: New episodes available!" class="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm">
            <textarea id="announcement-message" required maxlength="1000" rows="4" placeholder="Message for Anify users..." class="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm"></textarea>
            <div class="grid grid-cols-2 gap-3"><input id="announcement-action-label" maxlength="60" placeholder="Action label (Watch Now)" class="rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm"><select id="announcement-anime" class="rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm"><option value="">No anime link</option>${animeOptions}</select></div>
            <button class="btn-primary w-full py-3">Publish</button>
          </form>
          <div class="glass-card rounded-2xl p-6"><h2 class="font-bold text-lg">User Rating Summary</h2><p class="mt-1 text-sm text-gray-500">Ratings are calculated only from user submissions.</p><select id="rating-summary-anime" onchange="loadRatingSummary()" class="mt-4 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm"><option value="">Choose an anime</option>${animeOptions}</select><div id="rating-summary" class="mt-5 text-sm text-gray-400">Select an anime to view its user rating breakdown.</div></div>
        </div><div class="glass-card rounded-2xl p-6 mt-6"><h2 class="font-bold text-lg">Published</h2><div id="admin-announcements-list" class="mt-4 space-y-3"></div></div>`;
    }

    async function publishAnnouncement(event) {
        event.preventDefault();
        const token = getAuthToken(); const animeId = document.getElementById('announcement-anime').value;
        const payload = { type: document.getElementById('announcement-type').value, title: document.getElementById('announcement-title').value.trim(), message: document.getElementById('announcement-message').value.trim(), actionLabel: document.getElementById('announcement-action-label').value.trim(), actionUrl: animeId ? `#anime-${animeId}` : '' };
        try { const res = await fetch('/api/admin/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }); const data = await res.json(); if (!res.ok || !data.ok) throw new Error(data.error); event.target.reset(); loadAdminAnnouncements(); if (window.showToast) showToast('Announcement published'); } catch (error) { alert(String(error.message || error)); }
    }

    async function loadAdminAnnouncements() {
        const target = document.getElementById('admin-announcements-list'); if (!target) return;
        try { const res = await fetch('/api/admin/announcements', { headers: { Authorization: `Bearer ${getAuthToken()}` } }); const data = await res.json(); if (!res.ok || !data.ok) throw new Error(data.error); target.innerHTML = data.announcements.length ? data.announcements.map(a => `<div class="group rounded-2xl border border-white/5 bg-gradient-to-r from-white/[0.07] to-white/[0.02] p-4"><div class="flex gap-4"><div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-gold-400"><i data-lucide="megaphone" class="w-5 h-5"></i></div><div class="min-w-0 flex-1"><div class="flex justify-between gap-3"><p class="font-semibold">${a.title}</p><button onclick="deleteAnnouncement('${a._id}')" class="rounded-lg p-2 text-gray-500 transition hover:bg-red-500/10 hover:text-red-300" title="Delete announcement"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div><p class="mt-1 text-sm leading-6 text-gray-400">${a.message}</p><p class="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gold-400">${String(a.type).replace('_', ' ')}</p></div></div></div>`).join('') : '<p class="text-sm text-gray-500">No announcements published yet.</p>'; if (window.lucide) lucide.createIcons(); } catch (e) { target.innerHTML = `<p class="text-sm text-red-400">${String(e.message || e)}</p>`; }
    }

    async function deleteAnnouncement(id) { if (!confirm('Delete this announcement?')) return; try { const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getAuthToken()}` } }); const data = await res.json(); if (!res.ok || !data.ok) throw new Error(data.error); loadAdminAnnouncements(); if (window.showToast) showToast('Announcement deleted'); } catch (error) { alert(String(error.message || error)); } }

    async function loadRatingSummary() {
        const id = document.getElementById('rating-summary-anime').value, target = document.getElementById('rating-summary'); if (!id || !target) return;
        try { const res = await fetch(`/api/admin/anime/${id}/rating-summary`, { headers: { Authorization: `Bearer ${getAuthToken()}` } }); const data = await res.json(); if (!res.ok || !data.ok) throw new Error(data.error); target.innerHTML = `<div class="flex items-end gap-5"><div><p class="text-3xl font-black text-gold-400">${Number(data.averageRating).toFixed(1)}</p><p class="text-xs text-gray-500">Average rating</p></div><div><p class="text-xl font-bold">${data.totalRatings}</p><p class="text-xs text-gray-500">User ratings</p></div></div><div class="mt-5 space-y-2">${data.distribution.reverse().map(d => { const pct = data.totalRatings ? Math.round(d.count / data.totalRatings * 100) : 0; return `<div class="flex items-center gap-2"><span class="w-8 text-xs">${d.stars} ★</span><div class="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div class="h-full bg-gold-400" style="width:${pct}%"></div></div><span class="w-9 text-right text-xs text-gray-400">${pct}%</span></div>`; }).join('')}</div>`; } catch (e) { target.textContent = String(e.message || e); }
    }

    function renderAdminAnalytics() {
        return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Analytics</h1>
        <p class="text-gray-500 text-sm mt-1">Detailed platform analytics</p>
    </div>
    <div class="grid md:grid-cols-2 gap-6 mb-8">
        <div class="glass-card rounded-2xl p-5">
            <h3 class="font-bold mb-4">Revenue Breakdown</h3>
            <div class="space-y-4">
                ${[
                    { label: "Premium Subscriptions", amount: "$52,400", pct: 62, color: "from-gold-400 to-gold-500" },
                    { label: "Ad Revenue", amount: "$18,200", pct: 22, color: "from-purple-400 to-purple-500" },
                    { label: "Merchandise", amount: "$9,800", pct: 12, color: "from-blue-400 to-blue-500" },
                    { label: "Other", amount: "$3,600", pct: 4, color: "from-pink-400 to-pink-500" },
                ].map(r => `
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm">${r.label}</span>
                            <span class="text-sm font-bold">${r.amount}</span>
                        </div>
                        <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r ${r.color} rounded-full" style="width: ${r.pct}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="glass-card rounded-2xl p-5">
            <h3 class="font-bold mb-4">Monthly Active Users</h3>
            <div class="flex items-end gap-1 h-44">
                ${[40, 55, 70, 45, 80, 65, 90, 75, 95, 85, 100, 92].map((v, i) => `
                    <div class="flex-1 flex flex-col items-center gap-1">
                        <div class="w-full bg-gradient-to-t from-gold-400/60 to-gold-400 rounded-t-md" style="height: ${v}%"></div>
                        <span class="text-[9px] text-gray-500">${['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    <div class="glass-card rounded-2xl p-5">
        <h3 class="font-bold mb-4">Genre Distribution</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            ${categories.filter(c => c !== 'All').map((c, i) => {
                const count = animeData.filter(a => a.genres.includes(c)).length;
                return `<div class="bg-white/3 rounded-xl p-3 text-center">
                    <p class="text-2xl font-black text-gold-400">${count}</p>
                    <p class="text-xs text-gray-500 mt-1">${c}</p>
                </div>`;
            }).join('')}
        </div>
    </div>`;
    }

    function renderAdminSubscriptions() {
        return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Subscriptions</h1>
        <p class="text-gray-500 text-sm mt-1">Manage subscription plans</p>
    </div>
    <div class="grid md:grid-cols-2 gap-6 mb-8">
        <div class="glass-card rounded-2xl p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold">Free Plan</h3>
                <span class="text-xs bg-gray-400/10 text-gray-400 px-3 py-1 rounded-full">Current</span>
            </div>
            <p class="text-3xl font-black mb-4">$0<span class="text-sm font-normal text-gray-500">/month</span></p>
            <ul class="space-y-2 mb-6">
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Limited anime library</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> 480p quality</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="x" class="w-4 h-4 text-red-400"></i> Ad-free streaming</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="x" class="w-4 h-4 text-red-400"></i> Premium-only anime</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="x" class="w-4 h-4 text-red-400"></i> Early episode access</li>
            </ul>
            <p class="text-sm text-gray-500">16.1K active users</p>
        </div>
        <div class="glass-card rounded-2xl p-6 border-gold-400/20 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-gold-400/5 rounded-full -mr-16 -mt-16"></div>
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold flex items-center gap-2">Premium <i data-lucide="crown" class="w-5 h-5 text-gold-400"></i></h3>
                <span class="badge-premium">Popular</span>
            </div>
            <p class="text-3xl font-black mb-4 text-gold-400">$9.99<span class="text-sm font-normal text-gray-500">/month</span></p>
            <ul class="space-y-2 mb-6">
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Full anime library</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> 1080p / 4K quality</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Ad-free streaming</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Premium-only anime</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Early episode access</li>
            </ul>
            <p class="text-sm text-gray-500">8.4K active subscribers</p>
        </div>
    </div>
    <div class="glass-card rounded-2xl p-5">
        <h3 class="font-bold mb-4">Payment Integration</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-white/5 rounded-xl p-4 text-center"><p class="font-semibold text-sm">Stripe</p><p class="text-xs text-green-400">Connected ✓</p></div>
            <div class="bg-white/5 rounded-xl p-4 text-center"><p class="font-semibold text-sm">Paystack</p><p class="text-xs text-green-400">Connected ✓</p></div>
            <div class="bg-white/5 rounded-xl p-4 text-center"><p class="font-semibold text-sm">PayPal</p><p class="text-xs text-yellow-400">Pending</p></div>
            <div class="bg-white/5 rounded-xl p-4 text-center cursor-pointer hover:bg-white/10 transition-all"><p class="font-semibold text-sm">+ Add</p><p class="text-xs text-gray-500">New Provider</p></div>
        </div>
    </div>`;
    }

    function renderAdminReports() {
        const reports = [
            { user: "SakuraBloom", type: "Spam", target: "Comment on Episode 24", status: "Pending", date: "2 hours ago" },
            { user: "NarutoRun", type: "Inappropriate", target: "Review on Demon Slayer", status: "Resolved", date: "1 day ago" },
            { user: "OtakuLord", type: "Bug", target: "Video player not loading", status: "In Progress", date: "2 days ago" },
            { user: "MoonPrincess", type: "Spam", target: "User: SpamBot42", status: "Resolved", date: "3 days ago" },
        ];
        return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Reports</h1>
        <p class="text-gray-500 text-sm mt-1">${reports.filter(r => r.status === 'Pending').length} pending reports</p>
    </div>
    <div class="space-y-3">
        ${reports.map(r => `
            <div class="glass-card rounded-2xl p-4 flex items-start gap-4 flex-wrap">
                <div class="flex-1 min-w-[200px]">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-semibold text-sm">${r.user}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full ${r.type === 'Spam' ? 'bg-red-400/10 text-red-400' : r.type === 'Bug' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-orange-400/10 text-orange-400'}">${r.type}</span>
                    </div>
                    <p class="text-sm text-gray-400">${r.target}</p>
                    <p class="text-xs text-gray-500 mt-1">${r.date}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs px-2.5 py-1 rounded-full ${r.status === 'Pending' ? 'bg-yellow-400/10 text-yellow-400' : r.status === 'Resolved' ? 'bg-green-400/10 text-green-400' : 'bg-blue-400/10 text-blue-400'}">${r.status}</span>
                    ${r.status === 'Pending' ? '<button class="btn-primary px-3 py-1 text-xs">Review</button>' : ''}
                </div>
            </div>
        `).join('')}
    </div>`;
    }

    function renderAdminSettings() {
        const currentLimit = global.guestPreviewService ? global.guestPreviewService.getGuestLimit() : 4;

        setTimeout(loadMaintenanceMode, 0);
        setTimeout(loadSupportEnabled, 0);
        return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Settings</h1>
        <p class="text-gray-500 text-sm mt-1">Configure platform settings</p>
    </div>

    <div class="space-y-6">
        <!-- Guest Preview Settings -->
        <div class="glass-card rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center">
                    <i data-lucide="users" class="w-5 h-5 text-gold-400"></i>
                </div>
                <div>
                    <h2 class="text-lg font-bold">Guest Preview Settings</h2>
                    <p class="text-sm text-gray-500">Configure guest preview limits</p>
                </div>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="text-sm font-medium text-gray-400 mb-2 block">Guest Preview Limit (videos)</label>
                    <div class="flex items-center gap-4">
                        <input 
                            type="number" 
                            id="guest-limit-input" 
                            value="${currentLimit}" 
                            min="1" 
                            max="20"
                            class="w-32 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gold-400/50"
                        >
                        <button onclick="saveGuestLimit()" class="btn-primary px-4 py-2 text-sm">
                            Save Changes
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">Number of videos guests can watch before registration (1-20)</p>
                </div>
            </div>
        </div>

        <!-- Platform Settings -->
        <div class="glass-card rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <i data-lucide="settings" class="w-5 h-5 text-purple-400"></i>
                </div>
                <div>
                    <h2 class="text-lg font-bold">Platform Settings</h2>
                    <p class="text-sm text-gray-500">General platform configuration</p>
                </div>
            </div>

            <div class="space-y-4">
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                        <p class="font-medium">Maintenance Mode</p>
                        <p class="text-xs text-gray-500">Temporarily disable the platform</p>
                    </div>
                    <button id="maintenance-mode-toggle" onclick="toggleMaintenanceMode()" class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-all">
                        Loading...
                    </button>
                </div>
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                        <p class="font-medium">Support / Donations</p>
                        <p class="text-xs text-gray-500">Enable or disable the support feature on frontend</p>
                    </div>
                    <button id="support-enabled-toggle" onclick="toggleSupportEnabled()" class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-all">
                        Loading...
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    }

    async function loadMaintenanceMode() {
        const button = document.getElementById('maintenance-mode-toggle');
        if (!button) return;
        try {
            const response = await fetch('/api/platform-settings');
            const data = await response.json();
            const enabled = data?.maintenanceMode === true;
            button.textContent = enabled ? 'Enabled' : 'Disabled';
            button.className = `px-4 py-2 rounded-lg text-sm font-medium transition-all ${enabled ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-white/10 hover:bg-white/20'}`;
            button.dataset.enabled = String(enabled);
        } catch (error) {
            button.textContent = 'Unavailable';
            console.error('Could not load maintenance mode:', error);
        }
    }

    async function toggleMaintenanceMode() {
        const button = document.getElementById('maintenance-mode-toggle');
        if (!button || button.dataset.saving === 'true') return;
        const current = button.dataset.enabled === 'true';
        const token = global.authService?.getToken?.();
        if (!token) return alert('Your admin session has expired. Please sign in again.');

        button.dataset.saving = 'true';
        button.disabled = true;
        try {
            const response = await fetch('/api/admin/platform-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ maintenanceMode: !current })
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.error || 'Could not update maintenance mode.');
            if (typeof showToast === 'function') showToast(`Maintenance mode ${data.maintenanceMode ? 'enabled' : 'disabled'}`);
            await loadMaintenanceMode();
        } catch (error) {
            alert(error.message || 'Could not update maintenance mode.');
        } finally {
            button.dataset.saving = 'false';
            button.disabled = false;
        }
    }

    async function loadSupportEnabled() {
        const button = document.getElementById('support-enabled-toggle');
        if (!button) return;
        try {
            const response = await fetch('/api/platform-settings');
            const data = await response.json();
            const enabled = data?.supportEnabled === true;
            button.textContent = enabled ? 'Enabled' : 'Disabled';
            button.className = `px-4 py-2 rounded-lg text-sm font-medium transition-all ${enabled ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-white/10 hover:bg-white/20'}`;
            button.dataset.enabled = String(enabled);
        } catch (error) {
            button.textContent = 'Unavailable';
            console.error('Could not load support enabled:', error);
        }
    }

    async function toggleSupportEnabled() {
        const button = document.getElementById('support-enabled-toggle');
        if (!button || button.dataset.saving === 'true') return;
        const current = button.dataset.enabled === 'true';
        const token = global.authService?.getToken?.();
        if (!token) return alert('Your admin session has expired. Please sign in again.');

        button.dataset.saving = 'true';
        button.disabled = true;
        try {
            const response = await fetch('/api/admin/platform-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ supportEnabled: !current })
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.error || 'Could not update support settings.');
            if (typeof showToast === 'function') showToast(`Support ${data.supportEnabled ? 'enabled' : 'disabled'}`);
            await loadSupportEnabled();
        } catch (error) {
            alert(error.message || 'Could not update support settings.');
        } finally {
            button.dataset.saving = 'false';
            button.disabled = false;
        }
    }

    function saveGuestLimit() {
        const input = document.getElementById('guest-limit-input');
        const newLimit = parseInt(input?.value, 10);
        
        if (!Number.isFinite(newLimit) || newLimit < 1 || newLimit > 20) {
            alert('Please enter a valid limit between 1 and 20');
            return;
        }
        
        if (global.guestPreviewService) {
            global.guestPreviewService.setGuestLimit(newLimit);
            if (typeof showToast === 'function') {
                showToast(`Guest preview limit updated to ${newLimit} videos`);
            } else {
                alert(`Guest preview limit updated to ${newLimit} videos`);
            }
        } else {
            alert('Guest preview service not available');
        }
    }

    function updateHubProgress(pct, text = 'Uploading...') {
        const container = document.getElementById('hub-progress-container');
        const bar = document.getElementById('hub-progress-bar');
        const percent = document.getElementById('hub-progress-percent');
        const statusText = document.getElementById('hub-progress-text');
        const indicator = document.getElementById('upload-status-indicator');

        if (container) container.classList.remove('hidden');
        if (indicator) indicator.classList.remove('hidden');
        if (bar) bar.style.width = pct + '%';
        if (percent) percent.textContent = Math.round(pct) + '%';
        if (statusText) statusText.textContent = text;

        if (pct >= 100) {
            setTimeout(() => {
                if (container) container.classList.add('hidden');
                if (indicator) indicator.classList.add('hidden');
            }, 1000);
        }
    }

    function toggleAccordion(id) {
        const el = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (el) el.classList.toggle('hidden');
        if (icon) icon.classList.toggle('rotate-180');
    }

    function handleFileSelect(id, file) {
        if (!file) return;
        const label = document.getElementById('label-' + id);
        const info = document.getElementById('file-info-' + id);
        const name = document.getElementById('name-' + id);
        if (label) label.classList.add('hidden');
        if (info) info.classList.remove('hidden');
        if (name) name.textContent = file.name;
    }

    function clearFile(id, event) {
        if (event) event.stopPropagation();
        const input = document.getElementById(id);
        const label = document.getElementById('label-' + id);
        const info = document.getElementById('file-info-' + id);
        if (input) input.value = '';
        if (label) label.classList.remove('hidden');
        if (info) info.classList.add('hidden');
    }

    function checkEpisodeConflict(val) {
        const anime = window.currentHubAnime;
        const warning = document.getElementById('conflict-warning');
        if (!anime || !warning) return;
        const episodes = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
        const exists = episodes.some(e => Number(e.episodeNumber) === Number(val));
        warning.classList.toggle('hidden', !exists);
    }

    async function resetWorkspaceForNewEpisode(nextNum) {
        console.log('[Add New Episode] Button clicked, next episode number:', nextNum);
        
        const workspace = document.getElementById('hub-workspace');
        if (!workspace || !window.currentHubAnime) {
            console.error('[Add New Episode] Missing workspace or currentHubAnime');
            return;
        }

        const anime = window.currentHubAnime;
        console.log('[Add New Episode] Current anime:', anime.title, 'ID:', anime.id);

        // Recalculate next episode number to avoid conflicts
        const episodes = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
        const existingNumbers = episodes.map(e => Number(e.episodeNumber));
        let calculatedNextNum = nextNum;
        
        // Find the next available episode number
        while (existingNumbers.includes(calculatedNextNum)) {
            calculatedNextNum++;
        }
        
        if (calculatedNextNum !== nextNum) {
            console.log('[Add New Episode] Adjusted episode number from', nextNum, 'to', calculatedNextNum, 'to avoid conflict');
        }

        // Create the new episode in the database
        try {
            console.log('[Add New Episode] Creating episode in database...');
            const token = global.authService && typeof global.authService.getToken === 'function'
                ? global.authService.getToken()
                : null;

            if (!token) {
                console.error('[Add New Episode] No auth token available');
                alert('Authentication required. Please log in again.');
                return;
            }

            const response = await fetch(`/api/anime/${anime.id}/episodes/${calculatedNextNum}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    episodeNumber: calculatedNextNum,
                    episodeTitle: '',
                    sub: { qualities: {} },
                    dub: { qualities: {} }
                })
            });

            console.log('[Add New Episode] API response status:', response.status);
            const data = await response.json();
            console.log('[Add New Episode] API response data:', data);

            if (!response.ok || !data.ok) {
                console.error('[Add New Episode] Failed to create episode:', data.error);
                alert('Failed to create episode: ' + (data.error || 'Unknown error'));
                return;
            }

            console.log('[Add New Episode] Episode created successfully in database');

            // Update the local anime data with the response
            if (data.anime) {
                window.currentHubAnime = data.anime;
                console.log('[Add New Episode] Updated local anime data, episodes count:', data.anime.episodesMedia?.length || 0);
            }

            // Refresh the episode list in the sidebar
            const episodeList = document.getElementById('hub-episode-list');
            if (episodeList) {
                const episodes = Array.isArray(window.currentHubAnime.episodesMedia) ? window.currentHubAnime.episodesMedia : [];
                console.log('[Add New Episode] Refreshing sidebar with episodes:', episodes.map(e => e.episodeNumber));
                
                episodeList.innerHTML = episodes.length > 0 ? episodes.sort((a, b) => b.episodeNumber - a.episodeNumber).map(e => `
                    <div class="group p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent dark:border-white/5 hover:border-gold-400/30 hover:bg-black/8 dark:hover:bg-white/8 transition-all flex items-center justify-between cursor-pointer ${Number(e.episodeNumber) === Number(calculatedNextNum) ? 'hub-episode-active' : ''}" onclick="loadEpisodeIntoWorkspace(${e.episodeNumber})">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-green-400/10 flex items-center justify-center border border-green-400/20">
                                <i data-lucide="check" class="w-4 h-4 text-green-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-black dark:text-white">Episode ${e.episodeNumber}</p>
                                <p class="text-[10px] text-gray-500 font-bold uppercase">${Object.keys(e.sub?.qualities || {}).length > 0 ? 'Sub' : ''} ${Object.keys(e.dub?.qualities || {}).length > 0 ? '• Dub' : ''} • ${(typeof formatViewCount === 'function' ? formatViewCount(e.views || 0) : ((e.views || 0) + ' views'))}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-gold-400"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                            <button class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400" onclick="deleteHubEpisode(${e.episodeNumber}, event)"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="flex flex-col items-center justify-center py-10 text-center opacity-40">
                        <i data-lucide="inbox" class="w-10 h-10 mb-2"></i>
                        <p class="text-xs font-bold text-black dark:text-white">No episodes yet</p>
                    </div>
                `;
                
                // Re-initialize icons for the updated sidebar
                if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
            }

            // Update the workspace form for the new episode
            workspace.innerHTML = renderWorkspaceForm(window.currentHubAnime, calculatedNextNum);
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
            bindWorkspaceInteractions();

            console.log('[Add New Episode] Workspace updated for episode:', calculatedNextNum);

        } catch (error) {
            console.error('[Add New Episode] Error creating episode:', error);
            alert('Error creating episode: ' + error.message);
        }
    }

    function loadEpisodeIntoWorkspace(num) {
        console.log('[Load Episode] Loading episode into workspace:', num);
        const anime = window.currentHubAnime;
        if (!anime) {
            console.error('[Load Episode] No current anime found');
            return;
        }
        
        const ep = (anime.episodesMedia || []).find(e => Number(e.episodeNumber) === Number(num));
        console.log('[Load Episode] Found episode data:', ep ? 'Yes' : 'No');
        
        const workspace = document.getElementById('hub-workspace');
        if (workspace && ep) {
            workspace.innerHTML = renderWorkspaceForm(anime, num, ep);
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
            bindWorkspaceInteractions();

            // Initialize existing video indicators
            initializeExistingVideos(ep);

            // UI feedback in list
            document.querySelectorAll('#hub-episode-list > div').forEach(el => {
                const isTarget = el.querySelector('p')?.textContent.includes('Episode ' + num);
                el.classList.toggle('hub-episode-active', isTarget);
            });
            
            console.log('[Load Episode] Episode loaded successfully');
        } else {
            console.error('[Load Episode] Failed to load episode - workspace or episode data missing');
        }
    }

    function initializeExistingVideos(ep) {
        // Mark all quality inputs that have existing videos
        const qualities = ['1080p', '720p'];
        const languages = ['sub', 'dub'];
        
        qualities.forEach(quality => {
            languages.forEach(lang => {
                const url = ep?.[lang]?.qualities?.[quality];
                if (url) {
                    const inputId = lang === 'sub' 
                        ? (quality === '1080p' ? 'admin-video-file' : 'admin-sub-720-video-file')
                        : (quality === '1080p' ? 'admin-dub-video-file' : 'admin-dub-720-video-file');
                    
                    const input = document.getElementById(inputId);
                    const nameEl = document.getElementById(`name-${inputId}`);
                    if (input && nameEl) {
                        // Store the existing URL as a data attribute
                        input.dataset.existingUrl = url;
                        nameEl.textContent = 'Video uploaded (click to replace)';
                    }
                }
            });
        });
    }

    async function deleteHubEpisode(num, event) {
        console.log('[Delete Episode] Attempting to delete episode:', num);
        if (event) event.stopPropagation();
        const anime = window.currentHubAnime;
        if (!anime) {
            console.error('[Delete Episode] No current anime found');
            return;
        }
        if (!confirm(`Delete Episode ${num} permanently?`)) {
            console.log('[Delete Episode] Delete cancelled by user');
            return;
        }

        try {
            console.log('[Delete Episode] Sending delete request to server...');
            const token = getAuthToken();
            const res = await fetch(`/api/anime/${anime.id}/episodes/${num}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const data = await res.json().catch(() => ({}));
            console.log('[Delete Episode] Server response:', data);
            
            if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed');

            console.log('[Delete Episode] Episode deleted successfully, refreshing UI...');

            // Refresh local data
            if (typeof updateLocalAnimeData === 'function') updateLocalAnimeData(data.anime);
            window.currentHubAnime = data.anime;
            
            // Re-render Hub
            renderEpisodeManagementHub(data.anime);
            
            // Re-bind the Add New Episode button after re-render
            const addEpisodeBtn = document.getElementById('add-new-episode-btn');
            if (addEpisodeBtn) {
                addEpisodeBtn.onclick = () => resetWorkspaceForNewEpisode(calculateNextEpisodeNumber());
                console.log('[Delete Episode] Add New Episode button rebound after deletion');
            }
            
            showToast(`Episode ${num} deleted.`);
            console.log('[Delete Episode] UI refreshed successfully');
        } catch (e) {
            console.error('[Delete Episode] Error deleting episode:', e);
            if (window.alertGold) alertGold('Error deleting episode: ' + e.message);
            else alert('Error deleting episode: ' + e.message);
        }
    }

    function bindWorkspaceInteractions() {
        const workspace = document.getElementById('hub-workspace');
        if (!workspace) return;

        // Bind batch selection/drop handling whenever the workspace is rendered.
        if (typeof global.initBatchEpisodeUpload === 'function') global.initBatchEpisodeUpload();

        const zones = workspace.querySelectorAll('.drop-zone');
        zones.forEach(zone => {
            const id = zone.dataset.dropTarget;
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('active');
            });
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('active');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('active');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('video/')) {
                    const input = document.getElementById(id);
                    if (input) {
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                        handleFileSelect(id, file);
                    }
                }
            });
        });
    }

    global.renderAdmin = renderAdmin;
    global.switchAdminTab = switchAdminTab;
    global.showUploadModal = showUploadModal;
    global.uploadAdminVideo = uploadAdminVideo;
    global.uploadAdminMovie = uploadAdminMovie;
    global.hideUploadModal = hideUploadModal;
    global.editAdminAnime = editAdminAnime;
    global.uploadAdminEpisode = uploadAdminEpisode;
    global.deleteAdminAnime = deleteAdminAnime;
    global.bindAdminAnimeActions = bindAdminAnimeActions;
    global.renderAdminDashboard = renderAdminDashboard;
    global.renderAdminAnime = renderAdminAnime;
    global.renderAdminUsers = renderAdminUsers;
    global.handleAdminUserAction = handleAdminUserAction;
    global.loadAdminUsersTable = loadAdminUsersTable;
    global.renderBannedUsers = renderBannedUsers;
    global.loadBannedUsersTable = loadBannedUsersTable;
    global.openBanUserModal = openBanUserModal;
    global.closeBanUserModal = closeBanUserModal;
    global.toggleBanExpiry = toggleBanExpiry;
    global.submitBanForm = submitBanForm;
    global.unbanUser = unbanUser;
    global.viewAdminUser = viewAdminUser;
    global.closeAdminUserDetails = closeAdminUserDetails;
    global.changeUserRole = changeUserRole;
    global.resetUserPassword = resetUserPassword;
    global.forceUserLogout = forceUserLogout;
    global.deleteAdminUser = deleteAdminUser;
    global.publishAnnouncement = publishAnnouncement;
    global.loadRatingSummary = loadRatingSummary;
    global.deleteAnnouncement = deleteAnnouncement;
    global.renderAdminAnalytics = renderAdminAnalytics;
    global.renderAdminSubscriptions = renderAdminSubscriptions;
    global.renderAdminReports = renderAdminReports;
    global.renderAdminSettings = renderAdminSettings;
    global.renderAdminSupport = renderAdminSupport;
    global.loadAdminSupportTable = loadAdminSupportTable;
    global.saveGuestLimit = saveGuestLimit;
    global.toggleMaintenanceMode = toggleMaintenanceMode;
    global.toggleSupportEnabled = toggleSupportEnabled;
    global.refreshDashboard = refreshDashboard;
    global.exportDashboardData = exportDashboardData;

    // Catalogue Management Actions
    function bindCatalogueActions() {
        // Search input
        const searchInput = document.getElementById('catalogue-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (window.catalogueState) {
                    window.catalogueState.filters.search = e.target.value;
                    if (window.renderCatalogueManagement) {
                        document.getElementById('admin-content').innerHTML = window.renderCatalogueManagement();
                        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
                        bindCatalogueActions();
                    }
                }
            });
        }

        // Filter inputs
        const filterInputs = ['catalogue-filter-status', 'catalogue-filter-type', 'catalogue-filter-visibility', 'catalogue-filter-rating', 'catalogue-sort'];
        filterInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', (e) => {
                    if (window.catalogueState) {
                        if (id === 'catalogue-sort') {
                            window.catalogueState.sortBy = e.target.value;
                        } else {
                            const filterName = id.replace('catalogue-filter-', '');
                            window.catalogueState.filters[filterName] = e.target.value;
                        }
                        if (window.renderCatalogueManagement) {
                            document.getElementById('admin-content').innerHTML = window.renderCatalogueManagement();
                            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
                            bindCatalogueActions();
                        }
                    }
                });
            }
        });

        // Recent checkbox
        const recentCheckbox = document.getElementById('catalogue-filter-recent');
        if (recentCheckbox) {
            recentCheckbox.addEventListener('change', (e) => {
                if (window.catalogueState) {
                    window.catalogueState.filters.recentlyUpdated = e.target.checked;
                    if (window.renderCatalogueManagement) {
                        document.getElementById('admin-content').innerHTML = window.renderCatalogueManagement();
                        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
                        bindCatalogueActions();
                    }
                }
            });
        }

        // Clear filters button
        const clearButton = document.getElementById('catalogue-filter-clear');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (window.catalogueState) {
                    window.catalogueState.filters = {
                        search: '',
                        status: '',
                        type: '',
                        genre: '',
                        rating: '',
                        year: '',
                        visibility: '',
                        minEpisodes: '',
                        maxEpisodes: '',
                        recentlyUpdated: false
                    };
                    window.catalogueState.sortBy = 'newest';
                    if (window.renderCatalogueManagement) {
                        document.getElementById('admin-content').innerHTML = window.renderCatalogueManagement();
                        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
                        bindCatalogueActions();
                    }
                }
            });
        }

        // Update selection UI
        if (window.updateSelectionUI) {
            window.updateSelectionUI();
        }
    }

    window.bindCatalogueActions = bindCatalogueActions;

    // Redesign Hub Exports
    global.renderEpisodeManagementHub = renderEpisodeManagementHub;
    global.calculateNextEpisodeNumber = calculateNextEpisodeNumber;
    global.toggleAccordion = toggleAccordion;
    global.handleFileSelect = handleFileSelect;
    global.clearFile = clearFile;
    global.checkEpisodeConflict = checkEpisodeConflict;
    global.resetWorkspaceForNewEpisode = resetWorkspaceForNewEpisode;
    global.loadEpisodeIntoWorkspace = loadEpisodeIntoWorkspace;
    global.deleteHubEpisode = deleteHubEpisode;
    global.updateHubProgress = updateHubProgress;
    global.manuallyVerifyDonation = manuallyVerifyDonation;
})(window);
