(function (global) {
    'use strict';

    // Catalogue Management State
    const catalogueState = {
        selectedAnime: new Set(),
        viewMode: 'table', // 'table', 'poster', 'compact'
        filters: {
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
        },
        sortBy: 'newest',
        collections: [],
        draggedAnime: null
    };

    // Load saved preferences
    function loadPreferences() {
        try {
            const saved = localStorage.getItem('anify-catalogue-preferences');
            if (saved) {
                const prefs = JSON.parse(saved);
                catalogueState.viewMode = prefs.viewMode || 'table';
                catalogueState.sortBy = prefs.sortBy || 'newest';
            }
        } catch (e) {
            console.warn('Failed to load catalogue preferences:', e);
        }
    }

    // Save preferences
    function savePreferences() {
        try {
            localStorage.setItem('anify-catalogue-preferences', JSON.stringify({
                viewMode: catalogueState.viewMode,
                sortBy: catalogueState.sortBy
            }));
        } catch (e) {
            console.warn('Failed to save catalogue preferences:', e);
        }
    }

    // Get catalogue statistics
    function getCatalogueStats(animeList) {
        const list = Array.isArray(animeList) ? animeList : [];
        return {
            total: list.length,
            series: list.filter(a => (a?.type || 'anime') === 'anime').length,
            movies: list.filter(a => a?.type && a.type !== 'anime').length,
            ongoing: list.filter(a => a?.status === 'Ongoing' || a?.status === 'Airing').length,
            completed: list.filter(a => a?.status === 'Completed').length,
            comingSoon: list.filter(a => a?.status === 'Coming Soon' || a?.status === 'Upcoming').length,
            featured: list.filter(a => a?.featured).length,
            premium: list.filter(a => a?.premium).length,
            trending: list.filter(a => a?.trending).length
        };
    }

    // Filter and sort anime
    function filterAndSortAnime(animeList) {
        let filtered = Array.isArray(animeList) ? animeList : [];

        // Search filter
        if (catalogueState.filters.search) {
            const searchLower = catalogueState.filters.search.toLowerCase();
            filtered = filtered.filter(a => {
                const searchable = [
                    a?.title,
                    a?.titleJp,
                    a?.id,
                    a?.clientId,
                    a?.studio,
                    a?.year,
                    a?.desc,
                    a?.status,
                    ...(Array.isArray(a?.genres) ? a.genres : [])
                ].filter(Boolean).join(' ').toLowerCase();
                return searchable.includes(searchLower);
            });
        }

        // Status filter
        if (catalogueState.filters.status) {
            filtered = filtered.filter(a => {
                if (catalogueState.filters.status === 'ongoing') {
                    return a?.status === 'Ongoing' || a?.status === 'Airing';
                }
                if (catalogueState.filters.status === 'coming-soon') {
                    return a?.status === 'Coming Soon' || a?.status === 'Upcoming';
                }
                return a?.status === catalogueState.filters.status;
            });
        }

        // Type filter
        if (catalogueState.filters.type) {
            filtered = filtered.filter(a => catalogueState.filters.type === 'movie'
                ? a?.type && a.type !== 'anime'
                : a?.type === catalogueState.filters.type);
        }

        // Genre filter
        if (catalogueState.filters.genre) {
            filtered = filtered.filter(a => 
                Array.isArray(a?.genres) && a.genres.includes(catalogueState.filters.genre)
            );
        }

        // Rating filter
        if (catalogueState.filters.rating) {
            const minRating = Number(catalogueState.filters.rating);
            filtered = filtered.filter(a => {
                const rating = Number(a?.averageRating || a?.rating || 0);
                return rating >= minRating;
            });
        }

        // Year filter
        if (catalogueState.filters.year) {
            filtered = filtered.filter(a => a?.year === Number(catalogueState.filters.year));
        }

        // Visibility filter
        if (catalogueState.filters.visibility) {
            filtered = filtered.filter(a => {
                switch (catalogueState.filters.visibility) {
                    case 'featured': return a?.featured;
                    case 'premium': return a?.premium;
                    case 'trending': return a?.trending;
                    case 'new': return a?.newEpisode;
                    default: return true;
                }
            });
        }

        // Episode count filters
        if (catalogueState.filters.minEpisodes) {
            const min = Number(catalogueState.filters.minEpisodes);
            filtered = filtered.filter(a => {
                const episodes = Array.isArray(a?.episodesMedia) ? a.episodesMedia.length : Number(a?.episodes || 0);
                return episodes >= min;
            });
        }

        if (catalogueState.filters.maxEpisodes) {
            const max = Number(catalogueState.filters.maxEpisodes);
            filtered = filtered.filter(a => {
                const episodes = Array.isArray(a?.episodesMedia) ? a.episodesMedia.length : Number(a?.episodes || 0);
                return episodes <= max;
            });
        }

        // Recently updated filter (last 7 days)
        if (catalogueState.filters.recentlyUpdated) {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(a => {
                const updatedAt = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
                return updatedAt >= sevenDaysAgo;
            });
        }

        // Sorting
        filtered.sort((a, b) => {
            switch (catalogueState.sortBy) {
                case 'newest':
                    return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
                case 'oldest':
                    return new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime();
                case 'title':
                    return String(a?.title || '').localeCompare(String(b?.title || ''));
                case 'title-desc':
                    return String(b?.title || '').localeCompare(String(a?.title || ''));
                case 'rating':
                    return (Number(b?.averageRating || b?.rating || 0)) - (Number(a?.averageRating || a?.rating || 0));
                case 'views':
                    return (Number(b?.views || 0)) - (Number(a?.views || 0));
                case 'episodes':
                    const episodesA = Array.isArray(a?.episodesMedia) ? a.episodesMedia.length : Number(a?.episodes || 0);
                    const episodesB = Array.isArray(b?.episodesMedia) ? b.episodesMedia.length : Number(b?.episodes || 0);
                    return episodesB - episodesA;
                case 'recently-updated':
                    return new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime();
                default:
                    return 0;
            }
        });

        return filtered;
    }

    // Toggle anime selection
    function toggleSelection(animeId) {
        if (catalogueState.selectedAnime.has(animeId)) {
            catalogueState.selectedAnime.delete(animeId);
        } else {
            catalogueState.selectedAnime.add(animeId);
        }
        updateSelectionUI();
    }

    // Select all visible anime
    function selectAllVisible(visibleIds) {
        visibleIds.forEach(id => catalogueState.selectedAnime.add(id));
        updateSelectionUI();
    }

    // Clear all selections
    function clearSelection() {
        catalogueState.selectedAnime.clear();
        updateSelectionUI();
    }

    // Update selection UI
    function updateSelectionUI() {
        const checkboxes = document.querySelectorAll('[data-catalogue-checkbox]');
        checkboxes.forEach(cb => {
            const id = cb.dataset.catalogueCheckbox;
            cb.checked = catalogueState.selectedAnime.has(id);
        });

        const selectAllCheckbox = document.querySelector('[data-select-all-checkbox]');
        if (selectAllCheckbox) {
            const visibleIds = Array.from(document.querySelectorAll('[data-catalogue-checkbox]'))
                .map(cb => cb.dataset.catalogueCheckbox);
            const allSelected = visibleIds.length > 0 && visibleIds.every(id => catalogueState.selectedAnime.has(id));
            selectAllCheckbox.checked = allSelected;
        }

        const bulkToolbar = document.querySelector('[data-bulk-toolbar]');
        const selectedCount = document.querySelector('[data-selected-count]');
        
        if (bulkToolbar) {
            if (catalogueState.selectedAnime.size > 0) {
                bulkToolbar.classList.remove('hidden');
            } else {
                bulkToolbar.classList.add('hidden');
            }
        }
        
        if (selectedCount) {
            selectedCount.textContent = `${catalogueState.selectedAnime.size} selected`;
        }
    }

    // Set view mode
    function setViewMode(mode) {
        catalogueState.viewMode = mode;
        savePreferences();
        
        // Update view mode buttons
        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.classList.remove('bg-gold-400/20', 'text-gold-400');
            btn.classList.add('text-gray-400');
            if (btn.dataset.viewMode === mode) {
                btn.classList.add('bg-gold-400/20', 'text-gold-400');
                btn.classList.remove('text-gray-400');
            }
        });

        // Re-render catalogue
        const adminContent = document.getElementById('admin-content');
        if (window.renderCatalogueManagement && adminContent) {
            adminContent.innerHTML = window.renderCatalogueManagement();
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
            if (window.bindCatalogueActions) {
                window.bindCatalogueActions();
            }
        }
    }

    // Export functionality
    async function exportCatalogue(format = 'json', selectedOnly = false) {
        const animeList = selectedOnly 
            ? (window.animeData || []).filter(a => catalogueState.selectedAnime.has(a?.id))
            : (window.animeData || []);

        if (animeList.length === 0) {
            alert('No anime to export');
            return;
        }

        let content, filename, mimeType;

        if (format === 'json') {
            content = JSON.stringify(animeList, null, 2);
            filename = `anify-catalogue-${new Date().toISOString().split('T')[0]}.json`;
            mimeType = 'application/json';
        } else if (format === 'csv') {
            const headers = ['id', 'title', 'titleJp', 'type', 'status', 'year', 'studio', 'rating', 'genres', 'episodes', 'featured', 'premium', 'trending'];
            const rows = animeList.map(a => [
                a?.id || '',
                `"${(a?.title || '').replace(/"/g, '""')}"`,
                `"${(a?.titleJp || '').replace(/"/g, '""')}"`,
                a?.type || 'anime',
                a?.status || '',
                a?.year || '',
                `"${(a?.studio || '').replace(/"/g, '""')}"`,
                a?.averageRating || a?.rating || 0,
                `"${(Array.isArray(a?.genres) ? a.genres.join('; ') : '').replace(/"/g, '""')}"`,
                Array.isArray(a?.episodesMedia) ? a.episodesMedia.length : (a?.episodes || 0),
                a?.featured ? 'Yes' : 'No',
                a?.premium ? 'Yes' : 'No',
                a?.trending ? 'Yes' : 'No'
            ]);
            content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            filename = `anify-catalogue-${new Date().toISOString().split('T')[0]}.csv`;
            mimeType = 'text/csv';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    // Import functionality
    async function importCatalogue(file) {
        if (!file) return;

        const content = await file.text();
        let data;

        try {
            if (file.name.endsWith('.json')) {
                data = JSON.parse(content);
            } else if (file.name.endsWith('.csv')) {
                // Simple CSV parsing
                const lines = content.split('\n').filter(l => l.trim());
                const headers = lines[0].split(',');
                data = lines.slice(1).map(line => {
                    const values = line.split(',');
                    const obj = {};
                    headers.forEach((h, i) => {
                        obj[h.trim()] = values[i]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
                    });
                    return obj;
                });
            } else {
                throw new Error('Unsupported file format');
            }
        } catch (e) {
            alert('Failed to parse file: ' + e.message);
            return;
        }

        if (!Array.isArray(data) || data.length === 0) {
            alert('No data found in file');
            return;
        }

        // Show preview
        showImportPreview(data);
    }

    // Show import preview
    function showImportPreview(data) {
        const existingAnime = window.animeData || [];
        const newTitles = [];
        const existingTitles = [];
        const updateTitles = [];
        const invalidRows = [];

        data.forEach((item, index) => {
            if (!item.title) {
                invalidRows.push({ index, reason: 'Missing title' });
                return;
            }

            const existing = existingAnime.find(a => 
                a?.title === item.title || 
                a?.id === item.id ||
                a?.clientId === item.id
            );

            if (existing) {
                existingTitles.push({ title: item.title, existingId: existing.id });
            } else {
                newTitles.push({ title: item.title });
            }
        });

        const previewHtml = `
            <div class="fixed inset-0 z-[100] items-center justify-center bg-black/70 p-4" id="import-preview-modal">
                <div class="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#141225] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <p class="text-xs font-bold uppercase tracking-[0.18em] text-gold-400">Import Preview</p>
                            <h2 class="mt-1 text-xl font-black">Review Import Data</h2>
                        </div>
                        <button type="button" onclick="document.getElementById('import-preview-modal').remove()" class="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white">×</button>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="p-4 rounded-xl bg-green-400/10 border border-green-400/20">
                            <p class="text-2xl font-black text-green-400">${newTitles.length}</p>
                            <p class="text-xs text-gray-400">New titles</p>
                        </div>
                        <div class="p-4 rounded-xl bg-blue-400/10 border border-blue-400/20">
                            <p class="text-2xl font-black text-blue-400">${existingTitles.length}</p>
                            <p class="text-xs text-gray-400">Existing titles</p>
                        </div>
                    </div>

                    ${invalidRows.length > 0 ? `
                        <div class="mb-4 p-4 rounded-xl bg-red-400/10 border border-red-400/20">
                            <p class="text-sm font-semibold text-red-400 mb-2">${invalidRows.length} invalid rows</p>
                            <div class="max-h-32 overflow-y-auto text-xs text-gray-400">
                                ${invalidRows.slice(0, 10).map(r => `Row ${r.index + 1}: ${r.reason}`).join('<br>')}
                                ${invalidRows.length > 10 ? `<br>...and ${invalidRows.length - 10} more` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <div class="flex justify-end gap-3">
                        <button type="button" onclick="document.getElementById('import-preview-modal').remove()" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10">Cancel</button>
                        <button type="button" onclick="window.executeImport()" class="rounded-xl bg-gold-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-gold-300">Import ${newTitles.length} New Titles</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', previewHtml);
        
        // Store data for execution
        window.importData = data;
    }

    // Execute import
    async function executeImport() {
        const data = window.importData || [];
        const existingAnime = window.animeData || [];
        let successCount = 0;
        let failCount = 0;

        for (const item of data) {
            if (!item.title) continue;

            const existing = existingAnime.find(a => 
                a?.title === item.title || 
                a?.id === item.id
            );

            if (existing) continue; // Skip existing

            try {
                const token = window.authService?.getToken?.();
                if (!token) {
                    console.warn('No auth token, importing locally only');
                    break;
                }

                const animePayload = {
                    title: item.title,
                    titleJp: item.titleJp || '',
                    type: item.type || 'anime',
                    status: item.status || 'Airing',
                    year: item.year ? Number(item.year) : undefined,
                    studio: item.studio || '',
                    genres: item.genres ? item.genres.split(';').map(g => g.trim()) : [],
                    rating: item.rating ? Number(item.rating) : 0,
                    episodes: item.episodes ? Number(item.episodes) : 1,
                    featured: item.featured === 'Yes' || item.featured === true,
                    premium: item.premium === 'Yes' || item.premium === true,
                    trending: item.trending === 'Yes' || item.trending === true
                };

                const res = await fetch('/api/anime', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(animePayload)
                });

                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error('Import failed for:', item.title, e);
                failCount++;
            }
        }

        document.getElementById('import-preview-modal')?.remove();
        alert(`Import complete: ${successCount} added, ${failCount} failed`);
        
        // Reload anime data
        if (window.loadAnimeFromApi) {
            await window.loadAnimeFromApi();
        }
        if (window.renderCatalogueManagement) {
            window.renderCatalogueManagement();
        }
    }

    // Bulk delete
    async function bulkDelete() {
        const selectedIds = Array.from(catalogueState.selectedAnime);
        if (selectedIds.length === 0) return;

        if (!confirm(`Delete ${selectedIds.length} selected titles? This action cannot be undone.`)) {
            return;
        }

        const token = window.authService?.getToken?.();
        if (!token) {
            alert('Authentication required');
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
            try {
                const res = await fetch(`/api/anime/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error('Delete failed for:', id, e);
                failCount++;
            }
        }

        alert(`Delete complete: ${successCount} deleted, ${failCount} failed`);
        clearSelection();
        
        // Reload anime data
        if (window.loadAnimeFromApi) {
            await window.loadAnimeFromApi();
        }
        if (window.renderCatalogueManagement) {
            window.renderCatalogueManagement();
        }
    }

    function setCatalogueStatFilter(stat) {
        const filters = catalogueState.filters;
        filters.search = '';
        filters.status = '';
        filters.type = '';
        filters.genre = '';
        filters.rating = '';
        filters.year = '';
        filters.visibility = '';
        filters.minEpisodes = '';
        filters.maxEpisodes = '';
        filters.recentlyUpdated = false;

        if (stat === 'series') filters.type = 'anime';
        if (stat === 'movie') filters.type = 'movie';
        if (stat === 'ongoing') filters.status = 'ongoing';
        if (stat === 'coming-soon') filters.status = 'coming-soon';

        if (window.renderCatalogueManagement && document.getElementById('admin-content')) {
            document.getElementById('admin-content').innerHTML = window.renderCatalogueManagement();
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
            if (window.bindCatalogueActions) window.bindCatalogueActions();
        }
    }

    global.setCatalogueStatFilter = setCatalogueStatFilter;

    // Initialize catalogue management
    function init() {
        loadPreferences();
        window.catalogueState = catalogueState;
        window.toggleSelection = toggleSelection;
        window.selectAllVisible = selectAllVisible;
        window.clearSelection = clearSelection;
        window.setViewMode = setViewMode;
        window.exportCatalogue = exportCatalogue;
        window.importCatalogue = importCatalogue;
        window.executeImport = executeImport;
        window.bulkDelete = bulkDelete;
        window.getCatalogueStats = getCatalogueStats;
        window.filterAndSortAnime = filterAndSortAnime;
    }

    const catalogueManagement = {
        init,
        catalogueState,
        getCatalogueStats,
        filterAndSortAnime,
        toggleSelection,
        setViewMode,
        exportCatalogue,
        importCatalogue
    };

    window.catalogueManagement = catalogueManagement;

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
