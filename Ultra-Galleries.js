// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1477603-%E3%83%A1%E3%83%AA%E3%83%BC // https://sleazyfork.org/en/users/1027300-ntf
// @version      3.1.3 
// @description  Modern image gallery with enhanced browsing, fullscreen, and download features
// @author       ntf (original), Meri/TearTyr (maintained and improved)
// @match        *://kemono.su/*
// @match        *://coomer.su/*
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
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js 
// @require      https://unpkg.com/jszip@3.9.1/dist/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@1.3.2/FileSaver.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @require      https://unpkg.com/dexie@3.2.7/dist/dexie.min.js
// @resource     upngJsRaw https://unpkg.com/upng-js@2.1.0/UPNG.js
// @resource     pakoJsRaw https://unpkg.com/pako@2.1.0/dist/pako.min.js
// ==/UserScript==
(function() {
    'use strict';

    // ====================================================
    // Core Configuration
    // ====================================================

    const CONFIG = {
        BATCH_SIZE: 5,
        MAX_RETRIES: 3,
        RETRY_DELAY: 1500,
        MIN_SCALE: 0.05,
        MAX_SCALE: 5,
        ZOOM_STEP: 0.2,
        DEBOUNCE_DELAY: 250,
        PAN_RESISTANCE: 0.8,
        DOUBLE_TAP_THRESHOLD: 300,
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
        CLOSE: '✕'
    };

    // CSS class names
    const CSS = {
        BTN: 'ug-button',
        BTN_CONTAINER: 'ug-button-container',
        LOADING: 'loading-overlay',
        NO_CLICK: 'ug-no-click',
        NOTIF_AREA: 'ug-notification-area',
        NOTIF_CONTAINER: 'ug-notification-container',
        NOTIF_TEXT: 'ug-notification-text',
        NOTIF_CLOSE: 'ug-notification-close',
        NOTIF_REPORT: 'ug-notification-report',
        SETTINGS_BTN: 'settings-button',
        VIRTUAL_IMAGE: 'virtual-image',
        LONG_PRESS: 'long-press',

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
        VIDEO_LINK: website === 'nekohouse' ? 'a.video-link' : 'a.fileThumb.video-link',
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
                /https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/post\//,
                /https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/user\/.*\/post\//,
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
                // Look for posts with images but no thumbnails
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

                // Generate video thumbnails
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
        }
    };

    // ====================================================
    // State Management
    // ====================================================

    // Create reactive state with update callbacks
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

    // Core state with reactive updates
    const state = createReactiveState({
        // File naming settings
        zipFileNameFormat: GM_getValue('zipFileNameFormat', '{title}-{artistName}.zip'),
        imageFileNameFormat: GM_getValue('imageFileNameFormat', '{title}-{artistName}-{fileName}-{index}'),

        // Gallery state
        galleryKey: GM_getValue('galleryKey', 'g'),
        galleryReady: false,
        galleryActive: false,
        currentGalleryIndex: 0,
        isFullscreen: GM_getValue('isFullscreen', false),
        virtualGallery: [],
        originalImageSrcs: [],
        fullSizeImageSrcs: [],

        // Post tracking
        currentPostUrl: null,
        displayedImages: [],
        totalImages: 0,
        loadedImages: 0,

        // Status tracking
        downloadedCount: 0,
        isLoading: false,
        loadingMessage: null,
        hasImages: false,
        postActionsInitialized: false,
        mediaLoaded: {},
        isGalleryMode: false,
        isDownloading: false,
        errorCount: 0,

        // UI preferences
        notificationsEnabled: GM_getValue('notificationsEnabled', true),
        notificationAreaVisible: GM_getValue('notificationAreaVisible', true),
        notificationPosition: GM_getValue('notificationPosition', 'bottom'),
        animationsEnabled: GM_getValue('animationsEnabled', true),

        // Download settings
        optimizePngInZip: GM_getValue('optimizePngInZip', false),
        enablePersistentCaching: GM_getValue('enablePersistentCaching', true),

        // Notification state
        notification: null,
        notificationType: 'info',

        // Button visibility settings
        hideNavArrows: GM_getValue('hideNavArrows', false),
        hideRemoveButton: GM_getValue('hideRemoveButton', false),
        hideFullButton: GM_getValue('hideFullButton', false),
        hideDownloadButton: GM_getValue('hideDownloadButton', false),
        hideHeightButton: GM_getValue('hideHeightButton', false),
        hideWidthButton: GM_getValue('hideWidthButton', false),

        // Settings state
        settingsOpen: false,

        // Keyboard shortcuts
        prevImageKey: GM_getValue('prevImageKey', 'k'),
        nextImageKey: GM_getValue('nextImageKey', 'l'),

        // Gallery display options
        bottomStripeVisible: GM_getValue('bottomStripeVisible', true),
        dynamicResizing: GM_getValue('dynamicResizing', true),

        // Zoom state
        zoomEnabled: GM_getValue('zoomEnabled', true),
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

        // Touch interaction
        pendingRetries: {},
        lastTapTime: 0,
        pinchZoomActive: false,
        initialTouchDistance: 0,
        initialScale: 1,
        zoomIndicatorVisible: true,
        inertiaEnabled: GM_getValue('inertiaEnabled', true),
        velocity: { x: 0, y: 0 },
        inertiaActive: false,
    }, {
        // State update callbacks
        controlsVisible: (value) => {
            if (galleryOverlay && galleryOverlay.length) {
                const $toolbar = galleryOverlay.find(`.${CSS.GALLERY.TOOLBAR}`);
                if ($toolbar.length) { // Check if toolbar was found
                    $toolbar.toggleClass(CSS.GALLERY.CONTROLS_HIDDEN, !value);
                }
            }
        },
        galleryReady: (value) => {
            updateGalleryButton(value);
        },
        loadedImages: (value) => {
            if (value === state.totalImages && state.totalImages > 0) {
                state.notification = `Images Done Loading! Total: ${state.totalImages}`;
                state.notificationType = 'success';
            } else if (state.totalImages > 0) {
                state.notification = `Loading media (${value}/${state.totalImages})...`;
            }
        },
        downloadedCount: (value) => {
            state.notification = `Downloading... (${value}/${state.totalImages})`;
            if (value === state.totalImages) {
                state.notification = `Done Downloading! Total: ${state.totalImages}`;
                state.notificationType = 'success';
            }
        },
        totalImages: (value, oldValue) => {
            if (value > 0) {
                state.notification = `Loading media (${state.loadedImages}/${value})...`;
            }
            state.hasImages = value > 0;
        },
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
            if (galleryOverlay) {
                if (value) {
                    document.body.classList.add('ug-fullscreen');
                    galleryOverlay.classList.add(CSS.GALLERY.FULLSCREEN_OVERLAY);
                } else {
                    document.body.classList.remove('ug-fullscreen');
                    galleryOverlay.classList.remove(CSS.GALLERY.FULLSCREEN_OVERLAY);
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

                // Show instructions tooltip first time
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
            if (value && !db) { // Initialize Dexie if enabled and not already done
                initDexie();
            } else if (!value && db) {
                // Optionally, you might want to clear the cache when disabling, or just leave it.
                // For now, we just stop using it.
                console.log("Ultra Galleries: Persistent caching disabled. Existing cache remains but won't be used.");
            }
        },
        optimizePngInZip: (value) => { 
        GM_setValue('optimizePngInZip', value);
        },
    });

    // ====================================================
    // Resource Loading
    // ====================================================
    let loadedUPNG = null;
    let loadedPako = null;

    async function loadResourceScript(resourceName, globalVarName, onWindow = true) {
        try {
            const scriptText = GM_getResourceText(resourceName);
            if (!scriptText) {
                console.error(`Ultra Galleries: Resource ${resourceName} not found or empty.`);
                return null;
            }

            if (onWindow && typeof window[globalVarName] !== 'undefined') {
                console.log(`Ultra Galleries: ${globalVarName} already on window.`);
                return window[globalVarName];
            }

            // check if a common global for the library exists after eval
            if (resourceName === 'upngJsRaw' && typeof UPNG !== 'undefined') return UPNG;
            if (resourceName === 'pakoJsRaw' && typeof pako !== 'undefined') return pako;
            
            console.log(`Ultra Galleries: Loading resource ${resourceName} into global scope...`);
            // Indirect eval to run in global scope
            (0, eval)(scriptText);


            if (onWindow && typeof window[globalVarName] !== 'undefined') {
                console.log(`Ultra Galleries: ${globalVarName} loaded from resource ${resourceName}.`);
                return window[globalVarName];
            } else if (resourceName === 'upngJsRaw' && typeof UPNG !== 'undefined') {
                 console.log(`Ultra Galleries: UPNG loaded from resource ${resourceName}.`);
                 window.UPNG = UPNG; // Ensure it's explicitly on window if needed elsewhere by this name
                 return UPNG;
            } else if (resourceName === 'pakoJsRaw' && typeof pako !== 'undefined') {
                console.log(`Ultra Galleries: pako loaded from resource ${resourceName}.`);
                window.pako = pako; // Ensure it's explicitly on window
                return pako;
            } else {
                console.warn(`Ultra Galleries: Resource ${resourceName} evaluated, but expected global '${globalVarName}' not found. The library might use a different name or be an ESM module not directly exposing a global via eval.`);
                return null;
            }
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
            // Store original URL as key, and the image blob, plus when it was cached
            imageCache: 'url, cachedAt, blob'
        });
        console.log("Ultra Galleries: Dexie database initialized.");
        return true;
    }

    async function storeImageInDexie(url, blob) {
        if (!db || !state.enablePersistentCaching) return;
        try {
            await db.imageCache.put({ url: url, blob: blob, cachedAt: Date.now() });
            // console.log(`Ultra Galleries: Cached image in Dexie: ${url}`);
        } catch (e) {
            console.error(`Ultra Galleries: Error caching image ${url} in Dexie:`, e);
            // Handle QuotaExceededError or other errors if necessary
            if (e.name === 'QuotaExceededError') {
                console.warn("Ultra Galleries: Dexie cache quota exceeded. Consider clearing cache or increasing quota.");
                // Potentially implement a cache cleanup strategy here (e.g., remove oldest items)
            }
        }
    }

    async function getImageFromDexie(url) {
        if (!db || !state.enablePersistentCaching) return null;
        try {
            const record = await db.imageCache.get(url);
            if (record && record.blob) {
                // console.log(`Ultra Galleries: Retrieved image from Dexie: ${url}`);
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
        const $image = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG}`);
        if (!$image.length || !$container.length) return;

        const containerDOM = $container[0];
        // const imageDOM = $image[0];
        const rect = containerDOM.getBoundingClientRect();
        const originalEvent = event.originalEvent || event; // Get original DOM event for deltaY

        const mouseX = originalEvent.clientX - rect.left;
        const mouseY = originalEvent.clientY - rect.top;
        const delta = Math.sign(originalEvent.deltaY) * -0.1; // Use originalEvent.deltaY for scroll direction
        const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(state.zoomScale + delta, CONFIG.MAX_SCALE));

        // Calculate new offsets to keep zoom centered on mouse pointer
        const imageXUnderPointer = (mouseX - state.imageOffset.x) / state.zoomScale;
        const imageYUnderPointer = (mouseY - state.imageOffset.y) / state.zoomScale;

        const newOffsetX = mouseX - (imageXUnderPointer * newScale);
        const newOffsetY = mouseY - (imageYUnderPointer * newScale);

        state.imageOffset.x = newOffsetX;
        state.imageOffset.y = newOffsetY;
        state.zoomScale = newScale; // This will trigger the reactive 'zoomScale' callback
        },

        enforceBoundaries: (offsetX, offsetY, scale, containerRect, imageDOM) => { // imageDOM is DOM element
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
            if (event.button === 2 && event.type === 'mousedown') return; // Allow context menu on actual mousedown

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
                $container.css('transition', 'transform 0.3s ease-out');
                state.zoomScale = 1;
                state.imageOffset = { x: 0, y: 0 };
                Zoom.applyZoom();
                setTimeout(() => $container.css('transition', ''), 300);
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

                $container.css('transition', 'transform 0.2s ease-out');
                state.imageOffset.x = newOffsetX;
                state.imageOffset.y = newOffsetY;
                state.zoomScale = newScale;
                Zoom.applyZoom();
                setTimeout(() => $container.css('transition', ''), 200);
            }
        },

        setupTouchEvents: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0]; // Get DOM element for addEventListener

            let initialTouchDistance = 0;
            let initialScale = 1;
            let longPressTimer = null;
            const passiveSupported = Utils.supportsPassiveEvents();

            const touchStart = (e) => {
                if (e.touches.length === 1) {
                    clearTimeout(longPressTimer);
                    longPressTimer = setTimeout(() => {
                        $(e.target).addClass(CSS.LONG_PRESS);
                        if (state.isDragging) Zoom.endDrag();
                    }, 500);
                }

                if (e.touches.length === 1) {
                    const now = Date.now();
                    const timeSinceLastTap = now - state.lastTapTime;
                    if (timeSinceLastTap < CONFIG.DOUBLE_TAP_THRESHOLD && timeSinceLastTap > 0) {
                        if (state.zoomScale > 1) {
                            Zoom.resetZoom();
                        } else {
                            const touch = e.touches[0];
                            const rect = containerDOM.getBoundingClientRect();
                            const touchX = touch.clientX - rect.left;
                            const touchY = touch.clientY - rect.top;
                            state.zoomOrigin = { x: touchX, y: touchY };
                            const newScale = 2.5;
                            const imageX = (touchX - state.imageOffset.x) / state.zoomScale;
                            const imageY = (touchY - state.imageOffset.y) / state.zoomScale;
                            const newOffsetX = touchX - (imageX * newScale);
                            const newOffsetY = touchY - (imageY * newScale);
                            const imageDOM = $container.find(`.${CSS.GALLERY.MAIN_IMG}`)[0];
                            if (!imageDOM) return;
                            const boundedOffset = Zoom.enforceBoundaries(newOffsetX, newOffsetY, newScale, rect, imageDOM);
                            $container.css('transition', 'transform 0.3s ease-out');
                            state.imageOffset.x = boundedOffset.x;
                            state.imageOffset.y = boundedOffset.y;
                            state.zoomScale = newScale;
                            Zoom.applyZoom();
                            setTimeout(() => $container.css('transition', ''), 300);
                        }
                        state.lastTapTime = 0; e.preventDefault(); return;
                    }
                    state.lastTapTime = now;
                    Zoom.startDrag({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, button: 0, preventDefault: () => e.preventDefault(), touches: e.touches });
                } else if (e.touches.length === 2) {
                    clearTimeout(longPressTimer); e.preventDefault();
                    initialTouchDistance = Utils.getDistance(e.touches[0], e.touches[1]);
                    initialScale = state.zoomScale;
                    const rect = containerDOM.getBoundingClientRect();
                    const midPointScreen = Utils.getMidpoint(e.touches[0], e.touches[1]);
                    state.zoomOrigin = { x: midPointScreen.x - rect.left, y: midPointScreen.y - rect.top };
                    state.pinchZoomActive = true;
                    if (state.isDragging) Zoom.endDrag();
                }
            };

            const touchMove = (e) => {
                clearTimeout(longPressTimer);
                if (e.touches.length === 1 && state.isDragging) {
                    e.preventDefault();
                    Zoom.dragImage({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, touches: e.touches });
                } else if (e.touches.length === 2 && state.pinchZoomActive) {
                    e.preventDefault();
                    const currentDistance = Utils.getDistance(e.touches[0], e.touches[1]);
                    if (initialTouchDistance === 0) return;
                    const scaleFactor = currentDistance / initialTouchDistance;
                    const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(initialScale * scaleFactor, CONFIG.MAX_SCALE));
                    const rect = containerDOM.getBoundingClientRect();
                    const imageDOM = $container.find(`.${CSS.GALLERY.MAIN_IMG}`)[0];

                    if (Math.abs(newScale - state.zoomScale) > 0.01 || e.touches.length !== 2) {
                        const imageX = (state.zoomOrigin.x - state.imageOffset.x) / state.zoomScale;
                        const imageY = (state.zoomOrigin.y - state.imageOffset.y) / state.zoomScale;
                        const newOffsetX = state.zoomOrigin.x - (imageX * newScale);
                        const newOffsetY = state.zoomOrigin.y - (imageY * newScale);
                        if (!imageDOM) return;
                        const boundedOffset = Zoom.enforceBoundaries(newOffsetX, newOffsetY, newScale, rect, imageDOM);
                        state.imageOffset.x = boundedOffset.x;
                        state.imageOffset.y = boundedOffset.y;
                        state.zoomScale = newScale;
                        Zoom.applyZoom();
                    }
                }
            };

            const touchEnd = (e) => {
                clearTimeout(longPressTimer);
                $container.find(`.${CSS.LONG_PRESS}`).removeClass(CSS.LONG_PRESS);
                if (e.touches.length < 2 && state.pinchZoomActive) {
                    state.pinchZoomActive = false; initialTouchDistance = 0;
                }
                if (e.touches.length === 0 && state.isDragging) {
                    Zoom.endDrag();
                }
            };

            const eventOptions = passiveSupported ? { passive: false } : false;
            containerDOM.removeEventListener('touchstart', touchStart, eventOptions); // Try removing first
            containerDOM.removeEventListener('touchmove', touchMove, eventOptions);
            containerDOM.removeEventListener('touchend', touchEnd);
            containerDOM.removeEventListener('touchcancel', touchEnd);

            containerDOM.addEventListener('touchstart', touchStart, eventOptions);
            containerDOM.addEventListener('touchmove', touchMove, eventOptions);
            containerDOM.addEventListener('touchend', touchEnd);
            containerDOM.addEventListener('touchcancel', touchEnd);
        }
    };

    // ====================================================
    // UI Component Module
    // ====================================================

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
                // Check settings to determine if a button should be hidden
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

            // Position based on user preference
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
                state.notification = null; // Clicking 'x' dismisses notification
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

        // A timeout ID for auto-hiding notifications
        _notificationTimeoutId: null,

        showNotification: (message, type = 'info') => {
            if (!state.notificationsEnabled && type !== 'error') return; // Do not show non-error notifications if disabled

            let area = document.getElementById(CSS.NOTIF_AREA);
            if (!area) area = UI.createNotificationArea();
            let container = area.querySelector(`.${CSS.NOTIF_CONTAINER}`);
            if (!container) container = UI.createNotification();

            if (area) area.style.display = state.notificationAreaVisible ? 'flex' : 'none';

            const text = container.querySelector(`#${CSS.NOTIF_TEXT}`);
            text.textContent = message;

            container.classList.remove('info', 'success', 'error');
            container.classList.add(type);

            if (state.animationsEnabled) {
                container.classList.add('ug-slide-in');
                container.classList.remove('ug-slide-out');
            } else {
                container.classList.remove('ug-slide-in', 'ug-slide-out');
            }
            container.style.display = 'flex';

            // Clear any existing auto-hide timeout
            if (UI._notificationTimeoutId) {
                clearTimeout(UI._notificationTimeoutId);
                UI._notificationTimeoutId = null;
            }

            // Auto-hide after a delay for 'info' and 'success' notifications
            if (type === 'info' || type === 'success') {
                UI._notificationTimeoutId = setTimeout(() => {
                    state.notification = null; // This will trigger hideNotification via state proxy
                }, 5000); // Hide after 5 seconds
            }
        },

        hideNotification: () => {
            const container = document.getElementById(CSS.NOTIF_CONTAINER);
            if (!container) return;

            // Clear any pending auto-hide timeout if manually hidden
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

        createSettingsUI: () => {
            const $overlay = $('<div>').attr('id', 'ug-settings-overlay').addClass(CSS.SETTINGS.OVERLAY);

            const $container = $('<div>').addClass(CSS.SETTINGS.CONTAINER);
            $overlay.append($container);

            const $header = $('<div>').addClass(CSS.SETTINGS.HEADER);
            $container.append($header);

            const $headerText = $('<h2>').text('Ultra Galleries Settings');
            $header.append($headerText);

            const $closeBtn = $('<button>').addClass(CSS.SETTINGS.CLOSE_BTN)
                .text(BUTTONS.CLOSE)
                .on('click', () => state.settingsOpen = false);
            $header.append($closeBtn);

            const $body = $('<div>').addClass(CSS.SETTINGS.BODY);
            $container.append($body);

            function createSection($parent, title) {
                const $section = $('<div>').addClass(CSS.SETTINGS.SECTION);
                $section.append($('<h3>').addClass(CSS.SETTINGS.SECTION_HEADER).text(title));
                $parent.append($section);
                return $section;
            }

            function addCheckbox($parent, id, label, checked, onChange) {
                const $div = $('<div>').addClass(CSS.SETTINGS.CHECKBOX_LABEL);
                const $input = $('<input type="checkbox">').attr('id', id).prop('checked', checked).addClass(CSS.SETTINGS.INPUT)
                    .on('change', e => onChange($(e.target).prop('checked')));
                const $label = $('<label>').attr('for', id).text(label).addClass(CSS.SETTINGS.LABEL);
                $div.append($input, $label);
                $parent.append($div);
                return $div;
            }

            function addTextInput($parent, id, label, value, maxLength, onChange) {
                const $div = $('<div>').addClass(CSS.SETTINGS.LABEL);
                $div.html(`
                    <label class="${CSS.SETTINGS.LABEL}" for="${id}">${label}</label>
                    <input type="text" id="${id}" value="${value}" maxlength="${maxLength}"
                        style="width: 2em;" class="${CSS.SETTINGS.INPUT}">
                `);
                $div.find('input').on('change', e => onChange($(e.target).val()));
                $parent.append($div);
                return $div;
            }

            function addTextAreaInput($parent, id, label, value, onChange) {
                const $div = $('<div>').addClass(CSS.SETTINGS.LABEL);
                $div.html(`
                    <label class="${CSS.SETTINGS.LABEL}" for="${id}">${label}</label>
                    <input type="text" id="${id}" value="${value}" style="width: 100%;" class="${CSS.SETTINGS.INPUT}">
                `);
                $div.find('input').on('change', e => onChange($(e.target).val()));
                $parent.append($div);
                return $div;
            }

            function addNumberInput($parent, id, label, value, min, max, step, onChange) {
                const $div = $('<div>').addClass(CSS.SETTINGS.LABEL);
                $div.html(`
                    <label for="${id}">${label}</label>
                    <input type="number" id="${id}" value="${value}" min="${min}" max="${max}"
                        step="${step}" class="${CSS.SETTINGS.INPUT}">
                `);
                $div.find('input').on('change', e => onChange(parseFloat($(e.target).val())));
                $parent.append($div);
                return $div;
            }

            const sections = {
                general: createSection($body, 'General Settings'),
                keys: createSection($body, 'Keyboard Shortcuts'),
                notifications: createSection($body, 'Notifications'),
                formatting: createSection($body, 'File Formatting'),
                optimizations: createSection($body, 'Download Optimizations'),
                buttonVisibility: createSection($body, 'Button Visibility'),
                panZoom: createSection($body, 'Pan & Zoom Settings')
            };

            addCheckbox(sections.general, 'dynamicResizingToggle', 'Dynamic Resizing',
                    state.dynamicResizing, val => {
                    state.dynamicResizing = val;
                    GM_setValue('dynamicResizing', val);
                });

            addCheckbox(sections.general, 'animationsToggle', 'Enable Animations',
                    state.animationsEnabled, val => {
                    state.animationsEnabled = val;
                    GM_setValue('animationsEnabled', val);
                });

            addCheckbox(sections.general, 'bottomStripeToggle', 'Show Thumbnail Strip',
                    state.bottomStripeVisible, val => {
                    state.bottomStripeVisible = val;
                    GM_setValue('bottomStripeVisible', val);
                });

            addCheckbox(sections.panZoom, 'zoomEnabledToggle', 'Enable Zoom & Pan',
                    state.zoomEnabled, val => {
                    state.zoomEnabled = val;
                    GM_setValue('zoomEnabled', val);
                });

            addCheckbox(sections.panZoom, 'inertiaEnabledToggle', 'Enable Smooth Pan Inertia',
                    state.inertiaEnabled, val => {
                    state.inertiaEnabled = val;
                    GM_setValue('inertiaEnabled', val);
                });

            addNumberInput(sections.panZoom, 'maxZoomInput', 'Maximum Zoom Level:',
                            CONFIG.MAX_SCALE, 2, 10, 0.5, val => {
                    if (val >= 2 && val <= 10) {
                        CONFIG.MAX_SCALE = val;
                        GM_setValue('maxZoomScale', val);
                    }
                });

            const addButtonVisibility = (id, label, prop) => {
                addCheckbox(sections.buttonVisibility, id, label, state[prop], val => {
                    state[prop] = val;
                    GM_setValue(prop, val);
                    if (galleryOverlay) {
                        Gallery.closeGallery();
                        Gallery.createGallery();
                    }
                });
            };

            addButtonVisibility('hideRemoveBtn', 'Hide Remove Button', 'hideRemoveButton');
            addButtonVisibility('hideFullBtn', 'Hide Full Size Button', 'hideFullButton');
            addButtonVisibility('hideDownloadBtn', 'Hide Download Button', 'hideDownloadButton');
            addButtonVisibility('hideHeightBtn', 'Hide Fill Height Button', 'hideHeightButton');
            addButtonVisibility('hideWidthBtn', 'Hide Fill Width Button', 'hideWidthButton');
            addButtonVisibility('hideNavArrows', 'Hide Navigation Arrows', 'hideNavArrows');

            addTextInput(sections.keys, 'galleryKeyInput', 'Gallery Key:',
                            state.galleryKey, 1, val => {
                    state.galleryKey = val;
                    GM_setValue('galleryKey', val);
                });

            addTextInput(sections.keys, 'prevImageKeyInput', 'Previous Image Key:',
                            state.prevImageKey, 1, val => {
                    state.prevImageKey = val;
                    GM_setValue('prevImageKey', val);
                });

            addTextInput(sections.keys, 'nextImageKeyInput', 'Next Image Key:',
                            state.nextImageKey, 1, val => {
                    state.nextImageKey = val;
                    GM_setValue('nextImageKey', val);
                });

            addCheckbox(sections.notifications, 'notificationsEnabledToggle', 'Enable Notifications',
                    state.notificationsEnabled, val => {
                    state.notificationsEnabled = val;
                    GM_setValue('notificationsEnabled', val);
                });

            addCheckbox(sections.notifications, 'notificationAreaVisibleToggle', 'Show Notification Area',
                    state.notificationAreaVisible, val => {
                    state.notificationAreaVisible = val;
                    GM_setValue('notificationAreaVisible', val);
                    const area = document.getElementById(CSS.NOTIF_AREA);
                    if (area) area.style.display = val ? 'flex' : 'none';
                });

            const $posDiv = $('<div>').addClass(CSS.SETTINGS.LABEL).html(`
                <label class="${CSS.SETTINGS.LABEL}">Notification Position:</label>
                <select id="notificationPosition" class="${CSS.SETTINGS.INPUT}">
                    <option value="top" ${state.notificationPosition === 'top' ? 'selected' : ''}>Top</option>
                    <option value="bottom" ${state.notificationPosition === 'bottom' ? 'selected' : ''}>Bottom</option>
                </select>
            `);
            $posDiv.find('select').on('change', e => {
                state.notificationPosition = e.target.value;
            });
            sections.notifications.append($posDiv);

            addCheckbox(sections.optimizations, 'optimizePngToggle', 'Optimize PNGs in ZIP (Smaller files, Slower zipping)',
                        state.optimizePngInZip, val => {
                    state.optimizePngInZip = val;
                });
            addCheckbox(sections.optimizations, 'persistentCachingToggle', 'Enable Persistent Image Caching (Faster revisit load times)',
                    state.enablePersistentCaching, val => {
                    state.enablePersistentCaching = val;
                });

            const $clearCacheButton = $('<button class="ug-button ug-settings-input" style="margin-top: 10px; display: block;">Clear Persistent Cache</button>');
            $clearCacheButton.on('click', async () => {
                if (!db && state.enablePersistentCaching) {
                    initDexie();
                }
                if (!db) {
                    Swal.fire('Cache Not Ready', 'The persistent cache system is not currently active.', 'info');
                    return;
                }
                const result = await Swal.fire({
                    title: 'Clear Cache?',
                    text: "This will remove all persistently cached images. Are you sure?",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, clear it!',
                    cancelButtonText: 'No, cancel'
                });
                if (result.isConfirmed) {
                    clearDexieCache();
                }
            });
            sections.optimizations.append($clearCacheButton);

            addTextAreaInput(sections.formatting, 'zipFileNameFormatInput', 'Zip File Name Format:',
                            state.zipFileNameFormat, val => {
                    state.zipFileNameFormat = val;
                    GM_setValue('zipFileNameFormat', val);
                });

            addTextAreaInput(sections.formatting, 'imageFileNameFormatInput', 'Image File Name Format:',
                            state.imageFileNameFormat, val => {
                    state.imageFileNameFormat = val;
                    GM_setValue('imageFileNameFormat', val);
                });

            $('body').append($overlay);
        },

        showSettings: () => {
            UI.createSettingsUI();
            const overlay = document.getElementById('ug-settings-overlay');
            if (overlay) {
                overlay.classList.remove('closing');
                overlay.classList.add('opening');
                overlay.style.width = '100%';
                overlay.style.height = '100%';
            }
        },

        closeSettings: () => {
            const overlay = document.getElementById('ug-settings-overlay');
            if (overlay) {
                overlay.classList.add('closing');
                setTimeout(() => overlay.remove(), 300);
            }
        }
    };

    // ====================================================
    // Gallery Module
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

            // Also revoke blob URLs from the global loadedBlobUrls map
            for (const blobUrl of loadedBlobUrls.values()) {
                if (typeof blobUrl === 'string' && blobUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(blobUrl); } catch (e) { /* silent */ }
                }
            }
            loadedBlobUrls.clear(); // Clear the map after revoking
            loadedBlobs.clear();    // Clear the blobs map
        },

        _fetchAndCacheImage: async function(indexToPreload) {
            if (indexToPreload < 0 || indexToPreload >= state.originalImageSrcs.length) return;
            if (Gallery._preloadedImageCache[indexToPreload] || Gallery._preloadingInProgress[indexToPreload]) return;

            const originalImageUrl = state.originalImageSrcs[indexToPreload];
            if (!originalImageUrl) return;

            Gallery._preloadingInProgress[indexToPreload] = true;
            let blobToCache = null;
            let loadedFromPersistentCache = false;

            try {
                if (state.enablePersistentCaching && db) {
                    const cachedBlob = await getImageFromDexie(originalImageUrl);
                    if (cachedBlob) {
                        blobToCache = cachedBlob;
                        loadedFromPersistentCache = true;
                    }
                }

                if (!blobToCache) {
                    blobToCache = await new Promise((resolve, reject) => {
                        GM.xmlHttpRequest({
                            method: 'GET', url: originalImageUrl, responseType: 'blob',
                            onload: r => (r.status === 200 || r.status === 206) ? resolve(r.response) : reject(new Error(`HTTP ${r.status}`)),
                            onerror: reject
                        });
                    });
                    if (blobToCache && state.enablePersistentCaching && db) {
                        await storeImageInDexie(originalImageUrl, blobToCache);
                    }
                }

                if (blobToCache) {
                    Gallery._preloadedImageCache[indexToPreload] = URL.createObjectURL(blobToCache);
                } else {
                    Gallery._preloadedImageCache[indexToPreload] = 'failed_preload';
                }
            } catch (error) {
                console.error(`Ultra Galleries: Error preloading image ${originalImageUrl}:`, error);
                Gallery._preloadedImageCache[indexToPreload] = 'failed_preload';
            } finally {
                delete Gallery._preloadingInProgress[indexToPreload];
            }
        },

        _preloadAdjacentImages: function(currentIndex) {
            Gallery._fetchAndCacheImage(currentIndex + 1);
            Gallery._fetchAndCacheImage(currentIndex - 1);
        },

        _createGalleryOverlayAndContainer: function() {
            // Ensure galleryOverlay is initialized as a jQuery object
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
            $('<button>').addClass(CSS.GALLERY.TOOLBAR_BTN).text(BUTTONS.CLOSE)
                .attr('aria-label', 'Close Expanded View').on('click', Gallery.showGridView)
                .appendTo($toolbar);

            const $zoomControls = $('<div>').addClass('zoom-controls').appendTo($toolbar);
            $('<button>').attr({id: 'zoom-out-btn', title: 'Zoom Out'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .html('<img src="https://www.svgrepo.com/show/263638/zoom-out-search.svg" alt="Zoom Out" style="filter: invert(100%); pointer-events: none;">')
                .on('click', () => Zoom.zoom(-CONFIG.ZOOM_STEP)).appendTo($zoomControls);
            $('<span>').attr('id', 'zoom-level').addClass('zoom-level').text('100%').appendTo($zoomControls);
            $('<button>').attr({id: 'zoom-in-btn', title: 'Zoom In'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .html('<img src="https://www.svgrepo.com/show/263635/zoom-in.svg" alt="Zoom In" style="filter: invert(100%); pointer-events: none;">')
                .on('click', () => Zoom.zoom(CONFIG.ZOOM_STEP)).appendTo($zoomControls);
            $('<button>').attr({id: 'reset-btn', title: 'Reset Zoom & Position'}).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .text('Reset').on('click', Zoom.resetZoom).appendTo($zoomControls);

            $('<button>').text(BUTTONS.FULLSCREEN).addClass(CSS.GALLERY.FULLSCREEN).addClass(CSS.GALLERY.TOOLBAR_BTN)
                .attr('aria-label', 'Toggle Fullscreen').on('click', Gallery.toggleFullscreen)
                .appendTo($toolbar);
            $expandedViewElement.append($toolbar);
        },

        _createExpandedViewMainImageArea: function($expandedViewElement) {
            const $zoomContainer = $('<div>').addClass(CSS.GALLERY.ZOOM_CONTAINER).appendTo($expandedViewElement);
            const $mainImageContainer = $('<div>').addClass(CSS.GALLERY.MAIN_IMG_CONTAINER).addClass('image-container').appendTo($zoomContainer);
            $('<div>').addClass('pan-indicator')
                .css({position:'absolute',top:'15px',left:'15px',zIndex:'10',opacity:'0',transition:'opacity 0.3s ease',pointerEvents:'none'})
                .html(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white" opacity="0.7"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>`)
                .appendTo($mainImageContainer);
            const $mainImage = $('<img>').addClass(CSS.GALLERY.MAIN_IMG).addClass('gallery-image').appendTo($mainImageContainer);
            return { $mainImageContainer, $mainImage };
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
            // Populate gallery with unique images from state.fullSizeImageSrcs
            state.fullSizeImageSrcs.forEach((src, index) => {
                if (src) { // Only add if source exists (not null from failed loads)
                    const $gridThumbImg = $('<img>').attr('src', src).addClass(CSS.GALLERY.THUMBNAIL)
                        .data('index', index).on('click', () => Gallery.showExpandedView(index))
                        .attr('aria-label', `Open image ${index + 1}`);
                    $('<div>').addClass(CSS.GALLERY.THUMBNAIL_CONTAINER).append($gridThumbImg).appendTo($gridThumbnailsContainer);

                    $('<img>').attr('src', src).addClass(CSS.GALLERY.THUMBNAIL_ITEM)
                        .data('index', index).on('click', () => Gallery.showExpandedView(index))
                        .attr('aria-label', `Thumbnail ${index + 1}`).appendTo($stripThumbnailsContainer);
                }
            });
        },

        _setupGalleryInteractions: function($expandedViewElement, $mainImageContainerElement) {
            $mainImageContainerElement.on('wheel', Zoom.handleWheelZoom);

            $expandedViewElement.on('mousedown', e => {
                if ($(e.target).closest(`.${CSS.GALLERY.TOOLBAR}, .${CSS.GALLERY.NAV_CONTAINER}, .${CSS.GALLERY.STRIP_CONTAINER}`).length || e.button === 2) {
                    return;
                }
                Zoom.startDrag(e);
            });

            $mainImageContainerElement.on('dblclick', e => {
                if (e.button !== 0) return;
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

                    $mainImageContainerElement.css('transition', 'transform 0.3s ease-out');
                    state.imageOffset.x = boundedOffset.x;
                    state.imageOffset.y = boundedOffset.y;
                    state.zoomScale = newScale;
                    Zoom.applyZoom();
                    setTimeout(() => $mainImageContainerElement.css('transition', ''), 300);
                }
            });

            let controlsTimeout;
            $expandedViewElement.on('mousemove', () => {
                state.controlsVisible = true;
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => {
                    if (!state.isDragging && !state.pinchZoomActive) state.controlsVisible = false;
                }, 3000);
            });
            state.controlsVisible = true;
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                if (!state.isDragging && !state.pinchZoomActive) state.controlsVisible = false;
            }, 3000);


            Zoom.setupTouchEvents();

            $(document).on('mousemove.galleryDrag', Zoom.dragImage);
            $(document).on('mouseup.galleryDrag', Zoom.endDrag);
        },

        createGallery: function() {
            if (galleryOverlay && galleryOverlay.length) {
                // If gallery already exists, just show grid view or toggle
                Gallery.showGridView();
                state.isGalleryMode = true;
                return;
            }

            const $galleryContentContainer = Gallery._createGalleryOverlayAndContainer();
            const { $gridView, $expandedView } = Gallery._createBaseViews($galleryContentContainer);
            const $gridThumbnailsContainer = Gallery._createGridViewContent($gridView);

            Gallery._createExpandedViewToolbar($expandedView);
            const { $mainImageContainer, $mainImage } = Gallery._createExpandedViewMainImageArea($expandedView);
            Gallery._createExpandedViewNavigationAndCounter($expandedView);
            const $stripThumbnailsContainer = Gallery._createExpandedViewThumbnailStrip($expandedView);

            $('body').append(galleryOverlay);

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
            if (!galleryOverlay || !galleryOverlay.length) return;

            const $mainImage = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG}`);
            const $mainImageContainer = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            const $counter = galleryOverlay.find(`.${CSS.GALLERY.COUNTER}`);
            const $prevButton = galleryOverlay.find(`.${CSS.GALLERY.PREV}`);
            const $nextButton = galleryOverlay.find(`.${CSS.GALLERY.NEXT}`);
            const $thumbnailStrip = galleryOverlay.find(`.${CSS.GALLERY.THUMBNAIL_STRIP}`);

            if (!$mainImage.length || !$mainImageContainer.length || !$counter.length) return;
            if (index < 0 || index >= state.fullSizeImageSrcs.length) return;

            state.currentGalleryIndex = index;
            let imageUrlToLoad = null;
            let usingPreloadedMemoryCache = false;
            const originalHttpUrl = state.originalImageSrcs[index];

            if (Gallery._preloadedImageCache[index] && Gallery._preloadedImageCache[index] !== 'failed_preload') {
                imageUrlToLoad = Gallery._preloadedImageCache[index];
                usingPreloadedMemoryCache = true;
            } else if (state.fullSizeImageSrcs[index] && state.fullSizeImageSrcs[index] !== 'failed_preload') {
                imageUrlToLoad = state.fullSizeImageSrcs[index];
            } else {
                imageUrlToLoad = originalHttpUrl;
                if (!imageUrlToLoad) {
                    $mainImage.attr({src: '', alt: "Image not available"});
                    $counter.text(`${index + 1} / ${state.fullSizeImageSrcs.length}`);
                    Gallery._preloadAdjacentImages(index);
                    return;
                }
            }

            $mainImage.addClass('loading').removeClass('error');
            Zoom.resetZoom();
            $mainImageContainer.css({width:'100%',height:'100%',display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden'});
            $mainImage.css({maxWidth:'100%',maxHeight:'100%',objectFit:'contain',position:'relative'});
            $mainImage.off('load error').on('load', () => {
                $mainImage.removeClass('loading');
                Zoom.initializeImage($mainImage[0], $mainImageContainer[0]);
                Gallery._preloadAdjacentImages(index);
            }).on('error', () => {
                $mainImage.removeClass('loading').addClass('error').attr({src:'', alt:"Error loading image"});
                if (usingPreloadedMemoryCache && imageUrlToLoad.startsWith('blob:') && Gallery._preloadedImageCache[index]) {
                    try { URL.revokeObjectURL(imageUrlToLoad); } catch (e) { /* silent */ }
                    delete Gallery._preloadedImageCache[index];
                }
                Gallery._preloadAdjacentImages(index);
            });
            $mainImage.attr({src: imageUrlToLoad, alt: `Image ${index + 1} of ${state.fullSizeImageSrcs.length}`});
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
            Gallery._clearPreloadCache();
            galleryOverlay.remove();
            galleryOverlay = null;
            $(document.body).removeClass('ug-fullscreen');
            state.isGalleryMode = false;
            state.isFullscreen = false;
            $(document).off('.galleryDrag'); // Remove namespaced events
        },

        toggleGallery: function() {
            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else {
                if (state.galleryReady && state.fullSizeImageSrcs.length > 0) {
                    Gallery.createGallery();
                } else if (!state.galleryReady) {
                    state.notification = "Gallery is still loading images."; state.notificationType = "info";
                } else {
                    state.notification = "No images to display in gallery."; state.notificationType = "info";
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

        createVirtualGallery: function() { // This was mostly vanilla, should be fine
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

        cleanupVirtualGallery: function() { // This was vanilla, should be fine
            if (elements.virtualGalleryContainer) {
                elements.virtualGalleryContainer.remove();
                elements.virtualGalleryContainer = null;
            }
        }
    };

    // ====================================================
    // Image Loading Module
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
                setTimeout(resolve, 2000); // Fallback timeout in case images are not intersecting
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

        retryWithBackoff: async (loadFn, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY, mediaSrc) => {
            try {
                return await loadFn();
            } catch (err) {
                if (retries <= 0) {
                    console.error(`Failed to load ${mediaSrc} after ${CONFIG.MAX_RETRIES} retries.`);
                    throw err;
                }
                console.log(`Retrying load for ${mediaSrc}, ${retries} attempts remaining`);
                await Utils.delay(delay);
                return ImageLoader.retryWithBackoff(loadFn, retries - 1, delay * 1.5, mediaSrc);
            }
        },

        // New helper function to handle loading/applying a single image to a page element
        loadImageAndApplyToPage: async (linkElement, galleryIndex, originalHref, isUniqueForGallery) => {
            const imgElement = linkElement.querySelector('img.post__image');
            if (!imgElement) {
                console.warn(`ImageLoader: No img.post__image found for linkElement:`, linkElement);
                // Still increment loadedImages for the counter to be accurate for page elements
                state.loadedImages++;
                return;
            }

            let blobUrlToUse = loadedBlobUrls.get(originalHref);
            let blobToStore = loadedBlobs.get(originalHref);
            let loadedFromCache = false;

            if (!blobUrlToUse) { // If not already in our in-memory cache (meaning it's a new unique URL or first encounter)
                try {
                    // 1. Try to get from Dexie cache
                    if (state.enablePersistentCaching && db) {
                        const cachedBlob = await getImageFromDexie(originalHref);
                        if (cachedBlob) {
                            blobToStore = cachedBlob;
                            loadedFromCache = true;
                        }
                    }

                    // 2. If not in Dexie, fetch via GM.xmlHttpRequest
                    if (!blobToStore) {
                        blobToStore = await ImageLoader.retryWithBackoff(async () => {
                            return new Promise((resolve, reject) => {
                                GM.xmlHttpRequest({
                                    method: 'GET',
                                    url: originalHref,
                                    responseType: 'blob',
                                    onload: function(response) {
                                        if (response.status === 200 || response.status === 206) {
                                            resolve(response.response);
                                        } else {
                                            ImageLoader.handleImageFetchError(originalHref, response.status, reject);
                                        }
                                    },
                                    onerror: (error) => {
                                        ImageLoader.handleImageFetchError(originalHref, 'Network Error', reject, error);
                                    },
                                });
                            });
                        }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, originalHref);

                        // 3. If fetched successfully, store in Dexie
                        if (blobToStore && state.enablePersistentCaching && db) {
                            await storeImageInDexie(originalHref, blobToStore);
                        }
                    }

                    if (blobToStore) {
                        blobUrlToUse = URL.createObjectURL(blobToStore);
                        loadedBlobUrls.set(originalHref, blobUrlToUse); // Store in our in-memory cache
                        loadedBlobs.set(originalHref, blobToStore);
                        if (loadedFromCache) console.log(`Ultra Galleries: Image ${originalHref} loaded from persistent cache for page display.`);
                    } else {
                        throw new Error("Blob could not be obtained for " + originalHref);
                    }
                } catch (error) {
                    console.error(`Ultra Galleries: Failed to load media for page display: ${originalHref}`, error);
                    state.errorCount++;
                    // If loading fails, keep original thumbnail src, don't prevent click
                    imgElement.src = imgElement.dataset.src || originalHref; // Fallback to thumbnail or original
                    linkElement.classList.remove(CSS.NO_CLICK);
                    state.loadedImages++; // Still count as processed for total progress
                    return; // Exit this function, don't update gallery arrays below
                }
            }

            // Apply the loaded blob URL to the image element on the page
            imgElement.src = blobUrlToUse;
            imgElement.dataset.originalSrc = originalHref; // Keep original HTTP src for reference
            linkElement.classList.add(CSS.NO_CLICK); // Add no-click to the parent link

            // If this is a unique item for the gallery, populate gallery arrays
            if (isUniqueForGallery) {
                // Ensure the gallery arrays are large enough for the unique index
                if (galleryIndex >= state.fullSizeImageSrcs.length) {
                    state.fullSizeImageSrcs.length = galleryIndex + 1;
                    state.originalImageSrcs.length = galleryIndex + 1;
                    state.virtualGallery.length = galleryIndex + 1;
                }
                state.fullSizeImageSrcs[galleryIndex] = blobUrlToUse;
                state.originalImageSrcs[galleryIndex] = originalHref;
                state.virtualGallery[galleryIndex] = blobUrlToUse;
            }
            state.loadedImages++; // Increment for each page element successfully processed
            state.mediaLoaded[galleryIndex] = true; // This tracks unique items for gallery, fine as is
        },

        loadImages: async () => {
            if (!Utils.isPostPage() || state.galleryReady || state.isLoading) return;

            try {
                state.isLoading = true;
                state.loadingMessage = 'Loading Media...';

                // Clear previous session's in-memory caches and state
                loadedBlobUrls.clear();
                loadedBlobs.clear();
                state.fullSizeImageSrcs = []; // Gallery unique items
                state.originalImageSrcs = []; // Gallery unique items
                state.virtualGallery = [];    // Gallery unique items
                state.loadedImages = 0;
                state.mediaLoaded = {};
                state.errorCount = 0;

                const allPageImageLinks = []; // Store all <a> elements that are image links on the page
                const uniqueGalleryUrls = new Set(); // Track unique URLs for the gallery itself

                // Collect all image links on the page (including duplicates)
                document.querySelectorAll(SELECTORS.IMAGE_LINK).forEach(linkElement => {
                    const fullUrl = Utils.handleMediaSrc(linkElement);
                    if (fullUrl) {
                        allPageImageLinks.push({ linkElement: linkElement, originalUrl: fullUrl });
                        uniqueGalleryUrls.add(fullUrl); // Add to unique set for gallery
                    }
                });

                document.querySelectorAll(SELECTORS.ATTACHMENT_LINK).forEach(linkElement => {
                    const attachmentUrl = Utils.handleMediaSrc(linkElement);
                    const fileName = linkElement.getAttribute('download') || attachmentUrl || "";
                    const isLikelyImage = /\.(jpe?g|png|gif|webp)$/i.test(fileName);

                    if (attachmentUrl && isLikelyImage) {
                        allPageImageLinks.push({ linkElement: linkElement, originalUrl: attachmentUrl });
                        uniqueGalleryUrls.add(attachmentUrl); // Add to unique set for gallery
                    }
                });

                document.querySelectorAll(SELECTORS.VIDEO_LINK).forEach(videoLink => {
                    const video = videoLink.querySelector('video');
                    if (video && video.hasAttribute('poster')) {
                        const posterSrc = video.getAttribute('poster');
                        if (posterSrc) {
                            allPageImageLinks.push({ linkElement: videoLink, originalUrl: posterSrc });
                            uniqueGalleryUrls.add(posterSrc); // Add to unique set for gallery
                        }
                    }
                });

                // Set totalImages to the count of ALL image elements on the page for the counter.
                state.totalImages = allPageImageLinks.length;
                state.hasImages = state.totalImages > 0;

                // Pre-fill gallery arrays with nulls, to be populated only by unique images
                // The size of gallery arrays is based on unique URLs.
                state.fullSizeImageSrcs = Array(uniqueGalleryUrls.size).fill(null);
                state.originalImageSrcs = Array(uniqueGalleryUrls.size).fill(null);
                state.virtualGallery = Array(uniqueGalleryUrls.size).fill(null);

                // Ensure thumbnails exist and apply initial styles (if needed)
                await ImageLoader.simulateScrollDown();
                Utils.ensureThumbnailsExist();

                // Create an ordered array of unique URLs to map them to gallery indices
                const orderedUniqueGalleryUrls = Array.from(uniqueGalleryUrls);

                // Process all image links on the page in batches
                const processingPromises = [];
                for (let i = 0; i < allPageImageLinks.length; i++) {
                    const item = allPageImageLinks[i];
                    // Determine if this specific item's URL is unique for the gallery.
                    // If it is, get its index in the ordered unique list.
                    const isUniqueForGallery = uniqueGalleryUrls.has(item.originalUrl);
                    const galleryIndex = isUniqueForGallery ? orderedUniqueGalleryUrls.indexOf(item.originalUrl) : -1;

                    processingPromises.push(
                        ImageLoader.loadImageAndApplyToPage(item.linkElement, galleryIndex, item.originalUrl, isUniqueForGallery)
                    );
                }

                // Execute all loading/applying promises concurrently.
                // The loadImageAndApplyToPage function already increments state.loadedImages.
                await Promise.all(processingPromises);

                // After all processing, update notification status
                if (state.loadedImages === state.totalImages && state.totalImages > 0 && state.errorCount === 0) {
                    state.notification = `Images Done Loading! Total: ${state.totalImages}`;
                    state.notificationType = 'success';
                } else if (state.errorCount > 0) {
                    state.notification = `Gallery: ${state.errorCount} error(s). Loaded: ${state.loadedImages}/${state.totalImages} items.`;
                    state.notificationType = 'warning';
                } else if (state.loadedImages < state.totalImages && state.totalImages > 0) {
                    state.notification = `Gallery: Partially loaded (${state.loadedImages}/${state.totalImages} items).`;
                    state.notificationType = 'warning';
                } else if (state.totalImages === 0) {
                    state.notification = 'No images found for gallery.';
                    state.notificationType = 'info';
                }

                // Filter out nulls from gallery arrays if some unique items failed to load
                state.fullSizeImageSrcs = state.fullSizeImageSrcs.filter(src => src !== null);
                state.originalImageSrcs = state.originalImageSrcs.filter(src => src !== null);
                state.virtualGallery = state.virtualGallery.filter(src => src !== null);

                state.galleryReady = true;
                state.isLoading = false;
                state.loadingMessage = null;

            } catch (error) {
                console.error('Critical Error in ImageLoader.loadImages:', error);
                state.notification = 'Critical error loading images for gallery. Please refresh.';
                state.notificationType = 'error';
                state.isLoading = false;
                state.loadingMessage = null;
                state.galleryReady = false;
            }
        },
    };

    // ====================================================
    // Download Management
    // ====================================================

    const DownloadManager = {
        downloadAllImages: async () => {
            try {
                const imageLinks = document.querySelectorAll(SELECTORS.IMAGE_LINK);
                const attachmentLinks = document.querySelectorAll(SELECTORS.ATTACHMENT_LINK);

                const title = document.querySelector(SELECTORS.POST_TITLE)?.textContent?.trim() || "Untitled";
                const artistName = document.querySelector(SELECTORS.POST_USER_NAME)?.textContent?.trim() || "Unknown Artist";

                const itemsToProcess = [];
                const processedDownloadUrls = new Set();

                imageLinks.forEach((imgLink, index) => {
                    const fullImageUrl = imgLink.href.split("?")[0];
                    if (fullImageUrl && !processedDownloadUrls.has(fullImageUrl)) {
                        const originalFileName = imgLink.getAttribute("download") || `image-${index + 1}.jpg`;
                        itemsToProcess.push({
                            url: fullImageUrl,
                            originalName: originalFileName,
                            itemType: 'image',
                            originalIndex: index
                        });
                        processedDownloadUrls.add(fullImageUrl);
                    }
                });

                attachmentLinks.forEach((link, index) => {
                    const attachmentUrl = link.href;
                    if (attachmentUrl && !processedDownloadUrls.has(attachmentUrl)) {
                        const originalFileName = link.textContent.trim().replace("Download ", "") || `attachment-${index + 1}`;
                        itemsToProcess.push({
                            url: attachmentUrl,
                            originalName: originalFileName,
                            itemType: 'attachment',
                            originalIndex: index
                        });
                        processedDownloadUrls.add(attachmentUrl);
                    }
                });

                if (itemsToProcess.length === 0) {
                    state.notification = "No items to download.";
                    state.notificationType = "info";
                    return;
                }

                if (state.isGalleryMode || !state.isDownloading) {
                    const result = await Swal.fire({
                        title: 'Download All?',
                        text: `You are about to download ${itemsToProcess.length} item(s) as a ZIP. Proceed?`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Download',
                        cancelButtonText: 'Cancel',
                    });
                    if (!result.isConfirmed) return;
                }

                state.isDownloading = true;
                state.totalImages = itemsToProcess.length;
                state.downloadedCount = 0;
                state.loadingMessage = "Preparing download...";

                const sanitizedTitle = Utils.sanitizeFileName(title);
                const sanitizedArtistName = Utils.sanitizeFileName(artistName);
                const zip = new JSZip();
                const downloadPromises = [];

                for (let i = 0; i < itemsToProcess.length; i++) {
                    const item = itemsToProcess[i];
                    downloadPromises.push(DownloadManager.processFileForZip(
                        zip, item.url, item.originalName, item.itemType, item.originalIndex,
                        sanitizedTitle, sanitizedArtistName
                    ));
                }

                await Promise.all(downloadPromises);

                if (state.downloadedCount === 0 && itemsToProcess.length > 0) {
                    state.notification = "Failed to prepare any files for download.";
                    state.notificationType = 'error';
                    state.isDownloading = false;
                    state.loadingMessage = null;
                    return;
                }

                state.loadingMessage = "Generating ZIP...";
                const zipBlob = await zip.generateAsync(
                    { type: 'blob' },
                    (metadata) => {
                        state.notification = `Zipping... ${Math.round(metadata.percent)}%`;
                    }
                );

                const zipFileNameFormat = GM_getValue('zipFileNameFormat', '{title}-{artistName}.zip');
                let zipFileName = zipFileNameFormat
                    .replace("{artistName}", sanitizedArtistName)
                    .replace("{title}", sanitizedTitle);
                if (!zipFileName.toLowerCase().endsWith('.zip')) {
                    zipFileName += '.zip';
                }

                saveAs(zipBlob, zipFileName);

                state.isDownloading = false;
                state.loadingMessage = null;

            } catch (error) {
                console.error('Error in downloadAllImages:', error);
                Swal.fire('Error!', `Failed to create zip file: ${error.message}`, 'error');
                state.isDownloading = false;
                state.loadingMessage = null;
                state.notification = `Zip creation failed: ${error.message}`;
                state.notificationType = 'error';
            }
        },

        processFileForZip: async (zip, url, originalName, itemType, itemIndex,
                                    sanitizedPostTitle, sanitizedPostArtistName) => {
            try {
                // Ensure UPNG is loaded if optimization is enabled and it hasn't been loaded yet
                if (state.optimizePngInZip && !loadedUPNG) {
                    loadedUPNG = await loadResourceScript('upngJsRaw', 'UPNG');
                    if (!loadedUPNG) {
                        console.warn('Ultra Galleries: UPNG.js could not be loaded. PNG optimization will be skipped.');
                        // Optionally notify user or disable setting state.optimizePngInZip = false;
                    }
                }

                await DownloadManager.retryWithBackoff(async () => {
                    return new Promise((resolve, reject) => {
                        GM.xmlHttpRequest({
                            method: "GET",
                            url: url,
                            headers: { referer: `https://${window.location.hostname.split('.')[0]}.su/` },
                            responseType: 'blob',
                            onload: async function(response) { // Make this onload async for UPNG processing
                                if (response.status === 200 || response.status === 206) {
                                    let fileBlob = response.response;
                                    const contentTypeHeader = response.responseHeaders.match(/content-type:\s*([^;]+)/i);
                                    const contentType = contentTypeHeader ? contentTypeHeader[1].trim().toLowerCase() : (fileBlob.type || '').toLowerCase();

                                    let baseName = Utils.sanitizeFileName(originalName.replace(/\.[^/.]+$/, ""));
                                    let ext = Utils.getExtension(originalName);

                                    if (!ext || ['tmp', 'file', ''].includes(ext.toLowerCase())) {
                                        if (contentType && contentType.startsWith('image/')) {
                                            const imageExt = contentType.split('/')[1].replace('jpeg', 'jpg');
                                            if (imageExt && !['octet-stream', 'x-icon'].includes(imageExt.toLowerCase())) {
                                                ext = imageExt;
                                            }
                                        }
                                    }
                                    ext = ext || 'bin';

                                    // PNG Optimization Step
                                    if (state.optimizePngInZip && loadedUPNG && (contentType === 'image/png' || ext.toLowerCase() === 'png')) {
                                        try {
                                            console.log(`Ultra Galleries: Optimizing PNG: ${originalName}`);
                                            const arrayBuffer = await fileBlob.arrayBuffer();
                                            const decodedPng = loadedUPNG.decode(arrayBuffer);
                                            // UPNG.encode(frames, w, h, cnum, dels)
                                            // For single frame PNGs, frames is an array with one element: decodedPng.data
                                            // cnum = 0 aims for lossless compression, choosing smallest representation
                                            const optimizedPngArrayBuffer = loadedUPNG.encode([decodedPng.data], decodedPng.width, decodedPng.height, 0);
                                            fileBlob = new Blob([optimizedPngArrayBuffer], { type: 'image/png' });
                                            console.log(`Ultra Galleries: PNG optimized: ${originalName}. Original: ${arrayBuffer.byteLength}, Optimized: ${optimizedPngArrayBuffer.byteLength}`);
                                        } catch (upngError) {
                                            console.error(`Ultra Galleries: Error optimizing PNG ${originalName}:`, upngError);
                                            // Proceed with the original blob if optimization fails
                                        }
                                    }


                                    const imageFileNameFormat = GM_getValue('imageFileNameFormat', '{title}-{artistName}-{fileName}-{index}');
                                    let pathInZip = imageFileNameFormat
                                        .replace("{title}", sanitizedPostTitle)
                                        .replace("{artistName}", sanitizedPostArtistName)
                                        .replace("{fileName}", baseName)
                                        .replace("{index}", itemIndex + 1)
                                        .replace("{ext}", ext);

                                    if (!pathInZip.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
                                        pathInZip = `${pathInZip}.${ext}`;
                                    }

                                    pathInZip = pathInZip.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
                                    if (pathInZip.startsWith('../') || pathInZip.startsWith('/')) {
                                        pathInZip = pathInZip.replace(/^(\.\.\/)+|^\/+/g, '');
                                    }

                                    zip.file(pathInZip, fileBlob); // Use the (potentially optimized) fileBlob
                                    state.downloadedCount++;
                                    resolve();
                                } else {
                                    console.error('Ultra Galleries: Error downloading file for zip:', response.status, originalName);
                                    reject(new Error(`Failed to fetch ${originalName}: ${response.status}`));
                                }
                            },
                            onerror: function(error) {
                                console.error('Ultra Galleries: Network error downloading file for zip:', error, originalName);
                                reject(error);
                            }
                        });
                    });
                }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, url);
            } catch (error) {
                console.error(`Ultra Galleries: Failed to process ${originalName} for zip after retries:`, error);
            }
        },

        downloadImageByIndex: async (index) => {
            const galleryItemSrc = state.fullSizeImageSrcs[index];
            if (!galleryItemSrc) {
                console.error("Individual Download: Image source not found for index:", index);
                Swal.fire('Error!', `Image source not found.`, 'error');
                return;
            }

            let originalFileName;
            const urlParts = galleryItemSrc.split('?')[0].split('/');
            originalFileName = urlParts[urlParts.length - 1] || `image_${index + 1}.jpg`;
            // To get the true original filename, state.fullSizeImageSrcs would need to store objects
            // e.g., { src: 'url', originalName: 'name.jpg' }

            try {
                await DownloadManager.retryWithBackoff(async () => {
                    return new Promise((resolve, reject) => {
                        GM.xmlHttpRequest({
                            method: "GET",
                            url: galleryItemSrc,
                            headers: { referer: `https://${window.location.hostname.split('.')[0]}.su/` },
                            responseType: 'blob',
                            onload: function(response) {
                                if (response.status === 200 || response.status === 206) {
                                    saveAs(response.response, Utils.sanitizeFileName(originalFileName));
                                    resolve();
                                } else {
                                    reject(new Error(`HTTP ${response.status}`));
                                }
                            },
                            onerror: function(error) { reject(error); }
                        });
                    });
                }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, galleryItemSrc);

                state.notification = `Downloaded: ${Utils.sanitizeFileName(originalFileName)}`;
                state.notificationType = 'success';
            } catch (error) {
                console.error('Error downloading individual image:', error);
                Swal.fire('Error!', `Failed to download image: ${error.message}`, 'error');
            }
        },

        retryWithBackoff: async (downloadFn, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY, url) => {
            try {
                return await downloadFn();
            } catch (err) {
                if (retries <= 0) {
                    console.error(`Failed to download/process ${url} after ${CONFIG.MAX_RETRIES} retries.`);
                    throw err;
                }
                console.log(`Retrying download/process for ${url}, ${retries} attempts remaining`);
                await Utils.delay(delay);
                return DownloadManager.retryWithBackoff(downloadFn, retries - 1, delay * 1.5, url);
            }
        }
    };

    // ====================================================
    // Post Actions Management
    // ====================================================

    // Global UI elements
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
        initPostActions: () => {
            try {
                state.postActionsInitialized = true;
                if (!Utils.isPostPage() || state.currentPostUrl === window.location.href) {
                    if (state.currentPostUrl === window.location.href && elements.postActions) {
                        // Potentially just re-check if global buttons are there if some other script removed them
                    } else {
                        return;
                    }
                } else {
                    // URL has changed to a new post page, or first time initialization on a post page
                    PostActions.cleanupPostActions();
                }


                const currentPageUrl = window.location.href;

                document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img').forEach(img => img.classList.add('post__image'));
                document.querySelectorAll(SELECTORS.ATTACHMENT_LINK).forEach(link => link.dataset.fileName = link.getAttribute('download'));

                elements.postActions = document.querySelector(SELECTORS.POST_ACTIONS);
                if (!elements.postActions) {
                    console.warn("PostActions: elements.postActions not found with selector:", SELECTORS.POST_ACTIONS);
                    return; // Cannot proceed without the main actions container
                }

                const hasMediaLinksOnPage = document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;

                // Setup global action buttons (FILL HEIGHT, FILL WIDTH, FULL, DL ALL, GALLERY)
                if (hasMediaLinksOnPage) {
                    if (!elements.statusContainer) {
                        const { container, element } = UI.createStatusElement();
                        elements.statusContainer = container;
                        elements.statusElement = element;
                        elements.postActions.appendChild(container);
                    }
                    // Check if global buttons are already present to avoid duplicates on minor re-runs
                    if (!elements.postActions.querySelector('a.ug-button[data-action="gallery"]')) {
                        const heightButton = UI.createToggleButton(BUTTONS.HEIGHT, () => PostActions.resizeAllImages('height'));
                        const widthButton  = UI.createToggleButton(BUTTONS.WIDTH,  () => PostActions.resizeAllImages('width'));
                        const fullButton   = UI.createToggleButton(BUTTONS.FULL,   () => PostActions.resizeAllImages('full'));
                        const downloadAllButton = UI.createToggleButton(BUTTONS.DOWNLOAD_ALL, DownloadManager.downloadAllImages);
                        const galleryButton = UI.createToggleButton('Loading Gallery...', Gallery.toggleGallery, true);
                        galleryButton.dataset.action = "gallery";
                        elements.galleryButton = galleryButton;
                        elements.postActions.append(heightButton, widthButton, fullButton, downloadAllButton, galleryButton);
                    }
                }


                if (!elements.settingsButton) {
                    const settingsButton = document.createElement('button');
                    settingsButton.textContent = BUTTONS.SETTINGS;
                    settingsButton.className = `${CSS.SETTINGS_BTN} ${CSS.BTN}`;
                    settingsButton.addEventListener('click', () => { state.settingsOpen = !state.settingsOpen; });
                    document.body.appendChild(settingsButton);
                    elements.settingsButton = settingsButton;
                }

                // Setup per-image buttons
                const filesArea = document.querySelector('div.post__files');
                if (filesArea) {
                    const imageElementsOnPage = Array.from(filesArea.querySelectorAll(SELECTORS.IMAGE_LINK + ' > img.post__image'));
                    state.displayedImages = imageElementsOnPage;

                    imageElementsOnPage.forEach((imgElement, loopIndex) => {
                        if (!imgElement) return;

                        ImageLoader.imageActions.height(imgElement);

                        const thumbnailDiv = imgElement.closest(SELECTORS.THUMBNAIL);
                        if (!thumbnailDiv) {
                            console.warn('PostActions: Could not find thumbnailDiv for imgElement:', imgElement);
                            return;
                        }

                        if (thumbnailDiv.previousElementSibling && thumbnailDiv.previousElementSibling.classList.contains(CSS.BTN_CONTAINER)) {
                            thumbnailDiv.previousElementSibling.remove();
                        }

                        const buttonGroupConfig = [
                            // Make sure config.name matches what UI.createButtonGroup expects for hide checks
                            { text: BUTTONS.HEIGHT,   action: PostActions.resizeImage, name: 'HEIGHT' },
                            { text: BUTTONS.WIDTH,    action: PostActions.resizeImage, name: 'WIDTH' },
                            { text: BUTTONS.FULL,     action: () => ImageLoader.imageActions.full(imgElement), name: 'FULL' },
                            { text: BUTTONS.DOWNLOAD, action: () => {
                                // Find index based on what ImageLoader.loadImage stored
                                const originalSrcForDownload = imgElement.dataset.originalSrc || Utils.handleMediaSrc(imgElement.closest(SELECTORS.IMAGE_LINK));
                                const downloadIndex = state.fullSizeImageSrcs.findIndex(src => state.originalImageSrcs[state.fullSizeImageSrcs.indexOf(src)] === originalSrcForDownload); // Find index based on original URL
                                if (downloadIndex > -1) {
                                    DownloadManager.downloadImageByIndex(downloadIndex);
                                } else {
                                    console.error("Download (per-image): Could not find image index for src:", originalSrcForDownload, "Available:", state.originalImageSrcs);
                                }
                            }, name: 'DOWNLOAD'},
                        ];

                        const buttonGroupElement = UI.createButtonGroup(buttonGroupConfig);

                        if (buttonGroupElement.childElementCount > 0 && thumbnailDiv.parentNode) {
                            thumbnailDiv.parentNode.insertBefore(buttonGroupElement, thumbnailDiv);
                        }
                    });

                    // Add delegated click handler to the parent of all file thumbnails
                    if (!filesArea.dataset.ugClickHandlerAttached) {
                        filesArea.addEventListener('click', PostActions.delegatedImageClickHandler);
                        filesArea.dataset.ugClickHandlerAttached = "true";
                    }
                }
                state.currentPostUrl = currentPageUrl;
            } catch (error) {
                console.error('Error initializing post actions:', error);
                state.notification = 'Error initializing UI. Try refreshing the page.';
                state.notificationType = 'error';
            }
        },

        cleanupPostActions: () => {
            if (elements.postActions) {
                elements.postActions.querySelectorAll('a.ug-button').forEach(button => button.remove());
            }
            if (elements.settingsButton && elements.settingsButton.parentNode) {
                elements.settingsButton.remove();
                elements.settingsButton = null;
            }

            const filesArea = document.querySelector('div.post__files');
            if (filesArea) {
                filesArea.removeEventListener('click', PostActions.delegatedImageClickHandler);
                filesArea.removeAttribute('data-ug-click-handler-attached');
                filesArea.querySelectorAll(`.${CSS.BTN_CONTAINER}`).forEach(bc => bc.remove());
                // Remove CSS.NO_CLICK from any remaining image links
                filesArea.querySelectorAll(SELECTORS.IMAGE_LINK).forEach(link => {
                    link.classList.remove(CSS.NO_CLICK);
                });
            }

            if (elements.statusContainer && elements.statusContainer.parentNode) {
                elements.statusContainer.remove();
                elements.statusContainer = null;
                elements.statusElement = null;
            }
            elements.postActions = null;

            for (const blobUrl of loadedBlobUrls.values()) {
                if (typeof blobUrl === 'string' && blobUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(blobUrl); } catch (e) { /* silent */ }
                }
            }
            loadedBlobUrls.clear();
            loadedBlobs.clear();

            if (Array.isArray(state.fullSizeImageSrcs)) {
                state.fullSizeImageSrcs.forEach(src => {
                    if (typeof src === 'string' && src.startsWith('blob:')) {
                        try { URL.revokeObjectURL(src); } catch (e) { /* Silent error */ }
                    }
                });
            }


            state.fullSizeImageSrcs = [];
            state.originalImageSrcs = [];
            state.virtualGallery = [];

            state.currentPostUrl = null;
            state.galleryReady = false;
            state.loadedImages = 0;
            state.totalImages = 0;
            state.mediaLoaded = {};
            state.errorCount = 0;
            state.postActionsInitialized = false;
        },

        clickAllImageButtons: actionKey => {
            const targetButtonText = BUTTONS[actionKey.toUpperCase()];
            if (!targetButtonText) {
                console.error("clickAllImageButtons: Invalid actionKey", actionKey);
                return;
            }

            const filesArea = document.querySelector('div.post__files');
            if (!filesArea) return;

            // Find all relevant button containers and then the specific button
            filesArea.querySelectorAll(`.${CSS.BTN_CONTAINER}`).forEach(buttonGroup => {
                const button = Array.from(buttonGroup.querySelectorAll(`.${CSS.BTN}`))
                    .find(btn => btn.textContent === targetButtonText);
                if (button) {
                    button.click();
                }
            });
        },

        resizeAllImages: action => {
            if (!ImageLoader.imageActions[action]) {
                console.error('PostActions.resizeAllImages: Invalid action:', action);
                return;
            }
            document.querySelectorAll(`${SELECTORS.IMAGE_LINK} img.post__image`).forEach(img => {
                ImageLoader.imageActions[action](img);
            });
        },

        resizeImage: evt => {
            const actionText = evt.currentTarget.textContent;
            const action = Object.keys(BUTTONS)
                .find(key => BUTTONS[key] === actionText)
                ?.toLowerCase();

            if (!action || !ImageLoader.imageActions[action]) {
                console.error('PostActions.resizeImage: Invalid action or action not found in ImageLoader.imageActions:', action);
                return;
            }

            const buttonContainer = evt.currentTarget.closest(`.${CSS.BTN_CONTAINER}`);
            if (!buttonContainer) {
                console.error('PostActions.resizeImage: Could not find button container.');
                return;
            }

            const imageOwningThumbnailDiv = buttonContainer.nextElementSibling;
            if (!imageOwningThumbnailDiv || !imageOwningThumbnailDiv.matches(SELECTORS.THUMBNAIL)) {
                console.error('PostActions.resizeImage: Could not find image-owning thumbnail div, or it does not match selector:', SELECTORS.THUMBNAIL, imageOwningThumbnailDiv);
                return;
            }

            const displayedImage = imageOwningThumbnailDiv.querySelector('img.post__image');
            if (!displayedImage) {
                console.error('PostActions.resizeImage: Could not find img.post__image within thumbnail div.');
                return;
            }

            ImageLoader.imageActions[action](displayedImage);
        },

        delegatedImageClickHandler: event => {
            if (event.button === 2) return;
            const clickedImageLink = event.target.closest(SELECTORS.IMAGE_LINK);

            if (clickedImageLink) {
                event.preventDefault(); // ALWAYS prevent default navigation on image link click

                if (state.galleryReady) {
                    // Determine which image was clicked to open the gallery at that index
                    const originalSrcElement = clickedImageLink.querySelector('img.post__image');
                    const originalSrcClicked = originalSrcElement ? originalSrcElement.dataset.originalSrc : Utils.handleMediaSrc(clickedImageLink);

                    const galleryIndex = state.originalImageSrcs.indexOf(originalSrcClicked); // Find index in unique gallery array

                    if (galleryIndex !== -1) {
                        Gallery.createGallery(); // Ensure gallery structure exists
                        Gallery.showExpandedView(galleryIndex); // Open at the clicked image's index
                    } else {
                        console.warn("Ultra Galleries: Clicked image not found in gallery index, opening gallery to grid view.");
                        Gallery.toggleGallery(); // Fallback to just opening the gallery (grid view)
                    }
                } else {
                    state.notification = "Gallery content is still loading or not available.";
                    state.notificationType = "info";
                }
            }
        },
    };

    // ====================================================
    // Event Handlers
    // ====================================================

    const EventHandlers = {
        handleGalleryKey: event => {
            if (!Utils.isPostPage()) return; // Only on post pages

            // Toggle gallery with configured key
            if (event.key.toLowerCase() === state.galleryKey.toLowerCase() && !event.altKey && !event.ctrlKey && !event.metaKey) {
                if (state.galleryReady) {
                    event.preventDefault();
                    Gallery.toggleGallery();
                    return; // Exclusive action for gallery toggle
                } else if (Utils.isPostPage() && !state.isGalleryMode) {
                    // If on a post page, gallery not ready, and not in gallery mode, notify user
                    state.notification = "Gallery content is still loading or not available.";
                    state.notificationType = "info";
                    return;
                }
            }

            if (state.isGalleryMode && galleryOverlay && galleryOverlay.length) {
                const $gridView = galleryOverlay.find(`.${CSS.GALLERY.GRID_VIEW}`);
                const $expandedView = galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`);

                if (!$gridView.length || !$expandedView.length) {
                    // This might happen if the gallery structure is unexpectedly missing these elements
                    console.warn("Ultra Galleries: handleGalleryKey - Grid or Expanded view not found in galleryOverlay.");
                    return;
                }

                // --- Escape Key Logic ---
                if (event.key === 'Escape') {
                    event.preventDefault();
                    if (!$expandedView.hasClass(CSS.GALLERY.HIDE)) {
                        Gallery.showGridView();
                    } else if (!$gridView.hasClass(CSS.GALLERY.HIDE)) { 
                        Gallery.closeGallery();
                    }
                    return; // Escape key action is exclusive
                }

                // --- Other Key Logic (Navigation, Zoom) - Only in Expanded View ---
                if ($gridView.hasClass(CSS.GALLERY.HIDE) && !$expandedView.hasClass(CSS.GALLERY.HIDE)) {
                    const keyLower = event.key.toLowerCase();
                    let actionTaken = false;

                    // Define relevant keys for expanded view actions
                    const prevKeys = [state.prevImageKey.toLowerCase(), 'arrowleft', 'k'];
                    const nextKeys = [state.nextImageKey.toLowerCase(), 'arrowright', 'l'];
                    const zoomInKeys = ['+', '='];
                    const zoomOutKeys = ['-'];
                    const resetZoomKeys = ['0'];

                    if (prevKeys.includes(keyLower)) {
                        Gallery.prevImage();
                        actionTaken = true;
                    } else if (nextKeys.includes(keyLower)) {
                        Gallery.nextImage();
                        actionTaken = true;
                    } else if (zoomInKeys.includes(keyLower)) {
                        Zoom.zoom(CONFIG.ZOOM_STEP);
                        actionTaken = true;
                    } else if (zoomOutKeys.includes(keyLower)) {
                        Zoom.zoom(-CONFIG.ZOOM_STEP);
                        actionTaken = true;
                    } else if (resetZoomKeys.includes(keyLower)) {
                        Zoom.resetZoom();
                        actionTaken = true;
                    }

                    if (actionTaken) {
                        event.preventDefault(); // Prevent default browser action if a script action was taken
                    }
                }
            }
        },
        handleSettingsKey: event => {
            if (state.settingsOpen && event.key === 'Escape') {
                state.settingsOpen = false;
            }
        },

        handleWindowResize: Utils.debounce(() => {
            if (!galleryOverlay || !galleryOverlay.length || !state.isGalleryMode) return;

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return; // Ensure container was found

            const newWidth = $container.width(); 
            const newHeight = $container.height(); 

            if (newWidth !== state.lastWidth || newHeight !== state.lastHeight) {
                state.lastWidth = newWidth;
                state.lastHeight = newHeight;

                const $expandedView = galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`);
                const $mainImage = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG}`); // Find within overlay

                // Check if in expanded view and an image is loaded
                if ($expandedView.length && !$expandedView.hasClass(CSS.GALLERY.HIDE) &&
                    $mainImage.length && $mainImage.attr('src')) {
                    // Zoom.initializeImage expects DOM elements
                    Zoom.initializeImage($mainImage[0], $container[0]);
                } else {
                    Zoom.resetZoom(); // Fallback reset
                }
            }
        }, CONFIG.DEBOUNCE_DELAY),

        toggleControlsVisibility: () => {
            state.controlsVisible = !state.controlsVisible;
        },

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

    const injectUI = () => {
        try {
            if (!Utils.isPostPage()) {
                // Reset state when leaving a post page
                state.postActionsInitialized = false;
                state.notification = null;
                state.loadingMessage = null;
                state.isLoading = false;
                state.galleryReady = false;
                state.hasImages = false;
                state.totalImages = 0;
                PostActions.cleanupPostActions();
                uiCache = {};
                previousPageUrl = null;
                return;
            }

            const mediaLinks = [...document.querySelectorAll(SELECTORS.IMAGE_LINK)];
            const currentTotalImages = mediaLinks.length;
            const currentPageUrl = window.location.href;
            const postSection = document.querySelector('.site-section.site-section--post');

            if (!state.postActionsInitialized && postSection) {
                // Initialize new post page
                state.galleryReady = false;
                state.loadedImages = 0;
                state.hasImages = false;
                state.totalImages = currentTotalImages;

                const hasMedia = document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;
                if (hasMedia) {
                    // Add status container
                    if (!elements.statusContainer) {
                        const { container, element } = UI.createStatusElement();
                        elements.statusContainer = container;
                        elements.statusElement = element;
                        const actionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);
                        if (actionsContainer) {
                            actionsContainer.appendChild(container);
                        }
                    }
                    state.notification = `Loading media (${state.loadedImages}/${state.totalImages})...`;
                }

                // Generate missing thumbnails and load images
                Utils.ensureThumbnailsExist();
                ImageLoader.loadImages();
                PostActions.initPostActions();
                state.currentPostUrl = currentPageUrl;
                previousPageUrl = currentPageUrl;
            } else if (currentPageUrl !== state.currentPostUrl) {
                // Handle URL change to a different post
                PostActions.cleanupPostActions();
                state.totalImages = currentTotalImages;
                state.galleryReady = false;
                state.loadedImages = 0;
                state.hasImages = false;
                state.notification = null;
                state.loadingMessage = null;
                state.isLoading = false;

                const hasMedia = document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;
                if (hasMedia) {
                    if (!elements.statusContainer) {
                        const { container, element } = UI.createStatusElement();
                        elements.statusContainer = container;
                        elements.statusElement = element;
                        const actionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);
                        if (actionsContainer) {
                            actionsContainer.appendChild(container);
                        }
                    }
                    state.notification = `Loading media (${state.loadedImages}/${state.totalImages})...`;
                } else if (elements.statusContainer) {
                    elements.statusContainer.remove();
                    elements.statusContainer = null;
                    elements.statusElement = null;
                }

                Utils.ensureThumbnailsExist();
                ImageLoader.loadImages();
                PostActions.initPostActions();
                state.currentPostUrl = currentPageUrl;
                previousPageUrl = currentPageUrl;
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
            // Load CSS
            GM.xmlHttpRequest({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/main/Ultra-Galleries.css',
                onload: function(response) {
                    if (response.status === 200) {
                        GM_addStyle(response.responseText);
                    } else {
                        console.error('Error loading CSS:', response.status);
                    }
                },
                onerror: function(error) {
                    console.error('Error loading CSS:', error);
                },
            });

            if (!loadedPako) {
                loadedPako = await loadResourceScript('pakoJsRaw', 'pako');
                if (loadedPako) {
                    console.log("Ultra Galleries: Pako.js loaded and available.");
                } else {
                    console.warn("Ultra Galleries: Pako.js could not be loaded.");
                }
            }

            if (state.enablePersistentCaching) {
                initDexie();
            }

            // Load saved settings
            CONFIG.MAX_SCALE = GM_getValue('maxZoomScale', CONFIG.MAX_SCALE);

            // Add mobile right-click handling CSS
            GM_addStyle(`
                .${CSS.LONG_PRESS} { cursor: context-menu !important; }
                .${CSS.NOTIF_AREA} {
                    top: ${state.notificationPosition === 'top' ? '10px' : 'auto'};
                    bottom: ${state.notificationPosition === 'bottom' ? '10px' : 'auto'};
                }
            `);

            // Attach event listeners
            if (!galleryKeyListenerAttached) {
                window.addEventListener('keydown', EventHandlers.handleGalleryKey);
                window.addEventListener('keydown', EventHandlers.handleSettingsKey);
                galleryKeyListenerAttached = true;
            }
            window.addEventListener('error', EventHandlers.handleGlobalError);
            window.addEventListener('resize', EventHandlers.handleWindowResize);

            // Create notification area
            if (!document.getElementById(CSS.NOTIF_AREA) && state.notificationAreaVisible) {
                UI.createNotificationArea();
            }

            // Setup mutation observer for DOM changes
            const observer = new MutationObserver(injectUI);
            observer.observe(document.body, { childList: true, subtree: true });

            // Initial UI state
            if (Utils.isPostPage()) {
                Utils.ensureThumbnailsExist();

                if (state.loadedImages === state.totalImages && state.totalImages > 0) {
                    state.notification = `Images Done Loading! Total: ${state.totalImages}`;
                    state.notificationType = 'success';
                } else if (state.notificationType === 'error') {
                    state.notification = 'Error loading some media.';
                }
            } else {
                state.notification = null;
                state.isLoading = false;
                state.galleryReady = false;
            }
        } catch (error) {
            console.error('Error in init:', error);
            state.notification = 'Error initializing script. Check console for details.';
            state.notificationType = 'error';
        }
    };

    // Initialize the script
    init();
})();