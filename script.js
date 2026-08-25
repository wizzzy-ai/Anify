// ============ ANIFY - Main Application Script ============

// ============ URL UTILITY - Convert HTTP to HTTPS ============
function ensureHttps(url) {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/^http:/, 'https:');
}

// ============ VIEW COUNT FORMATTER (YouTube-style compact formatting) ============
function formatViewCount(views, options = { withSuffix: true }) {
    const withSuffix = options?.withSuffix !== false;
    const num = Number(views) || 0;
    if (num < 0) return withSuffix ? '0 views' : '0';

    if (num < 1000) {
        if (!withSuffix) return String(num);
        return num === 1 ? '1 view' : `${num} views`;
    }

    function formatNumberWithUnit(n, divisor, unit) {
        const val = n / divisor;
        let str = val.toFixed(2);
        if (str.endsWith('.00')) {
            str = str.slice(0, -3);
        } else if (str.endsWith('0')) {
            str = str.slice(0, -1);
        }
        return `${str}${unit}`;
    }

    let formatted = '';
    if (num >= 1000000000) {
        formatted = formatNumberWithUnit(num, 1000000000, 'B');
    } else if (num >= 1000000) {
        formatted = formatNumberWithUnit(num, 1000000, 'M');
    } else {
        formatted = formatNumberWithUnit(num, 1000, 'K');
    }

    return withSuffix ? `${formatted} views` : formatted;
}
window.formatViewCount = formatViewCount;

// ============ COMING SOON HELPER FUNCTIONS ============
function formatReleaseDate(releaseDate, releaseTime) {
    if (!releaseDate) return 'To be announced';

    const date = getReleaseDateTime(releaseDate, releaseTime);
    if (!date) return 'To be announced';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    let formatted = date.toLocaleDateString('en-US', options);
    
    if (releaseTime) {
        formatted += ` • ${releaseTime}`;
    }
    
    return formatted;
}

function getReleaseDateTime(releaseDate, releaseTime = '') {
    if (!releaseDate) return null;
    let raw = String(releaseDate);
    // Date-only values are local calendar dates in the admin UI. Append the
    // optional local time before parsing so the countdown matches the display.
    if (releaseTime && /^\d{4}-\d{2}-\d{2}$/.test(raw)) raw += `T${releaseTime}`;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getCountdown(releaseDate, releaseTime = '') {
    const release = getReleaseDateTime(releaseDate, releaseTime);
    if (!release) return null;
    const now = new Date();
    const diff = release - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds };
}

function renderCountdown(releaseDate, releaseTime = '', animeId = '') {
    const countdown = getCountdown(releaseDate, releaseTime);
    if (!countdown) return '';
    const parsedReleaseDate = getReleaseDateTime(releaseDate, releaseTime);
    return `
        <div class="coming-soon-countdown" data-release-date="${parsedReleaseDate.toISOString()}" data-anime-id="${animeId}">
            <div class="countdown-item">
                <span class="countdown-value countdown-days">${String(countdown.days).padStart(2, '0')}</span>
                <span class="countdown-label">DAYS</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value countdown-hours">${String(countdown.hours).padStart(2, '0')}</span>
                <span class="countdown-label">HOURS</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value countdown-minutes">${String(countdown.minutes).padStart(2, '0')}</span>
                <span class="countdown-label">MINUTES</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value countdown-seconds">${String(countdown.seconds).padStart(2, '0')}</span>
                <span class="countdown-label">SECONDS</span>
            </div>
        </div>
    `;
}

function startCountdownUpdates() {
    // Clear existing interval if any
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    const updateCountdown = (countdownEl) => {
            const releaseDateStr = countdownEl.dataset.releaseDate;
            if (!releaseDateStr) return;
            
            const countdown = getCountdown(releaseDateStr);
            
            if (!countdown) {
                // Re-fetch the anime so the server's status/episode data controls
                // the transition instead of inventing availability in the client.
                countdownEl.innerHTML = '<span class="text-gold-400 font-bold">NOW AVAILABLE</span>';
                const animeId = countdownEl.dataset.animeId;
                if (animeId && !countdownEl.dataset.refreshStarted) {
                    countdownEl.dataset.refreshStarted = 'true';
                    if (typeof loadAnimeFromApi === 'function') {
                        loadAnimeFromApi().then(() => navigate('anime', Number(animeId))).catch(() => {});
                    }
                }
                return;
            }
            
            const daysEl = countdownEl.querySelector('.countdown-days');
            const hoursEl = countdownEl.querySelector('.countdown-hours');
            const minutesEl = countdownEl.querySelector('.countdown-minutes');
            const secondsEl = countdownEl.querySelector('.countdown-seconds');
            
            if (daysEl) daysEl.textContent = String(countdown.days).padStart(2, '0');
            if (hoursEl) hoursEl.textContent = String(countdown.hours).padStart(2, '0');
            if (minutesEl) minutesEl.textContent = String(countdown.minutes).padStart(2, '0');
            if (secondsEl) secondsEl.textContent = String(countdown.seconds).padStart(2, '0');
    };

    // Paint the current value immediately, then keep it synchronized every
    // second. The immediate pass also handles content inserted after routing.
    const updateAll = () => document.querySelectorAll('.coming-soon-countdown[data-release-date]').forEach(updateCountdown);
    updateAll();
    window.countdownInterval = setInterval(updateAll, 1000);
}

// ============ BAN CHECK - Run immediately on page load ============
(async function checkBanStatus() {
    const token = localStorage.getItem('anify-token');
    
    if (!token) return;

    try {
        // Verify ban status with server instead of relying on stale localStorage
        const response = await fetch('/api/auth/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.ok && data.user && data.user.status === 'Banned') {
                console.log('[Ban Check] Server confirmed user is banned, redirecting to banned page');
                // Update localStorage with fresh data
                localStorage.setItem('anify-user-profile', JSON.stringify(data.user));
                window.location.replace('/account-banned');
            } else {
                // User is not banned, clear any stale ban data from localStorage
                const userInfo = JSON.parse(localStorage.getItem('anify-user-profile') || '{}');
                if (userInfo.status === 'Banned' || userInfo.banInfo) {
                    console.log('[Ban Check] Clearing stale ban data from localStorage');
                    userInfo.status = data.user?.status || 'Active';
                    delete userInfo.banInfo;
                    localStorage.setItem('anify-user-profile', JSON.stringify(userInfo));
                }
            }
        }
    } catch (error) {
        console.error('[Ban Check] Failed to verify ban status with server:', error);
        // On error, fall back to localStorage check (but this is less reliable)
        const userInfo = JSON.parse(localStorage.getItem('anify-user-profile') || '{}');
        if (userInfo.status === 'Banned') {
            console.log('[Ban Check] Server check failed, using localStorage data');
            window.location.replace('/account-banned');
        }
    }
})();

// ============ COUNTRY DETECTION ============
(async function detectCountry() {
    try {
        // Request country from our server (secure backend calls IPinfo)
        const response = await fetch('/api/country');
        
        if (!response.ok) {
            throw new Error('Geolocation service unavailable');
        }
        
        const data = await response.json();
        
        if (data.ok && data.country) {
            const countryCodeElement = document.getElementById('country-code');
            if (countryCodeElement) {
                countryCodeElement.textContent = data.country;
                countryCodeElement.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.log('[Country Detection] Unable to detect country:', error.message);
        // Fail silently - country code simply won't be displayed
    }
})();

// ============ DATA ============
const animeData = [
    { id: 1, title: "Attack on Titan", titleJp: "進撃の巨人", rating: 9.0, year: 2013, episodes: 87, genres: ["Action", "Drama", "Fantasy"], status: "Completed", studio: "MAPPA", image: "http://static.photos/technology/640x360/1", banner: "http://static.photos/technology/1200x630/1", desc: "Humanity lives within cities surrounded by enormous walls due to the Titans, gigantic humanoid beings. The story follows Eren Yeager, who vows to exterminate the Titans after they bring about the destruction of his hometown and the death of his mother.", featured: true, trending: true, premium: false, newEpisode: false },
    { id: 2, title: "Jujutsu Kaisen", titleJp: "呪術廻戦", rating: 8.7, year: 2020, episodes: 48, genres: ["Action", "Supernatural", "Horror"], status: "Airing", studio: "MAPPA", image: "http://static.photos/nature/640x360/2", banner: "http://static.photos/nature/1200x630/2", desc: "A boy swallows a cursed talisman and becomes host to a powerful curse. He enrolls in a school of sorcerers to locate and consume all of the cursed fingers of a demon named Sukuna.", featured: false, trending: true, premium: true, newEpisode: true },
    { id: 3, title: "Demon Slayer", titleJp: "鬼滅の刃", rating: 8.9, year: 2019, episodes: 55, genres: ["Action", "Supernatural", "Adventure"], status: "Airing", studio: "ufotable", image: "http://static.photos/abstract/640x360/3", banner: "http://static.photos/abstract/1200x630/3", desc: "A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon slowly. Tanjiro sets out to become a demon slayer to avenge his family and cure his sister.", featured: false, trending: true, premium: false, newEpisode: true },
    { id: 4, title: "One Piece", titleJp: "ワンピース", rating: 8.6, year: 1999, episodes: 1100, genres: ["Action", "Adventure", "Comedy"], status: "Airing", studio: "Toei", image: "http://static.photos/travel/640x360/4", banner: "http://static.photos/travel/1200x630/4", desc: "Monkey D. Luffy sets off on an adventure with his pirate crew in hopes of finding the greatest treasure ever, known as 'One Piece'.", featured: false, trending: false, premium: false, newEpisode: false },
    { id: 5, title: "My Hero Academia", titleJp: "僕のヒーローアカデミア", rating: 8.4, year: 2016, episodes: 138, genres: ["Action", "Superhero", "Comedy"], status: "Airing", studio: "Bones", image: "http://static.photos/people/640x360/5", banner: "http://static.photos/people/1200x630/5", desc: "In a world where most people have superpowers called 'Quirks', a boy born without them dreams of becoming a superhero.", featured: false, trending: true, premium: false, newEpisode: false },
    { id: 6, title: "Spy x Family", titleJp: "スパイファミリー", rating: 8.5, year: 2022, episodes: 37, genres: ["Comedy", "Action", "Slice of Life"], status: "Airing", studio: "WIT Studio", image: "http://static.photos/minimal/640x360/6", banner: "http://static.photos/minimal/1200x630/6", desc: "A spy must build a family to execute a mission, not realizing that the girl he adopts is a telepath and his wife is an assassin.", featured: false, trending: true, premium: false, newEpisode: true },
    { id: 7, title: "Solo Leveling", titleJp: "俺だけレベルアップな件", rating: 8.8, year: 2024, episodes: 12, genres: ["Action", "Fantasy", "Adventure"], status: "Completed", studio: "A-1 Pictures", image: "http://static.photos/technology/640x360/7", banner: "http://static.photos/technology/1200x630/7", desc: "In a world where hunters must battle deadly monsters to protect humanity, Sung Jinwoo, the weakest hunter, gains a mysterious power that allows him to level up infinitely.", featured: true, trending: true, premium: true, newEpisode: false },
    { id: 8, title: "Frieren: Beyond Journey's End", titleJp: "葬送のフリーレン", rating: 9.1, year: 2023, episodes: 28, genres: ["Fantasy", "Adventure", "Drama"], status: "Completed", studio: "Madhouse", image: "http://static.photos/nature/640x360/8", banner: "http://static.photos/nature/1200x630/8", desc: "An elf mage reflects on her journey with heroes who defeated the Demon King, embarking on a new quest to understand human emotions and the meaning of time.", featured: false, trending: true, premium: false, newEpisode: false },
    { id: 9, title: "Chainsaw Man", titleJp: "チェンソーマン", rating: 8.3, year: 2022, episodes: 12, genres: ["Action", "Horror", "Supernatural"], status: "Completed", studio: "MAPPA", image: "http://static.photos/abstract/640x360/9", banner: "http://static.photos/abstract/1200x630/9", desc: "A young man merges with his devil dog and becomes the Chainsaw Man, a being capable of consuming devils to absorb their powers.", featured: false, trending: false, premium: true, newEpisode: false },
    { id: 10, title: "Violet Evergarden", titleJp: "ヴァイオレット・エヴァーガーデン", rating: 9.0, year: 2018, episodes: 13, genres: ["Drama", "Romance", "Slice of Life"], status: "Completed", studio: "Kyoto Animation", image: "http://static.photos/vintage/640x360/10", banner: "http://static.photos/vintage/1200x630/10", desc: "A former soldier discovers the meaning of love as she writes letters for others, searching for the meaning behind her commanding officer's final words.", featured: false, trending: false, premium: false, newEpisode: false },
    { id: 11, title: "Tokyo Revengers", titleJp: "東京リベンジャーズ", rating: 8.2, year: 2021, episodes: 50, genres: ["Action", "Drama", "Thriller"], status: "Completed", studio: "LIDENFILMS", image: "http://static.photos/cityscape/640x360/11", banner: "http://static.photos/cityscape/1200x630/11", desc: "A young man travels back in time 12 years to save his girlfriend by changing the course of a dangerous Tokyo gang.", featured: false, trending: false, premium: false, newEpisode: false },
    { id: 12, title: "Mushoku Tensei", titleJp: "無職転生", rating: 8.5, year: 2021, episodes: 35, genres: ["Isekai", "Fantasy", "Adventure"], status: "Airing", studio: "Studio Bind", image: "http://static.photos/fantasy/640x360/12", banner: "http://static.photos/fantasy/1200x630/12", desc: "A 34-year-old underachiever is reincarnated in a new world of swords and sorcery, determined to live his life to the fullest.", featured: false, trending: false, premium: true, newEpisode: true },
    { id: 13, title: "Oshi no Ko", titleJp: "推しの子", rating: 8.8, year: 2023, episodes: 23, genres: ["Drama", "Supernatural", "Mystery"], status: "Airing", studio: "Doga Kobo", image: "http://static.photos/education/640x360/13", banner: "http://static.photos/education/1200x630/13", desc: "A doctor and his patient are reborn as the twin children of a famous idol, uncovering the dark side of the entertainment industry.", featured: false, trending: true, premium: false, newEpisode: true },
    { id: 14, title: "Horimiya", titleJp: "ホリミヤ", rating: 8.3, year: 2021, episodes: 13, genres: ["Romance", "Comedy", "Slice of Life"], status: "Completed", studio: "CloverWorks", image: "http://static.photos/indoor/640x360/14", banner: "http://static.photos/indoor/1200x630/14", desc: "Two classmates discover each other's hidden sides and form an unexpected bond that blossoms into love.", featured: false, trending: false, premium: false, newEpisode: false },
    { id: 15, title: "Ranking of Kings", titleJp: "王様ランキング", rating: 8.6, year: 2021, episodes: 23, genres: ["Adventure", "Fantasy", "Drama"], status: "Completed", studio: "WIT Studio", image: "http://static.photos/craft/640x360/15", banner: "http://static.photos/craft/1200x630/15", desc: "A young prince who is deaf and wields no power fights to prove his worth in a kingdom that values strength above all.", featured: false, trending: false, premium: false, newEpisode: false },
    { id: 16, title: "Re:Zero", titleJp: "Re:ゼロから始める異世界生活", rating: 8.4, year: 2016, episodes: 50, genres: ["Isekai", "Fantasy", "Thriller"], status: "Airing", studio: "White Fox", image: "http://static.photos/science/640x360/16", banner: "http://static.photos/science/1200x630/16", desc: "A boy is transported to a fantasy world where he discovers he can return from death, living through endless cycles of suffering.", featured: false, trending: false, premium: false, newEpisode: false },
];

const categories = ["All"];
// Keep the notification inbox usable on its first render. These values are
// read whenever the bell is opened, before a user has interacted with either
// the filters or the search field.
let notificationFilter = 'All';
let notificationSearchQuery = '';
const fallbackGenres = [
    'Action','Adventure','Comedy','Drama','Fantasy','Sci-Fi','Romance','Slice of Life','Mystery','Thriller','Horror','Supernatural','Psychological','Sports','Music','Mecha','Military','Historical','Samurai','Martial Arts','Magic','Isekai','School','Shounen','Shoujo','Seinen','Josei','Ecchi','Harem','Reverse Harem','Idol','Cooking','Medical','Detective','Crime','Police','Spy','Family','Vampire','Demons','Monsters','Space','Survival','Game','Parody','Post-Apocalyptic','Superpower'
];

// Synchronously hydrate animeData from cache for instant 0ms first render
try {
    const cachedAnime = JSON.parse(localStorage.getItem('anify-cached-anime') || 'null');
    if (Array.isArray(cachedAnime) && cachedAnime.length) {
        animeData.splice(0, animeData.length, ...cachedAnime);
    }
} catch (e) {}

window.animeData = animeData;
window.categories = categories;

function createLucideIconsSafe() {
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

function getProfileConfig() {
    return window.AnifyProfileConfig || {
        DEFAULT_PROFILE_THEME: 'default',
        DEFAULT_AVATAR_ID: 'shadow',
        normalizeThemeId: (value) => String(value || 'default').toLowerCase() === 'gold' ? 'default' : String(value || 'default').toLowerCase(),
        normalizeAvatarId: (value) => String(value || 'shadow').toLowerCase(),
        getAvatarUrl: (value) => `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(value || 'anify-shadow')}`,
        PROFILE_THEME_IDS: ['default'],
        PROFILE_THEMES: {},
        PROFILE_AVATARS: [],
    };
}

function resolveProfileThemeId(themeId) {
    return getProfileConfig().normalizeThemeId(themeId);
}

function resolveProfileAvatarId(avatarId) {
    return getProfileConfig().normalizeAvatarId(avatarId);
}

const THEME_MODE_STORAGE_KEY = 'anify-theme';

const PROFILE_THEME_CSS_TOKEN_MAP = {
    primary: '--primary', primaryHover: '--primary-hover', primaryLight: '--primary-light', primaryDark: '--primary-dark',
    accent: '--accent', accentSoft: '--accent-soft', accentGold: '--accent-gold', accentPurple: '--accent-purple',
    background: '--background', surface: '--surface', surfaceHover: '--surface-hover', surfaceStrong: '--surface-strong',
    border: '--border', borderColor: '--border-color', textPrimary: '--text-primary', textSecondary: '--text-secondary', textTertiary: '--text-tertiary',
    cardBackground: '--card-background', modalBackground: '--modal-background', modalInner: '--modal-inner', hoverBackground: '--hover-background',
    overlay: '--overlay', focusRing: '--focus-ring', surfaceMuted: '--surface-muted',
    success: '--success', danger: '--danger', shadow: '--shadow-color', scrollbarThumb: '--scrollbar-thumb', scrollbarThumbHover: '--scrollbar-thumb-hover', buttonText: '--button-text',
};

function normalizeThemeMode(value) {
    return String(value || '').toLowerCase() === 'light' ? 'light' : 'dark';
}

function getStoredThemeMode() {
    return normalizeThemeMode(localStorage.getItem(THEME_MODE_STORAGE_KEY));
}

function getCurrentTheme() {
    return normalizeThemeMode(document.documentElement.dataset.colorMode || (document.documentElement.classList.contains('light') ? 'light' : 'dark'));
}

function resolveThemeTokens(theme, mode = getCurrentTheme()) {
    if (!theme) return null;
    const normalizedMode = normalizeThemeMode(mode);
    return normalizedMode === 'light' && theme.lightTokens ? theme.lightTokens : theme.tokens;
}

function resolveThemeTokenSet(theme, mode = getCurrentTheme()) {
    const tokens = resolveThemeTokens(theme, mode);
    if (!tokens) return null;
    return {
        ...tokens,
        accentGold: tokens.accentGold || tokens.primary,
        accentPurple: tokens.accentPurple || tokens.accent,
    };
}

const PROFILE_PREVIEW_CSS_TOKEN_MAP = {
    background: '--profile-preview-background',
    surface: '--profile-preview-surface',
    surfaceHover: '--profile-preview-surface-hover',
    primary: '--profile-preview-primary',
    primaryHover: '--profile-preview-primary-hover',
    primaryLight: '--profile-preview-primary-light',
    accent: '--profile-preview-accent',
    border: '--profile-preview-border',
    buttonText: '--profile-preview-button-text',
    textPrimary: '--profile-preview-text-primary',
    textSecondary: '--profile-preview-text-secondary',
    textTertiary: '--profile-preview-text-tertiary',
};

function getProfilePreviewStyle(tokens) {
    return Object.entries(PROFILE_PREVIEW_CSS_TOKEN_MAP)
        .filter(([token]) => tokens?.[token])
        .map(([token, property]) => `${property}:${tokens[token]}`)
        .join(';');
}

function applyProfilePreviewTokens(element, tokens) {
    if (!element || !tokens) return;
    Object.entries(PROFILE_PREVIEW_CSS_TOKEN_MAP).forEach(([token, property]) => {
        if (tokens[token]) element.style.setProperty(property, tokens[token]);
    });
}

function updateProfileThemePreviews(mode = getCurrentTheme()) {
    const config = getProfileConfig();
    document.querySelectorAll('[data-profile-theme-option]').forEach((option) => {
        const theme = config.PROFILE_THEMES[option.dataset.themeId];
        const tokens = resolveThemeTokenSet(theme, mode) || theme?.tokens;
        applyProfilePreviewTokens(option, tokens);
    });
}

let faviconLogoImage = null;
let faviconLogoLoaded = false;
let latestFaviconTokens = null;

function applyFaviconDataUrl(dataUrl) {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head || !dataUrl) return;

    // Remove existing favicon links so browsers immediately register the new icon
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((el) => el.remove());

    const iconLink = document.createElement('link');
    iconLink.id = 'app-favicon';
    iconLink.rel = 'icon';
    iconLink.type = 'image/png';
    iconLink.href = dataUrl;
    head.appendChild(iconLink);

    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.type = 'image/png';
    shortcutLink.href = dataUrl;
    head.appendChild(shortcutLink);

    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = dataUrl;
    head.appendChild(appleLink);
}

function renderThemeFavicon(tokens) {
    const bgColor = tokens?.background || '#01010C';
    const borderColor = tokens?.border || 'rgba(255, 255, 255, 0.12)';

    try {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            applyFaviconDataUrl('/pictures/logo2.png');
            return;
        }

        // Draw rounded square background with current active tokens.background
        const radius = 28;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(0, 0, size, size, radius);
        } else {
            ctx.moveTo(radius, 0);
            ctx.lineTo(size - radius, 0);
            ctx.quadraticCurveTo(size, 0, size, radius);
            ctx.lineTo(size, size - radius);
            ctx.quadraticCurveTo(size, size, size - radius, size);
            ctx.lineTo(radius, size);
            ctx.quadraticCurveTo(0, size, 0, size - radius);
            ctx.lineTo(0, radius);
            ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
        }
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Draw subtle border matching theme
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw logo2.png centered with comfortable padding
        if (faviconLogoImage && faviconLogoLoaded) {
            const padding = 12;
            const logoSize = size - padding * 2;
            ctx.drawImage(faviconLogoImage, padding, padding, logoSize, logoSize);
            const dataUrl = canvas.toDataURL('image/png');
            applyFaviconDataUrl(dataUrl);
        } else {
            applyFaviconDataUrl('/pictures/logo2.png');
        }
    } catch (e) {
        applyFaviconDataUrl('/pictures/logo2.png');
    }
}

function updateThemeFavicon(tokens) {
    latestFaviconTokens = tokens;
    if (!faviconLogoImage) {
        faviconLogoImage = new Image();
        faviconLogoImage.crossOrigin = 'anonymous';
        faviconLogoImage.onload = () => {
            faviconLogoLoaded = true;
            if (latestFaviconTokens) {
                renderThemeFavicon(latestFaviconTokens);
            }
        };
        faviconLogoImage.onerror = () => {
            applyFaviconDataUrl('/pictures/logo2.png');
        };
        faviconLogoImage.src = '/pictures/logo2.png';
    } else if (faviconLogoLoaded) {
        renderThemeFavicon(tokens);
    }
}

function applyProfileTheme(themeId, mode = getCurrentTheme()) {
    const config = getProfileConfig();
    const normalizedTheme = resolveProfileThemeId(themeId || config.DEFAULT_PROFILE_THEME);
    const theme = config.PROFILE_THEMES[normalizedTheme] || config.PROFILE_THEMES[config.DEFAULT_PROFILE_THEME];
    const tokens = resolveThemeTokens(theme, mode);
    const root = document.documentElement;
    root.dataset.theme = normalizedTheme;
    root.dataset.colorMode = normalizeThemeMode(mode);

    if (tokens) {
        const resolvedTokens = resolveThemeTokenSet(theme, mode);
        Object.entries(PROFILE_THEME_CSS_TOKEN_MAP).forEach(([token, property]) => {
            if (resolvedTokens[token]) root.style.setProperty(property, resolvedTokens[token]);
        });
        updateThemeFavicon(resolvedTokens);
        updateProfileThemePreviews(mode);

        // Update Hamburger Anime Ring SVG gradient stops
        const animeRingGrad = document.getElementById('animeRingGrad');
        if (animeRingGrad && resolvedTokens) {
            const stops = animeRingGrad.querySelectorAll('stop');
            if (stops.length >= 3) {
                stops[0].setAttribute('stop-color', resolvedTokens.primary || '#F59E0B');
                stops[1].setAttribute('stop-color', resolvedTokens.accent || '#A855F7');
                stops[2].setAttribute('stop-color', resolvedTokens.primaryLight || '#FDE047');
            }
        }
    }

    // Dispatch custom event for click effects to listen to
    window.dispatchEvent(new CustomEvent('profileThemeChanged', { detail: { themeId: normalizedTheme, mode } }));

    return normalizedTheme;
}

function applyTheme(theme) {
    const nextMode = normalizeThemeMode(theme);
    const root = document.documentElement;
    const isLight = nextMode === 'light';
    root.classList.toggle('light', isLight);
    root.classList.toggle('dark', !isLight);
    root.dataset.colorMode = nextMode;

    document.querySelectorAll('.theme-icon-sun').forEach((icon) => {
        icon.classList.toggle('hidden', !isLight);
    });
    document.querySelectorAll('.theme-icon-moon').forEach((icon) => {
        icon.classList.toggle('hidden', isLight);
    });
    document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
        toggle.setAttribute('aria-pressed', String(isLight));
        toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        toggle.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    });

    const config = getProfileConfig();
    applyProfileTheme(root.dataset.theme || config.DEFAULT_PROFILE_THEME, nextMode);
    return nextMode;
}

function toggleTheme() {
    const nextTheme = getCurrentTheme() === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_MODE_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
}

applyTheme(getStoredThemeMode());
applyProfileTheme(window.authService?.getCurrentUser?.()?.profileTheme || getProfileConfig().DEFAULT_PROFILE_THEME, getCurrentTheme());

async function ensureGenresReady() {
    const service = window.genreService || globalThis.genreService;
    if (service && typeof service.ensureGenresLoaded === 'function') {
        await service.ensureGenresLoaded();
    }
    const genreNames = (service && typeof service.getGenreNames === 'function')
        ? service.getGenreNames()
        : [];
    const resolvedGenres = (Array.isArray(genreNames) && genreNames.length)
        ? genreNames
        : fallbackGenres;
    categories.splice(0, categories.length, 'All', ...resolvedGenres);
    return categories;
}

function isLoggedIn() {
    return Boolean(authService && typeof authService.isAuthenticated === 'function' && authService.isAuthenticated());
}

function loadWatchlist() {
    if (window.watchlistService && typeof watchlistService.restore === 'function') {
        watchlistService.restore();
    }
    return window.watchlistService && typeof watchlistService.getEntries === 'function'
        ? watchlistService.getEntries()
        : [];
}

function isBookmarked(animeId) {
    const id = Number(animeId);
    if (!Number.isFinite(id)) return false;
    return Boolean(window.watchlistService && typeof watchlistService.has === 'function' && watchlistService.has(id));
}

function updateBookmarkUI(animeId = null) {
    const all = document.querySelectorAll('[data-bookmark-anime-id], [data-bookmark-target]');
    all.forEach((el) => {
        const id = Number(el.getAttribute('data-bookmark-anime-id') || el.getAttribute('data-bookmark-target'));
        if (animeId != null && Number(animeId) !== id) return;
        const favorited = isBookmarked(id);
        const icon = el.querySelector('i[data-lucide]') || el.querySelector('i');
        if (icon) {
            icon.classList.toggle('fill-gold-400', favorited);
            icon.classList.toggle('text-gold-400', favorited);
        }
    });

    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

function toggleBookmark(animeId) {
    const id = Number(animeId);
    if (!Number.isFinite(id)) return false;

    if (!isLoggedIn()) {
        showToast('Please sign in to save anime to your watchlist.');
        return false;
    }

    const anime = animeData.find((entry) => Number(entry.id) === id) || { id };
    const alreadyBookmarked = isBookmarked(id);
    const changed = alreadyBookmarked
        ? (window.watchlistService && typeof watchlistService.remove === 'function' ? watchlistService.remove(id) : false)
        : (window.watchlistService && typeof watchlistService.add === 'function' ? watchlistService.add(anime) : false);

    if (changed) {
        updateBookmarkUI(id);
        showToast(alreadyBookmarked ? 'Removed from watchlist' : 'Added to watchlist');

        if (currentPage === 'mylist') {
            const content = document.getElementById('main-content');
            if (content) content.innerHTML = renderMyList();
        }
    }

    return changed;
}

function toggleWatchlist(animeId) {
    return toggleBookmark(animeId);
}

function hasReleaseReminder(animeId) {
    const id = Number(animeId);
    if (!Number.isFinite(id) || !window.notificationService?.getNotifications) return false;
    return window.notificationService.getNotifications().some(notification =>
        notification?.type === 'release_reminder'
        && Number(notification?.metadata?.animeId) === id
    );
}

function toggleReleaseNotification(animeId) {
    const id = Number(animeId);
    const anime = animeData.find(entry => Number(entry?.id) === id);
    if (!anime || !window.notificationService) return false;
    if (!isLoggedIn()) {
        showToast('Sign in to receive release updates in your notification bell.');
        return false;
    }

    const notificationId = `release-reminder-${id}`;
    if (hasReleaseReminder(id)) {
        window.notificationService.removeNotification(notificationId);
        showToast(`Release reminder removed for ${anime.title}.`);
    } else {
        window.notificationService.addNotification({
            id: notificationId,
            type: 'release_reminder',
            title: 'Release reminder enabled',
            message: `You’ll receive an update here when “${anime.title}” is released.`,
            icon: 'bell-ring',
            action: { label: 'View anime', url: `#anime-${id}` },
            metadata: {
                category: 'release',
                animeId: id,
                animeTitle: anime.title,
                poster: anime.image || anime.poster || '',
                banner: anime.banner || anime.image || '',
            },
        });
        showToast(`You’ll be notified here when ${anime.title} is released.`);
    }

    updateNotificationBadge();
    const button = document.getElementById(`notify-btn-${id}`);
    if (button) {
        const enabled = hasReleaseReminder(id);
        button.innerHTML = `<i data-lucide="${enabled ? 'bell-check' : 'bell'}" class="w-4 h-4"></i>${enabled ? ' Notification Enabled' : ' Notify Me'}`;
        if (window.lucide?.createIcons) lucide.createIcons();
    }
    return true;
}

function getVisibleGenres() {
    const service = window.genreService || globalThis.genreService;
    const genreNames = (service && typeof service.getGenreNames === 'function')
        ? service.getGenreNames()
        : [];
    const resolvedGenres = (Array.isArray(genreNames) && genreNames.length)
        ? genreNames
        : (categories.length > 1 ? categories.filter((genre) => genre !== 'All') : fallbackGenres);
    if (Array.isArray(resolvedGenres) && resolvedGenres.length && (categories.length <= 1 || categories.slice(1).join('|') !== resolvedGenres.join('|'))) {
        categories.splice(0, categories.length, 'All', ...resolvedGenres);
    }
    return categories.filter((genre) => genre !== 'All');
}

function getGenreBadgeMarkup(genres = []) {
    const safeGenres = Array.isArray(genres) ? genres : [];
    return safeGenres.map((genre) => `
        <button type="button" onclick="navigateToGenre('${String(genre).replace(/'/g, "\\'")}', event)" class="px-3 py-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 text-gold-300 text-xs font-semibold tracking-wide hover:bg-gold-400/20 transition-all">
            ${String(genre)}
        </button>
    `).join('');
}

function navigateToGenre(genre, event) {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    const sanitized = String(genre || '').trim();
    if (!sanitized) return;
    currentPage = 'browse';
    const content = document.getElementById('main-content');
    if (content) content.innerHTML = renderBrowse('All', sanitized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
}

function filterByGenre(genre) {
    const content = document.getElementById('main-content');
    if (!content) return;
    const normalized = String(genre || '').trim();
    const target = normalized && normalized !== 'All' ? normalized : null;
    content.innerHTML = renderBrowse('All', target);
    currentPage = 'browse';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
}


// Comments are loaded from MongoDB (see /api/anime/:id/comments)
// Comments are loaded from MongoDB via /api/anime/:id/comments.
// Start empty so UI doesn't show mock reviews.
const comments = [];


function getAuthToken() {
    return authService.getToken();
}

function timeAgo(ts) {
    if (!ts) return 'Just now';
    
    const date = new Date(ts);
    if (isNaN(date.getTime())) return 'Just now';
    
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek === 1) return '1 week ago';
    if (diffWeek < 4) return `${diffWeek} weeks ago`;
    
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth === 1) return '1 month ago';
    return `${diffMonth} months ago`;
}

async function loadCommentsForAnime(animeId) {
    const token = getAuthToken();
    try {
        const res = await fetch(`/api/anime/${animeId}/comments`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load comments');

        // Normalize Mongo comments to the UI shape used in renderAnimeDetail
        // comment: { animeId, userId, text, rating, likes, createdAt, username }
        comments.length = 0;
        for (const c of data.comments || []) {
            comments.push({
                user: c.username || c.userId, // Use username from API, fallback to userId
                avatarId: resolveProfileAvatarId(c.avatarId),
                avatar: getProfileAvatarUrl(c.avatarId),
                text: c.text,
                rating: c.rating || null,
                time: timeAgo(c.createdAt),
                likes: c.likes || 0,
            });
        }
        
        // Re-render comments section
        updateCommentsSection();
    } catch (e) {
        console.warn('Using mock comments:', e.message);
    }
}

function getCommentInitials(username) {
    const value = String(username || '').trim();
    if (!value) return '?';
    return value.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatReviewRating(rating) {
    const value = Number(rating);
    return value > 0 ? `${value} / 5` : '';
}

function renderCommentRow(comment) {
    const user = String(comment.user || 'Anonymous');
    const safeUser = escapeHtml(user);
    const avatarUrl = comment.avatar || getProfileAvatarUrl(comment.avatarId);
    const initials = escapeHtml(getCommentInitials(user));
    const avatarMarkup = avatarUrl
        ? `<span class="review-avatar-shell"><img src="${avatarUrl}" class="review-avatar" alt="${safeUser} avatar" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><span class="review-avatar review-avatar-fallback" aria-hidden="true" hidden>${initials}</span></span>`
        : `<span class="review-avatar review-avatar-fallback" aria-hidden="true">${initials}</span>`;
    const ratingLabel = formatReviewRating(comment.rating);
    const likes = Math.max(0, Number(comment.likes) || 0);

    return `
        <article class="review-comment-row">
            ${avatarMarkup}
            <div class="review-comment-content">
                <div class="review-comment-meta">
                    <span class="review-comment-name">${safeUser}</span>
                    <span class="review-comment-time">${escapeHtml(comment.time || 'Recently')}</span>
                    ${ratingLabel ? `
                        <span class="review-rating-chip" aria-label="Rated ${ratingLabel}">
                            <i data-lucide="star" aria-hidden="true"></i>
                            ${ratingLabel}
                        </span>
                    ` : ''}
                </div>
                <p class="review-comment-copy">${escapeHtml(comment.text || '')}</p>
                <div class="review-comment-actions">
                    <button type="button" class="review-comment-action" aria-label="Like ${safeUser}'s review">
                        <i data-lucide="heart" aria-hidden="true"></i>
                        <span>${likes} likes</span>
                    </button>
                    <button type="button" class="review-comment-action" aria-label="Reply to ${safeUser}">
                        <i data-lucide="message-circle" aria-hidden="true"></i>
                        <span>Reply</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

function updateReviewComposerState() {
    const input = document.getElementById('comment-input');
    const ratingInput = document.getElementById('comment-rating');
    const counter = document.getElementById('review-counter');
    const status = document.getElementById('review-status');
    const text = input?.value?.trim() || '';
    const rating = Number(ratingInput?.value || 0);

    if (counter && input) counter.textContent = `${input.value.length} / 280`;
    if (!status) return;

    if (text) {
        status.textContent = 'Your draft is ready to post.';
    } else if (rating > 0) {
        status.textContent = 'Rating selected — add a few words to share your take.';
    } else {
        status.textContent = 'Choose a rating, then add a few words.';
    }
}

function updateCommentsSection() {
    const commentsContainer = document.querySelector('.review-comment-list');
    if (!commentsContainer) return;

    commentsContainer.innerHTML = comments.map(renderCommentRow).join('');
    if (window.lucide) window.lucide.createIcons();
}

async function addComment() {
    const input = document.getElementById('comment-input');
    const text = input?.value?.trim();
    const ratingInput = document.getElementById('comment-rating');
    const rating = ratingInput ? Number(ratingInput.value) : 0;

    if (!text) return alertGold('Write a comment first.');

    // current anime id is held by the anime detail render call argument

    // we infer it from the player back link / current navigation state isn't reliable,
    // so we keep it on the DOM when rendering.
    const animeId = Number(document.getElementById('anime-detail-root')?.dataset?.animeId);
    if (!animeId) return alertGold('Anime id not found.');

    const token = getAuthToken();
    if (!token) return alertGold('Please login first to post comments.');

    const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ animeId: String(animeId), text, rating: rating > 0 ? rating : null }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        if (data.error) {
            alertGold(data.error);
        }
        return;
    }

    input.value = '';
    ratingInput.value = '0';
    resetRatingStars();
    await loadCommentsForAnime(animeId);
}

// ============ USER RATING SYSTEM ============

// Update the displayed rating value when slider moves
function updateUserRatingDisplay(value) {
    const display = document.getElementById('user-rating-value');
    if (display) {
        display.textContent = value;
    }
}

// Load the current user's rating for an anime
async function loadUserRating(animeId) {
    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
        const res = await fetch(`/api/anime/${animeId}/rating`, {
            headers
        });
        const data = await res.json().catch(() => ({}));
        
        if (res.ok && data.ok && data.authenticated && data.rating !== null) {
            const slider = document.getElementById('user-rating-slider');
            const display = document.getElementById('user-rating-value');
            if (slider && display) {
                slider.value = data.rating;
                display.textContent = data.rating;
            }
        }
    } catch (e) {
        console.warn('Failed to load user rating:', e);
    }
}

// Submit/update user's rating
async function submitUserRating(animeId, rating) {
    const token = getAuthToken();
    if (!token) {
        alertGold('Please login to rate anime.');
        return;
    }

    try {
        const res = await fetch(`/api/anime/${animeId}/rating`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ rating: Number(rating) }),
        });

        const data = await res.json().catch(() => ({}));
        
        if (!res.ok || !data.ok) {
            alertGold(data.error || 'Failed to submit rating');
            return;
        }

        // Update the displayed rating count and average
        const ratingDisplay = document.querySelector('.hero-rating-inline');
        if (ratingDisplay && data.averageRating !== undefined) {
            ratingDisplay.innerHTML = `<i data-lucide="star" class="w-4 h-4"></i> ${data.averageRating}<span>/10</span><span class="text-xs text-gray-400 ml-1">(${data.ratingCount} ratings)</span>`;
            if (window.lucide) lucide.createIcons();
        }

        if (window.showToast) {
            showToast(`Rating submitted: ${rating}/10`);
        }
    } catch (e) {
        console.error('Failed to submit rating:', e);
        alertGold('Failed to submit rating');
    }
}

function setRating(rating) {
    const normalizedRating = Math.min(5, Math.max(0, Number(rating) || 0));
    const ratingInput = document.getElementById('comment-rating');
    if (ratingInput) ratingInput.value = String(normalizedRating);
    updateRatingStars(normalizedRating);
}

function updateRatingStars(selectedRating) {
    const normalizedRating = Math.min(5, Math.max(0, Number(selectedRating) || 0));
    const stars = document.querySelectorAll('.rating-star');

    stars.forEach((star, index) => {
        const starRating = Number(star.dataset.rating) || index + 1;
        const selected = starRating <= normalizedRating;
        star.dataset.selected = String(selected);
        star.setAttribute('aria-pressed', String(selected));

        const icon = star.querySelector('svg, i');
        if (icon) icon.classList.remove('text-gray-600', 'text-gold-400');
    });

    const ratingValue = document.getElementById('rating-value');
    const ratingStatus = document.getElementById('rating-status');
    if (ratingValue) ratingValue.textContent = `${normalizedRating} / 5`;
    if (ratingStatus) {
        ratingStatus.textContent = normalizedRating
            ? 'Rating selected — add a few words to share your take.'
            : 'Choose a star to rate this title.';
    }
    updateReviewComposerState();
}

function resetRatingStars() {
    const ratingInput = document.getElementById('comment-rating');
    if (ratingInput) ratingInput.value = '0';
    updateRatingStars(0);
}


// Admin dashboard UI and admin actions moved to js/admin/adminUI.js

function toggleFavorite(animeId) {
    const id = Number(animeId);
    const changed = interactionService && typeof interactionService.toggleFavorite === 'function'
        ? interactionService.toggleFavorite(id)
        : false;
    const wasFavorited = Boolean(interactionService && typeof interactionService.hasFavorite === 'function' && interactionService.hasFavorite(id));
    showToast(wasFavorited ? '💔 Removed from Favorites' : '❤️ Added to Favorites');
    updateFavoriteUI(Number(animeId));

    if (currentPage === 'profile') {
        const content = document.getElementById('main-content');
        if (content) content.innerHTML = renderProfile();
    }
}

function isFavorited(animeId) {
    return interactionService && typeof interactionService.hasFavorite === 'function'
        ? interactionService.hasFavorite(animeId)
        : false;
}

function updateFavoriteUI(animeId = null) {
    const all = document.querySelectorAll('[data-favorite-anime-id]');
    all.forEach(el => {
        const id = Number(el.getAttribute('data-favorite-anime-id'));
        if (animeId != null && Number(animeId) !== id) return;
        const favorited = isFavorited(id);
        const icon = el.querySelector('i[data-lucide]') || el.querySelector('i');
        if (icon) {
            icon.classList.toggle('text-gold-400', favorited);
            icon.classList.toggle('fill-gold-400', favorited);
        }
    });

    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

function initializeInteractionsState() {
    if (interactionService && typeof interactionService.restore === 'function') {
        interactionService.restore();
    }
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    updateFavoriteUI();
}

function initializeWatchlistState() {
    loadWatchlist();
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    updateBookmarkUI();
}


let adminModalMode = 'create';
let editingAnimeId = null;
let uploadTargetAnimeId = null;
let heroRotationTimer = null;

const ADMIN_ANIME_STORAGE_KEY = 'anify-admin-anime-data';

function restoreAdminAnimeData() {
    // Prefer admin module implementation when available
    if (window.animeManagement && typeof animeManagement.restoreAdminAnimeData === 'function') {
        try { return animeManagement.restoreAdminAnimeData(); } catch (e) { console.warn('animeManagement.restoreAdminAnimeData failed:', e); }
    }
    try {
        const saved = JSON.parse(storageService.get(ADMIN_ANIME_STORAGE_KEY) || 'null');
        if (Array.isArray(saved) && saved.length) {
            animeData.splice(0, animeData.length, ...saved);
        }
    } catch (e) {
        console.warn('Could not restore admin anime data:', e);
    }
}

function saveAdminAnimeData() {
    // Prefer admin module implementation when available
    if (window.animeManagement && typeof animeManagement.saveAdminAnimeData === 'function') {
        try { return animeManagement.saveAdminAnimeData(); } catch (e) { console.warn('animeManagement.saveAdminAnimeData failed:', e); }
    }
    try {
        storageService.set(ADMIN_ANIME_STORAGE_KEY, JSON.stringify(animeData));
    } catch (e) {
        console.warn('Could not save admin anime data:', e);
    }
}

// REMOVED: restoreAdminAnimeData() - This was causing stale localStorage data to overwrite fresh API data
// localStorage should only be used as fallback when API fails, not to automatically restore on page load

async function loadAnimeFromApi() {
    if (window.animeManagement && typeof animeManagement.loadAnimeFromApi === 'function') {
        try { return await animeManagement.loadAnimeFromApi(); } catch (e) { console.warn('animeManagement.loadAnimeFromApi failed:', e); }
    }
    try {
        const res = await fetch('/api/anime');
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok && Array.isArray(data.anime)) {
            animeData.splice(0, animeData.length, ...data.anime);
            try {
                localStorage.setItem('anify-cached-anime', JSON.stringify(data.anime));
            } catch (e) {}
            return true;
        }
    } catch (e) {
        console.warn('API fetch failed, using localStorage fallback:', e.message);
    }
    // Fallback to localStorage only if API fails
    if (window.animeManagement && typeof animeManagement.restoreAdminAnimeData === 'function') {
        try { animeManagement.restoreAdminAnimeData(); } catch (e) { console.warn('animeManagement.restoreAdminAnimeData failed:', e); }
    } else {
        restoreAdminAnimeData();
    }
    return false;
}

async function saveAnimeToApi(anime, isEdit = false) {
    if (window.animeManagement && typeof animeManagement.saveAnimeToApi === 'function') {
        try { return await animeManagement.saveAnimeToApi(anime, isEdit); } catch (e) { console.warn('animeManagement.saveAnimeToApi failed:', e); }
    }
    try {
        const res = await fetch(isEdit ? `/api/anime/${anime.id}` : '/api/anime', {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...anime, clientId: Number(anime.id) || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Database save failed.');
        return data.anime;
    } catch (e) {
        console.warn('Saved locally only:', e.message);
        return null;
    }
}

async function deleteAnimeFromApi(id) {
    if (window.animeManagement && typeof animeManagement.deleteAnimeFromApi === 'function') {
        try { return await animeManagement.deleteAnimeFromApi(id); } catch (e) { console.warn('animeManagement.deleteAnimeFromApi failed:', e); }
    }
    try {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication token not found.');
        const res = await fetch(`/api/anime/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Failed to delete (HTTP ${res.status})`);
        }
    } catch (e) {
        console.warn('Deleted locally only:', e.message);
        throw e; // Re-throw to allow caller to handle it
    }
}

async function saveWatchProgressToApi(entry) {
    try {
        const token = getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        
        await fetch('/api/watch-progress', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                ...entry,
                userId: authService.getCurrentUserId() || 'guest',
                animeId: String(entry.id),
            }),
        });
    } catch (e) {
        console.warn('Watch progress saved locally only:', e.message);
    }
}

function restoreContinueWatching() {
    try {
        continueWatching = continueWatchingService.restore();
    } catch (e) {
        console.warn('Could not restore continue watching:', e);
        continueWatching = [];
    }
}

function saveContinueWatching() {
    try {
        continueWatching = continueWatchingService.save();
    } catch (e) {
        console.warn('Could not save continue watching:', e);
    }
}

function updateContinueWatching(entry) {
    try {
        const updated = continueWatchingService.update(entry);
        continueWatching = continueWatchingService.getEntries();
        return updated;
    } catch (e) {
        console.warn('Could not update continue watching:', e);
        return null;
    }
}

function removeContinueWatching(animeId) {
    try {
        continueWatching = continueWatchingService.remove(animeId);
        return continueWatching;
    } catch (e) {
        console.warn('Could not remove continue watching:', e);
        return [];
    }
}

function clearContinueWatching() {
    try {
        continueWatching = continueWatchingService.clear();
        return continueWatching;
    } catch (e) {
        console.warn('Could not clear continue watching:', e);
        return [];
    }
}

restoreContinueWatching();

function shouldShowBannerVideo(anime) {
    return Boolean(anime?.bannerVideo && (anime.bannerDisplay ? anime.bannerDisplay === 'video' : true));
}

function formatPlayerTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
}

function getHomeHeroAnimeList() {
    const newest = animeData.find(a => a.newEpisode) || animeData[0];
    const recommended = [
        newest,
        ...animeData.filter(a => a.featured),
        ...animeData.filter(a => a.trending),
        ...[...animeData].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
    ].filter(Boolean);

    return recommended.filter((anime, index, list) => list.findIndex(item => item.id === anime.id) === index);
}

function renderHeroMedia(anime) {
    if (!anime) {
        return `<div class="w-full h-full bg-white/5 rounded-lg"></div>`;
    }

    if (shouldShowBannerVideo(anime)) {
        return `
            <video class="is-active" muted autoplay loop playsinline preload="metadata" poster="${ensureHttps(anime.banner || anime.image || '')}">
                <source src="${ensureHttps(anime.bannerVideo || '')}" type="video/mp4">
            </video>`;
    }

    return `<img src="${ensureHttps(anime.banner || anime.image || '')}" class="is-active" alt="${anime.title || ''}" fetchpriority="high" decoding="async" />`;
}

function getHeroTitleInfo(fullTitle) {
    const length = fullTitle.length;
    let displayTitle = fullTitle;
    
    // Truncate extremely long titles (81+ characters) to max 3 lines
    if (length > 80) {
        const words = fullTitle.split(/\s+/);
        let shortened = '';
        for (const word of words) {
            const candidate = shortened ? `${shortened} ${word}` : word;
            if (candidate.length > 68) break;
            shortened = candidate;
        }
        displayTitle = `${shortened || fullTitle.slice(0, 68).trim()}…`;
    }

    return {
        displayTitle,
        className: length <= 25 ? 'hero-title--short'
            : length <= 50 ? 'hero-title--medium'
            : length <= 80 ? 'hero-title--long'
            : 'hero-title--extra-long',
    };
}

function renderHeroContent(anime) {
    if (!anime) return '';
    
    const heroTitleInfo = getHeroTitleInfo(anime.title || 'Unknown');
    
    return `
        <div class="anim-slide-up anim-delay-1 flex items-center gap-2 mb-4">
            ${anime.newEpisode ? '<span class="badge-new">New Episode</span>' : ''}
            ${anime.premium ? '<span class="badge-premium">Premium</span>' : ''}
            <span class="text-xs text-gray-400 font-medium flex items-center gap-1">
                <i data-lucide="star" class="w-3 h-3 fill-gold-400 text-gold-400"></i> ${anime.averageRating || 'N/A'}
            </span>
        </div>
        <div class="hero-title-wrap">
            <h1 class="anim-slide-up anim-delay-2 hero-title ${heroTitleInfo.className}" data-full-title="${escapeHtml(anime.title)}" tabindex="0" aria-label="${escapeHtml(anime.title)}">${escapeHtml(heroTitleInfo.displayTitle)}<span class="hero-title-info" aria-hidden="true">ⓘ</span></h1>
            <span class="hero-title-tooltip" role="tooltip">${escapeHtml(anime.title)}</span>
        </div>
         <p class="anim-slide-up anim-delay-2 text-gold-400/80 text-sm mb-4">${anime.titleJp || ''}</p>
        <p class="anim-slide-up anim-delay-3 text-gray-300 text-sm md:text-base line-clamp-3 mb-6 max-w-lg">${anime.desc || ''}</p>
        <div class="anim-slide-up anim-delay-3 flex flex-wrap gap-2 mb-6">
            ${Array.isArray(anime.genres) ? anime.genres.map(g => `<span class="category-pill text-xs">${g}</span>`).join('') : ''}
        </div>
        <div class="anim-slide-up anim-delay-4 flex items-center gap-3">
            <button onclick="navigate('player', ${anime.id})" class="btn-primary hero-watch-now flex items-center gap-2 text-base px-6 py-3">
                <i data-lucide="play" class="w-5 h-5 fill-current"></i> Watch Now
            </button>
            <button onclick="navigate('anime', ${anime.id})" class="btn-secondary flex items-center gap-2 px-6 py-3">
                <i data-lucide="info" class="w-5 h-5"></i> Details
            </button>
<button onclick="toggleBookmark(${anime.id})" class="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-gold-400/30 transition-all" title="Add to Watchlist">
                <i data-lucide="${isBookmarked(anime.id) ? 'bookmark-check' : 'bookmark'}" class="w-5 h-5 ${isBookmarked(anime.id) ? 'text-gold-400' : ''}"></i>
            </button>
        </div>`;
}

function getAnimeVideoSources(anime) {
    const sources = anime.videoSources || { sub: {}, dub: {} };
    const sub = { ...(sources.sub || {}) };
    const dub = { ...(sources.dub || {}) };

    if (anime.videoUrl && !sub['1080p']) sub['1080p'] = anime.videoUrl;

    return { sub, dub };
}

function getDefaultPlayerSource(anime) {
    // Movies
    if ((anime?.type || 'anime') !== 'anime') {
        const movieQualities = anime?.movieMedia?.qualities || {};
        const episodeQualities = anime?.episodesMedia?.[0]?.sub?.qualities || {};
        const qualities = Object.keys(movieQualities).length ? movieQualities : episodeQualities;
        return qualities['1080p'] || qualities['720p'] || '';
    }

    // Series (legacy)
    const sources = getAnimeVideoSources(anime);
    return sources.sub['1080p'] || sources.dub['1080p'] || sources.sub['720p'] || sources.dub['720p'] || anime.videoUrl || '';
}


function animeHasLanguage(anime, language) {
    // Series (legacy): check videoSources
    if ((anime?.type || 'anime') === 'anime') {
        return Object.keys(getAnimeVideoSources(anime)[language] || {}).length > 0;
    }

    // Movies: use movieMedia instead (single player, no language tracks)
    const qualities = anime?.movieMedia?.qualities;
    if (!qualities || typeof qualities !== 'object') return false;
    return Object.keys(qualities || {}).length > 0;
}


// --- Episode media helpers (per-episode playback) ---
function getEpisodeObject(anime, episodeNumber) {
    const episodesMedia = Array.isArray(anime?.episodesMedia) ? anime.episodesMedia : [];
    return episodesMedia.find(e => Number(e?.episodeNumber) === Number(episodeNumber)) || null;
}

function getEpisodeQualitySources(episodeObj, language) {
    const qualities = episodeObj?.[language]?.qualities;
    // qualities may be {} or even a Map (should already be normalized by backend)
    return qualities && typeof qualities === 'object' ? qualities : {};
}

function getEpisodeVideoUrl(episodeObj, language, quality) {
    const qualities = getEpisodeQualitySources(episodeObj, language);
    const url = qualities?.[quality] || qualities?.['1080p'] || qualities?.['720p'] || '';
    
    // S3 endpoint restriction removed for testing - recommend using custom domain in production
    
    if (url) {
        console.log('[Playback] Video URL:', url);
    }
    
    return url;
}

function isEpisodeAvailable(anime, language, episodeNumber) {
    // If episodesMedia is present, gate availability by it.
    const episodeObj = getEpisodeObject(anime, episodeNumber);
    if (episodeObj) {
        const qualities = getEpisodeQualitySources(episodeObj, language);
        // available if any quality URL exists
        return Object.keys(qualities || {}).some(q => Boolean(qualities?.[q]));
    }

    // Backward compatibility: fall back to old global videoSources rule (Episode 1 only).
    return episodeNumber === 1 && animeHasLanguage(anime, language);
}

function renderEpisodeList(anime, language = 'sub') {
    // Canonical series episode source: episodesMedia.
    // We use anime.episodes only as a display fallback when episodesMedia is missing.
    const episodesMedia = Array.isArray(anime?.episodesMedia) ? anime.episodesMedia : null;

    const episodeNumbers = Array.isArray(episodesMedia)
        ? [...new Set(episodesMedia
            .map(e => Number(e?.episodeNumber))
            .filter(n => Number.isFinite(n) && n >= 1))
          ].sort((a, b) => a - b)
        : Array.from({ length: Math.min(anime?.episodes || 1, 24) }, (_, i) => i + 1);

    // Keep UI bounded (still consistent with previous behavior)
    const boundedEpisodeNumbers = episodeNumbers.slice(0, 24);

    // Active episode is controlled by the current player state (episodeNumber dataset).
    // Fallback to 1 for initial render.
    const video = getPlayerVideo?.();
    const activeEpisodeNumber = video?.dataset?.episodeNumber ? Number(video.dataset.episodeNumber) : 1;

    return boundedEpisodeNumbers.map((epNum) => {
        const isActive = Number(epNum) === Number(activeEpisodeNumber);
        const epObj = Array.isArray(episodesMedia) ? episodesMedia.find(e => Number(e?.episodeNumber) === Number(epNum)) : null;
        const epViews = Number(epObj?.views) || 0;
        const formattedViews = formatViewCount(epViews);
        return `
            <button
                class="episode-selector-card ${isActive ? 'episode-selector-card--active' : ''}"
                data-episode-number="${epNum}"
                aria-label="Episode ${epNum} (${formattedViews})"
                title="Episode ${epNum} • ${formattedViews}"
                onclick="selectEpisodeLanguage('${language}', ${epNum})"
            >
                <span class="episode-selector-card__tag">EP</span>
                <span class="episode-selector-card__num">${epNum}</span>
            </button>
        `;
    }).join('');
}




// ============ NAVIGATION ============
async function initializeApp(){
    const app = document.getElementById('app');

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);

    // 1. Initial 0ms render from synchronous memory/cache
    handleRouteChange();
    restoreMiniPlayerFromRefresh();

    // 2. Safe timeout protection
    const loadingTimeout = setTimeout(() => {
        if (app) {
            app.classList.remove('opacity-0');
            app.classList.add('opacity-100');
        }
    }, 20000);

    try {
        // Run both loading operations in parallel
        await Promise.all([
            ensureGenresReady().catch(e => {
                console.warn('[App] Genre loading failed:', e);
            }),
            loadAnimeFromApi().catch(e => {
                console.warn('[App] Anime API loading failed:', e);
            })
        ]);
    } catch (e) {
        console.warn('[App] Initialization error:', e);
    }

    clearTimeout(loadingTimeout);

    // Refresh route view with fresh API data
    handleRouteChange();

    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }

    console.log('[App] Initialization complete');
}

async function uploadMediaFile(file) {
    // Prefer admin upload service when available
    if (window.uploadService && typeof uploadService.uploadMedia === 'function') {
        try { return await uploadService.uploadMedia(file); } catch (e) { console.warn('uploadService.uploadMedia failed:', e); }
    }
    const form = new FormData();
    form.append('media', file);

    let res;
    try {
        res = await fetch('/api/upload-media', {
            method: 'POST',
            body: form
        });
    } catch (e) {
        throw new Error('Could not reach the upload server. Run npm start and open http://localhost:3000/anify.html, not the file directly.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        const err = data && data.error ? data.error : `Upload failed (HTTP ${res.status})`;
        throw new Error(err);
    }

    return data;
}

function updateLocalAnimeData(updatedAnime) {
    if (!updatedAnime) return;
    const idx = animeData.findIndex(a => String(a.id) === String(updatedAnime.id) || String(a.clientId) === String(updatedAnime.clientId));
    if (idx >= 0) animeData[idx] = { ...animeData[idx], ...updatedAnime };
    else animeData.unshift(updatedAnime);
}

async function uploadVideoFile(file, onProgress = null) {
    if (window.uploadService && typeof uploadService.uploadVideo === 'function') {
        try { 
            console.log('[UPLOAD] Using admin video upload service for:', file.name);
            const progressCallback = (progress) => {
                console.log(`[UPLOAD] Video upload progress: ${progress.toFixed(1)}%`);
                if (typeof onProgress === 'function') {
                    onProgress(progress);
                }
            };
            return await uploadService.uploadVideo(file, progressCallback); 
        } catch (e) { console.warn('uploadService.uploadVideo failed:', e); }
    }
    return uploadMediaFile(file);
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOMContentLoaded fired');
    
    // Play cinematic intro animation
    if (window.initAnifyIntro) {
        console.log('[App] Initializing intro animation...');
        initAnifyIntro();
    } else {
        console.warn('[App] initAnifyIntro not available');
    }
    
    applyTheme(getCurrentTheme());
    authService.restoreSession();
    applyProfileTheme(authService.getCurrentUser()?.profileTheme || getProfileConfig().DEFAULT_PROFILE_THEME);
    restoreContinueWatching();
    initializeApp();
    setupHeroLiveWallpapers();
    renderAuthNav();
    initializeWatchlistState();
    initializeInteractionsState();
    ensureNotificationsInitialized();

    // Required: make navbar update immediately on login/logout without refresh
    window.addEventListener('authChanged', () => {
        console.log('[Auth] authChanged event received. current stored user profile =', (() => {
            try { return JSON.stringify(authService.getCurrentUser()); } catch { return null; }
        })());

        restoreContinueWatching();
        applyProfileTheme(authService.getCurrentUser()?.profileTheme || getProfileConfig().DEFAULT_PROFILE_THEME);
        renderAuthNav();
        loadWatchlist();
        updateBookmarkUI();
        if (interactionService && typeof interactionService.restore === 'function') {
            interactionService.restore();
            updateFavoriteUI();
        }
        ensureNotificationsInitialized();
        if (currentPage === 'mylist') {
            const content = document.getElementById('main-content');
            if (content) content.innerHTML = renderMyList();
        }
        if (currentPage === 'profile') {
            const content = document.getElementById('main-content');
            if (content) content.innerHTML = renderProfile();
            loadProfileActivity();
        }
        console.log('[Auth] navbar UI updated');
    });
});




function setupHeroLiveWallpapers() {
    if (heroRotationTimer) clearInterval(heroRotationTimer);

    const heroMedia = document.getElementById('home-hero-media');
    const heroContent = document.getElementById('home-hero-content');
    if (!heroMedia || !heroContent) return;

    const heroList = getHomeHeroAnimeList().filter(anime => anime && typeof anime === 'object');
    if (heroList.length < 2) return;

    let active = 0;
    heroRotationTimer = setInterval(() => {
        if (currentPage !== 'home') {
            clearInterval(heroRotationTimer);
            heroRotationTimer = null;
            return;
        }

        active = (active + 1) % heroList.length;
        const anime = heroList[active];
        if (!anime) return; // Skip undefined anime objects
        
        heroMedia.innerHTML = renderHeroMedia(anime);
        heroContent.innerHTML = renderHeroContent(anime);
        lucide.createIcons();
    }, 9000);
}

// Centralized search state
let isSearchOpen = false;
let searchPreviousBodyOverflow = null;

// Support modal state
let selectedAmount = null;
let isProcessingDonation = false;

// Platform settings
let supportEnabled = false;

// Download auth modal listeners flag
let downloadAuthModalListenersAdded = false;

// Current page tracking
let currentPage = 'home';

function navigate(page, data, options = {}) {
    const { replace = false } = options;
    let hash = `#/${page}`;
    if (data) {
        hash += `/${data}`;
    }

    // Close search when navigating
    if (isSearchOpen) {
        closeSearchPanel();
    }

    // Guest preview check before allowing player navigation
    if (page === 'player' && guestPreviewService && guestPreviewService.isGuest()) {
        const animeId = Number(data);
        const status = guestPreviewService.getPreviewStatus();
        console.log('Guest preview status:', status);
        if (!guestPreviewService.canWatchMore()) {
            console.log('Guest limit reached, showing modal before navigation');
            showGuestLimitModal();
            return;
        }
    }

    if (replace) {
        window.history.replaceState(null, '', hash);
    } else {
        window.location.hash = hash;
    }

    // If hash hasn't changed, hashchange event won't fire, so we manually trigger.
    if (window.location.hash === hash && !replace) {
        handleRouteChange();
    }
}

function handleRouteChange() {
    const hash = window.location.hash || '#/home';
    const [_, page, data] = hash.split('/');

    currentPage = page;
    const content = document.getElementById('main-content');

    // Close search on route change
    if (isSearchOpen) {
        closeSearchPanel();
    }

    document.querySelectorAll('[data-nav]').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`[data-nav="${page}"]`).forEach(l => l.classList.add('active'));

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Handle Mini Player Transition
    handleMiniPlayerTransition(page);

    switch (page) {
        case 'home':
            content.innerHTML = renderHome();
            startCountdownUpdates();
            break;
        case 'browse': content.innerHTML = renderBrowse(); break;
        case 'movies': content.innerHTML = renderBrowse('Movie'); break;
        case 'series': content.innerHTML = renderBrowse('Series'); break;
        case 'mylist': content.innerHTML = renderMyList(); break;
        case 'anime': 
            content.innerHTML = renderAnimeDetail(Number(data));
            loadCommentsForAnime(Number(data));
            loadUserRating(Number(data));
            startCountdownUpdates();
            break;
        case 'player': content.innerHTML = renderPlayer(Number(data)); break;
        case 'login': content.innerHTML = renderLogin(); break;
        case 'register': content.innerHTML = renderRegister(); break;
        case 'profile':
            content.innerHTML = renderProfile();
            loadProfileActivity();
            break;
        case 'admin': 
            if (!ensureAdminOrRedirect()) return;
            content.innerHTML = renderAdmin(); 
            break;
        default:
            currentPage = 'home';
            content.innerHTML = renderHome();
            break;
    }

    // Toggle Surprise FAB visibility
    const surpriseFab = document.querySelector('.surprise-fab');
    if (surpriseFab) {
        surpriseFab.classList.toggle('hidden', page === 'player');
    }

    lucide.createIcons();
    setTimeout(() => lucide.createIcons(), 100);
    if (page === 'home') {
        setupHeroLiveWallpapers();
        animateCWCards();
    }
    if (page === 'player') setupCustomPlayer();
}

function animateCWCards() {
    if (window.gsap && document.querySelector(".cw-card")) {
        try {
            gsap.from(".cw-card", {
                opacity: 0,
                y: 30,
                duration: 0.8,
                stagger: 0.1,
                ease: "power3.out",
                clearProps: "all"
            });
        } catch (e) {
            console.warn("GSAP animation for .cw-card failed:", e);
        }
    }
}

// ============ RENDER: HOME ============
function renderHome() {
    const homeHeroList = getHomeHeroAnimeList();
    const featured = homeHeroList.find(anime => anime && typeof anime === 'object') || animeData.find(anime => anime && typeof anime === 'object') || null;
    const genreList = getVisibleGenres();

    const trending = animeData.filter(a => a && a.trending);
    const recentlyAdded = animeData.filter(a => a && typeof a === 'object').slice(0, 8);
    const popular = [...animeData].filter(a => a && typeof a === 'object').sort((a, b) => (b?.averageRating || 0) - (a?.averageRating || 0)).slice(0, 8);
    const recentlyReleased = animeData.filter(a => a && a.newEpisode).slice(0, 8);
    const becauseWatched = getBecauseYouWatchedList(featured);

    return `
    <!-- Hero Banner -->
    <section class="hero-banner relative">
        <div class="hero-media" id="home-hero-media">
            ${renderHeroMedia(featured)}
        </div>
        <div class="hero-overlay"></div>
        <div class="hero-bottom-overlay"></div>

        
        <!-- Floating Orbs -->
        <div class="floating-orb w-96 h-96 bg-gold-400 -top-48 -right-48" style="animation-delay: 0s;"></div>
        <div class="floating-orb w-64 h-64 bg-purple-500 bottom-20 left-1/4" style="animation-delay: 3s;"></div>
        
        <div class="relative z-10 h-full flex items-center">
            <div class="max-w-7xl mx-auto px-4 md:px-8 w-full pt-20">
                <div class="max-w-2xl" id="home-hero-content">
                    ${featured ? renderHeroContent(featured) : ''}
                </div>
            </div>
        </div>
    </section>

    <div class="home-shell max-w-7xl mx-auto px-4 md:px-8 pb-20 -mt-16 relative z-20">
        ${renderCarousel('🔥 Trending Now', trending)}
        ${renderContinueWatching()}
        ${renderCarousel('Because You Watched', becauseWatched, `More picks with the same energy as ${featured?.title || 'your favorites'}.`, 'sparkles')}
        ${renderWideFeatureRow('Recently Released', 'Newest episodes and premieres added to the library.', recentlyReleased.length ? recentlyReleased : recentlyAdded, 'radio')}
        ${renderComingSoon()}
        ${renderCarousel('⭐ Popular This Week', popular)}
        ${renderCarousel('🆕 Recently Added', recentlyAdded)}
        
        <!-- Categories Section -->
        <section class="genre-showcase home-section anim-fade-in" aria-labelledby="genre-showcase-title">
            <div class="genre-showcase-inner">
                ${renderSectionHeader('Browse by Genre', 'Explore cinematic worlds by mood, pace, and story type.', 'grid-3x3', 'genre-showcase-title')}
                <div class="genre-showcase-grid">
                    ${genreList.map((cat, i) => {
                        const count = genreService.getGenreCount(cat);
                        const countLabel = count > 0 ? `${count} ${count === 1 ? 'title' : 'titles'}` : 'No titles yet';

                        return `
                            <button onclick="filterByGenre('${cat}')" class="genre-card premium-genre-card anim-slide-up anim-delay-${Math.min(i+1, 5)}" style="--genre-hue:${getGenreHue(cat)}deg">
                                <span class="genre-card-glow"></span>
                                <span class="genre-card-icon">
                                    <i data-lucide="${getGenreIcon(cat)}"></i>
                                </span>
                                <span class="genre-card-copy">
                                    <span class="genre-card-name">${cat}</span>
                                    <span class="genre-card-count">${countLabel}</span>
                                </span>
                                <span class="genre-card-action">Explore <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </section>

        <!-- Top Airing Widget -->
        <section class="home-section anim-fade-in">
            ${renderSectionHeader('Top Airing', 'New episodes pulling the biggest live audience.', 'radio')}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${animeData.filter(a => a && a.status === 'Airing').slice(0, 6).map((a, i) => `
                    <button onclick="navigate('anime', ${a.id})" class="glass-card glass-card-hover flex items-center gap-4 p-3 rounded-2xl text-left">
                        <img src="${ensureHttps(a.image)}" class="w-16 h-20 rounded-xl object-cover flex-shrink-0" alt="${a.title}">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="text-gold-400 font-black text-xs">#${i + 1}</span>
                                ${a.newEpisode ? '<span class="badge-new text-[9px]">NEW</span>' : ''}
                            </div>
                            <p class="font-bold text-sm truncate">${a.title}</p>
                            <p class="text-xs text-gray-500">${a.genres?.[0] || 'Unknown'} · Ep ${a.episodes}</p>
                            <div class="flex items-center gap-1 mt-1">
                                <i data-lucide="star" class="w-3 h-3 fill-gold-400 text-gold-400"></i>
                                <span class="text-xs font-medium">${a.averageRating || 'N/A'}</span>
                            </div>
                        </div>
                    </button>
                `).join('')}
            </div>
        </section>

        ${renderStudiosRow()}
        ${renderNewsAndActivity()}

        <!-- Subscription CTA -->
        <section class="home-section anim-fade-in">
            <div class="premium-banner relative overflow-hidden rounded-3xl p-8 md:p-12 animated-gradient">
                <div class="premium-shine"></div>
                <div class="relative z-10 premium-banner-grid">
                    <div>
                    <span class="badge-premium premium-banner-badge mb-4 inline-flex items-center gap-2"><i data-lucide="crown" class="w-3.5 h-3.5"></i> Premium</span>
                    <h2 class="text-3xl md:text-4xl font-black mb-3 text-glow-gold">Unlock the Full Experience</h2>
                    <p class="text-gray-300 mb-6 max-w-lg">Ad-free anime, 4K streaming, offline downloads, and early episode drops in one warm gold plan.</p>
                    <div class="flex flex-wrap gap-3">
                        <button class="btn-primary flex items-center gap-2 px-6 py-3">
                            <i data-lucide="crown" class="w-5 h-5"></i> Go Premium — $9.99/mo
                        </button>
                    </div>
                    </div>
                    <div class="premium-feature-grid">
                        ${[
                            ['badge-check', 'No Ads'],
                            ['monitor-up', '4K Streaming'],
                            ['download', 'Offline Downloads'],
                            ['sparkles', 'Early Episodes']
                        ].map(([icon, label]) => `
                            <div class="premium-feature">
                                <i data-lucide="${icon}" class="w-5 h-5"></i>
                                <span>${label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </section>
    </div>`.replace(/Go Premium[\s\S]*?\$9\.99\/mo/, 'Go Premium - $9.99/mo').replace(/Â·/g, '-');
}

// ============ RENDER: CAROUSEL ============
function renderSectionHeader(title, description, icon = 'sparkles', id = '') {
    const idAttr = id ? ` id="${id}"` : '';
    return `
        <div class="home-section-head">
            <div>
                <h2${idAttr} class="home-section-title">
                    <span class="home-section-icon"><i data-lucide="${icon}" class="w-5 h-5"></i></span>
                    ${title}
                </h2>
                <p class="home-section-desc">${description}</p>
            </div>
        </div>`;
}

function renderCarousel(title, items, description = 'Hand-picked titles ready for your next watch.', icon = 'sparkles') {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!safeItems.length) return '';
    const displayTitle = title.includes('Trending Now')
        ? 'Trending Now'
        : title.includes('Popular This Week')
            ? 'Popular This Week'
            : title.includes('Recently Added')
                ? 'Recently Added'
                : title;
    const displayIcon = icon !== 'sparkles'
        ? icon
        : displayTitle === 'Trending Now'
            ? 'flame'
            : displayTitle === 'Popular This Week'
                ? 'star'
                : displayTitle === 'Recently Added'
                    ? 'badge-plus'
                    : icon;
    const displayDescription = description !== 'Hand-picked titles ready for your next watch.'
        ? description
        : displayTitle === 'Trending Now'
            ? 'Live momentum across Anify right now.'
            : displayTitle === 'Popular This Week'
                ? 'Trending across Anify this week.'
                : displayTitle === 'Recently Added'
                    ? 'Fresh drops and newly added titles.'
                    : description;
    return `
    <section class="home-section anim-fade-in">
        <div class="flex items-center justify-between mb-5">
            ${renderSectionHeader(displayTitle, displayDescription, displayIcon)}
            <div class="flex gap-2">
                <button onclick="scrollCarousel(this, -1)" class="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <button onclick="scrollCarousel(this, 1)" class="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
        <div class="carousel-container flex gap-4 pb-4">
            ${safeItems.map(a => renderAnimeCard(a)).join('')}
        </div>
    </section>`;
}

function scrollCarousel(button, direction) {
    const section = button.closest('section');
    if (!section) return;

    const carouselContainer = section.querySelector('.carousel-container');
    if (carouselContainer) {
        const scrollAmount = carouselContainer.clientWidth * 0.8; // Scroll by 80% of the visible width
        carouselContainer.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
    }
}

function renderAnimeCard(a) {
    return `
    <div onclick="navigate('anime', ${a.id})" class="anime-card flex-shrink-0 w-44 md:w-52">
        <div class="relative aspect-[3/4] rounded-2xl overflow-hidden bg-dark-700">
            <img src="${ensureHttps(a.image)}" class="w-full h-full object-cover" alt="${a.title}" loading="lazy" decoding="async">
            <div class="card-overlay"></div>
            <div class="absolute top-2 left-2 flex flex-col gap-1">
                ${a.premium ? '<span class="badge-premium">Premium</span>' : ''}
                ${a.newEpisode ? '<span class="badge-new">NEW EP</span>' : ''}
            </div>
            <div class="absolute top-2 right-2">
<button onclick="event.stopPropagation(); toggleBookmark(${a.id})" class="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 transition-all">
                    <i data-lucide="bookmark" class="w-3.5 h-3.5 ${isBookmarked(a.id) ? 'fill-gold-400 text-gold-400' : ''}"></i>
                </button>
            </div>
            <div class="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-lg px-2 py-0.5">
                <i data-lucide="star" class="w-3 h-3 fill-gold-400 text-gold-400"></i>
                <span class="text-xs font-bold">${a.averageRating || 'N/A'}</span>
            </div>
            <div class="card-actions">
                <button class="w-full btn-primary flex items-center justify-center gap-2 py-2 rounded-xl text-xs">
                    <i data-lucide="play" class="w-4 h-4 fill-current"></i> Watch Now
                </button>
            </div>
        </div>
        <div class="mt-2 px-1">
            <p class="font-semibold text-sm truncate">${a.title}</p>
            <p class="text-xs text-gray-500 mt-0.5">${Array.isArray(a.genres) && a.genres.length > 0 ? a.genres[0] : 'Uncategorized'} · ${a.episodes || 0} eps</p>
        </div>
    </div>`;
}

// ============ RENDER: CONTINUE WATCHING ============
function renderContinueWatching() {
    const entries = continueWatching || [];
    
    if (entries.length === 0) {
        return `
        <section class="home-section anim-fade-in">
            <div class="flex items-center justify-between px-[5%] mb-6">
                <h2 class="text-3xl font-black tracking-tight flex items-center gap-3 text-black dark:text-white">
                    <i data-lucide="clock" class="w-6 h-6 text-gold-400"></i> Continue Watching
                </h2>
            </div>
            <div class="cw-empty-state">
                <div class="w-20 h-20 mx-auto rounded-3xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-6">
                    <i data-lucide="play-circle" class="w-10 h-10 text-gold-400"></i>
                </div>
                <h3 class="text-2xl font-black mb-2 font-['Plus_Jakarta_Sans'] text-black dark:text-white">Nothing to continue yet</h3>
                <p class="text-gray-500 text-sm mb-8 max-w-xs mx-auto">Start watching an anime and it will appear here for quick access.</p>
                <button onclick="navigate('browse')" class="btn-primary px-10 py-4 rounded-2xl text-xs uppercase font-black tracking-[0.2em] shadow-2xl">
                    Browse Anime
                </button>
            </div>
        </section>`;
    }

    return `
    <section class="home-section anim-fade-in" id="cw-section">
        <div class="flex items-center justify-between px-[5%] mb-6">
            <div>
                <span class="text-gold-400 font-bold text-[10px] tracking-[0.3em] uppercase mb-1 block">Resume Playback</span>
                <h2 class="text-3xl font-black tracking-tight flex items-center gap-3 font-['Plus_Jakarta_Sans'] text-black dark:text-white">
                    <i data-lucide="clock" class="w-6 h-6 text-gold-400"></i> Continue Watching
                </h2>
            </div>
            <div class="flex items-center gap-4">
                <button onclick="showDiscoveryHub()" class="hidden md:flex items-center gap-2 px-4 py-2 bg-gold-400/10 text-gold-400 border border-gold-400/20 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gold-400 hover:text-black transition-all">
                    <i data-lucide="dices" class="w-4 h-4"></i> Surprise Me
                </button>
                <div class="flex gap-2">
                    <button onclick="scrollCW('left')" class="w-11 h-11 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gold-400 hover:border-gold-400/40 transition-all duration-300">
                        <i data-lucide="chevron-left" class="w-5 h-5"></i>
                    </button>
                    <button onclick="scrollCW('right')" class="w-11 h-11 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gold-400 hover:border-gold-400/40 transition-all duration-300">
                        <i data-lucide="chevron-right" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        </div>

        <div class="cw-carousel-container">
            <div class="cw-grid-track no-scrollbar" id="cw-track">
                ${entries.map((cw, index) => {
                    const a = animeData.find(a => a.id === cw.id);
                    if (!a) return '';
                    
                    const lastWatchedText = formatLastWatched(cw.updatedAt);
                    const epTitle = cw.episodeTitle || '';

                    return `
                    <div class="cw-card group" id="cw-card-${cw.id}">
                        <img src="${ensureHttps(a.image)}" class="cw-card-image" alt="${a.title}" loading="lazy">
                        <div class="cw-card-overlay"></div>
                        
                        <div class="cw-card-content">
                            <div class="mb-8 pointer-events-none">
                                <h3 class="text-3xl font-black font-['Plus_Jakarta_Sans'] leading-tight mb-2 truncate drop-shadow-2xl text-black dark:text-white">${a.title}</h3>
                                <p class="text-gray-700 dark:text-white/80 font-medium text-base flex items-center gap-3 font-['Inter']">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gold-400"></span>
                                    Episode ${cw.episode}${epTitle ? ' • ' + epTitle : ''}
                                </p>
                                <div class="flex items-center gap-4 mt-4 text-[10px] font-['IBM_Plex_Sans'] text-gray-400 dark:text-white/40 tracking-[0.1em] uppercase cw-metadata">
                                    <span class="text-gold-400 font-black">${cw.remainingTime || 0}m remaining</span>
                                    <span class="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10"></span>
                                    <span>${lastWatchedText}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4">
                                <button onclick="resumePlayback(${a.id}, ${cw.episode}, '${cw.language}', '${cw.quality}', ${cw.time})" 
                                    class="btn-cw-resume">
                                    <i data-lucide="play" class="w-4 h-4 fill-current"></i> Resume
                                </button>
                                <button onclick="removeCW(${a.id}, event)" class="btn-cw-remove" title="Remove from list">
                                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                                </button>
                            </div>
                        </div>

                        <div class="cw-progress-container">
                            <div class="cw-progress-fill" style="width: ${cw.progress}%">
                                <div class="cw-percentage-badge">${cw.progress}%</div>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    </section>`;
}

function formatLastWatched(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `Watched ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Watched ${hours}h ago`;
    if (hours < 48) return 'Watched yesterday';
    return `Watched ${Math.floor(hours / 24)}d ago`;
}

function scrollCW(dir) {
    const track = document.getElementById('cw-track');
    if (!track) return;
    const amount = track.offsetWidth * 0.8;
    track.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
}

function resumePlayback(id, ep, lang, qual, time) {
    window.resumeContext = { animeId: id, episode: ep, language: lang, quality: qual, time: time };
    navigate('player', id);
}

function removeCW(id, event) {
    if (event) event.stopPropagation();
    const card = document.getElementById(`cw-card-${id}`);
    
    if (window.gsap && card) {
        gsap.to(card, {
            opacity: 0,
            scale: 0.9,
            y: 20,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                if (window.continueWatchingService) {
                    continueWatchingService.remove(id);
                    window.continueWatching = continueWatchingService.getEntries();
                    card.remove(); // Remove only the card
                    
                    // If empty, re-render section for empty state
                    if (window.continueWatching.length === 0) {
                        const section = document.getElementById('cw-section');
                        if (section) section.innerHTML = renderContinueWatching();
                    }
                    lucide.createIcons();
                }
            }
        });
    } else {
        if (window.continueWatchingService) {
            continueWatchingService.remove(id);
            window.continueWatching = continueWatchingService.getEntries();
            if (card) card.remove();
            if (window.continueWatching.length === 0) {
                const section = document.getElementById('cw-section');
                if (section) section.innerHTML = renderContinueWatching();
            }
            lucide.createIcons();
        }
    }
}

function getBecauseYouWatchedList(featured) {
    if (!featured) return animeData.slice(0, 8);
    const related = animeData.filter(a => a && a.id !== featured.id && Array.isArray(a.genres) && a.genres.some(g => featured.genres?.includes(g)));
    return [...related, ...animeData.filter(a => a && a.id !== featured.id)]
        .filter((anime, index, list) => list.findIndex(item => item.id === anime.id) === index)
        .slice(0, 8);
}

function renderWideFeatureRow(title, description, items, icon = 'sparkles') {
    const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 6) : [];
    if (!safeItems.length) return '';
    return `
    <section class="home-section anim-fade-in">
        ${renderSectionHeader(title, description, icon)}
        <div class="wide-feature-row">
            ${safeItems.map(a => `
                <button onclick="navigate('anime', ${a.id})" class="wide-feature-card glass-card glass-card-hover">
                    <img src="${ensureHttps(a.banner || a.image)}" alt="${a.title}" loading="lazy">
                    <span class="wide-feature-shade"></span>
                    <span class="wide-feature-copy">
                        <span class="wide-feature-title">${a.title}</span>
                        <span class="wide-feature-meta">${a.genres?.[0] || 'Anime'} - Ep ${a.episodes || 1}</span>
                    </span>
                </button>
            `).join('')}
        </div>
    </section>`;
}

function renderComingSoon() {
    const soon = animeData
        .filter(a => a && String(a.status || '').toLowerCase() === 'coming soon')
        .slice(0, 8);
    return `
    <section class="home-section anim-fade-in">
        ${renderSectionHeader('Coming Soon', 'Your next favorite anime and movies are...', 'calendar-clock')}
        <div class="coming-grid">
            ${soon.length ? soon.map(a => `
                <button onclick="navigate('anime', ${a.id})" class="coming-card glass-card glass-card-hover">
                    <img src="${ensureHttps(a.banner || a.image)}" alt="${a.title}" loading="lazy">
                    <span class="coming-card-shade"></span>
                    <span class="coming-count">${(a.type === 'animated-movie' || a.type === 'live-movie') ? 'Movie' : 'Anime'}</span>
                    ${a.releaseDate ? `<span class="coming-card-countdown" aria-label="Countdown to ${a.title}">
                        <span class="coming-card-countdown-label"><i data-lucide="clock-3"></i> Releasing in</span>
                        ${renderCountdown(a.releaseDate, a.releaseTime, a.id)}
                    </span>` : ''}
                    <h3>${a.title}</h3>
                    <p>${a.studio || 'Studio TBA'}</p>
                </button>
            `).join('') : `
                <div class="coming-empty glass-card">
                    <i data-lucide="calendar-plus" class="w-6 h-6 text-gold-400"></i>
                    <div>
                        <h3>New premieres are being lined up</h3>
                        <p>Upcoming anime and movies will appear here soon.</p>
                    </div>
                </div>
            `}
        </div>
    </section>`;
}

function renderStudiosRow() {
    const studioStats = animeData
        .filter(a => a && String(a.studio || '').trim())
        .reduce((acc, anime) => {
            const name = String(anime.studio).trim();
            acc[name] = acc[name] || { name, count: 0 };
            acc[name].count += 1;
            return acc;
        }, {});
    const studios = Object.values(studioStats).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    if (!studios.length) return '';
    return `
    <section class="home-section anim-fade-in">
        ${renderSectionHeader('Featured Studios', 'Creator hubs shaping the biggest animated worlds.', 'clapperboard')}
        <div class="studio-row">
            ${studios.map((studio, index) => `
                <button class="studio-chip glass-card glass-card-hover" style="--studio-index:${index}">
                    <span>${studio.name}</span>
                    <small>${studio.count} ${studio.count === 1 ? 'title' : 'titles'}</small>
                </button>
            `).join('')}
        </div>
    </section>`;
}

function renderNewsAndActivity() {
    return `
    <section class="home-section anim-fade-in">
        ${renderSectionHeader('Anime News', 'Editorial updates and anime news are coming soon.', 'newspaper')}
        <div class="news-card news-card-placeholder glass-card">
            <i data-lucide="newspaper" class="w-7 h-7 text-gold-400"></i>
            <div>
                <h3>Coming soon</h3>
                <p>Anime news will appear here when the news system is ready.</p>
            </div>
        </div>
    </section>`;
}

// ============ RENDER: BROWSE ============
function renderBrowse(type, selectedGenre = null) {
    const desiredType = type === 'Movie'
        ? 'movie'
        : type === 'Series'
            ? 'anime'
            : null;

    const list = animeData.filter((a) => {
        const isMovie = (a.type === 'animated-movie' || a.type === 'live-movie');
        const matchesType = desiredType
            ? (desiredType === 'movie' ? isMovie : (a.type || 'anime') === desiredType)
            : true;
        const matchesGenre = !selectedGenre || (Array.isArray(a.genres) && a.genres.includes(selectedGenre));
        return matchesType && matchesGenre;
    });

    return `
    <div class="pt-24 pb-20 min-h-screen">
        <div class="max-w-7xl mx-auto px-4 md:px-8">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 class="text-3xl md:text-4xl font-black mb-2 anim-slide-up">${selectedGenre ? `${selectedGenre} Collection` : `Browse ${type === 'Movie' ? 'Movies' : type === 'Series' ? 'Series' : 'All Anime'}`}</h1>
                    <p class="text-gray-500 anim-slide-up anim-delay-1">${selectedGenre ? `Discover ${list.length} anime in ${selectedGenre}.` : 'Discover your next favorite anime'}</p>
                </div>
                <button onclick="showDiscoveryHub()" class="btn-primary px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-black anim-slide-up anim-delay-2 group">
                    <i data-lucide="dices" class="w-5 h-5 group-hover:rotate-12 transition-transform"></i> Surprise Me
                </button>
            </div>
            
            <div class="flex overflow-x-auto gap-2 mb-8 pb-2 carousel-container anim-slide-up anim-delay-2">
                ${['All', ...getVisibleGenres()].map(c => `<button onclick="filterByGenre('${c}')" class="category-pill ${c === 'All' ? 'active' : ''} ${selectedGenre === c ? 'ring-2 ring-gold-400' : ''}">${c}</button>`).join('')}
            </div>

            <!-- Anime Grid -->
            <div id="browse-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                ${list.map(a => `
                    <div onclick="navigate('anime', ${a.id})" class="anime-card anim-fade-in">
                        <div class="relative aspect-[3/4] rounded-2xl overflow-hidden bg-dark-700">
                            <img src="${ensureHttps(a.image)}" class="w-full h-full object-cover" alt="${a.title}" loading="lazy">
                            <div class="card-overlay"></div>
                            <div class="absolute top-2 left-2 flex flex-col gap-1">
                                ${a.premium ? '<span class="badge-premium">Premium</span>' : ''}
                            </div>
                            <div class="absolute top-2 right-2">
                                <button onclick="event.stopPropagation(); toggleWatchlist(${a.id})" class="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 transition-all">
                                    <i data-lucide="bookmark" class="w-3.5 h-3.5 ${isBookmarked(a.id) ? 'fill-gold-400 text-gold-400' : ''}"></i>
                                </button>
                            </div>
                            <div class="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-lg px-2 py-0.5">
                                <i data-lucide="star" class="w-3 h-3 fill-gold-400 text-gold-400"></i>
                                <span class="text-xs font-bold">${a.averageRating || 'N/A'}</span>
                            </div>
                            <div class="card-actions">
                                <button class="w-full btn-primary flex items-center justify-center gap-2 py-2 rounded-xl text-xs">
                                    <i data-lucide="play" class="w-4 h-4 fill-current"></i> Watch
                                </button>
                            </div>
                        </div>
                        <div class="mt-2 px-1">
                            <p class="font-semibold text-sm truncate">${a.title}</p>
                            <p class="text-xs text-gray-500 mt-0.5">${Array.isArray(a.genres) && a.genres.length > 0 ? a.genres[0] : 'Unknown'} · ${a.year || 'N/A'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>`;
}


// ============ RENDER: MY LIST ============
function renderMyList() {
const listAnime = animeData.filter(a => isBookmarked(a.id));
    return `

    <div class="pt-24 pb-20 min-h-screen">
        <div class="max-w-7xl mx-auto px-4 md:px-8">
            <h1 class="text-3xl md:text-4xl font-black mb-2 anim-slide-up flex items-center gap-3">
                <i data-lucide="bookmark" class="w-8 h-8 text-gold-400"></i> My List
            </h1>
            <p class="text-gray-500 mb-8 anim-slide-up anim-delay-1">${listAnime.length} anime saved</p>
            ${listAnime.length === 0 ? `
                <div class="text-center py-20 anim-fade-in">
                    <div class="w-20 h-20 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <i data-lucide="bookmark" class="w-10 h-10 text-gray-600"></i>
                    </div>
                    <p class="text-xl font-bold mb-2">Your list is empty</p>
                    <p class="text-gray-500 mb-6">Start adding anime to your watchlist</p>
                    <button onclick="navigate('browse')" class="btn-primary px-6 py-3">Browse Anime</button>
                </div>
            ` : `
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    ${listAnime.map(a => `
                        <div onclick="navigate('anime', ${a.id})" class="anime-card anim-fade-in">
                            <div class="relative aspect-[3/4] rounded-2xl overflow-hidden bg-dark-700">
                                <img src="${ensureHttps(a.image)}" class="w-full h-full object-cover" alt="${a.title}" loading="lazy">
                                <div class="card-overlay"></div>
                                <div class="card-actions">
                                    <button onclick="event.stopPropagation(); toggleWatchlist(${a.id})" class="w-full btn-secondary flex items-center justify-center gap-2 py-2 rounded-xl text-xs">
                                        <i data-lucide="x" class="w-4 h-4"></i> Remove
                                    </button>
                                </div>
                            </div>
                            <div class="mt-2 px-1">
                                <p class="font-semibold text-sm truncate">${a.title}</p>
                                <p class="text-xs text-gray-500 mt-0.5">${Array.isArray(a.genres) && a.genres.length > 0 ? a.genres[0] : 'Unknown'} · ${a.episodes || 0} eps</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    </div>`;
}

// ============ RENDER: ANIME DETAIL ============
function getSmartHeroTitle(title) {
    const fullTitle = String(title || 'Untitled').trim();
    const length = [...fullTitle].length;
    let displayTitle = fullTitle;
    if (length > 80) {
        const words = fullTitle.split(/\s+/);
        let shortened = '';
        for (const word of words) {
            const candidate = shortened ? `${shortened} ${word}` : word;
            if (candidate.length > 68) break;
            shortened = candidate;
        }
        displayTitle = `${shortened || fullTitle.slice(0, 68).trim()}…`;
    }

    return {
        displayTitle,
        className: length <= 25 ? 'hero-title--short'
            : length <= 50 ? 'hero-title--medium'
            : length <= 80 ? 'hero-title--long'
            : 'hero-title--extra-long',
    };
}

function renderAnimeDetail(id) {
    const a = animeData.find(a => a.id === id) || animeData[0];
    if (!a || typeof a !== 'object') {
        return `<div class="pt-24 pb-20 min-h-screen flex items-center justify-center">
            <div class="text-center glass-card rounded-2xl p-8 max-w-md">
                <h1 class="text-2xl font-black mb-2">Anime not found</h1>
                <p class="text-gray-500 mb-6">The anime you're looking for doesn't exist.</p>
                <button onclick="navigate('home')" class="btn-primary">Back to Home</button>
            </div>
        </div>`;
    }
    const inWatchlist = isBookmarked(a.id);
    const releaseReminderEnabled = hasReleaseReminder(a.id);
    const heroTitleInfo = getSmartHeroTitle(a.title);
    
    // Check if anime is Coming Soon
    const isComingSoon = String(a.status || '').toLowerCase() === 'coming soon';
    
    console.log('[renderAnimeDetail] Anime ID:', a.id);
    console.log('[renderAnimeDetail] Status:', a.status, 'isComingSoon:', isComingSoon);
    console.log('[renderAnimeDetail] releaseDate:', a.releaseDate, 'Type:', typeof a.releaseDate);
    console.log('[renderAnimeDetail] releaseTime:', a.releaseTime);

    // Used by addComment() to know current anime
    document.addEventListener('DOMContentLoaded', () => {
        const root = document.getElementById('anime-detail-root');
        if (root) root.dataset.animeId = String(id);
    });

    const allOtherTitles = animeData.filter(s => s && s.id !== a.id);
    const genreMatches = allOtherTitles.filter(s => Array.isArray(s.genres) && Array.isArray(a.genres) && s.genres.some(g => a.genres.includes(g)));
    const similar = [...genreMatches, ...allOtherTitles]
        .filter((title, index, list) => list.findIndex(item => item.id === title.id) === index)
        .slice(0, 12);

    const year = a.year ?? '';
    const runtime = a.type === 'animated-movie' || a.type === 'live-movie' ? '1h 35m' : '24 min';
    const language = a.type === 'anime' ? 'Japanese' : 'English';

    // (metaLine kept for future use; not rendered in current premium layout)
    const metaLine = `${year} • ${runtime} • ${Array.isArray(a.genres) ? a.genres.join(' • ') : 'Unknown'} • ${a.studio || 'Unknown'} • ${language}`;


    const backdropMedia = shouldShowBannerVideo(a)
        ? `<video class="hero-backdrop-media" muted autoplay loop playsinline poster="${ensureHttps(a.banner || a.image)}">
                <source src="${ensureHttps(a.bannerVideo || '')}" type="video/mp4">
           </video>`
        : `<img class="hero-backdrop-media" src="${ensureHttps(a.banner || a.image)}" alt="${a.title} backdrop">`;

    // Movie section header/actions
    const typeLabel = (a.type || 'anime') === 'anime' ? 'Anime Series' : 'Movie';
    const watchLabel = (a.type || 'anime') === 'anime' ? 'Watch Episode 1' : 'Watch Movie';
    const episodesMedia = Array.isArray(a?.episodesMedia) ? a.episodesMedia : null;
    const episodeNumbers = episodesMedia
        ? [...new Set(episodesMedia
            .map(e => Number(e?.episodeNumber))
            .filter(n => Number.isFinite(n) && n >= 1))
          ].sort((x, y) => x - y)
        : Array.from({ length: Math.min(Number(a?.episodes || 1), 24) }, (_, i) => i + 1);

    const displayedEpisodes = episodeNumbers.slice(0, 24).length;
    const totalEpisodesForLabel = episodesMedia
        ? Math.max(1, episodeNumbers.length)
        : Math.max(1, Number(a.episodes || 1));

    const movieSection = isComingSoon 
        ? `
            <section class="detail-section detail-episodes anim-fade-in">
                <div class="detail-section-head detail-heading-accent">
                    <h2>Episodes</h2>
                    <span>Coming Soon</span>
                </div>
                <div class="detail-episodes-coming-soon">
                    <div class="coming-soon-episodes-icon">
                        <i data-lucide="clock" class="w-8 h-8"></i>
                    </div>
                    <h3>Episodes Coming Soon</h3>
                    <p>No episodes are available yet. Check back closer to the release date.</p>
                    ${a.releaseDate ? `
                    <div class="coming-soon-episodes-date">
                        <span class="episodes-date-label">Expected:</span>
                        <span class="episodes-date-value">${formatReleaseDate(a.releaseDate, a.releaseTime)}</span>
                    </div>
                    ` : ''}
                </div>
            </section>`
        : ((a.type || 'anime') === 'anime')
        ? `
            <section class="detail-section detail-episodes anim-fade-in">
                <div class="detail-section-head detail-heading-accent">
                    <h2>Episodes</h2>
                    <span>Showing first ${displayedEpisodes} of ${totalEpisodesForLabel}</span>
                </div>
                <div class="detail-episode-grid">
                    ${episodeNumbers.slice(0, 24).map((epNum, i) => {
                        const epObj = Array.isArray(episodesMedia) ? episodesMedia.find(e => Number(e?.episodeNumber) === Number(epNum)) : null;
                        const epViews = Number(epObj?.views) || 0;
                        const formattedViews = formatViewCount(epViews);
                        return `
                        <button onclick="navigate('player', ${a.id})" class="detail-episode-tile ${i === 0 ? 'is-active' : ''}" aria-label="Watch episode ${epNum} (${formattedViews})" title="Episode ${epNum} • ${formattedViews}">
                            <span>${epNum}</span>
                        </button>
                    `;}).join('')}
                </div>
            </section>`
        : `
            <section class="detail-section detail-episodes anim-fade-in">
                <div class="detail-section-head detail-heading-accent">
                    <h2>Movie</h2>
                    <span>Full feature</span>
                </div>
                <div class="detail-movie-card">
                    <div>
                        <h3>${a.title}</h3>
                        <p>${runtime} in HD quality</p>
                    </div>
                    <button onclick="navigate('player', ${a.id})" class="btn-premium-large">
                            <i data-lucide="play" class="w-5 h-5"></i> Watch Movie
                    </button>
                </div>
            </section>`;

    const recommendedSection = similar.length > 0
        ? `
            <section class="detail-section detail-recommendations anim-fade-in">
                <div class="detail-section-head detail-heading-accent">
                    <h2>You Might Also Like</h2>
                    <button onclick="navigate('browse')" class="detail-see-all">See All <i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                </div>
                <button class="detail-rec-arrow detail-rec-arrow-left" onclick="this.parentElement.querySelector('.recommend-grid').scrollBy({ left: -620, behavior: 'smooth' })" aria-label="Previous recommendations">
                    <i data-lucide="chevron-left" class="w-6 h-6"></i>
                </button>
                <button class="detail-rec-arrow detail-rec-arrow-right" onclick="this.parentElement.querySelector('.recommend-grid').scrollBy({ left: 620, behavior: 'smooth' })" aria-label="Next recommendations">
                    <i data-lucide="chevron-right" class="w-6 h-6"></i>
                </button>
                <div class="recommend-grid">
                    ${similar.map(s => `
                        <div onclick="navigate('anime', ${s.id})" class="recommend-card">
                            <div class="recommend-poster">
                                <img src="${ensureHttps(s.image)}" alt="${s.title}" loading="lazy" class="recommend-poster-img" />
                                <div class="recommend-poster-gradient"></div>
                                <div class="recommend-badges">
                                    <span class="badge-premium"><i data-lucide="${(s.type === 'animated-movie' || s.type === 'live-movie') ? 'film' : 'calendar'}" class="w-3 h-3"></i> ${(s.type === 'animated-movie' || s.type === 'live-movie') ? 'Movie' : 'Anime'}</span>
                                    <span class="recommend-imdb-badge">${s.averageRating || s.rating || 'N/A'}</span>
                                </div>
                            </div>
                            <div class="recommend-body">
                                <div class="recommend-title">${s.title}</div>
                                <div class="recommend-meta">${s.year || 'N/A'} • ${s.episodes || 0} eps</div>
                                <div class="recommend-rating">
                                    <i data-lucide="star" class="w-3 h-3 fill-gold-400 text-gold-400"></i>
                                    <span class="text-xs">${s.averageRating || 'N/A'}</span>
                                    <span class="text-xs text-gray-400 ml-1">(${s.ratingCount || 0})</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>`
        : '';

    return `
    <div id="anime-detail-root" data-anime-id="${id}" class="pt-0 pb-20">
        <section class="hero-stream">
            <div class="hero-stream-backdrop">
                ${backdropMedia}
                <div class="hero-stream-overlay"></div>
            </div>

            <div class="hero-stream-inner">
                <div class="hero-stream-container">
                    <div class="hero-stream-grid">
                        <!-- Left: Poster -->
                        <aside class="hero-poster-col">
                            <img src="${ensureHttps(a.image)}" alt="${a.title} poster" loading="lazy" class="hero-poster-img" />
                        </aside>

                        <!-- Center: Information -->
                        <div class="hero-center-col">
                            <div class="hero-badge-row">
                                <span class="hero-movie-badge"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${typeLabel}</span>
                                ${a.premium ? '<span class="badge-premium">Premium</span>' : ''}
                                <span class="hero-status-badge">${a.status || 'Airing'}</span>
                                <span class="hero-studio-badge">${a.studio || 'Unknown'}</span>
                            </div>

                            <div class="hero-title-wrap">
                                <h1 class="hero-title ${heroTitleInfo.className}" data-full-title="${escapeHtml(a.title)}" tabindex="0" aria-label="${escapeHtml(a.title)}">${escapeHtml(heroTitleInfo.displayTitle)}<span class="hero-title-info" aria-hidden="true">ⓘ</span></h1>
                                <span class="hero-title-tooltip" role="tooltip">${escapeHtml(a.title)}</span>
                            </div>
                            <div class="hero-native-title">${a.titleJp || ''}</div>
                            <div class="hero-meta-strip">
                                <span class="hero-rating-inline"><i data-lucide="star" class="w-4 h-4"></i> ${a.averageRating || 'N/A'}<span>/10</span><span class="text-xs text-gray-400 ml-1">(${a.ratingCount || 0} ratings)</span></span>
                                <span class="hero-meta-inline"><i data-lucide="calendar-days" class="w-4 h-4"></i> ${a.year || 'N/A'}</span>
                                <span class="hero-meta-inline"><i data-lucide="layers" class="w-4 h-4"></i> ${(a.type || 'anime') === 'anime' ? `${a.episodes || 0} Episodes` : runtime}</span>
                            </div>

                            <div class="hero-subtitle">
                                <span class="hero-pill">${a.year}</span>
                                <span class="hero-dot">•</span>
                                <span class="hero-pill">${runtime}</span>
                            </div>

                            <div class="hero-meta-row">
                                ${getGenreBadgeMarkup(a.genres)}
                            </div>

                            <p class="hero-desc">${a.desc}</p>

                            <div class="hero-rating-row">
                                <span class="pill-rate">⭐ ${a.averageRating || 'N/A'}/10</span>
                                <span class="pill-rate text-xs text-gray-400">(${a.ratingCount || 0} ratings)</span>
                            </div>
                            
                            <!-- User Rating Control -->
                            <div class="hero-user-rating" id="user-rating-container">
                                <div class="text-xs text-gray-400 mb-2">Your Rating</div>
                                <div class="flex items-center gap-2">
                                    <input type="range" id="user-rating-slider" min="0" max="10" step="0.5" value="0" 
                                        class="w-32 accent-gold-400 cursor-pointer" 
                                        oninput="updateUserRatingDisplay(this.value)"
                                        onchange="submitUserRating(${a.id}, this.value)">
                                    <span id="user-rating-value" class="text-gold-400 font-bold w-8">0</span>
                                    <span class="text-xs text-gray-400">/10</span>
                                </div>
                            </div>

                            <div class="hero-actions">
                                ${isComingSoon ? `
                                    ${a.trailer ? `
                                    <button onclick="window.open('${a.trailer}', '_blank')" class="btn-premium-large">
                                        <i data-lucide="film" class="w-5 h-5"></i> Watch Trailer
                                    </button>
                                    ` : `
                                    <button class="btn-premium-large btn-disabled" disabled>
                                        <i data-lucide="clock" class="w-5 h-5"></i> Coming Soon
                                    </button>
                                    `}
                                ` : `
                                    <button onclick="navigate('player', ${a.id})" class="btn-premium-large">
                                        <i data-lucide="play" class="w-5 h-5"></i> ${watchLabel}
                                    </button>
                                `}

                                <button onclick="toggleWatchlist(${a.id}, { isUserWatchlistAction: true })" class="btn-glass">
                                    <i data-lucide="${inWatchlist ? 'bookmark-check' : 'bookmark'}" class="w-5 h-5 ${inWatchlist ? 'text-gold-400' : ''}"></i>
                                    ${inWatchlist ? 'In List' : 'Add to List'}
                                </button>

                                <button onclick="toggleFavorite(${a.id})" class="btn-glass-heart" aria-label="Favorite" data-favorite-anime-id="${a.id}">
                                    <i data-lucide="heart" class="w-5 h-5 ${isFavorited(a.id) ? 'fill-gold-400 text-gold-400' : ''}"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Right: Info Card / Coming Soon Section -->
                        <aside class="hero-right-col">
                            ${isComingSoon ? `
                            <div class="hero-coming-soon-card">
                                <div class="coming-soon-header">
                                    <div class="coming-soon-badge">
                                        <span class="coming-soon-icon">✦</span>
                                        <span class="coming-soon-text">COMING SOON</span>
                                        <span class="coming-soon-jp">未公開</span>
                                    </div>
                                    <div class="coming-soon-glow"></div>
                                </div>
                                
                                <div class="coming-soon-content">
                                    <p class="coming-soon-message">The next episode is on its way.</p>
                                    
                                    <div class="coming-soon-release">
                                        <div class="coming-soon-label">
                                            <i data-lucide="calendar" class="w-4 h-4"></i>
                                            Expected Release
                                        </div>
                                        <div class="coming-soon-date">${formatReleaseDate(a.releaseDate, a.releaseTime)}</div>
                                    </div>
                                    
                                    ${a.releaseDate ? `
                                    <div class="coming-soon-countdown-wrapper">
                                        ${renderCountdown(a.releaseDate, a.releaseTime, a.id)}
                                    </div>
                                    ` : ''}
                                    
                                    <button onclick="toggleReleaseNotification(${a.id})" class="coming-soon-notify-btn" id="notify-btn-${a.id}">
                                        <i data-lucide="${releaseReminderEnabled ? 'bell-check' : 'bell'}" class="w-4 h-4"></i>
                                        ${releaseReminderEnabled ? 'Notification Enabled' : 'Notify Me'}
                                    </button>
                                </div>
                                
                                <div class="coming-soon-decorative">
                                    <span class="coming-soon-particle particle-1"></span>
                                    <span class="coming-soon-particle particle-2"></span>
                                    <span class="coming-soon-particle particle-3"></span>
                                </div>
                            </div>
                            ` : `
                            <div class="hero-info-card">
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Type</div>
                                    <div class="hero-info-value">${a.type || 'anime'}</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Status</div>
                                    <div class="hero-info-value">${a.status || 'Airing'}</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Release Date</div>
                                    <div class="hero-info-value">${a.year || '—'}</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Director</div>
                                    <div class="hero-info-value">—</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Studio</div>
                                    <div class="hero-info-value">${a.studio || 'Unknown'}</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Duration</div>
                                    <div class="hero-info-value">${runtime}</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Language</div>
                                    <div class="hero-info-value">${language}</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Rating</div>
                                    <div class="hero-info-value">${a.rating}</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">Quality</div>
                                    <div class="hero-info-value">1080p</div>
                                </div>
                                <div class="hero-info-top">
                                    <div class="hero-info-label">User Score</div>
                                    <div class="hero-info-value">${Math.min(99, Math.max(1, Math.round(60 + (a.rating - 7) * 8)))}%</div>
                                </div>

                                <div class="hero-progress" aria-label="Quality progress">
                                    <div class="hero-progress-fill"></div>
                                </div>
                            </div>
                            `}
                        </aside>
                    </div>
                </div>
            </div>
        </section>

        <!-- Trailer Section (premium card; uses existing trailer url if present) -->
        <section class="mt-10 anim-fade-in">
            <div class="max-w-7xl mx-auto px-4 md:px-8">
                <div class="trailer-card">
                    <div class="trailer-thumb" role="button" tabindex="0">
                        <div class="trailer-thumb-bg" style="background-image:url('${a.banner || a.image}');"></div>
                        <div class="trailer-play">
                            <i data-lucide="play" class="w-7 h-7"></i>
                        </div>
                        <div class="trailer-grad"></div>
                    </div>
                    <div class="trailer-content">
                        <h3 class="trailer-title">Trailer</h3>
                        <div class="trailer-meta">${a.year || '—'} • 2:12 • Streaming</div>
                        <button class="btn-trailer" onclick="${a.trailer ? `window.open('${a.trailer}', '_blank')` : 'showToast(\'Trailer not available yet.\')'}">
                            <i data-lucide="film" class="w-4 h-4"></i> Watch Trailer
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <section class="detail-section detail-overview anim-fade-in">
            <div class="detail-overview-main">
                <h2>Overview</h2>
                <p>${a.desc}</p>
            </div>
        </section>

        ${movieSection}

        ${recommendedSection}

        <!-- Reviews & Comments -->
        <section class="review-section anim-fade-in" aria-labelledby="reviews-title">
            <div class="review-section-inner">
                <header class="review-heading">
                    <div class="review-heading-main">
                        <span class="review-heading-icon" aria-hidden="true"><i data-lucide="message-circle"></i></span>
                        <div>
                            <p class="review-eyebrow">Community notes</p>
                            <h2 id="reviews-title">Reviews & Comments</h2>
                            <p class="review-heading-copy">Share a rating or a quick take with the community. Your perspective helps other fans find their next favorite.</p>
                        </div>
                    </div>
                    <div class="review-count" aria-label="${comments.length} community reviews">
                        <i data-lucide="users" aria-hidden="true"></i>
                        <strong>${comments.length}</strong>
                        <span>community reviews</span>
                    </div>
                </header>

                ${getAuthToken() ? `
                <form class="review-composer" id="review-form" aria-label="Write a review" onsubmit="return false;">
                    <div class="review-composer-top">
                        <div class="review-author">
                            <span class="review-avatar-shell">
                                <img src="${getCurrentAvatarUrl()}" class="review-avatar" alt="${escapeHtml(getCurrentUsername())} avatar" onerror="this.hidden=true;this.nextElementSibling.hidden=false;">
                                <span class="review-avatar review-avatar-fallback" aria-hidden="true" hidden>${escapeHtml(getCommentInitials(getCurrentUsername()))}</span>
                            </span>
                            <div>
                                <h3>Share your take</h3>
                                <p>Your review will be public on this title.</p>
                            </div>
                        </div>
                        <div class="review-draft-state"><span aria-hidden="true"></span> Draft ready</div>
                    </div>

                    <div class="review-composer-grid">
                        <fieldset class="review-rating-panel">
                            <legend class="review-field-label">Rate this title <span class="review-optional">Optional</span></legend>
                            <p class="review-field-helper" id="rating-helper">Tap a star to add your overall feeling.</p>
                            <div class="review-rating-stars" id="rating-selector" role="group" aria-label="Rate this title from 1 to 5 stars">
                                ${[1, 2, 3, 4, 5].map(star => `
                                    <button type="button" class="rating-star" data-rating="${star}" data-selected="false" aria-label="${star} star${star === 1 ? '' : 's'}" aria-pressed="false" onclick="setRating(${star})">
                                        <i data-lucide="star" aria-hidden="true"></i>
                                    </button>
                                `).join('')}
                            </div>
                            <input type="hidden" id="comment-rating" value="0">
                            <div class="review-rating-readout" aria-live="polite"><strong id="rating-value">0 / 5</strong><span>selected rating</span></div>
                            <div class="review-rating-status" id="rating-status" aria-live="polite">Choose a star to rate this title.</div>
                        </fieldset>

                        <div class="review-field">
                            <label class="review-field-label" for="comment-input">Your review</label>
                            <p class="review-field-helper" id="review-helper">Keep it thoughtful and spoiler-free for everyone.</p>
                            <div class="review-textarea-wrap">
                                <textarea id="comment-input" maxlength="280" rows="5" aria-describedby="review-helper review-counter" placeholder="What stood out to you?" oninput="updateReviewComposerState()"></textarea>
                                <span class="review-character-count" id="review-counter">0 / 280</span>
                            </div>
                        </div>
                    </div>

                    <div class="review-composer-footer">
                        <div class="review-privacy-note"><i data-lucide="shield-check" aria-hidden="true"></i><span>Visible to the community</span></div>
                        <button type="button" class="review-post-button" onclick="addComment()"><i data-lucide="send" aria-hidden="true"></i> Post review</button>
                    </div>
                    <div class="review-status" id="review-status" aria-live="polite">Choose a rating, then add a few words.</div>
                </form>
                ` : `
                <div class="review-signin-card" role="status">
                    <i data-lucide="lock" aria-hidden="true"></i>
                    <h3>Sign in to review</h3>
                    <p>You need to be signed in to post reviews and comments.</p>
                    <button type="button" class="review-post-button" onclick="navigate('login')">Sign in</button>
                </div>
                `}

                <div class="review-comments-heading">
                    <h3>What the community is saying</h3>
                    <p>Latest thoughtful takes</p>
                </div>
                <div class="review-comment-list" aria-label="Community reviews">
                    ${comments.map(renderCommentRow).join('')}
                </div>
            </div>
        </section>
    </div>`;
}


// ============ RENDER: VIDEO PLAYER ============
function renderPlayer(id) {
    const a = animeData.find(a => a.id === id) || animeData[0];
    if (typeof playerService === 'undefined') {
        console.error('Error: playerService is not defined. Make sure playerService.js is loaded before script.js.');
        return `<div class="pt-24 text-center text-red-400">Player service failed to load.</div>`;
    }
    
    // Navigation to a new anime (or re-loading via details page) resets binge counter
    if (playerService.state) {
        playerService.state.bingeCount = 0;
    }

    const contentType = a?.type || 'anime';

    const hasSubEpisodes = a.episodesMedia && a.episodesMedia.some(e => e.sub);
    const hasDubEpisodes = a.episodesMedia && a.episodesMedia.some(e => e.dub);
    const episodeDefaultLanguage = hasSubEpisodes ? 'sub' : 'dub';

    const isMovie = contentType !== 'anime';
    const firstEp = (Array.isArray(a.episodesMedia) && a.episodesMedia.length > 0) ? a.episodesMedia[0] : null;
    const initialViews = isMovie ? (Number(a.views) || 0) : (Number(firstEp?.views) || 0);

    // Shell for persistent player
    return `
    <div id="player-view-mount" class="anime-watch-room pt-16 pb-20 min-h-screen">
        <div class="anime-watch-bg" aria-hidden="true"></div>
        <div class="max-w-7xl mx-auto px-3 md:px-5 relative z-10">
            <button onclick="navigate('anime', ${a.id})" class="anime-back flex items-center gap-2 py-3 px-4 text-sm text-gray-300 hover:text-white transition-colors anim-slide-up">
                <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to ${a.title}
            </button>

            <div class="anime-watch-layout flex flex-col lg:flex-row gap-6 items-start">
                <div class="flex-1">
                    <!-- Target for persistent player -->
                    <div id="persistent-player-mount" class="video-player-container anime-player-frame aspect-video"></div>

                    <div class="anime-player-meta mt-4 flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <p class="anime-kicker">Now Streaming</p>
                            <h2 class="text-xl md:text-2xl font-black text-white" id="player-main-title">${a.title}</h2>
                            <div class="flex items-center gap-2 mt-3 flex-wrap">
                                <span class="anime-chip uppercase" id="player-mode-label">${contentType === 'anime' ? 'Series' : 'Movie'}</span>
                                <span class="anime-chip" id="player-quality-label">1080p</span>
                                <span class="anime-chip flex items-center gap-1.5" id="player-view-count"><i data-lucide="play" class="w-3.5 h-3.5 fill-current text-gold-400"></i> <span id="current-episode-views">${formatViewCount(initialViews)}</span></span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="btn-secondary flex items-center gap-2 text-sm" onclick="downloadCurrentVideo()">
                                <i data-lucide="download" class="w-4 h-4"></i> Download
                            </button>
                            <button class="btn-secondary flex items-center gap-2 text-sm" onclick="navigate('anime', ${a.id})">
                                <i data-lucide="info" class="w-4 h-4"></i> Anime Details
                            </button>
                        </div>
                    </div>
                </div>

                ${contentType === 'anime' ? `
                <div class="w-full lg:w-80 flex-shrink-0">
                    <div class="glass-card rounded-2xl p-4 h-fit">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="font-bold flex items-center gap-2 text-white"><i data-lucide="list" class="w-4 h-4 text-gold-400"></i> Episodes</h3>
                        </div>
                        <div class="episode-language-tabs">
                            <button class="episode-language-tab active" data-episode-language="sub" onclick="switchEpisodeLanguage('sub')">Sub</button>
                            <button class="episode-language-tab" data-episode-language="dub" onclick="switchEpisodeLanguage('dub')">Dub</button>
                        </div>
                        <div class="overflow-y-auto max-h-[60vh] lg:max-h-[calc(100vh-12rem)] pb-4 pr-1" id="episode-list" data-anime-id="${a.id}">
                            ${renderEpisodeList(a, episodeDefaultLanguage)}
                        </div>
                    </div>
                </div>` : ''}
            </div>
        </div>
    </div>`;
}

// ============ RENDER: LOGIN ============
function renderLogin() {
    return `
    <div class="auth-container auth-cinematic">
        <div class="auth-cinematic-background" aria-hidden="true"></div>
        <div class="auth-cinematic-overlay" aria-hidden="true"></div>
        <div class="floating-orb w-96 h-96 bg-gold-400 top-1/4 left-1/4" style="animation-delay: 0s;"></div>
        <div class="floating-orb w-64 h-64 bg-purple-500 bottom-1/4 right-1/4" style="animation-delay: 3s;"></div>
        <div class="relative z-10 w-full max-w-md px-4 anim-slide-up">
            <div class="auth-card auth-cinematic-card">
                <div class="text-center mb-8">
                    <div class="w-14 h-14 bg-gradient-to-br from-gold-400 to-gold-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span class="text-black font-black text-2xl">A</span>
                    </div>
                    <h1 class="text-2xl font-black">Welcome Back</h1>
                    <p class="text-gray-500 text-sm mt-1">Sign in to your Anify account</p>
                </div>
            <div class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-gray-400 mb-1 block">Email</label>
                            <input id="login-email" type="email" placeholder="your@email.com" class="input-field" autocomplete="email">
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-400 mb-1 block">Password</label>
                            <input id="login-password" type="password" placeholder="••••••••" class="input-field" autocomplete="current-password">
                        </div>
                        <div class="flex items-center justify-between">
                            <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                                <input type="checkbox" class="rounded accent-gold-400"> Remember me
                            </label>
                            <a href="#" class="text-sm text-gold-400 hover:underline">Forgot password?</a>
                        </div>
                        <button onclick="handleLoginSubmit()" class="w-full btn-primary py-3" aria-label="Sign In">Sign In</button>

                    <div class="relative my-6">
                        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-white/10"></div></div>
                        <div class="relative flex justify-center text-xs"><span class="px-4 bg-transparent text-gray-500">or continue with</span></div>
                    </div>

                    <div class="grid grid-cols-3 gap-3">
                        <button onclick="navigate('home')" class="btn-secondary py-2.5 flex items-center justify-center">
                            <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        </button>
                        <button onclick="navigate('home')" class="btn-secondary py-2.5 flex items-center justify-center">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </button>
                        <button onclick="navigate('home')" class="btn-secondary py-2.5 flex items-center justify-center">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </button>
                    </div>
                </div>
                <p class="text-center text-sm text-gray-500 mt-6">Don't have an account? <button onclick="navigate('register')" class="text-gold-400 hover:underline font-medium">Sign Up</button></p>
            </div>
        </div>
    </div>`;
}

// ============ RENDER: REGISTER ============
function renderRegister() {
    return `
    <div class="auth-container auth-cinematic">
        <div class="auth-cinematic-background" aria-hidden="true"></div>
        <div class="auth-cinematic-overlay" aria-hidden="true"></div>
        <div class="floating-orb w-96 h-96 bg-gold-400 top-1/4 right-1/4" style="animation-delay: 0s;"></div>
        <div class="floating-orb w-64 h-64 bg-blue-500 bottom-1/4 left-1/4" style="animation-delay: 3s;"></div>
        <div class="relative z-10 w-full max-w-md px-4 anim-slide-up">
            <div class="auth-card auth-cinematic-card">
                <div class="text-center mb-8">
                    <div class="w-14 h-14 bg-gradient-to-br from-gold-400 to-gold-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span class="text-black font-black text-2xl">A</span>
                    </div>
                    <h1 class="text-2xl font-black">Create Account</h1>
                    <p class="text-gray-500 text-sm mt-1">Start your anime journey today</p>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium text-gray-400 mb-1 block">Username</label>
                        <input id="register-username" type="text" placeholder="animelover42" class="input-field">
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-400 mb-1 block">Email</label>
                        <input id="register-email" type="email" placeholder="your@email.com" class="input-field">
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-400 mb-1 block">Password</label>
                        <input id="register-password" type="password" placeholder="••••••••" class="input-field">
                    </div>
                    <div>
                        <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                            <input type="checkbox" class="rounded accent-gold-400"> I agree to the Terms of Service
                        </label>
                    </div>
                    <button onclick="handleRegisterSubmit()" class="w-full btn-primary py-3">Create Account</button>
                </div>

                <p class="text-center text-sm text-gray-500 mt-6">Already have an account? <button onclick="navigate('login')" class="text-gold-400 hover:underline font-medium">Sign In</button></p>
            </div>
        </div>
    </div>`;
}

// ============ PROFILE CUSTOMIZATION ============
let profileCustomizationDraft = null;

function getProfileAvatarUrl(avatarId) {
    return getProfileConfig().getAvatarUrl(resolveProfileAvatarId(avatarId));
}

function getProfileCustomizationDraft(profile) {
    const userId = String(profile?.id || 'guest');
    if (!profileCustomizationDraft || profileCustomizationDraft.userId !== userId) {
        profileCustomizationDraft = {
            userId,
            avatarId: resolveProfileAvatarId(profile?.avatarId),
            bio: String(profile?.bio || '').slice(0, 160),
            profileTheme: resolveProfileThemeId(profile?.profileTheme),
            editingBio: false,
        };
    }
    return profileCustomizationDraft;
}

function rerenderProfilePage() {
    const content = document.getElementById('main-content');
    if (!content || currentPage !== 'profile') return;
    content.innerHTML = renderProfile();
    loadProfileActivity();
    createLucideIconsSafe();
}

function scrollToProfileCustomization() {
    document.querySelector('.profile-customization')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setProfileCustomizationStatus(message, state = '') {
    const status = document.getElementById('profile-customization-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = `profile-customization__status${state ? ` is-${state}` : ''}`;
}

function updateProfileBioCounter(value) {
    const length = String(value || '').length;
    const counter = document.getElementById('profile-bio-count');
    if (counter) {
        counter.textContent = `${length} / 160 characters`;
        counter.classList.toggle('is-near-limit', length >= 140);
    }
    const preview = document.getElementById('profile-preview-bio');
    if (preview) preview.textContent = String(value || '').trim() || 'Add a bio to tell other anime fans a little about yourself.';
    if (profileCustomizationDraft) profileCustomizationDraft.bio = String(value || '').slice(0, 160);
}

function selectProfileAvatar(avatarId) {
    const nextAvatarId = resolveProfileAvatarId(avatarId);
    const draft = profileCustomizationDraft;
    if (!draft) return;
    draft.avatarId = nextAvatarId;
    document.querySelectorAll('[data-profile-avatar-option]').forEach((option) => {
        option.setAttribute('aria-pressed', String(option.dataset.avatarId === nextAvatarId));
    });
    document.querySelectorAll('[data-profile-avatar]').forEach((image) => {
        image.src = getProfileAvatarUrl(nextAvatarId);
    });
    saveProfileCustomization({ avatarId: nextAvatarId, silent: true });
}

function selectProfileTheme(themeId) {
    const nextTheme = resolveProfileThemeId(themeId);
    const draft = profileCustomizationDraft;
    if (!draft) return;
    draft.profileTheme = nextTheme;
    applyProfileTheme(nextTheme);
    document.querySelectorAll('[data-profile-theme-option]').forEach((option) => {
        option.setAttribute('aria-pressed', String(option.dataset.themeId === nextTheme));
    });
    setProfileCustomizationStatus(`${getProfileConfig().PROFILE_THEMES[nextTheme]?.label || 'Theme'} preview active`, 'success');
    saveProfileCustomization({ profileTheme: nextTheme, silent: true });
}

function beginBioEdit() {
    if (!profileCustomizationDraft) return;
    profileCustomizationDraft.editingBio = true;
    rerenderProfilePage();
    document.getElementById('profile-bio-input')?.focus();
}

function cancelBioEdit() {
    const profile = authService.getCurrentUser() || {};
    profileCustomizationDraft = {
        userId: String(profile.id || 'guest'),
        avatarId: resolveProfileAvatarId(profile.avatarId),
        bio: String(profile.bio || '').slice(0, 160),
        profileTheme: resolveProfileThemeId(profile.profileTheme),
        editingBio: false,
    };
    rerenderProfilePage();
}

function renderAvatarPicker(selectedAvatarId) {
    const config = getProfileConfig();
    return `
        <div class="profile-avatar-grid-wrap">
            <div class="profile-avatar-grid" role="group" aria-label="Choose an avatar">
                ${config.PROFILE_AVATARS.map((avatar) => {
                    const selected = avatar.id === selectedAvatarId;
                    return `
                        <button type="button" class="profile-avatar-option" data-profile-avatar-option data-avatar-id="${avatar.id}" aria-label="${escapeHtml(avatar.label)} avatar, ${escapeHtml(avatar.category)}" aria-pressed="${selected}" onclick="selectProfileAvatar('${avatar.id}')">
                            <img src="${config.getAvatarUrl(avatar.id)}" alt="${escapeHtml(avatar.label)} anime-inspired avatar" loading="lazy">
                            ${selected ? '<span class="profile-avatar-option__check" aria-hidden="true"><i data-lucide="check"></i></span>' : ''}
                            <span class="profile-avatar-option__label">${escapeHtml(avatar.label)}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>`;
}

function renderThemePreviewCard(themeId, selectedThemeId, mode = getCurrentTheme()) {
    const config = getProfileConfig();
    const theme = config.PROFILE_THEMES[themeId];
    if (!theme) return '';

    const selected = themeId === selectedThemeId;
    const tokens = resolveThemeTokenSet(theme, mode) || theme.tokens;
    const previewStyle = getProfilePreviewStyle(tokens);
    const safeThemeId = escapeHtml(themeId);

    return `
        <button type="button" class="profile-theme-card" data-profile-theme-option data-theme-id="${safeThemeId}" aria-label="${escapeHtml(theme.label)} theme" aria-pressed="${selected}" style="${previewStyle}" onclick="selectProfileTheme('${safeThemeId}')">
            <span class="profile-theme-card__mock" aria-hidden="true">
                <span class="profile-theme-card__avatar"></span>
                <span class="profile-theme-card__surface-hover"></span>
                <span class="profile-theme-card__button"></span>
            </span>
            <span class="profile-theme-card__title">${escapeHtml(theme.label)}</span>
            <span class="profile-theme-card__description">${escapeHtml(theme.description)}</span>
            <span class="profile-theme-card__check" aria-hidden="true"><i data-lucide="check"></i></span>
        </button>
    `;
}

function renderThemePicker(selectedThemeId) {
    const config = getProfileConfig();
    const mode = getCurrentTheme();
    return `
        <div class="profile-theme-grid" role="group" aria-label="Choose a profile theme">
            ${config.PROFILE_THEME_IDS.map((themeId) => renderThemePreviewCard(themeId, selectedThemeId, mode)).join('')}
        </div>`;
}

function renderProfileCustomization(profile, draft, totalEpisodes, watchedCount, bookmarkCount, favoriteCount) {
    const config = getProfileConfig();
    const theme = config.PROFILE_THEMES[draft.profileTheme] || config.PROFILE_THEMES[config.DEFAULT_PROFILE_THEME];
    const displayName = profile?.name || profile?.username || 'User';
    const username = profile?.username || 'user';
    const avatarUrl = getProfileAvatarUrl(draft.avatarId);
    const bio = draft.bio || '';

    return `
        <section class="profile-customization" aria-labelledby="profile-customization-title">
            <div class="profile-preview-card anim-slide-up">
                <div class="profile-preview-card__banner"></div>
                <div class="profile-preview-card__body">
                    <span class="profile-preview-card__badge"><i data-lucide="eye" class="w-3 h-3"></i> Live preview</span>
                    ${profile?.isSupporter ? '<span class="profile-preview-card__badge text-gold-400"><i data-lucide="heart" class="w-3 h-3"></i> Supporter</span>' : ''}
                    <img id="profile-preview-avatar" data-profile-avatar src="${avatarUrl}" class="profile-preview-card__avatar" alt="${escapeHtml(displayName)} avatar">
                    <h2 id="profile-customization-title" class="profile-preview-card__name">${escapeHtml(displayName)}</h2>
                    <p class="profile-preview-card__handle">@${escapeHtml(username)}${profile?.isSupporter ? ' · ❤️ Supporter' : ''}</p>
                    <p id="profile-preview-bio" class="profile-preview-card__bio">${escapeHtml(bio || 'Add a bio to tell other anime fans a little about yourself.')}</p>
                    <div class="profile-preview-card__footer"><span>${escapeHtml(theme.label)}</span><span>•</span><span>Public profile</span></div>
                </div>
            </div>

            <div class="profile-customization__controls">
                <div class="profile-editor-panel anim-slide-up anim-delay-1">
                    <div class="profile-editor-panel__heading">
                        <div><h3 class="profile-editor-panel__title"><i data-lucide="user-round"></i> Choose Avatar</h3><p class="profile-editor-panel__description">20 original anime-inspired avatars. Your choice appears across Anify.</p></div>
                        <span class="text-xs text-gray-500">${escapeHtml(config.getAvatar(draft.avatarId).label)}</span>
                    </div>
                    ${renderAvatarPicker(draft.avatarId)}
                </div>

                <div class="profile-editor-panel anim-slide-up anim-delay-2">
                    <div class="profile-editor-panel__heading">
                        <div><h3 class="profile-editor-panel__title"><i data-lucide="sparkles"></i> About Me</h3><p class="profile-editor-panel__description">A short note for fellow anime fans.</p></div>
                        ${draft.editingBio ? '' : '<button type="button" class="btn-secondary px-3 py-1.5 text-xs" onclick="beginBioEdit()">Edit</button>'}
                    </div>
                    ${draft.editingBio ? `
                        <div class="profile-bio-editor">
                            <label for="profile-bio-input" class="sr-only">About me</label>
                            <textarea id="profile-bio-input" maxlength="160" class="input-field" aria-describedby="profile-bio-count" oninput="updateProfileBioCounter(this.value)">${escapeHtml(bio)}</textarea>
                            <span id="profile-bio-count" class="profile-character-count">${bio.length} / 160 characters</span>
                        </div>
                        <div class="profile-customization__actions">
                            <button type="button" class="btn-secondary px-4 py-2 text-xs" onclick="cancelBioEdit()">Cancel</button>
                            <button type="button" class="btn-primary px-4 py-2 text-xs" onclick="saveProfileCustomization()">Save</button>
                        </div>
                    ` : `<p class="text-sm leading-6 text-gray-400">${escapeHtml(bio || 'Add a bio to tell other anime fans a little about yourself.')}</p>`}
                </div>

                <div class="profile-editor-panel anim-slide-up anim-delay-3">
                    <div class="profile-editor-panel__heading">
                        <div><h3 class="profile-editor-panel__title"><i data-lucide="palette"></i> Profile Theme</h3><p class="profile-editor-panel__description">Preview the entire Anify interface, not just this page.</p></div>
                        <span class="text-xs text-gray-500">${escapeHtml(theme.label)}</span>
                    </div>
                    ${renderThemePicker(draft.profileTheme)}
                    <p id="profile-customization-status" class="profile-customization__status" role="status" aria-live="polite"></p>
                    <div class="profile-customization__actions">
                        ${draft.editingBio ? '' : '<button type="button" class="btn-primary px-4 py-2 text-xs" onclick="saveProfileCustomization()">Save Changes</button>'}
                    </div>
                </div>

                <div class="profile-editor-panel anim-slide-up anim-delay-4">
                    <div class="profile-editor-panel__heading"><div><h3 class="profile-editor-panel__title"><i data-lucide="bar-chart-3"></i> Profile Stats</h3><p class="profile-editor-panel__description">Your personal Anify snapshot.</p></div></div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div class="rounded-xl bg-white/5 p-3 text-center"><p class="text-lg font-black text-primary">${watchedCount}</p><p class="text-[10px] text-gray-500 uppercase tracking-wide">Anime watched</p></div>
                        <div class="rounded-xl bg-white/5 p-3 text-center"><p class="text-lg font-black text-primary">${totalEpisodes}</p><p class="text-[10px] text-gray-500 uppercase tracking-wide">Episodes watched</p></div>
                        <div class="rounded-xl bg-white/5 p-3 text-center"><p class="text-lg font-black text-primary">${bookmarkCount}</p><p class="text-[10px] text-gray-500 uppercase tracking-wide">Bookmarks</p></div>
                        <div class="rounded-xl bg-white/5 p-3 text-center"><p class="text-lg font-black text-primary">${favoriteCount}</p><p class="text-[10px] text-gray-500 uppercase tracking-wide">Favorites</p></div>
                    </div>
                </div>
            </div>
        </section>`;
}

// ============ RENDER: PROFILE ============
function renderProfile() {
    const profile = authService.getCurrentUser();

    const username = profile?.username || 'User';
    const displayName = profile?.name || username;
    const userPlan = profile?.plan || 'Free';
    const userStatus = profile?.status || 'Active';
    const profileConfig = getProfileConfig();
    const draft = getProfileCustomizationDraft(profile);
    const bio = draft.bio || '';
    const profileTheme = resolveProfileThemeId(draft.profileTheme);
    const themeAccents = profileConfig.PROFILE_THEMES[profileTheme]?.tokens || profileConfig.PROFILE_THEMES[profileConfig.DEFAULT_PROFILE_THEME].tokens;
    const accent = themeAccents.primary;
    const avatarUrl = getProfileAvatarUrl(draft.avatarId);

    const watchedCount = continueWatching.length;
    const favoriteCount = interactionService && typeof interactionService.getFavoriteCount === 'function'
        ? interactionService.getFavoriteCount()
        : 0;
    const watchHistoryItems = (() => {
        const list = Array.isArray(continueWatching) ? continueWatching : [];
        return list
            .slice(0, 5)
            .map(cw => {
                const anime = animeData.find(a => a.id === cw.id);
                if (!anime) return null;
                const ts = cw.updatedAt || cw.time;
                return {
                    anime,
                    timeLabel: ts ? timeAgo(ts) : '',
                };
            })
            .filter(Boolean);
    })();
    const totalEpisodes = continueWatching.reduce((total, item) => total + Math.max(0, Number(item.episode) || 0), 0);
    const totalMinutes = Math.round(continueWatching.reduce((total, item) => total + Math.max(0, Number(item.time) || 0), 0) / 60);
    const genreCounts = continueWatching.reduce((counts, item) => {
        const anime = animeData.find(a => Number(a.id) === Number(item.id));
        (anime?.genres || []).forEach(genre => { counts[genre] = (counts[genre] || 0) + 1; });
        return counts;
    }, {});
    const preferredGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([genre]) => genre);
    const pinnedIds = Array.isArray(profile?.pinnedAnimeIds) ? profile.pinnedAnimeIds.map(String) : [];
    const pinnedAnime = pinnedIds.map(id => animeData.find(anime => String(anime.id) === id)).filter(Boolean);
    const favoriteAnime = (interactionService?.getFavorites?.() || []).map(id => animeData.find(anime => Number(anime.id) === Number(id))).filter(Boolean);
    const badges = [
        profile?.isSupporter && { icon: 'heart', label: '❤️ Anify Supporter', color: 'text-gold-400' },
        totalEpisodes >= 100 && { icon: 'trophy', label: '100 Episodes' },
        totalEpisodes >= 25 && { icon: 'clapperboard', label: 'Binge Starter' },
        preferredGenres.length >= 3 && { icon: 'compass', label: 'Genre Explorer' },
        favoriteCount >= 5 && { icon: 'heart', label: 'Top Picks' },
    ].filter(Boolean);

    const isDarkMode = getCurrentTheme() === 'dark';

    return `
    <div class="pt-24 pb-20 min-h-screen">
        <div class="max-w-4xl mx-auto px-4 md:px-8">
            <!-- Profile Header -->
            <div class="glass-card rounded-3xl overflow-hidden anim-slide-up">
                <div class="h-32 md:h-44 animated-gradient relative" style="--tw-gradient-from: ${accent}; --tw-gradient-to: var(--surface-strong);">
                    <div class="floating-orb w-48 h-48 -top-24 -right-24" style="animation-delay: 1s; background-color: ${accent};"></div>
                </div>
                <div class="px-6 md:px-8 pb-6 -mt-14 relative">
                    <div class="flex items-end gap-4">
                        <img src="${avatarUrl}" data-profile-avatar class="profile-summary-avatar" alt="${escapeHtml(displayName)} avatar">
                        <div class="mb-1">
                            <h1 class="text-2xl font-black">${escapeHtml(displayName)}</h1>
                            <p class="text-sm text-gray-500">@${escapeHtml(username)}${userPlan === 'Premium' ? ' · Premium Member 👑' : ''}${profile?.isSupporter ? ' · ❤️ Anify Supporter' : ''}${userStatus ? ` · ${escapeHtml(userStatus)}` : ''}</p>
                        </div>
                    </div>
                    <p class="mt-4 max-w-2xl text-sm leading-6 text-gray-400">${bio ? escapeHtml(bio) : 'Add a bio to tell other anime fans a little about yourself.'}</p>
                    <div class="flex flex-wrap items-center justify-between gap-3 mt-5">
                        <span class="text-xs text-gray-500">Make your profile feel like yours.</span>
                        <button type="button" class="btn-secondary px-4 py-2 text-xs" onclick="scrollToProfileCustomization()"><i data-lucide="palette" class="w-3.5 h-3.5 inline-block mr-1"></i> Customize Profile</button>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mt-6">
                        <div class="text-center p-3 rounded-xl bg-white/5">
                            <p class="text-xl font-bold" style="color:${accent}">${totalEpisodes}</p>
                            <p class="text-xs text-gray-500">Episodes</p>
                        </div>
                        <div class="text-center p-3 rounded-xl bg-white/5">
                            <p class="text-xl font-bold text-gold-400">${watchlistService.getEntries().length}</p>
                            <p class="text-xs text-gray-500">Watchlist</p>
                        </div>
                        <div class="text-center p-3 rounded-xl bg-white/5">
                            <p class="text-xl font-bold text-gold-400">${favoriteCount}</p>
                            <p class="text-xs text-gray-500">Favorites</p>
                        </div>
                    </div>
                </div>
            </div>

            ${renderProfileCustomization(profile, draft, totalEpisodes, watchedCount, watchlistService.getEntries().length, favoriteCount)}

            <!-- Stats & Settings -->
            <div class="grid md:grid-cols-2 gap-6 mt-6">
                <!-- Watch History -->
                <div class="glass-card rounded-2xl p-5 anim-slide-up anim-delay-1">
                    <h3 class="font-bold mb-4 flex items-center gap-2"><i data-lucide="clock" class="w-5 h-5 text-gold-400"></i> Watch History</h3>
                    <div class="space-y-3 max-h-64 overflow-y-auto">
                        ${watchHistoryItems.length ? watchHistoryItems.map(({ anime, timeLabel }) => `
                            <button onclick="navigate('anime', ${anime.id})" class="flex items-center gap-3 w-full text-left p-2 rounded-xl hover:bg-white/5 transition-all">
                                <img src="${ensureHttps(anime.image)}" class="w-10 h-14 rounded-lg object-cover" alt="${anime.title}">
                                <div class="min-w-0 flex-1">
                                    <p class="font-medium text-sm truncate">${anime.title}</p>
                                    <p class="text-xs text-gray-500">${timeLabel ? `Last watched ${timeLabel}` : 'Last watched'}</p>
                                </div>
                            </button>
                        `).join('') : `
                            <p class="text-sm text-gray-500">No watch history yet. Start watching something!</p>
                        `}
                    </div>
                </div>

                <!-- Settings -->
                <div class="glass-card rounded-2xl p-5 anim-slide-up anim-delay-2">
                    <h3 class="font-bold mb-4 flex items-center gap-2"><i data-lucide="settings" class="w-5 h-5 text-gold-400"></i> Settings</h3>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="text-sm">Dark Mode</span>
                            <button onclick="toggleTheme()" class="w-12 h-6 rounded-full transition-all ${isDarkMode ? 'bg-gold-400' : 'bg-gray-600'} relative">
                                <div class="w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${isDarkMode ? 'right-0.5' : 'left-0.5'}"></div>
                            </button>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm">Notifications</span>
                            <button class="w-12 h-6 rounded-full bg-gold-400 relative">
                                <div class="w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 right-0.5"></div>
                            </button>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm">Auto-Next Episode</span>
                            <button class="w-12 h-6 rounded-full bg-gold-400 relative">
                                <div class="w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 right-0.5"></div>
                            </button>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-400 mb-1 block">Language</label>
                            <select class="input-field">
                                <option>English</option>
                                <option>Japanese</option>
                                <option>Spanish</option>
                            </select>
                        </div>
                        <button onclick="signOut()" class="w-full btn-secondary py-2.5 flex items-center justify-center gap-2 text-sm mt-2">
                            <i data-lucide="log-out" class="w-4 h-4"></i> Sign Out
                        </button>
                    </div>
                </div>
            </div>


            <div class="glass-card rounded-2xl p-5 mt-6">
                <div class="flex items-center justify-between gap-4 mb-4"><h3 class="font-bold flex items-center gap-2"><i data-lucide="pin" class="w-5 h-5" style="color:${accent}"></i> Pinned Favorites</h3><span class="text-xs text-gray-500">Pin up to 6 from your favorites</span></div>
                ${favoriteAnime.length ? `<div class="flex flex-wrap gap-3">${favoriteAnime.map(anime => `<button onclick="togglePinnedAnime(${anime.id})" class="relative w-20 text-left"><img src="${ensureHttps(anime.image)}" alt="${escapeHtml(anime.title)}" class="h-28 w-20 object-cover rounded-lg ${pinnedIds.includes(String(anime.id)) ? 'ring-2 ring-gold-400' : ''}"><span class="block mt-1 truncate text-xs">${escapeHtml(anime.title)}</span></button>`).join('')}</div>` : '<p class="text-sm text-gray-500">Add anime to your favorites first, then pin them here.</p>'}
                ${pinnedAnime.length ? `<p class="mt-4 text-xs text-gray-500">Pinned: ${pinnedAnime.map(anime => escapeHtml(anime.title)).join(', ')}</p>` : ''}
            </div>

            <div class="glass-card rounded-2xl p-5 mt-6">
                <h3 class="font-bold mb-4 flex items-center gap-2"><i data-lucide="activity" class="w-5 h-5" style="color:${accent}"></i> Activity Timeline</h3>
                <div id="profile-activity-list" class="space-y-3 text-sm text-gray-500">Loading recent activity…</div>
            </div>

            <!-- Subscription -->
            <div class="glass-card rounded-2xl p-6 mt-6 anim-slide-up anim-delay-3">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 class="font-bold flex items-center gap-2"><i data-lucide="crown" class="w-5 h-5 text-gold-400"></i> ${userPlan} Plan</h3>
                        <p class="text-sm text-gray-500 mt-1">Status: ${userStatus}</p>
                    </div>
                    <button class="btn-primary px-5 py-2 text-sm">Manage Subscription</button>
                </div>
            </div>
        </div>
    </div>`;
}

async function saveProfileCustomization(overrides = {}) {
    if (!isLoggedIn()) return navigate('login');
    const current = authService.getCurrentUser() || {};
    const draft = profileCustomizationDraft || getProfileCustomizationDraft(current);
    const bioInput = document.getElementById('profile-bio-input');
    const payload = {
        avatarId: overrides.avatarId ?? draft.avatarId ?? current.avatarId ?? getProfileConfig().DEFAULT_AVATAR_ID,
        bio: overrides.bio ?? bioInput?.value?.trim() ?? draft.bio ?? current.bio ?? '',
        profileTheme: overrides.profileTheme ?? draft.profileTheme ?? current.profileTheme ?? getProfileConfig().DEFAULT_PROFILE_THEME,
        pinnedAnimeIds: overrides.pinnedAnimeIds ?? current.pinnedAnimeIds ?? [],
    };

    try {
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to save profile.');

        profileCustomizationDraft = {
            userId: String(data.user?.id || current.id || 'guest'),
            avatarId: resolveProfileAvatarId(data.user?.avatarId),
            bio: String(data.user?.bio || '').slice(0, 160),
            profileTheme: resolveProfileThemeId(data.user?.profileTheme),
            editingBio: false,
        };
        authService.updateCurrentUser(data.user);
        applyProfileTheme(data.user?.profileTheme);
        setProfileCustomizationStatus(overrides.silent ? 'Saved' : 'Profile saved', 'success');
        if (!overrides.silent) showToast('Profile saved');
    } catch (error) {
        setProfileCustomizationStatus(error.message || 'Unable to save profile.', 'error');
        if (!overrides.silent) showToast(error.message || 'Unable to save profile.');
    }
}

function togglePinnedAnime(animeId) {
    const current = authService.getCurrentUser() || {};
    const id = String(animeId);
    const pinned = Array.isArray(current.pinnedAnimeIds) ? current.pinnedAnimeIds.map(String) : [];
    const next = pinned.includes(id) ? pinned.filter(item => item !== id) : [...pinned, id];
    if (next.length > 6) return showToast('You can pin up to 6 favorites.');
    saveProfileCustomization({ pinnedAnimeIds: next });
}

async function loadProfileActivity() {
    const container = document.getElementById('profile-activity-list');
    if (!container || !isLoggedIn()) return;
    try {
        const response = await fetch('/api/profile/activity', { headers: { Authorization: `Bearer ${getAuthToken()}` } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load activity.');
        const items = Array.isArray(data.activity) ? data.activity : [];
        container.innerHTML = items.length ? items.map(item => {
            const anime = animeData.find(entry => String(entry.id) === String(item.animeId));
            const title = escapeHtml(anime?.title || 'an anime');
            const time = timeAgo(item.createdAt);
            const text = item.type === 'watched' ? `Watched episode ${Number(item.episode) || 1} of ${title}`
                : item.type === 'commented' ? `Commented on ${title}`
                : `Rated ${title} ${Number(item.rating) || 0}/10`;
            return `<div class="flex items-start gap-3 rounded-xl bg-white/5 p-3"><i data-lucide="${item.type === 'watched' ? 'play-circle' : item.type === 'commented' ? 'message-circle' : 'star'}" class="w-4 h-4 mt-0.5 text-gold-400"></i><div><p class="text-sm text-gray-300">${text}</p><p class="text-xs text-gray-500 mt-1">${time}</p></div></div>`;
        }).join('') : '<p>No activity yet. Watch, rate, or comment on an anime to build your timeline.</p>';
        createLucideIconsSafe();
    } catch (error) {
        container.textContent = 'Your recent activity could not be loaded right now.';
    }
}

// ============ RENDER: ADMIN DASHBOARD ============
function renderAdmin() {
    // Admin rendering is handled by js/admin/adminUI.js
    // This is just a fallback if the admin UI isn't loaded
    return `<div class="pt-24 pb-20 min-h-screen flex items-center justify-center">
        <div class="text-center glass-card rounded-2xl p-8 max-w-md">
            <h1 class="text-2xl font-black mb-2">Admin UI not loaded</h1>
            <p class="text-gray-500">Check that js/admin/adminUI.js is included.</p>
        </div>
    </div>`;
}


function switchAdminTab(tab) {
    document.querySelectorAll('[data-admin-nav]').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('[data-admin-nav-mobile]').forEach(n => {
        n.classList.remove('text-gold-400');
        n.classList.add('text-gray-500');
    });
    
    const activeNav = document.querySelector(`[data-admin-nav="${tab}"]`);
    const activeMobile = document.querySelector(`[data-admin-nav-mobile="${tab}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (activeMobile) {
        activeMobile.classList.remove('text-gray-500');
        activeMobile.classList.add('text-gold-400');
    }

    const content = document.getElementById('admin-content');

    // Ensure Anime Management is always DB-backed.
    if (tab === 'anime') {
        // Best-effort reload, then render.
        loadAnimeFromApi().finally(() => {
            if (!content) return;
            content.innerHTML = renderAdminAnime();
            lucide.createIcons();
            bindAdminAnimeActions();
        });
        return;
    }

    switch(tab) {
        case 'dashboard': content.innerHTML = renderAdminDashboard(); break;
        case 'anime': content.innerHTML = renderAdminAnime(); break;
        case 'users':
            content.innerHTML = renderAdminUsers();
            // load real users after markup is injected
            setTimeout(loadAdminUsersTable, 0);
            break;
        case 'analytics':
            content.innerHTML = renderAdminAnalytics();
            break;
        case 'subscriptions':
            content.innerHTML = renderAdminSubscriptions();
            break;
        case 'reports':
            content.innerHTML = renderAdminReports();
            break;
        case 'settings':
            content.innerHTML = renderAdminSettings();
            break;
    }
    lucide.createIcons();
    if (tab === 'anime') bindAdminAnimeActions();
}


function renderAdminDashboard() {
    return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black anim-slide-up">Dashboard</h1>
        <p class="text-gray-500 text-sm mt-1 anim-slide-up anim-delay-1">Welcome back! Here's your overview.</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="stat-card anim-slide-up anim-delay-1">
            <div class="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center mb-3">
                <i data-lucide="users" class="w-5 h-5 text-gold-400"></i>
            </div>
            <p class="text-2xl font-black">24.5K</p>
            <p class="text-xs text-gray-500">Total Users</p>
            <p class="text-xs text-green-400 mt-1">+12.5% ↑</p>
        </div>
        <div class="stat-card anim-slide-up anim-delay-2">
            <div class="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center mb-3">
                <i data-lucide="eye" class="w-5 h-5 text-purple-400"></i>
            </div>
            <p class="text-2xl font-black">1.2M</p>
            <p class="text-xs text-gray-500">Daily Views</p>
            <p class="text-xs text-green-400 mt-1">+8.3% ↑</p>
        </div>
        <div class="stat-card anim-slide-up anim-delay-3">
            <div class="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center mb-3">
                <i data-lucide="crown" class="w-5 h-5 text-blue-400"></i>
            </div>
            <p class="text-2xl font-black">8.4K</p>
            <p class="text-xs text-gray-500">Premium Users</p>
            <p class="text-xs text-green-400 mt-1">+5.7% ↑</p>
        </div>
        <div class="stat-card anim-slide-up anim-delay-4">
            <div class="w-10 h-10 rounded-xl bg-green-400/10 flex items-center justify-center mb-3">
                <i data-lucide="dollar-sign" class="w-5 h-5 text-green-400"></i>
            </div>
            <p class="text-2xl font-black">$84K</p>
            <p class="text-xs text-gray-500">Monthly Revenue</p>
            <p class="text-xs text-green-400 mt-1">+15.2% ↑</p>
        </div>
    </div>

    <!-- Charts Row -->
    <div class="grid lg:grid-cols-2 gap-6 mb-8">
        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Views This Week</h3>
            <div class="flex items-end gap-2 h-40">
                ${[65, 45, 80, 55, 95, 70, 85].map((v, i) => `
                    <div class="flex-1 bg-gradient-to-t from-gold-400 to-gold-500 rounded-t-lg transition-all hover:opacity-80 relative group" style="height: ${v}%">
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">${v}K views</div>
                    </div>
                `).join('')}
            </div>
            <div class="flex justify-between mt-2 text-xs text-gray-500">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
        </div>

        <div class="glass-card rounded-2xl p-5 anim-fade-in">
            <h3 class="font-bold mb-4">Trending Anime</h3>
            <div class="space-y-3">
                ${animeData.filter(a => a.trending).slice(0, 5).map((a, i) => `
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold w-5 text-gold-400">#${i + 1}</span>
                        <img src="${ensureHttps(a.image)}" class="w-10 h-14 rounded-lg object-cover" alt="${a.title}">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-sm truncate">${a.title}</p>
                            <p class="text-xs text-gray-500">${(Math.random() * 500 + 100).toFixed(0)}K views</p>
                        </div>
                        <div class="w-20">
                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-gold-400 to-gold-500 rounded-full" style="width: ${100 - i * 18}%"></div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <!-- Recent Activity -->
    <div class="glass-card rounded-2xl p-5 anim-fade-in">
        <h3 class="font-bold mb-4">Recent Activity</h3>
        <div class="space-y-3">
            ${[
                { icon: 'user-plus', color: 'text-green-400', text: 'New user registered: AnimeFan_99', time: '2 min ago' },
                { icon: 'upload', color: 'text-blue-400', text: 'New episode uploaded: Jujutsu Kaisen S3E1', time: '15 min ago' },
                { icon: 'crown', color: 'text-gold-400', text: 'User upgraded to Premium: OtakuLord', time: '1 hour ago' },
                { icon: 'flag', color: 'text-red-400', text: 'Report filed: Spam comment on Episode 24', time: '2 hours ago' },
                { icon: 'trending-up', color: 'text-purple-400', text: 'Solo Leveling hit 1M views milestone', time: '5 hours ago' },
            ].map(a => `
                <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all">
                    <div class="w-8 h-8 rounded-lg ${a.color.replace('text-', 'bg-').replace('400', '400/10')} flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${a.icon}" class="w-4 h-4 ${a.color}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm">${a.text}</p>
                    </div>
                    <span class="text-xs text-gray-500 whitespace-nowrap">${a.time}</span>
                </div>
            `).join('')}
        </div>
    </div>`;
}

function openGenreManager() {
    const modal = document.getElementById('upload-modal');
    if (!modal) return;
    modal.innerHTML = `
        <div class="glass-card rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h2 class="text-xl font-bold">Genre Management</h2>
                    <p class="text-sm text-gray-500">Create, edit, and organize your shared genre library.</p>
                </div>
                <button onclick="hideUploadModal()" class="p-2 rounded-xl hover:bg-white/10"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="space-y-4">
                <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <label class="text-sm font-medium text-gray-400 mb-2 block">Add Genre</label>
                    <div class="flex gap-2">
                        <input id="genre-name-input" type="text" class="input-field flex-1" placeholder="e.g. School" />
                        <button onclick="saveGenreFromManager()" class="btn-primary px-4">Save</button>
                    </div>
                </div>
                <div id="genre-manager-list" class="space-y-2"></div>
            </div>
        </div>`;
    modal.classList.remove('hidden');
    renderGenreManagerList();
    lucide.createIcons();
}

async function renderGenreManagerList() {
    const root = document.getElementById('genre-manager-list');
    if (!root) return;
    try {
        const response = await fetch('/api/genres');
        const data = await response.json().catch(() => ({}));
        const genres = Array.isArray(data?.genres) ? data.genres : [];
        root.innerHTML = genres.length ? genres.map((genre) => `
            <div class="flex items-center justify-between rounded-2xl border border-white/10 bg-dark-800/70 p-3">
                <div>
                    <p class="font-semibold">${genre.name}</p>
                    <p class="text-xs text-gray-500">${genre.animeCount || 0} anime • ${genre.description || 'Shared genre'}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editGenreFromManager('${genre._id}', '${String(genre.name || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-xl bg-white/5 text-sm">Edit</button>
                    <button onclick="deleteGenreFromManager('${genre._id}')" class="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-sm">Delete</button>
                </div>
            </div>
        `).join('') : '<p class="text-sm text-gray-500">No genres yet.</p>';
    } catch (error) {
        root.innerHTML = '<p class="text-sm text-red-400">Unable to load genres.</p>';
    }
}

async function saveGenreFromManager() {
    const input = document.getElementById('genre-name-input');
    const name = input?.value?.trim();
    if (!name) return alertGold('Please enter a genre name.');
    try {
        const response = await fetch('/api/genres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to save genre.');
        input.value = '';
        await renderGenreManagerList();
        await genreService.ensureGenresLoaded(true);
        await ensureGenresReady();
    } catch (error) {
        alertGold(error.message || 'Unable to save genre.');
    }
}

async function editGenreFromManager(id, currentName) {
    const nextName = prompt('Edit genre name', currentName);
    if (!nextName || !id) return;
    try {
        const response = await fetch(`/api/genres/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nextName.trim() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to update genre.');
        await renderGenreManagerList();
        await genreService.ensureGenresLoaded(true);
        await ensureGenresReady();
    } catch (error) {
        alertGold(error.message || 'Unable to update genre.');
    }
}

async function deleteGenreFromManager(id) {
    if (!id) return;
    if (!confirm('Delete this genre from the shared library?')) return;
    try {
        const response = await fetch(`/api/genres/${id}`, { method: 'DELETE' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to delete genre.');
        await renderGenreManagerList();
        await genreService.ensureGenresReady?.(true);
    } catch (error) {
        alertGold(error.message || 'Unable to delete genre.');
    }
}

/* Movie management has been retired.
function renderAdminMovies() {
    const movies = animeData.filter(a => (a?.type || 'anime') !== 'anime');

    return `
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
            <h1 class="text-2xl md:text-3xl font-black anim-slide-up">Movie Management</h1>
            <p class="text-gray-500 text-sm mt-1">${movies.length} total movies</p>
        </div>
<button type="button" onclick="showUploadModal('movie-create')" class="btn-primary flex items-center gap-2 anim-slide-up anim-delay-1" data-admin-upload-movie-create>
            <i data-lucide="plus" class="w-4 h-4"></i> Upload Movie
        </button>
    </div>

    <!-- Movies Table -->
    <div class="glass-card rounded-2xl overflow-hidden anim-fade-in">
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-white/5 text-left">
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Movie</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${movies.map(a => {
                        const movieTypeLabel = a.type === 'live-movie' ? 'Live' : 'Animated';
                        return `
                        <tr class="border-b border-white/5 hover:bg-white/3 transition-colors">
                            <td class="p-4">
                                <div class="flex items-center gap-3">
                                    <img src="${a.image}" class="w-10 h-14 rounded-lg object-cover" alt="${a.title}">
                                    <div>
                                        <p class="font-semibold text-sm">${a.title}</p>
                                        <p class="text-xs text-gray-500">${a.studio || 'Unknown'} · ${a.year || ''}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="p-4 hidden md:table-cell">
                                <span class="text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-300">${movieTypeLabel}</span>
                            </td>
                            <td class="p-4">
                                <span class="text-xs px-2.5 py-1 rounded-full ${a.status === 'Airing' ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'}">${a.status || 'Airing'}</span>
                            </td>
                            <td class="p-4">
                                <div class="flex items-center gap-1">
                                    <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Edit" data-admin-movie-action="edit" data-anime-id="${a.id}">
                                        <i data-lucide="pencil" class="w-4 h-4 text-gray-400"></i>
                                    </button>
                                    <button class="p-2 rounded-lg hover:bg-red-500/10 transition-all" title="Delete" data-admin-movie-action="delete" data-anime-id="${a.id}">
                                        <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>

            ${movies.length === 0 ? `
                <div class="p-10 text-center">
                    <div class="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                        <i data-lucide="film" class="w-8 h-8 text-gray-600"></i>
                    </div>
                    <p class="text-lg font-bold mb-1">No movies yet</p>
                    <p class="text-sm text-gray-500 mb-6">Upload your first animated/live movie.</p>
                    <button onclick="showUploadModal('movie-create')" class="btn-primary px-6 py-3">Upload Movie</button>
                </div>
            ` : ''}
        </div>
    </div>`;
}

function editAdminMovie(id) {
    showUploadModal('movie-edit', id);
}

async function deleteAdminMovie(id) {
    const movie = animeData.find(a => a.id === id);
    if (!movie) return;
    if (!confirm(`Delete "${movie.title}" movie? This action is permanent.`)) return;

    const index = animeData.findIndex(a => Number(a.id) === Number(id));
    if (index >= 0) {
        animeData.splice(index, 1);
    }
    if (window.watchlistService) window.watchlistService.remove(id);
    if (window.continueWatchingService) window.continueWatchingService.remove(id);
    deleteAnimeFromApi(id);
    saveAdminAnimeData();
    await switchAdminTab('movies');
}

*/
function renderAdminAnime() {
    // Keep series and supported movie records visible in one content manager.
    const list = (Array.isArray(animeData) ? animeData : [])
        .filter(a => a && typeof a === 'object');

    const sorted = list.sort((a, b) => {
        const at = new Date(a?.createdAt || 0).getTime();
        const bt = new Date(b?.createdAt || 0).getTime();
        return bt - at;
    });


    return `
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
            <h1 class="text-2xl md:text-3xl font-black anim-slide-up">Anime Management</h1>
            <p class="text-gray-500 text-sm mt-1">${sorted.length} total anime</p>
        </div>
        <button type="button" onclick="showUploadModal()" class="btn-primary flex items-center gap-2 anim-slide-up anim-delay-1">
            <i data-lucide="plus" class="w-4 h-4"></i> Upload Anime
        </button>
    </div>

    <div class="glass-card rounded-2xl overflow-hidden anim-fade-in">
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-white/5 text-left">
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Anime</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Type</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden lg:table-cell">Episodes</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(a => {
                        const isMovie = (a?.type || 'anime') !== 'anime';
                        const typeLabel = !isMovie ? 'Series' : (a?.type === 'live-movie' ? 'Live Movie' : 'Animated Movie');
                        const status = a?.status || 'Airing';
                        const episodesLabel = Number.isFinite(Number(a?.episodes)) ? Number(a.episodes) : (a?.episodes || 0);
                        return `
                        <tr class="border-b border-white/5 hover:bg-white/3 transition-colors">
                            <td class="p-4">
                                <div class="flex items-center gap-3">
                                    <img src="${a?.image || ''}" class="w-10 h-14 rounded-lg object-cover" alt="${a?.title || ''}">
                                    <div class="min-w-0">
                                        <p class="font-semibold text-sm truncate">${a?.title || 'Untitled'}</p>
                                        <p class="text-xs text-gray-500 truncate">${(a?.studio || 'Unknown Studio')} · ${(a?.year || '')}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="p-4 hidden md:table-cell">
                                <span class="text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-300">${typeLabel}</span>
                            </td>
                            <td class="p-4">
                                <span class="text-xs px-2.5 py-1 rounded-full ${status === 'Airing' ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'}">${status}</span>
                            </td>
                            <td class="p-4 hidden lg:table-cell">
                                <span class="text-xs text-gray-300">${episodesLabel || 0}</span>
                            </td>
                            <td class="p-4">
                                <div class="flex items-center gap-1">
                                    <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Edit" data-admin-anime-action="edit" data-anime-id="${a?.id}">
                                        <i data-lucide="pencil" class="w-4 h-4 text-gray-400"></i>
                                    </button>
                                    <button class="p-2 rounded-lg hover:bg-red-500/10 transition-all" title="Delete" data-admin-anime-action="delete" data-anime-id="${a?.id}">
                                        <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
                                    </button>
                                    <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Upload Episode" data-admin-anime-action="episode" data-anime-id="${a?.id}">
                                        <i data-lucide="upload" class="w-4 h-4 text-blue-400"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        ${sorted.length === 0 ? `
            <div class="p-10 text-center">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                    <i data-lucide="tv" class="w-8 h-8 text-gray-600"></i>
                </div>
                <p class="text-lg font-bold mb-1">No anime yet</p>
                <p class="text-sm text-gray-500 mb-6">Upload your first anime to manage episodes and actions here.</p>
                <button type="button" onclick="showUploadModal()" class="btn-primary px-6 py-3">Upload Anime</button>
            </div>
        ` : ''}
    </div>`;
}

function renderAdminUsers() {
    return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black anim-slide-up">User Management</h1>
        <p class="text-gray-500 text-sm mt-1">Manage plan, status and roles</p>
    </div>
    <div class="glass-card rounded-2xl overflow-hidden anim-fade-in">
        <div id="admin-users-table" class="overflow-x-auto"></div>
    </div>`;
}

function ensureAdminOrRedirect() {
    if (isAdminToken()) return true;
    navigate('home');
    return false;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function handleAdminUserAction(userId, patch) {
    if (!ensureAdminOrRedirect()) return;
    try {
        await updateAdminUser(userId, patch);
        await loadAdminUsersTable();
        showToast('User updated');
    } catch (e) {
        alert(String(e?.message || e));
    }
}


function getTokenRoles() {
    try {
        const token = getAuthToken();
        if (!token) return [];
        const payloadPart = token.split('.')[1];
        if (!payloadPart) return [];
        const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(decodeURIComponent(escape(json)));
        return Array.isArray(payload?.roles) ? payload.roles : [];
    } catch {
        return [];
    }
}

function isAdminToken() {
    const roles = getTokenRoles();
    return roles.includes('admin') || roles.includes('moderator') || roles.includes('shield');
}

async function updateAdminUser(userId, patch) {
    const token = getAuthToken();
    if (!token) throw new Error('Not logged in');

    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.user;
}


async function loadAdminUsersTable() {
    const target = document.getElementById('admin-users-table');
    if (!target) return;

    const token = getAuthToken();
    try {
        const res = await fetch('/api/users', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const users = Array.isArray(data.users) ? data.users : [];
        target.innerHTML = `
            <table class="w-full">
                <thead>

                    <tr class="border-b border-white/5 text-left">
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">User</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Email</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Plan</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Joined</th>
                        <th class="p-4 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => {
                        const roles = Array.isArray(u?.roles) ? u.roles : [];
                        const isSeedAdmin = roles.includes('admin') && String(u?.email || '').toLowerCase() === 'anify@gmail.com';
                        if (isSeedAdmin) return '';

                        const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '';
                        const plan = u.plan || 'Free';
                        const status = u.status || 'Active';
                        const name = u.username || u.name || 'User';
                        const avatar = typeof getProfileAvatarUrl === 'function' ? getProfileAvatarUrl(u.avatarId) : u.avatar;
                        return `
                            <tr class="border-b border-white/5 hover:bg-white/3 transition-colors">
                                <td class="p-4">
                                    <div class="flex items-center gap-3">
                                        <img src="${avatar}" class="w-8 h-8 rounded-lg" alt="${name}">
                                        <span class="font-medium text-sm">${name}</span>
                                    </div>
                                </td>
                                <td class="p-4 text-sm text-gray-400 hidden md:table-cell">${u.email || ''}</td>
                                <td class="p-4"><span class="text-xs px-2.5 py-1 rounded-full ${plan === 'Premium' ? 'bg-gold-400/10 text-gold-400' : 'bg-white/5 text-gray-400'}">${plan}</span></td>
                                <td class="p-4"><span class="text-xs px-2.5 py-1 rounded-full ${status === 'Active' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}">${status}</span></td>
                                <td class="p-4 text-sm text-gray-400 hidden sm:table-cell">${joined}</td>
                                <td class="p-4">
                                    <div class="flex flex-wrap gap-2">
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Free" onclick="handleAdminUserAction('${u._id || ''}', { plan: 'Free' })">
                                            <i data-lucide="corner-down-left" class="w-4 h-4 text-gray-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Premium" onclick="handleAdminUserAction('${u._id || ''}', { plan: 'Premium' })">
                                            <i data-lucide="crown" class="w-4 h-4 text-gold-400"></i>
                                        </button>

                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Active" onclick="handleAdminUserAction('${u._id || ''}', { status: 'Active' })">
                                            <i data-lucide="check" class="w-4 h-4 text-green-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Pending" onclick="handleAdminUserAction('${u._id || ''}', { status: 'Pending' })">
                                            <i data-lucide="clock" class="w-4 h-4 text-yellow-400"></i>
                                        </button>
                                        <button class="p-2 rounded-lg hover:bg-white/10 transition-all" title="Set Banned" onclick="handleAdminUserAction('${u._id || ''}', { status: 'Banned' })">
                                            <i data-lucide="x" class="w-4 h-4 text-red-400"></i>
                                        </button>
                                    </div>
                                </td>

                            </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    } catch (e) {
        target.innerHTML = `<p class="p-4 text-sm text-red-400">Failed to load users: ${String(e?.message || e)}</p>`;
    }
}

function renderAdminAnalytics() {
    return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Analytics</h1>
        <p class="text-gray-500 text-sm mt-1">Detailed platform analytics</p>
    </div>
    <div class="grid md:grid-cols-2 gap-6 mb-8">
        <div class="glass-card rounded-2xl p-5">
            <h3 class="font-bold mb-4">Revenue Breakdown</h3>
            <div class="space-y-4">
                ${[
                    { label: "Premium Subscriptions", amount: "$52,400", pct: 62, color: "from-gold-400 to-gold-500" },
                    { label: "Ad Revenue", amount: "$18,200", pct: 22, color: "from-purple-400 to-purple-500" },
                    { label: "Merchandise", amount: "$9,800", pct: 12, color: "from-blue-400 to-blue-500" },
                    { label: "Other", amount: "$3,600", pct: 4, color: "from-pink-400 to-pink-500" },
                ].map(r => `
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm">${r.label}</span>
                            <span class="text-sm font-bold">${r.amount}</span>
                        </div>
                        <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r ${r.color} rounded-full" style="width: ${r.pct}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="glass-card rounded-2xl p-5">
            <h3 class="font-bold mb-4">Monthly Active Users</h3>
            <div class="flex items-end gap-1 h-44">
                ${[40, 55, 70, 45, 80, 65, 90, 75, 95, 85, 100, 92].map((v, i) => `
                    <div class="flex-1 flex flex-col items-center gap-1">
                        <div class="w-full bg-gradient-to-t from-gold-400/60 to-gold-400 rounded-t-md" style="height: ${v}%"></div>
                        <span class="text-[9px] text-gray-500">${['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    <div class="glass-card rounded-2xl p-5">
        <h3 class="font-bold mb-4">Genre Distribution</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            ${categories.filter(c => c !== 'All').map((c, i) => {
                const count = animeData.filter(a => Array.isArray(a.genres) && a.genres.includes(c)).length;
                return `<div class="bg-white/3 rounded-xl p-3 text-center">
                    <p class="text-2xl font-black text-gold-400">${count}</p>
                    <p class="text-xs text-gray-500 mt-1">${c}</p>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function renderAdminSubscriptions() {
    return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Subscriptions</h1>
        <p class="text-gray-500 text-sm mt-1">Manage subscription plans</p>
    </div>
    <div class="grid md:grid-cols-2 gap-6 mb-8">
        <!-- Free Plan -->
        <div class="glass-card rounded-2xl p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold">Free Plan</h3>
                <span class="text-xs bg-gray-400/10 text-gray-400 px-3 py-1 rounded-full">Current</span>
            </div>
            <p class="text-3xl font-black mb-4">$0<span class="text-sm font-normal text-gray-500">/month</span></p>
            <ul class="space-y-2 mb-6">
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Limited anime library</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> 480p quality</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="x" class="w-4 h-4 text-red-400"></i> Ad-free streaming</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="x" class="w-4 h-4 text-red-400"></i> Premium-only anime</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="x" class="w-4 h-4 text-red-400"></i> Early episode access</li>
            </ul>
            <p class="text-sm text-gray-500">16.1K active users</p>
        </div>
        <!-- Premium Plan -->
        <div class="glass-card rounded-2xl p-6 border-gold-400/20 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-gold-400/5 rounded-full -mr-16 -mt-16"></div>
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold flex items-center gap-2">Premium <i data-lucide="crown" class="w-5 h-5 text-gold-400"></i></h3>
                <span class="badge-premium">Popular</span>
            </div>
            <p class="text-3xl font-black mb-4 text-gold-400">$9.99<span class="text-sm font-normal text-gray-500">/month</span></p>
            <ul class="space-y-2 mb-6">
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Full anime library</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> 1080p / 4K quality</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Ad-free streaming</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Premium-only anime</li>
                <li class="flex items-center gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-green-400"></i> Early episode access</li>
            </ul>
            <p class="text-sm text-gray-500">8.4K active subscribers</p>
        </div>
    </div>
    <div class="glass-card rounded-2xl p-5">
        <h3 class="font-bold mb-4">Payment Integration</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-white/5 rounded-xl p-4 text-center"><p class="font-semibold text-sm">Stripe</p><p class="text-xs text-green-400">Connected ✓</p></div>
            <div class="bg-white/5 rounded-xl p-4 text-center"><p class="font-semibold text-sm">Paystack</p><p class="text-xs text-green-400">Connected ✓</p></div>
            <div class="bg-white/5 rounded-xl p-4 text-center"><p class="font-semibold text-sm">PayPal</p><p class="text-xs text-yellow-400">Pending</p></div>
            <div class="bg-white/5 rounded-xl p-4 text-center cursor-pointer hover:bg-white/10 transition-all"><p class="font-semibold text-sm">+ Add</p><p class="text-xs text-gray-500">New Provider</p></div>
        </div>
    </div>`;
}

function renderAdminReports() {
    const reports = [
        { user: "SakuraBloom", type: "Spam", target: "Comment on Episode 24", status: "Pending", date: "2 hours ago" },
        { user: "NarutoRun", type: "Inappropriate", target: "Review on Demon Slayer", status: "Resolved", date: "1 day ago" },
    ];

    return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Reports</h1>
        <p class="text-gray-500 text-sm mt-1">Manage user reports and moderation</p>
    </div>

    <div class="glass-card rounded-2xl overflow-hidden">
        <table class="w-full">
            <thead class="bg-white/5">
                <tr>
                    <th class="text-left p-4 text-sm font-medium text-gray-400">User</th>
                    <th class="text-left p-4 text-sm font-medium text-gray-400">Type</th>
                    <th class="text-left p-4 text-sm font-medium text-gray-400">Target</th>
                    <th class="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                    <th class="text-left p-4 text-sm font-medium text-gray-400">Date</th>
                    <th class="text-left p-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${reports.map(report => `
                    <tr class="border-t border-white/5">
                        <td class="p-4 font-medium">${report.user}</td>
                        <td class="p-4 text-gray-400">${report.type}</td>
                        <td class="p-4 text-gray-400">${report.target}</td>
                        <td class="p-4">
                            <span class="px-2 py-1 rounded-full text-xs font-medium ${report.status === 'Pending' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-green-400/20 text-green-400'}">
                                ${report.status}
                            </span>
                        </td>
                        <td class="p-4 text-gray-400">${report.date}</td>
                        <td class="p-4">
                            <button class="text-gold-400 hover:text-gold-300 text-sm font-medium">View</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

function renderAdminSettings() {
    const currentLimit = guestPreviewService ? guestPreviewService.getGuestLimit() : 4;

    return `
    <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-black">Settings</h1>
        <p class="text-gray-500 text-sm mt-1">Configure platform settings</p>
    </div>

    <div class="space-y-6">
        <!-- Guest Preview Settings -->
        <div class="glass-card rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center">
                    <i data-lucide="users" class="w-5 h-5 text-gold-400"></i>
                </div>
                <div>
                    <h2 class="text-lg font-bold">Guest Preview Settings</h2>
                    <p class="text-sm text-gray-500">Configure guest preview limits</p>
                </div>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="text-sm font-medium text-gray-400 mb-2 block">Guest Preview Limit (videos)</label>
                    <div class="flex items-center gap-4">
                        <input 
                            type="number" 
                            id="guest-limit-input" 
                            value="${currentLimit}" 
                            min="1" 
                            max="20"
                            class="w-32 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gold-400/50"
                        >
                        <button onclick="saveGuestLimit()" class="btn-primary px-4 py-2 text-sm">
                            Save Changes
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">Number of videos guests can watch before registration (1-20)</p>
                </div>
            </div>
        </div>

        <!-- Platform Settings -->
        <div class="glass-card rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <i data-lucide="settings" class="w-5 h-5 text-purple-400"></i>
                </div>
                <div>
                    <h2 class="text-lg font-bold">Platform Settings</h2>
                    <p class="text-sm text-gray-500">General platform configuration</p>
                </div>
            </div>

            <div class="space-y-4">
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                        <p class="font-medium">Maintenance Mode</p>
                        <p class="text-xs text-gray-500">Temporarily disable the platform</p>
                    </div>
                    <button class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-all">
                        Disabled
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

function saveGuestLimit() {
    const input = document.getElementById('guest-limit-input');
    const newLimit = parseInt(input?.value, 10);
    
    if (!Number.isFinite(newLimit) || newLimit < 1 || newLimit > 20) {
        alert('Please enter a valid limit between 1 and 20');
        return;
    }
    
    if (guestPreviewService) {
        guestPreviewService.setGuestLimit(newLimit);
        showToast(`Guest preview limit updated to ${newLimit} videos`);
    } else {
        alert('Guest preview service not available');
    }
}

// ============ UTILITIES ============
function getGenreIcon(genre) {
    const map = {
        Action: 'sword',
        Romance: 'heart',
        Isekai: 'sparkles',
        Comedy: 'laugh',
        Horror: 'ghost',
        'Slice of Life': 'coffee',
        Supernatural: 'sparkles',
        Fantasy: 'book-open',
        Drama: 'theater',
        Adventure: 'compass',
        Superhero: 'shield',
        Thriller: 'radio',
        Mystery: 'search',
        Sports: 'trophy',
        Mecha: 'cpu',
        Military: 'chevrons-up',
        Historical: 'landmark',
        Samurai: 'swords',
        'Martial Arts': 'hand',
        Magic: 'sparkles',
        School: 'school',
        Shounen: 'flame',
        Shoujo: 'flower',
        Seinen: 'user-round',
        Josei: 'user',
        Ecchi: 'heart',
        Harem: 'heart',
        'Reverse Harem': 'users',
        Idol: 'star',
        Cooking: 'chef-hat',
        Medical: 'cross',
        Detective: 'search',
        Crime: 'shield-alert',
        Police: 'shield',
        Spy: 'search',
        Family: 'users',
        Vampire: 'drama',
        Demons: 'flame',
        Monsters: 'eye',
        Space: 'rocket', // No change
        Survival: 'flame-kindling',
        Game: 'gamepad-2',
        Parody: 'smile',
        'Post-Apocalyptic': 'radiation',
        Superpower: 'zap',
        'Sci-Fi': 'satellite',
        Music: 'music',
    };

    return map[genre] || 'circle';
}

function getGenreHue(genre) {
    const map = {
        Action: 38,
        Adventure: 34,
        Comedy: 44,
        Drama: 284,
        Fantasy: 198,
        'Sci-Fi': 205,
        Romance: 332,
        'Slice of Life': 32,
        Mystery: 42,
        Thriller: 0,
        Horror: 218,
        Supernatural: 282,
        Psychological: 210,
        Sports: 42,
        Music: 38,
        Mecha: 215,
        Military: 45,
        Historical: 34,
        Samurai: 35,
        'Martial Arts': 35,
        Magic: 28,
        Isekai: 252,
        School: 38,
        Shounen: 42,
        Shoujo: 324,
        Seinen: 220,
        Josei: 282,
        Ecchi: 304,
        Harem: 320,
        'Reverse Harem': 286,
        Idol: 324,
        Cooking: 32,
        Medical: 156,
        Detective: 36,
        Crime: 215,
        Police: 38,
        Spy: 210,
        Family: 43,
        Vampire: 0,
        Demons: 4,
        Monsters: 8,
        Space: 204,
        Survival: 28,
        Game: 218,
        Parody: 40,
        'Post-Apocalyptic': 48,
        Superpower: 42,
    };

    return map[genre] ?? 42;
}
// (Removed old toggleWatchlist implementation; watchlist is now per-user and managed by toggleBookmark/loadWatchlist)

function setAuthToken(token, user) {
    return authService.setToken(token, user);
}

function clearAuthToken() {
    return authService.clearSession();
}

async function handleLoginSubmit() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const submitBtn = document.querySelector('button[onclick="handleLoginSubmit()"]');

    if (!email || !password) return alert('Email and password are required.');

    // Disable button and show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
            </span>
        `;
    }

    try {
        const data = await authService.login({ email, password });

        // Required log: when login succeeds
        console.log('[Auth] login success:', {
            ok: data?.ok,
            hasToken: Boolean(data?.token),
            user: data?.user,
        });

        // Required log: current stored user data
        try {
            console.log('[Auth] stored anify-user-profile:', authService.getCurrentUser());
        } catch {}

        // Check if user is banned
        console.log('[Auth] Checking ban status:', {
            bannedFlag: data?.banned,
            userStatus: data?.user?.status,
            banInfo: data?.user?.banInfo,
            fullData: data
        });

        if (data?.banned || data?.user?.status === 'Banned') {
            console.log('[Auth] User is banned, redirecting to banned page');
            // Redirect to banned page immediately
            window.location.replace('/account-banned');
            return;
        }

        // Security UX: after login, send admin users straight to Admin page.
        const roles = Array.isArray(data?.user?.roles) ? data.user.roles : [];
        const isAdmin = roles.includes('admin') || roles.includes('moderator') || roles.includes('shield');
        navigate(isAdmin ? 'admin' : 'profile');
    } catch (e) {
        const errorMessage = String(e?.message || e);
        alert(errorMessage);
        
        // Re-enable button and restore original text
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In';
        }
    }
}

async function handleRegisterSubmit() {
    const username = document.getElementById('register-username')?.value?.trim();
    const email = document.getElementById('register-email')?.value?.trim();
    const password = document.getElementById('register-password')?.value;
    const submitBtn = document.querySelector('button[onclick="handleRegisterSubmit()"]');

    if (!username || !email || !password) return alert('Username, email and password are required.');

    // Disable button and show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Account...
            </span>
        `;
    }

    try {
        await authService.register({ username, email, password });

        // Registration successful - redirect to login page
        alert('Registration successful! Please sign in with your credentials.');
        window.location.href = `#login`;
    } catch (e) {
        alert(String(e?.message || e));
        
        // Re-enable button and restore original text
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Account';
        }
    }
}

function getCurrentUsername() {
    const currentUsername = authService.getCurrentUsername();
    return currentUsername ? String(currentUsername) : 'User';
}

function getCurrentAvatarUrl() {
    const profile = authService.getCurrentUser ? authService.getCurrentUser() : null;
    return getProfileAvatarUrl(profile?.avatarId || getProfileConfig().DEFAULT_AVATAR_ID);
}

function renderAuthNav() {
    const containerDesktop = document.getElementById('auth-nav');
    const containerMobile = document.getElementById('auth-nav-mobile');
    const containerCompact = document.getElementById('auth-nav-compact');

    // If neither container exists, nothing to render.
    if (!containerDesktop && !containerMobile && !containerCompact) return;

    const hydrate = (el, variant) => {
        if (!el) return;

        if (!isLoggedIn()) {
            if (variant === 'compact') {
                el.innerHTML = `
                    <button id="mobile-menu-toggle" onclick="toggleMobileMenu()" class="mobile-profile-trigger anime-capsule-hamburger" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-menu" title="Navigation menu">
                        <span class="anime-btn-aura" aria-hidden="true"></span>
                        <span class="anime-energy-shockwave" aria-hidden="true"></span>
                        <span class="anime-sparks" aria-hidden="true">
                            <span class="spark s-1"></span>
                            <span class="spark s-2"></span>
                            <span class="spark s-3"></span>
                            <span class="spark s-4"></span>
                        </span>
                        <span class="mobile-profile-avatar mobile-profile-avatar-empty">
                            <i data-lucide="user-round" class="w-4 h-4"></i>
                        </span>
                        <i data-lucide="chevron-down" class="mobile-profile-chevron w-4 h-4"></i>
                    </button>
                `;
                return;
            }
            if (variant === 'mobile') {
                el.innerHTML = `
                    <div class="anime-mobile-guest-card">
                        <div class="text-[11px] font-extrabold text-gold-400/90 tracking-widest uppercase mb-1">Guest Commander</div>
                        <div class="text-xs text-white/60 mb-3">Sign in to sync your anime watchlist & unlocks</div>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="navigate('login'); toggleMobileMenu()" class="w-full px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-xs font-bold text-center border border-white/10 flex items-center justify-center gap-1.5 text-white">
                                <i data-lucide="log-in" class="w-3.5 h-3.5"></i> Sign In
                            </button>
                            <button onclick="navigate('register'); toggleMobileMenu()" class="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-gold-400/25 to-amber-500/25 text-gold-400 hover:bg-gold-400/35 transition-all text-xs font-bold text-center border border-gold-400/35 flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Register
                            </button>
                        </div>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <button onclick="navigate('login')" class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium">
                        <i data-lucide="log-in" class="w-4 h-4 inline-block mr-2"></i> Sign In
                    </button>
                    <button onclick="navigate('register')" class="px-3 py-1.5 rounded-xl bg-gold-400/20 text-gold-400 hover:bg-gold-400/30 transition-all text-sm font-medium">
                        <i data-lucide="user-plus" class="w-4 h-4 inline-block mr-2"></i> Register Now
                    </button>
                `;
            }
        } else {
            if (variant === 'compact') {
                el.innerHTML = `
                    <button id="mobile-menu-toggle" onclick="toggleMobileMenu()" class="mobile-profile-trigger anime-capsule-hamburger" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-menu" title="Navigation menu">
                        <span class="anime-btn-aura" aria-hidden="true"></span>
                        <span class="anime-energy-shockwave" aria-hidden="true"></span>
                        <span class="anime-sparks" aria-hidden="true">
                            <span class="spark s-1"></span>
                            <span class="spark s-2"></span>
                            <span class="spark s-3"></span>
                            <span class="spark s-4"></span>
                        </span>
                        <img src="${getCurrentAvatarUrl()}" class="mobile-profile-avatar" alt="${getCurrentUsername()}">
                        <i data-lucide="chevron-down" class="mobile-profile-chevron w-4 h-4"></i>
                    </button>
                `;
                return;
            }
            if (variant === 'mobile') {
                el.innerHTML = `
                    <div class="anime-mobile-user-card">
                        <div class="flex items-center gap-3 mb-3">
                            <img src="${getCurrentAvatarUrl()}" class="w-10 h-10 rounded-full border-2 border-gold-400/60 shadow-lg object-cover" alt="${getCurrentUsername()}">
                            <div class="flex flex-col min-w-0 flex-1">
                                <div class="text-sm font-black text-white truncate">${getCurrentUsername()}</div>
                                <div class="flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span class="text-[10px] font-bold text-gold-400/80 uppercase tracking-widest">ONLINE // MEMBER</span>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="navigate('profile'); toggleMobileMenu()" class="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs font-semibold text-white">
                                <i data-lucide="user" class="w-3.5 h-3.5 text-gold-400"></i>
                                <span>Profile</span>
                            </button>
                            <button onclick="signOut(); toggleMobileMenu()" class="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 transition-all text-xs font-semibold">
                                <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                                <span>Sign Out</span>
                            </button>
                        </div>
                        ${supportEnabled ? `
                        <button onclick="showSupportModal(); toggleMobileMenu()" class="w-full mt-2 flex items-center justify-center gap-1.5 p-2 rounded-xl bg-gold-400/15 hover:bg-gold-400/25 border border-gold-400/30 text-gold-400 transition-all text-xs font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                            <i data-lucide="heart" class="w-3.5 h-3.5 text-gold-400"></i>
                            <span>❤️ Support Anify</span>
                        </button>
                        ` : ''}
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <button onclick="navigate('profile')" class="flex items-center gap-2 p-1 rounded-xl hover:bg-white/10 transition-all">
                        <img src="${getCurrentAvatarUrl()}" class="w-8 h-8 rounded-lg" alt="avatar">
                        <div class="hidden sm:block">
                            <div class="text-sm font-medium leading-tight">${getCurrentUsername()}</div>
                        </div>
                        <i data-lucide="chevron-down" class="w-4 h-4 hidden md:block"></i>
                    </button>
                    ${supportEnabled ? `
                    <button onclick="showSupportModal()" class="px-3 py-1.5 rounded-xl bg-gold-400/20 text-gold-400 hover:bg-gold-400/30 transition-all text-sm font-medium">
                        <i data-lucide="heart" class="w-4 h-4 inline-block mr-2"></i> ❤️ Support Anify
                    </button>
                    ` : ''}
                    <button onclick="signOut()" class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium">
                        <i data-lucide="log-out" class="w-4 h-4 inline-block mr-2"></i> Sign Out
                    </button>
                `;
            }
        }
    };

    hydrate(containerDesktop, 'desktop');
    hydrate(containerMobile, 'mobile');
    hydrate(containerCompact, 'compact');

    lucide.createIcons();
}

function signOut() {
    // Required log: logout action
    console.log('[Auth] signOut');

    authService.logout();
    navigate('home');
}

function removeSearchEventListeners() {
    if (window.searchClickOutsideHandler) {
        document.removeEventListener('click', window.searchClickOutsideHandler);
        window.searchClickOutsideHandler = null;
    }
    if (window.searchEscapeHandler) {
        document.removeEventListener('keydown', window.searchEscapeHandler);
        window.searchEscapeHandler = null;
    }
    if (window.searchResizeHandler) {
        window.removeEventListener('resize', window.searchResizeHandler);
        window.searchResizeHandler = null;
    }
}

function setupSearchEventListeners() {
    removeSearchEventListeners();

    window.searchClickOutsideHandler = (e) => {
        const panel = document.getElementById('search-panel');
        const backdrop = document.getElementById('search-backdrop');

        if (!panel || panel.classList.contains('hidden')) {
            return;
        }

        // Close if clicking on backdrop or outside the panel
        if (backdrop && e.target === backdrop) {
            closeSearchPanel();
            return;
        }

        // The panel is portaled to body while open, so do not treat its
        // controls or results as outside clicks.
        if (panel.contains(e.target)) {
            return;
        }

        // Close if clicking outside the search container
        const searchContainer = document.getElementById('search-container');
        if (searchContainer && !searchContainer.contains(e.target)) {
            closeSearchPanel();
        }
    };

    window.searchEscapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeSearchPanel();
        }
    };

    document.addEventListener('click', window.searchClickOutsideHandler);
    document.addEventListener('keydown', window.searchEscapeHandler);
}

function openSearchPanel() {
    const panel = document.getElementById('search-panel');
    const backdrop = document.getElementById('search-backdrop');
    const searchInput = document.getElementById('search-input');

    if (!panel) return;

    // Escape the navbar's backdrop-filter/overflow stacking context so the
    // overlay is positioned against the viewport on every device.
    if (panel.parentElement !== document.body) {
        document.body.appendChild(panel);
    }
    if (backdrop && backdrop.parentElement !== document.body) {
        document.body.appendChild(backdrop);
    }

    panel.classList.remove('hidden');
    if (backdrop) {
        backdrop.classList.remove('hidden');
    }

    isSearchOpen = true;
    searchPreviousBodyOverflow = document.body.style.overflow;
    document.body.classList.add('mobile-nav-locked');
    document.body.style.overflow = 'hidden';

    if (searchInput) {
        setTimeout(() => {
            searchInput.focus();
            if (searchInput.value) {
                handleSearch(searchInput.value);
            }
        }, 60);
    }
    
    setupSearchEventListeners();
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

function closeSearchPanel() {
    const panel = document.getElementById('search-panel');
    const backdrop = document.getElementById('search-backdrop');

    if (panel) {
        panel.classList.add('hidden');
    }
    if (backdrop) {
        backdrop.classList.add('hidden');
    }

    document.body.classList.remove('mobile-nav-locked');
    document.body.style.overflow = searchPreviousBodyOverflow || '';
    searchPreviousBodyOverflow = null;
    isSearchOpen = false;
    removeSearchEventListeners();
}

function toggleSearch(event) {
    if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
    }

    const panel = document.getElementById('search-panel');
    if (!panel) return;

    if (panel.classList.contains('hidden')) {
        openSearchPanel();
    } else {
        closeSearchPanel();
    }
}

function clearSearchInput() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const results = document.getElementById('search-results');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    if (clearBtn) {
        clearBtn.classList.add('hidden');
    }
    
    // Clear active chips
    document.querySelectorAll('.search-chip').forEach(c => c.classList.remove('active'));
    
    if (results) {
        results.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Start typing to search anime library...</p>';
    }
}

function setSearchFilter(filterName) {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    searchInput.value = filterName;
    
    // Highlight active chip
    document.querySelectorAll('.search-chip').forEach(chip => {
        if (chip.textContent.toLowerCase().includes(filterName.toLowerCase())) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
    
    handleSearch(filterName);
    searchInput.focus();
}

function toggleNotifications(forceOpen = null) {
    const panel = document.getElementById('notification-panel');
    if (!panel) return;
    const open = forceOpen === null ? panel.classList.contains('hidden') : Boolean(forceOpen);
    panel.classList.toggle('hidden', !open);

    if (open) {
        notificationService.restore();
        renderNotifications();
        setTimeout(() => {
            const first = document.querySelector('#notification-list .notif-item:not(.hidden)');
            if (first && typeof first.focus === 'function') first.focus();
        }, 0);
    }
}

function getNotificationBadgeCount() {
    return notificationService && typeof notificationService.getUnreadCount === 'function'
        ? notificationService.getUnreadCount()
        : 0;
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    const count = getNotificationBadgeCount();
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'flex' : 'none';
}

function getNotificationResults() {
    if (!notificationService) return [];

    const filtered = typeof notificationService.filterNotifications === 'function'
        ? notificationService.filterNotifications(notificationFilter)
        : notificationService.getNotifications ? notificationService.getNotifications() : [];

    if (!notificationSearchQuery) {
        return filtered;
    }

    const normalizedQuery = String(notificationSearchQuery).trim().toLowerCase();
    return filtered.filter(item => {
        return String(item.title || '').toLowerCase().includes(normalizedQuery)
            || String(item.message || '').toLowerCase().includes(normalizedQuery)
            || String(item.type || '').toLowerCase().includes(normalizedQuery)
            || String(item.metadata?.category || '').toLowerCase().includes(normalizedQuery);
    });
}

function renderNotifications() {
    const list = document.getElementById('notification-list');
    const emptyState = document.getElementById('notification-empty');
    if (!list || !emptyState) return;

    const visibleNotifications = getNotificationResults();
    list.innerHTML = visibleNotifications.map(notification => {
        const readClass = notification.read ? 'opacity-60' : 'opacity-100';
        const timestamp = new Date(notification.createdAt).toLocaleString();
        const poster = notification.metadata?.poster || '';
        const banner = notification.metadata?.banner || '';
        const mediaStyle = banner ? ` style="--notification-banner: url('${String(banner).replace(/'/g, '%27')}')"` : '';
        return `
            <div tabindex="0" role="button" onclick="openNotificationReader('${notification.id}')" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNotificationReader('${notification.id}'); }" class="notif-item ${readClass} ${notification.read ? 'notif-item--read' : 'notif-item--unread'}"${mediaStyle} aria-label="Open notification: ${notification.title}">
                <div class="flex items-start gap-3">
                    <div class="notif-item__media">
                        ${poster ? `<img src="${ensureHttps(poster)}" alt="${notification.metadata?.animeTitle || 'Anime'} poster" loading="lazy" onerror="this.hidden=true">` : `<span class="notif-item__icon"><i data-lucide="${notification.icon || 'bell'}"></i></span>`}
                    </div>
                    <div class="notif-item__content">
                        <div class="notif-item__topline">
                            <div>
                                <p class="notif-item__title">${notification.title}</p>
                                <p class="notif-item__type">${notification.type}</p>
                            </div>
                            <button type="button" onclick="event.stopPropagation(); markNotificationRead('${notification.id}')" class="notif-item__read-button">
                                ${notification.read ? 'Read' : 'Mark read'}
                            </button>
                        </div>
                        <p class="notif-item__message">${notification.message}</p>
                        <p class="notif-item__time">${timestamp}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const hasItems = visibleNotifications.length > 0;
    list.style.display = hasItems ? 'block' : 'none';
    emptyState.classList.toggle('hidden', hasItems);
    updateNotificationBadge();
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function ensureNotificationsInitialized() {
    if (notificationService && typeof notificationService.restore === 'function') {
        notificationService.restore();
    }
    updateNotificationBadge();
}

function markNotificationRead(notificationId) {
    if (!notificationService || typeof notificationService.markAsRead !== 'function') return;
    notificationService.markAsRead(notificationId);
    renderNotifications();
}

function openNotificationReader(notificationId) {
    const notification = notificationService?.getNotifications?.().find(item => String(item.id) === String(notificationId));
    const reader = document.getElementById('notification-reader');
    if (!notification || !reader) return;

    document.getElementById('notification-reader-title').textContent = notification.title || 'Notification';
    document.getElementById('notification-reader-type').textContent = notification.type || 'Update';
    document.getElementById('notification-reader-time').textContent = new Date(notification.createdAt).toLocaleString();
    document.getElementById('notification-reader-message').textContent = notification.message || '';
    document.getElementById('notification-reader-icon').innerHTML = `<i data-lucide="${notification.icon || 'bell'}"></i>`;
    const readerCard = document.querySelector('.notification-reader__card');
    if (readerCard) {
        const banner = notification.metadata?.banner || '';
        readerCard.style.setProperty('--notification-banner', banner ? `url("${String(banner).replace(/"/g, '%22')}")` : 'none');
    }
    const action = document.getElementById('notification-reader-action');
    action.classList.toggle('hidden', !notification.action?.label);
    action.textContent = notification.action?.label || '';
    action.onclick = () => {
        closeNotificationReader();
        if (notification.action?.url?.startsWith('#anime-')) window.navigate?.('anime', Number(notification.action.url.replace('#anime-', '')));
    };
    notificationService.markAsRead(notificationId);
    renderNotifications();
    reader.classList.remove('hidden');
    document.body.classList.add('notification-reader-open');
    if (window.lucide?.createIcons) lucide.createIcons();
    reader.querySelector('.notification-reader__close')?.focus();
}

function closeNotificationReader() {
    document.getElementById('notification-reader')?.classList.add('hidden');
    document.body.classList.remove('notification-reader-open');
}

function markAllAsRead() {
    if (!notificationService || typeof notificationService.markAllAsRead !== 'function') return;
    notificationService.markAllAsRead();
    renderNotifications();
}

function clearAllNotifications() {
    if (!notificationService || typeof notificationService.clearAllNotifications !== 'function') return;
    notificationService.clearAllNotifications();
    renderNotifications();
}

function setNotificationFilter(filter) {
    notificationFilter = String(filter || 'All');
    document.querySelectorAll('.notif-filter-pill').forEach(btn => {
        const value = btn.getAttribute('data-notif-filter');
        btn.classList.toggle('active', value === notificationFilter);
    });
    renderNotifications();
}

function handleNotificationSearch(query) {
    notificationSearchQuery = String(query || '').trim();
    renderNotifications();
}

function showToast(message) {
    const existing = document.getElementById('anify-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'anify-toast';
    toast.className = 'anify-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('is-visible'), 10);
    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 250);
    }, 2600);
}

// Gold-themed alert (replaces browser alert color inconsistency)
function alertGold(message) {
    // Avoid stacking alerts
    const existing = document.getElementById('anify-alert');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'anify-alert-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '10000';
    overlay.style.background = 'var(--overlay)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';

    const card = document.createElement('div');
    card.id = 'anify-alert';
    card.style.maxWidth = 'min(90vw, 520px)';
    card.style.borderRadius = '0.95rem';
    card.style.background = 'var(--modal-background)';
    card.style.border = '1px solid var(--border)';
    card.style.boxShadow = '0 18px 45px var(--shadow-color)';
    card.style.color = 'var(--text-primary)';
    card.style.padding = '1rem 1.1rem';
    card.style.fontFamily = 'inherit';

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.fontSize = '0.95rem';
    title.style.marginBottom = '0.35rem';
    title.style.letterSpacing = '0.02em';
    title.textContent = 'Notice';

    const body = document.createElement('div');
    body.style.fontWeight = '700';
    body.style.fontSize = '0.9rem';
    body.style.lineHeight = '1.35';
    body.textContent = String(message ?? '');

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '0.9rem';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'OK';
    btn.style.background = 'linear-gradient(135deg, var(--primary-light), var(--primary-hover))';
    btn.style.color = 'var(--button-text)';
    btn.style.fontWeight = '900';
    btn.style.border = 'none';
    btn.style.padding = '0.55rem 1rem';
    btn.style.borderRadius = '0.75rem';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '0.85rem';

    const close = () => {
        overlay.remove();
    };

    btn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // ESC to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escHandler);
            close();
        }
    };
    document.addEventListener('keydown', escHandler);

    actions.appendChild(btn);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

function handleSearch(query) {
    const results = document.getElementById('search-results');
    const clearBtn = document.getElementById('search-clear-btn');
    if (!results) return;
    
    const trimmed = (query || '').trim();
    
    if (clearBtn) {
        if (trimmed.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    
    if (!trimmed) {
        results.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Start typing to search anime library...</p>';
        return;
    }
    
    const queryLower = trimmed.toLowerCase();
    const filtered = (typeof animeData !== 'undefined' && Array.isArray(animeData))
        ? animeData.filter(a => {
            if (!a) return false;
            const matchTitle = a.title && a.title.toLowerCase().includes(queryLower);
            const matchAlt = a.titleJp && a.titleJp.toLowerCase().includes(queryLower);
            const matchGenre = Array.isArray(a.genres) && a.genres.some(g => g && g.toLowerCase().includes(queryLower));
            const matchType = a.type && a.type.toLowerCase().includes(queryLower);
            return matchTitle || matchAlt || matchGenre || matchType;
        })
        : [];

    if (filtered.length === 0) {
        results.innerHTML = `
            <div class="py-6 text-center">
                <p class="text-xs font-semibold text-gray-400 mb-1">No anime found matching "${escapeHtml(trimmed)}"</p>
                <p class="text-[11px] text-gray-500 mb-3">Try searching for genres like Action, Romance, or Fantasy</p>
                <button type="button" onclick="showDiscoveryHub(); closeSearchPanel()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-400/20 text-gold-400 text-xs font-bold hover:bg-gold-400/30 transition-all">
                    <i data-lucide="dices" class="w-3.5 h-3.5"></i> Open Discovery Hub
                </button>
            </div>
        `;
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        return;
    }

    results.innerHTML = filtered.slice(0, 8).map(a => {
        const rating = (typeof a.rating === 'number' || typeof a.rating === 'string') ? a.rating : 'N/A';
        const year = a.year || a.releaseDate || 'Anime';
        const genres = Array.isArray(a.genres) ? a.genres.slice(0, 2).join(' • ') : '';
        const format = a.type ? (a.type.toUpperCase() === 'MOVIE' ? 'MOVIE' : 'TV') : 'ANIME';

        return `
            <button type="button" onclick="handleSearchResultClick(${a.id})"
                class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 transition-all text-left search-result-item group">
                <img src="${a.image || '/pictures/placeholder.jpg'}"
                    class="w-11 h-14 rounded-lg object-cover flex-shrink-0 shadow-md border border-white/10 group-hover:border-gold-400/50 transition-colors"
                    alt="${escapeHtml(a.title || 'Anime')}"
                    loading="lazy"
                    onerror="this.src='/pictures/placeholder.jpg'">

                <div class="flex-1 min-w-0">
                    <p class="font-bold text-xs md:text-sm text-white group-hover:text-gold-300 transition-colors truncate">${escapeHtml(a.title || 'Untitled')}</p>
                    
                    <div class="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                        <span class="px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-bold text-[9px] uppercase tracking-wider">${format}</span>
                        <span class="text-gray-400 font-medium">${year}</span>
                        <span class="text-gray-600">•</span>
                        <span class="text-gold-400 font-bold flex items-center gap-0.5">
                            ⭐ ${rating}
                        </span>
                    </div>

                    ${genres ? `<p class="text-[10px] text-gray-400 truncate mt-0.5 font-medium">${escapeHtml(genres)}</p>` : ''}
                </div>

                <div class="text-gray-500 group-hover:text-gold-400 transition-colors flex-shrink-0 pl-1">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>
        `;
    }).join('');

    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

function handleSearchResultClick(animeId) {
    closeSearchPanel();
    navigate('anime', animeId);
}

function getPlayerVideo() {
    return playerService.getVideoElement();
}

function updatePlayerUI() {
    if (window.playerService) {
        const state = playerService.syncState();
        const video = playerService.getVideoElement();
        const progress = document.getElementById('progress-bar');
        const time = document.getElementById('player-time');
        const playIcon = document.getElementById('player-play-icon');
        const overlay = document.getElementById('play-overlay');

        if (!video) return;

        updateTimelineMarkers(video, state.duration);

        const percent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
        if (progress) progress.style.width = `${percent}%`;

        if (time) {
            const duration = isNaN(state.duration) ? 0 : state.duration;
            time.textContent = `${formatPlayerTime(state.currentTime)} / ${formatPlayerTime(duration)}`;
        }

        // Update Mini Player UI
        const miniProgress = document.getElementById('mini-progress-bar');
        const miniTime = document.getElementById('mini-time');
        if (miniProgress) miniProgress.style.width = `${percent}%`;
        if (miniTime) {
            const duration = isNaN(state.duration) ? 0 : state.duration;
            miniTime.textContent = `${formatPlayerTime(state.currentTime)} / ${formatPlayerTime(duration)}`;
        }

        if (playIcon) playIcon.setAttribute('data-lucide', state.isPlaying ? 'pause' : 'play');
        if (overlay) overlay.classList.toggle('hidden', state.isPlaying);
        const miniPlaySymbol = document.getElementById('mini-mobile-play-symbol');
        if (miniPlaySymbol) miniPlaySymbol.textContent = state.isPlaying ? 'Ⅱ' : '▶';
        
        // Sync volume UI with actual video state
        syncVolumeUI();

        const anime = playerService.getAnime();
        const viewEl = document.getElementById('current-episode-views');
        if (viewEl && anime) {
            const epNum = Number(video.dataset.episodeNumber || 1);
            const epObj = (Array.isArray(anime.episodesMedia) && (anime.type || 'anime') === 'anime')
                ? anime.episodesMedia.find(e => Number(e?.episodeNumber) === epNum)
                : null;
            const views = epObj ? (Number(epObj.views) || 0) : (Number(anime.views) || 0);
            viewEl.textContent = formatViewCount(views);
        }

        const introBtn = document.getElementById('skip-intro-btn');
        const outroBtn = document.getElementById('skip-outro-btn');
        
        // Initialize timing variables with defaults
        let introStart = 0, introEnd = 90, outroStart = 0, outroEnd = 0;
        
        if (anime) {
            const epNum = Number(video.dataset.episodeNumber || 1);
            const timing = typeof getTimingConfig === 'function'
                ? getTimingConfig(anime, epNum)
                : { introStart: 0, introEnd: 90, outroStart: 0, outroEnd: 0 };
            introStart = timing.introStart;
            introEnd = timing.introEnd;
            outroStart = timing.outroStart || Math.max(0, video.duration - 120);
            outroEnd = timing.outroEnd || video.duration;
        }

        if (introBtn) {
            const isVisible = !introBtn.classList.contains('hidden');
            const shouldBeVisible = state.currentTime >= introStart && state.currentTime < introEnd;
            if (isVisible !== shouldBeVisible) {
                introBtn.classList.toggle('hidden', !shouldBeVisible);
                if (shouldBeVisible && window.lucide) lucide.createIcons();
            }
        }
        if (outroBtn) {
            const isVisible = !outroBtn.classList.contains('hidden');
            const shouldBeVisible = state.currentTime >= outroStart && state.currentTime < outroEnd;
            if (isVisible !== shouldBeVisible) {
                outroBtn.classList.toggle('hidden', !shouldBeVisible);
                if (shouldBeVisible && window.lucide) lucide.createIcons();
            }
        }

        // Auto-Next Trigger logic (when reaching outroEnd or end of video)
        // If outroEnd is set and we pass it, show the auto-next overlay.
        if (state.currentTime >= outroEnd - 0.5 && state.currentTime > 0 && outroEnd > 0) {
            triggerAutoNext();
        }
    }
}

function updateTimelineMarkers(video, duration) {
    const track = document.querySelector('#video-controls .progress-bar');
    if (!track || !video || !Number.isFinite(duration) || duration <= 0) return;
    const anime = playerService.getAnime?.();
    const episodeNumber = Number(video.dataset.episodeNumber || 1);
    const episode = anime ? (getEpisodeObject(anime, episodeNumber) || anime.episodesMedia?.[0]) : null;
    const ranges = [
        { key: 'intro', start: Number(episode?.introStart), end: Number(episode?.introEnd), label: 'Intro' },
        { key: 'outro', start: Number(episode?.outroStart), end: Number(episode?.outroEnd), label: 'Outro' },
    ];

    ranges.forEach(({ key, start, end, label }) => {
        const marker = track.querySelector(`[data-timeline-marker="${key}"]`);
        if (!marker) return;
        const valid = Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && start < duration;
        if (!valid) {
            marker.hidden = true;
            return;
        }
        const safeEnd = Math.min(duration, end);
        marker.hidden = false;
        marker.style.left = `${(Math.max(0, start) / duration) * 100}%`;
        marker.style.width = `${((safeEnd - Math.max(0, start)) / duration) * 100}%`;
        marker.dataset.tooltip = `${label} ${formatPlayerTime(start)} – ${formatPlayerTime(safeEnd)}`;
        marker.setAttribute('aria-label', marker.dataset.tooltip);
    });
}

function saveCurrentVideoProgress() {
    return playerService.saveProgress();
}

function togglePlay() {
    return playerService.togglePlay();
}

function showControls() {
    const controls = document.getElementById('video-controls');
    if (!controls) return;
    controls.classList.add('is-visible');
    clearTimeout(showControls.timer);
    showControls.timer = setTimeout(() => controls.classList.remove('is-visible'), 2500);
}

function seekPlayer(event) {
    const video = getPlayerVideo();
    if (!video || !video.duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    playerService.seekToRatio(ratio);
    updatePlayerUI();
}

function skipPlayer(seconds) {
    playerService.seek(seconds);
    updatePlayerUI();
}

function getCurrentPlayerAnime() {
    return playerService.getAnime();
}

function getPlayerSource(language, quality) {
    return playerService.getPlayerSource(language, quality);
}

function setPlayerSource(language, quality) {
    return playerService.setPlayerSource(language, quality);
}

function refreshQualityOptions(language) {
    return playerService.refreshQualityOptions(language);
}


function changePlayerLanguage(language) {
    return playerService.changeLanguage(language);
}

function changePlayerQuality(quality) {
    return playerService.changeQuality(quality);
}

function downloadCurrentVideo() {
    // Check if user is logged in first
    if (!isLoggedIn()) {
        console.log('User not logged in, showing download auth modal');
        showDownloadAuthModal();
        return;
    }

    const video = getPlayerVideo();
    const anime = getCurrentPlayerAnime();
    const url = video?.currentSrc || video?.src;
    if (!url) {
        if (typeof showToast === 'function') {
            showToast('No video is available to download yet.');
        } else {
            alertGold('No video is available to download yet.');
        }
        return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = `${anime?.title || 'anify'}-${video.dataset.language || 'sub'}-${video.dataset.quality || '1080p'}.mp4`;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function setActiveEpisodeLanguage(language) {
    return playerService.setActiveEpisodeLanguage(language);
}

function switchEpisodeLanguage(language) {
    return playerService.switchEpisodeLanguage(language);
}

function selectEpisodeLanguage(language, episodeNumber = 1) {
    // Manual selection resets binge-watch counter
    if (playerService.state) {
        playerService.state.bingeCount = 0;
    }
    const result = playerService.selectEpisode(language, episodeNumber);
    updatePlayerUI();
    return result;
}

function togglePlayerMute() {
    const result = playerService.toggleMute();
    syncVolumeUI();
    return result;
}

function syncVolumeUI() {
    const video = playerService.getVideoElement();
    if (!video) return;

    const volumeIcon = document.getElementById('player-volume-icon');
    if (!volumeIcon) return;

    const volume = video.volume;
    const muted = video.muted;

    console.log('[Player] Volume changed:', volume, 'Muted:', muted, 'Volume UI synchronized');

    // Determine the appropriate icon based on volume and mute state
    let iconName = 'volume-2'; // Default to medium/high volume

    if (muted || volume === 0) {
        iconName = 'volume-x'; // Muted or zero volume
    } else if (volume < 0.5) {
        iconName = 'volume-1'; // Low volume
    } else {
        iconName = 'volume-2'; // Medium/high volume
    }

    volumeIcon.setAttribute('data-lucide', iconName);

    // Re-render lucide icons to show the updated volume icon
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

function setPlayerSpeed(value) {
    return playerService.setPlaybackRate(value);
}

function togglePlayerFullscreen() {
    return playerService.toggleFullscreen();
}

function handleMiniPlayerTransition(newPage) {
    const player = document.getElementById('anify-persistent-player');
    const video = document.getElementById('anify-video');
    const wrapper = document.getElementById('persistent-player-wrapper');

    if (!player || !video) return;

    const isLoaded = video.src || video.currentSrc;
    const savedState = window.miniPlayer?.getSavedState?.();
    const isCurrentlyFull = player.parentElement && player.parentElement.id === 'persistent-player-mount';

    if (newPage !== 'player') {
        if (isLoaded && (isCurrentlyFull || (savedState && savedState.open))) {
            // Minimize to Mini Player
            wrapper.appendChild(player);
            player.classList.add('mini-player');
            
            // Clear full-size inline styles so the .mini-player class 
            // and saved state (transform) can take over.
            player.style.width = '';
            player.style.height = '';
            
            // Show mini-only controls
            player.querySelectorAll('.mini-only').forEach(el => el.classList.remove('hidden'));
            player.querySelectorAll('.full-only').forEach(el => el.classList.add('hidden'));
            
            // Apply the saved size/position before revealing the wrapper so
            // re-entering an already-open mini player doesn't visibly resize.
            if (window.initMiniPlayer) {
                window.initMiniPlayer();
            }
            wrapper.classList.remove('hidden');
            if (window.miniPlayer?.playEnterAnimation && isCurrentlyFull) {
                window.miniPlayer.playEnterAnimation();
            }
            window.miniPlayer?.setOpenFlag?.(true);

            // Show dock
            const dock = document.getElementById('mini-player-dock');
            if (dock) dock.classList.remove('hidden');
        } else {
            // Not playing or explicitly closed, hide it
            wrapper.classList.add('hidden');
        }
    } else {
        // Entering player page - setupCustomPlayer will handle moving it back
        player.classList.remove('mini-player', 'mini-player-medium', 'mini-player-large', 'mini-settings-open');
        player.querySelectorAll('.mini-only').forEach(el => el.classList.add('hidden'));
        player.querySelectorAll('.full-only').forEach(el => el.classList.remove('hidden'));
        window.miniPlayer?.setOpenFlag?.(false);
    }
}

/**
 * Handles clicks on the persistent video element itself.
 * In mini mode: restores the full player (unless the click was actually a drag).
 * In full mode: toggles play/pause, matching prior behavior.
 * On mobile, checks if this was a double-tap and skips play/pause if so.
 */
function handlePlayerVideoClick(event) {
    event.stopPropagation();
    
    // On mobile, don't handle click if it was a double-tap
    if (preventClick) {
        preventClick = false;
        return;
    }
    
    if (window.__miniPlayerJustDragged) {
        window.__miniPlayerJustDragged = false;
        return;
    }
    const player = document.getElementById('anify-persistent-player');
    if (player && player.classList.contains('mini-player')) {
        const video = playerService.getVideoElement();
        navigate('player', video?.dataset?.animeId);
        return;
    }
    togglePlay();
}

/**
 * Handles double-clicks on the video for seeking.
 * Double-click on left third: skip backward 5 seconds.
 * Double-click on right third: skip forward 5 seconds.
 * Center third: normal play/pause (no seeking).
 */
function handlePlayerVideoDoubleClick(event) {
    event.stopPropagation();
    event.preventDefault();
    
    const video = playerService.getVideoElement();
    if (!video) return;

    const player = document.getElementById('anify-persistent-player');
    if (player && player.classList.contains('mini-player')) {
        // In mini mode, double-click restores full player
        navigate('player', video?.dataset?.animeId);
        return;
    }

    // Get click position relative to video width
    const rect = video.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const videoWidth = rect.width;
    const clickRatio = clickX / videoWidth;

    // Three zones: left third (< 33%), center third (33-66%), right third (> 66%)
    if (clickRatio < 0.33) {
        // Left third - skip backward with accumulation
        playerService.skipBackward(5);
        showSeekFeedback('backward', 5, true);
    } else if (clickRatio > 0.66) {
        // Right third - skip forward with accumulation
        playerService.skipForward(5);
        showSeekFeedback('forward', 5, true);
    } else {
        // Center third - normal play/pause, no seeking
        togglePlay();
    }
}

/**
 * Handles double-tap on mobile devices for seeking.
 * Double-tap on left third: skip backward 5 seconds.
 * Double-tap on right third: skip forward 5 seconds.
 * Center third: normal player interaction (no seeking).
 */
let lastTapTime = 0;
let lastTapX = 0;
let tapTimeout = null;
let hasShownDoubleTapHint = false;
let preventClick = false;

function handlePlayerVideoTouchEnd(event) {
    const currentTime = new Date().getTime();
    const tapInterval = currentTime - lastTapTime;
    
    // Get touch position
    const touch = event.changedTouches[0];
    const tapX = touch.clientX;
    
    const video = playerService.getVideoElement();
    if (!video) return;

    const player = document.getElementById('anify-persistent-player');
    if (player && player.classList.contains('mini-player')) {
        // In mini mode, double-tap restores full player
        if (tapInterval < 300 && Math.abs(tapX - lastTapX) < 50) {
            navigate('player', video?.dataset?.animeId);
            event.preventDefault();
            preventClick = true;
        }
        lastTapTime = currentTime;
        lastTapX = tapX;
        return;
    }

    // Show double-tap hint on first interaction (if on touch device)
    if (!hasShownDoubleTapHint && 'ontouchstart' in window) {
        video.classList.add('double-tap-hint');
        hasShownDoubleTapHint = true;
        
        // Hide hint after 2 seconds
        setTimeout(() => {
            video.classList.remove('double-tap-hint');
        }, 2000);
    }

    // Check if this is a double-tap (within 300ms and close to previous tap)
    if (tapInterval < 300 && Math.abs(tapX - lastTapX) < 50) {
        // Clear any pending single-tap timeout
        if (tapTimeout) {
            clearTimeout(tapTimeout);
            tapTimeout = null;
        }

        // Get tap position relative to video width
        const rect = video.getBoundingClientRect();
        const tapRatio = (tapX - rect.left) / rect.width;

        // Three zones: left third (< 33%), center third (33-66%), right third (> 66%)
        if (tapRatio < 0.33) {
            // Left third - skip backward with accumulation
            playerService.skipBackward(5);
            showSeekFeedback('backward', 5, true);
            event.preventDefault();
            event.stopPropagation();
            preventClick = true;
        } else if (tapRatio > 0.66) {
            // Right third - skip forward with accumulation
            playerService.skipForward(5);
            showSeekFeedback('forward', 5, true);
            event.preventDefault();
            event.stopPropagation();
            preventClick = true;
        } else {
            // Center third - normal play/pause, no seeking
            preventClick = false;
        }
        
        // Reset to prevent triple-tap
        lastTapTime = 0;
        lastTapX = 0;
    } else {
        // This might be a single tap, wait to see if another tap comes
        lastTapTime = currentTime;
        lastTapX = tapX;
        preventClick = false;
        
        // Clear previous timeout if exists
        if (tapTimeout) {
            clearTimeout(tapTimeout);
        }
        
        // Set timeout to reset preventClick flag
        tapTimeout = setTimeout(() => {
            preventClick = false;
            lastTapTime = 0;
            lastTapX = 0;
            tapTimeout = null;
        }, 300);
    }
}

/**
 * Toggles the floating speed/quality settings popover while in mini mode.
 */
function toggleMiniSettings() {
    const player = document.getElementById('anify-persistent-player');
    if (!player || !player.classList.contains('mini-player')) return;
    player.classList.toggle('mini-settings-open');
}

/**
 * Reopens the mini player after a hard page refresh, using the most recently
 * updated Continue Watching entry to restore position, size and playback
 * context. Playback stays paused (browser autoplay policies) but the video,
 * timestamp, language and quality are restored so a single click resumes
 * seamlessly.
 */
function restoreMiniPlayerFromRefresh() {
    if (currentPage === 'player') return;
    const savedState = window.miniPlayer?.getSavedState?.();
    if (!savedState || !savedState.open) return;

    const entries = continueWatchingService?.getEntries?.() || [];
    const lastEntry = entries[0];
    if (!lastEntry) return;

    const anime = animeData.find(a => a.id === lastEntry.id);
    if (!anime) return;

    let player = document.getElementById('anify-persistent-player');
    if (!player) player = createPersistentPlayer();

    const wrapper = document.getElementById('persistent-player-wrapper');
    if (!wrapper) return;
    wrapper.appendChild(player);
    player.classList.add('mini-player');
    
    // Clear any leftover inline full-size styles
    player.style.width = '';
    player.style.height = '';
    
    player.querySelectorAll('.mini-only').forEach(el => el.classList.remove('hidden'));
    player.querySelectorAll('.full-only').forEach(el => el.classList.add('hidden'));

    // Apply the saved size/position before the wrapper becomes visible so
    // there's no flash of the default size on refresh.
    window.initMiniPlayer?.();
    wrapper.classList.remove('hidden');

    const video = playerService.getVideoElement();
    if (!video) return;
    video.dataset.animeId = String(anime.id);
    video.dataset.episodeNumber = String(lastEntry.episode || 1);
    video.dataset.language = lastEntry.language || 'sub';
    video.dataset.quality = lastEntry.quality || '1080p';

    const source = playerService.getPlayerSource(video.dataset.language, video.dataset.quality);
    if (source) {
        video.src = source;
        if (typeof playerService.updatePoster === 'function') {
            playerService.updatePoster();
        }
        video.load();
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = Math.min(lastEntry.time || 0, video.duration || Infinity);
            updatePlayerUI();
        }, { once: true });
    }

    playerService.attachEvents();
    playerService.syncState();

    // Re-render episode list to update active state when restoring from mini player refresh
    const list = document.getElementById('episode-list');
    if (anime && list && anime.type === 'anime') {
        const language = lastEntry.language || 'sub';
        list.innerHTML = renderEpisodeList(anime, language);
        if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    }

    window.miniPlayer?.updateNowPlaying?.();
    document.getElementById('mini-player-dock')?.classList.remove('hidden');
    updatePlayerUI();
}

function hideMiniPlayer() {
    const video = document.getElementById('anify-video');
    const wrapper = document.getElementById('persistent-player-wrapper');
    
    if (video) {
        playerService.pause();
        playerService.saveProgress();
    }
    
    if (wrapper) {
        wrapper.classList.add('hidden');
    }
    
    // Clear now playing dock
    const dock = document.getElementById('mini-player-dock');
    if (dock) dock.classList.add('hidden');

    window.miniPlayer?.setOpenFlag?.(false);
}

function skipIntro() {
    if (playerService.skipIntro()) {
        showToast('Intro skipped');
    }
}

function skipCredits() {
    const video = getPlayerVideo();
    const anime = getCurrentPlayerAnime();
    if (!video || !anime) return;

    if (playerService.skipOutro()) {
        showToast('Credits skipped');
        // Trigger auto-next if credits were skipped to the end
        if (anime.type === 'anime') {
            triggerAutoNext();
        }
    }
}

let autoNextTimer = null;
let autoNextSeconds = 5;

function triggerAutoNext() {
    const video = getPlayerVideo();
    const anime = getCurrentPlayerAnime();
    if (!video || !anime || anime.type !== 'anime') return;

    // Binge check - after 4 auto-played episodes, show "Still watching?" prompt.
    // The counter increments in playNextEpisode, so bingeCount=3 means 3 next-eps have been auto-triggered.
    const bingeCount = playerService.state.bingeCount || 0;
    if (bingeCount >= 3) {
        showStillWatchingPrompt();
        return;
    }

    const nextEpNum = Number(video.dataset.episodeNumber || 1) + 1;
    if (!isEpisodeAvailable(anime, video.dataset.language || 'sub', nextEpNum)) return;

    const overlay = document.getElementById('auto-next-overlay');
    if (!overlay || !overlay.classList.contains('hidden')) return;
    
    // ... existing auto-next logic ...
    const nextEpObj = getEpisodeObject(anime, nextEpNum);
    const poster = document.getElementById('auto-next-poster');
    const title = document.getElementById('auto-next-title');
    const info = document.getElementById('auto-next-ep-info');
    
    if (poster) poster.src = ensureHttps(anime.banner || anime.image);
    if (title) title.textContent = anime.title;
    if (info) info.textContent = `Episode ${nextEpNum} • ${nextEpObj?.title || 'Next Episode'}`;

    overlay.classList.remove('hidden');
    
    const isBinge = bingeCount >= 1; // Subtle binge styling after just 1 auto-play
    const kicker = document.getElementById('auto-next-kicker');
    const subtitle = document.getElementById('auto-next-subtitle');
    const playBtn = document.getElementById('auto-next-play-btn');
    const cancelBtn = document.getElementById('auto-next-cancel-btn');

    if (kicker) {
        kicker.textContent = isBinge ? '🍿 Binge Mode Activated' : 'Next Episode';
        kicker.classList.toggle('binge-cue', isBinge);
    }
    if (subtitle) subtitle.classList.toggle('hidden', !isBinge);
    if (playBtn) playBtn.querySelector('span').textContent = isBinge ? 'Watch Now' : 'Play Now';
    if (cancelBtn) cancelBtn.querySelector('span').textContent = isBinge ? 'Take a Break' : 'Cancel';

    startAutoNextCountdown();
}

function showStillWatchingPrompt() {
    const overlay = document.getElementById('still-watching-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        playerService.pause();
        if (window.lucide) lucide.createIcons();
    }
}

function confirmStillWatching() {
    const overlay = document.getElementById('still-watching-overlay');
    if (overlay) overlay.classList.add('hidden');
    
    // Reset count and proceed with the normal auto-next flow
    playerService.state.bingeCount = 0;
    triggerAutoNext();
}

function stopWatching() {
    const overlay = document.getElementById('still-watching-overlay');
    if (overlay) overlay.classList.add('hidden');
    
    const anime = playerService.getAnime();
    if (anime) {
        navigate('anime', anime.id);
    } else {
        navigate('home');
    }
}

function startAutoNextCountdown() {
    if (autoNextTimer) clearInterval(autoNextTimer);
    autoNextSeconds = 5;
    updateCountdownUI();

    autoNextTimer = setInterval(() => {
        autoNextSeconds--;
        updateCountdownUI();
        if (autoNextSeconds <= 0) {
            clearInterval(autoNextTimer);
            autoNextTimer = null;
            playNextEpisodeImmediately();
        }
    }, 1000);
}

function updateCountdownUI() {
    const num = document.getElementById('auto-next-number');
    const progress = document.getElementById('auto-next-progress');
    if (num) num.textContent = autoNextSeconds;
    if (progress) {
        const offset = 176 - (176 * (5 - autoNextSeconds) / 5);
        progress.style.strokeDashoffset = offset;
    }
}

function playNextEpisodeImmediately() {
    cancelAutoNext();
    playNextEpisode();
}

function playNextEpisode() {
    const video = document.getElementById('anify-video');
    const anime = playerService.getAnime();
    if (!video || !anime) return;
    
    const nextEp = Number(video.dataset.episodeNumber || 1) + 1;
    if (isEpisodeAvailable(anime, video.dataset.language || 'sub', nextEp)) {
        // Increment binge count
        playerService.state.bingeCount = (playerService.state.bingeCount || 0) + 1;
        
        playerService.selectEpisode(video.dataset.language || 'sub', nextEp);
        if (window.miniPlayer) window.miniPlayer.updateNowPlaying();
        
        // Hide overlay if it was shown
        cancelAutoNext();
    } else {
        showToast("No next episode available.");
    }
}

function cancelAutoNext() {
    if (autoNextTimer) {
        clearInterval(autoNextTimer);
        autoNextTimer = null;
    }
    const overlay = document.getElementById('auto-next-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function toggleMiniPlayerSize() {
    if (!window.miniPlayer) return;
    const player = document.getElementById('anify-persistent-player');
    const sizes = ['small', 'medium', 'large'];
    let current = player.classList.contains('mini-player-large') ? 'large' : 
                  player.classList.contains('mini-player-medium') ? 'medium' : 'small';
    
    let next = sizes[(sizes.indexOf(current) + 1) % sizes.length];
    window.miniPlayer.resize(next);
}

// Track accumulated seek amount for multiple taps
let seekAccumulator = { left: 0, right: 0 };
let seekFeedbackTimeout = null;

function showSeekFeedback(direction, seconds = 5, accumulate = false) {
    const feedbackId = direction === 'backward' ? 'seek-feedback-left' : 'seek-feedback-right';
    const textId = direction === 'backward' ? 'seek-feedback-text-left' : 'seek-feedback-text-right';
    const feedback = document.getElementById(feedbackId);
    const text = document.getElementById(textId);
    
    if (!feedback || !text) return;

    const key = direction === 'backward' ? 'left' : 'right';
    
    if (accumulate) {
        // Accumulate seek amount for multiple taps
        seekAccumulator[key] += seconds;
        
        // Reset opposite side accumulator
        const oppositeKey = direction === 'backward' ? 'right' : 'left';
        seekAccumulator[oppositeKey] = 0;
        
        // Update text with accumulated amount
        text.textContent = `${seekAccumulator[key]} seconds`;
    } else {
        // Show single skip amount (for keyboard shortcuts and buttons)
        text.textContent = `${seconds} seconds`;
    }

    // Re-create icons
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }

    // Hide opposite feedback if showing
    const oppositeFeedbackId = direction === 'backward' ? 'seek-feedback-right' : 'seek-feedback-left';
    const oppositeFeedback = document.getElementById(oppositeFeedbackId);
    if (oppositeFeedback) {
        oppositeFeedback.classList.add('hidden');
    }

    // Show feedback
    feedback.classList.remove('hidden');
    
    // Clear existing timeout if any
    if (seekFeedbackTimeout) {
        clearTimeout(seekFeedbackTimeout);
    }
    
    // Auto-hide after 800ms and reset accumulator
    seekFeedbackTimeout = setTimeout(() => {
        feedback.classList.add('hidden');
        if (accumulate) {
            seekAccumulator[key] = 0;
        }
        seekFeedbackTimeout = null;
    }, 800);
}

// Wrapper functions for skip buttons with feedback
function skipBackwardWithFeedback() {
    playerService.skipBackward(5);
    showSeekFeedback('backward', 5, false);
}

function skipForwardWithFeedback() {
    playerService.skipForward(5);
    showSeekFeedback('forward', 5, false);
}

function setupCustomPlayer() {
    const mount = document.getElementById('persistent-player-mount');
    if (!mount) return;

    // Ensure persistent player exists
    let player = document.getElementById('anify-persistent-player');
    if (!player) {
        player = createPersistentPlayer();
    }

    // Move player to mount if not already there. Re-appending even if already
    // a child can reset the video state in some browsers.
    if (!mount.contains(player)) {
        mount.appendChild(player);
    }
    
    player.classList.remove('mini-player', 'mini-player-medium', 'mini-player-large', 'mini-settings-open');
    player.style.transform = '';
    player.style.width = '100%';
    player.style.height = '100%';

    // The anime id was previously never written onto the video element, which broke
    // getAnime()/getPlayerSource() lookups (used by resume, skip-intro, mini player, etc.).
    const video = playerService.getVideoElement();
    const hashAnimeId = Number((window.location.hash || '').split('/')[2]);
    const previousAnimeId = video ? Number(video.dataset.animeId || 0) : 0;
    const hasLoadedSource = Boolean(video && (video.src || video.currentSrc));
    // If this exact title is already loaded (e.g. the user is maximizing the
    // mini player back to full size), don't let setup() reload the source -
    // that would restart playback instead of continuing where it was.
    const alreadyPlayingThisTitle = hasLoadedSource && hashAnimeId && previousAnimeId === hashAnimeId;

    if (video && hashAnimeId) {
        video.dataset.animeId = String(hashAnimeId);
    }

    if (playerService.setup({ skipRestore: alreadyPlayingThisTitle })) {
        if (video) {
            // Use addEventListener to avoid clobbering playerService internal state listeners.
            // Browser deduplicates these as long as we pass the same function reference.
            video.addEventListener('play', updatePlayerUI);
            video.addEventListener('playing', updatePlayerUI);
            video.addEventListener('pause', updatePlayerUI);
            video.addEventListener('ended', updatePlayerUI);
            video.addEventListener('timeupdate', updatePlayerUI);
            video.addEventListener('loadedmetadata', updatePlayerUI);
            video.addEventListener('volumechange', syncVolumeUI);
            
            // Custom logic for auto-next should also be a stable listener
            if (!window._handleAutoNext) {
                window._handleAutoNext = () => {
                    triggerAutoNext();
                };
            }
            video.removeEventListener('ended', window._handleAutoNext);
            video.addEventListener('ended', window._handleAutoNext);

            // Guest preview tracking - record video watch when playback starts
            if (!window._handleGuestTracking) {
                window._handleGuestTracking = () => {
                    if (guestPreviewService && guestPreviewService.isGuest()) {
                        const animeId = video.dataset.animeId;
                        const episodeId = window.currentEpisode || 1;
                        const result = guestPreviewService.recordVideoWatch(animeId, episodeId);
                        
                        // Save for resume after registration
                        guestPreviewService.saveLastWatched(animeId, episodeId, video.currentTime || 0);
                        
                        // Check if limit reached after this watch
                        console.log('Guest watch recorded:', result);
                        if (!result.canWatchMore) {
                            console.log('Guest limit reached, showing modal');
                            setTimeout(() => showGuestLimitModal(), 500);
                        }
                    }
                };
            }
            video.removeEventListener('play', window._handleGuestTracking);
            video.addEventListener('play', window._handleGuestTracking);

            // Force an immediate UI sync so it doesn't wait for the first event
            updatePlayerUI();
            syncVolumeUI();
        }
    }
    
    // Hide mini player wrapper if we are in full player
    const wrapper = document.getElementById('persistent-player-wrapper');
    if (wrapper) wrapper.classList.add('hidden');
}

function createPersistentPlayer() {
    const div = document.createElement('div');
    div.id = 'anify-persistent-player';
    div.className = 'w-full h-full relative group';
    div.innerHTML = `
        <video id="anify-video" class="w-full h-full object-cover" poster="" preload="metadata" onclick="handlePlayerVideoClick(event)" ondblclick="handlePlayerVideoDoubleClick(event)" ontouchend="handlePlayerVideoTouchEnd(event)"></video>

        <!-- Video Loading Overlay -->
        <div id="video-loading-overlay" class="video-loading-overlay hidden">
            <div class="video-loading-spinner">
                <div class="video-spinner-ring"></div>
                <div class="video-spinner-ring"></div>
                <div class="video-spinner-ring"></div>
            </div>
        </div>

        <!-- Premium Skip Buttons -->
        <button id="skip-intro-btn" class="skip-cue-btn skip-intro-btn hidden" onclick="event.stopPropagation(); skipIntro();">
            <i data-lucide="fast-forward" class="w-5 h-5"></i> Skip Intro [S]
        </button>
        <button id="skip-outro-btn" class="skip-cue-btn skip-outro-btn hidden" onclick="event.stopPropagation(); skipCredits();">
            <i data-lucide="skip-forward" class="w-5 h-5"></i> Skip Credits [S]
        </button>

        <!-- Seek Feedback Overlay - Left Side -->
        <div id="seek-feedback-left" class="seek-feedback seek-feedback-left hidden">
            <div class="seek-feedback-content">
                <div class="seek-feedback-circle">
                    <i data-lucide="rotate-ccw" class="w-6 h-6"></i>
                </div>
                <span class="seek-feedback-text" id="seek-feedback-text-left">5 seconds</span>
            </div>
        </div>

        <!-- Seek Feedback Overlay - Right Side -->
        <div id="seek-feedback-right" class="seek-feedback seek-feedback-right hidden">
            <div class="seek-feedback-content">
                <div class="seek-feedback-circle">
                    <i data-lucide="rotate-cw" class="w-6 h-6"></i>
                </div>
                <span class="seek-feedback-text" id="seek-feedback-text-right">5 seconds</span>
            </div>
        </div>

        <!-- Cinematic Auto-Next Overlay -->
        <div id="auto-next-overlay" class="auto-next-overlay hidden" onclick="event.stopPropagation();">
            <div class="auto-next-content animate-slide-up">
                <p id="auto-next-kicker" class="text-gold-400 font-black uppercase tracking-[0.2em] text-[10px] mb-2">Next Episode</p>
                <p id="auto-next-subtitle" class="auto-next-subtitle hidden">You're on a roll!</p>
                <img id="auto-next-poster" class="auto-next-poster" src="" alt="Next Episode">
                <h3 id="auto-next-title" class="text-2xl font-black text-white mb-1">Anime Title</h3>
                <p id="auto-next-ep-info" class="text-gray-400 font-bold mb-6">Episode 2 • Title</p>
                
                <div class="auto-next-countdown">
                    <svg class="auto-next-circle">
                        <circle class="bg" cx="30" cy="30" r="28"></circle>
                        <circle id="auto-next-progress" class="progress" cx="30" cy="30" r="28"></circle>
                    </svg>
                    <span id="auto-next-number" class="auto-next-number">5</span>
                </div>

                <div class="auto-next-actions">
                    <button id="auto-next-play-btn" class="btn-auto-play" onclick="playNextEpisodeImmediately()">
                        <i data-lucide="play" class="w-4 h-4 fill-current"></i> <span>Play Now [N]</span>
                    </button>
                    <button id="auto-next-cancel-btn" class="btn-auto-cancel" onclick="cancelAutoNext()">
                        <span>Cancel [Esc]</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Still Watching Overlay -->
        <div id="still-watching-overlay" class="auto-next-overlay hidden" onclick="event.stopPropagation();">
            <div class="auto-next-content animate-slide-up">
                <div class="w-16 h-16 bg-gold-400/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-gold-400/20">
                    <i data-lucide="coffee" class="w-8 h-8 text-gold-400"></i>
                </div>
                <h3 class="text-2xl font-black text-white mb-2">Still Watching?</h3>
                <p class="text-gray-400 mb-8 max-w-sm mx-auto">We've been playing for a while. Take a break or continue watching.</p>
                
                <div class="flex flex-col gap-3 max-w-[240px] mx-auto">
                    <button class="btn-auto-play w-full" onclick="confirmStillWatching()">
                        <span>Yes, Keep Watching [K]</span>
                    </button>
                    <button class="btn-auto-cancel w-full" onclick="stopWatching()">
                        <span>I'm Done</span>
                    </button>
                </div>
            </div>
        </div>

        <div class="anime-player-vignette" aria-hidden="true"></div>
        
        <div class="absolute inset-0 flex items-center justify-center" id="play-overlay" onclick="handlePlayerVideoClick(event)">
            <div class="anime-play-core w-20 h-20 rounded-full flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
                <i data-lucide="play" class="w-10 h-10 text-black fill-black ml-1"></i>
            </div>
        </div>
        <div class="mini-mobile-actions mini-only" aria-label="Mini player controls">
            <button type="button" class="mini-mobile-play" onclick="event.stopPropagation(); togglePlay();" aria-label="Play or pause">
                <span id="mini-mobile-play-symbol" aria-hidden="true">▶</span>
            </button>
            <button type="button" class="mini-mobile-close" onclick="event.stopPropagation(); hideMiniPlayer();" aria-label="Close mini player">×</button>
        </div>
        
        <!-- Mini Player Dock Overlay (Hidden in Full) -->
        <div id="mini-player-dock" class="hidden absolute left-full top-0 h-full w-64 ml-4 glass-card rounded-2xl p-4 flex flex-col justify-center gap-3 animate-fade-in">
            <div>
                <p class="text-[10px] font-black text-gold-400 uppercase tracking-widest mb-1">Now Playing</p>
                <h4 id="mini-now-playing-title" class="text-sm font-bold text-white truncate">Anime Title</h4>
                <p id="mini-now-playing-ep" class="text-xs text-gray-500 mb-3">Episode 1</p>
                <div class="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div id="mini-progress-bar" class="h-full bg-gold-400" style="width: 0%"></div>
                </div>
                <p id="mini-time" class="text-[10px] text-gray-500 font-mono">00:00 / 00:00</p>
            </div>
            <button id="mini-dock-cta" class="mini-dock-cta" onclick="event.stopPropagation();">
                <i data-lucide="play" class="w-3 h-3"></i> Continue Watching
            </button>
        </div>

        <!-- Controls -->
        <div class="video-controls" id="video-controls" onclick="event.stopPropagation();">
            <div class="progress-bar" onclick="seekPlayer(event)">
                <div class="timeline-marker timeline-marker--intro" data-timeline-marker="intro" tabindex="0" hidden></div>
                <div class="timeline-marker timeline-marker--outro" data-timeline-marker="outro" tabindex="0" hidden></div>
                <div class="progress-fill" style="width: 0%;" id="progress-bar"></div>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button class="player-control-btn" onclick="skipBackwardWithFeedback()" title="Skip Backward 5 Seconds"><i data-lucide="skip-back" class="w-5 h-5"></i></button>
                    <button class="player-control-btn" onclick="togglePlay()"><i data-lucide="play" class="w-5 h-5" id="player-play-icon"></i></button>
                    <button class="player-control-btn mini-only hidden" onclick="playNextEpisode()" title="Next Episode"><i data-lucide="skip-forward" class="w-4 h-4"></i></button>
                    <button class="player-control-btn" onclick="skipForwardWithFeedback()" title="Skip Forward 5 Seconds"><i data-lucide="skip-forward" class="w-5 h-5"></i></button>
                    <button class="player-control-btn" onclick="togglePlayerMute()"><i data-lucide="volume-2" class="w-5 h-5" id="player-volume-icon"></i></button>
                    <span class="text-xs text-gray-400" id="player-time">0:00 / 0:00</span>
                </div>
                <div class="flex items-center gap-2">
                    <!-- Mini Player Specific Controls -->
                    <button class="player-control-btn hidden mini-only" onclick="toggleMiniPlayerSize()" title="Resize"><i data-lucide="scaling" class="w-4 h-4"></i></button>
                    <button class="player-control-btn hidden mini-only" onclick="playerService.skipIntro()" title="Skip Intro"><i data-lucide="fast-forward" class="w-4 h-4"></i></button>
                    <button class="player-control-btn hidden mini-only" onclick="toggleMiniSettings()" title="Settings"><i data-lucide="settings" class="w-4 h-4"></i></button>
                    <button class="player-control-btn hidden mini-only" onclick="navigate('player', playerService.getVideoElement().dataset.animeId)" title="Restore Full Player"><i data-lucide="maximize-2" class="w-4 h-4"></i></button>
                    <button class="player-control-btn hidden mini-only" onclick="hideMiniPlayer()" title="Close"><i data-lucide="x" class="w-4 h-4"></i></button>

                    <select id="player-speed-select" class="player-select full-only" onchange="setPlayerSpeed(this.value)">
                        <option value="1">1x</option>
                        <option value="0.5">0.5x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                    <select class="player-select full-only" id="player-quality-select" onchange="changePlayerQuality(this.value)">
                        <option value="1080p">1080p</option>
                    </select>
                    <button class="player-control-btn full-only" onclick="togglePlayerFullscreen()"><i data-lucide="maximize" class="w-5 h-5"></i></button>
                </div>
            </div>
        </div>
    `;
    return div;
}

document.addEventListener('DOMContentLoaded', () => {
    // Debug guest preview service on load
    setTimeout(() => {
        if (window.guestPreviewService) {
            console.log('Guest Preview Service loaded');
            console.log('Is guest:', window.guestPreviewService.isGuest());
            console.log('Guest status:', window.guestPreviewService.getPreviewStatus());
        } else {
            console.log('Guest Preview Service NOT loaded');
        }
    }, 1000);

    document.addEventListener('keydown', (event) => {
        // Global shortcuts for Mini Player and Full Player
        const video = document.getElementById('anify-video');
        if (!video) return;

        const isPlayerPage = currentPage === 'player';
        const isMiniActive = !document.getElementById('persistent-player-wrapper').classList.contains('hidden');

        if (!isPlayerPage && !isMiniActive) return;

        // Check if user is typing in an input field - if so, don't trigger video shortcuts
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable ||
            activeElement.getAttribute('contenteditable') === 'true'
        );

        if (isInputFocused) return;

        if (event.code === 'Space') {
            event.preventDefault();
            playerService.togglePlay();
        } else if (event.key && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            playerService.togglePlay();
        } else if (event.key && event.key.toLowerCase() === 'm') {
            event.preventDefault();
            playerService.toggleMute();
        } else if (event.key && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            if (isMiniActive) {
                navigate('player', video.dataset.animeId);
            } else {
                playerService.toggleFullscreen();
            }
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            playerService.skipBackward(5);
            showSeekFeedback('backward', 5, true);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            playerService.skipForward(5);
            showSeekFeedback('forward', 5, true);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const video = playerService.getVideoElement();
            if (video) {
                video.volume = Math.min(1, video.volume + 0.1);
                playerService.syncState();
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            const video = playerService.getVideoElement();
            if (video) {
                video.volume = Math.max(0, video.volume - 0.1);
                playerService.syncState();
            }
        } else if (event.key === 'Escape') {
            if (isMiniActive) {
                hideMiniPlayer();
            }
            const autoNext = document.getElementById('auto-next-overlay');
            if (autoNext && !autoNext.classList.contains('hidden')) {
                cancelAutoNext();
            }
            const stillWatching = document.getElementById('still-watching-overlay');
            if (stillWatching && !stillWatching.classList.contains('hidden')) {
                confirmStillWatching(); // Default to continuing on Escape for safety
            }
        } else if (event.key && event.key.toLowerCase() === 'n') {
            const overlay = document.getElementById('auto-next-overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                playNextEpisodeImmediately();
            }
        } else if (isPlayerPage) {
            // Full player only shortcuts
            if (event.key && (event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 's')) {
                const introBtn = document.getElementById('skip-intro-btn');
                const outroBtn = document.getElementById('skip-outro-btn');
                if (introBtn && !introBtn.classList.contains('hidden')) {
                    skipIntro();
                } else if (outroBtn && !outroBtn.classList.contains('hidden')) {
                    skipCredits();
                }
            } else if (event.ctrlKey && event.key && event.key.toLowerCase() === 'd') {
                event.preventDefault();
                downloadCurrentVideo();
            }
        }
    });
});

// ============ DISCOVERY HUB (Surprise Me) ============
let discoveryFilters = {
    mood: null,
    type: 'any',
    language: 'any',
    minRating: 'any'
};

let discoveryShuffleInterval = null;

function showDiscoveryHub() {
    // Check if user is authenticated
    if (!window.authService || !window.authService.isAuthenticated()) {
        if (window.showToast) {
            showToast('Please sign in to use Surprise Me');
        }
        navigate('login');
        return;
    }

    const modal = document.getElementById('surprise-modal');
    if (!modal) return;

    modal.innerHTML = renderDiscoveryModalContent();
    modal.classList.remove('hidden');
    
    // GSAP Entry
    if (window.gsap) {
        gsap.fromTo("#discovery-content", 
            { y: 50, opacity: 0, scale: 0.9, filter: 'blur(10px)' },
            { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: "power4.out" }
        );
    }
    
    createLucideIconsSafe();
    
    // Backdrop click to close
    modal.onclick = (e) => {
        if (e.target === modal) hideDiscoveryHub();
    };

    // Keyboard listener
    const onKeyDown = (e) => {
        if (modal.classList.contains('hidden')) {
            window.removeEventListener('keydown', onKeyDown);
            return;
        }
        if (e.key === 'Enter') {
            triggerDiscovery('random');
        } else if (e.key === 'Escape') {
            hideDiscoveryHub();
        }
    };
    window.addEventListener('keydown', onKeyDown);
}

function hideDiscoveryHub() {
    const modal = document.getElementById('surprise-modal');
    if (!modal) return;
    
    if (discoveryShuffleInterval) {
        clearInterval(discoveryShuffleInterval);
        discoveryShuffleInterval = null;
    }
    
    if (window.gsap) {
        gsap.to("#discovery-content, #reveal-content", {
            y: 30, opacity: 0, scale: 0.95, duration: 0.3, ease: "power2.in",
            onComplete: () => modal.classList.add('hidden')
        });
    } else {
        modal.classList.add('hidden');
    }
}

function showGuestLimitModal() {
    const modal = document.getElementById('guest-limit-modal');
    if (modal) {
        modal.classList.remove('hidden');
        lucide.createIcons();
    }
}

function closeGuestLimitModal() {
    const modal = document.getElementById('guest-limit-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function renderDiscoveryModalContent() {
    const moods = [
        { id: 'feelgood', label: 'Feel Good', emoji: '😊' },
        { id: 'comedy', label: 'Comedy', emoji: '😂' },
        { id: 'emotional', label: 'Emotional', emoji: '😭' },
        { id: 'horror', label: 'Horror', emoji: '😱' },
        { id: 'action', label: 'Action', emoji: '⚔' },
        { id: 'psychological', label: 'Psychological', emoji: '🧠' },
        { id: 'romance', label: 'Romance', emoji: '❤️' },
        { id: 'fantasy', label: 'Fantasy', emoji: '🌌' }
    ];

    return `
    <div class="discovery-modal relative max-h-[95vh] overflow-y-auto custom-scrollbar" id="discovery-content" onclick="event.stopPropagation()">
        <button onclick="hideDiscoveryHub()" class="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/10 text-gray-500 hover:text-white transition-all z-20">
            <i data-lucide="x" class="w-6 h-6"></i>
        </button>

        <div class="text-center mb-10">
            <span class="text-gold-400 font-bold text-[10px] tracking-[0.4em] uppercase mb-2 block">Discovery Hub</span>
            <h2 class="text-3xl font-black font-['Plus_Jakarta_Sans'] text-black dark:text-white">What are you in the mood for?</h2>
        </div>

        <div class="mood-grid mb-10">
            ${moods.map(m => `
                <button onclick="toggleDiscoveryMood('${m.id}')" id="mood-${m.id}" 
                    class="mood-btn ${discoveryFilters.mood === m.id ? 'active' : ''}">
                    <span class="text-3xl mb-1">${m.emoji}</span>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">${m.label}</span>
                </button>
            `).join('')}
        </div>

        <div class="space-y-6 mb-10">
            <div>
                <p class="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 px-1">Content Type</p>
                <div class="flex flex-wrap gap-2">
                    ${['any', 'series', 'movie'].map(t => `
                        <button onclick="setDiscoveryFilter('type', '${t}')" 
                            class="filter-pill ${discoveryFilters.type === t ? 'active' : ''}">${t.toUpperCase()}</button>
                    `).join('')}
                </div>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <p class="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 px-1">Language</p>
                    <div class="flex gap-2">
                        ${['any', 'sub', 'dub'].map(l => `
                            <button onclick="setDiscoveryFilter('language', '${l}')" 
                                class="filter-pill ${discoveryFilters.language === l ? 'active' : ''}">${l.toUpperCase()}</button>
                        `).join('')}
                    </div>
                </div>
                <div>
                    <p class="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 px-1">Min Rating</p>
                    <div class="flex gap-2">
                        ${['any', '8', '9'].map(r => `
                            <button onclick="setDiscoveryFilter('minRating', '${r}')" 
                                class="filter-pill ${discoveryFilters.minRating === r ? 'active' : ''}">${r === 'any' ? 'ANY' : r + '+'}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
            <button onclick="triggerDiscovery('random')" class="discovery-card-main group">
                <i data-lucide="dices" class="w-8 h-8 text-gold-400 mb-3 mx-auto group-hover:rotate-12 transition-transform"></i>
                <p class="text-xs font-black uppercase tracking-widest text-black dark:text-white">Surprise Me</p>
            </button>
            <button onclick="triggerDiscovery('hidden-gem')" class="discovery-card-main group border-orange-500/20 bg-orange-500/5">
                <i data-lucide="flame" class="w-8 h-8 text-orange-500 mb-3 mx-auto group-hover:scale-110 transition-transform"></i>
                <p class="text-xs font-black uppercase tracking-widest text-black dark:text-white">Hidden Gem</p>
            </button>
            <button onclick="triggerDiscovery('editors-pick')" class="discovery-card-main group border-purple-500/20 bg-purple-500/5">
                <i data-lucide="crown" class="w-8 h-8 text-purple-500 mb-3 mx-auto group-hover:-translate-y-1 transition-transform"></i>
                <p class="text-xs font-black uppercase tracking-widest text-black dark:text-white">Editor's Pick</p>
            </button>
        </div>
    </div>`;
}

function toggleDiscoveryMood(mood) {
    discoveryFilters.mood = discoveryFilters.mood === mood ? null : mood;
    const modal = document.getElementById('surprise-modal');
    if (modal) modal.innerHTML = renderDiscoveryModalContent();
    createLucideIconsSafe();
}

function setDiscoveryFilter(key, value) {
    discoveryFilters[key] = value;
    const modal = document.getElementById('surprise-modal');
    if (modal) modal.innerHTML = renderDiscoveryModalContent();
    createLucideIconsSafe();
}

function triggerDiscovery(mode) {
    const anime = window.surpriseService?.getRecommendation(discoveryFilters, mode);
    
    if (!anime) {
        if (window.showToast) showToast("No anime found with these filters. Try expanding your search!");
        return;
    }

    const modal = document.getElementById('surprise-modal');
    modal.innerHTML = `
        <div class="text-center flex flex-col items-center justify-center min-h-[500px] anim-fade-in" id="shuffle-view">
            <div class="shuffle-container mb-10">
                <img src="${ensureHttps(anime.image)}" class="shuffle-poster animate-shuffle" id="shuffle-poster">
            </div>
            <div class="space-y-4">
                <p class="text-gold-400 font-black uppercase tracking-[0.6em] text-xs">Finding something amazing...</p>
                <div class="flex items-center justify-center gap-6 text-3xl mt-6 text-white/30">
                    <i data-lucide="dices" class="animate-bounce"></i>
                    <i data-lucide="sparkles" class="animate-pulse"></i>
                    <i data-lucide="tv" class="animate-bounce" style="animation-delay: 0.2s"></i>
                    <i data-lucide="popcorn" class="animate-pulse" style="animation-delay: 0.1s"></i>
                </div>
            </div>
        </div>
    `;
    createLucideIconsSafe();

    const posters = animeData.map(a => a.image).filter(Boolean);
    const posterEl = document.getElementById('shuffle-poster');
    let count = 0;
    
    if (discoveryShuffleInterval) clearInterval(discoveryShuffleInterval);
    
    discoveryShuffleInterval = setInterval(() => {
        if (posterEl) posterEl.src = posters[Math.floor(Math.random() * posters.length)];
        count++;
        if (count > 25) {
            clearInterval(discoveryShuffleInterval);
            discoveryShuffleInterval = null;
            if (!modal.classList.contains('hidden')) {
                doDiscoveryReveal(anime);
            }
        }
    }, 80);
}

function doDiscoveryReveal(anime) {
    const modal = document.getElementById('surprise-modal');
    const label = window.surpriseService?.getCollectionLabel(anime) || '✨ Your Surprise Pick';
    
    modal.innerHTML = `
    <div class="discovery-modal relative overflow-hidden p-0 max-w-5xl shadow-[0_0_100px_rgba(0,0,0,0.8)]" id="reveal-content" onclick="event.stopPropagation()">
        <img src="${ensureHttps(anime.banner)}" class="reveal-banner" alt="">
        <div class="reveal-overlay"></div>
        
        <div class="relative z-10 p-8 md:p-16 flex flex-col md:flex-row gap-12 items-center">
            <div class="relative group anim-slide-up">
                <img src="${ensureHttps(anime.image)}" class="w-64 h-96 rounded-2xl object-cover shadow-2xl border border-white/10 group-hover:scale-105 transition-transform duration-500" alt="">
                <div class="absolute -inset-4 bg-gold-400/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
            </div>
            
            <div class="flex-1 text-center md:text-left">
                <div class="anim-slide-up anim-delay-1 mb-6">
                    <span class="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-400 text-black text-[11px] font-black uppercase rounded-full shadow-lg">
                        ${label}
                    </span>
                </div>
                
                <h2 class="text-4xl md:text-6xl font-black font-['Plus_Jakarta_Sans'] leading-[1.1] mb-6 anim-slide-up anim-delay-2 tracking-tight text-black dark:text-white">${anime.title}</h2>
                
                <div class="flex items-center justify-center md:justify-start gap-6 mb-8 anim-slide-up anim-delay-3">
                    <div class="flex text-gold-400 gap-0.5">
                        ${renderStars(anime.rating)}
                    </div>
                    <span class="w-1.5 h-1.5 rounded-full bg-black/10 dark:bg-white/10"></span>
                    <span class="text-gray-500 dark:text-white/50 text-sm font-bold uppercase tracking-widest">${anime.year} • ${anime.studio}</span>
                </div>
                
                <p class="text-gray-700 dark:text-white/60 text-base leading-relaxed mb-10 line-clamp-4 anim-slide-up anim-delay-4 font-medium">${anime.desc}</p>
                
                <div class="flex flex-wrap items-center justify-center md:justify-start gap-5 anim-slide-up anim-delay-5">
                    <button onclick="navigate('player', ${anime.id}); hideDiscoveryHub();" class="btn-cw-resume py-4 px-10">
                        <i data-lucide="play" class="w-6 h-6 fill-current"></i> Watch Now
                    </button>
                    <button onclick="triggerDiscovery('random')" class="btn-cw-remove flex items-center gap-2 w-auto px-8 h-14 border-black/10 dark:border-white/10 hover:border-gold-400/40 text-gray-500 dark:text-white/50 hover:text-black dark:hover:text-white group">
                        <i data-lucide="refresh-cw" class="w-5 h-5 group-hover:rotate-180 transition-transform duration-500"></i> Try Another
                    </button>
                    <button onclick="event.stopPropagation(); toggleWatchlist(${anime.id}); this.querySelector('i').classList.toggle('fill-gold-400'); this.querySelector('i').classList.toggle('text-gold-400')" 
                        class="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-400 dark:text-white/30 hover:text-gold-400 transition-all flex items-center justify-center">
                        <i data-lucide="bookmark" class="w-6 h-6 ${isBookmarked(anime.id) ? 'fill-gold-400 text-gold-400' : ''}"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <button onclick="hideDiscoveryHub()" class="absolute top-6 right-6 z-20 p-2.5 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/10 text-white/40 hover:text-white transition-all shadow-xl">
            <i data-lucide="x" class="w-6 h-6"></i>
        </button>
    </div>`;
    
    createLucideIconsSafe();
    
    if (window.gsap) {
        gsap.from("#reveal-content", { 
            scale: 0.85, 
            autoAlpha: 0, 
            duration: 0.8, 
            ease: "expo.out",
            clearProps: "all"
        });
    }
}

function renderStars(rating) {
    const stars = Math.round(rating / 2);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<i data-lucide="star" class="w-5 h-5 ${i <= stars ? 'fill-gold-400 text-gold-400' : 'text-white/10'}"></i>`;
    }
    return html;
}

// ============ SUPPORT ANIFY MODAL ============

function showSupportModal() {
    const modal = document.getElementById('support-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Pre-fill email if user is logged in
        const userEmail = getCurrentUserEmail();
        if (userEmail) {
            const emailInput = document.getElementById('support-email');
            if (emailInput) emailInput.value = userEmail;
        }
        
        createLucideIconsSafe();
    }
}

function closeSupportModal() {
    const modal = document.getElementById('support-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        
        // Reset form
        selectedAmount = null;
        document.querySelectorAll('.amount-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('custom-amount').value = '';
        document.getElementById('support-error').classList.add('hidden');
        document.getElementById('support-error').textContent = '';
    }
}

function selectAmount(amount) {
    selectedAmount = amount;
    
    // Update UI
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.amount) === amount) {
            btn.classList.add('selected');
        }
    });
    
    // Clear custom amount
    document.getElementById('custom-amount').value = '';
}

function handleCustomAmount(value) {
    if (value) {
        selectedAmount = parseInt(value);
        
        // Remove selection from preset buttons
        document.querySelectorAll('.amount-btn').forEach(btn => btn.classList.remove('selected'));
    }
}

function getCurrentUserEmail() {
    const token = localStorage.getItem('anify-token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.email || null;
        } catch (e) {
            return null;
        }
    }
    return null;
}

async function processDonation() {
    if (isProcessingDonation) return;
    
    const errorDiv = document.getElementById('support-error');
    const supportBtn = document.getElementById('support-btn');
    const emailInput = document.getElementById('support-email');
    
    // Validate amount
    if (!selectedAmount || selectedAmount < 500) {
        errorDiv.textContent = 'Please select an amount of at least ₦500';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Validate email
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Start processing
    isProcessingDonation = true;
    supportBtn.disabled = true;
    supportBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Processing...';
    errorDiv.classList.add('hidden');
    createLucideIconsSafe();
    
    try {
        const response = await fetch('/api/donations/initialize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('anify-token') || ''}`
            },
            body: JSON.stringify({
                amount: selectedAmount,
                email: email
            })
        });
        
        const result = await response.json();
        
        if (result.ok && result.authorization_url) {
            // Redirect to Paystack
            window.location.href = result.authorization_url;
        } else {
            throw new Error(result.error || 'Failed to initialize payment');
        }
    } catch (error) {
        console.error('Donation error:', error);
        errorDiv.textContent = error.message || 'Failed to process donation. Please try again.';
        errorDiv.classList.remove('hidden');
    } finally {
        isProcessingDonation = false;
        supportBtn.disabled = false;
        supportBtn.innerHTML = '<i data-lucide="heart" class="w-5 h-5"></i> <span>Support Anify</span>';
        createLucideIconsSafe();
    }
}

function showSupportSuccessModal(amount, reference) {
    const modal = document.getElementById('support-success-modal');
    if (modal) {
        document.getElementById('success-amount').textContent = `₦${Number(amount).toLocaleString()}`;
        document.getElementById('success-reference').textContent = reference;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        createLucideIconsSafe();
    }
}

function closeSupportSuccessModal() {
    const modal = document.getElementById('support-success-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// Check if returning from successful payment
function checkDonationSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference');
    const supportSuccess = urlParams.get('support');
    
    if (supportSuccess === 'success' && reference) {
        // Verify the donation
        fetch('/api/donations/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reference })
        })
        .then(response => response.json())
        .then(result => {
            if (result.ok && result.donation) {
                showSupportSuccessModal(result.donation.amount, result.donation.reference);
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } else {
                console.error('Donation verification failed:', result.error);
                alert('Payment verification failed. Please contact support if you completed the payment.');
            }
        })
        .catch(error => {
            console.error('Donation verification error:', error);
            alert('Failed to verify donation. Please contact support if you completed the payment.');
        });
    }
}

// Check donation success on page load
document.addEventListener('DOMContentLoaded', checkDonationSuccess);

// ============ DOWNLOAD AUTH MODAL ============

function showDownloadAuthModal() {
    const modal = document.getElementById('download-auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        createLucideIconsSafe();
    } else {
        console.error('Download auth modal element not found!');
    }
}

function closeDownloadAuthModal() {
    const modal = document.getElementById('download-auth-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function handleDownloadAuthSignIn() {
    closeDownloadAuthModal();
    navigate('login');
}

function handleDownloadAuthRegister() {
    closeDownloadAuthModal();
    navigate('register');
}

// Close download auth modal on ESC key
function addDownloadAuthModalListeners() {
    if (downloadAuthModalListenersAdded) return;
    
    // ESC key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('download-auth-modal');
            if (modal && !modal.classList.contains('hidden')) {
                closeDownloadAuthModal();
            }
        }
    });
    
    downloadAuthModalListenersAdded = true;
}

// Add listeners when DOM is ready
document.addEventListener('DOMContentLoaded', addDownloadAuthModalListeners);

// Fetch platform settings
async function fetchPlatformSettings() {
    try {
        const response = await fetch('/api/platform-settings');
        const data = await response.json();
        if (data.ok) {
            supportEnabled = data.supportEnabled === true;
            renderAuthNav();
        }
    } catch (error) {
        console.error('Failed to fetch platform settings:', error);
    }
}

// Listen for platform settings changes
const platformSettingsEventSource = new EventSource('/api/platform-settings/stream');
platformSettingsEventSource.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.supportEnabled !== undefined) {
            supportEnabled = data.supportEnabled === true;
            // Re-render auth nav to show/hide support buttons
            renderAuthNav();
        }
    } catch (error) {
        console.error('Failed to parse platform settings:', error);
    }
};

// Fetch settings on load
fetchPlatformSettings();

// Mobile profile dropdown toggle
let isProfileDropdownOpen = false;

function toggleMobileMenu(forceState) {
    const mobileMenu = document.getElementById('mobile-menu');
    const backdrop = document.getElementById('mobile-menu-backdrop');
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const profileDropdown = document.querySelector('.mobile-profile-dropdown');
    
    if (!mobileMenu) return;

    const isCurrentlyHidden = mobileMenu.classList.contains('hidden');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : isCurrentlyHidden;

    if (shouldOpen) {
        // OPEN MENU
        mobileMenu.classList.remove('hidden');
        if (backdrop) backdrop.classList.remove('hidden');
        if (menuToggle) {
            menuToggle.classList.add('is-active');
            menuToggle.classList.add('trigger-shockwave');
            menuToggle.setAttribute('aria-expanded', 'true');
            menuToggle.setAttribute('aria-label', 'Close navigation menu');
            setTimeout(() => menuToggle.classList.remove('trigger-shockwave'), 600);
        }
        document.body.classList.add('mobile-nav-locked');

        // Sync active route in drawer
        if (typeof currentPage !== 'undefined') {
            mobileMenu.querySelectorAll('[data-nav]').forEach(el => {
                if (el.getAttribute('data-nav') === currentPage) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }

        // Initialize Lucide icons inside mobile menu if any were added dynamically
        if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }

        // Focus first interactive element for accessibility
        const firstFocusable = mobileMenu.querySelector('.anime-drawer-close, .anime-menu-item, button');
        if (firstFocusable) {
            setTimeout(() => firstFocusable.focus(), 120);
        }
    } else {
        // CLOSE MENU
        mobileMenu.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
        if (menuToggle) {
            menuToggle.classList.remove('is-active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Open navigation menu');
        }
        document.body.classList.remove('mobile-nav-locked');
    }

    // Close profile dropdown when opening mobile menu
    if (profileDropdown && shouldOpen) {
        profileDropdown.classList.add('hidden');
        isProfileDropdownOpen = false;
    }
}

function openMobileMenu() {
    toggleMobileMenu(true);
}

function closeMobileMenu() {
    toggleMobileMenu(false);
}

// Close mobile menu when clicking on backdrop
document.addEventListener('click', function(event) {
    const mobileMenu = document.getElementById('mobile-menu');
    const backdrop = document.getElementById('mobile-menu-backdrop');
    
    if (backdrop && !backdrop.classList.contains('hidden')) {
        if (event.target === backdrop) {
            closeMobileMenu();
        }
    }
});

// Close mobile menu on escape key and return focus to toggle
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const mobileMenu = document.getElementById('mobile-menu');
        const menuToggle = document.getElementById('mobile-menu-toggle');
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            closeMobileMenu();
            if (menuToggle) menuToggle.focus();
        }
    }
});

// Toggle profile dropdown for mobile compact view
function toggleProfileDropdown() {
    const profileDropdown = document.querySelector('.mobile-profile-dropdown');
    if (profileDropdown) {
        profileDropdown.classList.toggle('hidden');
        isProfileDropdownOpen = !profileDropdown.classList.contains('hidden');
    }
}
