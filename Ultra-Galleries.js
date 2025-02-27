// ==UserScript==
// @name         Ultra Galleries Enhanced
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      3.0.0
// @description  Modern image gallery with enhanced browsing, fullscreen, and download features, now with thumbnail grid UI, zoom, and improved performance.
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
    // MODULE: Constants & Configuration
    // ====================================================
    
    const CONFIG = {
        BATCH_SIZE: 5,
        MAX_RETRIES: 3,
        RETRY_DELAY: 1500,
        THROTTLE_INTERVAL: 16,
        MIN_SCALE: 0.05,
        MAX_SCALE: 5,
        ZOOM_SENSITIVITY: 0.08,
        ZOOM_STEP: 0.2,
        DEBOUNCE_DELAY: 250,
        INERTIA_FACTOR: 0.92,
        SMOOTH_ZOOM_DURATION: 20, // milliseconds
        PAN_RESISTANCE_FACTOR: 0.8, // Controls the resistance when panning at edges
        DOUBLE_TAP_THRESHOLD: 300, // milliseconds
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

    const CSS_CLASSES = {
        UG_BUTTON: 'ug-button',
        UG_BUTTON_CONTAINER: 'ug-button-container',
        LOADING_OVERLAY: 'loading-overlay',
        GALLERY_CONTAINER: 'gallery-container',
        GALLERY_CLOSE_BUTTON: 'gallery-close-button',
        GALLERY_CONTENT: 'gallery-content',
        GALLERY_MAIN_VIEW: 'ug-gallery-main-view',
        EXPANDED_VIEW: 'expanded-view',
        EXPANDED_IMAGE: 'expanded-image',
        PAGE_NUMBER: 'page-number',
        THUMBNAIL_CONTAINER: 'thumbnail-container',
        THUMBNAIL_GRID: 'thumbnail-grid',
        NAVIGATION_BUTTON: 'navigation-button',
        VIRTUAL_IMAGE: 'virtual-image',
        THUMBNAIL: 'thumbnail',
        THUMBNAIL_STRIP: 'thumbnail-strip',
        EXPANDED_THUMBNAIL: 'expanded-thumbnail',
        SETTINGS_BUTTON: 'settings-button',
        NOTIFICATION_CONTAINER: 'ug-notification-container',
        NOTIFICATION_AREA: 'ug-notification-area',
        NOTIFICATION_TEXT: 'ug-notification-text',
        NOTIFICATION_CLOSE: 'ug-notification-close',
        NOTIFICATION_REPORT: 'ug-notification-report',
        DOWNLOAD_BUTTON: 'ug-download-button',
        FULLSCREEN_BUTTON: 'ug-fullscreen-button',
        NO_CLICK: 'ug-no-click',
        FADE_OUT: 'fade-out',
        FADE_IN: 'fade-in',
        THUMBNAIL_CROPPED: 'thumbnail-cropped',
        THUMBNAIL_VISIBLE: 'thumbnail-visible',
        GALLERY_CONTROLS_CONTAINER: 'ug-gallery-controls-container',
        CONTROLS_VISIBLE: 'ug-controls-visible',
        CONTROLS_HIDDEN: 'ug-controls-hidden',
        FULLSCREEN_GALLERY: 'fullscreen-gallery',
        EXPANDED_VIEW_CONTAINER: 'ug-expanded-view-container',
        UG_GALLERY_THUMBNAIL: 'ug-gallery-thumbnail',
        UG_GALLERY_THUMBNAIL_GRID_CONTAINER: 'ug-gallery-thumbnail-grid-container',
        UG_GALLERY_THUMBNAIL_GRID: 'ug-gallery-thumbnail-grid',
        UG_GALLERY_EXPANDED_MEDIA: 'ug-gallery-expanded-media',
        UG_MAIN_IMAGE_CONTAINER: 'ug-main-image-container',
        UG_MAIN_IMAGE: 'ug-main-image',
        UG_GALLERY_NAV: 'ug-gallery-nav',
        UG_GALLERY_PREV: 'ug-gallery-prev',
        UG_GALLERY_NEXT: 'ug-gallery-next',
        UG_THUMBNAIL_STRIP: 'ug-thumbnail-strip',
        UG_THUMBNAIL: 'ug-thumbnail',
        UG_GALLERY_CLOSE: 'ug-gallery-close',
        UG_GALLERY_FULLSCREEN: 'ug-gallery-fullscreen',
        UG_FULLSCREEN_OVERLAY: 'ug-fullscreen-overlay',
        UG_GALLERY_GRID_VIEW: 'ug-gallery-grid-view',
        UG_GALLERY_EXPANDED_VIEW: 'ug-gallery-expanded-view',
        UG_GALLERY_HIDE: 'ug-gallery-hide',
        UG_GALLERY_COUNTER: 'ug-gallery-counter',
        UG_GALLERY_GRID_CLOSE: 'ug-gallery-grid-close',
        UG_GALLERY_THUMBNAIL_STRIP_CONTAINER: 'ug-gallery-thumbnail-strip-container',
        UG_GALLERY_ZOOM_CONTAINER: 'ug-gallery-zoom-container',
        UG_GALLERY_ZOOM_IMAGE: 'ug-gallery-zoom-image',
        UG_GALLERY_TOOLBAR: 'ug-gallery-toolbar',
        UG_TOOLBAR_BUTTON: 'ug-toolbar-button',
        UG_CONTROLS_HIDDEN_CLASS: 'ug-controls-hidden',
        UG_GRABBING_CURSOR: 'ug-grabbing',
        UG_SETTINGS_OVERLAY: 'ug-settings-overlay',
        UG_SETTINGS_CONTAINER: 'ug-settings-container',
        UG_SETTINGS_HEADER: 'ug-settings-header',
        UG_SETTINGS_BODY: 'ug-settings-body',
        UG_SETTINGS_CLOSE_BTN: 'ug-settings-close-btn',
        UG_SETTINGS_SECTION: 'ug-settings-section',
        UG_SETTINGS_SECTION_HEADER: 'ug-settings-section-header',
        UG_SETTINGS_LABEL: 'ug-settings-label',
        UG_SETTINGS_INPUT: 'ug-settings-input',
        UG_SETTINGS_CHECKBOX_LABEL: 'ug-settings-checkbox-label',
        UG_GALLERY_NAV_CONTAINER: 'ug-gallery-nav-container',
        UG_ZOOMED: 'zoomed',
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
        POST_ACTIONS: website === 'nekohouse' ? '.scrape__actions' : '.post__actions',
        FAVORITE_BUTTON: website === 'nekohouse' ? '.scrape__actions a.favorite-button' : '.post__actions a.favorite-button',
        FILE_DIVS: website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail',
        FILES_IMG: website === 'nekohouse' ? '.scrape__files img' : 'img.post__image',
    };

    // ====================================================
    // MODULE: Utility Functions
    // ====================================================
    
    const Utils = {
        /**
         * Extract file extension from filename
         * @param {string} filename - The filename
         * @return {string} The extracted extension or 'jpg' as default
         */
        getExtension: (filename) => filename.split('.').pop().toLowerCase() || 'jpg',
        
        /**
         * Sanitize a filename to remove invalid characters
         * @param {string} name - The filename to sanitize
         * @return {string} Sanitized filename
         */
        sanitizeFileName: (name) => name.replace(/[/\\:*?"<>|]/g, '-'),
        
        /**
         * Apply CSS styles to an image element
         * @param {HTMLElement} img - The image element
         * @param {Object} styles - Object containing styles to apply
         */
        setImageStyle: (img, styles) => {
            if (img) {
                Object.assign(img.style, styles);
            }
        },
        
        /**
         * Check if current page is a post page
         * @return {boolean} True if on a post page
         */
        isPostPage: () => {
            const url = window.location.href;
            const validPatterns = [
                /https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/post\//,
                /https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/user\/.*\/post\//,
            ];
            return validPatterns.some((pattern) => pattern.test(url));
        },
        
        /**
         * Create a debounced version of a function
         * @param {Function} func - The function to debounce
         * @param {number} wait - Wait time in milliseconds
         * @return {Function} Debounced function
         */
        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        /**
         * Create a throttled version of a function
         * @param {Function} func - The function to throttle
         * @param {number} limit - Limit in milliseconds
         * @return {Function} Throttled function
         */
        throttle: (func, limit) => {
            let lastFunc;
            let lastRan;
            return function executedFunction(...args) {
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
        
        /**
         * Extract source from a media link
         * @param {HTMLElement} mediaLink - The media link element
         * @return {string|null} The media source URL or null
         */
        handleMediaSrc: (mediaLink) => {
            const fileThumbDiv = mediaLink.querySelector('.fileThumb');
            return fileThumbDiv?.getAttribute('href')?.split('?')[0] || 
                   mediaLink.getAttribute('href')?.split('?')[0] || null;
        },
        
        /**
         * Create a promise that resolves after a set time
         * @param {number} ms - Milliseconds to wait
         * @return {Promise} Promise that resolves after timeout
         */
        delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        /**
         * Get content type from a URL via HEAD request
         * @param {string} url - The URL to check
         * @return {Promise<string>} Promise resolving to content type
         */
        getContentType: async (url) => {
            return new Promise((resolve, reject) => {
                GM.xmlHttpRequest({
                    method: 'HEAD',
                    url: url,
                    onload: function(response) {
                        const contentType = response.responseHeaders.match(/content-type:\s*([^;]*)/i)?.[1];
                        resolve(contentType || '');
                    },
                    onerror: function(error) {
                        reject(error);
                    }
                });
            });
        },
        
        /**
         * Detect support for passive event listeners
         * @return {boolean} Whether passive listeners are supported
         */
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
        
        /**
         * Create a tooltip element
         * @param {string} text - The tooltip text
         * @param {number} duration - How long to show the tooltip in ms
         * @return {HTMLElement} The tooltip element
         */
        createTooltip: (text, duration = 3000) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'zoom-tooltip';
            tooltip.textContent = text;
            tooltip.style.position = 'absolute';
            tooltip.style.bottom = '120px';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.background = 'rgba(0,0,0,0.7)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '10px 15px';
            tooltip.style.borderRadius = '5px';
            tooltip.style.zIndex = '100';
            tooltip.style.pointerEvents = 'none';
            
            // Remove after duration
            setTimeout(() => {
                tooltip.style.opacity = '0';
                tooltip.style.transition = 'opacity 0.5s ease';
                setTimeout(() => tooltip.remove(), 500);
            }, duration);
            
            return tooltip;
        },
        
        /**
         * Calculate distance between two points (for pinch zoom)
         * @param {Touch} touch1 - First touch point
         * @param {Touch} touch2 - Second touch point
         * @return {number} Distance between points
         */
        getDistance: (touch1, touch2) => {
            return Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        },
        
        /**
         * Get midpoint between two touches
         * @param {Touch} touch1 - First touch point
         * @param {Touch} touch2 - Second touch point
         * @return {Object} Midpoint coordinates {x, y}
         */
        getMidpoint: (touch1, touch2) => {
            return {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
    };

    // ====================================================
    // MODULE: State Management
    // ====================================================
    
    /**
     * Create a reactive state with update callbacks
     * @param {Object} initialState - Initial state object
     * @param {Object} updateCallbacks - Callbacks to run on state changes
     * @return {Proxy} Reactive state proxy
     */
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

    // Global state with reactive updates
    const state = createReactiveState({
        zipFileNameFormat: GM_getValue('zipFileNameFormat', '{title}-{artistName}.zip'),
        imageFileNameFormat: GM_getValue('imageFileNameFormat', '{title}-{artistName}-{fileName}-{index}'),
        galleryKey: GM_getValue('galleryKey', 'g'),
        galleryReady: false,
        galleryActive: false,
        currentGalleryIndex: 0,
        isFullscreen: GM_getValue('isFullscreen', false),
        virtualGallery: [],
        originalImageSrcs: [],
        currentPostUrl: null,
        displayedImages: [],
        totalImages: 0,
        loadedImages: 0,
        downloadedCount: 0,
        isLoading: false,
        loadingMessage: null,
        fullSizeImageSrcs: [],
        hasImages: false,
        postActionsInitialized: false,
        mediaLoaded: {},
        isGalleryMode: false,
        notificationsEnabled: GM_getValue('notificationsEnabled', true),
        notificationAreaVisible: GM_getValue('notificationAreaVisible', true),
        animationsEnabled: GM_getValue('animationsEnabled', true),
        notification: null,
        notificationType: 'info',
        hideNavArrows: GM_getValue('hideNavArrows', false),
        hideRemoveButton: GM_getValue('hideRemoveButton', false),
        hideFullButton: GM_getValue('hideFullButton', false),
        hideDownloadButton: GM_getValue('hideDownloadButton', false),
        settingsOpen: false,
        prevImageKey: GM_getValue('prevImageKey', 'k'),
        nextImageKey: GM_getValue('nextImageKey', 'l'),
        bottomStripeVisible: true,
        dynamicResizing: GM_getValue('dynamicResizing', true),
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
        isDownloading: false,
        errorCount: 0,
        pendingRetries: {},  // Track which images need retry
        lastTapTime: 0, // For double-tap detection
        pinchZoomActive: false,
        initialTouchDistance: 0,
        initialScale: 1,
        zoomIndicatorVisible: true, // Whether to show zoom indicator
        inertiaEnabled: true, // Pan inertia
        velocity: { x: 0, y: 0 }, // For inertia calculations
        inertiaActive: false,
    }, {
        // State update callbacks
        controlsVisible: (value) => {
            const toolbar = galleryOverlay?.querySelector(`.${CSS_CLASSES.UG_GALLERY_TOOLBAR}`);
            if (toolbar) toolbar.classList.toggle(CSS_CLASSES.UG_CONTROLS_HIDDEN_CLASS, !value);
        },
        galleryReady: (value) => {
            updateGalleryButton(value);
        },
        loadedImages: (value, oldValue) => {
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
            if (oldValue === 0 && value > 0) {
                state.notification = `Loading media (${state.loadedImages}/${value})...`;
            } else if (value > 0) {
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
                    galleryOverlay.classList.add(CSS_CLASSES.UG_FULLSCREEN_OVERLAY);
                } else {
                    document.body.classList.remove('ug-fullscreen');
                    galleryOverlay.classList.remove(CSS_CLASSES.UG_FULLSCREEN_OVERLAY);
                }
            }
        },
        zoomEnabled: (value) => {
            GM_setValue('zoomEnabled', value);
        },
        bottomStripeVisible: (value) => { 
            GM_setValue('bottomStripeVisible', value);
            if (galleryOverlay) {
                const thumbnailStripContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_THUMBNAIL_STRIP_CONTAINER}`);
                if (thumbnailStripContainer) {
                    thumbnailStripContainer.style.display = value ? 'flex' : 'none';
                }
            }
        },
        zoomScale: (value, oldValue) => {
            Zoom.applyZoom(); // Re-apply the transform whenever zoomScale changes
            
            // Add/remove zoomed class based on zoom level
            const mainImageContainer = galleryOverlay?.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
            if (mainImageContainer) {
                mainImageContainer.classList.toggle(CSS_CLASSES.UG_ZOOMED, value > 1);
                
                // Change cursor style based on zoom level
                mainImageContainer.style.cursor = value > 1 ? 'grab' : 'default';
            }
            
            // Show a brief instruction tooltip the first time a user zooms in
            if (value > 1 && oldValue === 1 && state.zoomIndicatorVisible) {
                const tooltip = Utils.createTooltip('Click and drag to pan image');
                galleryOverlay.appendChild(tooltip);
                
                // Only show once per session
                state.zoomIndicatorVisible = false;
            }
        },
        imageOffset: (value, oldValue) => {
            Zoom.applyZoom(); // Re-apply the transform whenever imageOffset changes
        },
        isDragging: (value, oldValue) => {
            const mainImageContainer = galleryOverlay?.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
            if (mainImageContainer) {
                mainImageContainer.classList.toggle(CSS_CLASSES.UG_GRABBING_CURSOR, value);
                
                // If drag is starting, cancel any active inertia
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
    });

    // ====================================================
    // MODULE: Zoom & Pan Functionality
    // ====================================================
    
    const Zoom = {
        /**
         * Apply zoom and pan transformation to image container
         */
		applyZoom: () => {
			const mainImageContainer = galleryOverlay?.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
			if (!mainImageContainer) return;
	
			// Apply the transform
			mainImageContainer.style.transform = `translate(${state.imageOffset.x}px, ${state.imageOffset.y}px) scale(${state.zoomScale})`;
			
			// Update zoom level display
			const zoomLevelDisplay = galleryOverlay?.querySelector('#zoom-level');
			if (zoomLevelDisplay) {
				zoomLevelDisplay.textContent = `${Math.round(state.zoomScale * 100)}%`;
			}
			
			// Add or remove zoomed class based on zoom level
			if (state.zoomScale !== 1) {
				mainImageContainer.classList.add('zoomed');
			} else {
				mainImageContainer.classList.remove('zoomed');
			}
		},
    
        /**
         * Handle mouse wheel zooming with smoother experience
         * @param {WheelEvent} event - The wheel event
         */
		handleWheelZoom: (event) => {
			if (!state.zoomEnabled || !galleryOverlay) return;
			event.preventDefault();
			event.stopPropagation();
	
			const mainImageContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
			const mainImage = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE}`);
			if (!mainImage || !mainImageContainer) return;
	
			// Get container dimensions
			const containerRect = mainImageContainer.getBoundingClientRect();
	
			// Mouse position relative to container
			const mouseX = event.clientX - containerRect.left;
			const mouseY = event.clientY - containerRect.top;
	
			// Calculate zoom direction with sensitivity adjustment
			const delta = Math.sign(event.deltaY) * -0.1;
			
			// Allow zooming to 5% minimum
			const newZoomScale = Math.max(0.05, Math.min(state.zoomScale + delta, 5.0));
	
			// Calculate image coordinates
			const imageX = (mouseX - state.imageOffset.x) / state.zoomScale;
			const imageY = (mouseY - state.imageOffset.y) / state.zoomScale;
	
			// Calculate new offset to keep zoom centered on mouse
			const newOffsetX = mouseX - (imageX * newZoomScale);
			const newOffsetY = mouseY - (imageY * newZoomScale);
	
			// Update state
			state.imageOffset.x = newOffsetX;
			state.imageOffset.y = newOffsetY;
			state.zoomScale = newZoomScale;
			
			// Apply zoom with smooth transition
			mainImageContainer.style.transition = 'transform 0.1s ease-out';
			setTimeout(() => mainImageContainer.style.transition = '', 100);
			Zoom.applyZoom();
		},
    
        /**
         * Enforce boundaries for image panning with smoother edge behavior
         * @param {number} offsetX - X offset
         * @param {number} offsetY - Y offset
         * @param {number} scale - Current zoom scale
         * @param {DOMRect} containerRect - Container rectangle
         * @param {HTMLImageElement} image - Image element
         * @return {Object} Bounded offset coordinates
         */
        enforceBoundaries: (offsetX, offsetY, scale, containerRect, image) => {
            const imgWidth = image.naturalWidth * scale;
            const imgHeight = image.naturalHeight * scale;
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;
    
            // If image is smaller than container in either dimension, center it
            let minX, maxX, minY, maxY;
            
            if (imgWidth <= containerWidth) {
                // Center horizontally
                minX = maxX = (containerWidth - imgWidth) / 2;
            } else {
                // Calculate boundaries with resistance near edges
                maxX = Math.max(0, (imgWidth - containerWidth) / 2);
                minX = -maxX;
                
                // Apply resistance when near boundaries
                if (offsetX > maxX) {
                    const overshot = offsetX - maxX;
                    offsetX = maxX + (overshot * CONFIG.PAN_RESISTANCE_FACTOR / scale);
                } else if (offsetX < minX) {
                    const overshot = minX - offsetX;
                    offsetX = minX - (overshot * CONFIG.PAN_RESISTANCE_FACTOR / scale);
                }
            }
            
            if (imgHeight <= containerHeight) {
                // Center vertically
                minY = maxY = (containerHeight - imgHeight) / 2;
            } else {
                // Calculate boundaries with resistance near edges
                maxY = Math.max(0, (imgHeight - containerHeight) / 2);
                minY = -maxY;
                
                // Apply resistance when near boundaries
                if (offsetY > maxY) {
                    const overshot = offsetY - maxY;
                    offsetY = maxY + (overshot * CONFIG.PAN_RESISTANCE_FACTOR / scale);
                } else if (offsetY < minY) {
                    const overshot = minY - offsetY;
                    offsetY = minY - (overshot * CONFIG.PAN_RESISTANCE_FACTOR / scale);
                }
            }
    
            return {
                x: offsetX,
                y: offsetY
            };
        },
    
        /**
         * Start drag operation with improved tracking
         * @param {MouseEvent|Touch} event - The mouse/touch event
         */
		startDrag: (event) => {
			if (!galleryOverlay) return;
			
			// Prevent default to avoid text selection
			event.preventDefault();
			
			// Set dragging state
			state.isDragging = true;
			
			// Get coordinates (works for both mouse and touch)
			const clientX = event.clientX || (event.touches && event.touches[0].clientX);
			const clientY = event.clientY || (event.touches && event.touches[0].clientY);
			
			// Store starting point
			state.dragStartPosition = {
				x: clientX,
				y: clientY
			};
			
			// Store current offset at drag start
			state.dragStartOffset = {
				x: state.imageOffset.x,
				y: state.imageOffset.y
			};
			
			// Change cursor for dragging
			const mainImageContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
			if (mainImageContainer) {
				mainImageContainer.classList.add(CSS_CLASSES.UG_GRABBING_CURSOR);
			}
		},	
    
        /**
         * Handle image dragging with improved smoothness and velocity tracking
         * @param {MouseEvent|Touch} event - The mouse/touch event
         */
		dragImage: (event) => {
			if (!state.isDragging || !galleryOverlay) return;
			
			// Get current position
			const clientX = event.clientX || (event.touches && event.touches[0].clientX);
			const clientY = event.clientY || (event.touches && event.touches[0].clientY);
			
			if (!clientX || !clientY) return;
			
			// Calculate how far we've moved
			const deltaX = clientX - state.dragStartPosition.x;
			const deltaY = clientY - state.dragStartPosition.y;
			
			// Calculate new position based on drag start offset
			const newOffsetX = state.dragStartOffset.x + deltaX;
			const newOffsetY = state.dragStartOffset.y + deltaY;
			
			// Update state directly
			state.imageOffset.x = newOffsetX;
			state.imageOffset.y = newOffsetY;
			
			// Apply zoom
			Zoom.applyZoom();
		},
	
    
        /**
         * End drag operation with inertia effect
         */
		endDrag: () => {
			if (!state.isDragging || !galleryOverlay) return;
			
			// Reset dragging state
			state.isDragging = false;
			
			// Reset cursor
			const mainImageContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
			if (mainImageContainer) {
				mainImageContainer.classList.remove(CSS_CLASSES.UG_GRABBING_CURSOR);
			}
		},
    
        /**
         * Reset zoom and pan to initial state
         */
		resetZoom: () => {
			if (!galleryOverlay) return;
			
			const mainImageContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
			if (mainImageContainer) {
				// Add transition for smooth reset
				mainImageContainer.style.transition = 'transform 0.3s ease-out';
				
				// Reset state
				state.zoomScale = 1;
				state.imageOffset = { x: 0, y: 0 };
				
				// Apply zoom
				Zoom.applyZoom();
				
				// Clear transition after animation
				setTimeout(() => {
					mainImageContainer.style.transition = '';
				}, 300);
			}
		},
        
        /**
         * Initialize image for zooming with proper sizing
         * @param {HTMLImageElement} image - The image element
         * @param {HTMLElement} container - The container element
         */
		initializeImage: (image, container) => {
			if (!image || !container) return;
			
			// Reset any previous styles
			image.style.width = '';
			image.style.height = '';
			image.style.maxWidth = '100%';
			image.style.maxHeight = '100%';
			
			const containerWidth = container.offsetWidth;
			const containerHeight = container.offsetHeight;
			const imageWidth = image.naturalWidth;
			const imageHeight = image.naturalHeight;
	
			const aspectRatio = imageWidth / imageHeight;
			
			// Set proper sizing for the image to fit the container
			if (aspectRatio > containerWidth / containerHeight) {
				// Wide image
				image.style.width = '100%';
				image.style.height = 'auto';
			} else {
				// Tall image
				image.style.width = 'auto';
				image.style.height = '100%';
			}
			
			// Reset zoom and position state
			state.zoomScale = 1;
			state.imageOffset = { x: 0, y: 0 };
			
			// Apply transform
			Zoom.applyZoom();
		},
        
        /**
         * Handle zoom stepping (for zoom buttons) with smoother transitions
         * @param {number} step - The step amount (positive or negative)
         */
		zoom: (step) => {
			if (!galleryOverlay) return;
			
			const mainImageContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
			if (!mainImageContainer) return;
			
			// Get container dimensions
			const containerRect = mainImageContainer.getBoundingClientRect();
			
			// Calculate center point
			const centerX = containerRect.width / 2;
			const centerY = containerRect.height / 2;
			
			// Calculate new scale with minimum 5%
			const newZoomScale = Math.max(0.05, Math.min(state.zoomScale + step, 5.0));
			
			if (state.zoomScale !== newZoomScale) {
				// Calculate center position in image coordinates
				const imageX = (centerX - state.imageOffset.x) / state.zoomScale;
				const imageY = (centerY - state.imageOffset.y) / state.zoomScale;
				
				// Calculate new offset to keep zoom centered
				const newOffsetX = centerX - (imageX * newZoomScale);
				const newOffsetY = centerY - (imageY * newZoomScale);
				
				// Update state with smooth transition
				mainImageContainer.style.transition = 'transform 0.2s ease-out';
				
				// Update state
				state.imageOffset.x = newOffsetX;
				state.imageOffset.y = newOffsetY;
				state.zoomScale = newZoomScale;
				
				// Apply zoom
				Zoom.applyZoom();
				
				// Clear transition after animation
				setTimeout(() => {
					mainImageContainer.style.transition = '';
				}, 200);
			}
		},
        
        /**
         * Setup touch events for pinch zoom and panning
         */
        setupTouchEvents: () => {
            const mainImageContainer = galleryOverlay?.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
            if (!mainImageContainer) return;
            
            // Basic touch identification variables
            let initialTouchDistance = 0;
            let initialScale = 1;
            let lastTapTime = 0;
            const touchSupportsPassive = Utils.supportsPassiveEvents();
            
            // Touch start handler
            const touchStartHandler = (e) => {
                if (e.touches.length === 1) {
                    // Check for double tap to zoom
                    const now = Date.now();
                    const timeSinceLastTap = now - state.lastTapTime;
                    
                    if (timeSinceLastTap < CONFIG.DOUBLE_TAP_THRESHOLD && timeSinceLastTap > 0) {
                        // Double tap detected - toggle zoom
                        if (state.zoomScale > 1) {
                            Zoom.resetZoom();
                        } else {
                            // Zoom in to higher level at tap position
                            const touch = e.touches[0];
                            const containerRect = mainImageContainer.getBoundingClientRect();
                            const touchX = touch.clientX - containerRect.left;
                            const touchY = touch.clientY - containerRect.top;
                            
                            // Set zoom origin to tap position
                            state.zoomOrigin = { x: touchX, y: touchY };
                            
                            // Calculate new scale
                            const newScale = 2.5; // Default zoom level for double tap
                            
                            // Calculate image coordinates
                            const imageX = (touchX - state.imageOffset.x) / state.zoomScale;
                            const imageY = (touchY - state.imageOffset.y) / state.zoomScale;
                            
                            // Calculate new offset
                            const newOffsetX = touchX - (imageX * newScale);
                            const newOffsetY = touchY - (imageY * newScale);
                            
                            // Get image element
                            const mainImage = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE}`);
                            
                            // Apply boundaries
                            const boundedOffset = Zoom.enforceBoundaries(
                                newOffsetX, newOffsetY, newScale, containerRect, mainImage
                            );
                            
                            // Update state with smooth transition
                            mainImageContainer.style.transition = 'transform 0.3s ease-out';
                            state.imageOffset.x = boundedOffset.x;
                            state.imageOffset.y = boundedOffset.y;
                            state.zoomScale = newScale;
                            
                            setTimeout(() => mainImageContainer.style.transition = '', 300);
                        }
                        
                        // Reset tap tracking
                        state.lastTapTime = 0;
                        return;
                    }
                    
                    // Single touch - prepare for panning
                    state.lastTapTime = now;
                    const touch = e.touches[0];
                    Zoom.startDrag({
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                    
                } else if (e.touches.length === 2) {
                    // Prevent default behavior to avoid page zooming
                    e.preventDefault();
                    
                    // Two touches - prepare for pinch zoom
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    
                    // Calculate initial distance
                    initialTouchDistance = Utils.getDistance(touch1, touch2);
                    initialScale = state.zoomScale;
                    
                    // Get center point between touches
                    const midpoint = Utils.getMidpoint(touch1, touch2);
                    state.zoomOrigin = midpoint;
                    
                    // Mark pinch zoom as active
                    state.pinchZoomActive = true;
                    
                    // End any active drag
                    if (state.isDragging) {
                        Zoom.endDrag();
                    }
                }
            };
            
            // Touch move handler
            const touchMoveHandler = (e) => {
                // Handle panning
                if (e.touches.length === 1 && state.isDragging) {
                    const touch = e.touches[0];
                    Zoom.dragImage({
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                    
                // Handle pinch zooming
                } else if (e.touches.length === 2 && state.pinchZoomActive) {
                    // Prevent default scrolling/zooming
                    e.preventDefault();
                    
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    
                    // Calculate new distance
                    const currentDistance = Utils.getDistance(touch1, touch2);
                    
                    // Calculate scale factor
                    const scaleFactor = currentDistance / initialTouchDistance;
                    const newScale = Math.max(1, Math.min(initialScale * scaleFactor, CONFIG.MAX_SCALE));
                    
                    // Get center point
                    const midpoint = Utils.getMidpoint(touch1, touch2);
                    
                    // Get container rect and image
                    const containerRect = mainImageContainer.getBoundingClientRect();
                    const mainImage = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE}`);
                    
                    // Don't bother updating if scale hasn't changed meaningfully
                    if (Math.abs(newScale - state.zoomScale) > 0.01) {
                        // Calculate image coordinates
                        const touchX = midpoint.x - containerRect.left;
                        const touchY = midpoint.y - containerRect.top;
                        
                        // Calculate image coordinates
                        const imageX = (touchX - state.imageOffset.x) / state.zoomScale;
                        const imageY = (touchY - state.imageOffset.y) / state.zoomScale;
                        
                        // Calculate new offset
                        const newOffsetX = touchX - (imageX * newScale);
                        const newOffsetY = touchY - (imageY * newScale);
                        
                        // Apply boundaries
                        const boundedOffset = Zoom.enforceBoundaries(
                            newOffsetX, newOffsetY, newScale, containerRect, mainImage
                        );
                        
                        // Update state
                        state.imageOffset.x = boundedOffset.x;
                        state.imageOffset.y = boundedOffset.y;
                        state.zoomScale = newScale;
                    }
                }
            };
            
            // Touch end handler
            const touchEndHandler = (e) => {
                // If no touches remain, or we were pinch zooming
                if (e.touches.length === 0 || state.pinchZoomActive) {
                    if (state.isDragging) {
                        Zoom.endDrag();
                    }
                    
                    state.pinchZoomActive = false;
                    initialTouchDistance = 0;
                }
            };
            
            // Add event listeners
            mainImageContainer.addEventListener('touchstart', touchStartHandler, touchSupportsPassive ? { passive: false } : false);
            mainImageContainer.addEventListener('touchmove', touchMoveHandler, touchSupportsPassive ? { passive: false } : false);
            mainImageContainer.addEventListener('touchend', touchEndHandler);
            mainImageContainer.addEventListener('touchcancel', touchEndHandler);
        }
    };

    // ====================================================
    // MODULE: UI Components
    // ====================================================
    
    const UI = {
        /**
         * Create toggle button
         * @param {string} name - Button text
         * @param {Function} action - Click handler
         * @param {boolean} disabled - Whether button should be disabled
         * @return {HTMLElement} The button element
         */
        createToggleButton: (name, action, disabled = false) => {
            const toggle = document.createElement('a');
            toggle.textContent = name;
            toggle.addEventListener('click', action);
            toggle.style.cursor = 'pointer';
            toggle.classList.add(CSS_CLASSES.UG_BUTTON);
            if (disabled) {
                toggle.disabled = true;
                toggle.classList.add('disabled');
            }
            return toggle;
        },
        
        /**
         * Create loading overlay
         * @param {string} text - Loading text to display
         * @return {HTMLElement} The overlay element
         */
        createLoadingOverlay: (text = 'Loading...') => {
            const overlay = document.createElement('div');
            overlay.className = CSS_CLASSES.LOADING_OVERLAY;
            const loadingText = document.createElement('div');
            loadingText.textContent = text;
            overlay.appendChild(loadingText);
            return overlay;
        },
        
        /**
         * Create status element
         * @return {Object} Object containing container and element
         */
        createStatusElement: () => {
            const containerStatus = document.createElement('div');
            containerStatus.style.display = 'inline-flex';
            const statusElement = document.createElement('span');
            statusElement.id = 'Status';
            statusElement.style.marginLeft = '10px';
            containerStatus.append(statusElement);
            return {
                container: containerStatus,
                element: statusElement
            };
        },
        
        /**
         * Create button group
         * @param {Array} buttonsConfig - Configuration for buttons
         * @return {HTMLElement} The button group element
         */
        createButtonGroup: (buttonsConfig) => {
            const newDiv = document.createElement('div');
            newDiv.classList.add(CSS_CLASSES.UG_BUTTON_CONTAINER);
            buttonsConfig.forEach(config => {
                if ((config.name === 'REMOVE' && state.hideRemoveButton) ||
                    (config.name === 'FULL' && state.hideFullButton) ||
                    (config.name === 'DOWNLOAD' && state.hideDownloadButton)) return;
    
                const button = UI.createToggleButton(config.text, config.action);
                newDiv.append(button);
                button.classList.add(CSS_CLASSES.UG_BUTTON);
            });
            return newDiv;
        },
        
        /**
         * Create navigation button (prev/next)
         * @param {string} direction - 'prev' or 'next'
         * @return {HTMLElement} The navigation button
         */
        createNavigationButton: (direction) => {
            const button = document.createElement('button');
            button.textContent = direction === 'prev' ? '←' : '→';
            button.className = `${CSS_CLASSES.UG_GALLERY_NAV} ${direction === 'prev' ? CSS_CLASSES.UG_GALLERY_PREV : CSS_CLASSES.UG_GALLERY_NEXT}`;
            button.addEventListener('click', direction === 'prev' ? Gallery.prevImage : Gallery.nextImage);
            button.setAttribute('aria-label', direction === 'prev' ? 'Previous Image' : 'Next Image');
            return button;
        },
        
        /**
         * Show loading overlay
         * @param {string} text - Text to display
         */
        showLoadingOverlay: (text) => {
            if (!elements.loadingOverlay) {
                elements.loadingOverlay = UI.createLoadingOverlay(text);
                document.body.appendChild(elements.loadingOverlay);
            } else {
                UI.updateLoadingOverlayText(text);
            }
        },
        
        /**
         * Update loading overlay text
         * @param {string} text - New text to display
         */
        updateLoadingOverlayText: (text) => {
            if (elements.loadingOverlay) {
                const loadingText = elements.loadingOverlay.querySelector('div');
                if (loadingText) {
                    loadingText.textContent = text;
                }
            }
        },
        
        /**
         * Hide loading overlay
         */
        hideLoadingOverlay: () => {
            if (elements.loadingOverlay) {
                elements.loadingOverlay.remove();
                elements.loadingOverlay = null;
            }
        },
        
        /**
         * Create notification area
         * @return {HTMLElement} The notification area element
         */
        createNotificationArea: () => {
            const notificationArea = document.createElement('div');
            notificationArea.id = CSS_CLASSES.NOTIFICATION_AREA;
            notificationArea.classList.add(CSS_CLASSES.NOTIFICATION_AREA);
            document.body.appendChild(notificationArea);
            return notificationArea;
        },
        
        /**
         * Create notification
         * @return {HTMLElement} The notification container
         */
        createNotification: () => {
            let notificationArea = document.getElementById(CSS_CLASSES.NOTIFICATION_AREA);
            if (!notificationArea) {
                notificationArea = UI.createNotificationArea();
            }
    
            const notificationContainer = document.createElement('div');
            notificationContainer.id = CSS_CLASSES.NOTIFICATION_CONTAINER;
            notificationContainer.classList.add(CSS_CLASSES.NOTIFICATION_CONTAINER);
    
            const notificationText = document.createElement('div');
            notificationText.id = CSS_CLASSES.NOTIFICATION_TEXT;
            notificationContainer.appendChild(notificationText);
    
            const closeButton = document.createElement('button');
            closeButton.id = CSS_CLASSES.NOTIFICATION_CLOSE;
            closeButton.textContent = '×';
            closeButton.addEventListener('click', () => {
                state.notification = null;
            });
            notificationContainer.appendChild(closeButton);
    
            const reportButton = document.createElement('a');
            reportButton.id = CSS_CLASSES.NOTIFICATION_REPORT;
            reportButton.textContent = 'Report Issue';
            reportButton.href = 'https://github.com/TearTyr/Ultra-Galleries/issues';
            reportButton.target = '_blank';
            notificationContainer.appendChild(reportButton);
    
            notificationArea.appendChild(notificationContainer);
            return notificationContainer;
        },
        
        /**
         * Show notification
         * @param {string} message - Message to display
         * @param {string} type - Notification type (info/success/error)
         */
        showNotification: (message, type = 'info') => {
            if (!state.notificationsEnabled && type !== 'error') return;
            let notificationArea = document.getElementById(CSS_CLASSES.NOTIFICATION_AREA);
    
            if (!notificationArea) {
                notificationArea = UI.createNotificationArea();
            }
            let notificationContainer = notificationArea.querySelector(`.${CSS_CLASSES.NOTIFICATION_CONTAINER}`);
            if (!notificationContainer) {
                notificationContainer = UI.createNotification();
            }
            if (notificationArea) {
                notificationArea.style.display = state.notificationAreaVisible ? 'flex' : 'none';
            }
            const notificationText = notificationContainer.querySelector(`#${CSS_CLASSES.NOTIFICATION_TEXT}`);
            notificationText.textContent = message;
    
            notificationContainer.classList.remove('info', 'success', 'error');
            notificationContainer.classList.add(type);
    
            if (state.animationsEnabled) {
                notificationContainer.classList.add('ug-slide-in');
                notificationContainer.classList.remove('ug-slide-out');
            } else {
                notificationContainer.classList.remove('ug-slide-in', 'ug-slide-out');
                notificationContainer.style.display = 'flex';
            }
            notificationContainer.style.display = 'flex';
        },
        
        /**
         * Hide notification
         */
        hideNotification: () => {
            const notificationContainer = document.getElementById(CSS_CLASSES.NOTIFICATION_CONTAINER);
            if (!notificationContainer) return;
    
            if (state.animationsEnabled) {
                notificationContainer.classList.add('ug-slide-out');
                notificationContainer.classList.remove('ug-slide-in');
                setTimeout(() => {
                    notificationContainer.style.display = 'none';
                }, 500);
            } else {
                notificationContainer.classList.remove('ug-slide-in', 'ug-slide-out');
                notificationContainer.style.display = 'none';
            }
        },
        
        /**
         * Create settings UI
         */
        createSettingsUI: () => {
            const settingsOverlay = document.createElement('div');
            settingsOverlay.id = 'ug-settings-overlay';
            settingsOverlay.classList.add(CSS_CLASSES.UG_SETTINGS_OVERLAY);
    
            const settingsContainer = document.createElement('div');
            settingsContainer.classList.add(CSS_CLASSES.UG_SETTINGS_CONTAINER);
            settingsOverlay.appendChild(settingsContainer);
    
            const settingsHeader = document.createElement('div');
            settingsHeader.classList.add(CSS_CLASSES.UG_SETTINGS_HEADER);
            settingsContainer.appendChild(settingsHeader);
    
            const headerText = document.createElement('h2');
            headerText.textContent = 'Ultra Galleries Settings';
            settingsHeader.appendChild(headerText);
    
            const closeButton = document.createElement('button');
            closeButton.classList.add(CSS_CLASSES.UG_SETTINGS_CLOSE_BTN);
            closeButton.textContent = BUTTONS.CLOSE;
            closeButton.addEventListener('click', () => state.settingsOpen = false);
            settingsHeader.appendChild(closeButton);
    
            const settingsBody = document.createElement('div');
            settingsBody.classList.add(CSS_CLASSES.UG_SETTINGS_BODY);
            settingsContainer.appendChild(settingsBody);
    
            const sectionGeneral = document.createElement('div');
            sectionGeneral.classList.add(CSS_CLASSES.UG_SETTINGS_SECTION);
            sectionGeneral.innerHTML = `<h3 class="${CSS_CLASSES.UG_SETTINGS_SECTION_HEADER}">General Settings</h3>`;
            settingsBody.appendChild(sectionGeneral);
    
            const sectionKeys = document.createElement('div');
            sectionKeys.classList.add(CSS_CLASSES.UG_SETTINGS_SECTION);
            sectionKeys.innerHTML = `<h3 class="${CSS_CLASSES.UG_SETTINGS_SECTION_HEADER}">Keyboard Shortcuts</h3>`;
            settingsBody.appendChild(sectionKeys);
    
            const sectionNotifications = document.createElement('div');
            sectionNotifications.classList.add(CSS_CLASSES.UG_SETTINGS_SECTION);
            sectionNotifications.innerHTML = `<h3 class="${CSS_CLASSES.UG_SETTINGS_SECTION_HEADER}">Notifications</h3>`;
            settingsBody.appendChild(sectionNotifications);
    
            const sectionFormatting = document.createElement('div');
            sectionFormatting.classList.add(CSS_CLASSES.UG_SETTINGS_SECTION);
            sectionFormatting.innerHTML = `<h3 class="${CSS_CLASSES.UG_SETTINGS_SECTION_HEADER}">File Formatting</h3>`;
            settingsBody.appendChild(sectionFormatting);
            
            // New section for pan & zoom settings
            const sectionPanZoom = document.createElement('div');
            sectionPanZoom.classList.add(CSS_CLASSES.UG_SETTINGS_SECTION);
            sectionPanZoom.innerHTML = `<h3 class="${CSS_CLASSES.UG_SETTINGS_SECTION_HEADER}">Pan & Zoom Settings</h3>`;
            settingsBody.appendChild(sectionPanZoom);
    
            // --- General Settings ---
            // Dynamic Resizing Toggle
            const dynamicResizingLabel = document.createElement('div');
            dynamicResizingLabel.classList.add(CSS_CLASSES.UG_SETTINGS_CHECKBOX_LABEL);
            dynamicResizingLabel.innerHTML = `<input type="checkbox" id="dynamicResizingToggle" ${state.dynamicResizing ? 'checked' : ''} class="${CSS_CLASSES.UG_SETTINGS_INPUT}"> <label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="dynamicResizingToggle">Dynamic Resizing</label>`;
            dynamicResizingLabel.querySelector('input').addEventListener('change', (e) => {
                state.dynamicResizing = e.target.checked;
                GM_setValue('dynamicResizing', state.dynamicResizing);
            });
            sectionGeneral.appendChild(dynamicResizingLabel);
    
            // Animations Toggle
            const animationsLabel = document.createElement('div');
            animationsLabel.classList.add(CSS_CLASSES.UG_SETTINGS_CHECKBOX_LABEL);
            animationsLabel.innerHTML = `<input type="checkbox" id="animationsToggle" ${state.animationsEnabled ? 'checked' : ''} class="${CSS_CLASSES.UG_SETTINGS_INPUT}"> <label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="animationsToggle">Enable Animations</label>`;
            animationsLabel.querySelector('input').addEventListener('change', (e) => {
                state.animationsEnabled = e.target.checked;
                GM_setValue('animationsEnabled', state.animationsEnabled);
            });
            sectionGeneral.appendChild(animationsLabel);
    
            // Bottom Stripe Visibility Toggle
            const bottomStripeLabel = document.createElement('div');
            bottomStripeLabel.classList.add(CSS_CLASSES.UG_SETTINGS_CHECKBOX_LABEL);
            bottomStripeLabel.innerHTML = `<input type="checkbox" id="bottomStripeToggle" ${state.bottomStripeVisible ? 'checked' : ''} class="${CSS_CLASSES.UG_SETTINGS_INPUT}"> <label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="bottomStripeToggle">Show Thumbnail Strip</label>`;
            bottomStripeLabel.querySelector('input').addEventListener('change', (e) => {
                state.bottomStripeVisible = e.target.checked;
            });
            sectionGeneral.appendChild(bottomStripeLabel);
    
            // --- Pan & Zoom Settings ---
            // Zoom Enable Toggle
            const zoomEnabledLabel = document.createElement('div');
            zoomEnabledLabel.classList.add(CSS_CLASSES.UG_SETTINGS_CHECKBOX_LABEL);
            zoomEnabledLabel.innerHTML = `<input type="checkbox" id="zoomEnabledToggle" ${state.zoomEnabled ? 'checked' : ''} class="${CSS_CLASSES.UG_SETTINGS_INPUT}"> <label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="zoomEnabledToggle">Enable Zoom & Pan</label>`;
            zoomEnabledLabel.querySelector('input').addEventListener('change', (e) => {
                state.zoomEnabled = e.target.checked;
                GM_setValue('zoomEnabled', state.zoomEnabled);
            });
            sectionPanZoom.appendChild(zoomEnabledLabel);
            
            // Inertia Toggle
            const inertiaEnabledLabel = document.createElement('div');
            inertiaEnabledLabel.classList.add(CSS_CLASSES.UG_SETTINGS_CHECKBOX_LABEL);
            inertiaEnabledLabel.innerHTML = `<input type="checkbox" id="inertiaEnabledToggle" ${state.inertiaEnabled ? 'checked' : ''} class="${CSS_CLASSES.UG_SETTINGS_INPUT}"> <label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="inertiaEnabledToggle">Enable Smooth Pan Inertia</label>`;
            inertiaEnabledLabel.querySelector('input').addEventListener('change', (e) => {
                state.inertiaEnabled = e.target.checked;
                GM_setValue('inertiaEnabled', state.inertiaEnabled);
            });
            sectionPanZoom.appendChild(inertiaEnabledLabel);
            
            // Max Zoom Level Input
            const maxZoomLabel = document.createElement('div');
            maxZoomLabel.classList.add(CSS_CLASSES.UG_SETTINGS_LABEL);
            maxZoomLabel.innerHTML = `<label for="maxZoomInput">Maximum Zoom Level:</label> <input type="number" id="maxZoomInput" value="${CONFIG.MAX_SCALE}" min="2" max="10" step="0.5" class="${CSS_CLASSES.UG_SETTINGS_INPUT}">`;
            maxZoomLabel.querySelector('input').addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                if (value >= 2 && value <= 10) {
                    CONFIG.MAX_SCALE = value;
                    GM_setValue('maxZoomScale', value);
                }
            });
            sectionPanZoom.appendChild(maxZoomLabel);
    
            // --- Keyboard Shortcuts ---
            const galleryKeyLabel = document.createElement('div');
            galleryKeyLabel.classList.add(CSS_CLASSES.UG_SETTINGS_LABEL);
            galleryKeyLabel.innerHTML = `<label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="galleryKeyInput">Gallery Key:</label> <input type="text" id="galleryKeyInput" value="${state.galleryKey}" maxlength="1" style="width: 2em;" class="${CSS_CLASSES.UG_SETTINGS_INPUT}">`;
            galleryKeyLabel.querySelector('input').addEventListener('change', (e) => {
                state.galleryKey = e.target.value;
                GM_setValue('galleryKey', state.galleryKey);
            });
            sectionKeys.appendChild(galleryKeyLabel);
    
            const prevImageKeyLabel = document.createElement('div');
            prevImageKeyLabel.classList.add(CSS_CLASSES.UG_SETTINGS_LABEL);
            prevImageKeyLabel.innerHTML = `<label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="prevImageKeyInput">Previous Image Key:</label> <input type="text" id="prevImageKeyInput" value="${state.prevImageKey}" maxlength="1" style="width: 2em;" class="${CSS_CLASSES.UG_SETTINGS_INPUT}">`;
            prevImageKeyLabel.querySelector('input').addEventListener('change', (e) => {
                state.prevImageKey = e.target.value;
                GM_setValue('prevImageKey', state.prevImageKey);
            });
            sectionKeys.appendChild(prevImageKeyLabel);
    
            const nextImageKeyLabel = document.createElement('div');
            nextImageKeyLabel.classList.add(CSS_CLASSES.UG_SETTINGS_LABEL);
            nextImageKeyLabel.innerHTML = `<label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="nextImageKeyInput">Next Image Key:</label> <input type="text" id="nextImageKeyInput" value="${state.nextImageKey}" maxlength="1" style="width: 2em;" class="${CSS_CLASSES.UG_SETTINGS_INPUT}">`;
            nextImageKeyLabel.querySelector('input').addEventListener('change', (e) => {
                state.nextImageKey = e.target.value;
                GM_setValue('nextImageKey', state.nextImageKey);
            });
            sectionKeys.appendChild(nextImageKeyLabel);
    
            // --- Notifications Settings ---
            const notificationsEnabledLabel = document.createElement('div');
            notificationsEnabledLabel.classList.add(CSS_CLASSES.UG_SETTINGS_CHECKBOX_LABEL);
            notificationsEnabledLabel.innerHTML = `<input type="checkbox" id="notificationsEnabledToggle" ${state.notificationsEnabled ? 'checked' : ''} class="${CSS_CLASSES.UG_SETTINGS_INPUT}"> <label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="notificationsEnabledToggle">Enable Notifications</label>`;
            notificationsEnabledLabel.querySelector('input').addEventListener('change', (e) => {
                state.notificationsEnabled = e.target.checked;
                GM_setValue('notificationsEnabled', state.notificationsEnabled);
            });
            sectionNotifications.appendChild(notificationsEnabledLabel);
    
            const notificationAreaVisibleLabel = document.createElement('div');
            notificationAreaVisibleLabel.classList.add(CSS_CLASSES.UG_SETTINGS_CHECKBOX_LABEL);
            notificationAreaVisibleLabel.innerHTML = `<input type="checkbox" id="notificationAreaVisibleToggle" ${state.notificationAreaVisible ? 'checked' : ''} class="${CSS_CLASSES.UG_SETTINGS_INPUT}"> <label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="notificationAreaVisibleToggle">Show Notification Area</label>`;
            notificationAreaVisibleLabel.querySelector('input').addEventListener('change', (e) => {
                state.notificationAreaVisible = e.target.checked;
                GM_setValue('notificationAreaVisible', state.notificationAreaVisible);
                const notificationArea = document.getElementById(CSS_CLASSES.NOTIFICATION_AREA);
                if (notificationArea) {
                    notificationArea.style.display = state.notificationAreaVisible ? 'flex' : 'none';
                }
            });
            sectionNotifications.appendChild(notificationAreaVisibleLabel);
    
            // --- File Formatting Settings ---
            const zipFileNameFormatLabel = document.createElement('div');
            zipFileNameFormatLabel.classList.add(CSS_CLASSES.UG_SETTINGS_LABEL);
            zipFileNameFormatLabel.innerHTML = `<label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="zipFileNameFormatInput">Zip File Name Format:</label> <input type="text" id="zipFileNameFormatInput" value="${state.zipFileNameFormat}" style="width: 100%;" class="${CSS_CLASSES.UG_SETTINGS_INPUT}">`;
            zipFileNameFormatLabel.querySelector('input').addEventListener('change', (e) => {
                state.zipFileNameFormat = e.target.value;
                GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
            });
            sectionFormatting.appendChild(zipFileNameFormatLabel);
    
            const imageFileNameFormatLabel = document.createElement('div');
            imageFileNameFormatLabel.classList.add(CSS_CLASSES.UG_SETTINGS_LABEL);
            imageFileNameFormatLabel.innerHTML = `<label class="${CSS_CLASSES.UG_SETTINGS_LABEL}" for="imageFileNameFormatInput">Image File Name Format:</label> <input type="text" id="imageFileNameFormatInput" value="${state.imageFileNameFormat}" style="width: 100%;" class="${CSS_CLASSES.UG_SETTINGS_INPUT}">`;
            imageFileNameFormatLabel.querySelector('input').addEventListener('change', (e) => {
                state.imageFileNameFormat = e.target.value;
                GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
            });
            sectionFormatting.appendChild(imageFileNameFormatLabel);
    
            document.body.appendChild(settingsOverlay);
        },
        
        /**
         * Show settings
         */
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
        
        /**
         * Close settings
         */
        closeSettings: () => {
            const overlay = document.getElementById('ug-settings-overlay');
            if (overlay) {
                overlay.classList.add('closing');
                setTimeout(() => {
                    overlay.remove();
                }, 300);
            }
        }
    };

    // ====================================================
    // MODULE: Gallery Management
    // ====================================================
    
    let galleryOverlay = null;

    const Gallery = {
        /**
         * Create gallery UI
         */
        createGallery: () => {
            if (galleryOverlay) return;
    
            galleryOverlay = document.createElement('div');
            galleryOverlay.id = 'gallery-overlay';
            galleryOverlay.classList.add('ug-gallery-overlay');
    
            const galleryContainer = document.createElement('div');
            galleryContainer.classList.add('ug-gallery-container');
            galleryOverlay.appendChild(galleryContainer);
    
            const gridView = document.createElement('div');
            gridView.classList.add(CSS_CLASSES.UG_GALLERY_GRID_VIEW);
            galleryContainer.appendChild(gridView);
    
            const expandedView = document.createElement('div');
            expandedView.classList.add(CSS_CLASSES.UG_GALLERY_EXPANDED_VIEW, CSS_CLASSES.UG_GALLERY_HIDE);
            galleryContainer.appendChild(expandedView);
    
            // Toolbar for expanded view
            const toolbar = document.createElement('div');
            toolbar.classList.add(CSS_CLASSES.UG_GALLERY_TOOLBAR);
            expandedView.appendChild(toolbar);
            toolbar.addEventListener('mousedown', (e) => e.stopPropagation());
    
            const expandedCloseButton = document.createElement('button');
            expandedCloseButton.classList.add(CSS_CLASSES.UG_TOOLBAR_BUTTON);
            expandedCloseButton.textContent = BUTTONS.CLOSE;
            expandedCloseButton.addEventListener('click', Gallery.showGridView);
            expandedCloseButton.setAttribute('aria-label', 'Close Expanded View');
            toolbar.appendChild(expandedCloseButton);
    
            // Zoom Controls Container
            const zoomControlsContainer = document.createElement('div');
            zoomControlsContainer.classList.add('zoom-controls');
            toolbar.appendChild(zoomControlsContainer);
    
            const zoomOutBtn = document.createElement('button');
            zoomOutBtn.id = 'zoom-out-btn';
            zoomOutBtn.title = 'Zoom Out';
            zoomOutBtn.classList.add(CSS_CLASSES.UG_TOOLBAR_BUTTON);
            zoomOutBtn.innerHTML = '<img src="https://www.svgrepo.com/show/263638/zoom-out-search.svg" alt="Zoom Out" style="filter: invert(100%);">';
            zoomOutBtn.addEventListener('click', () => Zoom.zoom(-CONFIG.ZOOM_STEP));
            zoomControlsContainer.appendChild(zoomOutBtn);
    
            const zoomLevelDisplay = document.createElement('span');
            zoomLevelDisplay.id = 'zoom-level';
            zoomLevelDisplay.classList.add('zoom-level');
            zoomLevelDisplay.textContent = '100%';
            zoomControlsContainer.appendChild(zoomLevelDisplay);
    
            const zoomInBtn = document.createElement('button');
            zoomInBtn.id = 'zoom-in-btn';
            zoomInBtn.title = 'Zoom In';
            zoomInBtn.classList.add(CSS_CLASSES.UG_TOOLBAR_BUTTON);
            zoomInBtn.innerHTML = '<img src="https://www.svgrepo.com/show/263635/zoom-in.svg" alt="Zoom In" style="filter: invert(100%);">';
            zoomInBtn.addEventListener('click', () => Zoom.zoom(CONFIG.ZOOM_STEP));
            zoomControlsContainer.appendChild(zoomInBtn);
    
            const resetZoomBtn = document.createElement('button');
            resetZoomBtn.id = 'reset-btn';
            resetZoomBtn.title = 'Reset Zoom & Position';
            resetZoomBtn.classList.add(CSS_CLASSES.UG_TOOLBAR_BUTTON);
            resetZoomBtn.textContent = 'Reset';
            resetZoomBtn.addEventListener('click', Zoom.resetZoom);
            zoomControlsContainer.appendChild(resetZoomBtn);
    
            const thumbnailGrid = document.createElement('div');
            thumbnailGrid.classList.add(CSS_CLASSES.UG_GALLERY_THUMBNAIL_GRID);
            gridView.appendChild(thumbnailGrid);
    
            // Main Image Container
			const expandedZoomContainer = document.createElement('div');
			expandedZoomContainer.classList.add(CSS_CLASSES.UG_GALLERY_ZOOM_CONTAINER);
			expandedView.appendChild(expandedZoomContainer);
    
			const mainImageContainer = document.createElement('div');
			mainImageContainer.classList.add(CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER, 'image-container');
			expandedZoomContainer.appendChild(mainImageContainer);
            
            // Mouse wheel zoom
			mainImageContainer.addEventListener('wheel', Zoom.handleWheelZoom, {
				passive: false
			});
            
			// Enable dragging from the entire expanded view area
			expandedView.addEventListener('mousedown', (e) => {
				// Don't start drag if clicking on controls
				if (e.target.closest(`.${CSS_CLASSES.UG_GALLERY_TOOLBAR}`) || 
					e.target.closest(`.${CSS_CLASSES.UG_GALLERY_NAV}`) ||
					e.target.closest(`.${CSS_CLASSES.UG_GALLERY_THUMBNAIL_STRIP_CONTAINER}`)) {
					return;
				}
				Zoom.startDrag(e);
			});

			// Add dragStartOffset to state if not already there
			if (!state.dragStartOffset) {
				state.dragStartOffset = { x: 0, y: 0 };
			}
            
            // Add pan indicator instructions
            const panIndicator = document.createElement('div');
            panIndicator.className = 'pan-indicator';
            panIndicator.style.position = 'absolute';
            panIndicator.style.top = '15px';
            panIndicator.style.left = '15px';
            panIndicator.style.zIndex = '10';
            panIndicator.style.opacity = '0';
            panIndicator.style.transition = 'opacity 0.3s ease';
            panIndicator.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white" opacity="0.7">
                    <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
                </svg>
            `;
            mainImageContainer.appendChild(panIndicator);
            
			const mainImage = document.createElement('img');
			mainImage.classList.add(CSS_CLASSES.UG_MAIN_IMAGE, CSS_CLASSES.UG_GALLERY_ZOOM_IMAGE, 'gallery-image');
			mainImageContainer.appendChild(mainImage);
    
            const navContainer = document.createElement('div');
            navContainer.classList.add(CSS_CLASSES.UG_GALLERY_NAV_CONTAINER);
            expandedView.appendChild(navContainer);
            navContainer.addEventListener('mousedown', (e) => e.stopPropagation());
    
            const prevButton = UI.createNavigationButton('prev');
            navContainer.appendChild(prevButton);
    
            const nextButton = UI.createNavigationButton('next');
            navContainer.appendChild(nextButton);
    
            const fullscreenButton = document.createElement('button');
            fullscreenButton.textContent = BUTTONS.FULLSCREEN;
            fullscreenButton.classList.add(CSS_CLASSES.UG_GALLERY_FULLSCREEN, CSS_CLASSES.UG_TOOLBAR_BUTTON);
            toolbar.appendChild(fullscreenButton);
            fullscreenButton.addEventListener('click', Gallery.toggleFullscreen);
            fullscreenButton.setAttribute('aria-label', 'Toggle Fullscreen');
    
            const counter = document.createElement('div');
            counter.classList.add(CSS_CLASSES.UG_GALLERY_COUNTER, CSS_CLASSES.UG_GALLERY_HIDE);
            expandedView.appendChild(counter);
    
            // Thumbnail Strip Container
            const thumbnailStripContainer = document.createElement('div');
            thumbnailStripContainer.classList.add(CSS_CLASSES.UG_GALLERY_THUMBNAIL_STRIP_CONTAINER);
            expandedView.appendChild(thumbnailStripContainer);
            thumbnailStripContainer.addEventListener('mousedown', (e) => e.stopPropagation());
    
            const thumbnailStrip = document.createElement('div');
            thumbnailStrip.classList.add(CSS_CLASSES.UG_THUMBNAIL_STRIP);
            thumbnailStripContainer.appendChild(thumbnailStrip);
    
            const gridCloseButton = document.createElement('button');
            gridCloseButton.textContent = BUTTONS.CLOSE;
            gridCloseButton.classList.add(CSS_CLASSES.UG_GALLERY_GRID_CLOSE);
            gridView.appendChild(gridCloseButton);
            gridCloseButton.addEventListener('click', Gallery.closeGallery);
            gridCloseButton.setAttribute('aria-label', 'Close Gallery');
    
            document.body.appendChild(galleryOverlay);
    
            // Create thumbnails for both grid and strip
            state.fullSizeImageSrcs.forEach((src, index) => {
                if (src) {
                    // Grid thumbnail
                    const thumbnailContainer = document.createElement('div');
                    thumbnailContainer.classList.add(CSS_CLASSES.UG_GALLERY_THUMBNAIL_GRID_CONTAINER);
                    const thumbnail = document.createElement('img');
                    thumbnail.src = src;
                    thumbnail.classList.add(CSS_CLASSES.UG_GALLERY_THUMBNAIL);
                    thumbnail.dataset.index = index;
                    thumbnail.addEventListener('click', () => Gallery.showExpandedView(index));
                    thumbnail.setAttribute('aria-label', `Open image ${index + 1}`);
                    thumbnailContainer.appendChild(thumbnail);
                    thumbnailGrid.appendChild(thumbnailContainer);
        
                    // Strip thumbnail
                    const stripThumbnail = document.createElement('img');
                    stripThumbnail.src = src;
                    stripThumbnail.classList.add(CSS_CLASSES.UG_THUMBNAIL);
                    stripThumbnail.dataset.index = index;
                    stripThumbnail.setAttribute('aria-label', `Thumbnail ${index + 1}`);
                    stripThumbnail.addEventListener('click', () => Gallery.showExpandedView(index));
                    thumbnailStrip.appendChild(stripThumbnail);
                }
            });
            
            // Setup tap/touch events for mobile
            Zoom.setupTouchEvents();
    
            Gallery.showGridView();
            
            // Set up global event listeners for dragging
			document.addEventListener('mousemove', Zoom.dragImage);
			document.addEventListener('mouseup', Zoom.endDrag);
            
            // Double click to zoom
            mainImageContainer.addEventListener('dblclick', (e) => {
                if (state.zoomScale > 1) {
                    Zoom.resetZoom();
                } else {
                    // Zoom to a specific level at the clicked position
                    const containerRect = mainImageContainer.getBoundingClientRect();
                    const clickX = e.clientX - containerRect.left;
                    const clickY = e.clientY - containerRect.top;
                    
                    // Set zoom origin to clicked position
                    state.zoomOrigin = { x: clickX, y: clickY };
                    
                    // Calculate new scale
                    const newScale = 2.5; // Default zoom level for double click
                    
                    // Calculate image coordinates
                    const imageX = (clickX - state.imageOffset.x) / state.zoomScale;
                    const imageY = (clickY - state.imageOffset.y) / state.zoomScale;
                    
                    // Calculate new offset
                    const newOffsetX = clickX - (imageX * newScale);
                    const newOffsetY = clickY - (imageY * newScale);
                    
                    // Get image element
                    const mainImage = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE}`);
                    
                    // Apply boundaries
                    const boundedOffset = Zoom.enforceBoundaries(
                        newOffsetX, newOffsetY, newScale, containerRect, mainImage
                    );
                    
                    // Update state with smooth transition
                    mainImageContainer.style.transition = 'transform 0.3s ease-out';
                    state.imageOffset.x = boundedOffset.x;
                    state.imageOffset.y = boundedOffset.y;
                    state.zoomScale = newScale;
                    
                    setTimeout(() => mainImageContainer.style.transition = '', 300);
                }
            });
            
            // Show/hide controls on mouse movement
            let controlsTimeout;
            expandedView.addEventListener('mousemove', () => {
                state.controlsVisible = true;
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => {
                    if (!state.isDragging) {
                        state.controlsVisible = false;
                    }
                }, 3000);
            });
            
            // Initial show of controls
            state.controlsVisible = true;
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                state.controlsVisible = false;
            }, 3000);
        },
        
        /**
         * Show grid view
         */
        showGridView: () => {
            if (!galleryOverlay) return;
            galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_GRID_VIEW}`).classList.remove(CSS_CLASSES.UG_GALLERY_HIDE);
            galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_EXPANDED_VIEW}`).classList.add(CSS_CLASSES.UG_GALLERY_HIDE);
            Zoom.resetZoom();
            state.isZoomed = false;
            state.controlsVisible = true;
        },
        
        /**
         * Show expanded view of specific image
         * @param {number} index - Image index
         */
		showExpandedView: (index) => {
			if (!galleryOverlay) return;
		
			const mainImage = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE}`);
			const mainImageContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
			const counter = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_COUNTER}`);
			const prevButton = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_PREV}`);
			const nextButton = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_NEXT}`);
			const thumbnailStrip = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_THUMBNAIL_STRIP}`);
		
			if (index < 0 || index >= state.fullSizeImageSrcs.length) {
				console.error("Invalid image index:", index);
				return;
			}
		
			const imageUrl = state.fullSizeImageSrcs[index];
			if (!imageUrl) {
				console.error("No image URL for index:", index);
				return;
			}
		
			// Set loading state
			mainImage.classList.add('loading');
			
			// Reset zoom and position
			Zoom.resetZoom();
			
			// Make sure the container has proper styles
			if (mainImageContainer) {
				mainImageContainer.style.position = 'relative';
				mainImageContainer.style.width = '100%';
				mainImageContainer.style.height = '100%';
				mainImageContainer.style.display = 'flex';
				mainImageContainer.style.justifyContent = 'center';
				mainImageContainer.style.alignItems = 'center';
				mainImageContainer.style.overflow = 'hidden';
			}
			
			// Make sure the image has proper styles
			mainImage.style.position = 'relative';
			mainImage.style.maxWidth = '100%';
			mainImage.style.maxHeight = '100%';
			mainImage.style.objectFit = 'contain';
			
			mainImage.onload = () => {
				mainImage.classList.remove('loading');
				Zoom.initializeImage(mainImage, mainImageContainer);
			};
		
			mainImage.onerror = () => {
				console.error("Error loading image:", imageUrl);
				mainImage.src = '';
				mainImage.alt = "Error loading image";
				mainImage.classList.remove('loading');
				mainImage.classList.add('error');
			};
		
			mainImage.src = imageUrl;
			mainImage.alt = `Image ${index + 1} of ${state.fullSizeImageSrcs.length}`;
			
			counter.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
		
			state.currentGalleryIndex = index;
		
			galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_GRID_VIEW}`).classList.add(CSS_CLASSES.UG_GALLERY_HIDE);
			galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_EXPANDED_VIEW}`).classList.remove(CSS_CLASSES.UG_GALLERY_HIDE);
			counter.classList.remove(CSS_CLASSES.UG_GALLERY_HIDE);
		
			// Scroll the thumbnail strip to center the current thumbnail
			const currentThumb = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_THUMBNAIL}[data-index="${index}"]`);
			if (currentThumb) {
				thumbnailStrip.scrollLeft = currentThumb.offsetLeft - thumbnailStrip.offsetWidth / 2 + 50;
			}
		
			// Update selected thumbnail styling
			galleryOverlay.querySelectorAll(`.${CSS_CLASSES.UG_THUMBNAIL}`).forEach(thumb => {
				thumb.classList.remove('selected');
			});
			const selectedThumb = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_THUMBNAIL}[data-index="${index}"]`);
			if (selectedThumb) {
				selectedThumb.classList.add('selected');
			}
		
			// Show/hide navigation buttons as needed
			prevButton.classList.toggle(CSS_CLASSES.UG_GALLERY_HIDE, index === 0);
			nextButton.classList.toggle(CSS_CLASSES.UG_GALLERY_HIDE, index === state.fullSizeImageSrcs.length - 1);
			
			// Show controls initially, then auto-hide
			state.controlsVisible = true;
			setTimeout(() => {
				state.controlsVisible = false;
			}, 3000);
		},
        
        /**
         * Close gallery
         */
        closeGallery: () => {
            if (!galleryOverlay) return;
            document.body.removeChild(galleryOverlay);
            galleryOverlay = null;
            document.body.classList.remove('ug-fullscreen');
            state.isGalleryMode = false;
            state.isFullscreen = false;
            
            // Clean up event listeners
            document.removeEventListener('mousemove', Zoom.dragImage);
            document.removeEventListener('mouseup', Zoom.endDrag);
        },
        
        /**
         * Toggle gallery open/closed
         */
        toggleGallery: () => {
            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else {
                Gallery.createGallery();
            }
            state.isGalleryMode = !state.isGalleryMode;
        },
        
        /**
         * Toggle fullscreen mode
         */
        toggleFullscreen: () => {
            state.isFullscreen = !state.isFullscreen;
        },
        
        /**
         * Show next image
         */
        nextImage: () => {
            let newIndex = (state.currentGalleryIndex + 1) % state.fullSizeImageSrcs.length;
            Gallery.showExpandedView(newIndex);
        },
        
        /**
         * Show previous image
         */
        prevImage: () => {
            let newIndex = (state.currentGalleryIndex - 1 + state.fullSizeImageSrcs.length) % state.fullSizeImageSrcs.length;
            Gallery.showExpandedView(newIndex);
        },
        
        /**
         * Create virtual gallery in memory
         */
        createVirtualGallery: () => {
            Gallery.cleanupVirtualGallery();
            elements.virtualGalleryContainer = document.createElement('div');
            elements.virtualGalleryContainer.style.display = 'none';
            state.virtualGallery.forEach((mediaSrc) => {
                if (mediaSrc) {
                    const mediaElement = document.createElement('img');
                    mediaElement.src = mediaSrc;
                    mediaElement.className = CSS_CLASSES.VIRTUAL_IMAGE;
                    elements.virtualGalleryContainer.appendChild(mediaElement);
                }
            });
            document.body.appendChild(elements.virtualGalleryContainer);
        },
        
        /**
         * Cleanup virtual gallery
         */
        cleanupVirtualGallery: () => {
            if (elements.virtualGalleryContainer) {
                elements.virtualGalleryContainer.remove();
                elements.virtualGalleryContainer = null;
            }
            state.galleryReady = false;
        }
    };

    // ====================================================
    // MODULE: Image Loading & Processing
    // ====================================================
    
    const ImageLoader = {
        /**
         * Image resizing actions
         */
        imageActions: {
            height: (img) => Utils.setImageStyle(img, {
                maxHeight: '100vh',
                maxWidth: '100%',
                width: 'auto',
                height: 'auto'
            }),
            width: (img) => Utils.setImageStyle(img, {
                maxHeight: '100%',
                maxWidth: '100vw',
                width: 'auto',
                height: 'auto'
            }),
            full: (img) => Utils.setImageStyle(img, {
                maxHeight: 'none',
                maxWidth: 'none',
                height: 'auto',
                width: 'auto'
            }),
        },
        
        /**
         * Simulate scrolling to load all images
         */
        simulateScrollDown: async () => {
            const originalScrollPosition = window.pageYOffset;
            const maxScrollHeight = document.body.scrollHeight - window.innerHeight;
            const scrollStep = window.innerHeight * 0.75;
            let currentScrollY = originalScrollPosition;
    
            for (; currentScrollY < maxScrollHeight;) {
                const scrollAmount = Math.min(scrollStep, maxScrollHeight - currentScrollY);
                currentScrollY += scrollAmount;
                window.scrollBy({
                    top: scrollAmount,
                    behavior: 'smooth'
                });
                await Utils.delay(250);
            };
            window.scrollTo(0, originalScrollPosition);
        },
        
        /**
         * Handle image loading error
         * @param {string} mediaSrc - Source URL
         * @param {Function} reject - Promise reject function
         */
        handleImageError: (mediaSrc, reject) => {
            console.error(`Image failed to load: ${mediaSrc}`);
            state.loadedImages++;
            state.notification = 'Error loading some media.';
            state.notificationType = 'error';
            reject(new Error(`Failed to load image: ${mediaSrc}`));
        },
        
        /**
         * Handle image fetch error
         * @param {string} mediaSrc - Source URL
         * @param {string|number} status - Error status
         * @param {Function} reject - Promise reject function
         * @param {Error} error - Error object
         */
        handleImageFetchError: (mediaSrc, status, reject, error = null) => {
            console.error(`Failed to fetch image (status ${status}): ${mediaSrc}`, error);
            state.loadedImages++;
            state.notification = 'Error loading some media.';
            state.notificationType = 'error';
            reject(new Error(`Failed to fetch image (${status}): ${mediaSrc}`));
        },
        
        /**
         * Handle general image load error
         * @param {string} mediaHref - Media URL
         * @param {Error} error - Error object
         */
        handleGeneralImageLoadError: (mediaHref, error) => {
            console.error(`Failed to load media: ${mediaHref}`, error);
            state.virtualGallery = null;
            state.loadedImages++;
            state.notification = 'Error loading some media.';
            state.notificationType = 'error';
        },
        
        /**
         * Retry loading an image with exponential backoff
         * @param {Function} loadFn - Function to retry
         * @param {number} retries - Number of retries
         * @param {number} delay - Initial delay
         * @param {string} mediaSrc - Media source for tracking
         * @return {Promise} Promise that resolves when image loads or max retries reached
         */
        retryWithBackoff: async (loadFn, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY, mediaSrc) => {
            try {
                return await loadFn();
            } catch (err) {
                state.errorCount++;
                
                if (retries <= 0) {
                    console.error(`Failed to load after ${CONFIG.MAX_RETRIES} retries:`, mediaSrc);
                    throw err;
                }
                
                console.log(`Retrying load for ${mediaSrc}, ${retries} attempts remaining`);
                await Utils.delay(delay);
                return ImageLoader.retryWithBackoff(loadFn, retries - 1, delay * 1.5, mediaSrc);
            }
        },
        
        /**
         * Load a single image
         * @param {HTMLElement} mediaLink - The media link element
         * @param {number} index - Index in gallery
         * @return {Promise} Promise that resolves when image is loaded
         */
        loadImage: async (mediaLink, index) => {
            try {
                const mediaSrc = Utils.handleMediaSrc(mediaLink);
                if (!mediaSrc) {
                    console.warn(`Skipping media at index ${index} due to undefined mediaSrc.`, mediaLink);
                    state.loadedImages++;
                    state.virtualGallery[index] = null;
                    return;
                }
                
                state.fullSizeImageSrcs[index] = mediaSrc;
                const img = mediaLink.querySelector('img');
    
                if (img) {
                    await ImageLoader.retryWithBackoff(async () => {
                        return new Promise((resolve, reject) => {
                            GM.xmlHttpRequest({
                                method: 'GET',
                                url: mediaSrc,
                                responseType: 'blob',
                                onload: function(response) {
                                    if (response.status === 200 || response.status === 206) {
                                        const blobUrl = URL.createObjectURL(response.response);
                                        img.src = blobUrl;
                                        img.dataset.originalSrc = blobUrl;
                                        ImageLoader.imageActions.height(img);
                                        img.onload = () => {
                                            state.loadedImages++;
                                            state.mediaLoaded[index] = true;
                                            mediaLink.classList.add(CSS_CLASSES.NO_CLICK);
                                            resolve();
                                        };
                                        img.onerror = () => ImageLoader.handleImageError(mediaSrc, reject);
                                    } else {
                                        ImageLoader.handleImageFetchError(mediaSrc, response.status, reject);
                                    }
                                },
                                onerror: (error) => {
                                    ImageLoader.handleImageFetchError(mediaSrc, 'Error', reject, error);
                                },
                            });
                        });
                    }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, mediaSrc);
                }
                
                state.virtualGallery[index] = mediaSrc;
                
            } catch (error) {
                state.virtualGallery[index] = null;
                ImageLoader.handleGeneralImageLoadError(mediaLink.href, error);
            }
        },
        
        /**
         * Load all images
         * @return {Promise} Promise that resolves when all images are loaded
         */
        loadImages: async () => {
            if (!Utils.isPostPage() || state.galleryReady || state.isLoading) return;
    
            state.isLoading = true;
            state.loadingMessage = 'Loading Media...';
    
            const mediaLinks = [
                ...document.querySelectorAll(SELECTORS.IMAGE_LINK),
                ...document.querySelectorAll(SELECTORS.ATTACHMENT_LINK),
            ];
    
            state.totalImages = mediaLinks.length;
            state.virtualGallery = Array(state.totalImages).fill(null);
            state.fullSizeImageSrcs = Array(state.totalImages).fill(null);
            state.loadedImages = 0;
            state.mediaLoaded = {};
            state.errorCount = 0;
    
            await ImageLoader.simulateScrollDown();
    
            const batchSize = CONFIG.BATCH_SIZE;
            for (let i = 0; i < mediaLinks.length; i += batchSize) {
                const batchPromises = [];
                for (let j = 0; j < batchSize && i + j < mediaLinks.length; j++) {
                    batchPromises.push(ImageLoader.loadImage(mediaLinks[i + j], i + j));
                }
                await Promise.all(batchPromises);
            }
    
            if (state.loadedImages === state.totalImages && state.virtualGallery.every((item) => item === null)) {
                state.notification = 'Error loading some media.';
                state.notificationType = 'error';
            }
    
            Gallery.createVirtualGallery();
            state.galleryReady = true;
            state.isLoading = false;
            state.loadingMessage = null;
        }
    };

    // ====================================================
    // MODULE: Download Management
    // ====================================================
    
    const DownloadManager = {
        /**
         * Download all images as zip
         * @return {Promise} Promise that resolves when download completes
         */
        downloadAllImages: async () => {
            const images = document.querySelectorAll(SELECTORS.IMAGE_LINK);
            const attachmentLinks = document.querySelectorAll(SELECTORS.ATTACHMENT_LINK);
            const title = document.querySelector(SELECTORS.POST_TITLE)?.textContent?.trim() || "Untitled";
            const artistName = document.querySelector(SELECTORS.POST_USER_NAME)?.textContent?.trim() || "Unknown Artist";
    
            const total = images.length + attachmentLinks.length;
            if (total === 0) return;
    
            if (state.isGalleryMode) {
                const result = await Swal.fire({
                    title: 'Download All Images?',
                    text: `You are about to download ${total} images. Proceed?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Download',
                    cancelButtonText: 'Cancel',
                });
    
                if (!result.isConfirmed) {
                    return;
                }
            }
    
            state.isDownloading = true;
            state.loadingMessage = "Downloading...";
            state.downloadedCount = 0;
            state.notification = `Downloading... (0/${total})`;
    
            const sanitizedTitle = Utils.sanitizeFileName(title);
            const sanitizedArtistName = Utils.sanitizeFileName(artistName);
    
            const zip = new JSZip();
            let downloaded = 0;
            const downloadPromises = [];
    
            const downloadAndAddToZip = async (url, originalFilename, index) => {
                try {
                    return await DownloadManager.retryWithBackoff(async () => {
                        return new Promise((resolve, reject) => {
                            GM.xmlHttpRequest({
                                method: "GET",
                                url: url,
                                headers: {
                                    referer: `https://${website}.su/`
                                },
                                responseType: 'blob',
                                onload: function(response) {
                                    if (response.status === 200) {
                                        let filename = originalFilename;
                                        let ext = Utils.getExtension(filename);
            
                                        if (!ext || ext === 'jpg') {
                                            const contentType = response.responseHeaders.match(/content-type:\s*([^;]*)/i)?.[1];
                                            if (contentType) {
                                                if (contentType.startsWith('image/')) {
                                                    const imageExt = contentType.split('/')[1].replace('jpeg', 'jpg');
                                                    if (imageExt && imageExt !== 'octet-stream' && imageExt !== 'x-icon') {
                                                        ext = imageExt;
                                                        filename = originalFilename.replace(/\.[^/.]+$/, '') + '.' + ext;
                                                    }
                                                } else if (contentType === 'application/octet-stream' && originalFilename.includes('.')) {
                                                    ext = Utils.getExtension(originalFilename);
                                                }
                                                if (!ext || !['jpg', 'png', 'gif', 'webp'].includes(ext)) {
                                                    ext = 'jpg';
                                                    filename = originalFilename.replace(/\.[^/.]+$/, '') + '.jpg';
                                                }
                                            } else {
                                                ext = 'jpg';
                                                filename = originalFilename.replace(/\.[^/.]+$/, '') + '.jpg';
                                            }
                                        }
            
                                        const finalFilename = state.imageFileNameFormat
                                            .replace("{title}", sanitizedTitle)
                                            .replace("{artistName}", sanitizedArtistName)
                                            .replace("{fileName}", Utils.sanitizeFileName(filename.replace(/\.[^/.]+$/, "")))
                                            .replace("{index}", index + 1)
                                            .replace("{ext}", ext.toLowerCase());
            
                                        zip.file(finalFilename + '.' + ext, response.response);
                                        downloaded++;
                                        state.downloadedCount = downloaded;
                                        resolve();
                                    } else {
                                        console.error('Error downloading:', response.status, originalFilename);
                                        reject(new Error(`Failed to fetch ${originalFilename}: ${response.status}`));
                                    }
                                },
                                onerror: function(error) {
                                    console.error('Error downloading:', error, originalFilename);
                                    reject(error);
                                }
                            });
                        });
                    }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, url);
                } catch (error) {
                    console.error(`Failed to download ${originalFilename} after retries:`, error);
                    // Continue despite errors for batch downloads
                    return null;
                }
            };
    
            for (let i = 0; i < images.length; i++) {
                const imgLink = images[i];
                const imgSrc = imgLink.href.split("?")[0];
                const originalFileName = imgLink.getAttribute("download") || `image-${i + 1}.jpg`;
                downloadPromises.push(downloadAndAddToZip(imgSrc, originalFileName, i));
            }
    
            for (let i = 0; i < attachmentLinks.length; i++) {
                const link = attachmentLinks[i];
                const attachmentSrc = link.href;
                const originalFileName = link.textContent.trim().replace("Download ", "");
                downloadPromises.push(downloadAndAddToZip(attachmentSrc, originalFileName, i));
            }
    
            try {
                await Promise.all(downloadPromises);
    
                const zipBlob = await zip.generateAsync({
                    type: 'blob'
                });
                const zipFileName = state.zipFileNameFormat
                    .replace("{artistName}", sanitizedArtistName)
                    .replace("{title}", sanitizedTitle);
                saveAs(zipBlob, zipFileName);
                state.isDownloading = false;
                state.loadingMessage = null;
                state.notification = `Done! Total: ${total}`;
                state.notificationType = 'success';
            } catch (error) {
                console.error('Error creating zip:', error);
                Swal.fire('Error!', `Failed to create zip file: ${error.message}`, 'error');
                state.isDownloading = false;
                state.loadingMessage = null;
                state.notification = `Failed to create zip file: ${error.message}`;
                state.notificationType = 'error';
            }
        },
        
        /**
         * Download a single image by index
         * @param {number} index - Image index
         */
        downloadImageByIndex: async (index) => {
            const imgLink = document.querySelectorAll(SELECTORS.IMAGE_LINK)[index];
    
            if (imgLink) {
                const imgSrc = imgLink.href.split("?")[0];
                let fileName = imgLink.getAttribute('download');
    
                if (!fileName) {
                    fileName = `image_${index + 1}.jpg`;
                }
    
                try {
                    await DownloadManager.retryWithBackoff(async () => {
                        return new Promise((resolve, reject) => {
                            GM.xmlHttpRequest({
                                method: "GET",
                                url: imgSrc,
                                headers: {
                                    referer: `https://${website}.su/`
                                },
                                responseType: 'blob',
                                onload: function(response) {
                                    if (response.status === 200) {
                                        const blob = response.response;
                                        const url = URL.createObjectURL(blob);
                                        saveAs(blob, fileName);
                                        URL.revokeObjectURL(url);
                                        resolve();
                                    } else {
                                        reject(new Error(`HTTP ${response.status}`));
                                    }
                                },
                                onerror: function(error) {
                                    reject(error);
                                }
                            });
                        });
                    }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, imgSrc);
                    
                    // Show success notification
                    state.notification = `Downloaded: ${fileName}`;
                    state.notificationType = 'success';
                    
                } catch (error) {
                    console.error('Error downloading image:', error);
                    Swal.fire('Error!', `Failed to download image: ${error.message}`, 'error');
                }
            } else {
                console.error("imgLink not found for index:", index);
            }
        },
        
        /**
         * Retry download with backoff
         * @param {Function} downloadFn - Function to retry
         * @param {number} retries - Number of retries
         * @param {number} delay - Initial delay
         * @param {string} url - URL for tracking
         * @return {Promise} Promise that resolves when download completes
         */
        retryWithBackoff: async (downloadFn, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY, url) => {
            try {
                return await downloadFn();
            } catch (err) {
                if (retries <= 0) {
                    console.error(`Failed to download after ${CONFIG.MAX_RETRIES} retries:`, url);
                    throw err;
                }
                
                console.log(`Retrying download for ${url}, ${retries} attempts remaining`);
                await Utils.delay(delay);
                return DownloadManager.retryWithBackoff(downloadFn, retries - 1, delay * 1.5, url);
            }
        }
    };

    // ====================================================
    // MODULE: Post Actions Management
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
        /**
         * Initialize post actions
         */
        initPostActions: () => {
            state.postActionsInitialized = true;
            if (!Utils.isPostPage() || state.currentPostUrl === window.location.href) return;
            PostActions.cleanupPostActions();
    
            const currentPageUrl = window.location.href;
    
            document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img')
                .forEach((img) => (img.className = CSS_CLASSES.POST_IMAGE));
            document.querySelectorAll(SELECTORS.ATTACHMENT_LINK)
                .forEach((link) => (link.dataset.fileName = link.getAttribute('download')));
    
            elements.postActions = document.querySelector(SELECTORS.POST_ACTIONS);
            if (!elements.postActions) return;
    
            const hasMediaContent = document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;
    
            if (hasMediaContent) {
                if (!elements.statusContainer) {
                    const {
                        container: statusContainer,
                        element: statusElement
                    } = UI.createStatusElement();
                    elements.statusContainer = statusContainer;
                    elements.statusElement = statusElement;
                    elements.postActions.appendChild(elements.statusContainer);
                }
    
                if (!elements.postActions.querySelector(`.${CSS_CLASSES.UG_BUTTON}`)) {
                    const downloadAllButton = UI.createToggleButton(BUTTONS.DOWNLOAD_ALL, DownloadManager.downloadAllImages);
                    const galleryButton = UI.createToggleButton('Loading Gallery...', Gallery.toggleGallery, true);
                    elements.galleryButton = galleryButton;
    
                    const heightButton = UI.createToggleButton(BUTTONS.HEIGHT, () => PostActions.clickAllImageButtons('height'));
                    const widthButton = UI.createToggleButton(BUTTONS.WIDTH, () => PostActions.clickAllImageButtons('width'));
                    const fullButton = UI.createToggleButton(BUTTONS.FULL, () => PostActions.clickAllImageButtons('full'));
    
                    elements.postActions.append(heightButton, widthButton, fullButton, downloadAllButton, galleryButton);
                    elements.galleryButton.style.display = 'inline-block';
                }
            }
    
            if (!elements.settingsButton) {
                const settingsButton = document.createElement('button');
                settingsButton.textContent = BUTTONS.SETTINGS;
                settingsButton.className = CSS_CLASSES.SETTINGS_BUTTON;
                settingsButton.addEventListener('click', () => {
                    state.settingsOpen = !state.settingsOpen;
                });
                document.body.appendChild(settingsButton);
                elements.settingsButton = settingsButton;
            }
    
            const fileDivs = document.querySelectorAll(SELECTORS.FILE_DIVS);
            const parentDiv = fileDivs[0]?.parentNode;
    
            if (parentDiv) {
                state.displayedImages = Array.from(document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img'));
    
                const existingButtonGroups = Array.from(parentDiv.querySelectorAll(`.${CSS_CLASSES.UG_BUTTON_CONTAINER}`));
                existingButtonGroups.forEach(buttonGroup => {
                    const imageContainer = buttonGroup.nextElementSibling;
                    if (!imageContainer || !state.displayedImages.some(img => img.closest(SELECTORS.THUMBNAIL) === imageContainer)) {
                        buttonGroup.remove();
                    }
                });
    
                state.displayedImages.forEach((img, index) => {
                    const downloadLink = img.closest(SELECTORS.THUMBNAIL)?.querySelector(SELECTORS.IMAGE_LINK);
                    if (!downloadLink) return;
    
                    const removeImage = (evt) => {
                        const buttonContainer = evt.currentTarget.closest('div');
                        const imageContainer = buttonContainer?.nextElementSibling;
                        if (!imageContainer || !imageContainer.parentNode) return;
    
                        imageContainer.parentNode.removeChild(imageContainer);
                        buttonContainer.parentNode.removeChild(buttonContainer);
    
                        state.virtualGallery.splice(index, 1);
                        state.originalImageSrcs.splice(index, 1);
                        state.totalImages--;
                        state.displayedImages.splice(index, 1);
                        state.notification = `Images Done Loading! Total: ${state.totalImages}`;
                        state.notificationType = 'success';
                    };
    
                    if (!img.closest(SELECTORS.THUMBNAIL).previousElementSibling?.classList.contains(CSS_CLASSES.UG_BUTTON_CONTAINER)) {
                        const newDiv = UI.createButtonGroup([{
                                text: BUTTONS.HEIGHT,
                                action: PostActions.resizeImage
                            },
                            {
                                text: BUTTONS.WIDTH,
                                action: PostActions.resizeImage
                            },
                            {
                                text: BUTTONS.FULL,
                                action: () => ImageLoader.imageActions.full(img),
                                name: 'FULL'
                            },
                            {
                                text: BUTTONS.DOWNLOAD,
                                action: () => DownloadManager.downloadImageByIndex(index),
                                name: 'DOWNLOAD'
                            },
                            {
                                text: BUTTONS.REMOVE,
                                action: removeImage,
                                name: 'REMOVE'
                            }
                        ]);
    
                        const thumbnail = img.closest(SELECTORS.THUMBNAIL);
                        if (thumbnail && thumbnail.parentNode) {
                            thumbnail.parentNode.insertBefore(newDiv, thumbnail);
                        }
                    }
                    img.addEventListener('click', () => Gallery.toggleGallery());
                });
    
                parentDiv.addEventListener('click', PostActions.delegatedImageClickHandler);
    
                const favoriteButton = document.querySelector(SELECTORS.FAVORITE_BUTTON);
                if (favoriteButton) {
                    const newDiv = UI.createButtonGroup([{
                            text: BUTTONS.HEIGHT,
                            action: () => PostActions.resizeAllImages('height')
                        },
                        {
                            text: BUTTONS.WIDTH,
                            action: () => PostActions.resizeAllImages('width')
                        },
                        {
                            text: BUTTONS.FULL,
                            action: () => PostActions.resizeAllImages('full')
                        }
                    ]);
                    if (!favoriteButton.nextElementSibling?.classList.contains(CSS_CLASSES.UG_BUTTON_CONTAINER)) {
                        favoriteButton.parentNode.insertBefore(newDiv, favoriteButton.nextSibling);
                    }
                }
            }
            state.currentPostUrl = currentPageUrl;
        },
        
        /**
         * Clean up post actions
         */
        cleanupPostActions: () => {
            if (elements.postActions) {
                elements.postActions.querySelectorAll(`.${CSS_CLASSES.UG_BUTTON}`).forEach(button => button.remove());
            }
    
            if (elements.settingsButton) {
                elements.settingsButton.remove();
                elements.settingsButton = null;
            }
    
            const parentDiv = document.querySelector(website === 'nekohouse' ? '.scrape__thumbnails' : '.post__thumbnails');
            if (parentDiv) {
                parentDiv.removeEventListener('click', PostActions.delegatedImageClickHandler);
            }
    
            if (elements.statusContainer) {
                elements.statusContainer.remove();
                elements.statusContainer = null;
                elements.statusElement = null;
            }
    
            elements.postActions = null;
        },
        
        /**
         * Click all buttons of a specific type
         * @param {string} action - Button action name
         */
        clickAllImageButtons: (action) => {
            const fileDivs = document.querySelectorAll(SELECTORS.FILE_DIVS);
            const parentDiv = fileDivs[0]?.parentNode;
            if (!parentDiv) return;
            state.displayedImages.forEach((img) => {
                const buttonGroup = img.closest(SELECTORS.THUMBNAIL)?.previousElementSibling;
                if (buttonGroup) {
                    const button = Array.from(buttonGroup.querySelectorAll(`.${CSS_CLASSES.UG_BUTTON}`)).find(button => button.textContent === BUTTONS[action.toUpperCase()]);
                    if (button) {
                        button.click();
                    }
                }
            });
        },
        
        /**
         * Resize all images
         * @param {string} action - Resize action
         */
        resizeAllImages: (action) => {
            document
                .querySelectorAll(SELECTORS.FILES_IMG)
                .forEach((img) => {
                    if (ImageLoader.imageActions[action]) {
                        ImageLoader.imageActions[action](img);
                    }
                });
        },
        
        /**
         * Resize single image
         * @param {Event} evt - Click event
         */
        resizeImage: (evt) => {
            const action = Object.keys(BUTTONS)
                .find((key) => BUTTONS[key] === evt.currentTarget.textContent)
                ?.toLowerCase();
            const buttonContainer = evt.currentTarget.closest('div');
            const imageContainer = buttonContainer?.nextElementSibling;
            const displayedImage = imageContainer?.querySelector('img');
    
            if (displayedImage && ImageLoader.imageActions[action]) {
                ImageLoader.imageActions[action](displayedImage);
            }
        },
        
        /**
         * Handle delegated image click
         * @param {Event} event - Click event
         */
        delegatedImageClickHandler: (event) => {
            const clickedImage = event.target.closest(SELECTORS.IMAGE_LINK + ' img');
            if (clickedImage) {
                const index = Array.from(
                    document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img')
                ).indexOf(clickedImage);
                if (index !== -1) {
                    Gallery.toggleGallery();
                }
            }
        }
    };

    // ====================================================
    // MODULE: Event Handlers
    // ====================================================
    
    const EventHandlers = {
        /**
         * Handle gallery keyboard shortcuts
         * @param {KeyboardEvent} event - Keyboard event
         */
        handleGalleryKey: (event) => {
            if (!Utils.isPostPage()) return;
    
            if (event.key === state.galleryKey && state.galleryReady) {
                Gallery.toggleGallery();
            } else if (state.isGalleryMode && !galleryOverlay.querySelector(`.${CSS_CLASSES.UG_GALLERY_GRID_VIEW}`).classList.contains(CSS_CLASSES.UG_GALLERY_HIDE)) {
                return;
            } else if (state.isGalleryMode) {
                if (['Escape', state.prevImageKey, state.nextImageKey, 'ArrowLeft', 'ArrowRight', 'k', 'l', '+', '-', '0'].includes(event.key)) {
                    event.preventDefault();
                    switch (event.key) {
                        case 'Escape':
                            Gallery.showGridView();
                            break;
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
                        case '+': // Zoom in
                            Zoom.zoom(CONFIG.ZOOM_STEP);
                            break;
                        case '-': // Zoom out
                            Zoom.zoom(-CONFIG.ZOOM_STEP);
                            break;
                        case '0': // Reset zoom
                            Zoom.resetZoom();
                            break;
                    }
                }
            }
        },
        
        /**
         * Handle settings keyboard shortcuts
         * @param {KeyboardEvent} event - Keyboard event
         */
        handleSettingsKey: (event) => {
            if (state.settingsOpen && event.key === 'Escape') {
                state.settingsOpen = false;
            }
        },
        
        /**
         * Handle window resize with proper debouncing
         */
        handleWindowResize: Utils.debounce(() => {
            if (!galleryOverlay) return;
            const mainImageContainer = galleryOverlay.querySelector(`.${CSS_CLASSES.UG_MAIN_IMAGE_CONTAINER}`);
            if (!mainImageContainer) return;
            
            const newWidth = mainImageContainer.offsetWidth;
            const newHeight = mainImageContainer.offsetHeight;
    
            if (newWidth !== state.lastWidth || newHeight !== state.lastHeight) {
                state.lastWidth = newWidth;
                state.lastHeight = newHeight;
                Zoom.resetZoom();
                Zoom.applyZoom();
            }
        }, CONFIG.DEBOUNCE_DELAY),
        
        /**
         * Toggle controls visibility
         */
        toggleControlsVisibility: () => {
            state.controlsVisible = !state.controlsVisible;
        }
    };

    // ====================================================
    // MODULE: UI Injection
    // ====================================================
    
    /**
     * Update gallery button state
     * @param {boolean} enabled - Whether button should be enabled
     */
    const updateGalleryButton = (enabled) => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = enabled ? BUTTONS.GALLERY : 'Loading Gallery...';
            elements.galleryButton.disabled = !enabled;
            elements.galleryButton.classList.toggle('disabled', !enabled);
        }
    };
    
    /**
     * Inject UI elements into the page
     */
    const injectUI = () => {
        if (!Utils.isPostPage()) {
            state.postActionsInitialized = false;
            state.notification = null;
            state.notificationType = 'info';
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
            state.galleryReady = false;
            state.loadedImages = 0;
            state.hasImages = false;
            state.totalImages = currentTotalImages;
    
            const hasMediaContent = document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;
            if (hasMediaContent) {
                if (!elements.statusContainer) {
                    const {
                        container: statusContainer,
                        element: statusElement
                    } = UI.createStatusElement();
                    elements.statusContainer = statusContainer;
                    elements.statusElement = statusElement;
                    const actionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);
                    if (actionsContainer) {
                        actionsContainer.appendChild(elements.statusContainer);
                    }
                }
                state.notification = `Loading media (${state.loadedImages}/${state.totalImages})...`;
            }
            ImageLoader.loadImages();
            PostActions.initPostActions();
            state.currentPostUrl = currentPageUrl;
            previousPageUrl = currentPageUrl;
        } else if (currentPageUrl !== state.currentPostUrl) {
            PostActions.cleanupPostActions();
            state.totalImages = currentTotalImages;
            state.galleryReady = false;
            state.loadedImages = 0;
            state.hasImages = false;
            state.notification = null;
            state.notificationType = 'info';
            state.loadingMessage = null;
            state.isLoading = false;
    
            const hasMediaContent = document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;
            if (hasMediaContent) {
                if (!elements.statusContainer) {
                    const {
                        container: statusContainer,
                        element: statusElement
                    } = UI.createStatusElement();
                    elements.statusContainer = statusContainer;
                    elements.statusElement = statusElement;
                    const actionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);
                    if (actionsContainer) {
                        actionsContainer.appendChild(elements.statusContainer);
                    }
                }
                state.notification = `Loading media (${state.loadedImages}/${state.totalImages})...`;
            } else {
                if (elements.statusContainer) {
                    elements.statusContainer.remove();
                    elements.statusContainer = null;
                    elements.statusElement = null;
                }
            }
            ImageLoader.loadImages();
            PostActions.initPostActions();
            state.currentPostUrl = currentPageUrl;
            previousPageUrl = currentPageUrl;
        }
    };
    
    /**
     * Initialize the script
     */
    const init = () => {
        // Load CSS
        GM.xmlHttpRequest({
            method: 'GET',
            url: 'https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/TestingBranch/Ultra-Galleries.css',
            onload: function(response) {
                if (response.status === 200) {
                    GM_addStyle(response.responseText);
                } else {
                    console.error('Error loading CSS:', response.status, response.statusText);
                }
            },
            onerror: function(error) {
                console.error('Error loading CSS:', error);
            },
        });
        
        // Load saved settings
        CONFIG.MAX_SCALE = GM_getValue('maxZoomScale', CONFIG.MAX_SCALE);
        state.inertiaEnabled = GM_getValue('inertiaEnabled', true);
        
        // Attach event listeners
        if (!galleryKeyListenerAttached) {
            window.addEventListener('keydown', EventHandlers.handleGalleryKey);
            window.addEventListener('keydown', EventHandlers.handleSettingsKey);
            galleryKeyListenerAttached = true;
        }
        
        if (!document.getElementById(CSS_CLASSES.NOTIFICATION_AREA) && state.notificationAreaVisible) {
            UI.createNotificationArea();
        }
    
        window.addEventListener('resize', EventHandlers.handleWindowResize);
    
        // Set up mutation observer to watch for DOM changes
        const targetNode = document.body;
        const config = {
            childList: true,
            subtree: true
        };
    
        const observer = new MutationObserver(injectUI);
        observer.observe(targetNode, config);
    
        // Initial UI state
        if (Utils.isPostPage()) {
            if (state.loadedImages === state.totalImages && state.totalImages > 0) {
                state.notification = `Images Done Loading! Total: ${state.totalImages}`;
                state.notificationType = 'success';
            } else if (state.notificationType === 'error') {
                state.notification = 'Error loading some media.';
            }
        } else {
            state.notification = null;
            state.notificationType = 'info';
            state.loadingMessage = null;
            state.isLoading = false;
            state.galleryReady = false;
        }
    };

    // Initialize the script
    init();
})();