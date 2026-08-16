/**
 * Click Effects — Originkit (MouseEffects)
 * Ported from Originkit React component to vanilla JavaScript for Anify.
 * 
 * Features:
 * - Exact GSAP timelines, coordinate math, and easing for all 6 interaction modes:
 *   'sniper' (default), 'rings', 'burst', 'particles', 'crosshair', 'wavy'
 * - Real-time Profile Theme integration: dynamically synchronizes with active Anify profile theme colors
 * - Zero click blocking (pointer-events: none, high z-index overlay)
 * - Memory-safe cleanup on animation completion
 */

class AnifyClickEffects {
    constructor(options = {}) {
        this.color = options.color || '#ffffff';
        this.interactionMode = options.interactionMode || 'sniper'; // Default mode from component
        this.duration = options.duration !== undefined ? options.duration : 0.3;
        this.strokeWidth = options.strokeWidth !== undefined ? options.strokeWidth : 2;
        this.effectSize = options.effectSize !== undefined ? options.effectSize : 90;
        this.rotation = options.rotation !== undefined ? options.rotation : 0;
        this.enabled = true;
        this.useThemeColors = options.useThemeColors !== false;
        
        this.handleClick = this.handleClick.bind(this);
        this.updateThemeColors = this.updateThemeColors.bind(this);

        this.init();
    }

    init() {
        this.addClickListener();
        this.setupThemeListener();
        this.updateThemeColors();
    }

    setupThemeListener() {
        // 1. Listen for custom profileThemeChanged event
        window.addEventListener('profileThemeChanged', (e) => {
            this.updateThemeColors(e?.detail?.themeId, e?.detail?.mode);
        });

        // 2. Listen for storage changes across tabs or auth restore
        window.addEventListener('storage', (e) => {
            if (e.key === 'anify-theme' || e.key === 'anify-user-profile') {
                this.updateThemeColors();
            }
        });

        // 3. Observe root element class & dataset changes (e.g. data-theme, dark/light toggle)
        const observer = new MutationObserver(() => {
            this.updateThemeColors();
        });

        if (document.documentElement) {
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme', 'data-color-mode', 'class'],
            });
        }
    }

    updateThemeColors(explicitThemeId = null, explicitMode = null) {
        if (!this.useThemeColors) return;

        try {
            let profileTheme = explicitThemeId;
            if (!profileTheme) {
                const userProfile = JSON.parse(localStorage.getItem('anify-user-profile') || '{}');
                profileTheme = userProfile.profileTheme || document.documentElement.dataset.theme || 'default';
            }

            const isLight = (explicitMode === 'light') || document.documentElement.classList.contains('light');
            
            const profileConfig = window.getProfileConfig ? window.getProfileConfig() : null;
            const themeData = profileConfig?.PROFILE_THEMES?.[profileTheme] || profileConfig?.PROFILE_THEMES?.['default'];

            if (themeData) {
                const tokens = isLight ? (themeData.lightTokens || themeData.tokens) : themeData.tokens;
                this.color = tokens?.primary || '#FBBF24';
                this.accentColor = tokens?.accent || '#8B5CF6';
            } else {
                // Read CSS custom property fallback
                const computed = getComputedStyle(document.documentElement);
                const primaryVal = computed.getPropertyValue('--primary').trim();
                const accentVal = computed.getPropertyValue('--accent').trim();
                this.color = primaryVal || (isLight ? '#D97706' : '#FBBF24');
                this.accentColor = accentVal || (isLight ? '#7C3AED' : '#8B5CF6');
            }
        } catch (error) {
            this.color = '#FBBF24';
            this.accentColor = '#8B5CF6';
        }
    }

    addClickListener() {
        document.addEventListener('click', this.handleClick, { passive: true });
    }

    handleClick(e) {
        if (!this.enabled || !window.gsap) return;
        
        // Use client viewport coordinates
        const x = e.clientX;
        const y = e.clientY;
        const id = `${e.timeStamp || Date.now()}-${Math.round(x)}-${Math.round(y)}`;

        this.createEffect(id, x, y);
    }

    createEffect(id, x, y) {
        switch (this.interactionMode) {
            case 'rings':
                this.createRings(id, x, y);
                break;
            case 'burst':
                this.createBurst(id, x, y);
                break;
            case 'particles':
                this.createParticles(id, x, y);
                break;
            case 'crosshair':
                this.createCrosshair(id, x, y);
                break;
            case 'wavy':
                this.createWavy(id, x, y);
                break;
            case 'sniper':
            default:
                this.createSniper(id, x, y);
                break;
        }
    }

    // ==========================================
    // 1. RINGS INTERACTION MODE
    // ==========================================
    createRings(id, x, y) {
        const effectSize = this.effectSize;
        const strokeWidth = this.strokeWidth;
        const duration = this.duration;
        const color = this.color;
        const rotation = this.rotation;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - effectSize / 2}px;
            top: ${y - effectSize / 2}px;
            width: ${effectSize}px;
            height: ${effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            z-index: 999999;
        `);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', effectSize / 2);
        circle.setAttribute('cy', effectSize / 2);
        circle.setAttribute('r', effectSize / 4);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', strokeWidth);
        circle.style.strokeWidth = 'var(--stroke-width, ' + strokeWidth + 'px)';

        svg.appendChild(circle);
        document.body.appendChild(svg);

        gsap.set(svg, {
            scale: 0.5,
            '--stroke-width': strokeWidth,
        });

        gsap.timeline()
            .to(svg, {
                scale: 2,
                '--stroke-width': 0,
                duration: duration,
                ease: 'power3.out',
                onComplete: () => {
                    svg.remove();
                }
            }, 0)
            .to(circle, {
                attr: { 'stroke-width': 0 },
                duration: duration,
                ease: 'power3.out',
            }, 0)
            .to(svg, {
                opacity: 0,
                duration: duration * 0.2,
                ease: 'linear',
            }, duration * 0.8);
    }

    // ==========================================
    // 2. BURST INTERACTION MODE
    // ==========================================
    createBurst(id, x, y) {
        const effectSize = this.effectSize;
        const strokeWidth = this.strokeWidth;
        const duration = this.duration;
        const color = this.color;
        const rotation = this.rotation;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - effectSize / 2}px;
            top: ${y - effectSize / 2}px;
            width: ${effectSize}px;
            height: ${effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            z-index: 999999;
        `);

        const angles = [45, 80, 115, 150];
        const centerX = effectSize / 2;
        const centerY = effectSize / 2;

        angles.forEach((angle, index) => {
            const rad = angle * (Math.PI / 180);
            const startX = centerX + effectSize * 0.1 * Math.cos(rad);
            const startY = centerY - effectSize * 0.1 * Math.sin(rad);
            const endX = centerX + effectSize * 0.25 * Math.cos(rad);
            const endY = centerY - effectSize * 0.25 * Math.sin(rad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', centerX);
            line.setAttribute('y1', centerY);
            line.setAttribute('x2', centerX);
            line.setAttribute('y2', centerY);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', strokeWidth);
            line.setAttribute('stroke-linecap', 'square');

            svg.appendChild(line);

            gsap.set(line, {
                attr: {
                    x1: startX,
                    y1: startY,
                    x2: endX,
                    y2: endY,
                },
                strokeWidth: strokeWidth,
            });

            gsap.timeline()
                .to(line, {
                    attr: {
                        x1: endX,
                        y1: endY,
                        x2: endX,
                        y2: endY,
                    },
                    translateX: (effectSize / 4) * Math.cos(rad),
                    translateY: -(effectSize / 4) * Math.sin(rad),
                    duration: duration,
                    ease: 'power2.out',
                    onComplete: () => {
                        if (index === angles.length - 1) {
                            svg.remove();
                        }
                    }
                }, 0)
                .to(line, {
                    strokeWidth: 0,
                    duration: duration * 0.4,
                    ease: 'linear',
                }, duration * 0.6);
        });

        document.body.appendChild(svg);
    }

    // ==========================================
    // 3. PARTICLES INTERACTION MODE
    // ==========================================
    createParticles(id, x, y) {
        const effectSize = this.effectSize;
        const strokeWidth = this.strokeWidth;
        const duration = this.duration;
        const color = this.color;
        const rotation = this.rotation;

        for (let i = 0; i < 8; i++) {
            const angle = i * 45 * (Math.PI / 180);
            const distance = effectSize * 0.2 + Math.random() * (effectSize * 0.3);
            const finalX = x + Math.cos(angle) * distance;
            const finalY = y + Math.sin(angle) * distance;

            const el = document.createElement('div');
            el.style.cssText = `
                position: fixed;
                left: ${x - strokeWidth / 2}px;
                top: ${y - strokeWidth / 2}px;
                width: ${strokeWidth}px;
                height: ${strokeWidth}px;
                background-color: ${color};
                border-radius: 50%;
                pointer-events: none;
                transform-origin: center;
                transform: rotate(${rotation}deg);
                z-index: 999999;
            `;

            document.body.appendChild(el);

            gsap.set(el, {
                left: x - strokeWidth / 2,
                top: y - strokeWidth / 2,
                width: 0,
                height: 0,
            });

            gsap.timeline()
                .to(el, {
                    width: strokeWidth,
                    height: strokeWidth,
                    duration: duration * 0.2,
                    ease: 'power1.out',
                })
                .to(el, {
                    left: finalX - strokeWidth / 2,
                    top: finalY - strokeWidth / 2,
                    duration: duration * 0.4,
                    ease: 'power1.out',
                }, duration * 0.2)
                .to(el, {
                    width: 0,
                    height: 0,
                    left: finalX,
                    top: finalY,
                    duration: duration * 0.4,
                    ease: 'linear',
                    onComplete: () => {
                        el.remove();
                    }
                }, duration * 0.6);
        }
    }

    // ==========================================
    // 4. CROSSHAIR INTERACTION MODE
    // ==========================================
    createCrosshair(id, x, y) {
        const effectSize = this.effectSize;
        const strokeWidth = this.strokeWidth;
        const duration = this.duration;
        const color = this.color;
        const rotation = this.rotation;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - effectSize / 2}px;
            top: ${y - effectSize / 2}px;
            width: ${effectSize}px;
            height: ${effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            z-index: 999999;
        `);

        const angles = [0, 90, 180, 270];
        const centerX = effectSize / 2;
        const centerY = effectSize / 2;
        const lineLength = effectSize * 0.3;

        angles.forEach((angle, index) => {
            const rad = angle * (Math.PI / 180);
            const startX = centerX + 20 * Math.cos(rad);
            const startY = centerY - 20 * Math.sin(rad);
            const endX = centerX + (20 + lineLength) * Math.cos(rad);
            const endY = centerY - (20 + lineLength) * Math.sin(rad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', centerX);
            line.setAttribute('y1', centerY);
            line.setAttribute('x2', centerX);
            line.setAttribute('y2', centerY);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', strokeWidth);
            line.setAttribute('stroke-linecap', 'square');

            svg.appendChild(line);

            gsap.set(line, {
                attr: {
                    x1: startX,
                    y1: startY,
                    x2: centerX,
                    y2: centerY,
                },
                strokeWidth: strokeWidth,
            });

            gsap.timeline()
                .to(line, {
                    attr: {
                        x1: endX,
                        y1: endY,
                        x2: endX,
                        y2: endY,
                    },
                    duration: duration * 0.8,
                    ease: 'power1.out',
                })
                .to(line, {
                    strokeWidth: 0,
                    duration: duration * 0.6,
                    ease: 'linear',
                    onComplete: () => {
                        if (index === angles.length - 1) {
                            svg.remove();
                        }
                    }
                }, duration * 0.4);
        });

        document.body.appendChild(svg);
    }

    // ==========================================
    // 5. WAVY INTERACTION MODE
    // ==========================================
    createWavy(id, x, y) {
        const effectSize = this.effectSize;
        const strokeWidth = this.strokeWidth;
        const duration = this.duration;
        const color = this.color;
        const rotation = this.rotation;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - effectSize / 2}px;
            top: ${y - effectSize / 2}px;
            width: ${effectSize}px;
            height: ${effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            z-index: 999999;
        `);

        const angles = [45, 90, 135, 180];
        const centerX = effectSize / 2;
        const centerY = effectSize / 2;
        const startRadius = effectSize * 0.1;
        const endRadius = effectSize * 0.5;
        const waveOffset = effectSize * 0.05;

        document.body.appendChild(svg);

        angles.forEach((angle) => {
            const rad = (angle * Math.PI) / 180;
            const startX = centerX + startRadius * Math.cos(rad);
            const startY = centerY - startRadius * Math.sin(rad);
            const endX = centerX + endRadius * Math.cos(rad);
            const endY = centerY - endRadius * Math.sin(rad);
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const control1X = midX + waveOffset * Math.cos(rad + Math.PI / 2);
            const control1Y = midY - waveOffset * Math.sin(rad + Math.PI / 2);
            const wavyPath = `M ${startX} ${startY} Q ${control1X} ${control1Y} ${midX} ${midY} T ${endX} ${endY}`;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', wavyPath);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', strokeWidth);
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('fill', 'none');

            svg.appendChild(path);

            const pathLength = path.getTotalLength();
            gsap.set(path, {
                strokeDasharray: '1, ' + pathLength,
                strokeDashoffset: 0,
                strokeWidth: strokeWidth,
            });

            gsap.timeline()
                .to(path, {
                    strokeDasharray: `${pathLength}, ${pathLength}`,
                    strokeDashoffset: -pathLength,
                    duration: duration,
                    ease: 'power1.out',
                })
                .to(path, {
                    strokeWidth: 0,
                    duration: duration * 0.4,
                    ease: 'linear',
                }, duration * 0.6);
        });

        gsap.delayedCall(duration, () => {
            svg.remove();
        });
    }

    // ==========================================
    // 6. SNIPER INTERACTION MODE (Default)
    // ==========================================
    createSniper(id, x, y) {
        const effectSize = this.effectSize;
        const strokeWidth = this.strokeWidth;
        const duration = this.duration;
        const color = this.color;
        const rotation = this.rotation;

        // Part 1: Crosshair SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - effectSize / 2}px;
            top: ${y - effectSize / 2}px;
            width: ${effectSize}px;
            height: ${effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            z-index: 999999;
        `);

        const angles = [0, 90, 180, 270];
        const centerX = effectSize / 2;
        const centerY = effectSize / 2;
        const lineLength = effectSize * 0.2;

        angles.forEach((angle, index) => {
            const rad = angle * (Math.PI / 180);
            const startX = centerX + 5 * Math.cos(rad);
            const startY = centerY - 5 * Math.sin(rad);
            const endX = centerX + (5 + lineLength) * Math.cos(rad);
            const endY = centerY - (5 + lineLength) * Math.sin(rad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', centerX);
            line.setAttribute('y1', centerY);
            line.setAttribute('x2', centerX);
            line.setAttribute('y2', centerY);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', strokeWidth);
            line.setAttribute('stroke-linecap', 'square');

            svg.appendChild(line);

            gsap.set(line, {
                attr: {
                    x1: startX,
                    y1: startY,
                    x2: endX,
                    y2: endY,
                },
                strokeWidth: strokeWidth,
            });

            gsap.timeline()
                .to(line, {
                    attr: {
                        x1: endX,
                        y1: endY,
                        x2: endX,
                        y2: endY,
                    },
                    translateX: (5 + lineLength) * Math.cos(rad),
                    translateY: -(5 + lineLength) * Math.sin(rad),
                    duration: duration,
                    ease: 'power2.out',
                    onComplete: () => {
                        if (index === angles.length - 1) {
                            svg.remove();
                        }
                    }
                }, 0)
                .to(line, {
                    strokeWidth: 0,
                    duration: duration * 0.4,
                    ease: 'linear',
                }, duration * 0.6);
        });

        document.body.appendChild(svg);

        // Part 2: 8 Radial Particle Dots
        const particleAngles = [
            Math.PI / 3,
            (2 * Math.PI) / 3,
            (4 * Math.PI) / 3,
            (5 * Math.PI) / 3,
            Math.PI / 6,
            (5 * Math.PI) / 6,
            (7 * Math.PI) / 6,
            (11 * Math.PI) / 6,
        ];

        particleAngles.forEach((angle) => {
            const el = document.createElement('div');
            el.style.cssText = `
                position: fixed;
                left: ${x - strokeWidth / 2}px;
                top: ${y - strokeWidth / 2}px;
                width: ${strokeWidth}px;
                height: ${strokeWidth}px;
                background-color: ${color};
                pointer-events: none;
                transform-origin: center;
                transform: rotate(${rotation}deg);
                z-index: 999999;
            `;

            document.body.appendChild(el);

            gsap.set(el, {
                x: 0,
                y: 0,
                width: strokeWidth,
                height: strokeWidth,
            });

            gsap.timeline()
                .to(el, {
                    x: Math.cos(angle) * (effectSize * 0.4),
                    y: Math.sin(angle) * (effectSize * 0.4),
                    duration: duration,
                    ease: 'power2.out',
                    onComplete: () => {
                        el.remove();
                    }
                }, 0)
                .to(el, {
                    width: 0,
                    height: 0,
                    duration: duration * 0.4,
                    ease: 'linear',
                }, duration * 0.6);
        });
    }

    // ==========================================
    // Public API & Helpers
    // ==========================================
    setMode(mode) {
        if (['sniper', 'rings', 'burst', 'particles', 'crosshair', 'wavy'].includes(mode)) {
            this.interactionMode = mode;
        }
    }

    setColor(color) {
        this.color = color;
        this.useThemeColors = false;
    }

    setDuration(duration) {
        this.duration = duration;
    }

    setEffectSize(size) {
        this.effectSize = size;
    }

    setStrokeWidth(width) {
        this.strokeWidth = width;
    }

    setRotation(rotation) {
        this.rotation = rotation;
    }

    enableThemeColors(enabled = true) {
        this.useThemeColors = enabled;
        if (enabled) {
            this.updateThemeColors();
        }
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    destroy() {
        this.enabled = false;
        document.removeEventListener('click', this.handleClick);
        document.querySelectorAll('[style*="z-index: 999999"]').forEach(el => el.remove());
    }
}

// Instantiate with component defaults & active theme syncing
const anifyClickEffects = new AnifyClickEffects({
    color: '#ffffff',
    interactionMode: 'sniper',
    duration: 0.3,
    strokeWidth: 2,
    effectSize: 90,
    rotation: 0,
    useThemeColors: true,
});

window.AnifyClickEffects = AnifyClickEffects;
window.anifyClickEffects = anifyClickEffects;