(function () {
    'use strict';

    let maintenanceModeEnabled = false;

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
        screen.className = 'fixed inset-0 z-[10000] isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#06050b] px-5 py-10 text-center';
        screen.innerHTML = `
            <div class="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat scale-105" style="background-image: url('/pictures/ANIME.jpg');"></div>
            <div class="absolute inset-0 -z-10 bg-gradient-to-br from-[#05030b]/95 via-[#090514]/85 to-[#050509]/95"></div>
            <div class="absolute -left-32 top-[-8rem] -z-10 h-80 w-80 rounded-full bg-gold-400/20 blur-3xl"></div>
            <div class="absolute -bottom-28 -right-20 -z-10 h-96 w-96 rounded-full bg-purple-600/25 blur-3xl"></div>
            <main class="w-full max-w-lg rounded-[2rem] border border-white/15 bg-[#100d1b]/70 p-7 shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-10">
                <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-gold-300">
                    <span class="h-2 w-2 rounded-full bg-gold-400 animate-pulse"></span>
                    Scheduled maintenance
                </div>
                <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-300/40 bg-gradient-to-br from-gold-300 to-gold-500 text-3xl font-black text-[#1b1100] shadow-lg shadow-gold-500/25">A</div>
                <h1 class="text-3xl font-black tracking-tight text-white sm:text-4xl">We’ll be right back</h1>
                <p class="mx-auto mt-4 max-w-sm text-sm leading-6 text-gray-300 sm:text-base">We&rsquo;re making a few improvements to give you a better anime experience. Please check back soon.</p>
                <div class="my-7 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <button id="maintenance-login-button" class="w-full rounded-xl bg-gradient-to-r from-gold-300 to-gold-500 px-5 py-3.5 font-bold text-[#1b1100] shadow-lg shadow-gold-500/20 transition duration-200 hover:-translate-y-0.5 hover:from-gold-200 hover:to-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-300 focus:ring-offset-2 focus:ring-offset-[#100d1b]">
                    Return to Login Page
                </button>
                <p class="mt-4 text-xs text-gray-400">Administrators can sign in to manage the platform.</p>
            </main>`;
        document.body.appendChild(screen);

        document.getElementById('maintenance-login-button')?.addEventListener('click', () => {
            screen.remove();
            if (typeof window.navigate === 'function') window.navigate('login');
        });
    }

    function enforceMaintenanceMode() {
        if (maintenanceModeEnabled && !isAdminSession()) showMaintenanceScreen();
    }

    // Visitors can reach the login screen, but regular accounts are blocked
    // again as soon as they sign in or try to navigate anywhere else.
    window.addEventListener('authChanged', enforceMaintenanceMode);

    window.addEventListener('load', () => {
        const originalNavigate = window.navigate;
        if (typeof originalNavigate !== 'function') return;

        window.navigate = function (page, ...args) {
            const result = originalNavigate.call(this, page, ...args);
            if (page !== 'login') setTimeout(enforceMaintenanceMode, 0);
            return result;
        };
    });

    fetch('/api/platform-settings', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(settings => {
            maintenanceModeEnabled = settings?.maintenanceMode === true;
            enforceMaintenanceMode();
        })
        .catch(() => {});

    // Update all open tabs immediately when an admin toggles the setting.
    if (typeof EventSource !== 'undefined') {
        const stream = new EventSource('/api/platform-settings/stream');
        stream.onmessage = (event) => {
            try {
                const settings = JSON.parse(event.data);
                maintenanceModeEnabled = settings?.maintenanceMode === true;
                enforceMaintenanceMode();
            } catch (error) {
                console.warn('Invalid maintenance-mode update:', error);
            }
        };
    }
})();
