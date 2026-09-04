(function (global) {
    'use strict';

    // Render bulk edit modal
    function renderBulkEditModal() {
        const genres = [...new Set((global.animeData || []).flatMap(a => Array.isArray(a?.genres) ? a.genres : []))]
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b)));

        return `
            <div id="bulk-edit-modal" class="hidden fixed inset-0 z-[100] items-center justify-center bg-black/70 p-4">
                <div class="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#141225] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <p class="text-xs font-bold uppercase tracking-[0.18em] text-gold-400">Bulk Edit</p>
                            <h2 class="mt-1 text-xl font-black">Edit Selected Titles</h2>
                            <p class="text-sm text-gray-500 mt-1">Modify ${global.catalogueState?.selectedAnime?.size || 0} titles at once</p>
                        </div>
                        <button type="button" onclick="global.closeBulkEditModal()" class="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Close">×</button>
                    </div>

                    <form id="bulk-edit-form" onsubmit="global.submitBulkEdit(event)">
                        <!-- Status -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-300 mb-2">Status</label>
                            <select name="status" class="input-field w-full">
                                <option value="">— Unchanged —</option>
                                <option value="Airing">Airing</option>
                                <option value="Ongoing">Ongoing</option>
                                <option value="Completed">Completed</option>
                                <option value="Upcoming">Upcoming</option>
                                <option value="Coming Soon">Coming Soon</option>
                            </select>
                        </div>

                        <!-- Type -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
                            <select name="type" class="input-field w-full">
                                <option value="">— Unchanged —</option>
                                <option value="anime">Series</option>
                                <option value="animated-movie">Animated Movie</option>
                                <option value="live-movie">Live Movie</option>
                            </select>
                        </div>

                        <!-- Genre -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-300 mb-2">Genre</label>
                            <select name="genre" class="input-field w-full">
                                <option value="">— Unchanged —</option>
                                ${genres.map(g => `<option value="${g}">${g}</option>`).join('')}
                            </select>
                            <p class="text-xs text-gray-500 mt-1">This will replace all existing genres</p>
                        </div>

                        <!-- Rating -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-300 mb-2">Rating</label>
                            <select name="rating" class="input-field w-full">
                                <option value="">— Unchanged —</option>
                                <option value="10">10 - Masterpiece</option>
                                <option value="9">9 - Great</option>
                                <option value="8">8 - Very Good</option>
                                <option value="7">7 - Good</option>
                                <option value="6">6 - Fine</option>
                                <option value="5">5 - Average</option>
                                <option value="4">4 - Poor</option>
                                <option value="3">3 - Bad</option>
                                <option value="2">2 - Terrible</option>
                                <option value="1">1 - Unwatchable</option>
                                <option value="0">0 - Not Rated</option>
                            </select>
                        </div>

                        <!-- Toggles -->
                        <div class="grid grid-cols-3 gap-4 mb-6">
                            <div>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="featured" class="rounded border-white/20 bg-white/5 text-gold-400 focus:ring-gold-400/50">
                                    <span class="text-sm text-gray-300">Featured</span>
                                </label>
                            </div>
                            <div>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="premium" class="rounded border-white/20 bg-white/5 text-gold-400 focus:ring-gold-400/50">
                                    <span class="text-sm text-gray-300">Premium</span>
                                </label>
                            </div>
                            <div>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="trending" class="rounded border-white/20 bg-white/5 text-gold-400 focus:ring-gold-400/50">
                                    <span class="text-sm text-gray-300">Trending</span>
                                </label>
                            </div>
                        </div>

                        <!-- Collection -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-300 mb-2">Add to Collection</label>
                            <select name="collection" class="input-field w-full">
                                <option value="">— No Collection —</option>
                                <option value="trending">Trending Now</option>
                                <option value="featured">Featured</option>
                                <option value="new">Recently Added</option>
                                <option value="popular">Popular</option>
                            </select>
                        </div>

                        <div class="flex justify-end gap-3">
                            <button type="button" onclick="global.closeBulkEditModal()" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10">Cancel</button>
                            <button type="submit" class="rounded-xl bg-gold-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-gold-300">Apply Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    // Show bulk edit modal
    function showBulkEditModal() {
        const selectedCount = global.catalogueState?.selectedAnime?.size || 0;
        if (selectedCount === 0) {
            alert('Please select at least one title to edit');
            return;
        }

        // Remove existing modal if present
        const existingModal = document.getElementById('bulk-edit-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', renderBulkEditModal());
        document.getElementById('bulk-edit-modal').classList.remove('hidden');
        document.getElementById('bulk-edit-modal').classList.add('flex');
    }

    // Close bulk edit modal
    function closeBulkEditModal() {
        const modal = document.getElementById('bulk-edit-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Submit bulk edit
    async function submitBulkEdit(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        const updates = {};
        
        // Only include fields that have values
        if (formData.get('status')) updates.status = formData.get('status');
        if (formData.get('type')) updates.type = formData.get('type');
        if (formData.get('genre')) updates.genres = [formData.get('genre')];
        if (formData.get('rating')) updates.rating = Number(formData.get('rating'));
        
        // Handle checkboxes (only update if explicitly checked)
        if (formData.get('featured') === 'on') updates.featured = true;
        if (formData.get('premium') === 'on') updates.premium = true;
        if (formData.get('trending') === 'on') updates.trending = true;
        
        const collection = formData.get('collection');
        if (collection) {
            if (collection === 'trending') updates.trending = true;
            if (collection === 'featured') updates.featured = true;
            if (collection === 'new') updates.newEpisode = true;
        }

        if (Object.keys(updates).length === 0) {
            alert('Please select at least one field to update');
            return;
        }

        const selectedIds = Array.from(global.catalogueState?.selectedAnime || []);
        const token = global.authService?.getToken?.();
        
        if (!token) {
            alert('Authentication required');
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
            try {
                const res = await fetch(`/api/anime/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updates)
                });

                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error('Bulk edit failed for:', id, e);
                failCount++;
            }
        }

        closeBulkEditModal();
        alert(`Bulk edit complete: ${successCount} updated, ${failCount} failed`);
        
        // Clear selection and reload
        window.clearSelection();
        
        if (window.loadAnimeFromApi) {
            await window.loadAnimeFromApi();
        }
        if (window.renderCatalogueManagement) {
            window.renderCatalogueManagement();
        }
    }

    // Initialize bulk edit modal
    function init() {
        window.showBulkEditModal = showBulkEditModal;
        window.closeBulkEditModal = closeBulkEditModal;
        window.submitBulkEdit = submitBulkEdit;
    }

    const bulkEditModal = {
        init,
        showBulkEditModal,
        closeBulkEditModal,
        submitBulkEdit
    };

    window.bulkEditModal = bulkEditModal;

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
