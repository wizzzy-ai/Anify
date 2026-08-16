// Anify Click Effects System
// Exact animations from Originkit React component
// Converted to vanilla JavaScript while preserving original animation logic

class AnifyClickEffects {
    constructor(options = {}) {
        this.container = document.body;
        this.color = options.color || '#ffffff';
        this.interactionMode = options.interactionMode || 'sniper';
        this.duration = options.duration || 0.3;
        this.strokeWidth = options.strokeWidth || 2;
        this.effectSize = options.effectSize || 90;
        this.rotation = options.rotation || 0;
        this.enabled = true;
        this.useThemeColors = options.useThemeColors !== false;
        
        this.rings = [];
        this.bursts = [];
        this.particles = [];
        this.crosshairs = [];
        this.wavies = [];
        this.snipers = [];
        
        this.init();
    }
    
    init() {
        this.addClickListener();
        this.setupThemeListener();
        this.updateThemeColors();
    }
    
    setupThemeListener() {
        const observer = new MutationObserver(() => {
            this.updateThemeColors();
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-color-mode', 'data-theme', 'class']
        });
        
        window.addEventListener('storage', (e) => {
            if (e.key === 'anify-theme' || e.key === 'anify-user-profile') {
                this.updateThemeColors();
            }
        });
        
        window.addEventListener('profileThemeChanged', () => {
            this.updateThemeColors();
        });
        
        setInterval(() => {
            this.updateThemeColors();
        }, 2000);
    }
    
    updateThemeColors() {
        if (!this.useThemeColors) return;
        
        try {
            const userProfile = JSON.parse(localStorage.getItem('anify-user-profile') || '{}');
            const profileTheme = userProfile.profileTheme || 'default';
            
            const profileConfig = window.getProfileConfig?.();
            const themeData = profileConfig?.PROFILE_THEMES?.[profileTheme] || profileConfig?.PROFILE_THEMES?.['default'];
            
            if (themeData) {
                const isLight = document.documentElement.classList.contains('light');
                const tokens = isLight ? themeData.lightTokens : themeData.tokens;
                
                this.color = tokens?.primary || '#FFD700';
                this.secondaryColor = tokens?.accent || '#A855F7';
            } else {
                const isLight = document.documentElement.classList.contains('light');
                this.color = isLight ? '#B8860B' : '#FFD700';
                this.secondaryColor = isLight ? '#6B21A8' : '#A855F7';
            }
        } catch (error) {
            console.error('Error updating theme colors:', error);
            const isLight = document.documentElement.classList.contains('light');
            this.color = isLight ? '#B8860B' : '#FFD700';
            this.secondaryColor = isLight ? '#6B21A8' : '#A855F7';
        }
    }
    
    addClickListener() {
        document.addEventListener('click', (e) => {
            if (!this.enabled) return;
            this.createEffect(e.clientX, e.clientY);
        });
    }
    
    createEffect(x, y) {
        const id = `${Date.now()}-${Math.round(x)}-${Math.round(y)}`;
        
        switch(this.interactionMode) {
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
                this.createSniper(id, x, y);
                break;
            default:
                this.createParticles(id, x, y);
        }
    }
    
    // Exact Originkit ring animation
    createRings(id, x, y) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.setAttribute('style', `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${this.rotation}deg);
            transform-origin: center;
            z-index: 9999;
        `);
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', this.effectSize / 2);
        circle.setAttribute('cy', this.effectSize / 2);
        circle.setAttribute('r', this.effectSize / 4);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', this.color);
        circle.setAttribute('stroke-width', 'var(--stroke-width, 5)');
        
        ring.appendChild(circle);
        document.body.appendChild(ring);
        
        gsap.set(ring, {
            scale: 0.5,
            '--stroke-width': this.strokeWidth
        });
        
        gsap.timeline()
            .to(ring, {
                scale: 2,
                '--stroke-width': 0,
                duration: this.duration,
                ease: 'power3.out'
            }, 0)
            .to(ring, {
                opacity: 0,
                duration: this.duration * 0.2,
                ease: 'linear'
            }, this.duration * 0.8)
            .eventCallback('onComplete', () => {
                ring.remove();
                this.rings = this.rings.filter(r => r.id !== id);
            });
        
        this.rings.push({ id, x, y });
    }
    
    // Exact Originkit burst animation
    createBurst(id, x, y) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${this.rotation}deg);
            transform-origin: center;
            z-index: 9999;
        `);
        
        const angles = [45, 80, 115, 150];
        angles.forEach((angle, index) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const centerX = this.effectSize / 2;
            const centerY = this.effectSize / 2;
            const startX = centerX + this.effectSize * 0.1 * Math.cos(angle * Math.PI / 180);
            const startY = centerY - this.effectSize * 0.1 * Math.sin(angle * Math.PI / 180);
            const endX = centerX + this.effectSize * 0.25 * Math.cos(angle * Math.PI / 180);
            const endY = centerY - this.effectSize * 0.25 * Math.sin(angle * Math.PI / 180);
            
            line.setAttribute('x1', centerX);
            line.setAttribute('y1', centerY);
            line.setAttribute('x2', centerX);
            line.setAttribute('y2', centerY);
            line.setAttribute('stroke', this.color);
            line.setAttribute('stroke-width', this.strokeWidth);
            line.setAttribute('stroke-linecap', 'square');
            
            svg.appendChild(line);
            
            gsap.set(line, {
                attr: {
                    x1: startX,
                    y1: startY,
                    x2: endX,
                    y2: endY
                },
                strokeWidth: this.strokeWidth
            });
            
            gsap.timeline()
                .to(line, {
                    attr: {
                        x1: endX,
                        y1: endY,
                        x2: endX,
                        y2: endY
                    },
                    translateX: (this.effectSize / 4) * Math.cos(angle * Math.PI / 180),
                    translateY: -(this.effectSize / 4) * Math.sin(angle * Math.PI / 180),
                    duration: this.duration,
                    ease: 'power2.out'
                })
                .to(line, {
                    strokeWidth: 0,
                    duration: this.duration * 0.4,
                    ease: 'linear'
                }, this.duration * 0.6)
                .eventCallback('onComplete', () => {
                    if (index === angles.length - 1) {
                        svg.remove();
                        this.bursts = this.bursts.filter(b => b.id !== id);
                    }
                });
        });
        
        document.body.appendChild(svg);
        this.bursts.push({ id, x, y });
    }
    
    // Exact Originkit particles animation
    createParticles(id, x, y) {
        const newParticles = Array.from({ length: 8 }, (_, i) => ({
            id: `${id}-${i}`,
            x,
            y,
            angle: i * 45 * (Math.PI / 180),
            distance: this.effectSize * 0.2 + Math.random() * (this.effectSize * 0.3)
        }));
        
        newParticles.forEach(particle => {
            const div = document.createElement('div');
            div.style.cssText = `
                position: fixed;
                transform-origin: center;
                left: ${particle.x - this.strokeWidth / 2}px;
                top: ${particle.y - this.strokeWidth / 2}px;
                width: ${this.strokeWidth}px;
                height: ${this.strokeWidth}px;
                background: ${this.color};
                border-radius: 50%;
                pointer-events: none;
                transform: rotate(${this.rotation}deg);
                z-index: 9999;
            `;
            
            document.body.appendChild(div);
            
            const finalX = particle.x + Math.cos(particle.angle) * particle.distance;
            const finalY = particle.y + Math.sin(particle.angle) * particle.distance;
            
            gsap.set(div, {
                left: particle.x - this.strokeWidth / 2,
                top: particle.y - this.strokeWidth / 2,
                width: 0,
                height: 0
            });
            
            gsap.timeline()
                .to(div, {
                    width: this.strokeWidth,
                    height: this.strokeWidth,
                    duration: this.duration * 0.2,
                    ease: 'power1.out'
                })
                .to(div, {
                    left: finalX - this.strokeWidth / 2,
                    top: finalY - this.strokeWidth / 2,
                    duration: this.duration * 0.4,
                    ease: 'power1.out'
                }, this.duration * 0.2)
                .to(div, {
                    width: 0,
                    height: 0,
                    left: finalX,
                    top: finalY,
                    duration: this.duration * 0.4,
                    ease: 'linear'
                }, this.duration * 0.6)
                .eventCallback('onComplete', () => {
                    div.remove();
                    this.particles = this.particles.filter(p => p.id !== particle.id);
                });
            
            this.particles.push(particle);
        });
    }
    
    // Exact Originkit crosshair animation
    createCrosshair(id, x, y) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${this.rotation}deg);
            transform-origin: center;
            z-index: 9999;
        `);
        
        const angles = [0, 90, 180, 270];
        angles.forEach((angle, index) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const centerX = this.effectSize / 2;
            const centerY = this.effectSize / 2;
            const lineLength = this.effectSize * 0.3;
            const startX = centerX + 20 * Math.cos(angle * Math.PI / 180);
            const startY = centerY - 20 * Math.sin(angle * Math.PI / 180);
            const endX = centerX + (20 + lineLength) * Math.cos(angle * Math.PI / 180);
            const endY = centerY - (20 + lineLength) * Math.sin(angle * Math.PI / 180);
            
            line.setAttribute('x1', centerX);
            line.setAttribute('y1', centerY);
            line.setAttribute('x2', centerX);
            line.setAttribute('y2', centerY);
            line.setAttribute('stroke', this.color);
            line.setAttribute('stroke-width', this.strokeWidth);
            line.setAttribute('stroke-linecap', 'square');
            
            svg.appendChild(line);
            
            gsap.set(line, {
                attr: {
                    x1: startX,
                    y1: startY,
                    x2: centerX,
                    y2: centerY
                },
                strokeWidth: this.strokeWidth
            });
            
            gsap.timeline()
                .to(line, {
                    attr: {
                        x1: endX,
                        y1: endY,
                        x2: endX,
                        y2: endY
                    },
                    duration: this.duration * 0.8,
                    ease: 'power1.out'
                })
                .to(line, {
                    strokeWidth: 0,
                    duration: this.duration * 0.6,
                    ease: 'linear'
                }, this.duration * 0.4)
                .eventCallback('onComplete', () => {
                    if (index === angles.length - 1) {
                        svg.remove();
                        this.crosshairs = this.crosshairs.filter(c => c.id !== id);
                    }
                });
        });
        
        document.body.appendChild(svg);
        this.crosshairs.push({ id, x, y });
    }
    
    // Exact Originkit wavy animation
    createWavy(id, x, y) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${this.rotation}deg);
            transform-origin: center;
            z-index: 9999;
        `);
        
        const angles = [45, 90, 135, 180];
        angles.forEach((angle, index) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const centerX = this.effectSize / 2;
            const centerY = this.effectSize / 2;
            const startRadius = this.effectSize * 0.1;
            const endRadius = this.effectSize * 0.5;
            const rad = (angle * Math.PI) / 180;
            const startX = centerX + startRadius * Math.cos(rad);
            const startY = centerY - startRadius * Math.sin(rad);
            const endX = centerX + endRadius * Math.cos(rad);
            const endY = centerY - endRadius * Math.sin(rad);
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const waveOffset = this.effectSize * 0.05;
            const control1X = midX + waveOffset * Math.cos(rad + Math.PI / 2);
            const control1Y = midY - waveOffset * Math.sin(rad + Math.PI / 2);
            const wavyPath = `M ${startX} ${startY} Q ${control1X} ${control1Y} ${midX} ${midY} T ${endX} ${endY}`;
            
            path.setAttribute('d', wavyPath);
            path.setAttribute('stroke', this.color);
            path.setAttribute('stroke-width', this.strokeWidth);
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('fill', 'none');
            
            svg.appendChild(path);
            
            const pathLength = path.getTotalLength();
            gsap.set(path, {
                strokeDasharray: '1, ' + pathLength,
                strokeDashoffset: 0,
                strokeWidth: this.strokeWidth
            });
            
            gsap.timeline()
                .to(path, {
                    strokeDasharray: `${pathLength}, ${pathLength}`,
                    strokeDashoffset: -pathLength,
                    duration: this.duration,
                    ease: 'power1.out'
                })
                .to(path, {
                    strokeWidth: 0,
                    duration: this.duration * 0.4,
                    ease: 'linear'
                }, this.duration * 0.6)
                .eventCallback('onComplete', () => {
                    if (index === angles.length - 1) {
                        svg.remove();
                        this.wavies = this.wavies.filter(w => w.id !== id);
                    }
                });
        });
        
        document.body.appendChild(svg);
        this.wavies.push({ id, x, y });
    }
    
    // Exact Originkit sniper animation
    createSniper(id, x, y) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            left: ${x - this.effectSize / 2}px;
            top: ${y - this.effectSize / 2}px;
            width: ${this.effectSize}px;
            height: ${this.effectSize}px;
            pointer-events: none;
            z-index: 9999;
        `;
        
        // SVG crosshair lines
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('style', `
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: visible;
            transform: rotate(${this.rotation}deg);
            transform-origin: center;
        `);
        
        const angles = [0, 90, 180, 270];
        angles.forEach((angle, index) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const centerX = this.effectSize / 2;
            const centerY = this.effectSize / 2;
            const lineLength = this.effectSize * 0.2;
            const startX = centerX + 5 * Math.cos(angle * Math.PI / 180);
            const startY = centerY - 5 * Math.sin(angle * Math.PI / 180);
            const endX = centerX + (5 + lineLength) * Math.cos(angle * Math.PI / 180);
            const endY = centerY - (5 + lineLength) * Math.sin(angle * Math.PI / 180);
            
            line.setAttribute('x1', startX);
            line.setAttribute('y1', startY);
            line.setAttribute('x2', endX);
            line.setAttribute('y2', endY);
            line.setAttribute('stroke', this.color);
            line.setAttribute('stroke-width', this.strokeWidth);
            line.setAttribute('stroke-linecap', 'square');
            
            svg.appendChild(line);
            
            gsap.set(line, {
                attr: {
                    x1: startX,
                    y1: startY,
                    x2: endX,
                    y2: endY
                },
                strokeWidth: this.strokeWidth
            });
            
            gsap.timeline()
                .to(line, {
                    attr: {
                        x1: endX,
                        y1: endY,
                        x2: endX,
                        y2: endY
                    },
                    translateX: (5 + lineLength) * Math.cos(angle * Math.PI / 180),
                    translateY: -(5 + lineLength) * Math.sin(angle * Math.PI / 180),
                    duration: this.duration,
                    ease: 'power2.out'
                })
                .to(line, {
                    strokeWidth: 0,
                    duration: this.duration * 0.4,
                    ease: 'linear'
                }, this.duration * 0.6)
                .eventCallback('onComplete', () => {
                    if (index === angles.length - 1) {
                        svg.remove();
                    }
                });
        });
        
        container.appendChild(svg);
        
        // Particle dots
        const particleAngles = [
            Math.PI / 3,
            (2 * Math.PI) / 3,
            (4 * Math.PI) / 3,
            (5 * Math.PI) / 3,
            Math.PI / 6,
            (5 * Math.PI) / 6,
            (7 * Math.PI) / 6,
            (11 * Math.PI) / 6
        ];
        
        particleAngles.forEach((angle, index) => {
            const div = document.createElement('div');
            div.style.cssText = `
                position: absolute;
                left: ${x - this.strokeWidth / 2}px;
                top: ${y - this.strokeWidth / 2}px;
                width: ${this.strokeWidth}px;
                height: ${this.strokeWidth}px;
                background: ${this.color};
                pointer-events: none;
                transform-origin: center;
                transform: rotate(${this.rotation}deg);
                z-index: 9999;
            `;
            
            container.appendChild(div);
            
            gsap.set(div, {
                x: 0,
                y: 0,
                width: this.strokeWidth,
                height: this.strokeWidth
            });
            
            gsap.timeline()
                .to(div, {
                    x: Math.cos(angle) * (this.effectSize * 0.4),
                    y: Math.sin(angle) * (this.effectSize * 0.4),
                    duration: this.duration,
                    ease: 'power2.out'
                })
                .to(div, {
                    width: 0,
                    height: 0,
                    duration: this.duration * 0.4,
                    ease: 'linear'
                }, this.duration * 0.6)
                .eventCallback('onComplete', () => {
                    if (index === particleAngles.length - 1) {
                        container.remove();
                        this.snipers = this.snipers.filter(s => s.id !== id);
                    }
                });
        });
        
        document.body.appendChild(container);
        this.snipers.push({ id, x, y });
    }
    
    setMode(mode) {
        this.interactionMode = mode;
    }
    
    setColor(color) {
        this.color = color;
        this.useThemeColors = false;
    }
    
    setSecondaryColor(color) {
        this.secondaryColor = color;
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
        document.querySelectorAll('[style*="z-index: 9999"]').forEach(effect => effect.remove());
    }
}

// Initialize with Originkit defaults and theme color adaptation
const anifyClickEffects = new AnifyClickEffects({
    color: '#ffffff',
    interactionMode: 'sniper',
    duration: 0.3,
    strokeWidth: 2,
    effectSize: 90,
    rotation: 0,
    useThemeColors: true
});

window.anifyClickEffects = anifyClickEffects;