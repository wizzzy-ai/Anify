(function (global) {
    'use strict';

    function ensureHttps(url) {
        if (!url || typeof url !== 'string') return url;
        return url.replace(/^http:/, 'https:');
    }

    // Render catalogue statistics
    function renderCatalogueStats(stats) {
        return `
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <button type="button" onclick="window.setCatalogueStatFilter('total')" class="glass-card rounded-xl p-4 text-left cursor-pointer hover:border-gold-400/50 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
                            <i data-lucide="tv" class="w-5 h-5 text-gold-400"></i>
                        </div>
                        <div>
                            <p class="text-2xl font-black">${stats.total || 0}</p>
                            <p class="text-xs text-gray-500">Total Titles</p>
                        </div>
                    </div>
                </button>
                <button type="button" onclick="window.setCatalogueStatFilter('series')" class="glass-card rounded-xl p-4 text-left cursor-pointer hover:border-purple-400/50 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-purple-400/10 flex items-center justify-center">
                            <i data-lucide="film" class="w-5 h-5 text-purple-400"></i>
                        </div>
                        <div>
                            <p class="text-2xl font-black">${stats.series || 0}</p>
                            <p class="text-xs text-gray-500">Series</p>
                        </div>
                    </div>
                </button>
                <button type="button" onclick="window.setCatalogueStatFilter('movie')" class="glass-card rounded-xl p-4 text-left cursor-pointer hover:border-blue-400/50 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
                            <i data-lucide="clapperboard" class="w-5 h-5 text-blue-400"></i>
                        </div>
                        <div>
                            <p class="text-2xl font-black">${stats.movies || 0}</p>
                            <p class="text-xs text-gray-500">Movies</p>
                        </div>
                    </div>
                </button>
                <button type="button" onclick="window.setCatalogueStatFilter('ongoing')" class="glass-card rounded-xl p-4 text-left cursor-pointer hover:border-green-400/50 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center">
                            <i data-lucide="play-circle" class="w-5 h-5 text-green-400"></i>
                        </div>
                        <div>
                            <p class="text-2xl font-black">${stats.ongoing || 0}</p>
                            <p class="text-xs text-gray-500">Ongoing</p>
                        </div>
                    </div>
                </button>
                <button type="button" onclick="window.setCatalogueStatFilter('coming-soon')" class="glass-card rounded-xl p-4 text-left cursor-pointer hover:border-orange-400/50 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-orange-400/10 flex items-center justify-center">
                            <i data-lucide="clock-3" class="w-5 h-5 text-orange-400"></i>
                        </div>
                        <div>
                            <p class="text-2xl font-black">${stats.comingSoon || 0}</p>
                            <p class="text-xs text-gray-500">Coming Soon</p>
                        </div>
                    </div>
                </button>
            </div>
        `;
    }

    // Render view mode toggle
    function renderViewModeToggle() {
        const mode = window.catalogueState?.viewMode || 'table';
        return `
            <div class="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <button onclick="window.setViewMode('table')" data-view-mode="table" class="p-2 rounded-md transition-all ${mode === 'table' ? 'bg-gold-400/20 text-gold-400' : 'text-gray-400 hover:text-white'}">
                    <i data-lucide="table" class="w-4 h-4"></i>
                </button>
                <button onclick="window.setViewMode('poster')" data-view-mode="poster" class="p-2 rounded-md transition-all ${mode === 'poster' ? 'bg-gold-400/20 text-gold-400' : 'text-gray-400 hover:text-white'}">
                    <i data-lucide="grid-3x3" class="w-4 h-4"></i>
                </button>
                <button onclick="window.setViewMode('compact')" data-view-mode="compact" class="p-2 rounded-md transition-all ${mode === 'compact' ? 'bg-gold-400/20 text-gold-400' : 'text-gray-400 hover:text-white'}">
                    <i data-lucide="list" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }

    // Render bulk action toolbar
    function renderBulkToolbar() {
        const selectedCount = window.catalogueState?.selectedAnime?.size || 0;
        return `
            <div data-bulk-toolbar class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card rounded-2xl px-6 py-4 shadow-2xl border border-gold-400/30">
                <div class="flex items-center gap-6">
                    <div class="flex items-center gap-3">
                        <span data-selected-count class="font-bold text-gold-400">${selectedCount} selected</span>
                        <button onclick="window.clearSelection()" class="text-xs text-gray-400 hover:text-white underline">Clear</button>
                    </div>
                    <div class="h-6 w-px bg-white/10"></div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.showBulkEditModal()" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold transition-all">
                            <i data-lucide="pencil" class="w-4 h-4 text-gold-400"></i>
                            Edit
                        </button>
                        <button onclick="window.exportCatalogue('json', true)" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold transition-all">
                            <i data-lucide="download" class="w-4 h-4 text-blue-400"></i>
                            Export
                        </button>
                        <button onclick="window.bulkDelete()" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-sm font-semibold transition-all">
                            <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Render table view
    function renderTableView(animeList) {
        return `
            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="border-b border-white/5 bg-white/[0.02] text-left">
                                <th class="p-4 w-10">
                                    <input type="checkbox" data-select-all-checkbox class="rounded border-white/20 bg-white/5 text-gold-400 focus:ring-gold-400/50" onchange="window.handleSelectAll(this)">
                                </th>
                                <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Title & details</th>
                                <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Type</th>
                                <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                                <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden lg:table-cell">Episodes</th>
                                <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Rating</th>
                                <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${animeList.map(a => renderTableRow(a)).join('')}
                        </tbody>
                    </table>
                </div>
                ${animeList.length === 0 ? renderEmptyState() : ''}
            </div>
        `;
    }

    // Render table row
    function renderTableRow(a) {
        const isMovie = (a?.type || 'anime') !== 'anime';
        const typeLabel = !isMovie ? 'Series' : (a?.type === 'live-movie' ? 'Live Movie' : 'Animated Movie');
        const status = a?.status || 'Airing';
        const rating = Number(a?.averageRating || a?.rating || 0);
        const episodesLabel = Array.isArray(a?.episodesMedia)
                ? Math.max(1, a.episodesMedia.length)
                : (Number.isFinite(Number(a?.episodes)) ? Number(a.episodes) : (a?.episodes || 0));
        
        const statusColors = {
            'Airing': 'bg-green-400/10 text-green-400',
            'Ongoing': 'bg-blue-400/10 text-blue-400',
            'Completed': 'bg-purple-400/10 text-purple-400',
            'Upcoming': 'bg-yellow-400/10 text-yellow-400',
            'Coming Soon': 'bg-orange-400/10 text-orange-400'
        };

        return `
            <tr class="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td class="p-4">
                    <input type="checkbox" data-catalogue-checkbox="${a?.id}" class="rounded border-white/20 bg-white/5 text-gold-400 focus:ring-gold-400/50" onchange="window.toggleSelection('${a?.id}')">
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <img src="${ensureHttps(a?.image || '')}" class="w-12 h-16 rounded-lg object-cover" alt="${a?.title || ''}" onerror="this.src='pictures/logo.png'">
                        <div class="min-w-0">
                            <p class="font-semibold text-sm truncate">${a?.title || 'Untitled'}</p>
                            <p class="text-xs text-gray-500 truncate">${(a?.studio || 'Unknown Studio')} · ${(a?.year || '')}</p>
                            <div class="flex items-center gap-2 mt-1">
                                ${a?.featured ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-gold-400/10 text-gold-400">Featured</span>' : ''}
                                ${a?.premium ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400">Premium</span>' : ''}
                                ${a?.trending ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-green-400/10 text-green-400">Trending</span>' : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="p-4 hidden md:table-cell">
                    <span class="text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-300">${typeLabel}</span>
                </td>
                <td class="p-4">
                    <span class="text-xs px-2.5 py-1 rounded-full ${statusColors[status] || 'bg-gray-400/10 text-gray-400'}">${status}</span>
                </td>
                <td class="p-4 hidden lg:table-cell">
                    <span class="text-xs text-gray-300">${episodesLabel || 0}</span>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-1">
                        <i data-lucide="star" class="w-3.5 h-3.5 text-gold-400 fill-gold-400/20"></i>
                        <span class="text-xs font-semibold">${rating ? rating.toFixed(1) : 'N/A'}</span>
                    </div>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-1">
                        <button class="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="Edit" onclick="window.editAnime('${a?.id}')">
                            <i data-lucide="pencil" class="w-4 h-4 text-gold-400"></i>
                        </button>
                        <button class="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="Manage Episodes" onclick="window.manageEpisodes('${a?.id}')">
                            <i data-lucide="list-video" class="w-4 h-4 text-blue-400"></i>
                        </button>
                        <button class="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="Preview" onclick="window.previewAnime('${a?.id}')">
                            <i data-lucide="eye" class="w-4 h-4 text-green-400"></i>
                        </button>
                        <button class="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="Duplicate" onclick="window.duplicateAnime('${a?.id}')">
                            <i data-lucide="copy" class="w-4 h-4 text-purple-400"></i>
                        </button>
                        <button class="p-1.5 rounded-lg hover:bg-red-500/10 transition-all" title="Delete" onclick="window.deleteAnime('${a?.id}')">
                            <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Render poster grid view
    function renderPosterGridView(animeList) {
        return `
            <div class="glass-card rounded-2xl p-4">
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    ${animeList.map(a => renderPosterCard(a)).join('')}
                </div>
                ${animeList.length === 0 ? renderEmptyState() : ''}
            </div>
        `;
    }

    // Render poster card
    function renderPosterCard(a) {
        const rating = Number(a?.averageRating || a?.rating || 0);
        const status = a?.status || 'Airing';
        
        const statusColors = {
            'Airing': 'bg-green-400',
            'Ongoing': 'bg-blue-400',
            'Completed': 'bg-purple-400',
            'Upcoming': 'bg-yellow-400',
            'Coming Soon': 'bg-orange-400'
        };

        return `
            <div class="relative group cursor-pointer" data-anime-id="${a?.id}">
                <div class="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5">
                    <img src="${ensureHttps(a?.image || '')}" class="w-full h-full object-cover transition-transform group-hover:scale-105" alt="${a?.title || ''}" onerror="this.src='pictures/logo.png'">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="absolute bottom-0 left-0 right-0 p-3">
                            <div class="flex items-center gap-2 mb-2">
                                <input type="checkbox" data-catalogue-checkbox="${a?.id}" class="rounded border-white/20 bg-white/5 text-gold-400 focus:ring-gold-400/50" onclick="event.stopPropagation(); window.toggleSelection('${a?.id}')">
                                <span class="w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-400'}"></span>
                            </div>
                            <div class="flex items-center gap-1">
                                <button class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all" onclick="event.stopPropagation(); window.editAnime('${a?.id}')">
                                    <i data-lucide="pencil" class="w-3.5 h-3.5 text-white"></i>
                                </button>
                                <button class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all" onclick="event.stopPropagation(); window.manageEpisodes('${a?.id}')">
                                    <i data-lucide="list-video" class="w-3.5 h-3.5 text-white"></i>
                                </button>
                                <button class="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-all" onclick="event.stopPropagation(); window.deleteAnime('${a?.id}')">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-400"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    ${rating ? `<div class="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm flex items-center gap-1">
                        <i data-lucide="star" class="w-3 h-3 text-gold-400 fill-gold-400/20"></i>
                        <span class="text-xs font-bold text-white">${rating.toFixed(1)}</span>
                    </div>` : ''}
                </div>
                <div class="mt-2">
                    <p class="font-semibold text-sm truncate">${a?.title || 'Untitled'}</p>
                    <p class="text-xs text-gray-500">${a?.year || ''} · ${Array.isArray(a?.genres) ? a.genres.slice(0, 2).join(', ') : ''}</p>
                </div>
            </div>
        `;
    }

    // Render compact view
    function renderCompactView(animeList) {
        return `
            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="divide-y divide-white/5">
                    ${animeList.map(a => renderCompactRow(a)).join('')}
                </div>
                ${animeList.length === 0 ? renderEmptyState() : ''}
            </div>
        `;
    }

    // Render compact row
    function renderCompactRow(a) {
        const rating = Number(a?.averageRating || a?.rating || 0);
        const status = a?.status || 'Airing';
        
        const statusColors = {
            'Airing': 'bg-green-400/10 text-green-400',
            'Ongoing': 'bg-blue-400/10 text-blue-400',
            'Completed': 'bg-purple-400/10 text-purple-400',
            'Upcoming': 'bg-yellow-400/10 text-yellow-400',
            'Coming Soon': 'bg-orange-400/10 text-orange-400'
        };

        return `
            <div class="flex items-center gap-4 p-3 hover:bg-white/3 transition-colors">
                <input type="checkbox" data-catalogue-checkbox="${a?.id}" class="rounded border-white/20 bg-white/5 text-gold-400 focus:ring-gold-400/50 shrink-0" onchange="window.toggleSelection('${a?.id}')">
                <img src="${ensureHttps(a?.image || '')}" class="w-8 h-12 rounded object-cover shrink-0" alt="${a?.title || ''}" onerror="this.src='pictures/logo.png'">
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-sm truncate">${a?.title || 'Untitled'}</p>
                    <p class="text-xs text-gray-500">${a?.studio || 'Unknown'} · ${a?.year || ''}</p>
                </div>
                <span class="text-xs px-2 py-1 rounded-full ${statusColors[status] || 'bg-gray-400/10 text-gray-400'} shrink-0">${status}</span>
                ${rating ? `<div class="flex items-center gap-1 shrink-0">
                    <i data-lucide="star" class="w-3 h-3 text-gold-400 fill-gold-400/20"></i>
                    <span class="text-xs font-semibold">${rating.toFixed(1)}</span>
                </div>` : ''}
                <div class="flex items-center gap-1 shrink-0">
                    <button class="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="Edit" onclick="window.editAnime('${a?.id}')">
                        <i data-lucide="pencil" class="w-4 h-4 text-gold-400"></i>
                    </button>
                    <button class="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="Manage Episodes" onclick="window.manageEpisodes('${a?.id}')">
                        <i data-lucide="list-video" class="w-4 h-4 text-blue-400"></i>
                    </button>
                    <button class="p-1.5 rounded-lg hover:bg-red-500/10 transition-all" title="Delete" onclick="window.deleteAnime('${a?.id}')">
                        <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Render empty state
    function renderEmptyState() {
        return `
            <div class="p-10 text-center">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                    <i data-lucide="tv" class="w-8 h-8 text-gray-600"></i>
                </div>
                <p class="text-lg font-bold mb-1">No titles found</p>
                <p class="text-sm text-gray-500 mb-6">Try adjusting your filters or upload new content.</p>
                <button type="button" onclick="showUploadModal()" class="btn-primary px-6 py-3">Upload Anime</button>
            </div>
        `;
    }

    // Handle select all
    function handleSelectAll(checkbox) {
        const visibleIds = Array.from(document.querySelectorAll('[data-catalogue-checkbox]'))
            .map(cb => cb.dataset.catalogueCheckbox);
        
        if (checkbox.checked) {
            window.selectAllVisible(visibleIds);
        } else {
            window.clearSelection();
        }
    }

    // Main render function
    function renderCatalogueManagement() {
        const animeList = window.animeData || [];
        console.log('Rendering catalogue with anime count:', animeList.length);
        
        // If no anime data, try to load it
        if (animeList.length === 0 && typeof window.loadAnimeFromApi === 'function') {
            console.log('No anime data found, loading from API...');
            window.loadAnimeFromApi().then(() => {
                console.log('Anime data loaded, re-rendering catalogue');
                if (window.renderCatalogueManagement) {
                    document.getElementById('admin-content').innerHTML = window.renderCatalogueManagement();
                    if (window.bindCatalogueActions) window.bindCatalogueActions();
                    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
                }
            });
            return '<div class="flex items-center justify-center py-12"><p class="text-gray-400">Loading anime data...</p></div>';
        }
        
        const filteredAnime = window.filterAndSortAnime ? window.filterAndSortAnime(animeList) : animeList;
        const stats = window.getCatalogueStats ? window.getCatalogueStats(animeList) : {};
        const viewMode = window.catalogueState?.viewMode || 'table';

        let contentHtml = '';
        
        switch (viewMode) {
            case 'poster':
                contentHtml = renderPosterGridView(filteredAnime);
                break;
            case 'compact':
                contentHtml = renderCompactView(filteredAnime);
                break;
            default:
                contentHtml = renderTableView(filteredAnime);
        }

        return `
            <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 class="text-2xl md:text-3xl font-black anim-slide-up">Catalogue Management</h1>
                    <p class="text-gray-500 text-sm mt-1">${animeList.length} total titles · ${filteredAnime.length} filtered</p>
                </div>
                <div class="flex items-center gap-3">
                    ${renderViewModeToggle()}
                    <button type="button" onclick="showUploadModal()" class="btn-primary flex items-center gap-2 anim-slide-up anim-delay-1">
                        <i data-lucide="plus" class="w-4 h-4"></i> Upload Anime
                    </button>
                </div>
            </div>

            ${renderCatalogueStats(stats)}

            ${renderBulkToolbar()}

            <section class="glass-card rounded-2xl p-4 md:p-5 mb-5 anim-fade-in" aria-label="Catalogue search and filters">
                <div class="flex items-start justify-between gap-4 mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-gold-400/10 flex items-center justify-center">
                            <i data-lucide="sliders-horizontal" class="w-4 h-4 text-gold-400"></i>
                        </div>
                        <div>
                            <h2 class="text-sm font-bold">Search & Filter</h2>
                            <p class="text-xs text-gray-500 mt-0.5">Find content quickly</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.showImportModal()" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gold-400 transition-colors rounded-lg hover:bg-white/5">
                            <i data-lucide="upload" class="w-3.5 h-3.5"></i> Import
                        </button>
                        <button onclick="window.exportCatalogue('json', false)" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gold-400 transition-colors rounded-lg hover:bg-white/5">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i> Export All
                        </button>
                    </div>
                </div>
                <div class="relative mb-3">
                    <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input id="catalogue-search" type="search" class="input-field h-11 w-full pl-10 pr-4 text-sm" placeholder="Search title, ID, studio, genre, year, or description" autocomplete="off" value="${window.catalogueState?.filters?.search || ''}">
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                    <select id="catalogue-filter-status" class="input-field h-10 text-sm">
                        <option value="">All statuses</option>
                        <option value="Airing" ${window.catalogueState?.filters?.status === 'Airing' ? 'selected' : ''}>Airing</option>
                        <option value="Ongoing" ${window.catalogueState?.filters?.status === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
                        <option value="Completed" ${window.catalogueState?.filters?.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Upcoming" ${window.catalogueState?.filters?.status === 'Upcoming' ? 'selected' : ''}>Upcoming</option>
                        <option value="Coming Soon" ${window.catalogueState?.filters?.status === 'Coming Soon' ? 'selected' : ''}>Coming Soon</option>
                    </select>
                    <select id="catalogue-filter-type" class="input-field h-10 text-sm">
                        <option value="">All types</option>
                        <option value="anime" ${window.catalogueState?.filters?.type === 'anime' ? 'selected' : ''}>Series</option>
                        <option value="animated-movie" ${window.catalogueState?.filters?.type === 'animated-movie' ? 'selected' : ''}>Animated Movie</option>
                        <option value="live-movie" ${window.catalogueState?.filters?.type === 'live-movie' ? 'selected' : ''}>Live Movie</option>
                    </select>
                    <select id="catalogue-filter-visibility" class="input-field h-10 text-sm">
                        <option value="">All content</option>
                        <option value="featured" ${window.catalogueState?.filters?.visibility === 'featured' ? 'selected' : ''}>Featured</option>
                        <option value="premium" ${window.catalogueState?.filters?.visibility === 'premium' ? 'selected' : ''}>Premium</option>
                        <option value="trending" ${window.catalogueState?.filters?.visibility === 'trending' ? 'selected' : ''}>Trending</option>
                        <option value="new" ${window.catalogueState?.filters?.visibility === 'new' ? 'selected' : ''}>New Episode</option>
                    </select>
                    <select id="catalogue-filter-rating" class="input-field h-10 text-sm">
                        <option value="">Any rating</option>
                        <option value="8" ${window.catalogueState?.filters?.rating === '8' ? 'selected' : ''}>8+ rating</option>
                        <option value="7" ${window.catalogueState?.filters?.rating === '7' ? 'selected' : ''}>7+ rating</option>
                        <option value="5" ${window.catalogueState?.filters?.rating === '5' ? 'selected' : ''}>5+ rating</option>
                    </select>
                    <select id="catalogue-sort" class="input-field h-10 text-sm">
                        <option value="newest" ${window.catalogueState?.sortBy === 'newest' ? 'selected' : ''}>Sort: Newest</option>
                        <option value="oldest" ${window.catalogueState?.sortBy === 'oldest' ? 'selected' : ''}>Sort: Oldest</option>
                        <option value="title" ${window.catalogueState?.sortBy === 'title' ? 'selected' : ''}>Sort: Title A-Z</option>
                        <option value="title-desc" ${window.catalogueState?.sortBy === 'title-desc' ? 'selected' : ''}>Sort: Title Z-A</option>
                        <option value="rating" ${window.catalogueState?.sortBy === 'rating' ? 'selected' : ''}>Sort: Highest Rated</option>
                        <option value="views" ${window.catalogueState?.sortBy === 'views' ? 'selected' : ''}>Sort: Most Viewed</option>
                        <option value="episodes" ${window.catalogueState?.sortBy === 'episodes' ? 'selected' : ''}>Sort: Most Episodes</option>
                        <option value="recently-updated" ${window.catalogueState?.sortBy === 'recently-updated' ? 'selected' : ''}>Sort: Recently Updated</option>
                    </select>
                    <div class="flex items-center gap-2">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="catalogue-filter-recent" class="rounded border WHITE/20 bg-white/5 text-gold-400 focus:ring-gold-400/50" ${window.catalogueState?.filters?.recentlyUpdated ? 'checked' : ''}>
                            <span class="text-xs text-gray-400">Recent (7d)</span>
                        </label>
                    </div>
                </div>
                <div class="flex justify-end mt-3">
                    <button id="catalogue-filter-clear" type="button" class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-gray-500 hover:text-gold-400 transition-colors">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Reset filters
                    </button>
                </div>
            </section>

            ${contentHtml}
        `;
    }

    // Initialize catalogue UI
    function init() {
        window.renderCatalogueManagement = renderCatalogueManagement;
        window.handleSelectAll = handleSelectAll;
        
        // Expose action handlers (these will call existing functions)
        window.editAnime = function(id) {
            // Call existing edit functionality
            if (typeof window.editAdminAnime === 'function') {
                window.editAdminAnime(id);
            } else if (typeof window.showUploadModal === 'function') {
                window.showUploadModal('edit', id);
            }
        };
        
        window.manageEpisodes = function(id) {
            // Load anime data first, then call episode management
            // Match by both _id and clientId to handle different ID formats
            const anime = window.animeData?.find(a => 
                a?._id === id || 
                a?.id === id || 
                a?.clientId === id ||
                String(a?._id) === String(id) ||
                String(a?.clientId) === String(id)
            );
            
            if (anime) {
                // Set the current hub anime before opening episode management
                window.currentHubAnime = anime;
                console.log('Found anime for episode management:', anime.title, 'ID:', id);
                if (typeof window.uploadAdminEpisode === 'function') {
                    window.uploadAdminEpisode(id);
                } else if (typeof window.showUploadModal === 'function') {
                    window.showUploadModal('episode', id);
                }
            } else {
                console.error('Anime not found for ID:', id, 'Available anime:', window.animeData?.map(a => ({ id: a.id, _id: a._id, title: a.title })));
                alert('Anime not found. Please try refreshing the anime list.');
            }
        };
        
        window.deleteAnime = function(id) {
            // Call existing delete functionality
            if (typeof window.deleteAdminAnime === 'function') {
                window.deleteAdminAnime(id);
            }
        };
        
        window.previewAnime = function(id) {
            // Navigate to anime page - open in new tab
            // Match by both _id and clientId to handle different ID formats
            const anime = window.animeData?.find(a => 
                a?._id === id || 
                a?.id === id || 
                a?.clientId === id ||
                String(a?._id) === String(id) ||
                String(a?.clientId) === String(id)
            );
            
            if (anime) {
                // Use the client ID for navigation (this is what the frontend uses)
                const animeId = anime.clientId || anime.id || anime._id;
                console.log('Previewing anime:', anime.title, 'with ID:', animeId);
                window.open(`/anime/${animeId}`, '_blank');
            } else {
                console.error('Anime not found for preview. ID:', id);
                alert('Anime not found');
            }
        };
        
        window.duplicateAnime = function(id) {
            // Clone anime functionality
            // Match by both _id and clientId to handle different ID formats
            const anime = window.animeData?.find(a => 
                a?._id === id || 
                a?.id === id || 
                a?.clientId === id ||
                String(a?._id) === String(id) ||
                String(a?.clientId) === String(id)
            );
            
            if (anime) {
                const cloned = { ...anime, id: undefined, _id: undefined, clientId: undefined, title: anime.title + ' (Copy)' };
                if (window.saveAnimeToApi) {
                    window.saveAnimeToApi(cloned, false).then(() => {
                        if (window.loadAnimeFromApi) window.loadAnimeFromApi();
                        if (window.renderCatalogueManagement) window.renderCatalogueManagement();
                    });
                } else {
                    alert('Duplicate functionality requires animeManagement module');
                }
            } else {
                console.error('Anime not found for duplication. ID:', id);
                alert('Anime not found');
            }
        };
        
        window.showImportModal = function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.csv';
            input.onchange = (e) => {
                if (e.target.files[0]) {
                    window.importCatalogue(e.target.files[0]);
                }
            };
            input.click();
        };
        
        window.showBulkEditModal = function() {
            if (window.bulkEditModal && window.bulkEditModal.showBulkEditModal) {
                window.bulkEditModal.showBulkEditModal();
            } else {
                alert('Bulk edit modal coming soon');
            }
        };
    }

    const catalogueUI = {
        renderCatalogueManagement,
        init
    };

    window.catalogueUI = catalogueUI;

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
