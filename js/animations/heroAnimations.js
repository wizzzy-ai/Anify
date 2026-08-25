(function () {
    function heroAnimations(manager) {
        const hero = document.querySelector('.hero-banner');
        const media = document.querySelector('.hero-media');
        const content = document.querySelector('#home-hero-content');
        if (!hero || !media || !content) return;

        const mediaVisual = media.querySelector('img, video');
        const title = content.querySelector('.hero-title');
        const description = content.querySelector('.hero-description');
        const genres = content.querySelectorAll('.category-pill');
        const actions = content.querySelector('.hero-actions');
        const trending = document.querySelector('.home-section--trending');
        const trendingHeading = trending?.querySelector('.home-section-head');
        const trendingCards = trending?.querySelectorAll('.trending-reveal-card');

        if (manager.reducedMotion) {
            gsap.set([mediaVisual, '.hero-overlay', '.hero-bottom-overlay', content, trending, trendingHeading, trendingCards], { opacity: 1, clearProps: 'all' });
            if (mediaVisual) window.AnifyFluidImageReveal?.reveal(media);
            return;
        }

        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

        const fluidReveal = window.AnifyFluidImageReveal;
        if (mediaVisual && !fluidReveal?.canReveal(mediaVisual)) {
            timeline.fromTo(mediaVisual, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 1.2 }, 0);
        }
        if (mediaVisual && fluidReveal?.canReveal(mediaVisual)) fluidReveal.reveal(media);
        timeline.fromTo('.hero-overlay', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.1);
        timeline.fromTo('.hero-bottom-overlay', { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0.18);
        timeline.fromTo('.hero-light-sweep', { xPercent: -120, opacity: 0 }, { xPercent: 120, opacity: 0.42, duration: 0.95, ease: 'power2.inOut' }, 0.32);
        timeline.fromTo([content.querySelector('.hero-meta'), title, content.querySelector('.hero-jp')], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.48);
        timeline.fromTo(description, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55 }, '>-0.35');
        timeline.fromTo(genres, { opacity: 0, y: 15, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.08 }, '>-0.28');
        timeline.fromTo(actions, { opacity: 0, y: 20, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5 }, '>-0.2');
        timeline.to('.hero-watch-now', { boxShadow: '0 0 24px color-mix(in srgb, var(--primary) 28%, transparent)', duration: 0.28, yoyo: true, repeat: 1 }, '>-0.05');
        if (trending) {
            timeline.fromTo(trending, { opacity: 0, y: manager.isDesktop ? 40 : 22 }, { opacity: 1, y: 0, duration: 0.65 }, '>-0.05');
            timeline.fromTo(trendingHeading, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '>-0.28');
            timeline.fromTo(trendingCards, { opacity: 0, y: manager.isDesktop ? 25 : 14, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08 }, '>-0.22');
        }

        if (manager.isDesktop && mediaVisual) {
            manager.scrollTriggers.push(ScrollTrigger.create({
                trigger: hero,
                start: 'top top',
                end: 'bottom top',
                scrub: true,
                onUpdate: self => {
                    const distance = self.progress * (manager.isDesktop ? -26 : -10);
                    gsap.set(mediaVisual, { y: distance, scale: 1 + self.progress * 0.012 });
                }
            }));
        }
    }

    window.AnifyHeroAnimations = heroAnimations;
})();
