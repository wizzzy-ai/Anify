(function () {
    const manager = {
        scrollTriggers: [],
        cleanups: [],
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
        isDesktop: window.matchMedia?.('(hover: hover) and (pointer: fine)').matches || false,
        refresh(page) {
            this.destroy();
            if (!window.gsap) return;
            if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
            if (page === 'home' && window.AnifyHeroAnimations) window.AnifyHeroAnimations(this);
            if ((page === 'home' || page === 'browse' || page === 'movies' || page === 'series' || page === 'anime') && window.AnifyScrollAnimations) window.AnifyScrollAnimations(this);
            if ((page === 'home' || page === 'browse' || page === 'movies' || page === 'series' || page === 'anime') && window.AnifyCardAnimations) window.AnifyCardAnimations(this);
            if (window.AnifyPageTransitions) window.AnifyPageTransitions(this);
            if (window.ScrollTrigger) ScrollTrigger.refresh();
        },
        destroy() {
            window.AnifyFluidImageReveal?.destroyAll?.();
            this.scrollTriggers.forEach(trigger => trigger.kill());
            this.scrollTriggers = [];
            this.cleanups.forEach(cleanup => cleanup());
            this.cleanups = [];
            if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        }
    };

    window.AnifyAnimationManager = manager;
})();
