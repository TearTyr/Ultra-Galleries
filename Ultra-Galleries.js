// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1477603-%E3%83%A1%E3%83%AA%E3%83%BC
// @version      3.4.0
// @description  Modern image gallery with highly efficient background zipping, video playback, enhanced browsing, fullscreen, and download features.
// @author       ntf (original), Meri/TearTyr (maintained and improved)
// @match        *://kemono.su/*
// @match        *://coomer.su/*
// @match        *://kemono.cr/*
// @match        *://coomer.cr/*
// @match        *://coomer.st/*
// @match        *://nekohouse.su/*
// @icon         https://kemono.party/static/menu/recent.svg
// @grant        GM_download
// @grant        GM.download
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getResourceText
// @grant        window.open
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
// @require      https://unpkg.com/jszip@3.9.1/dist/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@1.3.2/FileSaver.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @require      https://unpkg.com/dexie@3.2.7/dist/dexie.min.js
// @resource     upngJsRaw https://unpkg.com/upng-js@2.1.0/UPNG.js
// @resource     pakoJsRaw https://unpkg.com/pako@2.1.0/dist/pako.min.js
// @resource     jszipJsRaw https://unpkg.com/jszip@3.9.1/dist/jszip.min.js
// @resource     mainCSS https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/refs/heads/TestingBranch/Ultra-Galleries.css
// ==/UserScript==
(function() {
    'use strict';

    // ====================================================
    // Core Configuration
    // ====================================================

    const CONFIG = {
        // Performance settings
        BATCH_SIZE: 5,
        MAX_RETRIES: 3,
        RETRY_DELAY: 1500,
        DEBOUNCE_DELAY: 250,
        CACHE_EVICTION_COUNT: 10,
        PRELOAD_DISTANCE: 2, // Number of images to preload ahead/behind
        
        // UI settings
        MIN_SCALE: 0.05,
        MAX_SCALE: 5,
        ZOOM_STEP: 0.2,
        PAN_RESISTANCE: 0.8,
        DOUBLE_TAP_THRESHOLD: 300,
        ANIMATION_DURATION: 300,
        
        // Default settings
        DEFAULT_SETTINGS: {
            zipFileNameFormat: '{title}-{artistName}.zip',
            imageFileNameFormat: '{title}-{artistName}-{fileName}-{index}',
            galleryKey: 'g',
            isFullscreen: false,
            notificationsEnabled: true,
            notificationAreaVisible: true,
            notificationPosition: 'bottom',
            animationsEnabled: true,
            optimizePngInZip: false,
            enablePersistentCaching: true,
            hideNavArrows: false,
            hideRemoveButton: false,
            hideFullButton: false,
            hideDownloadButton: false,
            hideHeightButton: false,
            hideWidthButton: false,
            prevImageKey: 'k',
            nextImageKey: 'l',
            bottomStripeVisible: true,
            dynamicResizing: true,
            zoomEnabled: true,
            inertiaEnabled: true,
            maxZoomScale: 5,
            enableImageRotation: true,
            autoHideControls: true,
            autoHideDelay: 3000,
            showImageInfo: true,
            enableKeyboardShortcuts: true,
            enableGestures: true
        }
    };

    const BUTTONS = {
        DOWNLOAD: '【DOWNLOAD】',
        DOWNLOAD_ALL: '【DL ALL】',
        FULL: '【FULL】',
        HEIGHT: '【FILL HEIGHT】',
        REMOVE: '【REMOVE】',
        WIDTH: '【FILL WIDTH】',
        GALLERY: '【GALLERY】',
        SETTINGS: '⚙️',
        FULLSCREEN: '⛶',
        CLOSE: '✕',
        ROTATE_LEFT: '↺',
        ROTATE_RIGHT: '↻',
        ZOOM_IN: '+',
        ZOOM_OUT: '-',
        RESET_ZOOM: '⟲'
    };

    // CSS class names
    const CSS = {
        BTN: 'ug-button',
        BTN_CONTAINER: 'ug-button-container',
        LOADING: 'loading-overlay',
        NOTIF_AREA: 'ug-notification-area',
        NOTIF_CONTAINER: 'ug-notification-container',
        NOTIF_TEXT: 'ug-notification-text',
        NOTIF_CLOSE: 'ug-notification-close',
        NOTIF_REPORT: 'ug-notification-report',
        SETTINGS_BTN: 'settings-button',
        VIRTUAL_IMAGE: 'virtual-image',
        LONG_PRESS: 'ug-long-press',

        // Gallery classes
        GALLERY: {
            OVERLAY: 'ug-gallery-overlay',
            CONTAINER: 'ug-gallery-container',
            GRID_VIEW: 'ug-gallery-grid-view',
            EXPANDED_VIEW: 'ug-gallery-expanded-view',
            HIDE: 'ug-gallery-hide',
            TOOLBAR: 'ug-gallery-toolbar',
            ZOOM_CONTAINER: 'ug-gallery-zoom-container',
            MAIN_IMG_CONTAINER: 'ug-main-image-container',
            MAIN_IMG: 'ug-main-image',
            MAIN_VIDEO: 'ug-main-video',
            THUMBNAIL: 'ug-gallery-thumbnail',
            THUMBNAIL_GRID: 'ug-gallery-thumbnail-grid',
            THUMBNAIL_CONTAINER: 'ug-gallery-thumbnail-grid-container',
            THUMBNAIL_STRIP: 'ug-thumbnail-strip',
            THUMBNAIL_ITEM: 'ug-thumbnail',
            NAV: 'ug-gallery-nav',
            NAV_CONTAINER: 'ug-gallery-nav-container',
            PREV: 'ug-gallery-prev',
            NEXT: 'ug-gallery-next',
            COUNTER: 'ug-gallery-counter',
            FULLSCREEN: 'ug-gallery-fullscreen',
            FULLSCREEN_OVERLAY: 'ug-fullscreen-overlay',
            GRID_CLOSE: 'ug-gallery-grid-close',
            STRIP_CONTAINER: 'ug-gallery-thumbnail-strip-container',
            TOOLBAR_BTN: 'ug-toolbar-button',
            CONTROLS_HIDDEN: 'ug-controls-hidden',
            GRABBING: 'ug-grabbing',
            ZOOMED: 'zoomed',
            IS_TRANSITIONING: 'is-transitioning',
            IMAGE_ERROR_MSG: 'ug-image-error-message',
            IMAGE_INFO: 'ug-image-info',
            ROTATION_CONTAINER: 'ug-rotation-container',
        },

        // Settings classes
        SETTINGS: {
            OVERLAY: 'ug-settings-overlay',
            CONTAINER: 'ug-settings-container',
            HEADER: 'ug-settings-header',
            BODY: 'ug-settings-body',
            CLOSE_BTN: 'ug-settings-close-btn',
            SECTION: 'ug-settings-section',
            SECTION_HEADER: 'ug-settings-section-header',
            LABEL: 'ug-settings-label',
            INPUT: 'ug-settings-input',
            CHECKBOX_LABEL: 'ug-settings-checkbox-label',
        }
    };

    // Website-specific selectors
    const website = window.location.hostname.split('.')[0];

    const SELECTORS = {
        IMAGE_LINK: website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link',
        ATTACHMENT_LINK: website === 'nekohouse' ? '.scrape__attachment-link' : '.post__attachment-link',
        POST_TITLE: website === 'nekohouse' ? '.scrape__title' : '.post__title',
        POST_USER_NAME: website === 'nekohouse' ? '.scrape__user-name' : '.post__user-name',
        POST_IMAGE: 'img.post__image',
        THUMBNAIL: website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail',
        MAIN_THUMBNAIL: website === 'nekohouse' ? '.scrape__thumbnail:not(.scrape__thumbnail--attachment)' : '.post__thumbnail:not(.post__thumbnail--attachment)',
        POST_ACTIONS: website === 'nekohouse' ? '.scrape__actions' : '.post__actions',
        FAVORITE_BUTTON: website === 'nekohouse' ? '.scrape__actions a.favorite-button' : '.post__actions a.favorite-button',
        FILE_DIVS: website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail',
        FILES_IMG: website === 'nekohouse' ? '.scrape__files img' : 'img.post__image',
        VIDEO_LINK: 'a.fileThumb[href$=".mp4"], a.fileThumb[href$=".webm"], a.fileThumb[href$=".mov"]',
        VIDEO_THUMBNAIL: website === 'nekohouse' ? '.scrape__video-thumbnail' : '.post__video-thumbnail',
    };

    // ====================================================
    // Utility Functions
    // ====================================================

    const Utils = {
        getExtension: filename => filename.split('.').pop().toLowerCase() || 'jpg',
        sanitizeFileName: name => name.replace(/[/\\:*?"<>|]/g, '-'),
        setImageStyle: (img, styles) => img && Object.assign(img.style, styles),

        isPostPage: () => {
            const url = window.location.href;
            const patterns = [
                /https:\/\/(kemono\.su|coomer\.su|coomer\.st|nekohouse\.su|kemono\.cr|coomer\.cr)\/.*\/post\//,
                /https:\/\/(kemono\.su|coomer\.su|coomer\.st|nekohouse\.su|kemono\.cr|coomer\.cr)\/.*\/user\/.*\/post\//,
            ];
            return patterns.some(pattern => pattern.test(url));
        },

        delay: ms => new Promise(resolve => setTimeout(resolve, ms)),

        debounce: (func, wait) => {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        },

        throttle: (func, limit) => {
            let lastRan, lastFunc;
            return function(...args) {
                if (!lastRan) {
                    func(...args);
                    lastRan = Date.now();
                } else {
                    clearTimeout(lastFunc);
                    lastFunc = setTimeout(() => {
                        if ((Date.now() - lastRan) >= limit) {
                            func(...args);
                            lastRan = Date.now();
                        }
                    }, limit - (Date.now() - lastRan));
                }
            };
        },

        handleMediaSrc: mediaLink => {
            const fileThumbDiv = mediaLink.querySelector('.fileThumb');
            return fileThumbDiv?.getAttribute('href')?.split('?')[0] ||
                   mediaLink.getAttribute('href')?.split('?')[0] || null;
        },

        supportsPassiveEvents: () => {
            let supportsPassive = false;
            try {
                const opts = Object.defineProperty({}, 'passive', {
                    get: function() {
                        supportsPassive = true;
                        return true;
                    }
                });
                window.addEventListener('testPassive', null, opts);
                window.removeEventListener('testPassive', null, opts);
            } catch (e) {}
            return supportsPassive;
        },

        createTooltip: (text, duration = 3000) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'zoom-tooltip';
            tooltip.textContent = text;
            Object.assign(tooltip.style, {
                position: 'absolute',
                bottom: '120px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '5px',
                zIndex: '100',
                pointerEvents: 'none'
            });

            setTimeout(() => {
                tooltip.style.opacity = '0';
                tooltip.style.transition = 'opacity 0.5s ease';
                setTimeout(() => tooltip.remove(), 500);
            }, duration);

            return tooltip;
        },

        getDistance: (touch1, touch2) => {
            return Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        },

        getMidpoint: (touch1, touch2) => ({
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        }),

        ensureThumbnailsExist: () => {
            try {
                const posts = document.querySelectorAll('.post');
                posts.forEach(post => {
                    const hasImages = post.querySelector(SELECTORS.IMAGE_LINK) !== null;
                    const hasThumbnail = post.querySelector(SELECTORS.THUMBNAIL) !== null;

                    if (hasImages && !hasThumbnail) {
                        const firstImage = post.querySelector(SELECTORS.IMAGE_LINK + ' img');
                        if (firstImage) {
                            const thumbnailContainer = document.createElement('div');
                            thumbnailContainer.className = website === 'nekohouse' ? 'scrape__thumbnail' : 'post__thumbnail';

                            const thumbnailImg = document.createElement('img');
                            thumbnailImg.src = firstImage.src;
                            thumbnailImg.className = website === 'nekohouse' ? 'scrape__thumbnail-img' : 'post__thumbnail-img';

                            thumbnailContainer.appendChild(thumbnailImg);

                            const insertPoint = post.querySelector('.post__header') || post.firstChild;
                            if (insertPoint) {
                                post.insertBefore(thumbnailContainer, insertPoint.nextSibling);
                            } else {
                                post.appendChild(thumbnailContainer);
                            }
                        }
                    }
                });

                const videoLinks = document.querySelectorAll(SELECTORS.VIDEO_LINK);
                videoLinks.forEach(videoLink => {
                    const videoThumb = videoLink.closest(SELECTORS.VIDEO_THUMBNAIL);
                    if (!videoThumb) {
                        const video = videoLink.querySelector('video');
                        if (video && video.hasAttribute('poster')) {
                            const posterUrl = video.getAttribute('poster');
                            const thumbnailContainer = document.createElement('div');
                            thumbnailContainer.className = website === 'nekohouse' ? 'scrape__video-thumbnail' : 'post__video-thumbnail';

                            const thumbnailImg = document.createElement('img');
                            thumbnailImg.src = posterUrl;
                            thumbnailImg.className = website === 'nekohouse' ? 'scrape__thumbnail-img' : 'post__thumbnail-img';

                            thumbnailContainer.appendChild(thumbnailImg);
                            videoLink.parentNode?.insertBefore(thumbnailContainer, videoLink);
                        }
                    }
                });
            } catch (error) {
                console.error('Error ensuring thumbnails exist:', error);
            }
        },

        // New utility functions
        formatFileSize: (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        formatImageInfo: (img) => {
            if (!img || !img.naturalWidth) return 'Unknown';
            return `${img.naturalWidth} × ${img.naturalHeight}`;
        },

        createElement: (tag, className, attributes = {}) => {
            const element = document.createElement(tag);
            if (className) element.className = className;
            Object.entries(attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            return element;
        },

        addGlobalStyle: (css) => {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            return style;
        },

        // Animation utilities
        animate: (element, keyframes, options = {}) => {
            return element.animate(keyframes, {
                duration: CONFIG.ANIMATION_DURATION,
                easing: 'ease-out',
                fill: 'forwards',
                ...options
            });
        },

        fadeIn: (element, duration = CONFIG.ANIMATION_DURATION) => {
            element.style.opacity = '0';
            element.style.display = 'block';
            return Utils.animate(element, [
                { opacity: 0 },
                { opacity: 1 }
            ], { duration });
        },

        fadeOut: (element, duration = CONFIG.ANIMATION_DURATION) => {
            return Utils.animate(element, [
                { opacity: 1 },
                { opacity: 0 }
            ], { duration }).onfinish = () => {
                element.style.display = 'none';
            };
        }
    };

    // ====================================================
    // State Management
    // ====================================================

    const withSessionCheck = (callback) => {
        return (value, oldValue) => {
            if (state.currentLoadSessionId === null) {
                return;
            }
            callback(value, oldValue);
        };
    };

    const createReactiveState = (initialState, updateCallbacks = {}) => {
        return new Proxy(initialState, {
            set(target, key, value) {
                const oldValue = target[key];
                target[key] = value;
                if (updateCallbacks[key]) {
                    updateCallbacks[key](value, oldValue);
                }
                return true;
            },
        });
    };

    // Initialize settings with defaults
    const initializeSettings = () => {
        const settings = {};
        Object.entries(CONFIG.DEFAULT_SETTINGS).forEach(([key, defaultValue]) => {
            settings[key] = GM_getValue(key, defaultValue);
        });
        return settings;
    };

    const state = createReactiveState({
        ...initializeSettings(),
        
        galleryReady: false,
        galleryActive: false,
        currentGalleryIndex: 0,
        virtualGallery: [],
        originalImageSrcs: [],
        fullSizeImageSrcs: [],

        currentPostUrl: null,
        displayedImages: [],
        totalImages: 0,
        loadedImages: 0,

        downloadedCount: 0,
        isLoading: false,
        loadingMessage: null,
        hasImages: false,
        postActionsInitialized: false,
        mediaLoaded: {},
        isGalleryMode: false,
        isDownloading: false,
        errorCount: 0,

        currentLoadSessionId: null,

        notification: null,
        notificationType: 'info',
        settingsOpen: false,

        // Zoom and pan state
        isZoomed: false,
        zoomScale: 1,
        controlsVisible: true,
        isDragging: false,
        dragStartPosition: { x: 0, y: 0 },
        lastMousePosition: { x: 0, y: 0 },
        imageOffset: { x: 0, y: 0 },
        lastWidth: 0,
        lastHeight: 0,
        zoomOrigin: { x: 0, y: 0 },
        dragStartOffset: { x: 0, y: 0 },
        imageRotation: 0,

        pendingRetries: {},
        lastTapTime: 0,
        pinchZoomActive: false,
        initialTouchDistance: 0,
        initialScale: 1,
        zoomIndicatorVisible: true,
        velocity: { x: 0, y: 0 },
        inertiaActive: false,
    }, {
        controlsVisible: (value) => {
            if (galleryOverlay && galleryOverlay.length) {
                const $toolbar = galleryOverlay.find(`.${CSS.GALLERY.TOOLBAR}`);
                if ($toolbar.length) {
                    $toolbar.toggleClass(CSS.GALLERY.CONTROLS_HIDDEN, !value);
                }
            }
        },
        galleryReady: (value) => {
            updateGalleryButton(value);
        },
        loadedImages: withSessionCheck((value) => {
            if (value === state.totalImages && state.totalImages > 0) {
                state.notificationType = 'success';
                state.notification = `Media Done Loading! Total: ${state.totalImages}`;
            } else if (state.totalImages > 0) {
                state.notificationType = 'info';
                state.notification = `Loading media (${value}/${state.totalImages})...`;
            }
        }),
        downloadedCount: (value) => {
            if (value === state.totalImages) {
                state.notificationType = 'success';
                state.notification = `All files ready for zipping!`;
            } else {
                state.notificationType = 'info';
                state.notification = `Preparing... (${value}/${state.totalImages})`;
            }
        },
        totalImages: withSessionCheck((value, oldValue) => {
            if (value > 0) {
                state.notificationType = 'info';
                state.notification = `Loading media (${state.loadedImages}/${value})...`;
            }
            state.hasImages = value > 0;
        }),
        isLoading: (value, oldValue) => {
            if (value && !oldValue) {
                if ((state.galleryActive || state.isDownloading) && state.loadedImages === 0) {
                    UI.showLoadingOverlay(state.loadingMessage);
                }
            } else if (!value && oldValue) {
                UI.hideLoadingOverlay();
            }
        },
        loadingMessage: (value) => {
            if (state.isLoading && (state.galleryActive || state.isDownloading)) {
                UI.updateLoadingOverlayText(value);
            }
        },
        notification: (value) => {
            if (value) {
                UI.showNotification(value, state.notificationType);
            } else {
                UI.hideNotification();
            }
        },
        settingsOpen: (value) => {
            if (value) {
                UI.showSettings();
            } else {
                UI.closeSettings();
            }
        },
        isFullscreen: (value) => {
            GM_setValue('isFullscreen', value);
            if (value) {
                if (galleryOverlay && galleryOverlay.length) {
                    document.body.classList.add('ug-fullscreen');
                    galleryOverlay.addClass(CSS.GALLERY.FULLSCREEN_OVERLAY);
                }
            } else {
                document.body.classList.remove('ug-fullscreen');
                if (galleryOverlay && galleryOverlay.length) {
                    galleryOverlay.removeClass(CSS.GALLERY.FULLSCREEN_OVERLAY);
                }
            }
        },
        zoomEnabled: (value) => {
            GM_setValue('zoomEnabled', value);
        },
        bottomStripeVisible: (value) => {
            GM_setValue('bottomStripeVisible', value);
            if (galleryOverlay) {
                const stripContainer = galleryOverlay.querySelector(`.${CSS.GALLERY.STRIP_CONTAINER}`);
                if (stripContainer) {
                    stripContainer.style.display = value ? 'flex' : 'none';
                }
            }
        },
        zoomScale: (value, oldValue) => {
            Zoom.applyZoom();

            if (galleryOverlay && galleryOverlay.length) {
                const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
                if ($container.length) {
                    $container.toggleClass(CSS.GALLERY.ZOOMED, value > 1);
                    $container.css('cursor', value > 1 ? 'grab' : 'default');
                }

                if (value > 1 && oldValue === 1 && state.zoomIndicatorVisible) {
                    const tooltip = Utils.createTooltip('Click and drag to pan image');
                    galleryOverlay.append(tooltip);
                    state.zoomIndicatorVisible = false;
                }
            }
        },
        imageOffset: () => Zoom.applyZoom(),
        isDragging: (value) => {
            if (galleryOverlay && galleryOverlay.length) {
                const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
                if ($container.length) {
                    $container.toggleClass(CSS.GALLERY.GRABBING, value);

                    if (value && state.inertiaActive) {
                        state.inertiaActive = false;
                        state.velocity = { x: 0, y: 0 };
                        if (state.inertiaAnimFrame) {
                            cancelAnimationFrame(state.inertiaAnimFrame);
                            state.inertiaAnimFrame = null;
                        }
                    }
                }
            }
        },
        notificationPosition: (value) => {
            GM_setValue('notificationPosition', value);
            const notifArea = document.getElementById(CSS.NOTIF_AREA);
            if (notifArea) {
                notifArea.style.top = value === 'top' ? '10px' : 'auto';
                notifArea.style.bottom = value === 'bottom' ? '10px' : 'auto';
            }
        },

        enablePersistentCaching: (value) => {
            GM_setValue('enablePersistentCaching', value);
            if (value && !db) {
                initDexie();
            } else if (!value && db) {
                console.log("Ultra Galleries: Persistent caching disabled. Existing cache remains but won't be used.");
            }
        },
        optimizePngInZip: (value) => {
            GM_setValue('optimizePngInZip', value);
        },
        imageRotation: (value) => {
            if (galleryOverlay && galleryOverlay.length) {
                const $container = galleryOverlay.find(`.${CSS.GALLERY.ROTATION_CONTAINER}`);
                if ($container.length) {
                    $container.css('transform', `rotate(${value}deg)`);
                }
            }
        }
    });

    // ====================================================
    // Resource Loading
    // ====================================================
    let loadedUPNG = null;
    let loadedPako = null;
    let upngLoadAttemptedAndFailed = false;

    async function loadResourceScript(resourceName, expectedGlobal) {
        if (window[expectedGlobal]) {
            return window[expectedGlobal];
        }

        try {
            const scriptText = GM_getResourceText(resourceName);
            if (!scriptText) {
                console.error(`Ultra Galleries: Resource ${resourceName} is empty or not found.`);
                return null;
            }

            (0, eval)(scriptText);

            if (window[expectedGlobal]) {
                console.log(`Ultra Galleries: ${expectedGlobal} loaded from resource.`);
                return window[expectedGlobal];
            }

            const globalNameMap = { 'upngJsRaw': 'UPNG', 'pakoJsRaw': 'pako' };
            const actualGlobal = globalNameMap[resourceName];
            if (actualGlobal && window[actualGlobal]) {
                console.log(`Ultra Galleries: ${actualGlobal} loaded from resource ${resourceName}.`);
                return window[actualGlobal];
            }

            console.warn(`Ultra Galleries: Resource ${resourceName} loaded, but expected global '${expectedGlobal}' was not found.`);
            return null;
        } catch (e) {
            console.error(`Ultra Galleries: Error loading resource ${resourceName}:`, e);
            return null;
        }
    }

    // ====================================================
    // Dexie Database Initialization
    // ====================================================
    let db = null;

    function initDexie() {
        if (typeof Dexie === 'undefined') {
            console.error("Ultra Galleries: Dexie.js is not loaded. Persistent caching will be unavailable.");
            return false;
        }
        db = new Dexie('UltraGalleriesCache');
        db.version(1).stores({
            imageCache: 'url, cachedAt, blob'
        });
        console.log("Ultra Galleries: Dexie database initialized.");
        return true;
    }

    async function evictOldestCacheItems(count) {
        if (!db) return 0;
        try {
            const oldestItemKeys = await db.imageCache.orderBy('cachedAt').limit(count).primaryKeys();
            if (oldestItemKeys && oldestItemKeys.length > 0) {
                await db.imageCache.bulkDelete(oldestItemKeys);
                console.log(`Ultra Galleries: Evicted ${oldestItemKeys.length} items from Dexie cache.`);
                return oldestItemKeys.length;
            }
            return 0;
        } catch (e) {
            console.error("Ultra Galleries: Error evicting oldest cache items:", e);
            return 0;
        }
    }

    async function storeImageInDexie(url, blob, sessionId = null) {
        if (!db || !state.enablePersistentCaching) return;

        try {
            await db.imageCache.put({ url: url, blob: blob, cachedAt: Date.now() });
        } catch (e) {
            console.error(`Ultra Galleries: Error caching image ${url} in Dexie:`, e);
            if (e.name === 'QuotaExceededError') {
                console.warn("Ultra Galleries: Dexie cache quota exceeded. Attempting to clear some old items...");
                const evictedCount = await evictOldestCacheItems(CONFIG.CACHE_EVICTION_COUNT);

                if (evictedCount > 0) {
                    console.log(`Ultra Galleries: Evicted ${evictedCount} items. Retrying cache put for ${url}.`);
                    try {
                        await db.imageCache.put({ url: url, blob: blob, cachedAt: Date.now() });
                        console.log(`Ultra Galleries: Successfully cached image after eviction: ${url}`);
                    } catch (retryError) {
                        console.error(`Ultra Galleries: Failed to cache image ${url} even after eviction:`, retryError);
                    }
                } else {
                     console.warn(`Ultra Galleries: Eviction failed to remove any items for ${url}. Cache might remain full.`);
                     state.notification = `Persistent cache full. Could not make space for new images.`;
                     state.notificationType = 'warning';
                }
            } else {
                 state.notification = `Error saving image to cache: ${e.message}`;
                 state.notificationType = 'error';
            }
        }
    }

    async function getImageFromDexie(url) {
        if (!db || !state.enablePersistentCaching) return null;
        try {
            const record = await db.imageCache.get(url);
            if (record && record.blob) {
                return record.blob;
            }
            return null;
        } catch (e) {
            console.error(`Ultra Galleries: Error retrieving image ${url} from Dexie:`, e);
            return null;
        }
    }

    async function clearDexieCache() {
        if (!db) return;
        try {
            await db.imageCache.clear();
            state.notification = "Persistent image cache cleared.";
            state.notificationType = "success";
            console.log("Ultra Galleries: Dexie imageCache cleared.");
        } catch (e) {
            console.error("Ultra Galleries: Error clearing Dexie cache:", e);
            state.notification = "Error clearing cache. See console.";
            state.notificationType = "error";
        }
    }

    // ====================================================
    // Zoom & Pan Module
    // ====================================================

    const Zoom = {
        _applyTransition: function($element, action) {
            $element.addClass(CSS.GALLERY.IS_TRANSITIONING);
            action();
            $element.one('transitionend', () => {
                $element.removeClass(CSS.GALLERY.IS_TRANSITIONING);
            });
        },

        applyZoom: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            $container.css('transform', `translate(${state.imageOffset.x}px, ${state.imageOffset.y}px) scale(${state.zoomScale})`);

            const $zoomDisplay = galleryOverlay.find('#zoom-level');
            if ($zoomDisplay.length) {
                $zoomDisplay.text(`${Math.round(state.zoomScale * 100)}%`);
            }
            $container.toggleClass(CSS.GALLERY.ZOOMED, state.zoomScale !== 1);
        },

        handleWheelZoom: (event) => {
            if (!state.zoomEnabled || !galleryOverlay || !galleryOverlay.length) return;

            event.preventDefault();
            event.stopPropagation();

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0];
            const rect = containerDOM.getBoundingClientRect();
            const originalEvent = event.originalEvent || event;

            const zoomFactor = 1 - Math.sign(originalEvent.deltaY) * CONFIG.ZOOM_STEP;
            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(state.zoomScale * zoomFactor, CONFIG.MAX_SCALE));

            if (newScale === state.zoomScale) return;
            const mouseX = originalEvent.clientX - rect.left;
            const mouseY = originalEvent.clientY - rect.top;

            const imageXUnderPointer = (mouseX - state.imageOffset.x) / state.zoomScale;
            const imageYUnderPointer = (mouseY - state.imageOffset.y) / state.zoomScale;

            const newOffsetX = mouseX - (imageXUnderPointer * newScale);
            const newOffsetY = mouseY - (imageYUnderPointer * newScale);

            state.imageOffset.x = newOffsetX;
            state.imageOffset.y = newOffsetY;
            state.zoomScale = newScale;
        },

        enforceBoundaries: (offsetX, offsetY, scale, containerRect, imageDOM) => {
            if (!imageDOM || !containerRect) return { x: offsetX, y: offsetY };
            const imgWidth = imageDOM.naturalWidth * scale;
            const imgHeight = imageDOM.naturalHeight * scale;
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;

            if (imgWidth <= containerWidth) {
                offsetX = (containerWidth - imgWidth) / 2;
            } else {
                const maxX = (imgWidth - containerWidth) / 2;
                const minX = -maxX;
                if (offsetX > maxX) offsetX = maxX + ((offsetX - maxX) * CONFIG.PAN_RESISTANCE / scale);
                else if (offsetX < minX) offsetX = minX - ((minX - offsetX) * CONFIG.PAN_RESISTANCE / scale);
            }

            if (imgHeight <= containerHeight) {
                offsetY = (containerHeight - imgHeight) / 2;
            } else {
                const maxY = (imgHeight - containerHeight) / 2;
                const minY = -maxY;
                if (offsetY > maxY) offsetY = maxY + ((offsetY - maxY) * CONFIG.PAN_RESISTANCE / scale);
                else if (offsetY < minY) offsetY = minY - ((minY - offsetY) * CONFIG.PAN_RESISTANCE / scale);
            }
            return { x: offsetX, y: offsetY };
        },

        startDrag: (event) => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            if (event.button === 2 && event.type === 'mousedown') return;

            if (event.preventDefault) event.preventDefault();
            state.isDragging = true;

            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);

            state.dragStartPosition = { x: clientX, y: clientY };
            state.dragStartOffset = { x: state.imageOffset.x, y: state.imageOffset.y };

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if ($container.length) {
                $container.addClass(CSS.GALLERY.GRABBING);
            }
        },

        dragImage: (event) => {
            if (!state.isDragging || !galleryOverlay || !galleryOverlay.length) return;

            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);

            if (clientX === undefined || clientY === undefined) return;

            const deltaX = clientX - state.dragStartPosition.x;
            const deltaY = clientY - state.dragStartPosition.y;

            state.imageOffset.x = state.dragStartOffset.x + deltaX;
            state.imageOffset.y = state.dragStartOffset.y + deltaY;
            Zoom.applyZoom();
        },

        endDrag: () => {
            if (!state.isDragging || !galleryOverlay || !galleryOverlay.length) return;
            state.isDragging = false;
            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if ($container.length) {
                $container.removeClass(CSS.GALLERY.GRABBING);
            }
        },

        resetZoom: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if ($container.length) {
                Zoom._applyTransition($container, () => {
                    state.zoomScale = 1;
                    state.imageOffset = { x: 0, y: 0 };
                    Zoom.applyZoom();
                });
            }
        },

        initializeImage: (imageDOM, containerDOM) => {
            if (!imageDOM || !containerDOM) return;

            $(imageDOM).css({width: '', height: '', maxWidth: '100%', maxHeight: '100%'});

            const containerWidth = containerDOM.offsetWidth;
            const containerHeight = containerDOM.offsetHeight;
            const imageWidth = imageDOM.naturalWidth;
            const imageHeight = imageDOM.naturalHeight;

            if (imageWidth === 0 || imageHeight === 0) {
                Zoom.resetZoom(); Zoom.applyZoom(); return;
            }
            const aspectRatio = imageWidth / imageHeight;

            if (aspectRatio > containerWidth / containerHeight) {
                $(imageDOM).css({width: '100%', height: 'auto'});
            } else {
                $(imageDOM).css({width: 'auto', height: '100%'});
            }
            state.zoomScale = 1;
            state.imageOffset = { x: 0, y: 0 };
            Zoom.applyZoom();
        },

        zoom: (step) => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0];
            const rect = containerDOM.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(state.zoomScale + step, CONFIG.MAX_SCALE));

            if (state.zoomScale !== newScale) {
                const imageX = (centerX - state.imageOffset.x) / state.zoomScale;
                const imageY = (centerY - state.imageOffset.y) / state.zoomScale;
                const newOffsetX = centerX - (imageX * newScale);
                const newOffsetY = centerY - (imageY * newScale);

                Zoom._applyTransition($container, () => {
                    state.imageOffset.x = newOffsetX;
                    state.imageOffset.y = newOffsetY;
                    state.zoomScale = newScale;
                    Zoom.applyZoom();
                });
            }
        },

        rotate: (direction) => {
            if (!state.enableImageRotation) return;
            const rotationStep = 90;
            state.imageRotation = (state.imageRotation + (direction * rotationStep)) % 360;
        },

        setupTouchEvents: () => {
          if (!galleryOverlay || !galleryOverlay.length) return;
          const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
          if (!$container.length) return;

          const containerDOM = $container[0];
          let longPressTimer = null;

          const handleDoubleTap = (e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const rect = containerDOM.getBoundingClientRect();
              const touchX = touch.clientX - rect.left;
              const touchY = touch.clientY - rect.top;

              if (state.zoomScale > 1) {
                  Zoom.resetZoom();
              } else {
                  const newScale = 2.5;
                  const imageX = (touchX - state.imageOffset.x) / state.zoomScale;
                  const imageY = (touchY - state.imageOffset.y) / state.zoomScale;
                  const newOffsetX = touchX - (imageX * newScale);
                  const newOffsetY = touchY - (imageY * newScale);

                  Zoom._applyTransition($container, () => {
                      state.imageOffset.x = newOffsetX;
                      state.imageOffset.y = newOffsetY;
                      state.zoomScale = newScale;
                      Zoom.applyZoom();
                  });
              }
              state.lastTapTime = 0;
          };

          const handlePinchStart = (e) => {
              e.preventDefault();
              state.pinchZoomActive = true;
              state.initialTouchDistance = Utils.getDistance(e.touches[0], e.touches[1]);
              state.initialScale = state.zoomScale;
              const rect = containerDOM.getBoundingClientRect();
              const midPoint = Utils.getMidpoint(e.touches[0], e.touches[1]);
              state.zoomOrigin = { x: midPoint.x - rect.left, y: midPoint.y - rect.top };
          };

          const handlePinchMove = (e) => {
              e.preventDefault();
              const currentDistance = Utils.getDistance(e.touches[0], e.touches[1]);
              if (state.initialTouchDistance === 0) return;

              const scaleFactor = currentDistance / state.initialTouchDistance;
              const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(state.initialScale * scaleFactor, CONFIG.MAX_SCALE));

              const imageX = (state.zoomOrigin.x - state.imageOffset.x) / state.zoomScale;
              const imageY = (state.zoomOrigin.y - state.imageOffset.y) / state.zoomScale;

              state.imageOffset.x = state.zoomOrigin.x - (imageX * newScale);
              state.imageOffset.y = state.zoomOrigin.y - (imageY * newScale);
              state.zoomScale = newScale;
          };

          const onTouchStart = (e) => {
              const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
              if (!currentItem || currentItem.type !== 'image') return;

              clearTimeout(longPressTimer);
              if (e.touches.length === 1) {
                  const now = Date.now();
                  if (now - state.lastTapTime < CONFIG.DOUBLE_TAP_THRESHOLD) {
                      handleDoubleTap(e);
                      return;
                  }
                  state.lastTapTime = now;
                  longPressTimer = setTimeout(() => $(e.target).addClass(CSS.LONG_PRESS), 500);
                  Zoom.startDrag(e.touches[0]);
              } else if (e.touches.length === 2) {
                  if (state.isDragging) Zoom.endDrag();
                  handlePinchStart(e);
              }
          };

          const onTouchMove = (e) => {
              const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
              if (!currentItem || currentItem.type !== 'image') return;

              clearTimeout(longPressTimer);
              if (state.pinchZoomActive && e.touches.length === 2) {
                  handlePinchMove(e);
              } else if (state.isDragging && e.touches.length === 1) {
                  Zoom.dragImage(e.touches[0]);
              }
          };

          const onTouchEnd = (e) => {
              clearTimeout(longPressTimer);
              $container.find(`.${CSS.LONG_PRESS}`).removeClass(CSS.LONG_PRESS);
              if (state.pinchZoomActive && e.touches.length < 2) {
                  state.pinchZoomActive = false;
              }
              if (state.isDragging) {
                  Zoom.endDrag();
              }
          };

          const eventOptions = Utils.supportsPassiveEvents() ? { passive: false } : false;
          containerDOM.removeEventListener('touchstart', onTouchStart);
          containerDOM.removeEventListener('touchmove', onTouchMove);
          containerDOM.removeEventListener('touchend', onTouchEnd);
          containerDOM.removeEventListener('touchcancel', onTouchEnd);

          containerDOM.addEventListener('touchstart', onTouchStart, eventOptions);
          containerDOM.addEventListener('touchmove', onTouchMove, eventOptions);
          containerDOM.addEventListener('touchend', onTouchEnd, eventOptions);
          containerDOM.addEventListener('touchcancel', onTouchEnd, eventOptions);
      }
    };

    // ====================================================
    // UI Component Module
    // ====================================================
    let lastFocusedElement;
    let focusTrapListener;

    const UI = {
        createToggleButton: (name, action, disabled = false) => {
            const btn = document.createElement('a');
            btn.textContent = name;
            btn.addEventListener('click', action);
            btn.style.cursor = 'pointer';
            btn.classList.add(CSS.BTN);
            if (disabled) {
                btn.disabled = true;
                btn.classList.add('disabled');
            }
            return btn;
        },

        createLoadingOverlay: (text = 'Loading...') => {
            const overlay = document.createElement('div');
            overlay.className = CSS.LOADING;
            const loadingText = document.createElement('div');
            loadingText.textContent = text;
            overlay.appendChild(loadingText);
            return overlay;
        },

        createStatusElement: () => {
            const containerStatus = document.createElement('div');
            containerStatus.style.display = 'inline-flex';
            const statusElement = document.createElement('span');
            statusElement.id = 'Status';
            statusElement.style.marginLeft = '10px';
            containerStatus.append(statusElement);
            return { container: containerStatus, element: statusElement };
        },

        createButtonGroup: (buttonsConfig) => {
            const div = document.createElement('div');
            div.classList.add(CSS.BTN_CONTAINER);

            buttonsConfig.forEach(config => {
                let createThisButton = true;
                switch(config.name) {
                    case 'REMOVE':   if (state.hideRemoveButton)   createThisButton = false; break;
                    case 'FULL':     if (state.hideFullButton)     createThisButton = false; break;
                    case 'DOWNLOAD': if (state.hideDownloadButton) createThisButton = false; break;
                    case 'HEIGHT':   if (state.hideHeightButton)   createThisButton = false; break;
                    case 'WIDTH':    if (state.hideWidthButton)    createThisButton = false; break;
                }

                if (!createThisButton) {
                    return;
                }

                const button = UI.createToggleButton(config.text, config.action);
                div.append(button);
                button.classList.add(CSS.BTN);
            });
            return div;
        },

        createNavigationButton: (direction) => {
            const btn = document.createElement('button');
            btn.textContent = direction === 'prev' ? '←' : '→';
            btn.className = `${CSS.GALLERY.NAV} ${direction === 'prev' ? CSS.GALLERY.PREV : CSS.GALLERY.NEXT}`;
            btn.addEventListener('click', direction === 'prev' ? Gallery.prevImage : Gallery.nextImage);
            btn.setAttribute('aria-label', direction === 'prev' ? 'Previous Image' : 'Next Image');
            return btn;
        },

        showLoadingOverlay: (text) => {
            if (!elements.loadingOverlay) {
                elements.loadingOverlay = UI.createLoadingOverlay(text);
                document.body.appendChild(elements.loadingOverlay);
            } else {
                UI.updateLoadingOverlayText(text);
            }
        },

        updateLoadingOverlayText: (text) => {
            if (elements.loadingOverlay) {
                const loadingText = elements.loadingOverlay.querySelector('div');
                if (loadingText) loadingText.textContent = text;
            }
        },

        hideLoadingOverlay: () => {
            if (elements.loadingOverlay) {
                elements.loadingOverlay.remove();
                elements.loadingOverlay = null;
            }
        },

        createNotificationArea: () => {
            const area = document.createElement('div');
            area.id = CSS.NOTIF_AREA;
            area.classList.add(CSS.NOTIF_AREA);

            area.style.top = state.notificationPosition === 'top' ? '10px' : 'auto';
            area.style.bottom = state.notificationPosition === 'bottom' ? '10px' : 'auto';

            document.body.appendChild(area);
            return area;
        },

        createNotification: () => {
            let area = document.getElementById(CSS.NOTIF_AREA);
            if (!area) area = UI.createNotificationArea();

            const container = document.createElement('div');
            container.id = CSS.NOTIF_CONTAINER;
            container.classList.add(CSS.NOTIF_CONTAINER);

            const text = document.createElement('div');
            text.id = CSS.NOTIF_TEXT;
            container.appendChild(text);

            const closeBtn = document.createElement('button');
            closeBtn.id = CSS.NOTIF_CLOSE;
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', () => {
                state.notification = null;
            });
            container.appendChild(closeBtn);

            const reportBtn = document.createElement('a');
            reportBtn.id = CSS.NOTIF_REPORT;
            reportBtn.textContent = 'Report Issue';
            reportBtn.href = 'https://github.com/TearTyr/Ultra-Galleries/issues';
            reportBtn.target = '_blank';
            container.appendChild(reportBtn);

            area.appendChild(container);
            return container;
        },

        _notificationTimeoutId: null,

        showNotification: (message, type = 'info') => {
            if (!state.notificationsEnabled && !['error', 'warning'].includes(type)) return;

            let area = document.getElementById(CSS.NOTIF_AREA);
            if (!area) area = UI.createNotificationArea();
            let container = area.querySelector(`.${CSS.NOTIF_CONTAINER}`);
            if (!container) container = UI.createNotification();

            const isAlreadyVisible = container.style.display === 'flex' && !container.classList.contains('ug-slide-out');

            if (UI._notificationTimeoutId) {
                clearTimeout(UI._notificationTimeoutId);
                UI._notificationTimeoutId = null;
            }
            container.classList.remove('ug-update', 'ug-slide-in', 'ug-slide-out');

            const text = container.querySelector(`#${CSS.NOTIF_TEXT}`);
            text.textContent = message;
            container.className = `${CSS.NOTIF_CONTAINER} ${type}`;

            if (state.animationsEnabled) {
                if (isAlreadyVisible) {
                    container.classList.add('ug-update');
                    container.addEventListener('animationend', () => {
                        container.classList.remove('ug-update');
                    }, { once: true });
                } else {
                    container.classList.add('ug-slide-in');
                }
            }

            container.style.display = 'flex';

            if (['info', 'success'].includes(type)) {
                UI._notificationTimeoutId = setTimeout(() => {
                    state.notification = null;
                }, 5000);
            }
        },

        hideNotification: () => {
            const container = document.getElementById(CSS.NOTIF_CONTAINER);
            if (!container) return;

            if (UI._notificationTimeoutId) {
                clearTimeout(UI._notificationTimeoutId);
                UI._notificationTimeoutId = null;
            }

            if (state.animationsEnabled) {
                container.classList.add('ug-slide-out');
                container.classList.remove('ug-slide-in');
                setTimeout(() => container.style.display = 'none', 500);
            } else {
                container.classList.remove('ug-slide-in', 'ug-slide-out');
                container.style.display = 'none';
            }
        },

        forceHideNotification: () => {
            if (UI._notificationTimeoutId) {
                clearTimeout(UI._notificationTimeoutId);
                UI._notificationTimeoutId = null;
            }
            const container = document.getElementById(CSS.NOTIF_CONTAINER);
            if (container) {
                container.remove();
            }
        },

        _createSettingElement: (setting) => {
            const $div = $('<div>').addClass('ug-setting-item');
            const $label = $('<label>').attr('for', setting.id).text(setting.label);

            const handleChange = (value) => {
                if (setting.stateKey) state[setting.stateKey] = value;
                if (setting.gmKey) GM_setValue(setting.gmKey, value);
                if (setting.onChange) setting.onChange(value);
            };

            switch (setting.type) {
                case 'checkbox':
                    $div.addClass('ug-settings-checkbox-label');
                    const $input = $('<input type="checkbox">').attr('id', setting.id).prop('checked', state[setting.stateKey])
                        .on('change', e => handleChange($(e.target).prop('checked')));
                    $div.append($input, $label);
                    break;
                case 'text':
                    $div.append($label);
                    const $textInput = $(`<input type="text">`).attr({ id: setting.id, value: state[setting.stateKey], maxlength: setting.maxLength || 50 })
                        .addClass('ug-settings-input').on('change', e => handleChange($(e.target).val()));
                    $div.append($textInput);
                    break;
                case 'select':
                    $div.append($label);
                    const $select = $(`<select>`).attr('id', setting.id).addClass('ug-settings-input').on('change', e => handleChange(e.target.value));
                    setting.options.forEach(opt => $select.append($(`<option>`).val(opt.value).text(opt.text)));
                    $select.val(state[setting.stateKey]);
                    $div.append($select);
                    break;
                case 'button':
                    return $('<button>').addClass('ug-button ug-settings-input').text(setting.label).on('click', setting.action);
            }
            return $div;
        },

        createSettingsUI: () => {
            const settingsConfig = [
                {
                    title: 'General', key: 'general', settings: [
                        { id: 'animationsToggle', label: 'Enable Animations', type: 'checkbox', stateKey: 'animationsEnabled', gmKey: 'animationsEnabled' },
                        { id: 'bottomStripeToggle', label: 'Show Thumbnail Strip', type: 'checkbox', stateKey: 'bottomStripeVisible', gmKey: 'bottomStripeVisible' },
                        { id: 'autoHideControlsToggle', label: 'Auto-Hide Controls', type: 'checkbox', stateKey: 'autoHideControls', gmKey: 'autoHideControls' },
                        { id: 'showImageInfoToggle', label: 'Show Image Information', type: 'checkbox', stateKey: 'showImageInfo', gmKey: 'showImageInfo' }
                    ]
                },
                {
                    title: 'Pan & Zoom', key: 'panZoom', settings: [
                        { id: 'zoomEnabledToggle', label: 'Enable Zoom & Pan', type: 'checkbox', stateKey: 'zoomEnabled', gmKey: 'zoomEnabled' },
                        { id: 'inertiaEnabledToggle', label: 'Enable Smooth Pan Inertia', type: 'checkbox', stateKey: 'inertiaEnabled', gmKey: 'inertiaEnabled' },
                        { id: 'enableImageRotationToggle', label: 'Enable Image Rotation', type: 'checkbox', stateKey: 'enableImageRotation', gmKey: 'enableImageRotation' },
                        { id: 'maxZoomScaleInput', label: 'Max Zoom Scale:', type: 'text', stateKey: 'maxZoomScale', gmKey: 'maxZoomScale', maxLength: 3 }
                    ]
                },
                {
                    title: 'Buttons', key: 'buttonVisibility', settings: [
                        { id: 'hideNavArrows', label: 'Hide Navigation Arrows', type: 'checkbox', stateKey: 'hideNavArrows', gmKey: 'hideNavArrows' },
                        { id: 'hideRemoveBtn', label: 'Hide Remove Button', type: 'checkbox', stateKey: 'hideRemoveButton', gmKey: 'hideRemoveButton' },
                        { id: 'hideFullBtn', label: 'Hide Full Size Button', type: 'checkbox', stateKey: 'hideFullButton', gmKey: 'hideFullButton' },
                        { id: 'hideDownloadBtn', label: 'Hide Download Button', type: 'checkbox', stateKey: 'hideDownloadButton', gmKey: 'hideDownloadButton' },
                        { id: 'hideHeightBtn', label: 'Hide Fill Height Button', type: 'checkbox', stateKey: 'hideHeightButton', gmKey: 'hideHeightButton' },
                        { id: 'hideWidthBtn', label: 'Hide Fill Width Button', type: 'checkbox', stateKey: 'hideWidthButton', gmKey: 'hideWidthButton' }
                    ]
                },
                {
                    title: 'Keyboard', key: 'keys', settings: [
                        { id: 'galleryKeyInput', label: 'Gallery Key:', type: 'text', stateKey: 'galleryKey', gmKey: 'galleryKey', maxLength: 1 },
                        { id: 'prevImageKeyInput', label: 'Previous Image Key:', type: 'text', stateKey: 'prevImageKey', gmKey: 'prevImageKey', maxLength: 1 },
                        { id: 'nextImageKeyInput', label: 'Next Image Key:', type: 'text', stateKey: 'nextImageKey', gmKey: 'nextImageKey', maxLength: 1 },
                        { id: 'enableKeyboardShortcutsToggle', label: 'Enable Keyboard Shortcuts', type: 'checkbox', stateKey: 'enableKeyboardShortcuts', gmKey: 'enableKeyboardShortcuts' }
                    ]
                },
                {
                    title: 'Notifications', key: 'notifications', settings: [
                        { id: 'notificationsEnabledToggle', label: 'Enable Notifications', type: 'checkbox', stateKey: 'notificationsEnabled', gmKey: 'notificationsEnabled' },
                        { id: 'notificationPosition', label: 'Notification Position:', type: 'select', stateKey: 'notificationPosition', gmKey: 'notificationPosition', options: [{ value: 'top', text: 'Top' }, { value: 'bottom', text: 'Bottom' }] }
                    ]
                },
                {
                    title: 'Downloads', key: 'optimizations', settings: [
                        { id: 'optimizePngToggle', label: 'Optimize PNGs in ZIP (Slower)', type: 'checkbox', stateKey: 'optimizePngInZip', gmKey: 'optimizePngInZip' },
                        { id: 'persistentCachingToggle', label: 'Enable Persistent Image Caching', type: 'checkbox', stateKey: 'enablePersistentCaching', gmKey: 'enablePersistentCaching' },
                        { id: 'clearCacheButton', label: 'Clear Persistent Cache', type: 'button', action: clearDexieCache }
                    ]
                },
                {
                    title: 'File Formatting', key: 'formatting', settings: [
                        { id: 'zipFileNameFormatInput', label: 'Zip File Name Format:', type: 'text', stateKey: 'zipFileNameFormat', gmKey: 'zipFileNameFormat' },
                        { id: 'imageFileNameFormatInput', label: 'Image File Name Format:', type: 'text', stateKey: 'imageFileNameFormat', gmKey: 'imageFileNameFormat' }
                    ]
                }
            ];

            const $overlay = $('<div>').attr({ id: 'ug-settings-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ug-settings-main-header' }).addClass('ug-settings-overlay');
            const $container = $('<div>').addClass('ug-settings-container').appendTo($overlay);
            const $sidebar = $('<div>').addClass('ug-settings-sidebar').appendTo($container);
            const $content = $('<div>').addClass('ug-settings-content').appendTo($container);
            const $header = $('<div>').addClass('ug-settings-header').appendTo($content);
            const $headerText = $('<h2>').attr('id', 'ug-settings-main-header').appendTo($header);
            $('<button>').addClass('ug-settings-close-btn').text(BUTTONS.CLOSE).on('click', () => state.settingsOpen = false).appendTo($header);
            const $body = $('<div>').addClass('ug-settings-body').appendTo($content);

            $('<div>').addClass('ug-sidebar-header').text('Settings').appendTo($sidebar);

            settingsConfig.forEach(section => {
                const $sectionEl = $('<div>').addClass('ug-settings-section').attr('data-section-key', section.key).hide().appendTo($body);
                section.settings.forEach(setting => $sectionEl.append(UI._createSettingElement(setting)));

                const $button = $('<button>').addClass('ug-sidebar-button').text(section.title).data('section-key', section.key)
                    .on('click', function() {
                        const key = $(this).data('section-key');
                        $('.ug-sidebar-button').removeClass('active');
                        $(this).addClass('active');
                        $('.ug-settings-section').hide();
                        $(`.ug-settings-section[data-section-key="${key}"]`).show();
                        $headerText.text(section.title);
                    });
                $sidebar.append($button);
            });

            $sidebar.find('.ug-sidebar-button').first().trigger('click');
            $('body').append($overlay);
        },

        showSettings: () => {
            lastFocusedElement = document.activeElement;
            UI.createSettingsUI();

            const overlay = document.getElementById('ug-settings-overlay');
            if (!overlay) return;

            overlay.classList.add('opening');
            const focusable = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
            const firstFocusable = focusable[0];
            const lastFocusable = focusable[focusable.length - 1];
            firstFocusable?.focus();

            focusTrapListener = (e) => {
                if (e.key !== 'Tab') return;
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            };
            document.addEventListener('keydown', focusTrapListener);
        },

        closeSettings: () => {
            if (focusTrapListener) {
                document.removeEventListener('keydown', focusTrapListener);
                focusTrapListener = null;
            }
            const overlay = document.getElementById('ug-settings-overlay');
            if (overlay) {
                overlay.classList.remove('opening');
                setTimeout(() => {
                    overlay.remove();
                    lastFocusedElement?.focus();
                }, 300);
            }
        }
    };

    // ====================================================
    // Optimized Gallery Module
    // ====================================================

    let galleryOverlay = null;

    const Gallery = {
        _preloadedImageCache: {},
        _preloadingInProgress: {},

        _clearPreloadCache: function() {
            for (const index in Gallery._preloadedImageCache) {
                const cachedItem = Gallery._preloadedImageCache[index];
                if (typeof cachedItem === 'string' && cachedItem.startsWith('blob:')) {
                    try { URL.revokeObjectURL(cachedItem); } catch (e) { /* silent */ }
                }
            }
            Gallery._preloadedImageCache = {};
            Gallery._preloadingInProgress = {};

            for (const blobUrl of loadedBlobUrls.values()) {
                if (typeof blobUrl === 'string' && blobUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(blobUrl); } catch (e) { /* silent */ }
                }
            }
            loadedBlobUrls.clear();
            loadedBlobs.clear();
        },

        _fetchAndCacheImage: async function(indexToPreload, sessionId = null) {
            if (indexToPreload < 0 || indexToPreload >= state.originalImageSrcs.length) return;
            if (Gallery._preloadedImageCache[indexToPreload] || Gallery._preloadingInProgress[indexToPreload]) return;

            const mediaItem = state.originalImageSrcs[indexToPreload];
            if (!mediaItem || mediaItem.type !== 'image') return;

            if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                return;
            }

            const originalImageUrl = mediaItem.src;
            if (!originalImageUrl) return;

            Gallery._preloadingInProgress[indexToPreload] = true;
            let blobToCache = null;
            let loadedFromPersistentCache = false;

            try {
                if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                    return;
                }

                if (state.enablePersistentCaching && db) {
                    const cachedBlob = await getImageFromDexie(originalImageUrl);
                    if (cachedBlob) {
                        blobToCache = cachedBlob;
                        loadedFromPersistentCache = true;
                    }
                }

                if (!blobToCache) {
                    blobToCache = await new Promise((resolve, reject) => {
                        if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                            reject(new Error('Stale session'));
                            return;
                        }
                        GM.xmlHttpRequest({
                            method: 'GET', url: originalImageUrl, responseType: 'blob',
                            onload: r => (r.status === 200 || r.status === 206) ? resolve(r.response) : reject(new Error(`HTTP ${r.status}`)),
                            onerror: reject
                        });
                    });
                    if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                         return;
                    } else {
                         if (blobToCache && state.enablePersistentCaching && db && !loadedFromPersistentCache) {
                             await storeImageInDexie(originalImageUrl, blobToCache);
                         }
                    }
                }

                if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                    Gallery._preloadedImageCache[indexToPreload] = 'failed_preload';
                    delete Gallery._preloadingInProgress[indexToPreload];
                    return;
                }

                if (blobToCache) {
                    Gallery._preloadedImageCache[indexToPreload] = URL.createObjectURL(blobToCache);
                } else {
                    Gallery._preloadedImageCache[indexToPreload] = 'failed_preload';
                }
            } catch (error) {
                if (error.message === 'Stale session') {
                    delete Gallery._preloadingInProgress[indexToPreload];
                    return;
                }
                console.error(`Ultra Galleries: Error preloading image ${originalImageUrl} (index ${indexToPreload}):`, error);
                Gallery._preloadedImageCache[indexToPreload] = 'failed_preload';
            } finally {
                if (Gallery._preloadingInProgress[indexToPreload] !== undefined) {
                     delete Gallery._preloadingInProgress[indexToPreload];
                }
            }
        },

        _preloadAdjacentImages: function(currentIndex) {
            const sessionId = state.currentLoadSessionId;
            for (let i = 1; i <= CONFIG.PRELOAD_DISTANCE; i++) {
                Gallery._fetchAndCacheImage(currentIndex + i, sessionId);
                Gallery._fetchAndCacheImage(currentIndex - i, sessionId);
            }
        },

        _createGalleryOverlayAndContainer: function() {
            galleryOverlay = $('<div>').attr('id', 'gallery-overlay').addClass(CSS.GALLERY.OVERLAY);
            const $container = $('<div>').addClass(CSS.GALLERY.CONTAINER).appendTo(galleryOverlay);
            return $container;
        },

        _createBaseViews: function($galleryContentContainer) {
            const $gridView = $('<div>').addClass(CSS.GALLERY.GRID_VIEW).appendTo($galleryContentContainer);
            const $expandedView = $('<div>').addClass(CSS.GALLERY.EXPANDED_VIEW).addClass(CSS.GALLERY.HIDE).appendTo($galleryContentContainer);
            return { $gridView, $expandedView };
        },

        _createGridViewContent: function($gridViewElement) {
            const $thumbnailGrid = $('<div>').addClass(CSS.GALLERY.THUMBNAIL_GRID).appendTo($gridViewElement);
            $('<button>')
                .text(BUTTONS.CLOSE).addClass(CSS.GALLERY.GRID_CLOSE)
                .attr('aria-label', 'Close Gallery').on('click', Gallery.closeGallery)
                .appendTo($gridViewElement);
            return $thumbnailGrid;
        },

        _createExpandedViewToolbar: function($expandedViewElement) {
            const $toolbar = $('<div>').addClass(CSS.GALLERY.TOOLBAR).on('mousedown', e => e.stopPropagation());

            // Reset button
            $('<button>').attr({id: 'reset-btn', title: 'Reset Zoom & Position'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .text('Reset').on('click', Zoom.resetZoom).appendTo($toolbar);

            // Zoom controls with properly sized inline SVGs
            const $zoomControls = $('<div>').addClass('zoom-controls').appendTo($toolbar);
            
            // Zoom out button with fixed inline SVG
            const $zoomOutBtn = $('<button>').attr({id: 'zoom-out-btn', title: 'Zoom Out'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .on('click', () => Zoom.zoom(-CONFIG.ZOOM_STEP)).appendTo($zoomControls);
            $zoomOutBtn.html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path><line x1="8" y1="11" x2="14" y2="11"></line></svg>');
            
            $('<span>').attr('id', 'zoom-level').addClass('zoom-level').text('100%').appendTo($zoomControls);
            
            // Zoom in button with inline SVG
            const $zoomInBtn = $('<button>').attr({id: 'zoom-in-btn', title: 'Zoom In'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .on('click', () => Zoom.zoom(CONFIG.ZOOM_STEP)).appendTo($zoomControls);
            $zoomInBtn.html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>');

            // Rotation controls
            if (state.enableImageRotation) {
                const $rotationControls = $('<div>').addClass('rotation-controls').appendTo($toolbar);
                
                const $rotateLeftBtn = $('<button>').attr({id: 'rotate-left-btn', title: 'Rotate Left'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                    .on('click', () => Zoom.rotate(-1)).appendTo($rotationControls);
                $rotateLeftBtn.html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>');
                
                const $rotateRightBtn = $('<button>').attr({id: 'rotate-right-btn', title: 'Rotate Right'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                    .on('click', () => Zoom.rotate(1)).appendTo($rotationControls);
                $rotateRightBtn.html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>');
            }

            // Fullscreen button
            $('<button>').text(BUTTONS.FULLSCREEN).addClass(CSS.GALLERY.FULLSCREEN).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .attr('aria-label', 'Toggle Fullscreen').on('click', Gallery.toggleFullscreen)
                .appendTo($toolbar);

            // Close button
            $('<button>').addClass(CSS.GALLERY.TOOLBAR_BTN).text(BUTTONS.CLOSE)
                .attr('aria-label', 'Close Expanded View').on('click', Gallery.showGridView)
                .appendTo($toolbar);

            $expandedViewElement.append($toolbar);
        },

        _createExpandedViewMainImageArea: function($expandedViewElement) {
            const $zoomContainer = $('<div>').addClass(CSS.GALLERY.ZOOM_CONTAINER).appendTo($expandedViewElement);
            const $mainImageContainer = $('<div>').addClass(CSS.GALLERY.MAIN_IMG_CONTAINER).addClass('image-container').appendTo($zoomContainer);
            
            // Add rotation container
            const $rotationContainer = $('<div>').addClass(CSS.GALLERY.ROTATION_CONTAINER).appendTo($mainImageContainer);
            
            // Add image info container
            if (state.showImageInfo) {
                const $imageInfo = $('<div>').addClass(CSS.GALLERY.IMAGE_INFO).appendTo($expandedViewElement);
                $imageInfo.text('Loading image info...');
            }
            
            $('<div>').addClass('pan-indicator')
                .css({position:'absolute',top:'15px',left:'15px',zIndex:'10',opacity:'0',transition:'opacity 0.3s ease',pointerEvents:'none'})
                .html(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white" opacity="0.7"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>`)
                .appendTo($mainImageContainer);
            return { $mainImageContainer, $rotationContainer };
        },

        _createExpandedViewNavigationAndCounter: function($expandedViewElement) {
            const $navContainer = $('<div>').addClass(CSS.GALLERY.NAV_CONTAINER).on('mousedown', e => e.stopPropagation());
            if (!state.hideNavArrows) {
                $navContainer.append(UI.createNavigationButton('prev'), UI.createNavigationButton('next'));
            }
            $expandedViewElement.append($navContainer);
            $('<div>').addClass(CSS.GALLERY.COUNTER).addClass(CSS.GALLERY.HIDE).appendTo($expandedViewElement);
        },

        _createExpandedViewThumbnailStrip: function($expandedViewElement) {
            const $thumbnailStripContainer = $('<div>').addClass(CSS.GALLERY.STRIP_CONTAINER)
                .css('display', state.bottomStripeVisible ? 'flex' : 'none')
                .on('mousedown', e => e.stopPropagation()).appendTo($expandedViewElement);
            const $thumbnailStrip = $('<div>').addClass(CSS.GALLERY.THUMBNAIL_STRIP).appendTo($thumbnailStripContainer);
            return $thumbnailStrip;
        },

        _populateAllThumbnails: function($gridThumbnailsContainer, $stripThumbnailsContainer) {
            const gridFragment = document.createDocumentFragment();
            const stripFragment = document.createDocumentFragment();

            state.fullSizeImageSrcs.forEach((mediaItem, index) => {
                if (mediaItem) {
                    const thumbSrc = mediaItem.type === 'video' ? mediaItem.poster : mediaItem.src;

                    const $gridThumbImg = $('<img>').attr('src', thumbSrc).addClass(CSS.GALLERY.THUMBNAIL)
                        .data('index', index).on('click', () => Gallery.showExpandedView(index))
                        .attr('aria-label', `Open media ${index + 1}`);
                    const $gridContainer = $('<div>').addClass(CSS.GALLERY.THUMBNAIL_CONTAINER).append($gridThumbImg);
                    gridFragment.appendChild($gridContainer[0]);

                    const $stripThumbImg = $('<img>').attr('src', thumbSrc).addClass(CSS.GALLERY.THUMBNAIL_ITEM)
                        .data('index', index).on('click', () => Gallery.showExpandedView(index))
                        .attr('aria-label', `Thumbnail ${index + 1}`);
                    stripFragment.appendChild($stripThumbImg[0]);
                }
            });

            $gridThumbnailsContainer[0].appendChild(gridFragment);
            $stripThumbnailsContainer[0].appendChild(stripFragment);
        },

        _setupGalleryInteractions: function($expandedViewElement, $mainImageContainerElement) {
            $mainImageContainerElement.on('wheel', e => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (currentItem && currentItem.type === 'image') {
                    Zoom.handleWheelZoom(e);
                }
            });

            $expandedViewElement.on('mousedown', e => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (currentItem && currentItem.type === 'image') {
                    if ($(e.target).closest(`.${CSS.GALLERY.TOOLBAR}, .${CSS.GALLERY.NAV_CONTAINER}, .${CSS.GALLERY.STRIP_CONTAINER}`).length || e.button === 2) {
                        return;
                    }
                    Zoom.startDrag(e);
                }
            });

            $mainImageContainerElement.on('dblclick', e => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (currentItem && currentItem.type === 'image' && e.button === 0) {
                    if (state.zoomScale > 1) {
                        Zoom.resetZoom();
                    } else {
                        const rect = $mainImageContainerElement[0].getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        state.zoomOrigin = { x: clickX, y: clickY };
                        const newScale = 2.5;
                        const imageX = (clickX - state.imageOffset.x) / state.zoomScale;
                        const imageY = (clickY - state.imageOffset.y) / state.zoomScale;
                        const newOffsetX = clickX - (imageX * newScale);
                        const newOffsetY = clickY - (imageY * newScale);
                        const mainImageDOM = $mainImageContainerElement.find(`.${CSS.GALLERY.MAIN_IMG}`)[0];
                        if (!mainImageDOM) return;
                        const boundedOffset = Zoom.enforceBoundaries(newOffsetX, newOffsetY, newScale, rect, mainImageDOM);

                        Zoom._applyTransition($mainImageContainerElement, () => {
                             state.imageOffset.x = boundedOffset.x;
                             state.imageOffset.y = boundedOffset.y;
                             state.zoomScale = newScale;
                             Zoom.applyZoom();
                        });
                    }
                }
            });

            let controlsTimeout;
            $expandedViewElement.on('mousemove', () => {
                state.controlsVisible = true;
                clearTimeout(controlsTimeout);
                if (state.autoHideControls) {
                    controlsTimeout = setTimeout(() => {
                        if (!state.isDragging && !state.pinchZoomActive) state.controlsVisible = false;
                    }, state.autoHideDelay);
                }
            });
            state.controlsVisible = true;
            clearTimeout(controlsTimeout);
            if (state.autoHideControls) {
                controlsTimeout = setTimeout(() => {
                    if (!state.isDragging && !state.pinchZoomActive) state.controlsVisible = false;
                }, state.autoHideDelay);
            }

            Zoom.setupTouchEvents();

            $(document).on('mousemove.galleryDrag', Zoom.dragImage);
            $(document).on('mouseup.galleryDrag', Zoom.endDrag);
        },

        createGallery: function() {
            if (galleryOverlay && galleryOverlay.length) {
                Gallery.showGridView();
                state.isGalleryMode = true;
                return;
            }

            const fragment = document.createDocumentFragment();
            galleryOverlay = $('<div>').attr('id', 'gallery-overlay').addClass(CSS.GALLERY.OVERLAY);
            const $galleryContentContainer = Gallery._createGalleryOverlayAndContainer();
            const { $gridView, $expandedView } = Gallery._createBaseViews($galleryContentContainer);
            const $gridThumbnailsContainer = Gallery._createGridViewContent($gridView);

            Gallery._createExpandedViewToolbar($expandedView);
            const { $mainImageContainer, $rotationContainer } = Gallery._createExpandedViewMainImageArea($expandedView);
            Gallery._createExpandedViewNavigationAndCounter($expandedView);
            const $stripThumbnailsContainer = Gallery._createExpandedViewThumbnailStrip($expandedView);

            fragment.appendChild(galleryOverlay[0]);
            document.body.appendChild(fragment);

            Gallery._populateAllThumbnails($gridThumbnailsContainer, $stripThumbnailsContainer);
            Gallery._setupGalleryInteractions($expandedView, $mainImageContainer);

            Gallery.showGridView();
            state.isGalleryMode = true;
        },

        showGridView: function() {
            if (!galleryOverlay || !galleryOverlay.length) return;
            galleryOverlay.find(`.${CSS.GALLERY.GRID_VIEW}`).removeClass(CSS.GALLERY.HIDE);
            galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`).addClass(CSS.GALLERY.HIDE);
            Zoom.resetZoom();
            state.isZoomed = false;
            state.controlsVisible = true;
        },

        showExpandedView: function(index) {
            if (!galleryOverlay || !galleryOverlay.length || index < 0 || index >= state.fullSizeImageSrcs.length) return;

            const $mainMediaContainer = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            const $rotationContainer = galleryOverlay.find(`.${CSS.GALLERY.ROTATION_CONTAINER}`);
            const $counter = galleryOverlay.find(`.${CSS.GALLERY.COUNTER}`);
            const $prevButton = galleryOverlay.find(`.${CSS.GALLERY.PREV}`);
            const $nextButton = galleryOverlay.find(`.${CSS.GALLERY.NEXT}`);
            const $thumbnailStrip = galleryOverlay.find(`.${CSS.GALLERY.THUMBNAIL_STRIP}`);
            const $zoomControls = galleryOverlay.find('.zoom-controls');
            const $resetBtn = galleryOverlay.find('#reset-btn');
            const $imageInfo = galleryOverlay.find(`.${CSS.GALLERY.IMAGE_INFO}`);

            if (!$mainMediaContainer.length || !$counter.length) return;

            state.currentGalleryIndex = index;
            const mediaItem = state.fullSizeImageSrcs[index];

            if (!mediaItem) {
                $mainMediaContainer.empty().append($('<div>').addClass(CSS.GALLERY.IMAGE_ERROR_MSG).text('Media not available'));
                $counter.text(`${index + 1} / ${state.fullSizeImageSrcs.length}`);
                Gallery._preloadAdjacentImages(index);
                return;
            }

            $mainMediaContainer.empty();
            $mainMediaContainer.removeClass(CSS.GALLERY.ZOOMED).css({
                width:'100%',
                height:'100%',
                display:'flex',
                justifyContent:'center',
                alignItems:'center',
                overflow:'hidden'
            });
            Zoom.resetZoom();
            state.imageRotation = 0;

            if (mediaItem.type === 'image') {
                $zoomControls.show();
                $resetBtn.show();
                $mainMediaContainer.css('cursor', 'grab');

                const $mainImage = $('<img>').addClass(CSS.GALLERY.MAIN_IMG).appendTo($rotationContainer);
                $mainImage.addClass('loading').removeClass('error').css({
                    maxWidth:'100%',
                    maxHeight:'100%',
                    objectFit:'contain',
                    position:'relative'
                });

                $mainImage.off('load error').on('load', () => {
                    $mainImage.removeClass('loading');
                    Zoom.initializeImage($mainImage[0], $mainMediaContainer[0]);
                    Gallery._preloadAdjacentImages(index);
                    
                    // Update image info
                    if (state.showImageInfo && $imageInfo.length) {
                        const dimensions = Utils.formatImageInfo($mainImage[0]);
                        const fileSize = mediaItem.fileSize ? Utils.formatFileSize(mediaItem.fileSize) : 'Unknown';
                        $imageInfo.text(`${dimensions} | ${fileSize}`);
                    }
                }).on('error', () => {
                    $mainImage.removeClass('loading').addClass('error').attr({
                        src:'',
                        alt:"Error loading image"
                    });
                    $mainMediaContainer.append($('<div>').addClass(CSS.GALLERY.IMAGE_ERROR_MSG).text('Failed to load image'));
                    Gallery._preloadAdjacentImages(index);
                });

                let imageUrlToLoad = Gallery._preloadedImageCache[index] || mediaItem.src;
                $mainImage.attr({
                    src: imageUrlToLoad,
                    alt: `Image ${index + 1}`
                });

            } else if (mediaItem.type === 'video') {
                $zoomControls.hide();
                $resetBtn.hide();
                $mainMediaContainer.css('cursor', 'default');

                const $mainVideo = $('<video>').addClass(CSS.GALLERY.MAIN_VIDEO).appendTo($rotationContainer);
                $mainVideo.attr({
                    src: mediaItem.src,
                    poster: mediaItem.poster,
                    controls: true,
                    autoplay: true,
                    loop: true,
                    muted: true
                });
                
                // Update image info for video
                if (state.showImageInfo && $imageInfo.length) {
                    $imageInfo.text('Video');
                }
            }

            $counter.text(`${index + 1} / ${state.fullSizeImageSrcs.length}`);
            galleryOverlay.find(`.${CSS.GALLERY.GRID_VIEW}`).addClass(CSS.GALLERY.HIDE);
            galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`).removeClass(CSS.GALLERY.HIDE);
            $counter.removeClass(CSS.GALLERY.HIDE);

            if ($thumbnailStrip.length) {
                $thumbnailStrip.find(`.${CSS.GALLERY.THUMBNAIL_ITEM}.selected`).removeClass('selected');
                const $currentThumbInStrip = $thumbnailStrip.find(`.${CSS.GALLERY.THUMBNAIL_ITEM}[data-index="${index}"]`);
                if ($currentThumbInStrip.length) {
                    $currentThumbInStrip.addClass('selected');
                    const stripWidth = $thumbnailStrip.width();
                    const thumbOffsetLeft = $currentThumbInStrip[0].offsetLeft;
                    const thumbWidth = $currentThumbInStrip.outerWidth();
                    $thumbnailStrip.scrollLeft(thumbOffsetLeft - (stripWidth / 2) + (thumbWidth / 2));
                }
            }

            if (!state.hideNavArrows && $prevButton.length && $nextButton.length) {
                $prevButton.toggleClass(CSS.GALLERY.HIDE, index === 0);
                $nextButton.toggleClass(CSS.GALLERY.HIDE, index === state.fullSizeImageSrcs.length - 1);
            }
            state.controlsVisible = true;
        },

        closeGallery: function() {
            if (!galleryOverlay || !galleryOverlay.length) return;
            state.isGalleryMode = false;
            state.isFullscreen = false;

            Gallery._clearPreloadCache();
            galleryOverlay.remove();
            galleryOverlay = null;

            $(document).off('.galleryDrag');
        },

        toggleGallery: function() {
            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else {
                if (state.galleryReady && state.fullSizeImageSrcs.length > 0) {
                    Gallery.createGallery();
                } else if (!state.galleryReady) {
                    state.notification = "Gallery is still loading media."; state.notificationType = "info";
                } else {
                    state.notification = "No media to display in gallery."; state.notificationType = "info";
                }
            }
        },

        toggleFullscreen: function() {
            state.isFullscreen = !state.isFullscreen;
        },

        nextImage: function() {
            if (state.fullSizeImageSrcs.length === 0) return;
            let newIndex = (state.currentGalleryIndex + 1) % state.fullSizeImageSrcs.length;
            Gallery.showExpandedView(newIndex);
        },

        prevImage: function() {
            if (state.fullSizeImageSrcs.length === 0) return;
            let newIndex = (state.currentGalleryIndex - 1 + state.fullSizeImageSrcs.length) % state.fullSizeImageSrcs.length;
            Gallery.showExpandedView(newIndex);
        },

        createVirtualGallery: function() {
            Gallery.cleanupVirtualGallery();
            elements.virtualGalleryContainer = document.createElement('div');
            elements.virtualGalleryContainer.style.display = 'none';
            state.virtualGallery.forEach(mediaSrc => {
                if (mediaSrc) {
                    const mediaElement = document.createElement('img');
                    mediaElement.src = mediaSrc;
                    mediaElement.className = CSS.VIRTUAL_IMAGE;
                    elements.virtualGalleryContainer.appendChild(mediaElement);
                }
            });
            document.body.appendChild(elements.virtualGalleryContainer);
        },

        cleanupVirtualGallery: function() {
            if (elements.virtualGalleryContainer) {
                elements.virtualGalleryContainer.remove();
                elements.virtualGalleryContainer = null;
            }
        }
    };

    // ====================================================
    // Optimized Image Loading Module
    // ====================================================

    let loadedBlobUrls = new Map();
    let loadedBlobs = new Map();

    const ImageLoader = {
        imageActions: {
            height: img => Utils.setImageStyle(img, { maxHeight: '100vh', maxWidth: '100%', width: 'auto', height: 'auto' }),
            width: img => Utils.setImageStyle(img, { maxHeight: '100%', maxWidth: '100vw', width: 'auto', height: 'auto' }),
            full: img => Utils.setImageStyle(img, { maxHeight: 'none', maxWidth: 'none', height: 'auto', width: 'auto' }),
        },

        simulateScrollDown: async () => {
            return new Promise(resolve => {
                const images = document.querySelectorAll(`${SELECTORS.IMAGE_LINK} img, ${SELECTORS.MAIN_THUMBNAIL} img`);
                if (images.length === 0) {
                    resolve();
                    return;
                }
                let loadedCount = 0;
                const checkAllLoaded = () => {
                    loadedCount++;
                    if (loadedCount >= images.length) resolve();
                };
                const observer = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            observer.unobserve(entry.target);
                            checkAllLoaded();
                        }
                    });
                });
                images.forEach(img => observer.observe(img));
                setTimeout(resolve, 2000);
            });
        },

        handleImageError: (mediaSrc, reject) => {
            console.error(`Image failed to load: ${mediaSrc}`);
            reject(new Error(`Failed to load image: ${mediaSrc}`));
        },

        handleImageFetchError: (mediaSrc, status, reject, error = null) => {
            console.error(`Failed to fetch image (status ${status}): ${mediaSrc}`, error);
            reject(new Error(`Failed to fetch image (${status}): ${mediaSrc}`));
        },

        fetchWithRetry: async (url, sessionId, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) => {
            try {
                return await new Promise((resolve, reject) => {
                    if (state.currentLoadSessionId !== sessionId) reject(new Error('Stale session'));

                    GM.xmlHttpRequest({
                        method: 'GET',
                        url: url,
                        responseType: 'blob',
                        timeout: 10000,
                        onload: (response) => {
                            if (response.status === 200 || response.status === 206) {
                                resolve(response.response);
                            } else {
                                reject(new Error(`HTTP ${response.status}`));
                            }
                        },
                        onerror: (error) => reject(error),
                        ontimeout: () => reject(new Error('Request timeout'))
                    });
                });
            } catch (err) {
                if (err.message === 'Stale session') throw err;
                if (retries <= 0) throw err;

                console.log(`Retrying fetch for ${url}, ${retries} attempts remaining`);
                await Utils.delay(delay);
                return ImageLoader.fetchWithRetry(url, sessionId, retries - 1, delay * 1.5);
            }
        },

        loadImageAndApplyToPage: async (linkElement, galleryIndex, posterHref, isUniqueForGallery, sessionId, itemData) => {
            const imgElement = linkElement.querySelector('img');
            if (!imgElement) {
                if (state.currentLoadSessionId === sessionId) state.loadedImages++;
                return;
            }

            if (!imgElement.classList.contains('post__image')) {
                imgElement.classList.add('post__image');
            }

            const cacheKey = itemData.originalUrl;
            let blobToStore = loadedBlobs.get(cacheKey);
            let blobUrlToUse = loadedBlobUrls.get(posterHref);

            if (!blobToStore) {
                try {
                    if (state.currentLoadSessionId !== sessionId) throw new Error('Stale session');

                    if (state.enablePersistentCaching && db) {
                        const cachedBlob = await getImageFromDexie(cacheKey);
                        if (cachedBlob) blobToStore = cachedBlob;
                    }

                    if (!blobToStore) {
                        blobToStore = await ImageLoader.fetchWithRetry(cacheKey, sessionId);

                        if (state.currentLoadSessionId !== sessionId) return;

                        if (blobToStore && state.enablePersistentCaching && db && !loadedFromPersistentCache) {
                            await storeImageInDexie(cacheKey, blobToStore);
                        }
                    }

                    if (state.currentLoadSessionId !== sessionId) return;
                    if (!blobToStore) throw new Error("Blob could not be obtained for " + cacheKey);

                    loadedBlobs.set(cacheKey, blobToStore);
                } catch (error) {
                    if (error.message === 'Stale session') throw error;
                    if (state.currentLoadSessionId === sessionId) {
                        console.error(`Ultra Galleries: Failed to load media: ${cacheKey}`, error);
                        state.errorCount++;
                        state.loadedImages++;
                    }
                    return;
                }
            }

            if (!blobUrlToUse) {
                if (posterHref === cacheKey) {
                    blobUrlToUse = URL.createObjectURL(blobToStore);
                } else {
                    try {
                        const posterBlob = await ImageLoader.fetchWithRetry(posterHref, sessionId);
                        blobUrlToUse = URL.createObjectURL(posterBlob);
                    } catch(e) {
                        console.error(`Failed to load video poster: ${posterHref}`, e);
                        blobUrlToUse = '';
                    }
                }
                loadedBlobUrls.set(posterHref, blobUrlToUse);
            }

            if (state.currentLoadSessionId !== sessionId) return;

            imgElement.src = blobUrlToUse;
            imgElement.dataset.originalSrc = cacheKey;
            imgElement.classList.add('ug-image-loaded');

            if (isUniqueForGallery) {
                if (itemData.type === 'video') {
                    state.fullSizeImageSrcs[galleryIndex] = {
                        type: 'video',
                        src: cacheKey,
                        poster: blobUrlToUse
                    };
                } else {
                    state.fullSizeImageSrcs[galleryIndex] = {
                        type: 'image',
                        src: URL.createObjectURL(blobToStore),
                        originalSrc: cacheKey,
                        fileSize: blobToStore.size
                    };
                }

                state.originalImageSrcs[galleryIndex] = {
                    src: cacheKey,
                    type: itemData.type,
                    fileName: linkElement.getAttribute('download') || cacheKey.split('/').pop()
                };

                state.mediaLoaded[galleryIndex] = true;
            }
            state.loadedImages++;
        },

        collectUniqueMediaItems: (postContainer) => {
            const uniqueGalleryItems = new Map();
            const mediaSelectors = [SELECTORS.IMAGE_LINK, SELECTORS.ATTACHMENT_LINK, SELECTORS.VIDEO_LINK];

            postContainer.querySelectorAll(mediaSelectors.join(', ')).forEach(linkElement => {
                const isVideo = linkElement.matches(SELECTORS.VIDEO_LINK);
                const isAttachment = linkElement.matches(SELECTORS.ATTACHMENT_LINK);
                let url, poster, type = 'image';

                if (isVideo) {
                    type = 'video';
                    url = linkElement.getAttribute('href')?.split('?')[0];
                    poster = linkElement.querySelector('img, video')?.getAttribute('poster') || linkElement.querySelector('img')?.src;
                    if (!url || !poster) return;
                    if (!uniqueGalleryItems.has(url)) {
                        uniqueGalleryItems.set(url, { linkElement, originalUrl: url, posterUrl: poster, type: 'video' });
                    }
                } else {
                    url = Utils.handleMediaSrc(linkElement);
                    if (!url) return;
                    if (isAttachment && !/\.(jpe?g|png|gif|webp)$/i.test(linkElement.getAttribute('download') || url)) return;
                    if (!uniqueGalleryItems.has(url)) {
                        uniqueGalleryItems.set(url, { linkElement, originalUrl: url, posterUrl: url, type: 'image' });
                    }
                }
            });

            return uniqueGalleryItems;
        },

        processItemsInBatches: async (items, sessionId) => {
            const batchSize = CONFIG.BATCH_SIZE;
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);

                const batchPromises = batch.map((item, index) => {
                    if (state.currentLoadSessionId !== sessionId) return Promise.resolve();
                    return ImageLoader.loadImageAndApplyToPage(
                        item.linkElement,
                        i + index,
                        item.posterUrl,
                        true,
                        sessionId,
                        item
                    ).catch(error => {
                        if (error.message !== 'Stale session') console.error("An item failed to process:", error);
                    });
                });

                await Promise.all(batchPromises);

                if (i + batchSize < items.length) {
                    await Utils.delay(50);
                }
            }
        },

        updateFinalStatus: () => {
            if (state.loadedImages === state.totalImages && state.totalImages > 0 && state.errorCount === 0) {
                state.notification = `Media Done Loading! Total: ${state.totalImages}`;
                state.notificationType = 'success';
            } else if (state.errorCount > 0) {
                state.notification = `Gallery: ${state.errorCount} error(s). Loaded: ${state.loadedImages}/${state.totalImages} items.`;
                state.notificationType = 'warning';
            } else if (state.loadedImages < state.totalImages && state.totalImages > 0) {
                state.notification = `Gallery: Partially loaded (${state.loadedImages}/${state.totalImages} items).`;
                state.notificationType = 'warning';
            } else if (state.totalImages === 0) {
                state.notification = 'No media found for gallery.';
                state.notificationType = 'info';
            }
        },

        loadImages: async () => {
            const postContainer = document.querySelector('section.site-section--post');
            if (!postContainer || !Utils.isPostPage() || state.isLoading) return;

            const sessionId = Date.now();
            state.currentLoadSessionId = sessionId;

            try {
                state.isLoading = true;
                await Utils.delay(16);

                if (state.currentLoadSessionId !== sessionId) return;
                state.loadingMessage = 'Loading Media...';

                loadedBlobUrls.clear();
                loadedBlobs.clear();
                Object.assign(state, {
                    fullSizeImageSrcs: [],
                    originalImageSrcs: [],
                    virtualGallery: [],
                    loadedImages: 0,
                    mediaLoaded: {},
                    errorCount: 0
                });

                const uniqueGalleryItems = ImageLoader.collectUniqueMediaItems(postContainer);

                if (state.currentLoadSessionId !== sessionId) return;

                const uniqueItems = Array.from(uniqueGalleryItems.values());
                state.totalImages = uniqueItems.length;
                state.hasImages = state.totalImages > 0;

                state.fullSizeImageSrcs = Array(uniqueItems.length).fill(null);
                state.originalImageSrcs = Array(uniqueItems.length).fill(null);

                await ImageLoader.simulateScrollDown();
                Utils.ensureThumbnailsExist();

                await ImageLoader.processItemsInBatches(uniqueItems, sessionId);

                if (state.currentLoadSessionId !== sessionId) return;

                ImageLoader.updateFinalStatus();

                state.galleryReady = true;
                state.isLoading = false;
                state.loadingMessage = null;

            } catch (error) {
                if (state.currentLoadSessionId === sessionId) {
                    console.error('Critical Error in ImageLoader.loadImages:', error);
                    state.notification = 'Critical error loading media for gallery. Please refresh.';
                    state.notificationType = 'error';
                    state.isLoading = false;
                    state.loadingMessage = null;
                    state.galleryReady = false;
                }
            }
        },
    };

    // ====================================================
    // Optimized Download Management
    // ====================================================

    const DownloadManager = {
        _worker: null,

        downloadAllImages: async () => {
            if (state.isDownloading) {
                Swal.fire('Download in Progress', 'A download is already running.', 'info');
                return;
            }

            try {
                const title = document.querySelector(SELECTORS.POST_TITLE)?.textContent?.trim() || 'Untitled';
                const artistName = document.querySelector(SELECTORS.POST_USER_NAME)?.textContent?.trim() || 'Unknown Artist';

                const itemsToProcess = [];
                const processedBlobs = new Set();

                document.querySelectorAll(`${SELECTORS.IMAGE_LINK}, ${SELECTORS.ATTACHMENT_LINK}, ${SELECTORS.VIDEO_LINK}`).forEach((link, index) => {
                    const url = link.href.split('?')[0];
                    const blob = loadedBlobs.get(url);

                    if (blob && !processedBlobs.has(blob)) {
                        const originalName = link.getAttribute('download') || url.split('/').pop() || `media-${index + 1}`;
                        itemsToProcess.push({ blob: blob, originalName, index });
                        processedBlobs.add(blob);
                    }
                });

                if (itemsToProcess.length === 0) {
                    state.notification = 'No loaded media found to download.';
                    state.notificationType = 'warning';
                    return;
                }

                const result = await Swal.fire({
                    title: 'Download All?',
                    text: `You are about to create a ZIP file from ${itemsToProcess.length} preloaded item(s).`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Create ZIP',
                    cancelButtonText: 'Cancel',
                });
                if (!result.isConfirmed) return;

                state.isDownloading = true;
                state.notification = 'Starting download...';

                const workerCode = `
                    self.onmessage = async (e) => {
                        const {
                            itemsToProcess, imageFileNameFormat, title, artistName, jszipUrl
                        } = e.data;

                        try {
                            importScripts(jszipUrl);
                            const zip = new self.JSZip();
                            let filesAdded = 0;

                            for (const item of itemsToProcess) {
                                let fileBlob = item.blob;
                                let correctExt = item.originalName.split('.').pop().toLowerCase() || 'jpg';

                                const fileNameWithoutExt = item.originalName.replace(/\\.[^/.]+$/, "");
                                let pathInZip = imageFileNameFormat
                                    .replace('{title}', title.replace(/[/\\\\:*?\\"<>|]/g, '-'))
                                    .replace('{artistName}', artistName.replace(/[/\\\\:*?\\"<>|]/g, '-'))
                                    .replace('{fileName}', fileNameWithoutExt.replace(/[/\\\\:*?\\"<>|]/g, '-'))
                                    .replace('{index}', item.index + 1)
                                    .replace('{ext}', correctExt);

                                if (!pathInZip.toLowerCase().endsWith(\`.\${correctExt}\`)) pathInZip += \`.\${correctExt}\`;
                                zip.file(pathInZip, fileBlob);
                                filesAdded++;

                                self.postMessage({
                                    type: 'progress',
                                    message: \`Added \${filesAdded}/\${itemsToProcess.length} files\`
                                });
                            }

                            self.postMessage({ type: 'progress', message: 'Bundling files...' });

                            const zipBlob = await zip.generateAsync({
                                type: 'blob',
                                compression: "STORE"
                            }, (meta) => {
                                self.postMessage({
                                    type: 'progress',
                                    message: \`Bundling... \${Math.round(meta.percent)}%\`
                                });
                            });

                            self.postMessage({ type: 'complete', zipBlob: zipBlob });
                        } catch (error) {
                            self.postMessage({ type: 'error', message: 'Worker error: ' + error.message });
                        }
                    };
                `;

                const blob = new Blob([workerCode], { type: 'application/javascript' });
                DownloadManager._worker = new Worker(URL.createObjectURL(blob));

                DownloadManager._worker.onmessage = (e) => {
                    const { type, message, zipBlob } = e.data;
                    switch (type) {
                        case 'progress':
                            state.notification = message;
                            state.notificationType = 'info';
                            break;
                        case 'complete':
                            const sanitizedTitle = Utils.sanitizeFileName(title);
                            const sanitizedArtistName = Utils.sanitizeFileName(artistName);
                            let zipFileName = state.zipFileNameFormat.replace('{artistName}', sanitizedArtistName).replace('{title}', sanitizedTitle);
                            if (!zipFileName.toLowerCase().endsWith('.zip')) zipFileName += '.zip';
                            saveAs(zipBlob, zipFileName);
                            state.notification = 'Download complete!';
                            state.notificationType = 'success';
                            DownloadManager.cleanupWorker();
                            break;
                        case 'error':
                        case 'warning':
                            console.error('Error from worker:', message);
                            state.notification = `Download failed: ${message}`;
                            state.notificationType = 'error';
                            DownloadManager.cleanupWorker();
                            break;
                    }
                };

                DownloadManager._worker.onerror = (e) => {
                    console.error(`Error in worker: ${e.message}`, e);
                    state.notification = 'A critical worker error occurred. See console.';
                    state.notificationType = 'error';
                    DownloadManager.cleanupWorker();
                };

                DownloadManager._worker.postMessage({
                    itemsToProcess,
                    imageFileNameFormat: state.imageFileNameFormat,
                    title: title,
                    artistName: artistName,
                    jszipUrl: 'https://unpkg.com/jszip@3.9.1/dist/jszip.min.js'
                });

            } catch (error) {
                console.error('Error initializing download process:', error);
                Swal.fire('Error!', `Failed to start download process: ${error.message}`, 'error');
                DownloadManager.cleanupWorker();
            }
        },

        cleanupWorker: () => {
            if (DownloadManager._worker) {
                DownloadManager._worker.terminate();
                DownloadManager._worker = null;
            }
            state.isDownloading = false;
        },

        downloadImageByIndex: async (index) => {
            const originalItem = state.originalImageSrcs[index];
            if (!originalItem || !originalItem.src) {
                Swal.fire('Error!', 'Media source not found.', 'error');
                return;
            }

            const blob = loadedBlobs.get(originalItem.src);
            const fileName = Utils.sanitizeFileName(originalItem.fileName || `media_${index + 1}`);

            if (blob) {
                saveAs(blob, fileName);
            } else {
                 try {
                     state.notificationType = 'info';
                     state.notification = `Downloading ${fileName}...`;
                     const response = await new Promise((resolve, reject) => {
                        GM.xmlHttpRequest({
                            method: 'GET', url: originalItem.src, responseType: 'blob',
                            onload: (r) => (r.status === 200 || r.status === 206) ? resolve(r.response) : reject(new Error(`HTTP ${r.status}`)),
                            onerror: reject
                        });
                    });
                    saveAs(response, fileName);

                    state.notificationType = 'success';
                    state.notification = `Downloaded: ${fileName}`;

                } catch (error) {
                    console.error('Error downloading individual media:', error);
                    Swal.fire('Error!', `Failed to download media: ${error.message}`, 'error');
                }
            }
        },
    };

    // ====================================================
    // Post Actions Management
    // ====================================================

    let elements = {
        loadingOverlay: null,
        virtualGalleryContainer: null,
        postActions: null,
        statusContainer: null,
        statusElement: null,
        galleryButton: null,
        settingsButton: null,
    };

    let galleryKeyListenerAttached = false;
    let previousPageUrl = null;
    let uiCache = {};

    const PostActions = {
        imageLinkClickHandler: event => {
            if (event.button !== 0) return;
            const clickedImageLink = event.target.closest(SELECTORS.IMAGE_LINK) || event.target.closest(SELECTORS.VIDEO_LINK);
            if (clickedImageLink) {
                event.preventDefault();
                event.stopPropagation();
            }
        },

        initPostActions: () => {
            try {
                const postActionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);
                if (!postActionsContainer) return;

                const globalButtons = document.createElement('div');
                globalButtons.className = 'ug-injected-ui';
                elements.galleryButton = UI.createToggleButton('Loading Gallery...', Gallery.toggleGallery, true);
                elements.galleryButton.dataset.action = "gallery";
                globalButtons.append(
                    UI.createToggleButton(BUTTONS.HEIGHT, () => PostActions.resizeAllImages('height')),
                    UI.createToggleButton(BUTTONS.WIDTH, () => PostActions.resizeAllImages('width')),
                    UI.createToggleButton(BUTTONS.FULL, () => PostActions.resizeAllImages('full')),
                    UI.createToggleButton(BUTTONS.DOWNLOAD_ALL, DownloadManager.downloadAllImages),
                    elements.galleryButton
                );
                postActionsContainer.append(globalButtons);

                if (!document.querySelector('.settings-button-wrapper')) {
                    const settingsButton = document.createElement('button');
                    settingsButton.textContent = BUTTONS.SETTINGS;
                    settingsButton.className = 'settings-button';
                    settingsButton.addEventListener('click', () => { state.settingsOpen = !state.settingsOpen; });
                    const wrapper = document.createElement('div');
                    wrapper.className = 'settings-button-wrapper ug-injected-ui';
                    wrapper.appendChild(settingsButton);
                    document.body.appendChild(wrapper);
                    elements.settingsButton = wrapper;
                }

                const filesArea = document.querySelector('div.post__files');
                if (filesArea) {
                    filesArea.querySelectorAll(SELECTORS.FILE_DIVS).forEach(thumbnailDiv => {
                        const imgElement = thumbnailDiv.querySelector('img');
                        if (!imgElement) return;

                        imgElement.classList.add('post__image');

                        const buttonGroupConfig = [
                            { text: BUTTONS.HEIGHT, action: PostActions.resizeImage, name: 'HEIGHT' },
                            { text: BUTTONS.WIDTH, action: PostActions.resizeImage, name: 'WIDTH' },
                            { text: BUTTONS.FULL, action: () => ImageLoader.imageActions.full(imgElement), name: 'FULL' },
                            {
                                text: BUTTONS.DOWNLOAD, action: () => {
                                    const link = imgElement.closest('a');
                                    const originalSrc = link ? (link.href.split('?')[0]) : imgElement.dataset.originalSrc;
                                    const downloadIndex = state.originalImageSrcs.findIndex(item => item && item.src === originalSrc);
                                    if (downloadIndex > -1) {
                                        DownloadManager.downloadImageByIndex(downloadIndex);
                                    } else {
                                        console.error("Download (per-image): Could not find media index for src:", originalSrc);
                                    }
                                }, name: 'DOWNLOAD'
                            },
                        ];

                        const buttonGroupElement = UI.createButtonGroup(buttonGroupConfig);
                        if (buttonGroupElement.childElementCount > 0) {
                            buttonGroupElement.classList.add('ug-injected-ui');
                            thumbnailDiv.parentNode.insertBefore(buttonGroupElement, thumbnailDiv);
                        }
                    });

                    if (!filesArea.dataset.ugLeftClickHandlerAttached) {
                        filesArea.addEventListener('click', PostActions.imageLinkClickHandler);
                        filesArea.dataset.ugLeftClickHandlerAttached = "true";
                    }
                }

                ImageLoader.loadImages();
                state.postActionsInitialized = true;
                state.currentPostUrl = window.location.href;

            } catch (error) {
                console.error('Error initializing post actions:', error);
                state.notification = 'Error initializing UI. Try refreshing the page.';
                state.notificationType = 'error';
            }
        },

        cleanupPostActions: () => {
            UI.forceHideNotification();

            document.querySelectorAll('img.post__image.ug-image-loaded').forEach(img => {
                img.classList.remove('ug-image-loaded');
            });

            document.querySelectorAll('.ug-injected-ui').forEach(el => el.remove());

            const notifArea = document.getElementById(CSS.NOTIF_AREA);
            if (notifArea) {
                notifArea.remove();
            }
            UI.hideLoadingOverlay();

            const filesArea = document.querySelector('div.post__files');
            if (filesArea) {
                filesArea.removeEventListener('click', PostActions.imageLinkClickHandler);
                filesArea.removeAttribute('data-ug-leftClickHandler-attached');
            }

            for (const blobUrl of loadedBlobUrls.values()) {
                try { URL.revokeObjectURL(blobUrl); } catch (e) { /* silent */ }
            }
            loadedBlobUrls.clear();
            loadedBlobs.clear();

            state.notification = null;
            Object.assign(state, {
                fullSizeImageSrcs: [],
                originalImageSrcs: [],
                virtualGallery: [],
                currentPostUrl: null,
                galleryReady: false,
                loadedImages: 0,
                totalImages: 0,
                mediaLoaded: {},
                errorCount: 0,
                postActionsInitialized: false,
                currentLoadSessionId: null,
                isLoading: false,
                loadingMessage: null
            });
            elements = {};
        },

        resizeAllImages: action => {
            if (!ImageLoader.imageActions[action]) return;
            document.querySelectorAll('img.post__image').forEach(img => {
                ImageLoader.imageActions[action](img);
            });
        },

        resizeImage: evt => {
            const actionText = evt.currentTarget.textContent;
            const action = Object.keys(BUTTONS).find(key => BUTTONS[key] === actionText)?.toLowerCase();
            if (!action || !ImageLoader.imageActions[action]) return;

            const buttonContainer = evt.currentTarget.closest(`.${CSS.BTN_CONTAINER}`);
            if (!buttonContainer) return;

            const imageOwningThumbnailDiv = buttonContainer.nextElementSibling;
            if (!imageOwningThumbnailDiv) return;

            const displayedImage = imageOwningThumbnailDiv.querySelector('img.post__image');
            if (!displayedImage) return;

            ImageLoader.imageActions[action](displayedImage);
        },
    };

    // ====================================================
    // Event Handlers
    // ====================================================

    const EventHandlers = {
        handleGlobalKeyDown: event => {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName));

            if (isTyping || !state.enableKeyboardShortcuts) {
                return;
            }

            const keyLower = event.key.toLowerCase();

            if (Utils.isPostPage() && keyLower === state.galleryKey.toLowerCase()) {
                if (!event.altKey && !event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    if (state.galleryReady) {
                        Gallery.toggleGallery();
                    } else {
                        state.notification = "Gallery content is still loading or not available.";
                        state.notificationType = "info";
                    }
                }
                return;
            }

            if (state.settingsOpen && event.key === 'Escape') {
                event.preventDefault();
                state.settingsOpen = false;
                return;
            }

            if (state.isGalleryMode && galleryOverlay?.length) {
                const $expandedView = galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`);

                if (event.key === 'Escape') {
                    event.preventDefault();
                    if (!$expandedView.hasClass(CSS.GALLERY.HIDE)) {
                        Gallery.showGridView();
                    } else {
                        Gallery.closeGallery();
                    }
                    return;
                }

                if (!$expandedView.hasClass(CSS.GALLERY.HIDE)) {
                    if (keyLower === state.nextImageKey.toLowerCase() || keyLower === 'arrowright') {
                        event.preventDefault();
                        Gallery.nextImage();
                    } else if (keyLower === state.prevImageKey.toLowerCase() || keyLower === 'arrowleft') {
                        event.preventDefault();
                        Gallery.prevImage();
                    }
                    const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                    if (currentItem && currentItem.type === 'image') {
                         if (keyLower === '+' || keyLower === '=') {
                            event.preventDefault();
                            Zoom.zoom(CONFIG.ZOOM_STEP);
                        } else if (keyLower === '-') {
                            event.preventDefault();
                            Zoom.zoom(-CONFIG.ZOOM_STEP);
                        } else if (keyLower === '0') {
                            event.preventDefault();
                            Zoom.resetZoom();
                        } else if (state.enableImageRotation) {
                            if (keyLower === 'r') {
                                event.preventDefault();
                                Zoom.rotate(1);
                            } else if (keyLower === 'e') {
                                event.preventDefault();
                                Zoom.rotate(-1);
                            }
                        }
                    }
                }
            }
        },

        handleWindowResize: Utils.debounce(() => {
            if (!galleryOverlay || !galleryOverlay.length || !state.isGalleryMode) return;
            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const newWidth = $container.width();
            const newHeight = $container.height();
            if (newWidth !== state.lastWidth || newHeight !== state.lastHeight) {
                state.lastWidth = newWidth;
                state.lastHeight = newHeight;
                const $expandedView = galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`);
                const $mainImage = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG}`);
                if ($expandedView.length && !$expandedView.hasClass(CSS.GALLERY.HIDE) && $mainImage.length && $mainImage.attr('src')) {
                    Zoom.initializeImage($mainImage[0], $container[0]);
                } else {
                    Zoom.resetZoom();
                }
            }
        }, CONFIG.DEBOUNCE_DELAY),

        handleGlobalError: event => {
            if (state.isGalleryMode || state.isLoading) {
                console.error('Script error:', event.error);
                state.notification = 'Encountered an error. Try refreshing the page.';
                state.notificationType = 'error';
                state.isLoading = false;
                state.loadingMessage = null;
            }
        }
    };

    // ====================================================
    // UI Injection
    // ====================================================

    const updateGalleryButton = enabled => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = enabled ? BUTTONS.GALLERY : 'Loading Gallery...';
            elements.galleryButton.disabled = !enabled;
            elements.galleryButton.classList.toggle('disabled', !enabled);
        }
    };

    let lastProcessedUrl = null;
    let contentCheckTimeout = null;

    const injectUI = () => {
        try {
            const onPostPage = Utils.isPostPage();
            const postContainer = document.querySelector('section.site-section--post');
            const currentUrl = window.location.href;

            if (onPostPage && postContainer) {
                if (currentUrl !== lastProcessedUrl) {
                    const postActionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);
                    if (postActionsContainer) {
                        PostActions.cleanupPostActions();
                        PostActions.initPostActions();
                        lastProcessedUrl = currentUrl;
                    }
                }
            } else {
                if (lastProcessedUrl !== null) {
                    PostActions.cleanupPostActions();
                    lastProcessedUrl = null;
                }
            }
        } catch (error) {
            console.error('Error in injectUI:', error);
            state.notification = 'Error initializing UI. Try refreshing the page.';
            state.notificationType = 'error';
        }
    };

    // ====================================================
    // Initialization
    // ====================================================

    const init = async () => {
      try {
        try {
          const cssText = GM_getResourceText('mainCSS');
          if (cssText) {
            GM_addStyle(cssText);
          } else {
            console.warn('Ultra Galleries: mainCSS resource not found or empty.');
          }
        } catch (e) {
          console.error('Ultra Galleries: Error loading mainCSS resource:', e);
        }

        if (!loadedPako) {
          loadedPako = await loadResourceScript('pakoJsRaw', 'pako');
        }

        if (state.enablePersistentCaching) {
          initDexie();
        }
        CONFIG.MAX_SCALE = GM_getValue('maxZoomScale', CONFIG.MAX_SCALE);

        GM_addStyle(`
            .post__actions, .scrape__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 8px; }
            .post__actions > a, .scrape__actions > a { margin: 2px 0 !important; }
            .ug-button-container { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; margin-bottom: 5px; }
            .ug-button { white-space: nowrap; }
            .is-transitioning { transition: transform 0.3s ease-out; }
            .ug-image-error-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ffcccc; background: rgba(0,0,0,0.7); padding: 10px 20px; border-radius: 5px; z-index: 5; }
            .${CSS.GALLERY.MAIN_VIDEO} { max-width: 100%; max-height: 100%; display: block; }
            .${CSS.GALLERY.IMAGE_INFO} { position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; z-index: 10; }
            .${CSS.GALLERY.ROTATION_CONTAINER} { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
            .zoom-controls, .rotation-controls { display: flex; align-items: center; gap: 5px; margin: 0 10px; }
            .zoom-level { margin: 0 5px; min-width: 45px; text-align: center; }
        `);

        GM_addStyle(`
          .${CSS.NOTIF_AREA} {top: ${state.notificationPosition === 'top' ? '10px' : 'auto'};
          bottom: ${state.notificationPosition === 'bottom' ? '10px' : 'auto'}
        ;}

        `);

        document.addEventListener('keydown', EventHandlers.handleGlobalKeyDown);
        window.addEventListener('beforeunload', () => {
            if (DownloadManager._worker) {
                DownloadManager.cleanupWorker();
            }
        });

        const debouncedInject = Utils.debounce(injectUI, 150);
        const observer = new MutationObserver(debouncedInject);
        observer.observe(document.body, { childList: true, subtree: true });

        injectUI();

      } catch (error) {
        console.error('Error in init:', error);
        state.notification = 'Error initializing script. Check console for details.';
        state.notificationType = 'error';
      }
    };

    init();
})();