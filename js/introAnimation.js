/**
 * GlitterWrap — Originkit Starfield Warp Tunnel Loading Page Background
 * Ported from Originkit GlitterWrap React component to vanilla JavaScript for Anify.
 * 
 * Features:
 * - High performance 60/120fps canvas rendering with DPR support
 * - Zero-allocation hot loop with cached color parsing
 * - Destination-out trail erasing for fluid warp streaks
 * - Additive particle blending with glitter flashes & turbulence
 * - Full Profile Theme reactivity: dynamically adopts the active theme's primary,
 *   accent, ambient glow, and background tokens.
 * - Smooth entrance and exit transitions for the Anify loading screen
 */

// Pure utility — hoisted to module scope so it is never re-created.
function parseColor(input) {
    if (!input) return [255, 255, 255, 1];
    const s = String(input).trim();
    if (s.startsWith('#')) {
        let hex = s.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const num = parseInt(hex, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
    }
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
        const parts = m[1].split(',').map(p => parseFloat(p.trim()));
        return [
            parts[0] || 0,
            parts[1] || 0,
            parts[2] || 0,
            parts[3] == null ? 1 : parts[3],
        ];
    }
    return [255, 255, 255, 1];
}

/**
 * Resolves active profile theme tokens (primary, accent, background, etc.)
 */
function getActiveProfileTokens() {
    try {
        let profileTheme = document.documentElement?.dataset?.theme;
        if (!profileTheme) {
            const userProfile = JSON.parse(localStorage.getItem('anify-user-profile') || '{}');
            profileTheme = userProfile.profileTheme || 'default';
        }

        const isLight = document.documentElement?.classList?.contains('light');
        const profileConfig = window.getProfileConfig ? window.getProfileConfig() : null;
        const themeData = profileConfig?.PROFILE_THEMES?.[profileTheme] || profileConfig?.PROFILE_THEMES?.['default'];

        if (themeData) {
            const tokens = isLight ? (themeData.lightTokens || themeData.tokens) : themeData.tokens;
            return {
                isLight,
                primary: tokens.primary || (isLight ? '#D97706' : '#FBBF24'),
                accent: tokens.accent || (isLight ? '#7C3AED' : '#8B5CF6'),
                primaryLight: tokens.primaryLight || '#FDE68A',
                background: tokens.background || (isLight ? '#FFFDF8' : '#01010C'),
            };
        }

        const computed = getComputedStyle(document.documentElement);
        const primary = computed.getPropertyValue('--primary').trim() || (isLight ? '#D97706' : '#FBBF24');
        const accent = computed.getPropertyValue('--accent').trim() || (isLight ? '#7C3AED' : '#8B5CF6');
        const primaryLight = computed.getPropertyValue('--primary-light').trim() || '#FFFFFF';
        const background = computed.getPropertyValue('--background').trim() || (isLight ? '#FFFDF8' : '#01010C');

        return {
            isLight,
            primary,
            accent,
            primaryLight,
            background,
        };
    } catch (e) {
        const isLight = document.documentElement?.classList?.contains('light');
        return {
            isLight,
            primary: isLight ? '#D97706' : '#FBBF24',
            accent: isLight ? '#7C3AED' : '#8B5CF6',
            primaryLight: '#FDE68A',
            background: isLight ? '#FFFDF8' : '#01010C',
        };
    }
}

const GLITTER_WRAP_DEFAULTS = {
    particleCount: 500,
    color1: "#ffffff",
    color2: "#FBBF24",
    color3: "#8B5CF6",
    speed: 5,
    density: 100,
    starSize: 20,
    focalDepth: 13,
    turbulence: 0,
    brightness: 100,
    glitterIntensity: 3,
    trailAmount: 100,
    reverse: false,
};

/**
 * Core GlitterWrap Canvas Engine
 */
class GlitterWrap {
    constructor(container, options = {}) {
        this.container = container || document.body;
        this.props = { ...GLITTER_WRAP_DEFAULTS, ...options };

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'glitter-wrap-canvas';
        this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:1;';

        this.ctx = this.canvas.getContext('2d');
        this.rafId = null;
        this.size = { w: 0, h: 0, dpr: 1 };
        this.stars = [];
        this.elapsed = 0;
        this.lastT = performance.now();
        this.isRunning = false;

        // Cached parsed colors
        this.colorCache = {
            color1: '',
            color2: '',
            color3: '',
            parsed1: [255, 255, 255, 1],
            parsed2: [251, 191, 36, 1],
            parsed3: [139, 92, 246, 1],
        };

        if (this.container.firstChild) {
            this.container.insertBefore(this.canvas, this.container.firstChild);
        } else {
            this.container.appendChild(this.canvas);
        }

        this.resize = this.resize.bind(this);
        this.loop = this.loop.bind(this);

        this.ro = new ResizeObserver((entries) => {
            if (entries[0]) this.resize(entries[0]);
        });
        this.ro.observe(this.container);

        this.syncCount();
        this.resize();
    }

    setProps(newProps = {}) {
        this.props = { ...this.props, ...newProps };
        this.syncCount();
    }

    getCachedColors() {
        const p = this.props;
        const c = this.colorCache;
        if (p.color1 !== c.color1) {
            c.color1 = p.color1;
            c.parsed1 = parseColor(p.color1);
        }
        if (p.color2 !== c.color2) {
            c.color2 = p.color2;
            c.parsed2 = parseColor(p.color2);
        }
        if (p.color3 !== c.color3) {
            c.color3 = p.color3;
            c.parsed3 = parseColor(p.color3);
        }
        return c;
    }

    cfg() {
        const p = this.props;
        return {
            reverse: p.reverse,
            density: p.density,                         // 1–100, used raw
            stepZ: p.speed * 0.0008,                    // speed 1–10
            focalDepth: p.focalDepth / 100,             // 1–30 -> 0.01–0.30
            starScale: p.starSize * 0.15,               // 0–20 -> 0–3.0
            turbulence: p.turbulence * 0.2,             // 0–10 -> 0–2
            glitter: p.glitterIntensity * 0.1,          // 0–10 -> 0–1
            brightness: Math.min(1, p.brightness / 100),// 0–100%
            trail: p.trailAmount / 100,                 // 0–100%
        };
    }

    resetStar(s, initial = false) {
        const { density, reverse, focalDepth, glitter } = this.cfg();
        const angle = Math.random() * Math.PI * 2;
        const radius = (0.2 + Math.random() * 0.8) * (density / 15);
        s.x = Math.cos(angle) * radius;
        s.y = Math.sin(angle) * radius;

        if (reverse) {
            s.z = initial
                ? focalDepth + Math.random() * (1 - focalDepth)
                : focalDepth;
        } else {
            s.z = initial ? Math.random() : 1.0;
        }
        s.px = NaN;
        s.py = NaN;
        s.seed = Math.random() * 1000;
        s.vmul = 0.6 + Math.random() * 0.8;
        s.colorIdx = Math.floor(Math.random() * 3);
        s.flashUntil = 0;
        s.nextFlash = this.elapsed + 1 + Math.random() * 4 * (1 / Math.max(0.0001, glitter));
    }

    makeStar() {
        return {
            x: 0,
            y: 0,
            z: 0,
            px: NaN,
            py: NaN,
            seed: 0,
            vmul: 1,
            colorIdx: 0,
            flashUntil: 0,
            nextFlash: 0,
        };
    }

    syncCount() {
        const count = Math.max(1, Math.floor(this.props.particleCount));
        if (this.stars.length === count) return;
        if (this.stars.length > count) {
            this.stars.length = count;
        } else {
            while (this.stars.length < count) {
                const s = this.makeStar();
                this.resetStar(s, true);
                this.stars.push(s);
            }
        }
    }

    resize(entry) {
        const container = this.container;
        const canvas = this.canvas;
        const ctx = this.ctx;
        if (!container || !canvas || !ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cr = entry?.contentRect;
        const rectW = cr?.width || container.clientWidth || window.innerWidth;
        const rectH = cr?.height || container.clientHeight || window.innerHeight;
        const w = Math.max(1, Math.floor(rectW) || 600);
        const h = Math.max(1, Math.floor(rectH) || 400);

        const prev = this.size;
        if (prev.w === w && prev.h === h && prev.dpr === dpr) return;

        this.size = { w, h, dpr };
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
    }

    drawFrame(deltaSec) {
        const ctx = this.ctx;
        if (!ctx) return;

        const {
            reverse,
            stepZ,
            focalDepth,
            starScale,
            turbulence,
            glitter,
            brightness,
            trail,
        } = this.cfg();

        this.syncCount();
        const colors = this.getCachedColors();
        const palette = [
            colors.parsed1,
            colors.parsed2,
            colors.parsed3,
        ];

        const rgbStrs = [
            `rgb(${palette[0][0]}, ${palette[0][1]}, ${palette[0][2]})`,
            `rgb(${palette[1][0]}, ${palette[1][1]}, ${palette[1][2]})`,
            `rgb(${palette[2][0]}, ${palette[2][1]}, ${palette[2][2]})`,
        ];

        const { w, h } = this.size;
        if (w === 0 || h === 0) return;

        const cx = w / 2;
        const cy = h / 2;
        const projScale = Math.min(w, h) * 0.9;

        // Cap deltaSec to avoid large jumps when tab is backgrounded
        const dt = Math.max(0.001, Math.min(0.1, deltaSec)) * 60;

        // Soft "trails" — destination-out
        const keep = Math.pow(Math.min(0.98, Math.max(0, trail)), dt);
        const trailAlpha = Math.max(0.02, 1 - keep);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = `rgba(0, 0, 0, ${trailAlpha})`;
        ctx.fillRect(0, 0, w, h);

        // Additive for stars
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < this.stars.length; i++) {
            const s = this.stars[i];

            const vz = stepZ * s.vmul * dt;
            if (reverse) {
                s.z += vz;
                if (s.z >= 1.0) {
                    this.resetStar(s);
                    continue;
                }
            } else {
                s.z -= vz;
                if (s.z <= focalDepth) {
                    this.resetStar(s);
                    continue;
                }
            }

            // Turbulence: sinusoidal wobble
            let tx = s.x;
            let ty = s.y;
            if (turbulence > 0) {
                const t = this.elapsed * 1.2 + s.seed;
                const amp = turbulence * (1 - s.z) * 0.25;
                tx += Math.sin(t + s.seed) * amp;
                ty += Math.cos(t * 1.13 + s.seed * 0.7) * amp;
            }

            // Project
            const persp = focalDepth / Math.max(s.z, 0.0001);
            const sx = cx + tx * persp * projScale;
            const sy = cy + ty * persp * projScale;

            if (!reverse && (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20)) {
                this.resetStar(s);
                continue;
            }

            // Glitter flash
            let flashMult = 1;
            if (glitter > 0) {
                if (this.elapsed >= s.nextFlash && s.flashUntil < this.elapsed) {
                    s.flashUntil = this.elapsed + 0.04 + Math.random() * 0.07;
                    s.nextFlash = this.elapsed + 1 + Math.random() * 4 * (1 / Math.max(0.0001, glitter));
                }
                if (this.elapsed <= s.flashUntil) {
                    flashMult = 1 + 2.5 * glitter;
                }
            }

            // Size
            const sizePersp = Math.min(2.5, (focalDepth / Math.max(s.z, 0.0001)) * 0.6);
            const baseR = Math.max(0.25, starScale * (0.4 + sizePersp));
            const maxR = 1 + starScale * 2.5;
            const r = Math.min(baseR * flashMult, maxR);

            // Alpha
            const lifeT = reverse ? s.z : 1 - s.z;
            const fadeIn = reverse
                ? Math.min(1, (s.z - focalDepth) / (1 - focalDepth) / 0.12)
                : 1;
            const a = Math.min(1, reverse ? 0.85 - lifeT * 0.6 : lifeT * 0.9 + 0.05) *
                fadeIn *
                brightness *
                (flashMult > 1 ? 1 : 0.85);

            const colStr = rgbStrs[s.colorIdx];

            // Streak
            if (!Number.isNaN(s.px) && !Number.isNaN(s.py)) {
                ctx.globalAlpha = a * 0.5;
                ctx.strokeStyle = colStr;
                ctx.lineWidth = Math.max(0.4, r * 0.4);
                ctx.beginPath();
                ctx.moveTo(s.px, s.py);
                ctx.lineTo(sx, sy);
                ctx.stroke();
            }

            // Dot head
            ctx.globalAlpha = a;
            ctx.fillStyle = colStr;
            ctx.fillRect(sx - r, sy - r, r * 2, r * 2);

            // Glitter sparkle box
            if (flashMult > 1) {
                const rf = Math.min(r * 1.4, maxR * 1.4);
                ctx.globalAlpha = a * 0.5;
                ctx.fillRect(sx - rf, sy - rf, rf * 2, rf * 2);
            }

            s.px = sx;
            s.py = sy;
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        this.elapsed += Math.min(0.1, Math.max(0, deltaSec));
    }

    loop(t) {
        if (!this.isRunning) return;
        const deltaSec = (t - this.lastT) / 1000;
        this.lastT = t;
        this.drawFrame(deltaSec);
        this.rafId = requestAnimationFrame(this.loop);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastT = performance.now();
        this.rafId = requestAnimationFrame(this.loop);
    }

    stop() {
        this.isRunning = false;
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    destroy() {
        this.stop();
        if (this.ro) {
            this.ro.disconnect();
            this.ro = null;
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

/**
 * Anify Loading Screen & Cinematic Intro Controller
 * Fully synchronized with the active Profile Theme.
 */
class AnifyIntroAnimation {
    constructor(options = {}) {
        this.container = options.container || document.body;
        // Exactly 9 seconds cinematic loading screen duration
        this.duration = options.duration !== undefined ? options.duration : 9000;
        this.enabled = options.enabled !== false;
        this.skipable = options.skipable !== false;
        this.onComplete = options.onComplete || (() => { });
        this.onSkip = options.onSkip || (() => { });

        this.isPlaying = false;
        this.canSkip = true;
        this.startTime = 0;
        this.glitterWrap = null;
        this.autoCompleteTimer = null;

        // Resolve current theme tokens
        const tokens = getActiveProfileTokens();

        // GlitterWrap options matching component defaults, powered by theme colors
        this.config = {
            particleCount: options.particleCount || GLITTER_WRAP_DEFAULTS.particleCount,
            color1: options.color1 || '#ffffff',
            color2: options.color2 || tokens.primary,
            color3: options.color3 || tokens.accent,
            speed: options.speed || GLITTER_WRAP_DEFAULTS.speed,
            density: options.density || GLITTER_WRAP_DEFAULTS.density,
            starSize: options.starSize || GLITTER_WRAP_DEFAULTS.starSize,
            focalDepth: options.focalDepth || GLITTER_WRAP_DEFAULTS.focalDepth,
            turbulence: options.turbulence || GLITTER_WRAP_DEFAULTS.turbulence,
            brightness: options.brightness || GLITTER_WRAP_DEFAULTS.brightness,
            glitterIntensity: options.glitterIntensity || GLITTER_WRAP_DEFAULTS.glitterIntensity,
            trailAmount: options.trailAmount || GLITTER_WRAP_DEFAULTS.trailAmount,
            reverse: options.reverse || GLITTER_WRAP_DEFAULTS.reverse,
        };

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.syncThemeColors = this.syncThemeColors.bind(this);
        this.init();
    }

    init() {
        this.createOverlay();
        this.setupThemeSync();
        this.checkReducedMotion();
    }

    createOverlay() {
        const tokens = getActiveProfileTokens();

        const existing = document.getElementById('anify-intro-overlay');
        if (existing) {
            this.overlay = existing;
            this.centerContainer = existing.querySelector('.anify-intro-shell') || existing.querySelector('#anify-intro-logo');
            this.ambientGlow = existing.querySelector('.anify-intro-glow');
            this.logo = existing.querySelector('.anify-intro-logo, img');
            this.loaderBlock = existing.querySelector('.anify-intro-loader');
            this.loadingText = existing.querySelector('.anify-intro-text');
            this.progressBar = existing.querySelector('.anify-intro-progress');
            this.progressFill = existing.querySelector('.anify-intro-progress-fill');
            this.skipButton = existing.querySelector('.anify-intro-skip');
            this.overlay.classList.remove('is-hidden');
            this.overlay.style.display = 'flex';
            this.overlay.style.opacity = '1';
            this.overlay.style.visibility = 'visible';

            if (!this.glitterWrap) {
                this.glitterWrap = new GlitterWrap(this.overlay, this.config);
            }

            this.skipButton?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.skip();
            });

            this.overlay.addEventListener('click', () => {
                if (this.canSkip) {
                    this.skip();
                }
            });

            this.injectKeyframeStyles();
            return;
        }

        // Main overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'anify-intro-overlay';
        this.overlay.style.cssText = `
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: ${tokens.background || '#01010C'} !important;
            z-index: 999999 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            opacity: 1 !important;
            visibility: visible !important;
            user-select: none !important;
            font-family: 'Outfit', 'Inter', -apple-system, sans-serif !important;
            transition: background 0.5s ease;
        `;

        // Initialize the GlitterWrap Starfield Canvas
        this.glitterWrap = new GlitterWrap(this.overlay, this.config);

        // Center Content Box
        this.centerContainer = document.createElement('div');
        this.centerContainer.id = 'anify-intro-logo';
        this.centerContainer.style.cssText = `
            position: relative;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            opacity: 0;
            transform: scale(0.85);
            transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: none;
        `;

        // Ambient radial glow behind the logo (uses theme primary & accent)
        this.ambientGlow = document.createElement('div');
        this.ambientGlow.style.cssText = `
            position: absolute;
            width: 280px;
            height: 280px;
            border-radius: 50%;
            background: radial-gradient(circle, ${tokens.primary}40 0%, ${tokens.accent}26 45%, transparent 70%);
            filter: blur(35px);
            z-index: -1;
            pointer-events: none;
            animation: introGlowPulse 3s ease-in-out infinite alternate;
            transition: background 0.5s ease;
        `;
        this.centerContainer.appendChild(this.ambientGlow);

        // Logo Image
        this.logo = document.createElement('img');
        this.logo.src = '/pictures/logo.png';
        this.logo.alt = 'Anify Logo';
        this.logo.style.cssText = `
            width: 210px;
            height: auto;
            max-width: 78vw;
            filter: drop-shadow(0 0 25px ${tokens.primary}73) drop-shadow(0 0 50px ${tokens.accent}4D);
            transition: transform 0.3s ease, filter 0.5s ease;
        `;
        this.centerContainer.appendChild(this.logo);

        // Loading status & shimmering progress bar
        this.loaderBlock = document.createElement('div');
        this.loaderBlock.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            margin-top: 5px;
        `;

        this.loadingText = document.createElement('div');
        const initialTextColor = tokens.isLight ? tokens.primary : 'rgba(255, 255, 255, 0.75)';
        this.loadingText.innerHTML = `
            <span id="intro-entering-text" style="font-size: 11px; font-weight: 800; letter-spacing: 0.25em; text-transform: uppercase; color: ${initialTextColor}; display: flex; align-items: center; gap: 8px; transition: color 0.4s ease;">
                <span id="intro-dot-pulse" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${tokens.primary}; box-shadow: 0 0 10px ${tokens.primary}; animation: introDotPulse 1.2s infinite ease-in-out;"></span>
                ENTERING UNIVERSE
            </span>
        `;

        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            width: 140px;
            height: 3px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 999px;
            overflow: hidden;
            position: relative;
        `;

        this.progressFill = document.createElement('div');
        this.progressFill.id = 'intro-progress-fill';
        this.progressFill.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 100%;
            background: linear-gradient(90deg, ${tokens.primary}, ${tokens.accent}, #FFFFFF);
            border-radius: 999px;
            animation: introProgressShimmer 1.8s infinite cubic-bezier(0.65, 0, 0.35, 1);
            transition: background 0.5s ease;
        `;
        this.progressBar.appendChild(this.progressFill);

        this.loaderBlock.appendChild(this.loadingText);
        this.loaderBlock.appendChild(this.progressBar);
        this.centerContainer.appendChild(this.loaderBlock);

        // Skip Button
        this.skipButton = document.createElement('button');
        this.skipButton.id = 'anify-intro-skip';
        this.skipButton.innerHTML = `
            <span>Skip</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;display:inline-block;vertical-align:middle;">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
        `;
        this.skipButton.style.cssText = `
            position: absolute;
            bottom: 32px;
            right: 32px;
            padding: 9px 18px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.16);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: rgba(255, 255, 255, 0.85);
            border-radius: 999px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.04em;
            opacity: 0;
            transform: translateY(8px);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 20;
            display: flex;
            align-items: center;
            gap: 2px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        `;

        this.skipButton.addEventListener('mouseenter', () => {
            const currentTokens = getActiveProfileTokens();
            this.skipButton.style.background = 'rgba(255, 255, 255, 0.18)';
            this.skipButton.style.borderColor = `${currentTokens.primary}80`;
            this.skipButton.style.color = '#FFFFFF';
            this.skipButton.style.transform = 'translateY(-1px) scale(1.03)';
            this.skipButton.style.boxShadow = `0 6px 24px ${currentTokens.primary}40`;
        });

        this.skipButton.addEventListener('mouseleave', () => {
            this.skipButton.style.background = 'rgba(255, 255, 255, 0.08)';
            this.skipButton.style.borderColor = 'rgba(255, 255, 255, 0.16)';
            this.skipButton.style.color = 'rgba(255, 255, 255, 0.85)';
            this.skipButton.style.transform = 'translateY(0) scale(1)';
            this.skipButton.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4)';
        });

        this.skipButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.skip();
        });

        // Click anywhere to skip after interactive readiness
        this.overlay.addEventListener('click', () => {
            if (this.canSkip) {
                this.skip();
            }
        });

        this.overlay.appendChild(this.centerContainer);
        this.overlay.appendChild(this.skipButton);
        this.container.appendChild(this.overlay);

        this.injectKeyframeStyles();
    }

    injectKeyframeStyles() {
        if (document.getElementById('anify-intro-keyframes')) return;
        const style = document.createElement('style');
        style.id = 'anify-intro-keyframes';
        style.textContent = `
            @keyframes introGlowPulse {
                0% { transform: scale(0.9); opacity: 0.6; }
                100% { transform: scale(1.15); opacity: 1; }
            }
            @keyframes introDotPulse {
                0%, 100% { transform: scale(0.8); opacity: 0.5; }
                50% { transform: scale(1.3); opacity: 1; }
            }
            @keyframes introProgressShimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
        `;
        document.head.appendChild(style);
    }

    setupThemeSync() {
        // Sync when custom event is dispatched
        window.addEventListener('profileThemeChanged', () => {
            this.syncThemeColors();
        });

        // Sync when localStorage changes across tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'anify-theme' || e.key === 'anify-user-profile') {
                this.syncThemeColors();
            }
        });

        // Sync when documentElement attributes mutate
        const observer = new MutationObserver(() => {
            this.syncThemeColors();
        });
        if (document.documentElement) {
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme', 'data-color-mode', 'class'],
            });
        }
    }

    syncThemeColors() {
        const tokens = getActiveProfileTokens();
        const isLight = tokens.isLight;

        // 1. Update GlitterWrap Starfield Particle Colors
        if (this.glitterWrap) {
            this.glitterWrap.setProps({
                color1: isLight ? '#718096' : '#ffffff',
                color2: tokens.primary,
                color3: tokens.accent,
            });
        }

        // 2. Update Overlay Background
        if (this.overlay) {
            this.overlay.style.background = tokens.background || '#01010C';
        }

        // 3. Update Ambient Radial Glow
        if (this.ambientGlow) {
            this.ambientGlow.style.background = `radial-gradient(circle, ${tokens.primary}40 0%, ${tokens.accent}26 45%, transparent 70%)`;
        }

        // 4. Update Logo Filter Glow
        if (this.logo) {
            this.logo.style.filter = `drop-shadow(0 0 25px ${tokens.primary}73) drop-shadow(0 0 50px ${tokens.accent}4D)`;
        }

        // 5. Update Entering Universe Text Color (Matches profile theme on light mode)
        const enteringText = document.getElementById('intro-entering-text');
        if (enteringText) {
            enteringText.style.color = isLight ? tokens.primary : 'rgba(255, 255, 255, 0.75)';
        }

        // 6. Update Loading Dot
        const dot = document.getElementById('intro-dot-pulse');
        if (dot) {
            dot.style.background = tokens.primary;
            dot.style.boxShadow = `0 0 10px ${tokens.primary}`;
        }

        // 6. Update Progress Fill Shimmer
        if (this.progressFill) {
            this.progressFill.style.background = `linear-gradient(90deg, ${tokens.primary}, ${tokens.accent}, #FFFFFF)`;
        }
    }

    checkReducedMotion() {
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    handleKeyDown(e) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
            if (this.canSkip) {
                e.preventDefault();
                this.skip();
            }
        }
    }

    play() {
        if (!this.enabled || this.isPlaying) return;

        this.syncThemeColors();
        this.isPlaying = true;
        this.startTime = Date.now();

        if (this.overlay) {
            this.overlay.classList.remove('is-hidden');
            this.overlay.style.display = 'flex';
            this.overlay.style.opacity = '1';
            this.overlay.style.visibility = 'visible';
        }

        if (this.duration === 0) {
            this.complete();
            return;
        }

        // Clicking overlay enables instant skip
        this.overlay.onclick = () => {
            if (this.canSkip) this.skip();
        };

        // Start GlitterWrap starfield animation
        if (this.glitterWrap) {
            this.glitterWrap.start();
        }

        window.addEventListener('keydown', this.handleKeyDown);

        // Animate logo and UI in
        requestAnimationFrame(() => {
            if (this.centerContainer) {
                this.centerContainer.style.opacity = '1';
                this.centerContainer.style.transform = 'scale(1)';
            }
        });

        // Show skip button and enable interaction after short reveal
        setTimeout(() => {
            if (this.skipable && this.skipButton) {
                this.skipButton.style.opacity = '1';
                this.skipButton.style.transform = 'translateY(0)';
                this.canSkip = true;
            }
        }, 1000);

        // Animate progress bar fill smoothly from 0% to 100% across the 9 seconds
        if (this.progressFill) {
            this.progressFill.style.width = '0%';
            this.progressFill.style.transition = `width ${this.duration / 1000}s cubic-bezier(0.16, 1, 0.3, 1)`;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (this.progressFill) {
                        this.progressFill.style.width = '100%';
                    }
                });
            });
        }

        // Auto-complete after loading duration (exactly 9 seconds)
        if (this.duration > 0) {
            this.autoCompleteTimer = setTimeout(() => {
                this.complete();
            }, this.duration);
        }
    }

    dismissEarly(minDisplayTime = 9000) {
        // Kept for API compatibility; runs for full 9s duration
    }

    skip() {
        if (!this.isPlaying) return;
        this.onSkip();
        this.complete();
    }

    complete() {
        if (!this.isPlaying) return;
        this.isPlaying = false;

        if (this.autoCompleteTimer) {
            clearTimeout(this.autoCompleteTimer);
            this.autoCompleteTimer = null;
        }

        window.removeEventListener('keydown', this.handleKeyDown);

        const app = document.getElementById('app');
        if (app) {
            app.classList.remove('opacity-0');
            app.classList.add('opacity-100');
        }

        if (this.overlay) {
            this.overlay.classList.add('is-hidden');
        }

        if (window.gsap && this.overlay) {
            gsap.to(this.overlay, {
                opacity: 0,
                duration: 0.45,
                ease: 'power3.inOut',
                onComplete: () => {
                    this.finish();
                }
            });
        } else if (this.overlay) {
            this.overlay.style.transition = 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                this.finish();
            }, 450);
        } else {
            this.finish();
        }
    }

    finish() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        if (this.glitterWrap) {
            this.glitterWrap.stop();
        }
        this.canSkip = false;
        try {
            sessionStorage.setItem('anify-intro-seen', 'true');
            localStorage.setItem('anify-last-intro', Date.now().toString());
        } catch (e) { }

        this.onComplete();
    }

    destroy() {
        this.isPlaying = false;
        if (this.autoCompleteTimer) {
            clearTimeout(this.autoCompleteTimer);
            this.autoCompleteTimer = null;
        }
        window.removeEventListener('keydown', this.handleKeyDown);

        if (this.glitterWrap) {
            this.glitterWrap.destroy();
            this.glitterWrap = null;
        }
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
            this.overlay = null;
        }
    }
}

// Global Exports
let anifyIntro = null;

function initAnifyIntro(options = {}) {
    if (anifyIntro) {
        anifyIntro.destroy();
    }

    anifyIntro = new AnifyIntroAnimation(options);
    window.anifyIntro = anifyIntro;

    // Start immediately
    anifyIntro.play();
    return anifyIntro;
}

window.GlitterWrap = GlitterWrap;
window.AnifyIntroAnimation = AnifyIntroAnimation;
window.initAnifyIntro = initAnifyIntro;
window.anifyIntro = anifyIntro;