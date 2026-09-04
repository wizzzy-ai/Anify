(function (global) {
    'use strict';

    let draggedItem = null;
    let draggedCollectionId = null;

    // Initialize drag and drop for a collection
    function initDragDrop(collectionId, containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        const items = container.querySelectorAll('[data-draggable-anime]');
        
        items.forEach(item => {
            item.setAttribute('draggable', 'true');
            
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragenter', handleDragEnter);
            item.addEventListener('dragleave', handleDragLeave);
        });

        draggedCollectionId = collectionId;
    }

    function handleDragStart(e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.draggableAnime);
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('[data-draggable-anime]').forEach(item => {
            item.classList.remove('drag-over');
        });
        draggedItem = null;
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        if (this !== draggedItem) {
            this.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (draggedItem !== this) {
            // Get all items in the container
            const container = this.closest('[data-drag-container]');
            const items = Array.from(container.querySelectorAll('[data-draggable-anime]'));
            
            // Get current order
            const currentOrder = items.map(item => item.dataset.draggableAnime);
            
            // Get dragged item ID and target item ID
            const draggedId = draggedItem.dataset.draggableAnime;
            const targetId = this.dataset.draggableAnime;
            
            // Reorder array
            const draggedIndex = currentOrder.indexOf(draggedId);
            const targetIndex = currentOrder.indexOf(targetId);
            
            if (draggedIndex > -1 && targetIndex > -1) {
                currentOrder.splice(draggedIndex, 1);
                currentOrder.splice(targetIndex, 0, draggedId);
                
                // Update DOM
                items.forEach((item, index) => {
                    const newId = currentOrder[index];
                    const matchingItem = items.find(i => i.dataset.draggableAnime === newId);
                    if (matchingItem) {
                        container.appendChild(matchingItem);
                    }
                });

                // Save new order to server
                saveCollectionOrder(draggedCollectionId, currentOrder);
            }
        }

        return false;
    }

    // Save collection order to server
    async function saveCollectionOrder(collectionId, animeIds) {
        const token = window.authService?.getToken?.();
        if (!token) {
            console.warn('No auth token for saving collection order');
            return;
        }

        try {
            const res = await fetch(`/api/admin/collections/${collectionId}/reorder`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ animeIds })
            });

            if (res.ok) {
                console.log('Collection order saved successfully');
                if (window.showToast) {
                    window.showToast('Collection order updated');
                }
            } else {
                console.error('Failed to save collection order');
            }
        } catch (error) {
            console.error('Error saving collection order:', error);
        }
    }

    // Initialize drag and drop for catalogue items
    function initCatalogueDragDrop() {
        const container = document.querySelector('[data-catalogue-grid]');
        if (!container) return;

        // This can be used for future drag-and-drop features
        // For now, collections have their own drag-drop
    }

    function init() {
        window.initDragDrop = initDragDrop;
        window.initCatalogueDragDrop = initCatalogueDragDrop;
    }

    const dragDropManager = {
        init,
        initDragDrop,
        initCatalogueDragDrop
    };

    window.dragDropManager = dragDropManager;

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
