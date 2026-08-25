(function () {
    function cardAnimations(manager) {
        document.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('pointerenter', () => card.classList.add('is-hovered'));
            card.addEventListener('pointerleave', () => card.classList.remove('is-hovered'));
        });

        if (!manager.isDesktop || manager.reducedMotion) return;
        document.querySelectorAll('[data-magnetic]').forEach(button => {
            const move = event => {
                const bounds = button.getBoundingClientRect();
                const x = (event.clientX - bounds.left - bounds.width / 2) * 0.12;
                const y = (event.clientY - bounds.top - bounds.height / 2) * 0.12;
                gsap.to(button, { x, y, duration: 0.25, ease: 'power2.out', overwrite: true });
            };
            const reset = () => gsap.to(button, { x: 0, y: 0, duration: 0.35, ease: 'power3.out', overwrite: true });
            button.addEventListener('pointermove', move);
            button.addEventListener('pointerleave', reset);
            manager.cleanups.push(() => {
                button.removeEventListener('pointermove', move);
                button.removeEventListener('pointerleave', reset);
            });
        });
    }

    window.AnifyCardAnimations = cardAnimations;
})();
