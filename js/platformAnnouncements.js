(function () {
    'use strict';
    const plainText = (value) => String(value || '')
        .replace(/#{1,6}\s*/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`/g, '')
        .replace(/[*#_]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const escapeHtml = (value) => plainText(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
    fetch('/api/announcements', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const item = data?.announcements?.[0];
            if (!item || sessionStorage.getItem(`anify-announcement-${item._id}`)) return;
            const title = escapeHtml(item.title);
            const message = escapeHtml(item.message).replace(/\.\s+/g, '.<br><br>');
            if (window.notificationService?.addNotification) {
                window.notificationService.addNotification({ id: `announcement-${item._id}`, type: String(item.type || 'announcement').replace('_', ' '), title: plainText(item.title), message: plainText(item.message), icon: 'megaphone', action: item.actionLabel ? { label: item.actionLabel, url: item.actionUrl } : null });
                if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();
            }
            const card = document.createElement('aside');
            card.className = 'announcement-popup fixed bottom-5 right-5 z-[9998] w-[min(28rem,calc(100vw-2.5rem))] overflow-hidden rounded-[1.35rem] backdrop-blur-xl';
            card.setAttribute('role', 'status');
            card.innerHTML = `<div class="announcement-popup__accent"></div><div class="announcement-popup__body"><button class="announcement-popup-close" aria-label="Dismiss announcement">×</button><p class="announcement-popup__eyebrow">${escapeHtml(String(item.type || 'announcement').replace('_', ' '))}</p><h2 class="announcement-popup-title">${title}</h2><p class="announcement-popup-message">${message}</p>${item.actionLabel ? `<button class="announcement-popup-action">${escapeHtml(item.actionLabel)}</button>` : ''}</div>`;
            card.querySelector('button').addEventListener('click', () => { sessionStorage.setItem(`anify-announcement-${item._id}`, '1'); card.remove(); });
            const action = card.querySelectorAll('button')[1];
            if (action && item.actionUrl?.startsWith('#anime-')) action.addEventListener('click', () => { card.remove(); window.navigate?.('anime', Number(item.actionUrl.replace('#anime-', ''))); });
            document.body.appendChild(card);
        }).catch(() => {});
})();
