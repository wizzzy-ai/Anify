(function () {
    'use strict';
    fetch('/api/announcements', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const item = data?.announcements?.[0];
            if (!item || sessionStorage.getItem(`anify-announcement-${item._id}`)) return;
            if (window.notificationService?.addNotification) {
                window.notificationService.addNotification({ id: `announcement-${item._id}`, type: String(item.type || 'announcement').replace('_', ' '), title: item.title, message: item.message, icon: 'megaphone', action: item.actionLabel ? { label: item.actionLabel, url: item.actionUrl } : null });
                if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();
            }
            const card = document.createElement('aside');
            card.className = 'fixed bottom-5 right-5 z-[9998] w-[min(28rem,calc(100vw-2.5rem))] overflow-hidden rounded-[1.35rem] border border-gold-400/35 bg-[#121022]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl';
            card.innerHTML = `<div class="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-gold-300 via-gold-500 to-amber-600"></div><div class="p-6"><button class="absolute right-4 top-3 text-lg text-gray-500 transition hover:text-white" aria-label="Dismiss">×</button><p class="text-xs font-black uppercase tracking-[0.16em] text-gold-400">${String(item.type || 'announcement').replace('_', ' ')}</p><h2 class="mt-4 pr-7 text-xl font-black leading-8 text-white">${item.title}</h2><p class="mt-3 text-[15px] leading-7 text-gray-300">${item.message}</p>${item.actionLabel ? `<button class="mt-6 rounded-xl bg-gradient-to-r from-gold-300 to-gold-500 px-5 py-3 text-sm font-black text-[#1b1100] shadow-lg shadow-gold-500/20 transition hover:-translate-y-0.5">${item.actionLabel}</button>` : ''}</div>`;
            card.querySelector('button').addEventListener('click', () => { sessionStorage.setItem(`anify-announcement-${item._id}`, '1'); card.remove(); });
            const action = card.querySelectorAll('button')[1];
            if (action && item.actionUrl?.startsWith('#anime-')) action.addEventListener('click', () => { card.remove(); window.navigate?.('anime', Number(item.actionUrl.replace('#anime-', ''))); });
            document.body.appendChild(card);
        }).catch(() => {});
})();
