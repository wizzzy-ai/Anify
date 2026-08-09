(function () {
    'use strict';

    function isAdminSession() {
        try {
            const user = JSON.parse(localStorage.getItem('anify-user-profile') || 'null');
            const roles = user?.roles || [];
            return Array.isArray(roles) && (roles.includes('admin') || roles.includes('moderator') || roles.includes('shield'));
        } catch {
            return false;
        }
    }

    function showMaintenanceScreen() {
        if (document.getElementById('maintenance-screen')) return;
        const screen = document.createElement('div');
        screen.id = 'maintenance-screen';
        screen.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-dark-900 px-6 text-center';
        screen.innerHTML = `
            <div class="max-w-md">
                <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-400 text-3xl font-black text-black">A</div>
                <h1 class="text-3xl font-black text-white">We’ll be right back</h1>
                <p class="mt-3 text-gray-400">Anify is temporarily offline for maintenance. Please check back soon.</p>
            </div>`;
        document.body.appendChild(screen);
    }

    fetch('/api/platform-settings')
        .then(response => response.ok ? response.json() : null)
        .then(settings => {
            if (settings?.maintenanceMode === true && !isAdminSession()) showMaintenanceScreen();
        })
        .catch(() => {});
})();
