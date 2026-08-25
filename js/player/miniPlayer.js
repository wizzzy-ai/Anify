(function (global) {
    'use strict';

    let isDragging = false;
    let startX, startY;
    let currentX, currentY;
    let xOffset = 0, yOffset = 0;
    let rawStartX = 0, rawStartY = 0;
    let dragMoved = false;

    const STATE_KEY = 'anify-mini-player-state';
    // Bumped whenever the anchor/positioning scheme changes, so stale saved
    // offsets from an older scheme don't fight with the current CSS default.
    const STATE_VERSION = 4;

    const miniPlayer = {
        init() {
            const player = document.getElementById('anify-persistent-player');
            if (!player) return;

            // Reposition/resize to the saved state (or the CSS bottom-right
            // default if nothing usable is saved) every time we enter mini mode.
            this.loadState();
            this.updateNowPlaying();
            this.resetInactivity();

            // Bind drag/touch/inactivity listeners only once per player element.
            // init() runs again on every page navigation while minimized, and
            // re-binding here would stack duplicate listeners over time.
            if (player.dataset.miniPlayerBound === 'true') return;
            player.dataset.miniPlayerBound = 'true';

            player.addEventListener('mousedown', this.dragStart.bind(this));
            document.addEventListener('mouseup', this.dragEnd.bind(this));
            document.addEventListener('mousemove', this.drag.bind(this));

            player.addEventListener('touchstart', (e) => this.dragStart(e.touches[0]), { passive: true });
            document.addEventListener('touchend', this.dragEnd.bind(this));
            document.addEventListener('touchmove', (e) => this.drag(e.touches[0]), { passive: false });

            // Inactivity timer for controls - mouse, touch and hover
            player.addEventListener('mousemove', this.resetInactivity.bind(this));
            player.addEventListener('mouseenter', this.resetInactivity.bind(this));
            player.addEventListener('touchstart', this.resetInactivity.bind(this), { passive: true });
            player.addEventListener('touchmove', this.resetInactivity.bind(this), { passive: true });
        },

        resetInactivity() {
            const controls = document.getElementById('video-controls');
            const dock = document.getElementById('mini-player-dock');
            if (!controls) return;

            controls.classList.add('is-visible');
            if (dock) dock.classList.remove('hidden-dock');

            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = setTimeout(() => {
                const video = document.getElementById('anify-video');
                if (video && !video.paused) {
                    controls.classList.remove('is-visible');
                    if (dock) dock.classList.add('hidden-dock');
                }
            }, 3000);
        },

        dragStart(e) {
            const player = document.getElementById('anify-persistent-player');
            if (!player || !player.classList.contains('mini-player')) return;

            // Only drag if not clicking controls, close buttons, action buttons, or dock
            if (e.target.closest('#video-controls') ||
                e.target.closest('.floating-player-close') ||
                e.target.closest('.mini-mobile-close') ||
                e.target.closest('.mini-mobile-play') ||
                e.target.closest('#mini-player-dock')) return;

            isDragging = true;
            dragMoved = false;
            rawStartX = e.clientX;
            rawStartY = e.clientY;
            startX = e.clientX - xOffset;
            startY = e.clientY - yOffset;
            player.classList.add('is-dragging');
        },

        drag(e) {
            if (!isDragging) return;
            e.preventDefault?.();

            const player = document.getElementById('anify-persistent-player');
            currentX = e.clientX - startX;
            currentY = e.clientY - startY;

            if (!dragMoved && (Math.abs(e.clientX - rawStartX) > 5 || Math.abs(e.clientY - rawStartY) > 5)) {
                dragMoved = true;
            }

            xOffset = currentX;
            yOffset = currentY;

            this.setTranslate(currentX, currentY, player);
        },

        dragEnd() {
            if (!isDragging) return;
            isDragging = false;
            const player = document.getElementById('anify-persistent-player');
            if (player) player.classList.remove('is-dragging');
            global.__miniPlayerJustDragged = dragMoved;
            this.snapToCorner();
            this.saveState();
        },

        setTranslate(xPos, yPos, el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        },

        snapToCorner(instant = false) {
            const player = document.getElementById('anify-persistent-player');
            if (!player) return;

            const rect = player.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            let targetX = 0;
            let targetY = 0;

            // X axis
            if (centerX < winW / 2) {
                targetX = 32 - (player.offsetLeft); // Left
            } else {
                targetX = (winW - rect.width - 32) - player.offsetLeft; // Right
            }

            // Y axis
            if (centerY < winH / 2) {
                targetY = 32 - player.offsetTop; // Top
            } else {
                const bottomOffset = window.innerWidth < 768 ? 80 : 32;
                targetY = (winH - rect.height - bottomOffset) - player.offsetTop; // Bottom
            }

            xOffset = targetX;
            yOffset = targetY;

            if (!instant && global.gsap) {
                gsap.to(player, {
                    x: targetX,
                    y: targetY,
                    duration: 0.5,
                    ease: "elastic.out(1, 0.75)"
                });
            } else {
                this.setTranslate(targetX, targetY, player);
            }
        },

        resize(size, options = {}) {
            const player = document.getElementById('anify-persistent-player');
            if (!player) return;

            player.classList.remove('mini-player-small', 'mini-player-medium', 'mini-player-large');
            if (size === 'small') {
                player.classList.add('mini-player-small');
            } else if (size === 'large') {
                player.classList.add('mini-player-large');
            } else {
                player.classList.add('mini-player-medium');
            }

            this.snapToCorner(Boolean(options.silent));
            this.saveState();
            if (global.lucide && typeof global.lucide.createIcons === 'function') {
                global.lucide.createIcons();
            }
        },

        updateNowPlaying() {
            const video = document.getElementById('anify-video');
            const anime = global.playerService?.getAnime();
            if (!video || !anime) return;

            const epNum = video.dataset.episodeNumber || 1;
            const title = document.getElementById('mini-now-playing-title');
            const ep = document.getElementById('mini-now-playing-ep');
            const cta = document.getElementById('mini-dock-cta');

            if (title) title.textContent = anime.title;
            if (ep) ep.textContent = `Episode ${epNum}`;
            if (cta) cta.setAttribute('onclick', `event.stopPropagation(); navigate('player', ${anime.id});`);
        },

        /**
         * Plays the shrink/fade/scale entrance animation once, removing the
         * class automatically so it can be re-triggered on the next minimize.
         */
        playEnterAnimation() {
            const player = document.getElementById('anify-persistent-player');
            if (!player) return;
            player.classList.remove('mini-player-appear');
            // Force reflow so the animation can restart if triggered again quickly.
            void player.offsetWidth;
            player.classList.add('mini-player-appear');
            const onEnd = () => {
                player.classList.remove('mini-player-appear');
                player.removeEventListener('animationend', onEnd);
            };
            player.addEventListener('animationend', onEnd);
        },

        /**
         * Marks whether the mini player is currently open, persisted alongside
         * position/size so a page refresh can restore it.
         */
        setOpenFlag(isOpen) {
            const saved = this.getSavedState() || {};
            saved.version = STATE_VERSION;
            saved.open = Boolean(isOpen);
            localStorage.setItem(STATE_KEY, JSON.stringify(saved));
        },

        getSavedState() {
            const saved = localStorage.getItem(STATE_KEY);
            if (!saved) return null;
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        },

        saveState() {
            const player = document.getElementById('anify-persistent-player');
            if (!player) return;
            const previous = this.getSavedState() || {};
            const state = {
                version: STATE_VERSION,
                x: xOffset,
                y: yOffset,
                size: player.classList.contains('mini-player-large') ? 'large' :
                      player.classList.contains('mini-player-small') ? 'small' : 'medium',
                open: previous.open || false,
            };
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        },

        loadState() {
            const state = this.getSavedState();
            const player = document.getElementById('anify-persistent-player');
            if (!player) return;

            // Applying the saved size/position must be instant here - this runs
            // on every page refresh and page navigation while minimized, and
            // animating width/height/transform each time made the mini player
            // visibly "jump" to a different size right after load.
            player.classList.add('mini-player-no-transition');

            if (!state || state.version !== STATE_VERSION) {
                // Nothing usable saved yet (or it's from an older anchor/size scheme)
                // Fall back to CSS default position & standard spacious size (480x270).
                xOffset = 0;
                yOffset = 0;
                this.resize('medium', { silent: true });
                this.setTranslate(0, 0, player);
            } else {
                xOffset = state.x || 0;
                yOffset = state.y || 0;
                this.resize(state.size || 'medium', { silent: true });
                this.setTranslate(xOffset, yOffset, player);
            }

            // Re-enable smooth transitions for subsequent user-driven resizes/drags.
            requestAnimationFrame(() => {
                player.classList.remove('mini-player-no-transition');
            });
        }
    };

    global.initMiniPlayer = miniPlayer.init.bind(miniPlayer);
    global.miniPlayer = miniPlayer;

})(window);
