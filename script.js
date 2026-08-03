// ============ ANIFY - Main Application Script ============

// ============ URL UTILITY - Convert HTTP to HTTPS ============
function ensureHttps(url) {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/^http:/, 'https:');
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
const fallbackGenres = [
    'Action','Adventure','Comedy','Drama','Fantasy','Sci-Fi','Romance','Slice of Life','Mystery','Thriller','Horror','Supernatural','Psychological','Sports','Music','Mecha','Military','Historical','Samurai','Martial Arts','Magic','Isekai','School','Shounen','Shoujo','Seinen','Josei','Ecchi','Harem','Reverse Harem','Idol','Cooking','Medical','Detective','Crime','Police','Spy','Family','Vampire','Demons','Monsters','Space','Survival','Game','Parody','Post-Apocalyptic','Superpower'
];
window.animeData = animeData;
window.categories = categories;

function createLucideIconsSafe() {
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

function applyTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('light', isLight);
    document.documentElement.classList.toggle('dark', !isLight);

    document.querySelectorAll('.theme-icon-sun').forEach((icon) => {
        icon.classList.toggle('hidden', !isLight);
    });
    document.querySelectorAll('.theme-icon-moon').forEach((icon) => {
        icon.classList.toggle('hidden', isLight);
    });
}

function getCurrentTheme() {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

function toggleTheme() {
    const nextTheme = getCurrentTheme() === 'light' ? 'dark' : 'light';
    localStorage.setItem('anify-theme', nextTheme);
    applyTheme(nextTheme);
}

applyTheme(localStorage.getItem('anify-theme') === 'light' ? 'light' : 'dark');

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
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.username || c.userId)}`,
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

function updateCommentsSection() {
    const commentsContainer = document.querySelector('.space-y-3');
    if (!commentsContainer) return;
    
    commentsContainer.innerHTML = comments.map(c => `
        <div class="comment-bubble">
            <div class="flex items-start gap-3">
                <img src="${c.avatar}" class="w-8 h-8 rounded-lg flex-shrink-0" alt="${c.user}">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-sm">${c.user}</span>
                        <span class="text-xs text-gray-500">${c.time}</span>
                        ${c.rating ? `
                            <div class="flex items-center gap-1 ml-2">
                                ${[1, 2, 3, 4, 5].map(star => `
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${star <= c.rating ? 'text-gold-400' : 'text-gray-600'}" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                    </svg>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <p class="text-sm text-gray-300 mt-1">${c.text}</p>
                    <div class="flex items-center gap-4 mt-2">
                        <button class="flex items-center gap-1 text-xs text-gray-500 hover:text-gold-400 transition-colors">
                            <i data-lucide="heart" class="w-3 h-3"></i> ${c.likes}
                        </button>
                        <button class="flex items-center gap-1 text-xs text-gray-500 hover:text-gold-400 transition-colors">
                            <i data-lucide="message-circle" class="w-3 h-3"></i> Reply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
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

function setRating(rating) {
    const ratingInput = document.getElementById('comment-rating');
    if (ratingInput) {
        ratingInput.value = rating;
    }
    updateRatingStars(rating);
}

function updateRatingStars(selectedRating) {
    const stars = document.querySelectorAll('.rating-star');
    stars.forEach((star, index) => {
        const starRating = index + 1;
        const svg = star.querySelector('svg');
        if (svg) {
            if (starRating <= selectedRating) {
                svg.classList.remove('text-gray-600');
                svg.classList.add('text-gold-400');
            } else {
                svg.classList.remove('text-gold-400');
                svg.classList.add('text-gray-600');
            }
        }
    });
}

function resetRatingStars() {
    updateRatingStars(0);
    const ratingInput = document.getElementById('comment-rating');
    if (ratingInput) {
        ratingInput.value = '0';
    }
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

restoreAdminAnimeData();

async function loadAnimeFromApi() {
    if (window.animeManagement && typeof animeManagement.loadAnimeFromApi === 'function') {
        try { return await animeManagement.loadAnimeFromApi(); } catch (e) { console.warn('animeManagement.loadAnimeFromApi failed:', e); }
    }
    try {
        const res = await fetch('/api/anime');
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok && Array.isArray(data.anime)) {
            animeData.splice(0, animeData.length, ...data.anime);
            return true;
        }
    } catch (e) {
        console.warn('Using local anime data:', e.message);
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
        ...[...animeData].sort((a, b) => b.rating - a.rating)
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

    return `<img src="${ensureHttps(anime.banner || anime.image || '')}" class="is-active" alt="${anime.title || ''}" />`;
}

function renderHeroContent(anime) {
    if (!anime) return '';
    
    return `
        <div class="anim-slide-up anim-delay-1 flex items-center gap-2 mb-4">
            ${anime.newEpisode ? '<span class="badge-new">New Episode</span>' : ''}
            ${anime.premium ? '<span class="badge-premium">Premium</span>' : ''}
            <span class="text-xs text-gray-400 font-medium flex items-center gap-1">
                <i data-lucide="star" class="w-3 h-3 fill-gold-400 text-gold-400"></i> ${anime.rating || 0}
            </span>
        </div>
        <h1 class="anim-slide-up anim-delay-2 text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-2">${anime.title || 'Unknown'}</h1>
         <p class="anim-slide-up anim-delay-2 text-gold-400/80 text-sm mb-4">${anime.titleJp || ''}</p>
        <p class="anim-slide-up anim-delay-3 text-gray-300 text-sm md:text-base line-clamp-3 mb-6 max-w-lg">${anime.desc || ''}</p>
        <div class="anim-slide-up anim-delay-3 flex flex-wrap gap-2 mb-6">
            ${Array.isArray(anime.genres) ? anime.genres.map(g => `<span class="category-pill text-xs">${g}</span>`).join('') : ''}
        </div>
        <div class="anim-slide-up anim-delay-4 flex items-center gap-3">
            <button onclick="navigate('player', ${anime.id})" class="btn-primary flex items-center gap-2 text-base px-6 py-3">
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
        const qualities = anime?.movieMedia?.qualities || {};
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
        return `
            <button
                class="episode-selector-card ${isActive ? 'episode-selector-card--active' : ''}"
                data-episode-number="${epNum}"
                aria-label="Episode ${epNum}"
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
    const loading = document.getElementById('loading-screen');

    await ensureGenresReady();
    await loadAnimeFromApi();

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    handleRouteChange(); // Initial route handling
    restoreMiniPlayerFromRefresh(); // Reopen the mini player after a hard refresh, if it was left open

    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }

    // Hide loading screen + show app
    if (loading) loading.style.display = 'none';
    if (app) {
        app.classList.remove('opacity-0');
        app.classList.add('opacity-100');
    }
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
        try { return await uploadService.uploadVideo(file, onProgress); } catch (e) { console.warn('uploadService.uploadVideo failed:', e); }
    }
    return uploadMediaFile(file);
}


document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getCurrentTheme());
    authService.restoreSession();
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

function navigate(page, data, options = {}) {
    const { replace = false } = options;
    let hash = `#/${page}`;
    if (data) {
        hash += `/${data}`;
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

    document.querySelectorAll('[data-nav]').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`[data-nav="${page}"]`).forEach(l => l.classList.add('active'));

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Handle Mini Player Transition
    handleMiniPlayerTransition(page);

    switch (page) {
        case 'home': content.innerHTML = renderHome(); break;
        case 'browse': content.innerHTML = renderBrowse(); break;
        case 'movies': content.innerHTML = renderBrowse('Movie'); break;
        case 'series': content.innerHTML = renderBrowse('Series'); break;
        case 'mylist': content.innerHTML = renderMyList(); break;
        case 'anime': 
            content.innerHTML = renderAnimeDetail(Number(data));
            loadCommentsForAnime(Number(data));
            break;
        case 'player': content.innerHTML = renderPlayer(Number(data)); break;
        case 'login': content.innerHTML = renderLogin(); break;
        case 'register': content.innerHTML = renderRegister(); break;
        case 'profile': content.innerHTML = renderProfile(); break;
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
    const popular = [...animeData].filter(a => a && typeof a === 'object').sort((a, b) => (b?.rating || 0) - (a?.rating || 0)).slice(0, 8);
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
                                <span class="text-xs font-medium">${a.rating}</span>
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
            <img src="${ensureHttps(a.image)}" class="w-full h-full object-cover" alt="${a.title}" loading="lazy">
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
                <span class="text-xs font-bold">${a.rating}</span>
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
                                <span class="text-xs font-bold">${a.averageRating || a.rating || 'N/A'}</span>
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

    const movieSection = ((a.type || 'anime') === 'anime')
        ? `
            <section class="detail-section detail-episodes anim-fade-in">
                <div class="detail-section-head detail-heading-accent">
                    <h2>Episodes</h2>
                    <span>Showing first ${displayedEpisodes} of ${totalEpisodesForLabel}</span>
                </div>
                <div class="detail-episode-grid">
                    ${episodeNumbers.slice(0, 24).map((epNum, i) => `
                        <button onclick="navigate('player', ${a.id})" class="detail-episode-tile ${i === 0 ? 'is-active' : ''}" aria-label="Watch episode ${epNum}">
                            <span>${epNum}</span>
                        </button>
                    `).join('')}
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
                                    <span class="recommend-imdb-badge">${s.rating}</span>
                                </div>
                            </div>
                            <div class="recommend-body">
                                <div class="recommend-title">${s.title}</div>
                                <div class="recommend-meta">${s.year || 'N/A'} • ${s.episodes || 0} eps</div>
                                <div class="recommend-rating">
                                    <i data-lucide="star" class="w-3 h-3 fill-gold-400 text-gold-400"></i>
                                    <span class="text-xs">${s.averageRating || s.rating || 'N/A'}</span>
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

                            <h1 class="hero-title">${a.title}</h1>
                            <div class="hero-native-title">${a.titleJp || ''}</div>
                            <div class="hero-meta-strip">
                                <span class="hero-rating-inline"><i data-lucide="star" class="w-4 h-4"></i> ${a.averageRating || a.rating || 'N/A'}<span>${a.averageRating ? '/5' : '/10'}</span></span>
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
                                <span class="pill-rate">⭐ ${a.rating}/10</span>
                                <span class="pill-rate">IMDb ${(a.rating - 0.3).toFixed(1)}</span>
                                <span class="pill-rate">🍅 ${Math.min(99, Math.max(0, Math.round(75 + (a.rating - 8) * 3)))}%</span>
                            </div>

                            <div class="hero-actions">
                                <button onclick="navigate('player', ${a.id})" class="btn-premium-large">
                                    <i data-lucide="play" class="w-5 h-5"></i> ${watchLabel}
                                </button>

                                <button onclick="toggleWatchlist(${a.id}, { isUserWatchlistAction: true })" class="btn-glass">
                                    <i data-lucide="${inWatchlist ? 'bookmark-check' : 'bookmark'}" class="w-5 h-5 ${inWatchlist ? 'text-gold-400' : ''}"></i>
                                    ${inWatchlist ? 'In List' : 'Add to List'}
                                </button>

                                <button onclick="toggleFavorite(${a.id})" class="btn-glass-heart" aria-label="Favorite" data-favorite-anime-id="${a.id}">
                                    <i data-lucide="heart" class="w-5 h-5 ${isFavorited(a.id) ? 'fill-gold-400 text-gold-400' : ''}"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Right: Info Card -->
                        <aside class="hero-right-col">
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

        <!-- Comments -->
        <div class="mt-12 anim-fade-in">
            <div class="max-w-7xl mx-auto px-4 md:px-8">
                <h2 class="text-2xl font-black mb-4 flex items-center gap-2">
                    <i data-lucide="message-circle" class="w-5 h-5 text-gold-400"></i> Reviews & Comments
                </h2>
                ${getAuthToken() ? `
                <div class="glass-card rounded-2xl p-4 mb-4">
                    <div class="flex items-start gap-3">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Me" class="w-8 h-8 rounded-lg flex-shrink-0" alt="me">
                        <div class="flex-1">
                            <!-- Rating Selector -->
                            <div class="mb-3">
                                <label class="text-xs text-gray-400 mb-1 block">Your Rating (Optional)</label>
                                <div class="flex gap-1" id="rating-selector">
                                    ${[1, 2, 3, 4, 5].map(star => `
                                        <button type="button" class="rating-star text-2xl transition-all hover:scale-110 focus:outline-none" data-rating="${star}" onclick="setRating(${star})">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                            </svg>
                                        </button>
                                    `).join('')}
                                </div>
                                <input type="hidden" id="comment-rating" value="0">
                            </div>
                            <textarea id="comment-input" placeholder="Share your thoughts..." class="w-full bg-transparent border-none outline-none resize-none text-sm" rows="2"></textarea>
                            <div class="flex justify-end mt-2">
                                <button onclick="addComment()" class="btn-primary px-4 py-1.5 text-xs">Post Review</button>
                            </div>
                        </div>
                    </div>
                </div>
                ` : `
                <div class="glass-card rounded-2xl p-6 mb-4 text-center">
                    <div class="flex flex-col items-center gap-3">
                        <i data-lucide="lock" class="w-8 h-8 text-gold-400"></i>
                        <h3 class="font-semibold text-lg">Sign in to review</h3>
                        <p class="text-gray-400 text-sm">You need to be signed in to post reviews and comments.</p>
                        <button onclick="navigate('login')" class="btn-primary px-6 py-2 text-sm">Sign In</button>
                    </div>
                </div>
                `}
                <div class="space-y-3">
                    ${comments.map(c => `
                        <div class="comment-bubble">
                            <div class="flex items-start gap-3">
                                <img src="${c.avatar}" class="w-8 h-8 rounded-lg flex-shrink-0" alt="${c.user}">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-semibold text-sm">${c.user}</span>
                                        <span class="text-xs text-gray-500">${c.time}</span>
                                        ${c.rating ? `
                                            <div class="flex items-center gap-1 ml-2">
                                                ${[1, 2, 3, 4, 5].map(star => `
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${star <= c.rating ? 'text-gold-400' : 'text-gray-600'}" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                                    </svg>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <p class="text-sm text-gray-300 mt-1">${c.text}</p>
                                    <div class="flex items-center gap-4 mt-2">
                                        <button class="flex items-center gap-1 text-xs text-gray-500 hover:text-gold-400 transition-colors">
                                            <i data-lucide="heart" class="w-3 h-3"></i> ${c.likes}
                                        </button>
                                        <button class="flex items-center gap-1 text-xs text-gray-500 hover:text-gold-400 transition-colors">
                                            <i data-lucide="message-circle" class="w-3 h-3"></i> Reply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
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

    // Shell for persistent player
    return `
    <div id="player-view-mount" class="anime-watch-room pt-16 pb-20 min-h-screen">
        <div class="anime-watch-bg" aria-hidden="true"></div>
        <div class="max-w-7xl mx-auto px-3 md:px-5 relative z-10">
            <button onclick="navigate('anime', ${a.id})" class="anime-back flex items-center gap-2 py-3 px-4 text-sm text-gray-300 hover:text-white transition-colors anim-slide-up">
                <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to ${a.title}
            </button>

            <div class="anime-watch-layout flex flex-col lg:flex-row gap-6">
                <div class="flex-1 anim-slide-up anim-delay-1">
                    <!-- Target for persistent player -->
                    <div id="persistent-player-mount" class="video-player-container anime-player-frame aspect-video"></div>

                    <div class="anime-player-meta mt-4 flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <p class="anime-kicker">Now Streaming</p>
                            <h2 class="text-xl md:text-2xl font-black text-white">${a.title}</h2>
                            <div class="flex items-center gap-2 mt-3">
                                <span class="anime-chip uppercase" id="player-mode-label">${contentType === 'anime' ? 'Series' : 'Movie'}</span>
                                <span class="anime-chip" id="player-quality-label">1080p</span>
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
                <div class="w-full lg:w-80 flex-shrink-0 anim-slide-up anim-delay-2">
                    <div class="glass-card rounded-2xl p-4 sticky top-20">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="font-bold flex items-center gap-2 text-white"><i data-lucide="list" class="w-4 h-4 text-gold-400"></i> Episodes</h3>
                        </div>
                        <div class="episode-language-tabs">
                            <button class="episode-language-tab active" data-episode-language="sub" onclick="switchEpisodeLanguage('sub')">Sub</button>
                            <button class="episode-language-tab" data-episode-language="dub" onclick="switchEpisodeLanguage('dub')">Dub</button>
                        </div>
                        <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1" id="episode-list" data-anime-id="${a.id}">
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
    <div class="auth-container">
        <div class="floating-orb w-96 h-96 bg-gold-400 top-1/4 left-1/4" style="animation-delay: 0s;"></div>
        <div class="floating-orb w-64 h-64 bg-purple-500 bottom-1/4 right-1/4" style="animation-delay: 3s;"></div>
        <div class="relative z-10 w-full max-w-md px-4 anim-slide-up">
            <div class="auth-card">
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
    <div class="auth-container">
        <div class="floating-orb w-96 h-96 bg-gold-400 top-1/4 right-1/4" style="animation-delay: 0s;"></div>
        <div class="floating-orb w-64 h-64 bg-blue-500 bottom-1/4 left-1/4" style="animation-delay: 3s;"></div>
        <div class="relative z-10 w-full max-w-md px-4 anim-slide-up">
            <div class="auth-card">
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

// ============ RENDER: PROFILE ============
function renderProfile() {
    const profile = authService.getCurrentUser();

    const username = profile?.username || 'User';
    const displayName = profile?.name || username;
    const userPlan = profile?.plan || 'Free';
    const userStatus = profile?.status || 'Active';
    const avatarSeed = profile?.avatar || username || 'Anify';
    const avatarUrl = avatarSeed.includes('dicebear') || avatarSeed.startsWith('http') ? avatarSeed : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;

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

    const isDarkMode = getCurrentTheme() === 'dark';

    return `
    <div class="pt-24 pb-20 min-h-screen">
        <div class="max-w-4xl mx-auto px-4 md:px-8">
            <!-- Profile Header -->
            <div class="glass-card rounded-3xl overflow-hidden anim-slide-up">
                <div class="h-32 md:h-44 animated-gradient relative">
                    <div class="floating-orb w-48 h-48 bg-gold-400 -top-24 -right-24" style="animation-delay: 1s;"></div>
                </div>
                <div class="px-6 md:px-8 pb-6 -mt-14 relative">
                    <div class="flex items-end gap-4">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-2xl border-4 border-dark-900 shadow-xl" alt="avatar">
                        <div class="mb-1">
                            <h1 class="text-2xl font-black">${displayName}</h1>
                            <p class="text-sm text-gray-500">@${username}${userPlan === 'Premium' ? ' · Premium Member 👑' : ''}${userStatus ? ` · ${userStatus}` : ''}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mt-6">
                        <div class="text-center p-3 rounded-xl bg-white/5">
                            <p class="text-xl font-bold text-gold-400">${watchedCount}</p>
                            <p class="text-xs text-gray-500">Watched</p>
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

// ============ RENDER: ADMIN DASHBOARD ============
function renderAdmin() {
    return (typeof window !== 'undefined' && typeof window.renderAdmin === 'function')
        ? window.renderAdmin()
        : `<div class="pt-24 pb-20 min-h-screen flex items-center justify-center">
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
        case 'movies':
            content.innerHTML = renderAdminMovies();
            bindAdminMoviesActions();
            break;
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

function renderAdminAnime() {
    // Strict separation: Anime Management must show ONLY series.
    // A record is considered an anime series when type === 'anime' (legacy field).
    const list = (Array.isArray(animeData) ? animeData : [])
        .filter(a => (a?.type || 'anime') === 'anime');

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
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
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
                        const avatar = u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
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
        
        // Check if user needs email verification
        if (errorMessage.includes('verify your email') || errorMessage.includes('requiresVerification')) {
            // Store email for verification page
            localStorage.setItem('registerEmail', email);
            // Redirect to verification page
            window.location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
            return;
        }
        
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

        // Store registration data for verification page
        localStorage.setItem('registerEmail', email);
        localStorage.setItem('registerUsername', username);
        localStorage.setItem('registerPassword', password);

        // Store last watched data for resume after registration (guest preview)
        if (guestPreviewService) {
            const lastWatched = guestPreviewService.getLastWatched();
            if (lastWatched) {
                localStorage.setItem('lastWatchedAnime', lastWatched.animeId);
                localStorage.setItem('lastWatchedEpisode', lastWatched.episodeId);
                localStorage.setItem('lastWatchedTime', lastWatched.playbackTime);
            }
        }

        // Redirect to verification page
        window.location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
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
    const seed = profile?.avatar || profile?.username || profile?.name || 'Anify';
    const value = String(seed || 'Anify');
    return value.startsWith('http') || value.includes('dicebear')
        ? value
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(value)}`;
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
                    <button onclick="toggleMobileMenu()" class="mobile-profile-trigger" aria-label="Open profile menu" title="Profile menu">
                        <span class="mobile-profile-avatar mobile-profile-avatar-empty"><i data-lucide="user-round" class="w-5 h-5"></i></span>
                        <i data-lucide="chevron-down" class="mobile-profile-chevron w-4 h-4"></i>
                    </button>
                `;
                return;
            }
            if (variant === 'mobile') {
                el.innerHTML = `
                    <button onclick="navigate('login'); toggleMobileMenu()" class="w-full px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium">
                        <i data-lucide="log-in" class="w-4 h-4 inline-block mr-2"></i> Sign In
                    </button>
                    <button onclick="navigate('register'); toggleMobileMenu()" class="w-full px-3 py-2 rounded-xl bg-gold-400/20 text-gold-400 hover:bg-gold-400/30 transition-all text-sm font-medium">
                        <i data-lucide="user-plus" class="w-4 h-4 inline-block mr-2"></i> Register Now
                    </button>
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
                    <button onclick="toggleMobileMenu()" class="mobile-profile-trigger" aria-label="Open profile menu" title="Profile menu">
                        <img src="${getCurrentAvatarUrl()}" class="mobile-profile-avatar" alt="${getCurrentUsername()}">
                        <i data-lucide="chevron-down" class="mobile-profile-chevron w-4 h-4"></i>
                    </button>
                `;
                return;
            }
            if (variant === 'mobile') {
                el.innerHTML = `
                    <button onclick="navigate('profile'); toggleMobileMenu()" class="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-white/10 transition-all">
                        <img src="${getCurrentAvatarUrl()}" class="w-8 h-8 rounded-lg" alt="avatar">
                        <span class="text-sm font-medium leading-tight">${getCurrentUsername()}</span>
                    </button>
                    <button onclick="signOut(); toggleMobileMenu()" class="w-full px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium">
                        <i data-lucide="log-out" class="w-4 h-4 inline-block mr-2"></i> Sign Out
                    </button>
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

function toggleSearch() {
    const panel = document.getElementById('search-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        document.getElementById('search-input').focus();
    }
}

function toggleNotifications(forceOpen = null) {
    const panel = document.getElementById('notification-panel');
    if (!panel) return;
    const open = forceOpen === null ? !panel.classList.contains('hidden') : Boolean(forceOpen);
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

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
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
        return `
            <div tabindex="0" class="notif-item rounded-2xl p-3 bg-white/5 border border-white/10 ${readClass} focus:outline-none focus:ring-2 focus:ring-gold-400 transition-all">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-dark-700 flex items-center justify-center text-gold-400">
                        <i data-lucide="${notification.icon || 'bell'}" class="w-4 h-4"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <p class="font-semibold text-sm">${notification.title}</p>
                                <p class="text-xs text-gray-500">${notification.type}</p>
                            </div>
                            <button type="button" onclick="markNotificationRead('${notification.id}')" class="text-[10px] uppercase tracking-wider text-gray-400 hover:text-white transition-all">
                                ${notification.read ? 'Read' : 'Mark read'}
                            </button>
                        </div>
                        <p class="text-xs text-gray-300 mt-2">${notification.message}</p>
                        <p class="text-[10px] text-gray-500 mt-2">${timestamp}</p>
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
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';

    const card = document.createElement('div');
    card.id = 'anify-alert';
    card.style.maxWidth = 'min(90vw, 520px)';
    card.style.borderRadius = '0.95rem';
    card.style.background = 'rgba(10, 10, 28, 0.96)';
    card.style.border = '1px solid rgba(251, 191, 36, 0.35)';
    card.style.boxShadow = '0 18px 45px rgba(0, 0, 0, 0.45)';
    card.style.color = 'white';
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
    btn.style.background = 'linear-gradient(135deg, #FBBF24, #F59E0B)';
    btn.style.color = '#000';
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
    if (!query) {
        results.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Start typing to search...</p>';
        return;
    }
    const filtered = animeData.filter(a => (a.title && a.title.toLowerCase().includes(query.toLowerCase())) || (Array.isArray(a.genres) && a.genres.some(g => g && g.toLowerCase().includes(query.toLowerCase()))));
    if (filtered.length === 0) {
        results.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">No results found</p>';
        return;
    }
   results.innerHTML = filtered.slice(0, 5).map(a => `
    <button onclick="navigate('anime', ${a.id})"
        class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-all text-left">

        <img src="${a.image}"
            class="w-12 h-16 rounded-lg object-cover"
            alt="${a.title}">

        <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">${a.title}</p>

            <div class="flex items-center gap-2 mt-1">
                <span class="text-xs text-gray-400">${a.year}</span>

                <span class="text-gray-600">•</span>

                <span class="text-xs text-gold-400 flex items-center gap-1">
                    ⭐ ${a.rating}
                </span>
            </div>

            <p class="text-xs text-gray-500 truncate mt-1">
                ${Array.isArray(a.genres) ? a.genres.join(', ') : 'Unknown'}
            </p>
        </div>

    </button>
`).join('');

lucide.createIcons();
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
        const volumeIcon = document.getElementById('player-volume-icon');
        const overlay = document.getElementById('play-overlay');

        if (!video) return;

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
        if (volumeIcon) volumeIcon.setAttribute('data-lucide', video.muted ? 'volume-x' : 'volume-2');
        
        // Re-render lucide icons to show the updated play/pause and volume icons
        if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }

        const introBtn = document.getElementById('skip-intro-btn');
        const outroBtn = document.getElementById('skip-outro-btn');
        const anime = playerService.getAnime();
        
        if (anime) {
            const epNum = Number(video.dataset.episodeNumber || 1);
            const timing = typeof getTimingConfig === 'function'
                ? getTimingConfig(anime, epNum)
                : { introStart: 0, introEnd: 90, outroStart: 0, outroEnd: 0 };
            const introStart = timing.introStart;
            const introEnd = timing.introEnd;
            const outroStart = timing.outroStart || Math.max(0, video.duration - 120);
            const outroEnd = timing.outroEnd || video.duration;

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
    const video = getPlayerVideo();
    const anime = getCurrentPlayerAnime();
    const url = video?.currentSrc || video?.src;
    if (!url) return alert('No video is available to download yet.');

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
    return playerService.toggleMute();
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
 */
function handlePlayerVideoClick(event) {
    event.stopPropagation();
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
        <video id="anify-video" class="w-full h-full object-cover" poster="" preload="metadata" onclick="handlePlayerVideoClick(event)"></video>

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
                <div class="progress-fill" style="width: 0%;" id="progress-bar"></div>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button class="player-control-btn" onclick="togglePlay()"><i data-lucide="play" class="w-5 h-5" id="player-play-icon"></i></button>
                    <button class="player-control-btn mini-only hidden" onclick="playNextEpisode()" title="Next Episode"><i data-lucide="skip-forward" class="w-4 h-4"></i></button>
                    <button class="player-control-btn" onclick="skipPlayer(10)"><i data-lucide="skip-forward" class="w-5 h-5"></i></button>
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

        if (event.code === 'Space') {
            event.preventDefault();
            playerService.togglePlay();
        } else if (event.key && event.key.toLowerCase() === 'm') {
            playerService.toggleMute();
        } else if (event.key && event.key.toLowerCase() === 'f' && isMiniActive) {
            navigate('player', video.dataset.animeId);
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
        } else if (event.key && event.key.toLowerCase() === 'k') {
            const stillWatching = document.getElementById('still-watching-overlay');
            if (stillWatching && !stillWatching.classList.contains('hidden')) {
                confirmStillWatching();
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
            } else if (event.key && event.key.toLowerCase() === 'f') {
                playerService.toggleFullscreen();
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
