// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      3.1.2
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
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/jszip@3.1.4/dist/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@1.3.2/FileSaver.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
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

        // Notification state
        notification: null,
        notificationType: 'info',

        // Download settings
        downloadThumbnail: GM_getValue('downloadThumbnail', true),

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
            const toolbar = galleryOverlay?.querySelector(`.${CSS.GALLERY.TOOLBAR}`);
            if (toolbar) toolbar.classList.toggle(CSS.GALLERY.CONTROLS_HIDDEN, !value);
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
        hasImages: (value) => {
            if (elements.galleryButton) {
                elements.galleryButton.style.display = value ? 'inline-block' : 'none';
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

            const container = galleryOverlay?.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (container) {
                container.classList.toggle(CSS.GALLERY.ZOOMED, value > 1);
                container.style.cursor = value > 1 ? 'grab' : 'default';
            }

            // Show instructions tooltip first time
            if (value > 1 && oldValue === 1 && state.zoomIndicatorVisible) {
                const tooltip = Utils.createTooltip('Click and drag to pan image');
                galleryOverlay.appendChild(tooltip);
                state.zoomIndicatorVisible = false;
            }
        },
        imageOffset: () => Zoom.applyZoom(),
        isDragging: (value) => {
            const container = galleryOverlay?.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (container) {
                container.classList.toggle(CSS.GALLERY.GRABBING, value);

                if (value && state.inertiaActive) {
                    state.inertiaActive = false;
                    state.velocity = { x: 0, y: 0 };
                    if (state.inertiaAnimFrame) {
                        cancelAnimationFrame(state.inertiaAnimFrame);
                        state.inertiaAnimFrame = null;
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
        downloadThumbnail: (value) => {
            GM_setValue('downloadThumbnail', value);
        }
    });

    // ====================================================
    // Zoom & Pan Module
    // ====================================================

    const Zoom = {
        applyZoom: () => {
            const container = galleryOverlay?.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!container) return;

            container.style.transform = `translate(${state.imageOffset.x}px, ${state.imageOffset.y}px) scale(${state.zoomScale})`;

            const zoomDisplay = galleryOverlay?.querySelector('#zoom-level');
            if (zoomDisplay) {
                zoomDisplay.textContent = `${Math.round(state.zoomScale * 100)}%`;
            }

            // Toggle zoomed class
            container.classList.toggle('zoomed', state.zoomScale !== 1);
        },

        handleWheelZoom: (event) => {
            if (!state.zoomEnabled || !galleryOverlay) return;
            event.preventDefault();
            event.stopPropagation();

            const container = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            const image = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG}`);
            if (!image || !container) return;

            const rect = container.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const delta = Math.sign(event.deltaY) * -0.1;
            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(state.zoomScale + delta, CONFIG.MAX_SCALE));

            // Calculate zoom centered on mouse position
            const imageX = (mouseX - state.imageOffset.x) / state.zoomScale;
            const imageY = (mouseY - state.imageOffset.y) / state.zoomScale;
            const newOffsetX = mouseX - (imageX * newScale);
            const newOffsetY = mouseY - (imageY * newScale);

            // Update state
            state.imageOffset.x = newOffsetX;
            state.imageOffset.y = newOffsetY;
            state.zoomScale = newScale;

            // Apply smooth zoom
            container.style.transition = 'transform 0.1s ease-out';
            setTimeout(() => container.style.transition = '', 100);
            Zoom.applyZoom();
        },

        enforceBoundaries: (offsetX, offsetY, scale, containerRect, image) => {
            const imgWidth = image.naturalWidth * scale;
            const imgHeight = image.naturalHeight * scale;
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;

            // Handle centering for small images or edge resistance for large images
            if (imgWidth <= containerWidth) {
                // Center horizontally
                offsetX = (containerWidth - imgWidth) / 2;
            } else {
                // Apply resistance near edges
                const maxX = (imgWidth - containerWidth) / 2;
                const minX = -maxX;

                if (offsetX > maxX) {
                    const overshot = offsetX - maxX;
                    offsetX = maxX + (overshot * CONFIG.PAN_RESISTANCE / scale);
                } else if (offsetX < minX) {
                    const overshot = minX - offsetX;
                    offsetX = minX - (overshot * CONFIG.PAN_RESISTANCE / scale);
                }
            }

            if (imgHeight <= containerHeight) {
                // Center vertically
                offsetY = (containerHeight - imgHeight) / 2;
            } else {
                // Apply resistance near edges
                const maxY = (imgHeight - containerHeight) / 2;
                const minY = -maxY;

                if (offsetY > maxY) {
                    const overshot = offsetY - maxY;
                    offsetY = maxY + (overshot * CONFIG.PAN_RESISTANCE / scale);
                } else if (offsetY < minY) {
                    const overshot = minY - offsetY;
                    offsetY = minY - (overshot * CONFIG.PAN_RESISTANCE / scale);
                }
            }

            return { x: offsetX, y: offsetY };
        },

        startDrag: (event) => {
            if (!galleryOverlay) return;

            // Allow context menu on right click
            if (event.button === 2) return;

            event.preventDefault();
            state.isDragging = true;

            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);

            state.dragStartPosition = { x: clientX, y: clientY };
            state.dragStartOffset = {
                x: state.imageOffset.x,
                y: state.imageOffset.y
            };

            // Visual feedback
            const container = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (container) {
                container.classList.add(CSS.GALLERY.GRABBING);
            }
        },

        dragImage: (event) => {
            if (!state.isDragging || !galleryOverlay) return;

            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);

            if (!clientX || !clientY) return;

            const deltaX = clientX - state.dragStartPosition.x;
            const deltaY = clientY - state.dragStartPosition.y;

            state.imageOffset.x = state.dragStartOffset.x + deltaX;
            state.imageOffset.y = state.dragStartOffset.y + deltaY;

            Zoom.applyZoom();
        },

        endDrag: () => {
            if (!state.isDragging || !galleryOverlay) return;

            state.isDragging = false;

            const container = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (container) {
                container.classList.remove(CSS.GALLERY.GRABBING);
            }
        },

        resetZoom: () => {
            if (!galleryOverlay) return;

            const container = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (container) {
                container.style.transition = 'transform 0.3s ease-out';

                state.zoomScale = 1;
                state.imageOffset = { x: 0, y: 0 };

                Zoom.applyZoom();

                setTimeout(() => container.style.transition = '', 300);
            }
        },

        initializeImage: (image, container) => {
            if (!image || !container) return;

            // Reset styles
            image.style.width = '';
            image.style.height = '';
            image.style.maxWidth = '100%';
            image.style.maxHeight = '100%';

            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            const imageWidth = image.naturalWidth;
            const imageHeight = image.naturalHeight;
            const aspectRatio = imageWidth / imageHeight;

            // Set optimal size
            if (aspectRatio > containerWidth / containerHeight) {
                image.style.width = '100%';
                image.style.height = 'auto';
            } else {
                image.style.width = 'auto';
                image.style.height = '100%';
            }

            // Reset zoom state
            state.zoomScale = 1;
            state.imageOffset = { x: 0, y: 0 };

            Zoom.applyZoom();
        },

        zoom: (step) => {
            if (!galleryOverlay) return;

            const container = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(state.zoomScale + step, CONFIG.MAX_SCALE));

            if (state.zoomScale !== newScale) {
                // Center zoom on image center
                const imageX = (centerX - state.imageOffset.x) / state.zoomScale;
                const imageY = (centerY - state.imageOffset.y) / state.zoomScale;

                const newOffsetX = centerX - (imageX * newScale);
                const newOffsetY = centerY - (imageY * newScale);

                // Smooth transition
                container.style.transition = 'transform 0.2s ease-out';

                state.imageOffset.x = newOffsetX;
                state.imageOffset.y = newOffsetY;
                state.zoomScale = newScale;

                Zoom.applyZoom();

                setTimeout(() => container.style.transition = '', 200);
            }
        },

        setupTouchEvents: () => {
            const container = galleryOverlay?.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!container) return;

            let initialTouchDistance = 0;
            let initialScale = 1;
            let lastTapTime = 0;
            let longPressTimer = null;
            const passiveSupported = Utils.supportsPassiveEvents();

            // Touch start handler
            const touchStart = (e) => {
                // Start long press timer for context menu
                if (e.touches.length === 1) {
                    clearTimeout(longPressTimer);
                    longPressTimer = setTimeout(() => {
                        e.target.classList.add(CSS.LONG_PRESS);
                        if (state.isDragging) Zoom.endDrag();
                    }, 500);
                }

                if (e.touches.length === 1) {
                    // Double tap detection
                    const now = Date.now();
                    const timeSinceLastTap = now - state.lastTapTime;

                    if (timeSinceLastTap < CONFIG.DOUBLE_TAP_THRESHOLD && timeSinceLastTap > 0) {
                        // Toggle zoom
                        if (state.zoomScale > 1) {
                            Zoom.resetZoom();
                        } else {
                            // Zoom in to tap position
                            const touch = e.touches[0];
                            const rect = container.getBoundingClientRect();
                            const touchX = touch.clientX - rect.left;
                            const touchY = touch.clientY - rect.top;

                            state.zoomOrigin = { x: touchX, y: touchY };
                            const newScale = 2.5;

                            const imageX = (touchX - state.imageOffset.x) / state.zoomScale;
                            const imageY = (touchY - state.imageOffset.y) / state.zoomScale;

                            const newOffsetX = touchX - (imageX * newScale);
                            const newOffsetY = touchY - (imageY * newScale);

                            const image = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG}`);
                            const boundedOffset = Zoom.enforceBoundaries(
                                newOffsetX, newOffsetY, newScale, rect, image
                            );

                            container.style.transition = 'transform 0.3s ease-out';
                            state.imageOffset.x = boundedOffset.x;
                            state.imageOffset.y = boundedOffset.y;
                            state.zoomScale = newScale;

                            setTimeout(() => container.style.transition = '', 300);
                        }

                        state.lastTapTime = 0;
                        return;
                    }

                    // Regular pan start
                    state.lastTapTime = now;
                    const touch = e.touches[0];
                    Zoom.startDrag({
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                } else if (e.touches.length === 2) {
                    // Clear long press for multi-touch
                    clearTimeout(longPressTimer);
                    e.preventDefault();

                    // Pinch zoom setup
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];

                    initialTouchDistance = Utils.getDistance(touch1, touch2);
                    initialScale = state.zoomScale;

                    state.zoomOrigin = Utils.getMidpoint(touch1, touch2);
                    state.pinchZoomActive = true;

                    if (state.isDragging) Zoom.endDrag();
                }
            };

            // Touch move handler
            const touchMove = (e) => {
                // Clear long press on movement
                clearTimeout(longPressTimer);

                if (e.touches.length === 1 && state.isDragging) {
                    const touch = e.touches[0];
                    Zoom.dragImage({
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                } else if (e.touches.length === 2 && state.pinchZoomActive) {
                    e.preventDefault();

                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];

                    const currentDistance = Utils.getDistance(touch1, touch2);
                    const scaleFactor = currentDistance / initialTouchDistance;
                    const newScale = Math.max(CONFIG.MIN_SCALE,
                                         Math.min(initialScale * scaleFactor, CONFIG.MAX_SCALE));

                    const midpoint = Utils.getMidpoint(touch1, touch2);
                    const rect = container.getBoundingClientRect();
                    const image = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG}`);

                    // Only update for significant changes
                    if (Math.abs(newScale - state.zoomScale) > 0.01) {
                        const touchX = midpoint.x - rect.left;
                        const touchY = midpoint.y - rect.top;

                        const imageX = (touchX - state.imageOffset.x) / state.zoomScale;
                        const imageY = (touchY - state.imageOffset.y) / state.zoomScale;

                        const newOffsetX = touchX - (imageX * newScale);
                        const newOffsetY = touchY - (imageY * newScale);

                        const boundedOffset = Zoom.enforceBoundaries(
                            newOffsetX, newOffsetY, newScale, rect, image
                        );

                        state.imageOffset.x = boundedOffset.x;
                        state.imageOffset.y = boundedOffset.y;
                        state.zoomScale = newScale;
                    }
                }
            };

            // Touch end handler
            const touchEnd = (e) => {
                clearTimeout(longPressTimer);

                // Remove long press indicator
                container.querySelectorAll(`.${CSS.LONG_PRESS}`).forEach(el => {
                    el.classList.remove(CSS.LONG_PRESS);
                });

                if (e.touches.length === 0 || state.pinchZoomActive) {
                    if (state.isDragging) Zoom.endDrag();
                    state.pinchZoomActive = false;
                    initialTouchDistance = 0;
                }
            };

            // Add event listeners
            container.addEventListener('touchstart', touchStart, passiveSupported ? { passive: false } : false);
            container.addEventListener('touchmove', touchMove, passiveSupported ? { passive: false } : false);
            container.addEventListener('touchend', touchEnd);
            container.addEventListener('touchcancel', touchEnd);
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

        showNotification: (message, type = 'info') => {
            if (!state.notificationsEnabled && type !== 'error') return;
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
        },

        hideNotification: () => {
            const container = document.getElementById(CSS.NOTIF_CONTAINER);
            if (!container) return;

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
            const overlay = document.createElement('div');
            overlay.id = 'ug-settings-overlay';
            overlay.classList.add(CSS.SETTINGS.OVERLAY);

            const container = document.createElement('div');
            container.classList.add(CSS.SETTINGS.CONTAINER);
            overlay.appendChild(container);

            const header = document.createElement('div');
            header.classList.add(CSS.SETTINGS.HEADER);
            container.appendChild(header);

            const headerText = document.createElement('h2');
            headerText.textContent = 'Ultra Galleries Settings';
            header.appendChild(headerText);

            const closeBtn = document.createElement('button');
            closeBtn.classList.add(CSS.SETTINGS.CLOSE_BTN);
            closeBtn.textContent = BUTTONS.CLOSE;
            closeBtn.addEventListener('click', () => state.settingsOpen = false);
            header.appendChild(closeBtn);

            const body = document.createElement('div');
            body.classList.add(CSS.SETTINGS.BODY);
            container.appendChild(body);

            // Create sections
            const sections = {
                general: createSection(body, 'General Settings'),
                keys: createSection(body, 'Keyboard Shortcuts'),
                notifications: createSection(body, 'Notifications'),
                formatting: createSection(body, 'File Formatting'),
                buttonVisibility: createSection(body, 'Button Visibility'),
                panZoom: createSection(body, 'Pan & Zoom Settings')
            };

            // --- General Settings ---
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

            // --- Pan & Zoom Settings ---
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

            // --- Button Visibility ---
            // Helper for creating button visibility toggles
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

            // --- Keyboard Shortcuts ---
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

            // --- Notifications Settings ---
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

            // Add dropdown for notification position
            const posDiv = document.createElement('div');
            posDiv.classList.add(CSS.SETTINGS.LABEL);
            posDiv.innerHTML = `
                <label class="${CSS.SETTINGS.LABEL}">Notification Position:</label>
                <select id="notificationPosition" class="${CSS.SETTINGS.INPUT}">
                    <option value="top" ${state.notificationPosition === 'top' ? 'selected' : ''}>Top</option>
                    <option value="bottom" ${state.notificationPosition === 'bottom' ? 'selected' : ''}>Bottom</option>
                </select>
            `;
            posDiv.querySelector('select').addEventListener('change', e => {
                state.notificationPosition = e.target.value;
            });
            sections.notifications.appendChild(posDiv);

            // --- File Formatting Settings ---
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

            document.body.appendChild(overlay);

            // Helper functions for creating settings UI elements
            function createSection(parent, title) {
                const section = document.createElement('div');
                section.classList.add(CSS.SETTINGS.SECTION);
                section.innerHTML = `<h3 class="${CSS.SETTINGS.SECTION_HEADER}">${title}</h3>`;
                parent.appendChild(section);
                return section;
            }

            function addCheckbox(parent, id, label, checked, onChange) {
                const div = document.createElement('div');
                div.classList.add(CSS.SETTINGS.CHECKBOX_LABEL);
                div.innerHTML = `
                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} class="${CSS.SETTINGS.INPUT}">
                    <label class="${CSS.SETTINGS.LABEL}" for="${id}">${label}</label>
                `;
                div.querySelector('input').addEventListener('change', e => onChange(e.target.checked));
                parent.appendChild(div);
                return div;
            }

            function addTextInput(parent, id, label, value, maxLength, onChange) {
                const div = document.createElement('div');
                div.classList.add(CSS.SETTINGS.LABEL);
                div.innerHTML = `
                    <label class="${CSS.SETTINGS.LABEL}" for="${id}">${label}</label>
                    <input type="text" id="${id}" value="${value}" maxlength="${maxLength}"
                           style="width: 2em;" class="${CSS.SETTINGS.INPUT}">
                `;
                div.querySelector('input').addEventListener('change', e => onChange(e.target.value));
                parent.appendChild(div);
                return div;
            }

            function addTextAreaInput(parent, id, label, value, onChange) {
                const div = document.createElement('div');
                div.classList.add(CSS.SETTINGS.LABEL);
                div.innerHTML = `
                    <label class="${CSS.SETTINGS.LABEL}" for="${id}">${label}</label>
                    <input type="text" id="${id}" value="${value}" style="width: 100%;" class="${CSS.SETTINGS.INPUT}">
                `;
                div.querySelector('input').addEventListener('change', e => onChange(e.target.value));
                parent.appendChild(div);
                return div;
            }

            function addNumberInput(parent, id, label, value, min, max, step, onChange) {
                const div = document.createElement('div');
                div.classList.add(CSS.SETTINGS.LABEL);
                div.innerHTML = `
                    <label for="${id}">${label}</label>
                    <input type="number" id="${id}" value="${value}" min="${min}" max="${max}"
                           step="${step}" class="${CSS.SETTINGS.INPUT}">
                `;
                div.querySelector('input').addEventListener('change', e => onChange(parseFloat(e.target.value)));
                parent.appendChild(div);
                return div;
            }
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
                    try {
                        URL.revokeObjectURL(cachedItem);
                    } catch (e) {
                        /* Silent error */
                    }
                }
            }
            Gallery._preloadedImageCache = {};
            Gallery._preloadingInProgress = {};
        },

        _fetchAndCacheImage: async function(indexToPreload) {
            if (indexToPreload < 0 || indexToPreload >= state.fullSizeImageSrcs.length) {
                return;
            }
            if (Gallery._preloadedImageCache[indexToPreload] || Gallery._preloadingInProgress[indexToPreload]) {
                return;
            }

            const imageUrl = state.fullSizeImageSrcs[indexToPreload];
            if (!imageUrl) {
                return;
            }

            Gallery._preloadingInProgress[indexToPreload] = true;

            try {
                await new Promise((resolve, reject) => {
                    GM.xmlHttpRequest({
                        method: 'GET',
                        url: imageUrl,
                        responseType: 'blob',
                        onload: function(response) {
                            if (response.status === 200 || response.status === 206) {
                                const blobUrl = URL.createObjectURL(response.response);
                                Gallery._preloadedImageCache[indexToPreload] = blobUrl;
                                resolve();
                            } else {
                                reject(new Error(`HTTP ${response.status}`));
                            }
                        },
                        onerror: (error) => {
                            reject(error);
                        }
                    });
                });
            } catch (error) {
                Gallery._preloadedImageCache[indexToPreload] = 'failed_preload';
            } finally {
                delete Gallery._preloadingInProgress[indexToPreload];
            }
        },

        _preloadAdjacentImages: function(currentIndex) {
            Gallery._fetchAndCacheImage(currentIndex + 1);
            Gallery._fetchAndCacheImage(currentIndex - 1);
        },

        // --- Private Helper Methods for UI Creation ---
        _createGalleryOverlayAndContainer: function() {
            galleryOverlay = document.createElement('div');
            galleryOverlay.id = 'gallery-overlay';
            galleryOverlay.classList.add(CSS.GALLERY.OVERLAY);

            const container = document.createElement('div');
            container.classList.add(CSS.GALLERY.CONTAINER);
            galleryOverlay.appendChild(container);
            return container;
        },

        _createBaseViews: function(galleryContentContainer) {
            const gridView = document.createElement('div');
            gridView.classList.add(CSS.GALLERY.GRID_VIEW);
            galleryContentContainer.appendChild(gridView);

            const expandedView = document.createElement('div');
            expandedView.classList.add(CSS.GALLERY.EXPANDED_VIEW, CSS.GALLERY.HIDE);
            galleryContentContainer.appendChild(expandedView);
            return { gridView, expandedView };
        },

        _createGridViewContent: function(gridViewElement) {
            const thumbnailGrid = document.createElement('div');
            thumbnailGrid.classList.add(CSS.GALLERY.THUMBNAIL_GRID);
            gridViewElement.appendChild(thumbnailGrid);

            const gridCloseButton = document.createElement('button');
            gridCloseButton.textContent = BUTTONS.CLOSE;
            gridCloseButton.classList.add(CSS.GALLERY.GRID_CLOSE);
            gridCloseButton.addEventListener('click', Gallery.closeGallery);
            gridCloseButton.setAttribute('aria-label', 'Close Gallery');
            gridViewElement.appendChild(gridCloseButton);
            return thumbnailGrid;
        },

        _createExpandedViewToolbar: function(expandedViewElement) {
            const toolbar = document.createElement('div');
            toolbar.classList.add(CSS.GALLERY.TOOLBAR);
            toolbar.addEventListener('mousedown', e => e.stopPropagation());
            expandedViewElement.appendChild(toolbar);

            const closeBtn = document.createElement('button');
            closeBtn.classList.add(CSS.GALLERY.TOOLBAR_BTN);
            closeBtn.textContent = BUTTONS.CLOSE;
            closeBtn.addEventListener('click', Gallery.showGridView);
            closeBtn.setAttribute('aria-label', 'Close Expanded View');
            toolbar.appendChild(closeBtn);

            const zoomControls = document.createElement('div');
            zoomControls.classList.add('zoom-controls');
            toolbar.appendChild(zoomControls);

            const zoomOutBtn = document.createElement('button');
            zoomOutBtn.id = 'zoom-out-btn';
            zoomOutBtn.title = 'Zoom Out';
            zoomOutBtn.classList.add(CSS.GALLERY.TOOLBAR_BTN);
            zoomOutBtn.innerHTML = '<img src="https://www.svgrepo.com/show/263638/zoom-out-search.svg" alt="Zoom Out" style="filter: invert(100%);">';
            zoomOutBtn.addEventListener('click', () => Zoom.zoom(-CONFIG.ZOOM_STEP));
            zoomControls.appendChild(zoomOutBtn);

            const zoomLevelDisplay = document.createElement('span');
            zoomLevelDisplay.id = 'zoom-level';
            zoomLevelDisplay.classList.add('zoom-level');
            zoomLevelDisplay.textContent = '100%';
            zoomControls.appendChild(zoomLevelDisplay);

            const zoomInBtn = document.createElement('button');
            zoomInBtn.id = 'zoom-in-btn';
            zoomInBtn.title = 'Zoom In';
            zoomInBtn.classList.add(CSS.GALLERY.TOOLBAR_BTN);
            zoomInBtn.innerHTML = '<img src="https://www.svgrepo.com/show/263635/zoom-in.svg" alt="Zoom In" style="filter: invert(100%);">';
            zoomInBtn.addEventListener('click', () => Zoom.zoom(CONFIG.ZOOM_STEP));
            zoomControls.appendChild(zoomInBtn);

            const resetZoomBtn = document.createElement('button');
            resetZoomBtn.id = 'reset-btn';
            resetZoomBtn.title = 'Reset Zoom & Position';
            resetZoomBtn.classList.add(CSS.GALLERY.TOOLBAR_BTN);
            resetZoomBtn.textContent = 'Reset';
            resetZoomBtn.addEventListener('click', Zoom.resetZoom);
            zoomControls.appendChild(resetZoomBtn);

            const fullscreenButton = document.createElement('button');
            fullscreenButton.textContent = BUTTONS.FULLSCREEN;
            fullscreenButton.classList.add(CSS.GALLERY.FULLSCREEN, CSS.GALLERY.TOOLBAR_BTN);
            fullscreenButton.addEventListener('click', Gallery.toggleFullscreen);
            fullscreenButton.setAttribute('aria-label', 'Toggle Fullscreen');
            toolbar.appendChild(fullscreenButton);
        },

        _createExpandedViewMainImageArea: function(expandedViewElement) {
            const zoomContainer = document.createElement('div');
            zoomContainer.classList.add(CSS.GALLERY.ZOOM_CONTAINER);
            expandedViewElement.appendChild(zoomContainer);

            const mainImageContainer = document.createElement('div');
            mainImageContainer.classList.add(CSS.GALLERY.MAIN_IMG_CONTAINER, 'image-container');
            zoomContainer.appendChild(mainImageContainer);

            const panIndicator = document.createElement('div');
            panIndicator.className = 'pan-indicator';
            Object.assign(panIndicator.style, {
                position: 'absolute', top: '15px', left: '15px', zIndex: '10',
                opacity: '0', transition: 'opacity 0.3s ease'
            });
            panIndicator.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white" opacity="0.7">
                    <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
                </svg>`;
            mainImageContainer.appendChild(panIndicator);

            const mainImage = document.createElement('img');
            mainImage.classList.add(CSS.GALLERY.MAIN_IMG, 'gallery-image');
            mainImageContainer.appendChild(mainImage);
            return { mainImageContainer, mainImage };
        },

        _createExpandedViewNavigationAndCounter: function(expandedViewElement) {
            const navContainer = document.createElement('div');
            navContainer.classList.add(CSS.GALLERY.NAV_CONTAINER);
            navContainer.addEventListener('mousedown', e => e.stopPropagation());
            expandedViewElement.appendChild(navContainer);

            if (!state.hideNavArrows) {
                const prevButton = UI.createNavigationButton('prev');
                navContainer.appendChild(prevButton);
                const nextButton = UI.createNavigationButton('next');
                navContainer.appendChild(nextButton);
            }

            const counter = document.createElement('div');
            counter.classList.add(CSS.GALLERY.COUNTER, CSS.GALLERY.HIDE);
            expandedViewElement.appendChild(counter);
        },

        _createExpandedViewThumbnailStrip: function(expandedViewElement) {
            const thumbnailStripContainer = document.createElement('div');
            thumbnailStripContainer.classList.add(CSS.GALLERY.STRIP_CONTAINER);
            thumbnailStripContainer.style.display = state.bottomStripeVisible ? 'flex' : 'none';
            thumbnailStripContainer.addEventListener('mousedown', e => e.stopPropagation());
            expandedViewElement.appendChild(thumbnailStripContainer);

            const thumbnailStrip = document.createElement('div');
            thumbnailStrip.classList.add(CSS.GALLERY.THUMBNAIL_STRIP);
            thumbnailStripContainer.appendChild(thumbnailStrip);
            return thumbnailStrip;
        },

        _populateAllThumbnails: function(gridThumbnailsContainer, stripThumbnailsContainer) {
            state.fullSizeImageSrcs.forEach((src, index) => {
                if (src) {
                    const gridThumbContainer = document.createElement('div');
                    gridThumbContainer.classList.add(CSS.GALLERY.THUMBNAIL_CONTAINER);
                    const gridThumbnail = document.createElement('img');
                    gridThumbnail.src = src; // Initially use the fullSizeImageSrc, could be blob from ImageLoader
                    gridThumbnail.classList.add(CSS.GALLERY.THUMBNAIL);
                    gridThumbnail.dataset.index = index;
                    gridThumbnail.addEventListener('click', () => Gallery.showExpandedView(index));
                    gridThumbnail.setAttribute('aria-label', `Open image ${index + 1}`);
                    gridThumbContainer.appendChild(gridThumbnail);
                    gridThumbnailsContainer.appendChild(gridThumbContainer);

                    const stripThumbnail = document.createElement('img');
                    stripThumbnail.src = src; // Initially use the fullSizeImageSrc
                    stripThumbnail.classList.add(CSS.GALLERY.THUMBNAIL_ITEM);
                    stripThumbnail.dataset.index = index;
                    stripThumbnail.setAttribute('aria-label', `Thumbnail ${index + 1}`);
                    stripThumbnail.addEventListener('click', () => Gallery.showExpandedView(index));
                    stripThumbnailsContainer.appendChild(stripThumbnail);
                }
            });
        },

        _setupGalleryInteractions: function(expandedViewElement, mainImageContainerElement) {
            mainImageContainerElement.addEventListener('wheel', Zoom.handleWheelZoom, { passive: false });

            expandedViewElement.addEventListener('mousedown', e => {
                if (e.target.closest(`.${CSS.GALLERY.TOOLBAR}`) ||
                    e.target.closest(`.${CSS.GALLERY.NAV_CONTAINER}`) ||
                    e.target.closest(`.${CSS.GALLERY.STRIP_CONTAINER}`) ||
                    e.button === 2) {
                    return;
                }
                Zoom.startDrag(e);
            });

            mainImageContainerElement.addEventListener('dblclick', e => {
                if (e.button !== 0) return;
                if (state.zoomScale > 1) {
                    Zoom.resetZoom();
                } else {
                    const rect = mainImageContainerElement.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;
                    state.zoomOrigin = { x: clickX, y: clickY };
                    const newScale = 2.5;
                    const imageX = (clickX - state.imageOffset.x) / state.zoomScale;
                    const imageY = (clickY - state.imageOffset.y) / state.zoomScale;
                    const newOffsetX = clickX - (imageX * newScale);
                    const newOffsetY = clickY - (imageY * newScale);
                    const mainImage = mainImageContainerElement.querySelector(`.${CSS.GALLERY.MAIN_IMG}`);
                    if (!mainImage) return;
                    const boundedOffset = Zoom.enforceBoundaries(newOffsetX, newOffsetY, newScale, rect, mainImage);

                    mainImageContainerElement.style.transition = 'transform 0.3s ease-out';
                    state.imageOffset.x = boundedOffset.x;
                    state.imageOffset.y = boundedOffset.y;
                    state.zoomScale = newScale;
                    setTimeout(() => mainImageContainerElement.style.transition = '', 300);
                }
            });

            let controlsTimeout;
            expandedViewElement.addEventListener('mousemove', () => {
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

            document.addEventListener('mousemove', Zoom.dragImage);
            document.addEventListener('mouseup', Zoom.endDrag);
        },

        // --- Public Gallery Methods ---
        createGallery: function() {
            if (galleryOverlay) return;

            const galleryContentContainer = Gallery._createGalleryOverlayAndContainer();
            const { gridView, expandedView } = Gallery._createBaseViews(galleryContentContainer);
            const gridThumbnailsContainer = Gallery._createGridViewContent(gridView);

            Gallery._createExpandedViewToolbar(expandedView);
            const { mainImageContainer } = Gallery._createExpandedViewMainImageArea(expandedView);
            Gallery._createExpandedViewNavigationAndCounter(expandedView);
            const stripThumbnailsContainer = Gallery._createExpandedViewThumbnailStrip(expandedView);

            document.body.appendChild(galleryOverlay);

            Gallery._populateAllThumbnails(gridThumbnailsContainer, stripThumbnailsContainer);
            Gallery._setupGalleryInteractions(expandedView, mainImageContainer);

            Gallery.showGridView();
        },

        showGridView: function() {
            if (!galleryOverlay) return;
            const gridView = galleryOverlay.querySelector(`.${CSS.GALLERY.GRID_VIEW}`);
            const expandedView = galleryOverlay.querySelector(`.${CSS.GALLERY.EXPANDED_VIEW}`);
            if (gridView) gridView.classList.remove(CSS.GALLERY.HIDE);
            if (expandedView) expandedView.classList.add(CSS.GALLERY.HIDE);
            Zoom.resetZoom();
            state.isZoomed = false;
            state.controlsVisible = true;
        },

        showExpandedView: function(index) {
            if (!galleryOverlay) return;

            const mainImage = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG}`);
            const mainImageContainer = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            const counter = galleryOverlay.querySelector(`.${CSS.GALLERY.COUNTER}`);
            const prevButton = galleryOverlay.querySelector(`.${CSS.GALLERY.PREV}`);
            const nextButton = galleryOverlay.querySelector(`.${CSS.GALLERY.NEXT}`);
            const thumbnailStrip = galleryOverlay.querySelector(`.${CSS.GALLERY.THUMBNAIL_STRIP}`);

            if (!mainImage || !mainImageContainer || !counter) {
                console.error("Gallery.showExpandedView: Essential elements not found.");
                return;
            }
            if (index < 0 || index >= state.fullSizeImageSrcs.length) {
                console.error("Gallery.showExpandedView: Invalid image index:", index);
                return;
            }

            let imageUrlToLoad = state.fullSizeImageSrcs[index];
            let usingPreloaded = false;

            if (Gallery._preloadedImageCache[index] && Gallery._preloadedImageCache[index] !== 'failed_preload') {
                imageUrlToLoad = Gallery._preloadedImageCache[index];
                usingPreloaded = true;
            }

            if (!imageUrlToLoad) {
                console.error("Gallery.showExpandedView: No image URL for index:", index);
                mainImage.src = '';
                mainImage.alt = "Image not available";
                Gallery._preloadAdjacentImages(index);
                return;
            }

            mainImage.classList.add('loading');
            Zoom.resetZoom();
            Object.assign(mainImageContainer.style, {
                width: '100%', height: '100%', display: 'flex',
                justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
            });
            Object.assign(mainImage.style, {
                maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                position: 'relative'
            });

            mainImage.onload = () => {
                mainImage.classList.remove('loading');
                Zoom.initializeImage(mainImage, mainImageContainer);
                Gallery._preloadAdjacentImages(index);
            };
            mainImage.onerror = () => {
                console.error("Error loading image in expanded view:", usingPreloaded ? "(preloaded)" : state.fullSizeImageSrcs[index]);
                mainImage.src = '';
                mainImage.alt = "Error loading image";
                mainImage.classList.remove('loading');
                mainImage.classList.add('error');
                if (usingPreloaded && Gallery._preloadedImageCache[index]) {
                    if(Gallery._preloadedImageCache[index].startsWith('blob:')) URL.revokeObjectURL(Gallery._preloadedImageCache[index]);
                    delete Gallery._preloadedImageCache[index];
                }
                Gallery._preloadAdjacentImages(index);
            };

            mainImage.src = imageUrlToLoad;
            mainImage.alt = `Image ${index + 1} of ${state.fullSizeImageSrcs.length}`;
            counter.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
            state.currentGalleryIndex = index;

            galleryOverlay.querySelector(`.${CSS.GALLERY.GRID_VIEW}`).classList.add(CSS.GALLERY.HIDE);
            galleryOverlay.querySelector(`.${CSS.GALLERY.EXPANDED_VIEW}`).classList.remove(CSS.GALLERY.HIDE);
            counter.classList.remove(CSS.GALLERY.HIDE);

            const currentThumbInStrip = thumbnailStrip?.querySelector(`.${CSS.GALLERY.THUMBNAIL_ITEM}[data-index="${index}"]`);
            if (currentThumbInStrip && thumbnailStrip) {
                const stripWidth = thumbnailStrip.offsetWidth;
                const thumbOffsetLeft = currentThumbInStrip.offsetLeft;
                const thumbWidth = currentThumbInStrip.offsetWidth;
                thumbnailStrip.scrollLeft = thumbOffsetLeft - (stripWidth / 2) + (thumbWidth / 2);
            }

            galleryOverlay.querySelectorAll(`.${CSS.GALLERY.THUMBNAIL_ITEM}`).forEach(thumb => thumb.classList.remove('selected'));
            if (currentThumbInStrip) currentThumbInStrip.classList.add('selected');

            if (!state.hideNavArrows && prevButton && nextButton) {
                prevButton.classList.toggle(CSS.GALLERY.HIDE, index === 0);
                nextButton.classList.toggle(CSS.GALLERY.HIDE, index === state.fullSizeImageSrcs.length - 1);
            }
            state.controlsVisible = true;
        },

        closeGallery: function() {
            if (!galleryOverlay) return;
            Gallery._clearPreloadCache();
            document.body.removeChild(galleryOverlay);
            galleryOverlay = null;
            document.body.classList.remove('ug-fullscreen');
            state.isGalleryMode = false;
            state.isFullscreen = false;
            document.removeEventListener('mousemove', Zoom.dragImage);
            document.removeEventListener('mouseup', Zoom.endDrag);
        },

        toggleGallery: function() {
            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else {
                if (state.galleryReady && state.fullSizeImageSrcs.length > 0) {
                    Gallery.createGallery();
                    state.isGalleryMode = true;
                } else if (!state.galleryReady) {
                    state.notification = "Gallery is still loading images.";
                    state.notificationType = "info";
                } else {
                    state.notification = "No images to display in gallery.";
                    state.notificationType = "info";
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
    // Image Loading Module
    // ====================================================

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
                setTimeout(resolve, 2000); // Fallback timeout
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

        loadImage: async (dataSourceElement, index, preResolvedSrc) => {
            try {
                const mediaSrc = preResolvedSrc;

                if (!mediaSrc) {
                    console.warn(`Skipping media at index ${index} due to missing preResolvedSrc.`);
                    state.loadedImages++;
                    state.mediaLoaded[index] = true;
                    state.virtualGallery[index] = null;
                    state.fullSizeImageSrcs[index] = null;
                    return;
                }

                let pageImgToUpdate = null;
                if (dataSourceElement) {
                    if (dataSourceElement.tagName === 'IMG') { // Main thumbnail case
                        pageImgToUpdate = dataSourceElement;
                    } else if (typeof dataSourceElement.querySelector === 'function') { // <a> link case
                        pageImgToUpdate = dataSourceElement.querySelector('img');
                    }
                }

                state.virtualGallery[index] = mediaSrc;
                state.fullSizeImageSrcs[index] = mediaSrc; // Initial src, may be blob later

                if (pageImgToUpdate) { // Only proceed if we found an <img> on the page to update
                    await ImageLoader.retryWithBackoff(async () => {
                        return new Promise((resolve, reject) => {
                            GM.xmlHttpRequest({
                                method: 'GET',
                                url: mediaSrc,
                                responseType: 'blob',
                                onload: function(response) {
                                    if (response.status === 200 || response.status === 206) {
                                        const blobUrl = URL.createObjectURL(response.response);
                                        pageImgToUpdate.src = blobUrl;
                                        pageImgToUpdate.dataset.originalSrc = mediaSrc;
                                        // NO AUTOMATIC STYLE CHANGES APPLIED HERE
                                        state.fullSizeImageSrcs[index] = blobUrl; // Update gallery array with blob

                                        if (dataSourceElement && dataSourceElement.tagName !== 'IMG' && dataSourceElement.classList) {
                                            dataSourceElement.classList.add(CSS.NO_CLICK);
                                        }
                                        resolve();
                                    } else {
                                        ImageLoader.handleImageFetchError(mediaSrc, response.status, reject);
                                    }
                                },
                                onerror: (error) => {
                                    ImageLoader.handleImageFetchError(mediaSrc, 'Network Error', reject, error);
                                },
                            });
                        });
                    }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, mediaSrc);
                }
                state.loadedImages++;
                state.mediaLoaded[index] = true;

            } catch (error) {
                if (index >= 0 && index < state.virtualGallery.length) {
                    state.virtualGallery[index] = null;
                    state.fullSizeImageSrcs[index] = null;
                }
                console.error(`Ultimately failed to load media: ${preResolvedSrc} at index ${index}`, error);
                state.loadedImages++;
                state.errorCount++;
                state.mediaLoaded[index] = true;
            }
        },

        loadMainThumbnail: async () => {
            try {
                const mainThumbnailPostElement = document.querySelector(SELECTORS.MAIN_THUMBNAIL);
                if (!mainThumbnailPostElement) return { src: null, pageImgElement: null };

                const thumbnailImgTag = mainThumbnailPostElement.querySelector('img');
                if (!thumbnailImgTag || !thumbnailImgTag.src) return { src: null, pageImgElement: null };

                // Initial styling for the main thumbnail is handled in PostActions.initPostActions
                return { src: thumbnailImgTag.src, pageImgElement: thumbnailImgTag };
            } catch (error) {
                console.error('Error processing main thumbnail on page:', error);
                return { src: null, pageImgElement: null };
            }
        },

        loadImages: async () => {
            if (!Utils.isPostPage() || state.galleryReady || state.isLoading) return;

            try {
                state.isLoading = true;
                state.loadingMessage = 'Loading Media...';

                // These arrays are now guaranteed to be empty or freshly initialized
                // if cleanupPostActions ran correctly before this for a new post.
                state.fullSizeImageSrcs = []; // Explicitly reset here too for safety
                state.virtualGallery = [];   // Explicitly reset here too for safety
                state.loadedImages = 0;
                state.mediaLoaded = {};
                state.errorCount = 0;

                const itemsForGalleryProcessing = [];
                const processedFullImageUrls = new Set();

                const mainThumbnailContainer = document.querySelector(SELECTORS.MAIN_THUMBNAIL);
                if (mainThumbnailContainer) {
                    const linkForMainThumbnail = mainThumbnailContainer.matches(SELECTORS.IMAGE_LINK) ?
                                                mainThumbnailContainer :
                                                mainThumbnailContainer.querySelector(SELECTORS.IMAGE_LINK);
                    if (linkForMainThumbnail) {
                        const fullUrl = Utils.handleMediaSrc(linkForMainThumbnail);
                        if (fullUrl && !processedFullImageUrls.has(fullUrl)) {
                            itemsForGalleryProcessing.push({
                                fullSrc: fullUrl,
                                dataSourceElement: linkForMainThumbnail
                            });
                            processedFullImageUrls.add(fullUrl);
                        }
                    }
                }

                document.querySelectorAll(SELECTORS.IMAGE_LINK).forEach(linkElement => {
                    const fullUrl = Utils.handleMediaSrc(linkElement);
                    if (fullUrl && !processedFullImageUrls.has(fullUrl)) {
                        itemsForGalleryProcessing.push({
                            fullSrc: fullUrl,
                            dataSourceElement: linkElement
                        });
                        processedFullImageUrls.add(fullUrl);
                    }
                });

                document.querySelectorAll(SELECTORS.ATTACHMENT_LINK).forEach(linkElement => {
                    const attachmentUrl = Utils.handleMediaSrc(linkElement);
                    const fileName = linkElement.getAttribute('download') || attachmentUrl || "";
                    const isLikelyImage = /\.(jpe?g|png|gif|webp)$/i.test(fileName);

                    if (attachmentUrl && isLikelyImage && !processedFullImageUrls.has(attachmentUrl)) {
                        itemsForGalleryProcessing.push({
                            fullSrc: attachmentUrl,
                            dataSourceElement: linkElement
                        });
                        processedFullImageUrls.add(attachmentUrl);
                    }
                });

                state.totalImages = itemsForGalleryProcessing.length; // Set total based on actual items found
                state.hasImages = state.totalImages > 0;

                // Initialize arrays with correct length after counting
                state.fullSizeImageSrcs = Array(state.totalImages).fill(null);
                state.virtualGallery = Array(state.totalImages).fill(null);

                await ImageLoader.simulateScrollDown();
                Utils.ensureThumbnailsExist();

                const batchSize = CONFIG.BATCH_SIZE;
                for (let i = 0; i < itemsForGalleryProcessing.length; i += batchSize) {
                    const batchPromises = [];
                    for (let j = 0; j < batchSize && (i + j) < itemsForGalleryProcessing.length; j++) {
                        const galleryIndex = i + j;
                        const item = itemsForGalleryProcessing[galleryIndex];
                        batchPromises.push(
                            ImageLoader.loadImage(item.dataSourceElement, galleryIndex, item.fullSrc)
                        );
                    }
                    await Promise.all(batchPromises);
                }

                const videoLinks = document.querySelectorAll(SELECTORS.VIDEO_LINK);
                if (videoLinks.length > 0) {
                    let newVideosAddedToGallery = 0;
                    videoLinks.forEach(videoLink => {
                        const video = videoLink.querySelector('video');
                        if (video && video.hasAttribute('poster')) {
                            const posterSrc = video.getAttribute('poster');
                            if (posterSrc && !processedFullImageUrls.has(posterSrc)) {
                                const videoGalleryIndex = state.totalImages + newVideosAddedToGallery;
                                
                                if(videoGalleryIndex >= state.fullSizeImageSrcs.length) {
                                    state.fullSizeImageSrcs.length = videoGalleryIndex + 1;
                                    state.virtualGallery.length = videoGalleryIndex + 1;
                                }
                                
                                state.fullSizeImageSrcs[videoGalleryIndex] = posterSrc;
                                state.virtualGallery[videoGalleryIndex] = posterSrc;
                                state.mediaLoaded[videoGalleryIndex] = true;
                                state.loadedImages++;
                                processedFullImageUrls.add(posterSrc);
                                newVideosAddedToGallery++;
                            }
                        }
                    });
                    if (newVideosAddedToGallery > 0) {
                        state.totalImages += newVideosAddedToGallery; // Update total if videos are added
                    }
                }

                if (state.loadedImages === state.totalImages && state.totalImages > 0 && state.errorCount === 0) {
                    // Notification handled by state callbacks
                } else if (state.errorCount > 0) {
                    state.notification = `Gallery: ${state.errorCount} error(s). (${state.loadedImages}/${state.totalImages} items).`;
                    state.notificationType = 'warning';
                } else if (state.loadedImages < state.totalImages && state.totalImages > 0) {
                    state.notification = `Gallery: Partially loaded (${state.loadedImages}/${state.totalImages} items).`;
                    state.notificationType = 'warning';
                } else if (state.totalImages === 0) {
                    state.notification = 'No images found for gallery.';
                    state.notificationType = 'info';
                }

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
                await DownloadManager.retryWithBackoff(async () => {
                    return new Promise((resolve, reject) => {
                        GM.xmlHttpRequest({
                            method: "GET",
                            url: url,
                            headers: { referer: `https://${window.location.hostname.split('.')[0]}.su/` },
                            responseType: 'blob',
                            onload: function(response) {
                                if (response.status === 200 || response.status === 206) {
                                    let baseName = Utils.sanitizeFileName(originalName.replace(/\.[^/.]+$/, ""));
                                    let ext = Utils.getExtension(originalName);

                                    if (!ext || ['tmp', 'file', ''].includes(ext)) {
                                        const contentType = response.responseHeaders.match(/content-type:\s*([^;]*)/i)?.[1];
                                        if (contentType && contentType.startsWith('image/')) {
                                            const imageExt = contentType.split('/')[1].replace('jpeg', 'jpg');
                                            if (imageExt && !['octet-stream', 'x-icon'].includes(imageExt)) {
                                                ext = imageExt;
                                            }
                                        }
                                    }
                                    ext = ext || 'bin';

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

                                    zip.file(pathInZip, response.response);
                                    state.downloadedCount++;
                                    resolve();
                                } else {
                                    console.error('Error downloading file for zip:', response.status, originalName);
                                    reject(new Error(`Failed to fetch ${originalName}: ${response.status}`));
                                }
                            },
                            onerror: function(error) {
                                console.error('Network error downloading file for zip:', error, originalName);
                                reject(error);
                            }
                        });
                    });
                }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, url);
            } catch (error) {
                console.error(`Failed to process ${originalName} for zip after retries:`, error);
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
                    // If not a post page, or same URL and already initialized, do nothing or minimal refresh
                    if (state.currentPostUrl === window.location.href && elements.postActions) {
                        // Potentially just re-check if global buttons are there if some other script removed them
                    } else {
                        return;
                    }
                } else {
                    // URL has changed to a new post page, or first time initialization on a post page
                    PostActions.cleanupPostActions(); // Clean up UI from previous post
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
                    if (!elements.postActions.querySelector('a.ug-button[data-action="gallery"]')) { // Use a data-attribute to check
                        const heightButton = UI.createToggleButton(BUTTONS.HEIGHT, () => PostActions.resizeAllImages('height'));
                        const widthButton  = UI.createToggleButton(BUTTONS.WIDTH,  () => PostActions.resizeAllImages('width'));
                        const fullButton   = UI.createToggleButton(BUTTONS.FULL,   () => PostActions.resizeAllImages('full'));
                        const downloadAllButton = UI.createToggleButton(BUTTONS.DOWNLOAD_ALL, DownloadManager.downloadAllImages);
                        const galleryButton = UI.createToggleButton('Loading Gallery...', Gallery.toggleGallery, true);
                        galleryButton.dataset.action = "gallery"; // For checking existence
                        elements.galleryButton = galleryButton;
                        elements.postActions.append(heightButton, widthButton, fullButton, downloadAllButton, galleryButton);
                    }
                    if (elements.galleryButton) elements.galleryButton.style.display = 'inline-block'; // Ensure visible
                }


                if (!elements.settingsButton) {
                    const settingsButton = document.createElement('button');
                    settingsButton.textContent = BUTTONS.SETTINGS;
                    settingsButton.className = `${CSS.SETTINGS_BTN} ${CSS.BTN}`; // Add common button class for styling if needed
                    settingsButton.addEventListener('click', () => { state.settingsOpen = !state.settingsOpen; });
                    document.body.appendChild(settingsButton); // Consider appending to a more specific script container
                    elements.settingsButton = settingsButton;
                }

                // Setup per-image buttons
                const filesArea = document.querySelector('div.post__files'); // The container for all file thumbnails
                if (filesArea) {
                    // Get all actual <img> elements that are part of an image link
                    // This assumes SELECTORS.IMAGE_LINK targets the <a> tag, and it has an <img> child.
                    const imageElementsOnPage = Array.from(filesArea.querySelectorAll(SELECTORS.IMAGE_LINK + ' > img.post__image'));
                    state.displayedImages = imageElementsOnPage; // Update our reference

                    imageElementsOnPage.forEach((imgElement, loopIndex) => {
                        if (!imgElement) return;

                        // CRITICAL: Apply initial default style to the image on the page
                        ImageLoader.imageActions.height(imgElement);

                        const thumbnailDiv = imgElement.closest(SELECTORS.THUMBNAIL); // e.g., .post__thumbnail
                        if (!thumbnailDiv) {
                            console.warn('PostActions: Could not find thumbnailDiv for imgElement:', imgElement);
                            return;
                        }

                        // Remove any existing button container for this thumbnail to ensure a fresh one
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
                                const downloadIndex = state.fullSizeImageSrcs.findIndex(src => src === originalSrcForDownload);
                                if (downloadIndex > -1) {
                                    DownloadManager.downloadImageByIndex(downloadIndex);
                                } else {
                                    console.error("Download (per-image): Could not find image index for src:", originalSrcForDownload, "Available:", state.fullSizeImageSrcs);
                                }
                            }, name: 'DOWNLOAD'},
                            // { text: BUTTONS.REMOVE, action: (evt) => { /* your remove logic */ }, name: 'REMOVE'} // Add remove if needed
                        ];

                        const buttonGroupElement = UI.createButtonGroup(buttonGroupConfig);

                        if (buttonGroupElement.childElementCount > 0 && thumbnailDiv.parentNode) {
                            thumbnailDiv.parentNode.insertBefore(buttonGroupElement, thumbnailDiv);
                        }

                        // Add click handler to image for gallery (if not already handled by delegation)
                        // imgElement.addEventListener('click', e => { /* gallery toggle */ }); // Consider if delegation is sufficient
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
                filesArea.removeAttribute('data-ug-clickHandlerAttached');
                filesArea.querySelectorAll(`.${CSS.BTN_CONTAINER}`).forEach(bc => bc.remove());
            }

            if (elements.statusContainer && elements.statusContainer.parentNode) {
                elements.statusContainer.remove();
                elements.statusContainer = null;
                elements.statusElement = null;
            }
            elements.postActions = null;

            if (Array.isArray(state.fullSizeImageSrcs)) {
                state.fullSizeImageSrcs.forEach(src => {
                    if (typeof src === 'string' && src.startsWith('blob:')) {
                        try { URL.revokeObjectURL(src); } catch (e) { /* Silent error */ }
                    }
                });
            }
            state.fullSizeImageSrcs = [];
            state.virtualGallery = [];

            state.currentPostUrl = null;
            state.galleryReady = false;
            state.loadedImages = 0;
            state.totalImages = 0;
            state.mediaLoaded = {};
            state.errorCount = 0;
            state.postActionsInitialized = false;
        },

        clickAllImageButtons: actionKey => { // e.g., 'HEIGHT', 'WIDTH', 'FULL'
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

            const clickedImage = event.target.closest(SELECTORS.IMAGE_LINK + ' > img.post__image');
            if (clickedImage) {
                if (event.target.tagName === 'A' && event.target.matches(SELECTORS.IMAGE_LINK)) {

                }
                Gallery.toggleGallery();
            }
        },
    };

    // ====================================================
    // Event Handlers
    // ====================================================

    const EventHandlers = {
        handleGalleryKey: event => {
            if (!Utils.isPostPage()) return;

            if (event.key === state.galleryKey && state.galleryReady) {
                Gallery.toggleGallery();
                return;
            }

            // Handle keys only if the gallery is currently active
            if (state.isGalleryMode && galleryOverlay) {
                const gridView = galleryOverlay.querySelector(`.${CSS.GALLERY.GRID_VIEW}`);
                const expandedView = galleryOverlay.querySelector(`.${CSS.GALLERY.EXPANDED_VIEW}`);

                if (!gridView || !expandedView) return; 

                // --- Escape Key Logic ---
                if (event.key === 'Escape') {
                    event.preventDefault(); 
                    if (!expandedView.classList.contains(CSS.GALLERY.HIDE)) {
                        Gallery.showGridView();
                    } else if (!gridView.classList.contains(CSS.GALLERY.HIDE)) {
                        Gallery.closeGallery();
                    }
                    return;
                }

                // --- Other Key Logic (Navigation, Zoom) - Only in Expanded View ---
                if (gridView.classList.contains(CSS.GALLERY.HIDE)) {
                    const relevantKeys = [
                        state.prevImageKey, state.nextImageKey,
                        'ArrowLeft', 'ArrowRight', 'k', 'l',
                        '+', '-', '0'
                    ];

                    if (relevantKeys.includes(event.key)) {
                        event.preventDefault();
                        switch (event.key) {
                            case state.prevImageKey:
                            case 'k':                
                            case 'ArrowLeft':
                                Gallery.prevImage();
                                break;
                            case state.nextImageKey: 
                            case 'l':                
                            case 'ArrowRight':
                                Gallery.nextImage();
                                break;
                            case '+':
                                Zoom.zoom(CONFIG.ZOOM_STEP);
                                break;
                            case '-':
                                Zoom.zoom(-CONFIG.ZOOM_STEP);
                                break;
                            case '0':
                                Zoom.resetZoom();
                                break;
                        }
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
            if (!galleryOverlay) return;
            const container = galleryOverlay.querySelector(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!container) return;

            const newWidth = container.offsetWidth;
            const newHeight = container.offsetHeight;

            if (newWidth !== state.lastWidth || newHeight !== state.lastHeight) {
                state.lastWidth = newWidth;
                state.lastHeight = newHeight;
                Zoom.resetZoom();
                Zoom.applyZoom();
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

    const init = () => {
        try {
            // Load CSS
            GM.xmlHttpRequest({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/TestingBranch/Ultra-Galleries.css',
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