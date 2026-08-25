(function () {
    function scrollAnimations(manager) {
        if (manager.reducedMotion) {
            document.querySelectorAll('.anify-scroll-reveal').forEach(element => element.classList.add('is-visible'));
            return;
        }

        document.querySelectorAll('.home-section, .detail-section, .coming-soon-section').forEach(section => {
            if (!section.classList.contains('home-section--trending')) {
                section.classList.add('anify-scroll-reveal');
                gsap.fromTo(section, { opacity: 0, y: 20 }, {
                    opacity: 1, y: 0, duration: 0.65, ease: 'power3.out',
                    scrollTrigger: { trigger: section, start: 'top 88%', once: true }
                });
            }
        });

        // The homepage hero timeline owns Trending so the transition feels
        // like one composition instead of two independent reveals.
    }

    window.AnifyScrollAnimations = scrollAnimations;
})();
