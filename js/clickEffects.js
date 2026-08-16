// Anify Click Effects System
// Vanilla JavaScript implementation using GSAP
// Matches Anify's gold/purple aesthetic with premium glow effects
// Automatically adapts to current theme colors

class AnifyClickEffects {
    constructor(options = {}) {
        this.container = document.body;
        this.color = options.color || '#FFD700'; // Gold color by default
        this.secondaryColor = options.secondaryColor || '#A855F7'; // Purple accent
        this.duration = options.duration || 0.4;
        this.strokeWidth = options.strokeWidth || 3;
        this.effectSize = options.effectSize || 120; // Increased from 90 to 120
        this.rotation = options.rotation || 0;
        this.mode = options.mode || 'particles'; // rings, particles, burst, crosshair, wavy, sniper
        this.enabled = true;
        this.useThemeColors = options.useThemeColors !== false; // Default to true
        
        this.init();
    }
    
    init() {
        this.addClickListener();
        this.setupThemeListener();
        this.updateThemeColors(); // Initial theme color update
    }
    
    setupThemeListener() {
        // Listen for theme changes
        const observer = new MutationObserver(() => {
            this.updateThemeColors();
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-color-mode', 'data-theme', 'class']
        });
        
        // Also listen for storage changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'anify-theme' || e.key === 'anify-user-profile') {
                this.updateThemeColors();
            }
        });
    }
    
    updateThemeColors() {
        if (!this.useThemeColors) return;
        
        const isLight = document.documentElement.classList.contains('light');
        const computedStyle = getComputedStyle(document.documentElement);
        
        // Get theme colors from CSS variables
        const primary = computedStyle.getPropertyValue('--primary').trim() || '#FFD700';
        const surface = computedStyle.getPropertyValue('--surface').trim() || '#A855F7';
        
        // Set colors based on theme
        if (isLight) {
            this.color = '#B8860B'; // Darker gold for light mode
            this.secondaryColor = '#6B21A8'; // Darker purple for light mode
        } else {
            this.color = '#FFD700'; // Bright gold for dark mode
            this.secondaryColor = '#A855F7'; // Bright purple for dark mode
        }
    }
    
    addClickListener() {
        document.addEventListener('click', (e) => {
            if (!this.enabled) return;
            this.createEffect(e.clientX, e.clientY);
        });
    }
    
    createEffect(x, y) {
        switch(this.mode) {
            case 'rings':
                this.createRings(x, y);
                break;
            case 'particles':
                this.createParticles(x, y);
                break;
            case 'burst':
                this.createBurst(x, y);
                break;
            case 'crosshair':
                this.createCrosshair(x, y);
                break;
            case 'wavy':
                this.createWavy(x, y);
                break;
            case 'sniper':
                this.createSniper(x, y);
                break;
            default:
                this.createParticles(x, y);
        }
    }
    
    createRings(x, y) {
        const ring = document.createElement('div');
        ring.style.cssText = `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            border: ${this.strokeWidth}px solid ${this.color};
            border-radius: 50%;
            pointer-events: none;
            box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor}, 0 0 45px ${this.color};
            transform: rotate(${this.rotation}deg);
            z-index: 9999;
        `;
        
        document.body.appendChild(ring);
        
        gsap.fromTo(ring, 
            { scale: 0.3, opacity: 1 },
            { 
                scale: 2.5, 
                opacity: 0, 
                duration: this.duration * 3,
                ease: 'power3.out',
                onComplete: () => ring.remove()
            }
        );
    }
    
    createParticles(x, y) {
        const particleCount = 16; // Increased from 12
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = this.effectSize * 0.4 + Math.random() * this.effectSize * 0.3; // Increased distance
            
            particle.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                width: ${this.strokeWidth * 2.5}px;
                height: ${this.strokeWidth * 2.5}px;
                background: ${this.color};
                border-radius: 50%;
                pointer-events: none;
                box-shadow: 0 0 12px ${this.color}, 0 0 24px ${this.secondaryColor}, 0 0 36px ${this.color};
                z-index: 9999;
            `;
            
            document.body.appendChild(particle);
            particles.push({ element: particle, angle, distance });
        }
        
        particles.forEach((p, i) => {
            const finalX = x + Math.cos(p.angle) * p.distance;
            const finalY = y + Math.sin(p.angle) * p.distance;
            
            gsap.fromTo(p.element,
                { scale: 0, opacity: 1 },
                {
                    scale: 1.2,
                    opacity: 0,
                    x: finalX - x,
                    y: finalY - y,
                    duration: this.duration * 2.5,
                    ease: 'power2.out',
                    delay: i * 0.025,
                    onComplete: () => p.element.remove()
                }
            );
        });
    }
    
    createBurst(x, y) {
        const lineCount = 12; // Increased from 8
        const lines = [];
        
        for (let i = 0; i < lineCount; i++) {
            const line = document.createElement('div');
            const angle = (i / lineCount) * Math.PI * 2;
            
            line.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                width: ${this.strokeWidth}px;
                height: ${this.effectSize * 0.4}px;
                background: linear-gradient(to top, ${this.color}, ${this.secondaryColor});
                pointer-events: none;
                box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor};
                transform-origin: bottom center;
                z-index: 9999;
            `;
            
            line.style.transform = `rotate(${angle * 180 / Math.PI}deg)`;
            
            document.body.appendChild(line);
            lines.push({ element: line, angle });
        }
        
        lines.forEach((l, i) => {
            gsap.fromTo(l.element,
                { scaleY: 0, opacity: 1 },
                {
                    scaleY: 1.2,
                    opacity: 0,
                    duration: this.duration * 2.5,
                    ease: 'power2.out',
                    delay: i * 0.035,
                    onComplete: () => l.element.remove()
                }
            );
        });
    }
    
    createCrosshair(x, y) {
        const crosshair = document.createElement('div');
        crosshair.style.cssText = `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            pointer-events: none;
            z-index: 9999;
        `;
        
        // Create cross lines
        const horizontal = document.createElement('div');
        horizontal.style.cssText = `
            position: absolute;
            left: 0;
            top: 50%;
            width: 100%;
            height: ${this.strokeWidth}px;
            background: ${this.color};
            box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor};
            transform: translateY(-50%);
        `;
        
        const vertical = document.createElement('div');
        vertical.style.cssText = `
            position: absolute;
            left: 50%;
            top: 0;
            width: ${this.strokeWidth}px;
            height: 100%;
            background: ${this.color};
            box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor};
            transform: translateX(-50%);
        `;
        
        crosshair.appendChild(horizontal);
        crosshair.appendChild(vertical);
        document.body.appendChild(crosshair);
        
        gsap.fromTo(crosshair,
            { scale: 0.3, opacity: 1, rotation: this.rotation },
            {
                scale: 1.8,
                opacity: 0,
                rotation: this.rotation + 45,
                duration: this.duration * 2.5,
                ease: 'power2.out',
                onComplete: () => crosshair.remove()
            }
        );
    }
    
    createWavy(x, y) {
        const waveCount = 4; // Increased from 3
        const waves = [];
        
        for (let i = 0; i < waveCount; i++) {
            const wave = document.createElement('div');
            wave.style.cssText = `
                position: fixed;
                left: ${x - this.effectSize / 2}px;
                top: ${y - this.effectSize / 2}px;
                width: ${this.effectSize}px;
                height: ${this.effectSize}px;
                border: ${this.strokeWidth}px solid ${this.color};
                border-radius: 50%;
                pointer-events: none;
                box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor}, 0 0 45px ${this.color};
                z-index: 9999;
            `;
            
            document.body.appendChild(wave);
            waves.push(wave);
        }
        
        waves.forEach((wave, i) => {
            gsap.fromTo(wave,
                { scale: 0.2, opacity: 1 },
                {
                    scale: 2.5,
                    opacity: 0,
                    duration: this.duration * 2.5,
                    ease: 'power2.out',
                    delay: i * 0.12,
                    onComplete: () => wave.remove()
                }
            );
        });
    }
    
    createSniper(x, y) {
        const sniper = document.createElement('div');
        sniper.style.cssText = `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            pointer-events: none;
            z-index: 9999;
        `;
        
        // Create sniper scope
        const scope = document.createElement('div');
        scope.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            width: ${this.effectSize * 0.7}px;
            height: ${this.effectSize * 0.7}px;
            border: ${this.strokeWidth}px solid ${this.color};
            border-radius: 50%;
            box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor}, inset 0 0 30px ${this.secondaryColor};
            transform: translate(-50%, -50%);
        `;
        
        // Create cross lines
        const hLine = document.createElement('div');
        hLine.style.cssText = `
            position: absolute;
            left: 0;
            top: 50%;
            width: 100%;
            height: ${this.strokeWidth}px;
            background: ${this.color};
            box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor};
            transform: translateY(-50%);
        `;
        
        const vLine = document.createElement('div');
        vLine.style.cssText = `
            position: absolute;
            left: 50%;
            top: 0;
            width: ${this.strokeWidth}px;
            height: 100%;
            background: ${this.color};
            box-shadow: 0 0 15px ${this.color}, 0 0 30px ${this.secondaryColor};
            transform: translateX(-50%);
        `;
        
        sniper.appendChild(scope);
        sniper.appendChild(hLine);
        sniper.appendChild(vLine);
        document.body.appendChild(sniper);
        
        gsap.fromTo(sniper,
            { scale: 0.15, opacity: 1, rotation: this.rotation },
            {
                scale: 1.2,
                opacity: 0,
                rotation: this.rotation + 90,
                duration: this.duration * 2.5,
                ease: 'power2.out',
                onComplete: () => sniper.remove()
            }
        );
    }
    
    setMode(mode) {
        this.mode = mode;
    }
    
    setColor(color) {
        this.color = color;
        this.useThemeColors = false; // Disable auto theme when manually set
    }
    
    setSecondaryColor(color) {
        this.secondaryColor = color;
        this.useThemeColors = false; // Disable auto theme when manually set
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
        // Remove any remaining effects
        const effects = document.querySelectorAll('[style*="z-index: 9999"]');
        effects.forEach(effect => effect.remove());
    }
}

// Initialize with Anify's aesthetic
const anifyClickEffects = new AnifyClickEffects({
    color: '#FFD700', // Gold
    secondaryColor: '#A855F7', // Purple
    mode: 'particles', // Default effect
    duration: 0.4,
    strokeWidth: 3, // Increased from 2
    effectSize: 120, // Increased from 90
    useThemeColors: true // Automatically adapt to theme
});

// Make it globally accessible
window.anifyClickEffects = anifyClickEffects;