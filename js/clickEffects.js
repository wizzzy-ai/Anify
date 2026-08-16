// Anify Click Effects System
// Vanilla JavaScript implementation using GSAP
// Matches Anify's gold/purple aesthetic with premium glow effects

class AnifyClickEffects {
    constructor(options = {}) {
        this.container = document.body;
        this.color = options.color || '#FFD700'; // Gold color by default
        this.secondaryColor = options.secondaryColor || '#A855F7'; // Purple accent
        this.duration = options.duration || 0.3;
        this.strokeWidth = options.strokeWidth || 2;
        this.effectSize = options.effectSize || 90;
        this.rotation = options.rotation || 0;
        this.mode = options.mode || 'particles'; // rings, particles, burst, crosshair, wavy, sniper
        this.enabled = true;
        
        this.init();
    }
    
    init() {
        this.addClickListener();
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
            box-shadow: 0 0 10px ${this.color}, 0 0 20px ${this.secondaryColor};
            transform: rotate(${this.rotation}deg);
            z-index: 9999;
        `;
        
        document.body.appendChild(ring);
        
        gsap.fromTo(ring, 
            { scale: 0.5, opacity: 1 },
            { 
                scale: 2, 
                opacity: 0, 
                duration: this.duration * 3,
                ease: 'power3.out',
                onComplete: () => ring.remove()
            }
        );
    }
    
    createParticles(x, y) {
        const particleCount = 12;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = this.effectSize * 0.3 + Math.random() * this.effectSize * 0.2;
            
            particle.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                width: ${this.strokeWidth * 2}px;
                height: ${this.strokeWidth * 2}px;
                background: ${this.color};
                border-radius: 50%;
                pointer-events: none;
                box-shadow: 0 0 8px ${this.color}, 0 0 16px ${this.secondaryColor};
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
                    scale: 1,
                    opacity: 0,
                    x: finalX - x,
                    y: finalY - y,
                    duration: this.duration * 2,
                    ease: 'power2.out',
                    delay: i * 0.02,
                    onComplete: () => p.element.remove()
                }
            );
        });
    }
    
    createBurst(x, y) {
        const lineCount = 8;
        const lines = [];
        
        for (let i = 0; i < lineCount; i++) {
            const line = document.createElement('div');
            const angle = (i / lineCount) * Math.PI * 2;
            
            line.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                width: ${this.strokeWidth}px;
                height: ${this.effectSize * 0.3}px;
                background: linear-gradient(to top, ${this.color}, ${this.secondaryColor});
                pointer-events: none;
                box-shadow: 0 0 10px ${this.color};
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
                    scaleY: 1,
                    opacity: 0,
                    duration: this.duration * 2,
                    ease: 'power2.out',
                    delay: i * 0.03,
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
            box-shadow: 0 0 10px ${this.color}, 0 0 20px ${this.secondaryColor};
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
            box-shadow: 0 0 10px ${this.color}, 0 0 20px ${this.secondaryColor};
            transform: translateX(-50%);
        `;
        
        crosshair.appendChild(horizontal);
        crosshair.appendChild(vertical);
        document.body.appendChild(crosshair);
        
        gsap.fromTo(crosshair,
            { scale: 0.5, opacity: 1, rotation: this.rotation },
            {
                scale: 1.5,
                opacity: 0,
                rotation: this.rotation + 45,
                duration: this.duration * 2,
                ease: 'power2.out',
                onComplete: () => crosshair.remove()
            }
        );
    }
    
    createWavy(x, y) {
        const waveCount = 3;
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
                box-shadow: 0 0 10px ${this.color}, 0 0 20px ${this.secondaryColor};
                z-index: 9999;
            `;
            
            document.body.appendChild(wave);
            waves.push(wave);
        }
        
        waves.forEach((wave, i) => {
            gsap.fromTo(wave,
                { scale: 0.3, opacity: 1 },
                {
                    scale: 2,
                    opacity: 0,
                    duration: this.duration * 2,
                    ease: 'power2.out',
                    delay: i * 0.1,
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
            width: ${this.effectSize * 0.6}px;
            height: ${this.effectSize * 0.6}px;
            border: ${this.strokeWidth}px solid ${this.color};
            border-radius: 50%;
            box-shadow: 0 0 10px ${this.color}, 0 0 20px ${this.secondaryColor}, inset 0 0 20px ${this.secondaryColor};
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
            box-shadow: 0 0 10px ${this.color};
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
            box-shadow: 0 0 10px ${this.color};
            transform: translateX(-50%);
        `;
        
        sniper.appendChild(scope);
        sniper.appendChild(hLine);
        sniper.appendChild(vLine);
        document.body.appendChild(sniper);
        
        gsap.fromTo(sniper,
            { scale: 0.2, opacity: 1, rotation: this.rotation },
            {
                scale: 1,
                opacity: 0,
                rotation: this.rotation + 90,
                duration: this.duration * 2,
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
    }
    
    setSecondaryColor(color) {
        this.secondaryColor = color;
    }
    
    setDuration(duration) {
        this.duration = duration;
    }
    
    setEffectSize(size) {
        this.effectSize = size;
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
    strokeWidth: 2,
    effectSize: 80
});

// Make it globally accessible
window.anifyClickEffects = anifyClickEffects;