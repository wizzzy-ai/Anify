(function () {
    function pageTransitions(manager) {
        const navbar = document.querySelector('#navbar');
        if (navbar) {
            const onScroll = () => navbar.classList.toggle('is-scrolled', window.scrollY > 24);
            onScroll();
            window.addEventListener('scroll', onScroll, { passive: true });
            manager.cleanups.push(() => window.removeEventListener('scroll', onScroll));
        }

        const panel = document.querySelector('#search-panel');
        if (panel && manager.reducedMotion) return;
        if (panel && panel.classList.contains('hidden')) {
            gsap.set(panel, { opacity: 0, y: -10, scale: 0.98 });
        }
    }

    window.AnifyPageTransitions = pageTransitions;
})();
