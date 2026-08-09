(function () {
    'use strict';
    fetch('/api/announcements', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const item = data?.announcements?.[0];
            if (!item || sessionStorage.getItem(`anify-announcement-${item._id}`)) return;
            const card = document.createElement('aside');
            card.className = 'fixed bottom-5 right-5 z-[9998] w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-gold-400/25 bg-[#141225]/95 p-5 shadow-2xl backdrop-blur-xl';
            card.innerHTML = `<button class="absolute right-3 top-2 text-gray-400 hover:text-white" aria-label="Dismiss">×</button><p class="text-xs font-bold uppercase tracking-widest text-gold-400">${String(item.type || 'announcement').replace('_', ' ')}</p><h2 class="mt-2 text-lg font-black text-white">${item.title}</h2><p class="mt-2 text-sm leading-6 text-gray-300">${item.message}</p>${item.actionLabel ? `<button class="mt-4 rounded-lg bg-gold-400 px-4 py-2 text-sm font-bold text-black">${item.actionLabel}</button>` : ''}`;
            card.querySelector('button').addEventListener('click', () => { sessionStorage.setItem(`anify-announcement-${item._id}`, '1'); card.remove(); });
            const action = card.querySelectorAll('button')[1];
            if (action && item.actionUrl?.startsWith('#anime-')) action.addEventListener('click', () => { card.remove(); window.navigate?.('anime', Number(item.actionUrl.replace('#anime-', ''))); });
            document.body.appendChild(card);
        }).catch(() => {});
})();
