(function (global) {
    'use strict';

    function getEpisodeObject(anime, episodeNumber) {
        const episodesMedia = Array.isArray(anime?.episodesMedia) ? anime.episodesMedia : [];
        return episodesMedia.find(e => Number(e?.episodeNumber) === Number(episodeNumber)) || null;
    }

    function getEpisodeQualitySources(episodeObj, language) {
        const qualities = episodeObj?.[language]?.qualities;
        return qualities && typeof qualities === 'object' ? qualities : {};
    }

    function getEpisodeVideoUrl(episodeObj, language, quality) {
        const qualities = getEpisodeQualitySources(episodeObj, language);
        return qualities?.[quality] || qualities?.['1080p'] || qualities?.['720p'] || '';
    }

    function isEpisodeAvailable(anime, language, episodeNumber) {
        const episodeObj = getEpisodeObject(anime, episodeNumber);
        if (episodeObj) {
            const qualities = getEpisodeQualitySources(episodeObj, language);
            return Object.keys(qualities || {}).some(q => Boolean(qualities?.[q]));
        }
        return episodeNumber === 1 && (animeHasLanguage(anime, language));
    }

    // Resolves the active Skip Intro / Skip Credits timing config.
    // Series use per-episode timestamps (episodesMedia[].introStart/introEnd/outroStart/outroEnd);
    // Fallback to anime-level timestamps, then to hardcoded defaults (90s intro, 0s outro).
    function getTimingConfig(anime, episodeNumber) {
        const fallback = { introStart: 0, introEnd: 90, outroStart: 0, outroEnd: 0 };
        if (!anime) return fallback;
        
        const isSeries = (anime.type || 'anime') === 'anime';
        const epObj = isSeries ? getEpisodeObject(anime, episodeNumber) : null;
        
        // Helper to get number with proper fallbacks
        const getVal = (key) => {
            if (epObj && epObj[key] !== undefined && epObj[key] !== null && epObj[key] !== '') {
                return Number(epObj[key]);
            }
            if (anime[key] !== undefined && anime[key] !== null && anime[key] !== '') {
                return Number(anime[key]);
            }
            return fallback[key];
        };

        return {
            introStart: getVal('introStart'),
            introEnd: getVal('introEnd'),
            outroStart: getVal('outroStart'),
            outroEnd: getVal('outroEnd'),
        };
    }

    function getEpisodeList(anime, language = 'sub') {
        const maxEpisodes = Math.min(anime?.episodes || 1, 24);
        const video = global.getPlayerVideo?.();
        const activeEpisodeNumber = video?.dataset?.episodeNumber ? Number(video.dataset.episodeNumber) : 1;

        return Array.from({ length: maxEpisodes }, (_, i) => {
            const epNum = i + 1;
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

    const episodeManagement = {
        getEpisodeObject,
        getEpisodeQualitySources,
        getEpisodeVideoUrl,
        isEpisodeAvailable,
        getEpisodeList,
        getTimingConfig,
    };

    global.getTimingConfig = getTimingConfig;
    global.episodeManagement = episodeManagement;
})(window);
