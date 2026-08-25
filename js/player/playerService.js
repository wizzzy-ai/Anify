(function (global) {
    'use strict';

    // URL utility to convert HTTP to HTTPS
    function ensureHttps(url) {
        if (!url || typeof url !== 'string') return url;
        return url.replace(/^http:/, 'https:');
    }

    const playerService = {
        state: {
            currentVideo: null,
            currentEpisode: null,
            currentMovie: null,
            currentTime: 0,
            duration: 0,
            isPlaying: false,
            isBuffering: false,
            volume: 1,
            playbackRate: 1,
            fullscreen: false,
            pictureInPicture: false,
            bingeCount: 0,
            isAutoPlayEnabled: true,
        },

        init() {
            this.syncState();
            return this.state;
        },

        syncState() {
            const video = this.getVideoElement();
            if (!video) return this.state;
            this.state.currentTime = Number(video.currentTime) || 0;
            this.state.duration = Number(video.duration) || 0;
            this.state.isPlaying = !video.paused;
            this.state.volume = Number(video.volume) || 1;
            this.state.playbackRate = Number(video.playbackRate) || 1;
            this.state.fullscreen = Boolean(document.fullscreenElement);
            this.state.pictureInPicture = Boolean(document.pictureInPictureElement);
            return this.state;
        },

        getVideoElement() {
            return document.getElementById('anify-video');
        },

        getAnime() {
            const video = this.getVideoElement();
            const id = Number(video?.dataset?.animeId || 0);
            return global.animeData?.find(a => a.id === id) || null;
        },

        getPlayerSource(language, quality) {
            const anime = this.getAnime();
            if (!anime) {
                console.warn('[Player] No anime found');
                return '';
            }
            
            if ((anime?.type || 'anime') !== 'anime') {
                const movieQualities = anime?.movieMedia?.qualities || {};
                // Compatibility fallback for movies uploaded through the old
                // episode-1 form before movieMedia was populated.
                const episodeQualities = anime?.episodesMedia?.[0]?.sub?.qualities || {};
                const qualities = Object.keys(movieQualities).length ? movieQualities : episodeQualities;
                const url = qualities?.[quality] || qualities?.['1080p'] || qualities?.['720p'] || '';
                console.log('[Player] Movie source:', { quality, url, availableQualities: Object.keys(qualities) });
                return url;
            }

            const video = this.getVideoElement();
            const selectedEpisode = Number(video?.dataset?.episodeNumber || 1);
            const episodeObj = global.getEpisodeObject?.(anime, selectedEpisode);
            
            console.log('[Player] Episode lookup:', { selectedEpisode, episodeObj, language, quality });
            
            if (episodeObj) {
                const epUrl = global.getEpisodeVideoUrl?.(episodeObj, language, quality);
                console.log('[Player] Episode URL from helper:', epUrl);
                if (epUrl) return epUrl;
            }

            const sources = global.getAnimeVideoSources?.(anime) || { sub: {}, dub: {} };
            const fallbackUrl = sources[language]?.[quality] || sources[language]?.['1080p'] || sources[language]?.['720p'] || '';
            console.log('[Player] Fallback source:', { language, quality, fallbackUrl, sources });
            return fallbackUrl;
        },

        updatePoster() {
            const video = this.getVideoElement();
            const anime = this.getAnime();
            if (!video || !anime) return;

            const epNum = Number(video.dataset.episodeNumber || 1);
            const epObj = global.getEpisodeObject?.(anime, epNum);
            
            // Priority: Episode Thumbnail -> Anime Banner -> Anime Image
            const posterUrl = ensureHttps(epObj?.thumbnail || anime.banner || anime.image || '');
            if (posterUrl) {
                video.setAttribute('poster', posterUrl);
            }
            this.updateViewCountDisplay();
        },

        setPlayerSource(language, quality) {
            const video = this.getVideoElement();
            const source = this.getPlayerSource(language, quality);
            if (!video || !source) return false;

            const wasPlaying = this.state.isPlaying;
            const currentTime = video.currentTime;
            video.src = source;
            video.dataset.language = language;
            video.dataset.quality = quality;
            
            this.updatePoster(); // Update poster when source changes
            
            video.load(); // Start loading the new source

            const onCanPlay = () => {
                // Only re-apply the captured time when it's a real mid-playback
                // switch (e.g. changing language/quality). On a fresh load,
                // currentTime is 0 here, and 'loadedmetadata' (which fires
                // before 'canplay') already seeks to the saved Continue
                // Watching position - forcing it back to 0 would undo that.
                if (currentTime > 0.5) {
                    video.currentTime = currentTime;
                }
                if (wasPlaying) {
                    playerService.play();
                }
                // Remove the event listener so it doesn't fire again
                video.removeEventListener('canplay', onCanPlay);
            };
            video.addEventListener('canplay', onCanPlay);

            const modeLabel = document.getElementById('player-mode-label'); // This can be moved up
            const qualityLabel = document.getElementById('player-quality-label');
            if (modeLabel) modeLabel.textContent = language.toUpperCase();
            if (qualityLabel) qualityLabel.textContent = quality;
            this.syncState();
            return true;
        },

        play() {
            const video = this.getVideoElement();
            if (!video) {
                console.error('[Player] No video element found');
                return false;
            }
            
            console.log('[Player] Attempting to play video:', { 
                src: video.src, 
                currentSrc: video.currentSrc,
                readyState: video.readyState,
                networkState: video.networkState 
            });
            
            if (!video.src && !video.currentSrc) {
                console.error('[Player] No video source set');
                return false;
            }
            
            return video.play()
                .then(() => {
                    console.log('[Player] Video playing successfully');
                    this.syncState();
                    return true;
                })
                .catch(e => {
                    if (e.name !== 'AbortError') {
                        console.error('[Player] Video play failed:', e.name, e.message, {
                            src: video.src,
                            currentSrc: video.currentSrc,
                            readyState: video.readyState,
                            networkState: video.networkState,
                            error: video.error
                        });
                    }
                    return false;
                });
        },

        pause() {
            const video = this.getVideoElement();
            if (!video) return false;
            video.pause();
            this.syncState();
            return true;
        },

        resume() {
            return this.play();
        },

        stop() {
            const video = this.getVideoElement();
            if (!video) return false;
            video.pause();
            video.currentTime = 0;
            this.syncState();
            return true;
        },

        togglePlay() {
            const video = this.getVideoElement();
            if (!video) return false;
            if (video.paused) {
                this.play();
            } else {
                this.pause();
            }
            return true;
        },

        toggleMute() {
            const video = this.getVideoElement();
            if (!video) return false;
            video.muted = !video.muted;
            this.syncState();
            // Trigger UI sync
            if (typeof syncVolumeUI === 'function') {
                syncVolumeUI();
            }
            return true;
        },

        setVolume(value) {
            const video = this.getVideoElement();
            if (!video) return false;
            video.volume = Math.max(0, Math.min(1, Number(value) || 1));
            this.syncState();
            // Trigger UI sync
            if (typeof syncVolumeUI === 'function') {
                syncVolumeUI();
            }
            return true;
        },

        setPlaybackRate(value) {
            const video = this.getVideoElement();
            if (!video) return false;
            video.playbackRate = Number(value) || 1;
            this.syncState();
            return true;
        },

        toggleFullscreen() {
            const player = document.getElementById('anify-persistent-player');
            if (!player) return false;

            if (document.fullscreenElement) {
                document.exitFullscreen?.();
            } else {
                player.requestFullscreen?.();
            }
            this.syncState();
            return true;
        },

        seek(seconds) {
            const video = this.getVideoElement();
            if (!video || !video.duration) return false;
            video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + seconds));
            this.syncState();
            return true;
        },

        skipForward(seconds = 5) {
            const video = this.getVideoElement();
            if (!video || !Number.isFinite(video.duration)) return false;
            video.currentTime = Math.min(video.duration, video.currentTime + seconds);
            this.syncState();
            return true;
        },

        skipBackward(seconds = 5) {
            const video = this.getVideoElement();
            if (!video) return false;
            video.currentTime = Math.max(0, video.currentTime - seconds);
            this.syncState();
            return true;
        },

        seekToRatio(ratio) {
            const video = this.getVideoElement();
            if (!video || !video.duration) return false;
            video.currentTime = ratio * video.duration;
            this.syncState();
            return true;
        },

        skipIntro() {
            const video = this.getVideoElement();
            const anime = this.getAnime();
            if (!video || !anime) return false;
            const epNum = Number(video.dataset.episodeNumber || 1);
            const timing = global.getTimingConfig?.(anime, epNum);
            const skipTo = Number(timing?.introEnd || anime.introEnd || 90);
            video.currentTime = skipTo;
            this.syncState();
            return true;
        },

        skipOutro() {
            const video = this.getVideoElement();
            const anime = this.getAnime();
            if (!video || !anime) return false;
            const epNum = Number(video.dataset.episodeNumber || 1);
            const timing = global.getTimingConfig?.(anime, epNum);
            const outroEnd = Number(timing?.outroEnd || anime.outroEnd || 0);

            // If outroEnd is defined, skip to it, else trigger completion logic
            if (outroEnd) {
                video.currentTime = outroEnd;
            } else {
                video.currentTime = Math.max(0, video.duration - 1);
            }
            this.syncState();
            return true;
        },

        refreshQualityOptions(language) {
            const anime = this.getAnime();
            const qualitySelect = document.getElementById('player-quality-select');
            if (!anime || !qualitySelect) return '1080p';
            if ((anime?.type || 'anime') !== 'anime') {
                const qualitiesObj = anime?.movieMedia?.qualities || {};
                const qualities = Object.keys(qualitiesObj).sort((a, b) => parseInt(b) - parseInt(a));
                qualitySelect.innerHTML = qualities.map(q => `<option value="${q}">${q}</option>`).join('') || '<option value="1080p">1080p</option>';
                return qualities[0] || '1080p';
            }
            const qualities = Object.keys(global.getAnimeVideoSources?.(anime)[language] || {}).sort((a, b) => parseInt(b) - parseInt(a));
            qualitySelect.innerHTML = qualities.map(q => `<option value="${q}">${q}</option>`).join('') || '<option value="1080p">1080p</option>';
            return qualities[0] || '1080p';
        },

        changeLanguage(language) {
            const video = this.getVideoElement();
            const anime = this.getAnime();
            if ((anime?.type || 'anime') !== 'anime') return false;
            const currentEpisodeNumber = Number(video?.dataset?.episodeNumber || 1);
            const epObj = global.getEpisodeObject?.(anime, currentEpisodeNumber);
            const qualities = epObj ? Object.keys(global.getEpisodeQualitySources?.(epObj, language) || {}).sort((a, b) => parseInt(b) - parseInt(a)) : [];
            const quality = qualities[0] || this.refreshQualityOptions(language);
            if (epObj && qualities.length) {
                const selectedVideoUrl = global.getEpisodeVideoUrl?.(epObj, language, quality);
                if (selectedVideoUrl && video) {
                    const wasPlaying = this.state.isPlaying;
                    const currentTime = video.currentTime;
                    // The following line was causing a syntax error.
                    // The logic is now handled correctly by setPlayerSource.
                    // Let's call setPlayerSource directly.
                    video.src = selectedVideoUrl;
                    video.dataset.language = language;
                    video.dataset.quality = quality;
                    
                    this.updatePoster(); // Update poster
                    
                    video.load();
                    video.currentTime = Math.min(currentTime || 0, 2);
                    if (wasPlaying) this.play();
                    this.syncState();
                }
            } else {
                this.setPlayerSource(language, quality);
            }
            this.setActiveEpisodeLanguage(language);
            const list = document.getElementById('episode-list');
            if (anime && list) {
                list.innerHTML = global.renderEpisodeList?.(anime, language) || '';
                if (global.lucide?.createIcons) global.lucide.createIcons();
            }
            return true;
        },

        changeQuality(quality) {
            const video = this.getVideoElement();
            const language = video?.dataset?.language || 'sub';
            return this.setPlayerSource(language, quality);
        },

        setActiveEpisodeLanguage(language) {
            document.querySelectorAll('[data-episode-language]').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.episodeLanguage === language);
            });
        },

        switchEpisodeLanguage(language) {
            const list = document.getElementById('episode-list');
            const anime = this.getAnime();
            if (!list || !anime || !global.animeHasLanguage?.(anime, language)) return false;
            list.innerHTML = global.renderEpisodeList?.(anime, language) || '';
            this.setActiveEpisodeLanguage(language);
            const quality = this.refreshQualityOptions(language);
            this.setPlayerSource(language, quality);
            if (global.lucide?.createIcons) global.lucide.createIcons();
            return true;
        },

        selectEpisode(language, episodeNumber = 1) {
            const anime = this.getAnime();
            if (!anime) return false;
            const videoBefore = this.getVideoElement();
            if (videoBefore) videoBefore.dataset.episodeNumber = String(episodeNumber);
            const selectedEpisode = Number(episodeNumber) || 1;
            const episodeObj = global.getEpisodeObject?.(anime, selectedEpisode);
            if (!global.isEpisodeAvailable?.(anime, language, selectedEpisode)) {
                if (global.showToast) global.showToast(`Episode ${selectedEpisode} is not available in ${language.toUpperCase()} yet.`);
                return false;
            }
            const video = this.getVideoElement();
            const qualitySelect = document.getElementById('player-quality-select');
            const requestedQuality = qualitySelect?.value || '1080p';
            const qualities = Object.keys(global.getEpisodeQualitySources?.(episodeObj, language) || {}).sort((a, b) => parseInt(b) - parseInt(a));
            const fallbackQuality = qualities[0] || requestedQuality || '1080p';
            const chosenQuality = requestedQuality && qualities.includes(requestedQuality) ? requestedQuality : fallbackQuality;
            const selectedVideoUrl = global.getEpisodeVideoUrl?.(episodeObj, language, chosenQuality);
            if (video && selectedVideoUrl) { // The issue was likely here
                const wasPlaying = this.state.isPlaying;
                const currentTime = video.currentTime;
                video.src = selectedVideoUrl;
                video.dataset.language = language;
                video.dataset.quality = chosenQuality;
                
                this.updatePoster(); // Update poster when source changes
                
                video.load();
                video.currentTime = Math.min(currentTime || 0, 2);
                if (wasPlaying) this.play();
            } else {
                this.setPlayerSource(language, chosenQuality);
            }
            
            // Re-render episode list to update active state
            const list = document.getElementById('episode-list');
            if (anime && list) {
                list.innerHTML = global.renderEpisodeList?.(anime, language) || '';
                if (global.lucide?.createIcons) global.lucide.createIcons();
            }
            
            return true;
        },

        attachEvents() {
            const video = this.getVideoElement();
            if (!video) return;

            // Define listeners once and reuse the references so addEventListener deduplicates
            if (!this._handlePlay) {
                this._handlePlay = () => {
                    this.state.isPlaying = true;
                    this.syncState();
                    this.hideLoader();
                };
                this._handlePause = () => {
                    this.state.isPlaying = false;
                    this.syncState();
                };
                this._handleEnded = () => {
                    this.state.isPlaying = false;
                    this.syncState();
                    this.hideLoader();
                };
                this._handleSeeking = () => {
                    this.syncState();
                    this.showLoader();
                };
                this._handleTimeUpdate = () => {
                    this.syncState();
                    this.saveProgress();
                    this.updateViewTracking();
                };
                this._handleLoadedMetadata = () => {
                    this.syncState();
                    this.resetViewTracker();
                    this.updateViewCountDisplay();
                    const resume = global.continueWatchingService?.getEntry?.(Number(video.dataset.animeId || 0));
                    if (resume?.time && video.duration && resume.time < video.duration - 5) {
                        video.currentTime = resume.time;
                    }
                };
                // Loading state handlers
                this._handleLoadStart = () => this.showLoader();
                this._handleWaiting = () => this.showLoader();
                this._handleStalled = () => this.showLoader();
                this._handleCanPlay = () => this.hideLoader();
                this._handleSeeked = () => this.hideLoader();
                this._handleError = () => this.hideLoader();
            }

            video.addEventListener('play', this._handlePlay);
            video.addEventListener('pause', this._handlePause);
            video.addEventListener('ended', this._handleEnded);
            video.addEventListener('seeking', this._handleSeeking);
            video.addEventListener('timeupdate', this._handleTimeUpdate);
            video.addEventListener('loadedmetadata', this._handleLoadedMetadata);
            // Loading state events
            video.addEventListener('loadstart', this._handleLoadStart);
            video.addEventListener('waiting', this._handleWaiting);
            video.addEventListener('stalled', this._handleStalled);
            video.addEventListener('canplay', this._handleCanPlay);
            video.addEventListener('seeked', this._handleSeeked);
            video.addEventListener('error', this._handleError);
        },

        showLoader() {
            const loader = document.getElementById('video-loading-overlay');
            if (loader) {
                loader.classList.remove('hidden');
            }
        },

        hideLoader() {
            const loader = document.getElementById('video-loading-overlay');
            if (loader) {
                loader.classList.add('hidden');
            }
        },

        saveProgress() {
            const video = this.getVideoElement();
            const anime = this.getAnime();
            if (!video || !anime || !video.duration || video.currentTime < 1) return null;

            const progress = Math.min(100, (video.currentTime / video.duration) * 100);
            const remainingSeconds = Math.max(0, video.duration - video.currentTime);
            const epNum = Number(video.dataset.episodeNumber || 1);
            
            const episodeObj = global.getEpisodeObject?.(anime, epNum);
            const epTitle = episodeObj?.title || '';

            const entry = {
                id: anime.id,
                episode: epNum,
                episodeTitle: epTitle,
                progress: Math.round(progress),
                time: Math.round(video.currentTime),
                duration: Math.round(video.duration),
                remainingTime: Math.round(remainingSeconds / 60), // In minutes
                language: video.dataset.language || 'sub',
                quality: video.dataset.quality || '1080p',
                updatedAt: Date.now(),
            };

            // Completion Logic (95%)
            if (progress > 95) {
                this.handleEpisodeCompletion(anime, epNum, entry);
                return null;
            }

            if (global.continueWatchingService?.update) {
                // Throttle local updates to every 5 seconds
                if (!this.saveProgress.lastLocalSync || Date.now() - this.saveProgress.lastLocalSync > 5000) {
                    this.saveProgress.lastLocalSync = Date.now();
                    global.continueWatchingService.update(entry);
                    if (global.continueWatchingService?.getEntries) {
                        global.continueWatching = global.continueWatchingService.getEntries();
                    }
                }
            }

            if (!this.saveProgress.lastSync || Date.now() - this.saveProgress.lastSync > 10000) {
                this.saveProgress.lastSync = Date.now();
                if (global.saveWatchProgressToApi) global.saveWatchProgressToApi(entry);
            }
            return entry;
        },

        handleEpisodeCompletion(anime, epNum, entry) {
            // Remove from Continue Watching
            if (global.continueWatchingService?.remove) {
                global.continueWatchingService.remove(anime.id);
            }

            // Add to Watch History
            if (global.addToWatchHistory) {
                global.addToWatchHistory(anime.id, epNum);
            }

            // Check for next episode
            const nextEpNum = epNum + 1;
            const hasNext = global.isEpisodeAvailable?.(anime, entry.language, nextEpNum);

            if (hasNext) {
                const nextEpObj = global.getEpisodeObject?.(anime, nextEpNum);
                const nextEntry = {
                    ...entry,
                    episode: nextEpNum,
                    episodeTitle: nextEpObj?.title || '',
                    progress: 0,
                    time: 0,
                    updatedAt: Date.now()
                };
                if (global.continueWatchingService?.update) {
                    global.continueWatchingService.update(nextEntry);
                }
            }

            if (global.continueWatchingService?.getEntries) {
                global.continueWatching = global.continueWatchingService.getEntries();
            }
        },

        restoreProgress() {
            const video = this.getVideoElement();
            if (!video) return false;
            
            const animeId = Number(video.dataset.animeId);
            let resume = null;
            
            // Check if we have a context from Resume button
            if (window.resumeContext && Number(window.resumeContext.animeId) === animeId) {
                resume = window.resumeContext;
                window.resumeContext = null; // Clear it
            } else {
                resume = global.continueWatchingService?.getEntry?.(animeId);
            }
            const anime = this.getAnime();
            const isMovie = anime?.type && anime.type !== 'anime';
            let resumeEpisode = 1;

            if (isMovie) {
                resumeEpisode = 1;
                // For movies, there's only one source. Load it directly.
                const movieQualities = anime?.movieMedia?.qualities || {};
                const episodeQualities = anime?.episodesMedia?.[0]?.sub?.qualities || {};
                const qualities = Object.keys(movieQualities).length ? movieQualities : episodeQualities;
                const quality = Object.keys(qualities)[0] || '1080p';
                this.setPlayerSource('sub', quality); // Language is irrelevant for movies
            } else {
                resumeEpisode = Number(resume?.episode || 1); // For series, use saved episode
            }
            video.dataset.episodeNumber = String(resumeEpisode);
            if (resume?.language && resume?.quality && !isMovie) {
                if (this.getPlayerSource(resume.language, resume.quality)) {
                    this.setPlayerSource(resume.language, resume.quality);
                    this.setActiveEpisodeLanguage(resume.language);
                }
            }
            
            // Re-render episode list to update active state when resuming
            const list = document.getElementById('episode-list');
            if (anime && list && !isMovie) {
                const language = resume?.language || 'sub';
                list.innerHTML = global.renderEpisodeList?.(anime, language) || '';
                if (global.lucide?.createIcons) global.lucide.createIcons();
            }
            
            return Boolean(resume);
        },

        viewTracker: {
            animeId: null,
            episodeNumber: null,
            accumulatedTime: 0,
            lastPlaybackTime: 0,
            hasTriggeredView: false,
        },

        resetViewTracker() {
            const video = this.getVideoElement();
            const animeId = video?.dataset?.animeId ? String(video.dataset.animeId) : null;
            const episodeNumber = video?.dataset?.episodeNumber ? Number(video.dataset.episodeNumber) : 1;
            this.viewTracker = {
                animeId,
                episodeNumber,
                accumulatedTime: 0,
                lastPlaybackTime: video?.currentTime || 0,
                hasTriggeredView: false,
            };
        },

        updateViewTracking() {
            const video = this.getVideoElement();
            if (!video || !video.duration || video.paused || this.viewTracker.hasTriggeredView) return;

            const currentAnimeId = video.dataset.animeId ? String(video.dataset.animeId) : null;
            const currentEpNum = video.dataset.episodeNumber ? Number(video.dataset.episodeNumber) : 1;

            // If anime or episode switched, reset tracker
            if (this.viewTracker.animeId !== currentAnimeId || this.viewTracker.episodeNumber !== currentEpNum) {
                this.resetViewTracker();
                return;
            }

            const nowTime = video.currentTime;
            const delta = nowTime - (this.viewTracker.lastPlaybackTime || 0);

            // Only accumulate if playing naturally (not seeking forward 100s)
            if (delta > 0 && delta < 2.5) {
                this.viewTracker.accumulatedTime += delta;
            }
            this.viewTracker.lastPlaybackTime = nowTime;

            const duration = video.duration || 0;
            // Threshold: Math.min(30, duration * 0.10) as specified
            const threshold = Math.min(30, duration * 0.10);

            // Debug logging
            console.log('[VIEW TRACKER]', {
                episode: currentEpNum,
                animeId: currentAnimeId,
                playback: `${this.viewTracker.accumulatedTime.toFixed(1)}s`,
                required: `${threshold.toFixed(1)}s`,
                progress: `${((this.viewTracker.accumulatedTime / threshold) * 100).toFixed(0)}%`
            });

            if (this.viewTracker.accumulatedTime >= threshold) {
                console.log('[VIEW TRACKER] Threshold reached - Sending view request');
                this.viewTracker.hasTriggeredView = true;
                this.recordEpisodeView(currentAnimeId, currentEpNum);
            }
        },

        async recordEpisodeView(animeId, episodeNumber) {
            if (!animeId) return;
            try {
                console.log('[VIEW TRACKER] Sending POST request for view count');
                
                // Privacy-conscious guest session identifier
                let guestSession = global.localStorage?.getItem('anify_viewer_session');
                if (!guestSession) {
                    guestSession = 'vs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
                    try { global.localStorage?.setItem('anify_viewer_session', guestSession); } catch(e){}
                }

                const token = global.authService && typeof global.authService.getToken === 'function'
                    ? global.authService.getToken()
                    : (global.localStorage?.getItem('anify-token') || null);

                const headers = {
                    'Content-Type': 'application/json',
                    'X-Viewer-Session': guestSession,
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const res = await fetch(`/api/anime/${animeId}/episodes/${episodeNumber}/view`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ animeId, episodeNumber }),
                });

                const data = await res.json().catch(() => ({}));
                console.log('[VIEW TRACKER] Server response:', { status: res.status, data });

                if (res.ok && data.ok) {
                    const views = data.views;
                    const counted = data.counted;
                    const cooldown = data.cooldown;

                    console.log('[VIEW TRACKER] View recorded - New count:', views, 'Counted:', counted, 'Cooldown:', cooldown);
                    
                    // Update in-memory anime data
                    const anime = (global.animeData || []).find(a => String(a.id) === String(animeId) || String(a.clientId) === String(animeId));
                    if (anime) {
                        if (Array.isArray(anime.episodesMedia)) {
                            const ep = anime.episodesMedia.find(e => Number(e.episodeNumber) === Number(episodeNumber));
                            if (ep) {
                                ep.views = views;
                                console.log('[VIEW TRACKER] Updated episode views in memory:', views);
                            }
                        }
                        anime.views = views; // Use the server-returned value
                        try {
                            global.localStorage?.setItem('anify-cached-anime', JSON.stringify(global.animeData));
                        } catch (e) {}
                    }

                    // Update all view count elements on the page
                    this.updateAllViewCountElements(animeId, episodeNumber, views);
                } else {
                    console.warn('[VIEW TRACKER] Server rejected view:', { status: res.status, data });
                }
            } catch (error) {
                console.error('[VIEW TRACKER] Failed to record view:', error);
            }
        },

        updateAllViewCountElements(animeId, episodeNumber, views) {
            console.log('[VIEW TRACKER] Updating all view count elements to:', views);
            
            // Update the main episode view counter in player
            const viewCounter = document.getElementById('current-episode-views');
            if (viewCounter && typeof global.formatViewCount === 'function') {
                viewCounter.textContent = global.formatViewCount(views);
                console.log('[VIEW TRACKER] Updated current-episode-views element');
            }

            // Update player view count chip (contains the icon and view count)
            const chip = document.getElementById('player-view-count');
            if (chip) {
                chip.classList.remove('hidden');
                // The view count is inside a span within the chip
                const chipViewSpan = chip.querySelector('#current-episode-views');
                if (chipViewSpan && typeof global.formatViewCount === 'function') {
                    chipViewSpan.textContent = global.formatViewCount(views);
                }
                console.log('[VIEW TRACKER] Updated player-view-count chip');
            }

            // Update episode selector cards if they have view count displays
            const episodeSelector = document.querySelector(`[data-episode-number="${episodeNumber}"]`);
            if (episodeSelector) {
                // Update aria-label and title attributes with new view count
                const formattedViews = typeof global.formatViewCount === 'function' ? global.formatViewCount(views) : views;
                episodeSelector.setAttribute('aria-label', `Episode ${episodeNumber} (${formattedViews})`);
                episodeSelector.setAttribute('title', `Episode ${episodeNumber} • ${formattedViews}`);
                console.log('[VIEW TRACKER] Updated episode selector attributes');
            }

            console.log('[VIEW TRACKER] View count update complete');
        },

        updateViewCountDisplay() {
            const video = this.getVideoElement();
            const anime = this.getAnime();
            if (!video || !anime) return;

            const isMovie = (anime?.type || 'anime') !== 'anime';
            const epNum = isMovie ? 1 : Number(video.dataset.episodeNumber || 1);
            const epObj = isMovie ? null : global.getEpisodeObject?.(anime, epNum);
            const views = epObj ? (Number(epObj.views) || 0) : (Number(anime.views) || 0);

            const animeId = video?.dataset?.animeId ? String(video.dataset.animeId) : null;
            if (animeId) {
                this.updateAllViewCountElements(animeId, epNum, views);
            }
        },

        setup(options = {}) {
            const video = this.getVideoElement();
            if (!video) return false;
            this.attachEvents();
            
            this.updatePoster(); // Set initial poster
            
            // Skip restoring/reloading the source when the caller already knows
            // this exact title is loaded and playing (e.g. maximizing the mini
            // player back to full size) - otherwise this would reload the video
            // and jump back to the last saved checkpoint instead of staying at
            // the current playback position.
            if (!options.skipRestore) {
                this.restoreProgress();
            }
            this.syncState();
            return true;
        },

        destroy() {
            const video = this.getVideoElement();
            if (!video) return false;

            if (this._handlePlay) video.removeEventListener('play', this._handlePlay);
            if (this._handlePause) video.removeEventListener('pause', this._handlePause);
            if (this._handleEnded) video.removeEventListener('ended', this._handleEnded);
            if (this._handleSeeking) video.removeEventListener('seeking', this._handleSeeking);
            if (this._handleTimeUpdate) video.removeEventListener('timeupdate', this._handleTimeUpdate);
            if (this._handleLoadedMetadata) video.removeEventListener('loadedmetadata', this._handleLoadedMetadata);
            // Remove loading state event listeners
            if (this._handleLoadStart) video.removeEventListener('loadstart', this._handleLoadStart);
            if (this._handleWaiting) video.removeEventListener('waiting', this._handleWaiting);
            if (this._handleStalled) video.removeEventListener('stalled', this._handleStalled);
            if (this._handleCanPlay) video.removeEventListener('canplay', this._handleCanPlay);
            if (this._handleSeeked) video.removeEventListener('seeked', this._handleSeeked);
            if (this._handleError) video.removeEventListener('error', this._handleError);

            this.state.currentVideo = null;
            return true;
        },
    };

    global.playerService = playerService;
    global.PlayerService = playerService;
})(window);
