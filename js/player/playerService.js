(function (global) {
    'use strict';

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
                const qualities = anime?.movieMedia?.qualities || {};
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
            const posterUrl = epObj?.thumbnail || anime.banner || anime.image || '';
            if (posterUrl) {
                video.setAttribute('poster', posterUrl);
            }
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
                };
                this._handlePause = () => {
                    this.state.isPlaying = false;
                    this.syncState();
                };
                this._handleEnded = () => {
                    this.state.isPlaying = false;
                    this.syncState();
                };
                this._handleSeeking = () => this.syncState();
                this._handleTimeUpdate = () => {
                    this.syncState();
                    this.saveProgress();
                };
                this._handleLoadedMetadata = () => {
                    this.syncState();
                    const resume = global.continueWatchingService?.getEntry?.(Number(video.dataset.animeId || 0));
                    if (resume?.time && video.duration && resume.time < video.duration - 5) {
                        video.currentTime = resume.time;
                    }
                };
            }

            video.addEventListener('play', this._handlePlay);
            video.addEventListener('pause', this._handlePause);
            video.addEventListener('ended', this._handleEnded);
            video.addEventListener('seeking', this._handleSeeking);
            video.addEventListener('timeupdate', this._handleTimeUpdate);
            video.addEventListener('loadedmetadata', this._handleLoadedMetadata);
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
                const quality = Object.keys(anime?.movieMedia?.qualities || {})[0] || '1080p';
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
            return Boolean(resume);
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
            
            this.state.currentVideo = null;
            return true;
        },
    };

    global.playerService = playerService;
    global.PlayerService = playerService;
})(window);
