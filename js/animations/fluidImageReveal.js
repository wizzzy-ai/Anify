(function () {
    const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;
    const fragmentShader = `
        varying vec2 vUv;
        uniform float uProgress;
        uniform vec2 uSize;
        uniform vec2 uImageSize;
        uniform sampler2D uTexture;
        uniform float uBlobCount;
        const float PI = 3.1415926538;

        float wave(vec2 point) {
            float angle = atan(point.y, point.x) + uProgress * PI;
            float a = (cos(angle) + 1.0) * 0.5;
            float b = (sin(angle * 2.0) + 1.0) * 0.5;
            float c = (cos(angle * 3.0) + 1.0) * 0.5;
            return (a + b + c) / 3.0;
        }

        float softMin(float a, float b, float k) {
            float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
            return mix(b, a, h) - k * h * (1.0 - h);
        }

        void main() {
            vec2 coverUv = vUv;
            float containerAspect = uSize.x / max(uSize.y, 1.0);
            float imageAspect = uImageSize.x / max(uImageSize.y, 1.0);
            if (containerAspect > imageAspect) coverUv.y = (vUv.y - 0.5) * imageAspect / containerAspect + 0.5;
            else coverUv.x = (vUv.x - 0.5) * containerAspect / imageAspect + 0.5;

            vec4 image = texture2D(uTexture, coverUv);
            vec2 pixel = vUv * uSize;
            vec2 center = uSize * 0.5;
            float radius = pow(uProgress, 2.35) * length(uSize) * 0.92;
            float edge = 0.5 + sin(uProgress * 0.2) * 0.25;
            float mask = length(pixel - center) + wave(pixel - center) * radius * edge - radius;
            float blend = 50.0 / max(max(uSize.x, uSize.y), 1.0);

            for (int i = 0; i < 12; i++) {
                if (float(i) >= uBlobCount - 1.0) break;
                float angle = float(i) * 6.2831853 / max(uBlobCount - 1.0, 1.0);
                float distanceFromCenter = (0.24 + 0.18 * fract(sin(float(i) * 43.3) * 12345.6)) * min(uSize.x, uSize.y);
                vec2 offset = vec2(cos(angle), sin(angle)) * distanceFromCenter;
                float blob = length(pixel - center - offset) + wave(pixel - center - offset) * radius * 0.35 - radius;
                mask = softMin(mask, blob, blend);
            }

            float alpha = 1.0 - smoothstep(-1.5, 1.5, mask);
            gl_FragColor = vec4(image.rgb, image.a * alpha);
        }
    `;

    let Three = null;
    let importPromise = null;
    const active = new Set();

    function loadThree() {
        if (Three) return Promise.resolve(Three);
        if (!importPromise) importPromise = import(THREE_URL).then(module => { Three = module; return module; });
        return importPromise;
    }

    function canReveal(media) {
        return Boolean(media && (media.tagName === 'IMG' || media.tagName === 'VIDEO') && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    }

    function fallback(media) {
        media.style.opacity = '0';
        media.style.clipPath = 'ellipse(18% 28% at 50% 50%)';
        gsap.to(media, {
            opacity: 1,
            clipPath: 'ellipse(100% 100% at 50% 50%)',
            duration: 1.55,
            ease: 'power3.inOut',
            clearProps: 'opacity,clipPath'
        });
    }

    function reveal(container) {
        const media = container?.querySelector('img, video');
        if (!canReveal(media)) {
            if (media && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                gsap.fromTo(media, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power1.out', clearProps: 'opacity' });
            } else if (media) {
                fallback(media);
            }
            return;
        }

        destroy(container);
        const run = { container, media, renderer: null, scene: null, camera: null, mesh: null, canvas: null, tween: null, resizeObserver: null, fallbackTimer: null };
        active.add(run);
        media.style.opacity = '0';
        run.fallbackTimer = setTimeout(() => {
            if (!run.tween && active.has(run)) {
                destroy(run);
                fallback(media);
            }
        }, 3000);
        loadThree().then(THREE => {
            if (!active.has(run) || !media.isConnected) return;
            const width = Math.max(container.clientWidth, 1);
            const height = Math.max(container.clientHeight, 1);
            const canvas = document.createElement('canvas');
            canvas.className = 'fluid-image-reveal-canvas';
            container.appendChild(canvas);
            run.canvas = canvas;

            const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            renderer.setSize(width, height, false);
            const scene = new THREE.Scene();
            const camera = new THREE.Camera();
            const geometry = new THREE.PlaneGeometry(2, 2);
            const material = new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                transparent: true,
                uniforms: {
                    uProgress: { value: 0 },
                    uSize: { value: new THREE.Vector2(width, height) },
                    uImageSize: { value: new THREE.Vector2(media.videoWidth || media.naturalWidth || width, media.videoHeight || media.naturalHeight || height) },
                    uTexture: { value: null },
                    uBlobCount: { value: window.innerWidth <= 768 ? 6 : 10 }
                }
            });
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            Object.assign(run, { renderer, scene, camera, mesh });

            const draw = () => renderer.render(scene, camera);
            const startReveal = texture => {
                if (!active.has(run)) { texture.dispose(); return; }
                const textureWidth = texture.image?.videoWidth || texture.image?.naturalWidth || texture.image?.width;
                const textureHeight = texture.image?.videoHeight || texture.image?.naturalHeight || texture.image?.height;
                if (textureWidth && textureHeight) {
                    material.uniforms.uImageSize.value.set(textureWidth, textureHeight);
                }
                clearTimeout(run.fallbackTimer);
                run.fallbackTimer = null;
                material.uniforms.uTexture.value = texture;
                draw();
                run.tween = gsap.to(material.uniforms.uProgress, {
                    value: 1,
                    duration: 1.7,
                    ease: 'power3.out',
                    onUpdate: draw,
                    onComplete: () => {
                        run.tween = null;
                    }
                });
            };
            const fail = () => {
                destroy(run);
                fallback(media);
            };

            if (media.tagName === 'VIDEO') {
                media.crossOrigin = 'anonymous';
                const beginVideo = () => {
                    try {
                        const texture = new THREE.VideoTexture(media);
                        material.uniforms.uImageSize.value.set(media.videoWidth || width, media.videoHeight || height);
                        texture.colorSpace = THREE.SRGBColorSpace;
                        startReveal(texture);
                    } catch (error) {
                        fail(error);
                    }
                };
                if (media.readyState >= 2) beginVideo();
                else {
                    media.addEventListener('loadeddata', beginVideo, { once: true });
                    media.addEventListener('error', fail, { once: true });
                }
            } else {
                const textureLoader = new THREE.TextureLoader();
                textureLoader.setCrossOrigin('anonymous');
                textureLoader.load(media.currentSrc || media.src, startReveal, undefined, fail);
            }

            run.resizeObserver = new ResizeObserver(() => {
                const nextWidth = Math.max(container.clientWidth, 1);
                const nextHeight = Math.max(container.clientHeight, 1);
                renderer.setSize(nextWidth, nextHeight, false);
                material.uniforms.uSize.value.set(nextWidth, nextHeight);
                draw();
            });
            run.resizeObserver.observe(container);
        }).catch(() => fallback(media));
    }

    function destroy(target) {
        [...active].filter(run => run === target || run.container === target).forEach(run => {
            active.delete(run);
            clearTimeout(run.fallbackTimer);
            run.fallbackTimer = null;
            run.tween?.kill();
            run.resizeObserver?.disconnect();
            run.mesh?.material?.uniforms?.uTexture?.value?.dispose?.();
            run.mesh?.geometry?.dispose?.();
            run.mesh?.material?.dispose?.();
            run.renderer?.dispose?.();
            run.canvas?.remove();
            if (run.media?.isConnected) run.media.style.opacity = '1';
        });
    }

    window.AnifyFluidImageReveal = { canReveal, reveal, destroy, destroyAll: () => [...active].forEach(destroy) };
})();
