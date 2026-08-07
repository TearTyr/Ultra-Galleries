// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1477603-%E3%83%A1%E3%83%AA%E3%83%BC
// @version      3.6.6 
// @description  Modern image gallery with highly efficient background zipping, video playback, browsing, fullscreen, and download features. Optimized, cleaned, and added Pawchive support.
// @author       ntf (original), Meri/TearTyr (maintained)
// @match        *://kemono.su/*
// @match        *://*.kemono.su/*
// @match        *://coomer.su/*
// @match        *://*.coomer.su/*
// @match        *://kemono.cr/*
// @match        *://*.kemono.cr/*
// @match        *://coomer.cr/*
// @match        *://*.coomer.cr/*
// @match        *://coomer.st/*
// @match        *://*.coomer.st/*
// @match        *://nekohouse.su/*
// @match        *://*.nekohouse.su/*
// @match        *://pawchive.st/*
// @match        *://*.pawchive.st/*
// @match        *://pawchive.pw/*
// @match        *://*.pawchive.pw/*
// @icon         https://pawchive.pw/static/menu/recent.svg
// @connect      *
// @connect      kemono.su
// @connect      coomer.su
// @connect      pawchive.pw
// @grant        GM_download
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getResourceText
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://unpkg.com/jszip@3.10.1/dist/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @require      https://unpkg.com/dexie@4.0.8/dist/dexie.min.js
// @resource     mainCSS https://cdn.jsdelivr.net/gh/TearTyr/Ultra-Galleries@TestingBranch/Ultra-Galleries.css
// @downloadURL  https://update.sleazyfork.org/scripts/537986/Ultra%20Galleries.user.js
// @updateURL    https://update.sleazyfork.org/scripts/537986/Ultra%20Galleries.meta.js
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    // ====================================================
    // Core Configuration
    // ====================================================
    const CONFIG = {
        MAX_CONCURRENT_FETCHES: 3,
        MAX_RETRIES: 5,
        RETRY_DELAY: 2000,
        MIN_SCALE: 0.05,
        MAX_SCALE: 5,
        ZOOM_STEP: 0.2,
        DEBOUNCE_DELAY: 250,
        PAN_RESISTANCE: 0.8,
        DOUBLE_TAP_THRESHOLD: 300,
        CACHE_EVICTION_COUNT: 20,
        PRELOAD_COUNT: 2,
        SCROLL_SIMULATION_BASE_TIMEOUT: 3000,
        SLIDESHOW_DELAY: 3000,
        CONTROLS_HIDE_DELAY: 3000,
        CONTEXT_MENU_HIDE_DELAY: 200,
        PRELOAD_WINDOW_BUFFER: 4,
        PROGRESS_NOTIFY_INTERVAL: 250
    };

    const BUTTONS = {
        DOWNLOAD: '【DOWNLOAD】',
        DOWNLOAD_ALL: '【DL ALL】',
        FULL: '【FULL】',
        HEIGHT: '【FILL HEIGHT】',
        WIDTH: '【FILL WIDTH】',
        GALLERY: '【GALLERY】',
        SETTINGS: '⚙️',
        FULLSCREEN: '⛶',
        CLOSE: '✕'
    };

    const CSS = {
        BTN: 'ug-button',
        BTN_CONTAINER: 'ug-button-container',
        NOTIF_AREA: 'ug-notification-area',
        NOTIF_CONTAINER: 'ug-notification-container',
        NOTIF_TEXT: 'ug-notification-text',
        NOTIF_CLOSE: 'ug-notification-close',
        NOTIF_REPORT: 'ug-notification-report',
        SETTINGS_BTN: 'settings-button',
        LONG_PRESS: 'ug-long-press',
        GALLERY: {
            OVERLAY: 'ug-gallery-overlay',
            CONTAINER: 'ug-gallery-container',
            EXPANDED_VIEW: 'ug-gallery-expanded-view',
            HIDE: 'ug-gallery-hide',
            TOOLBAR: 'ug-gallery-toolbar',
            ZOOM_CONTAINER: 'ug-gallery-zoom-container',
            MAIN_IMG_CONTAINER: 'ug-main-image-container',
            MAIN_IMG: 'ug-main-image',
            MAIN_VIDEO: 'ug-main-video',
            THUMBNAIL: 'ug-thumbnail',
            THUMBNAIL_WRAPPER: 'ug-thumbnail-container',
            THUMBNAIL_STRIP: 'ug-thumbnail-strip',
            NAV: 'ug-gallery-nav',
            NAV_CONTAINER: 'ug-gallery-nav-container',
            PREV: 'ug-gallery-prev',
            NEXT: 'ug-gallery-next',
            COUNTER: 'ug-gallery-counter',
            FULLSCREEN: 'ug-gallery-fullscreen',
            FULLSCREEN_OVERLAY: 'ug-fullscreen-overlay',
            STRIP_CONTAINER: 'ug-gallery-thumbnail-strip-container',
            TOOLBAR_BTN: 'ug-toolbar-button',
            CONTROLS_HIDDEN: 'ug-controls-hidden',
            GRABBING: 'ug-grabbing',
            ZOOMED: 'zoomed',
            IS_TRANSITIONING: 'is-transitioning',
            IMAGE_ERROR_MSG: 'ug-image-error-message'
        }
    };

    const isNekohouse = window.location.hostname.includes('nekohouse');

    const SELECTORS = {
        IMAGE_LINK: isNekohouse ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link',
        GENERIC_IMAGE_LINK: 'a[href*=".jpg"], a[href*=".png"], a[href*=".gif"], a[href*=".webp"], a[href*=".jpeg"]',
        ATTACHMENT_LINK: isNekohouse ? '.scrape__attachment-link' : '.post__attachment-link',
        POST_TITLE: isNekohouse ? '.scrape__title' : '.post__title',
        POST_USER_NAME: isNekohouse ? '.scrape__user-name' : '.post__user-name',
        MAIN_THUMBNAIL: isNekohouse ? '.scrape__thumbnail:not(.scrape__thumbnail--attachment)' : '.post__thumbnail:not(.post__thumbnail--attachment)',
        POST_ACTIONS: isNekohouse ? '.scrape__actions' : '.post__actions',
        FILE_DIVS: isNekohouse ? '.scrape__thumbnail' : '.post__thumbnail',
        VIDEO_LINK: 'a.fileThumb[href$=".mp4"], a.fileThumb[href$=".webm"], a.fileThumb[href$=".mov"], a[href$=".mp4"], a[href$=".webm"], a[href$=".mov"]',
        VIDEO_THUMBNAIL: isNekohouse ? '.scrape__video-thumbnail' : '.post__video-thumbnail'
    };

    // ====================================================
    // Shared mutable references
    // Declared early so state callbacks never hit TDZ issues.
    // ====================================================
    let db = null;
    let galleryOverlay = null;
    let loadedBlobUrls = new Map();
    let elements = {
        galleryButton: null,
        settingsButton: null
    };
    let lastFocusedElement = null;
    let focusTrapListener = null;
    let uiObserver = null;
    let lastProcessedUrl = null;

    // ====================================================
    // High-Frequency View State
    // Decoupled from reactive Proxy for performance.
    // ====================================================
    const viewState = {
        zoomScale: 1,
        imageOffset: { x: 0, y: 0 },
        zoomOrigin: { x: 0, y: 0 },
        initialScale: 1,
        pinchZoomActive: false,
        initialTouchDistance: 0,
        dragStartPosition: { x: 0, y: 0 },
        dragStartOffset: { x: 0, y: 0 }
    };

    // ====================================================
    // Utility Functions
    // ====================================================
    const Utils = {
        sanitizeFileName: name => String(name || '').replace(/[/\\:*?"<>|]/g, '-'),

        getPostDate: (type = 'published') => {
            let selector;
            if (type === 'edited') selector = '.post__edited, .scrape__edited';
            else if (type === 'added' || type === 'imported') selector = '.post__added, .scrape__added';
            else selector = '.post__published, .scrape__published, time[datetime]';

            const timeEl = document.querySelector(selector);
            if (timeEl) {
                const dateStr = timeEl.getAttribute('datetime') || timeEl.textContent;
                if (dateStr) {
                    const match = dateStr.match(/\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?|\d{4}-\d{2}/);
                    if (match && match[0]) {
                        return Utils.sanitizeFileName(match[0].replace(/[ T]/g, '_').replace(/:/g, '-'));
                    }
                    return Utils.sanitizeFileName(dateStr.replace(/.*?:\s*/, '').trim());
                }
            }

            return 'UnknownDate';
        },

        setImageStyle: (img, styles) => {
            if (!img) return;
            for (const key in styles) {
                const kebabKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                img.style.setProperty(kebabKey, styles[key], 'important');
            }
        },

        isPostPage: () => {
            const hasImages =
                document.querySelector(SELECTORS.IMAGE_LINK) ||
                document.querySelector(SELECTORS.GENERIC_IMAGE_LINK) ||
                document.querySelector('div.post__files');

            if (hasImages) return true;

            const path = window.location.pathname;
            const patterns = [
                /\/user\/.*\/post\//,
                /\/server\/.*\/channel\//,
                /\/post\//
            ];

            return patterns.some(pattern => pattern.test(path));
        },

        delay: ms => new Promise(resolve => setTimeout(resolve, ms)),

        debounce: (func, wait) => {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        throttle: (func, limit) => {
            let lastRan;
            let lastFunc;

            return function (...args) {
                if (!lastRan) {
                    func.apply(this, args);
                    lastRan = Date.now();
                } else {
                    clearTimeout(lastFunc);
                    lastFunc = setTimeout(() => {
                        if ((Date.now() - lastRan) >= limit) {
                            func.apply(this, args);
                            lastRan = Date.now();
                        }
                    }, limit - (Date.now() - lastRan));
                }
            };
        },

        handleMediaSrc: mediaLink => {
            let href = mediaLink.getAttribute('href') || mediaLink.querySelector('.fileThumb')?.getAttribute('href');

            if (!href && mediaLink.href) href = mediaLink.href;

            if (href) {
                href = href.split('?')[0];
                if (href.includes('/thumbnail/')) {
                    href = href.replace(/\/thumbnail\//, '/data/');
                }
                return href;
            }

            const directImg = mediaLink.querySelector('img');
            if (directImg) {
                const rawSrc = directImg.getAttribute('data-src') || directImg.src;
                if (!rawSrc) return null;

                const imgSrc = rawSrc.split('?')[0];
                if (imgSrc.includes('/data/')) return imgSrc;
                if (imgSrc.includes('/thumbnail/')) {
                    return imgSrc.replace(/\/thumbnail\//, '/data/');
                }

                return imgSrc;
            }

            return null;
        },

        createTooltip: (text, duration = 3000) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'zoom-tooltip';
            tooltip.textContent = text;

            setTimeout(() => {
                tooltip.style.opacity = '0';
                setTimeout(() => tooltip.remove(), 500);
            }, duration);

            return tooltip;
        },

        getDistance: (touch1, touch2) => Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY),

        getMidpoint: (touch1, touch2) => ({
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        }),

        ensureThumbnailsExist: () => {
            try {
                const videoLinks = document.querySelectorAll(SELECTORS.VIDEO_LINK);

                videoLinks.forEach(videoLink => {
                    const videoThumb = videoLink.closest(SELECTORS.VIDEO_THUMBNAIL);

                    if (!videoThumb) {
                        const video = videoLink.querySelector('video');

                        if (video && video.hasAttribute('poster')) {
                            const posterUrl = video.getAttribute('poster');

                            if (videoLink.parentNode) {
                                const thumbnailContainer = document.createElement('div');
                                thumbnailContainer.className = isNekohouse ? 'scrape__video-thumbnail' : 'post__video-thumbnail';

                                const thumbnailImg = document.createElement('img');
                                thumbnailImg.src = posterUrl;
                                thumbnailImg.className = isNekohouse ? 'scrape__thumbnail-img' : 'post__thumbnail-img';

                                thumbnailContainer.appendChild(thumbnailImg);
                                videoLink.parentNode.insertBefore(thumbnailContainer, videoLink);
                            }
                        }
                    }
                });
            } catch (error) {
                console.warn('Minor error ensuring thumbnails:', error);
            }
        }
    };

    // ====================================================
    // Throttled load-progress notifier
    // ====================================================
    const notifyLoadProgress = Utils.throttle((message, type = 'info') => {
        state.notificationType = type;
        state.notification = message;
    }, CONFIG.PROGRESS_NOTIFY_INTERVAL);

    // ====================================================
    // Gallery Image Sizing Module
    // ====================================================
    const ImageSizing = {
        applyBestFit: (el) => {
            if (!el) return;

            Utils.setImageStyle(el, {
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                margin: '0'
            });
        },

        applyFillHeight: (el) => {
            if (!el) return;

            Utils.setImageStyle(el, {
                maxHeight: '90vh',
                maxWidth: '100%',
                width: 'auto',
                height: '90vh',
                objectFit: 'contain'
            });
        },

        applyFillWidth: (el) => {
            if (!el) return;

            Utils.setImageStyle(el, {
                maxHeight: 'none',
                maxWidth: '100vw',
                width: '100%',
                height: 'auto',
                objectFit: 'contain'
            });
        },

        applyFullSize: (el) => {
            if (!el) return;

            Utils.setImageStyle(el, {
                maxHeight: 'none',
                maxWidth: 'none',
                height: 'auto',
                width: 'auto',
                objectFit: 'none'
            });
        }
    };

    // ====================================================
    // Zoom Boundary Helpers
    // ====================================================
    const ZoomHelper = {
        calculateBoundaryOffsets: (offsetX, offsetY, scale, containerRect, imageDOM) => {
            if (!imageDOM || !containerRect) return { x: offsetX, y: offsetY };

            const natW = imageDOM.naturalWidth || imageDOM.videoWidth || 0;
            const natH = imageDOM.naturalHeight || imageDOM.videoHeight || 0;
            const imgWidth = natW * scale;
            const imgHeight = natH * scale;
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;

            if (imgWidth > containerWidth) {
                const minX = containerWidth - imgWidth;
                const maxX = 0;

                if (offsetX > maxX) offsetX = maxX + ((offsetX - maxX) * CONFIG.PAN_RESISTANCE / scale);
                else if (offsetX < minX) offsetX = minX - ((minX - offsetX) * CONFIG.PAN_RESISTANCE / scale);
            }

            if (imgHeight > containerHeight) {
                const minY = containerHeight - imgHeight;
                const maxY = 0;

                if (offsetY > maxY) offsetY = maxY + ((offsetY - maxY) * CONFIG.PAN_RESISTANCE / scale);
                else if (offsetY < minY) offsetY = minY - ((minY - offsetY) * CONFIG.PAN_RESISTANCE / scale);
            }

            return { x: offsetX, y: offsetY };
        },

        calculateHardBoundaryOffsets: (offsetX, offsetY, scale, containerRect, imageDOM) => {
            if (!imageDOM || !containerRect) return { x: offsetX, y: offsetY };

            const natW = imageDOM.naturalWidth || imageDOM.videoWidth || 0;
            const natH = imageDOM.naturalHeight || imageDOM.videoHeight || 0;
            const imgWidth = natW * scale;
            const imgHeight = natH * scale;

            let x = offsetX;
            let y = offsetY;

            if (imgWidth > containerRect.width) {
                const minX = containerRect.width - imgWidth;
                x = Math.max(minX, Math.min(x, 0));
            } else {
                x = 0;
            }

            if (imgHeight > containerRect.height) {
                const minY = containerRect.height - imgHeight;
                y = Math.max(minY, Math.min(y, 0));
            } else {
                y = 0;
            }

            return { x, y };
        }
    };

    // ====================================================
    // Drag Handler Module
    // ====================================================
    const DragHandler = {
        isDragging: false,
        dragStartTime: 0,
        lastUpdateTime: 0,
        velocity: { x: 0, y: 0 },
        lastPosition: { x: 0, y: 0 },
        animationFrame: null,
        inertiaAnimation: null,
        cachedImgEl: null,
        cachedZoomEl: null,

        startDrag: (event) => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            if (event.button === 2 && event.type === 'mousedown') return;
            if (event.preventDefault) event.preventDefault();

            DragHandler.isDragging = true;
            DragHandler.dragStartTime = performance.now();
            DragHandler.lastUpdateTime = DragHandler.dragStartTime;

            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);

            viewState.dragStartPosition = { x: clientX, y: clientY };
            viewState.dragStartOffset = { x: viewState.imageOffset.x, y: viewState.imageOffset.y };
            DragHandler.lastPosition = { x: clientX, y: clientY };
            DragHandler.velocity = { x: 0, y: 0 };

            if (DragHandler.inertiaAnimation) {
                cancelAnimationFrame(DragHandler.inertiaAnimation);
                DragHandler.inertiaAnimation = null;
            }

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if ($container.length) {
                $container.addClass(CSS.GALLERY.GRABBING);
                $container.css('will-change', 'transform');
            }
        },

        dragImage: (event) => {
            if (!DragHandler.isDragging || !galleryOverlay || !galleryOverlay.length) return;

            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);
            if (clientX === undefined || clientY === undefined) return;

            const currentTime = performance.now();
            const deltaTime = currentTime - DragHandler.lastUpdateTime;

            if (deltaTime > 0) {
                DragHandler.velocity.x = (clientX - DragHandler.lastPosition.x) / deltaTime * 16;
                DragHandler.velocity.y = (clientY - DragHandler.lastPosition.y) / deltaTime * 16;
            }

            DragHandler.lastPosition = { x: clientX, y: clientY };
            DragHandler.lastUpdateTime = currentTime;

            const deltaX = clientX - viewState.dragStartPosition.x;
            const deltaY = clientY - viewState.dragStartPosition.y;

            viewState.imageOffset.x = viewState.dragStartOffset.x + deltaX;
            viewState.imageOffset.y = viewState.dragStartOffset.y + deltaY;

            if (!DragHandler.animationFrame) {
                DragHandler.animationFrame = requestAnimationFrame(DragHandler.updateTransform);
            }
        },

        updateTransform: () => {
            if (!DragHandler.cachedImgEl) {
                const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
                DragHandler.cachedImgEl = $container.find('img, video')[0];
                DragHandler.cachedZoomEl = document.getElementById('zoom-level');
            }

            if (DragHandler.cachedImgEl) {
                if (!DragHandler.cachedImgEl.style.transformOrigin) {
                    DragHandler.cachedImgEl.style.transformOrigin = '0 0';
                }

                DragHandler.cachedImgEl.style.transform =
                    `translate(${viewState.imageOffset.x}px, ${viewState.imageOffset.y}px) scale(${viewState.zoomScale})`;
            }

            if (DragHandler.cachedZoomEl) {
                DragHandler.cachedZoomEl.textContent = `${Math.round(viewState.zoomScale * 100)}%`;
            }

            DragHandler.animationFrame = null;
        },

        endDrag: () => {
            if (!DragHandler.isDragging || !galleryOverlay || !galleryOverlay.length) return;

            DragHandler.isDragging = false;

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if ($container.length) {
                $container.removeClass(CSS.GALLERY.GRABBING);
                setTimeout(() => $container.css('will-change', ''), 1000);
            }

            if (
                state.inertiaEnabled &&
                (Math.abs(DragHandler.velocity.x) > 0.5 || Math.abs(DragHandler.velocity.y) > 0.5)
            ) {
                DragHandler.applyInertia();
            } else {
                DragHandler.enforceBoundaries();
            }
        },

        applyInertia: () => {
            const friction = 0.95;
            const minVelocity = 0.5;

            const animate = () => {
                DragHandler.velocity.x *= friction;
                DragHandler.velocity.y *= friction;

                viewState.imageOffset.x += DragHandler.velocity.x;
                viewState.imageOffset.y += DragHandler.velocity.y;

                if (
                    Math.abs(DragHandler.velocity.x) < minVelocity &&
                    Math.abs(DragHandler.velocity.y) < minVelocity
                ) {
                    DragHandler.inertiaAnimation = null;
                    DragHandler.enforceBoundaries();
                    return;
                }

                DragHandler.updateTransform();
                DragHandler.inertiaAnimation = requestAnimationFrame(animate);
            };

            DragHandler.inertiaAnimation = requestAnimationFrame(animate);
        },

        enforceBoundaries: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0];
            const $mainImage = $container.find(`.${CSS.GALLERY.MAIN_IMG}`);
            if (!$mainImage.length) return;

            const imageDOM = $mainImage[0];
            const containerRect = containerDOM.getBoundingClientRect();

            const boundedOffset = ZoomHelper.calculateHardBoundaryOffsets(
                viewState.imageOffset.x,
                viewState.imageOffset.y,
                viewState.zoomScale,
                containerRect,
                imageDOM
            );

            if (boundedOffset.x !== viewState.imageOffset.x || boundedOffset.y !== viewState.imageOffset.y) {
                const duration = 300;
                const startX = viewState.imageOffset.x;
                const startY = viewState.imageOffset.y;
                const deltaX = boundedOffset.x - startX;
                const deltaY = boundedOffset.y - startY;
                const startTime = performance.now();

                const animateToBoundary = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const easeProgress = 1 - Math.pow(1 - progress, 3);

                    viewState.imageOffset.x = startX + deltaX * easeProgress;
                    viewState.imageOffset.y = startY + deltaY * easeProgress;

                    DragHandler.updateTransform();

                    if (progress < 1) {
                        requestAnimationFrame(animateToBoundary);
                    }
                };

                requestAnimationFrame(animateToBoundary);
            }
        },

        handleDoubleTap: (e) => {
            e.preventDefault();

            if (!galleryOverlay || !galleryOverlay.length) return;

            const touch = e.touches[0];
            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0];
            const rect = containerDOM.getBoundingClientRect();

            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            if (viewState.zoomScale > 1) {
                Zoom.resetZoom();
            } else {
                const newScale = 2.5;

                const imageX = (touchX - viewState.imageOffset.x) / viewState.zoomScale;
                const imageY = (touchY - viewState.imageOffset.y) / viewState.zoomScale;

                const newOffsetX = touchX - (imageX * newScale);
                const newOffsetY = touchY - (imageY * newScale);

                Zoom._applyTransition($container, () => {
                    viewState.imageOffset.x = newOffsetX;
                    viewState.imageOffset.y = newOffsetY;
                    viewState.zoomScale = newScale;
                    DragHandler.updateTransform();
                });
            }

            state.lastTapTime = 0;
        },

        handlePinchStart: (e) => {
            e.preventDefault();

            viewState.pinchZoomActive = true;
            viewState.initialTouchDistance = Utils.getDistance(e.touches[0], e.touches[1]);
            viewState.initialScale = viewState.zoomScale;

            const containerDOM = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`)[0];
            const rect = containerDOM.getBoundingClientRect();
            const midPoint = Utils.getMidpoint(e.touches[0], e.touches[1]);

            viewState.zoomOrigin = {
                x: midPoint.x - rect.left,
                y: midPoint.y - rect.top
            };
        },

        handlePinchMove: (e) => {
            e.preventDefault();

            const currentDistance = Utils.getDistance(e.touches[0], e.touches[1]);
            if (viewState.initialTouchDistance === 0) return;

            const scaleFactor = currentDistance / viewState.initialTouchDistance;
            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.initialScale * scaleFactor, CONFIG.MAX_SCALE));

            const imageX = (viewState.zoomOrigin.x - viewState.imageOffset.x) / viewState.zoomScale;
            const imageY = (viewState.zoomOrigin.y - viewState.imageOffset.y) / viewState.zoomScale;

            viewState.imageOffset.x = viewState.zoomOrigin.x - (imageX * newScale);
            viewState.imageOffset.y = viewState.zoomOrigin.y - (imageY * newScale);
            viewState.zoomScale = newScale;

            DragHandler.updateTransform();
        }
    };

    // ====================================================
    // Gallery Display Module
    // ====================================================
    const ImageActionHandler = {
        imageActions: {
            height: ImageSizing.applyFillHeight,
            width: ImageSizing.applyFillWidth,
            full: ImageSizing.applyFullSize
        },

        applyDefaultSizingToLoadedImages: () => {
            document.querySelectorAll('img.post__image.ug-image-loaded').forEach(img => {
                ImageLoader.imageActions[state.currentResizeMode](img);
            });
        }
    };

    const Slideshow = {
        interval: null,
        isActive: false,
        delay: CONFIG.SLIDESHOW_DELAY,
        pauseOnHover: true,

        init: () => {
            Slideshow.delay = SettingsManager.loadSetting('slideshowDelay', CONFIG.SLIDESHOW_DELAY);
            Slideshow.pauseOnHover = SettingsManager.loadSetting('slideshowPauseOnHover', true);
        },

        start: () => {
            if (Slideshow.isActive) return;
            Slideshow.isActive = true;
            state.isSlideshowActive = true;
            Slideshow.interval = setInterval(() => Gallery.nextImage(), Slideshow.delay);
            Slideshow.showIndicator();
            if (Slideshow.pauseOnHover && galleryOverlay && galleryOverlay.length) {
                galleryOverlay.on('mouseenter.slideshow', () => Slideshow.pause());
                galleryOverlay.on('mouseleave.slideshow', () => Slideshow.resume());
            }
            Slideshow.syncControls();
            Accessibility.announce('Slideshow started');
            state.notificationType = 'info';
            state.notification = 'Slideshow started';
        },

        stop: () => {
            if (!Slideshow.isActive) return;
            Slideshow.isActive = false;
            state.isSlideshowActive = false;
            if (Slideshow.interval) {
                clearInterval(Slideshow.interval);
                Slideshow.interval = null;
            }
            if (galleryOverlay && galleryOverlay.length) {
                Slideshow.hideIndicator();
                galleryOverlay.off('.slideshow');
            }
            Slideshow.syncControls();
            Accessibility.announce('Slideshow stopped');
            state.notificationType = 'info';
            state.notification = 'Slideshow stopped';
        },

        pause: () => {
            if (Slideshow.interval && Slideshow.isActive) {
                clearInterval(Slideshow.interval);
                Slideshow.interval = null;
                Slideshow.updateIndicator(true);
                Slideshow.syncControls();
            }
        },

        resume: () => {
            if (!Slideshow.interval && Slideshow.isActive) {
                Slideshow.interval = setInterval(() => Gallery.nextImage(), Slideshow.delay);
                Slideshow.updateIndicator(false);
                Slideshow.syncControls();
            }
        },

        toggle: () => Slideshow.isActive ? Slideshow.stop() : Slideshow.start(),

        handleButton: () => {
            if (!Slideshow.isActive) Slideshow.start();
            else if (Slideshow.interval) Slideshow.pause();
            else Slideshow.resume();
        },

        syncControls: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            const $btn = galleryOverlay.find('#slideshow-btn');
            if (!$btn.length) return;
            if (!Slideshow.isActive) {
                $btn.html('▶')
                    .attr('title', 'Start Slideshow (Space)')
                    .removeClass('slideshow-running slideshow-paused');
            } else if (Slideshow.interval) {
                $btn.html('❚❚')
                    .attr('title', 'Pause Slideshow')
                    .addClass('slideshow-running')
                    .removeClass('slideshow-paused');
            } else {
                $btn.html('▶')
                    .attr('title', 'Resume Slideshow')
                    .addClass('slideshow-paused')
                    .removeClass('slideshow-running');
            }
        },

        showIndicator: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            if (galleryOverlay.find('.ug-slideshow-indicator').length) return;
            const $indicator = $('<div>').addClass('ug-slideshow-indicator');
            $('<span>').addClass('ug-slideshow-icon').text('▶').appendTo($indicator);
            $('<span>').addClass('ug-slideshow-text').text('Slideshow').appendTo($indicator);
            $('<button>')
                .addClass('ug-slideshow-stop')
                .attr('title', 'Stop slideshow')
                .text('✕')
                .on('click', (e) => {
                    e.stopPropagation();
                    Slideshow.stop();
                })
                .appendTo($indicator);
            galleryOverlay.find('.ug-gallery-toolbar').append($indicator);
        },

        hideIndicator: () => {
            if (galleryOverlay && galleryOverlay.length) {
                galleryOverlay.find('.ug-slideshow-indicator').remove();
            }
        },

        updateIndicator: (isPaused) => {
            if (!galleryOverlay || !galleryOverlay.length) return;
            const $indicator = galleryOverlay.find('.ug-slideshow-indicator');
            const $icon = $indicator.find('.ug-slideshow-icon');
            if (isPaused) {
                $icon.text('❚❚');
                $indicator.addClass('paused');
            } else {
                $icon.text('▶');
                $indicator.removeClass('paused');
            }
        },

        setDelay: (delay) => {
            Slideshow.delay = delay;
            SettingsManager.saveSetting('slideshowDelay', delay);
            if (Slideshow.isActive) {
                Slideshow.stop();
                Slideshow.start();
            }
        }
    };

    const ErrorHandler = {
        retryAttempts: new Map(),

        handleImageError: async (error, url, element = null, context = {}) => {
            const retryCount = ErrorHandler.retryAttempts.get(url) || 0;
            console.error(`Image load error (${retryCount + 1}/${CONFIG.MAX_RETRIES}):`, error, url);

            if (retryCount < CONFIG.MAX_RETRIES) {
                ErrorHandler.retryAttempts.set(url, retryCount + 1);

                const delay = Math.pow(2, retryCount) * 1000;

                if (retryCount === 0) {
                    state.notificationType = 'warning';
                    state.notification = `Retrying failed image... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`;
                }

                setTimeout(async () => {
                    try {
                        if (element) element.classList.add('retrying');

                        const blob = await ImageLoader.fetchWithRetry(url, state.currentLoadSessionId);

                        if (blob && element) {
                            const blobUrl = BlobManager.createUrl(blob);

                            element.src = blobUrl;
                            element.classList.remove('error', 'retrying');

                            ErrorHandler.retryAttempts.delete(url);

                            state.notificationType = 'success';
                            state.notification = 'Image loaded successfully';
                        }
                    } catch (retryError) {
                        ErrorHandler.handleImageError(retryError, url, element, context);
                    }
                }, delay);
            } else {
                ErrorHandler.showErrorPlaceholder(element, url, context);
                ErrorHandler.retryAttempts.delete(url);

                state.notificationType = 'error';
                state.notification = `Failed to load image after ${CONFIG.MAX_RETRIES} attempts`;
            }
        },

        showErrorPlaceholder: (element, url, context) => {
            if (!element) return;

            const errorSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
            `;

            const errorContainer = document.createElement('div');
            errorContainer.className = 'ug-error-container';

            const errorIcon = document.createElement('div');
            errorIcon.className = 'ug-error-icon';
            errorIcon.innerHTML = errorSvg;

            const errorMsg = document.createElement('div');
            errorMsg.className = 'ug-error-message';
            errorMsg.textContent = 'Failed to load image';

            const retryBtn = document.createElement('button');
            retryBtn.className = 'ug-error-retry';
            retryBtn.textContent = 'Retry';
            retryBtn.title = 'Retry loading';

            errorContainer.append(errorIcon, errorMsg, retryBtn);

            if (element.parentNode) {
                element.parentNode.replaceChild(errorContainer, element);
            }

            retryBtn.addEventListener('click', () => {
                if (element.parentNode) {
                    errorContainer.parentNode.replaceChild(element, errorContainer);
                }

                element.classList.add('loading');
                ErrorHandler.retryAttempts.delete(url);

                ImageLoader.loadImageAndApplyToPage(
                    context.linkElement,
                    context.galleryIndex,
                    context.posterHref,
                    context.isUniqueForGallery,
                    state.currentLoadSessionId,
                    context.itemData
                );
            });
        },

        clearRetries: () => ErrorHandler.retryAttempts.clear()
    };

    const SettingsManager = {
        defaultSettings: {
            galleryKey: 'g',
            prevImageKey: 'k',
            nextImageKey: 'l',
            zoomEnabled: true,
            animationsEnabled: true,
            notificationsEnabled: true,
            notificationPosition: 'bottom',
            bottomStripeVisible: true,
            hideNavArrows: false,
            hideFullButton: false,
            hideDownloadButton: false,
            hideHeightButton: false,
            hideWidthButton: false,
            enablePersistentCaching: true,
            slideshowDelay: CONFIG.SLIDESHOW_DELAY,
            slideshowPauseOnHover: true,
            inertiaEnabled: true,
            maxZoomScale: 5,
            zipFileNameFormat: '{date_published}-{title}-{artistName}.zip',
            imageFileNameFormat: '{date_published}-{title}-{artistName}-{fileName}-{index}',
            autoLoadOriginals: true,
            downloadBtnText: '【DOWNLOAD】',
            downloadAllBtnText: '【DL ALL】',
            fullBtnText: '【FULL】',
            heightBtnText: '【FILL HEIGHT】',
            widthBtnText: '【FILL WIDTH】',
            galleryBtnText: '【GALLERY】',
            currentResizeMode: 'height'
        },

        saveSetting: (key, value) => {
            try {
                GM_setValue(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('Failed to save setting:', key, error);
                return false;
            }
        },

        loadSetting: (key, defaultValue = null) => {
            try {
                const value = GM_getValue(key);
                if (value === undefined) return defaultValue;

                try {
                    return JSON.parse(value);
                } catch (e) {
                    return value;
                }
            } catch (error) {
                console.error('Failed to load setting:', key, error);
                return defaultValue;
            }
        },

        loadAllSettings: () => {
            const settings = {};

            Object.keys(SettingsManager.defaultSettings).forEach(key => {
                settings[key] = SettingsManager.loadSetting(key, SettingsManager.defaultSettings[key]);
            });

            return settings;
        },

        saveAllSettings: (settings) => {
            let success = true;

            Object.keys(settings).forEach(key => {
                if (!SettingsManager.saveSetting(key, settings[key])) success = false;
            });

            return success;
        },

        resetToDefaults: () => SettingsManager.saveAllSettings(SettingsManager.defaultSettings),

        exportSettings: () => JSON.stringify(SettingsManager.loadAllSettings(), null, 2),

        sanitizeSetting: (key, value) => {
            const def = SettingsManager.defaultSettings[key];

            switch (key) {
                case 'slideshowDelay': {
                    const n = parseInt(value, 10);
                    return (Number.isFinite(n) && n >= 500) ? n : CONFIG.SLIDESHOW_DELAY;
                }

                case 'maxZoomScale': {
                    const n = parseFloat(value);
                    return (Number.isFinite(n) && n >= 1) ? n : 5;
                }

                case 'galleryKey':
                case 'prevImageKey':
                case 'nextImageKey':
                    return (typeof value === 'string' && value.length === 1) ? value : def;

                case 'notificationPosition':
                    return ['top', 'bottom'].includes(value) ? value : 'bottom';

                case 'zipFileNameFormat':
                case 'imageFileNameFormat':
                    return (typeof value === 'string' && value.trim()) ? value : def;

                default:
                    if (typeof def === 'boolean') return Boolean(value);
                    if (typeof def === 'string') return (typeof value === 'string') ? value : def;
                    return value;
            }
        },

        importSettings: (settingsJson) => {
            try {
                const settings = JSON.parse(settingsJson);
                const validatedSettings = {};

                Object.keys(SettingsManager.defaultSettings).forEach(key => {
                    const incoming = Object.prototype.hasOwnProperty.call(settings, key)
                        ? settings[key]
                        : SettingsManager.defaultSettings[key];

                    validatedSettings[key] = SettingsManager.sanitizeSetting(key, incoming);
                });

                if (SettingsManager.saveAllSettings(validatedSettings)) {
                    Object.assign(state, validatedSettings);

                    state.notificationType = 'success';
                    state.notification = 'Settings imported successfully';

                    return true;
                }
            } catch (error) {
                console.error('Failed to import settings:', error);

                state.notificationType = 'error';
                state.notification = 'Failed to import settings: Invalid format';
            }

            return false;
        }
    };

    const Accessibility = {
        init: () => {
            if (galleryOverlay && galleryOverlay.length) {
                galleryOverlay.attr({
                    role: 'dialog',
                    'aria-modal': 'true',
                    'aria-label': 'Image Gallery'
                });
            }

            if (!$('.ug-sr-only').length) {
                const $liveRegion = $('<div>').attr({
                    'aria-live': 'polite',
                    'aria-atomic': 'true',
                    'class': 'ug-sr-only'
                });

                $('body').append($liveRegion);
            }
        },

        announce: (message) => $('.ug-sr-only').text(message)
    };

    const BlobManager = {
        blobUrls: new Set(),

        createUrl: (blob) => {
            if (!blob) return '';

            const url = URL.createObjectURL(blob);
            BlobManager.blobUrls.add(url);

            return url;
        },

        revokeUrl: (url) => {
            if (typeof url === 'string' && url.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(url);
                    BlobManager.blobUrls.delete(url);
                } catch (e) {
                    // Ignore revoke errors.
                }
            }
        },

        revokeAll: () => {
            BlobManager.blobUrls.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    // Ignore revoke errors.
                }
            });

            BlobManager.blobUrls.clear();
        }
    };

    const StateManager = {
        generateSessionId: () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),

        withSessionCheck: (callback) => {
            return (value, oldValue) => {
                if (state.currentLoadSessionId === null) return;
                callback(value, oldValue);
            };
        },

        createReactiveState: (initialState, updateCallbacks = {}) => {
            return new Proxy(initialState, {
                set(target, key, value) {
                    const oldValue = target[key];
                    target[key] = value;

                    if (updateCallbacks[key]) {
                        try {
                            updateCallbacks[key](value, oldValue);
                        } catch (e) {
                            console.error(`Error in state callback for key "${key}":`, e);
                        }
                    }

                    return true;
                }
            });
        }
    };

    // ====================================================
    // Reactive State
    // ====================================================
    const state = StateManager.createReactiveState({
        zipFileNameFormat: SettingsManager.loadSetting('zipFileNameFormat', '{date_published}-{title}-{artistName}.zip'),
        imageFileNameFormat: SettingsManager.loadSetting('imageFileNameFormat', '{date_published}-{title}-{artistName}-{fileName}-{index}'),
        galleryKey: SettingsManager.loadSetting('galleryKey', 'g'),
        galleryReady: false,
        currentGalleryIndex: 0,
        currentResizeMode: SettingsManager.loadSetting('currentResizeMode', 'height'),
        isFullscreen: SettingsManager.loadSetting('isFullscreen', false),
        originalImageSrcs: [],
        fullSizeImageSrcs: [],
        totalImages: 0,
        loadedImages: 0,
        isLoading: false,
        isGalleryMode: false,
        isDownloading: false,
        errorCount: 0,
        currentLoadSessionId: null,
        notificationsEnabled: SettingsManager.loadSetting('notificationsEnabled', true),
        notificationPosition: SettingsManager.loadSetting('notificationPosition', 'bottom'),
        animationsEnabled: SettingsManager.loadSetting('animationsEnabled', true),
        enablePersistentCaching: SettingsManager.loadSetting('enablePersistentCaching', true),
        notification: null,
        notificationType: 'info',
        hideNavArrows: SettingsManager.loadSetting('hideNavArrows', false),
        hideFullButton: SettingsManager.loadSetting('hideFullButton', false),
        hideDownloadButton: SettingsManager.loadSetting('hideDownloadButton', false),
        hideHeightButton: SettingsManager.loadSetting('hideHeightButton', false),
        hideWidthButton: SettingsManager.loadSetting('hideWidthButton', false),
        settingsOpen: false,
        prevImageKey: SettingsManager.loadSetting('prevImageKey', 'k'),
        nextImageKey: SettingsManager.loadSetting('nextImageKey', 'l'),
        bottomStripeVisible: SettingsManager.loadSetting('bottomStripeVisible', true),
        zoomEnabled: SettingsManager.loadSetting('zoomEnabled', true),
        controlsVisible: true,
        isDragging: false,
        lastTapTime: 0,
        zoomIndicatorVisible: true,
        inertiaEnabled: SettingsManager.loadSetting('inertiaEnabled', true),
        isSlideshowActive: false,
        autoLoadOriginals: SettingsManager.loadSetting('autoLoadOriginals', true),
        downloadBtnText: SettingsManager.loadSetting('downloadBtnText', '【DOWNLOAD】'),
        downloadAllBtnText: SettingsManager.loadSetting('downloadAllBtnText', '【DL ALL】'),
        fullBtnText: SettingsManager.loadSetting('fullBtnText', '【FULL】'),
        heightBtnText: SettingsManager.loadSetting('heightBtnText', '【FILL HEIGHT】'),
        widthBtnText: SettingsManager.loadSetting('widthBtnText', '【FILL WIDTH】'),
        galleryBtnText: SettingsManager.loadSetting('galleryBtnText', '【GALLERY】'),
        slideshowDelay: SettingsManager.loadSetting('slideshowDelay', CONFIG.SLIDESHOW_DELAY),
        slideshowPauseOnHover: SettingsManager.loadSetting('slideshowPauseOnHover', true)
    }, {
        controlsVisible: (value) => {
            if (galleryOverlay && galleryOverlay.length) {
                const $toolbar = galleryOverlay.find(`.${CSS.GALLERY.TOOLBAR}`);
                const $expandedView = galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`);

                if ($toolbar.length) {
                    $toolbar.toggleClass(CSS.GALLERY.CONTROLS_HIDDEN, !value);
                }

                if ($expandedView.length) {
                    $expandedView.toggleClass(CSS.GALLERY.CONTROLS_HIDDEN, !value);
                }
            }
        },

        galleryReady: (value) => updateGalleryButton(value),

        loadedImages: StateManager.withSessionCheck((value) => {
            if (value === state.totalImages && state.totalImages > 0) {
                state.notificationType = 'success';
                state.notification = `Media Done Loading! Total: ${state.totalImages}`;
            } else if (state.totalImages > 0) {
                notifyLoadProgress(`Loading media (${value}/${state.totalImages})...`, 'info');
            }
        }),

        totalImages: StateManager.withSessionCheck((value) => {
            if (value > 0) {
                notifyLoadProgress(`Loading media (${state.loadedImages}/${value})...`, 'info');
            }
        }),

        notification: (value) => {
            if (value) UI.showNotification(value, state.notificationType);
            else UI.hideNotification();
        },

        notificationType: (value) => {
            const container = document.getElementById(CSS.NOTIF_CONTAINER);

            if (container && state.notification && container.style.display === 'flex') {
                container.classList.remove('info', 'success', 'error', 'warning');
                container.classList.add(value);
            }
        },

        settingsOpen: (value) => value ? UI.showSettings() : UI.closeSettings(),

        isFullscreen: (value) => {
            SettingsManager.saveSetting('isFullscreen', value);

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

        zoomEnabled: (value) => SettingsManager.saveSetting('zoomEnabled', value),

        animationsEnabled: (value) => {
            SettingsManager.saveSetting('animationsEnabled', value);
            document.body.classList.toggle('ug-animations-disabled', !value);
        },

        bottomStripeVisible: (value) => {
            SettingsManager.saveSetting('bottomStripeVisible', value);

            const overlayEl = galleryOverlay ? galleryOverlay[0] : null;
            if (overlayEl) {
                const stripContainer = overlayEl.querySelector(`.${CSS.GALLERY.STRIP_CONTAINER}`);
                if (stripContainer) stripContainer.style.display = value ? 'flex' : 'none';
            }
        },

        isDragging: (value) => {
            if (galleryOverlay && galleryOverlay.length) {
                const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
                if ($container.length) $container.toggleClass(CSS.GALLERY.GRABBING, value);
            }
        },

        notificationPosition: (value) => {
            SettingsManager.saveSetting('notificationPosition', value);

            const notifArea = document.getElementById(CSS.NOTIF_AREA);
            if (notifArea) {
                notifArea.style.top = value === 'top' ? '10px' : 'auto';
                notifArea.style.bottom = value === 'bottom' ? '10px' : 'auto';
            }
        },

        enablePersistentCaching: (value) => {
            SettingsManager.saveSetting('enablePersistentCaching', value);
            if (value && !db) initDexie();
        },

        currentResizeMode: (value) => SettingsManager.saveSetting('currentResizeMode', value)
    });

    function updateButtonLabels() {
        BUTTONS.DOWNLOAD = state.downloadBtnText || '【DOWNLOAD】';
        BUTTONS.DOWNLOAD_ALL = state.downloadAllBtnText || '【DL ALL】';
        BUTTONS.FULL = state.fullBtnText || '【FULL】';
        BUTTONS.HEIGHT = state.heightBtnText || '【FILL HEIGHT】';
        BUTTONS.WIDTH = state.widthBtnText || '【FILL WIDTH】';
        BUTTONS.GALLERY = state.galleryBtnText || '【GALLERY】';

        const labels = {
            DOWNLOAD: BUTTONS.DOWNLOAD,
            DOWNLOAD_ALL: BUTTONS.DOWNLOAD_ALL,
            FULL: BUTTONS.FULL,
            HEIGHT: BUTTONS.HEIGHT,
            WIDTH: BUTTONS.WIDTH,
            GALLERY: BUTTONS.GALLERY
        };

        document.querySelectorAll(`.${CSS.BTN}[data-action]`).forEach(btn => {
            const label = labels[btn.dataset.action];
            if (label) btn.textContent = label;
        });

        updateGalleryButton(state.galleryReady);
        PostActions.updateButtonVisibilityLight();
    }

    // ====================================================
    // Dexie Database (IndexedDB)
    // ====================================================
    function initDexie() {
        if (typeof Dexie === 'undefined') return false;

        db = new Dexie('UltraGalleriesCache');
        db.version(1).stores({
            imageCache: 'url, cachedAt, blob'
        });

        return true;
    }

    async function evictOldestCacheItems(count) {
        if (!db) return 0;

        try {
            const oldestItemKeys = await db.imageCache
                .orderBy('cachedAt')
                .limit(count)
                .primaryKeys();

            if (oldestItemKeys && oldestItemKeys.length > 0) {
                await db.imageCache.bulkDelete(oldestItemKeys);
                return oldestItemKeys.length;
            }

            return 0;
        } catch (e) {
            return 0;
        }
    }

    async function storeImageInDexie(url, blob) {
        if (!db) return;

        try {
            await db.imageCache.put({
                url,
                blob,
                cachedAt: Date.now()
            });
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                const evictedCount = await evictOldestCacheItems(CONFIG.CACHE_EVICTION_COUNT);

                if (evictedCount > 0) {
                    try {
                        await db.imageCache.put({
                            url,
                            blob,
                            cachedAt: Date.now()
                        });
                    } catch (retryError) {
                        // Ignore retry failure.
                    }
                }
            }
        }
    }

    async function getImageFromDexie(url) {
        if (!db) return null;

        try {
            const record = await db.imageCache.get(url);

            if (record && record.blob) {
                db.imageCache.update(url, {
                    cachedAt: Date.now()
                }).catch(() => { });

                return record.blob;
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    async function clearDexieCache() {
        if (!db) return;

        try {
            await db.imageCache.clear();

            state.notificationType = 'success';
            state.notification = 'Persistent image cache cleared.';
        } catch (e) {
            state.notificationType = 'error';
            state.notification = 'Error clearing cache.';
        }
    }

    const Zoom = {
        _applyTransition: function ($element, action) {
            $element.addClass(CSS.GALLERY.IS_TRANSITIONING);
            action();

            let cleared = false;

            const clear = () => {
                if (!cleared) {
                    cleared = true;
                    $element.removeClass(CSS.GALLERY.IS_TRANSITIONING);
                }
            };

            $element.one('transitionend', clear);
            setTimeout(clear, 600);
        },

        applyZoom: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            DragHandler.updateTransform();

            const $zoomDisplay = galleryOverlay.find('#zoom-level');
            if ($zoomDisplay.length) {
                $zoomDisplay.text(`${Math.round(viewState.zoomScale * 100)}%`);
            }

            $container.toggleClass(CSS.GALLERY.ZOOMED, viewState.zoomScale !== 1);
        },

        handleWheelZoom: (event) => {
            if (!state.zoomEnabled || !galleryOverlay || !galleryOverlay.length) return;

            event.preventDefault();
            event.stopPropagation();

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0];

            $container.css('transform-origin', '0 0');

            const mediaEl = $container.find('img, video')[0];
            if (mediaEl) mediaEl.style.transformOrigin = '0 0';

            const rect = containerDOM.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const originalEvent = event.originalEvent || event;
            const mouseX = originalEvent.clientX - rect.left;
            const mouseY = originalEvent.clientY - rect.top;
            const delta = originalEvent.deltaY;

            const zoomFactor = delta > 0 ? (1 - CONFIG.ZOOM_STEP) : (1 + CONFIG.ZOOM_STEP);
            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.zoomScale * zoomFactor, CONFIG.MAX_SCALE));

            if (newScale === viewState.zoomScale) return;

            const imageXUnderPointer = (mouseX - viewState.imageOffset.x) / viewState.zoomScale;
            const imageYUnderPointer = (mouseY - viewState.imageOffset.y) / viewState.zoomScale;

            viewState.imageOffset.x = mouseX - (imageXUnderPointer * newScale);
            viewState.imageOffset.y = mouseY - (imageYUnderPointer * newScale);
            viewState.zoomScale = newScale;

            Zoom.applyZoom();
        },

        resetZoom: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if ($container.length) {
                Zoom._applyTransition($container, () => {
                    viewState.zoomScale = 1;
                    viewState.imageOffset = { x: 0, y: 0 };
                    Zoom.applyZoom();
                });
            }
        },

        zoom: (step) => {
            if (!galleryOverlay || !galleryOverlay.length) return;

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0];
            const rect = containerDOM.getBoundingClientRect();

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.zoomScale + step, CONFIG.MAX_SCALE));

            if (viewState.zoomScale !== newScale) {
                const imageX = (centerX - viewState.imageOffset.x) / viewState.zoomScale;
                const imageY = (centerY - viewState.imageOffset.y) / viewState.zoomScale;

                const newOffsetX = centerX - (imageX * newScale);
                const newOffsetY = centerY - (imageY * newScale);

                Zoom._applyTransition($container, () => {
                    viewState.imageOffset.x = newOffsetX;
                    viewState.imageOffset.y = newOffsetY;
                    viewState.zoomScale = newScale;
                    Zoom.applyZoom();
                });
            }
        },

        setupTouchEvents: () => {
            if (!galleryOverlay || !galleryOverlay.length) return;

            const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            if (!$container.length) return;

            const containerDOM = $container[0];
            let longPressTimer = null;

            const handleTouchStart = (e) => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (!currentItem || currentItem.type !== 'image') return;

                clearTimeout(longPressTimer);

                if (e.touches.length === 1) {
                    const now = Date.now();

                    if (now - state.lastTapTime < CONFIG.DOUBLE_TAP_THRESHOLD) {
                        DragHandler.handleDoubleTap(e);
                        return;
                    }

                    state.lastTapTime = now;
                    longPressTimer = setTimeout(() => $(e.target).addClass(CSS.LONG_PRESS), 500);
                    DragHandler.startDrag(e.touches[0]);
                } else if (e.touches.length === 2) {
                    if (DragHandler.isDragging) DragHandler.endDrag();
                    DragHandler.handlePinchStart(e);
                }
            };

            const handleTouchMove = (e) => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (!currentItem || currentItem.type !== 'image') return;

                clearTimeout(longPressTimer);

                if (viewState.pinchZoomActive && e.touches.length === 2) {
                    DragHandler.handlePinchMove(e);
                } else if (DragHandler.isDragging && e.touches.length === 1) {
                    if (!DragHandler.touchMoveThrottled) {
                        DragHandler.touchMoveThrottled = true;
                        DragHandler.dragImage(e.touches[0]);

                        requestAnimationFrame(() => {
                            DragHandler.touchMoveThrottled = false;
                        });
                    }
                }
            };

            const handleTouchEnd = (e) => {
                clearTimeout(longPressTimer);
                $container.find(`.${CSS.LONG_PRESS}`).removeClass(CSS.LONG_PRESS);

                if (viewState.pinchZoomActive && e.touches.length < 2) {
                    viewState.pinchZoomActive = false;
                }

                if (DragHandler.isDragging) DragHandler.endDrag();
            };

            const eventOptions = { passive: false };

            containerDOM.addEventListener('touchstart', handleTouchStart, eventOptions);
            containerDOM.addEventListener('touchmove', handleTouchMove, eventOptions);
            containerDOM.addEventListener('touchend', handleTouchEnd, eventOptions);
            containerDOM.addEventListener('touchcancel', handleTouchEnd, eventOptions);
        }
    };

    const ThumbnailStrip = {
        _contextMenuTimeout: null,

        init: () => {
            $(document).off('.thumbnailstrip');
            if (!galleryOverlay) return;
            const $strip = galleryOverlay.find('.ug-thumbnail-strip');
            ThumbnailStrip.updateScrollIndicators();
            ThumbnailStrip.setupKeyboardNavigation();
            ThumbnailStrip.setupDragNavigation();
            ThumbnailStrip.setupHoverPreview();
            ThumbnailStrip.setupContextMenu();
            $strip.on('scroll', Utils.throttle(() => ThumbnailStrip.updateScrollIndicators(), 100));
        },

        cleanup: () => {
            $(document).off('.thumbnailstrip');
            ThumbnailStrip.hideContextMenu();
            $('.ug-thumbnail-zoom-preview').remove();
            if (galleryOverlay && galleryOverlay.length) {
                galleryOverlay.find('.ug-slideshow-indicator').remove();
                galleryOverlay.find('.ug-thumbnail-strip').off('.virtual');
            }
        },

        updateScrollIndicators: () => {
            if (!galleryOverlay) return;
            const $strip = galleryOverlay.find('.ug-thumbnail-strip');
            if (!$strip.length) return;
            const hasScroll = $strip[0].scrollWidth > $strip[0].clientWidth;
            $strip.toggleClass('no-scroll', !hasScroll);
        },

        setupKeyboardNavigation: () => {
            const $strip = galleryOverlay.find('.ug-thumbnail-strip');
            $strip.on('keydown', function (e) {
                const $focused = $(e.target).closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (!$focused.length) return;
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        ThumbnailStrip.navigateThumbnails('prev');
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        ThumbnailStrip.navigateThumbnails('next');
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        Gallery.showExpandedView(parseInt($focused.data('index')));
                        break;
                }
            });
        },

        navigateThumbnails: (direction) => {
            const $strip = galleryOverlay.find('.ug-thumbnail-strip');
            const $current = $strip.find(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}.selected`);
            const currentIndex = $current.length
                ? parseInt($current.attr('data-index'), 10)
                : state.currentGalleryIndex;
            const total = state.fullSizeImageSrcs.length;
            if (!total) return;
            const target = Math.max(0, Math.min(total - 1, currentIndex + (direction === 'next' ? 1 : -1)));
            const $target = $strip.find(`[data-index="${target}"]`);
            if ($target.length) {
                $target[0].focus();
                $target[0].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            } else {
                Gallery.showExpandedView(target);
            }
        },

        setupDragNavigation: () => {
            const $strip = galleryOverlay.find('.ug-thumbnail-strip');
            let isDragging = false;
            let startX = 0;
            let scrollLeft = 0;
            $strip.on('mousedown', (e) => {
                if (e.button !== 0) return;
                if ($(e.target).closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`).length) return;
                isDragging = true;
                startX = e.pageX - $strip.offset().left;
                scrollLeft = $strip.scrollLeft();
                $strip.css('cursor', 'grabbing').addClass('ug-dragging');
            });
            $(document).on('mousemove.thumbnailstrip', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.pageX - $strip.offset().left;
                $strip.scrollLeft(scrollLeft - (x - startX) * 2);
            });
            $(document).on('mouseup.thumbnailstrip', () => {
                isDragging = false;
                $strip.css('cursor', '').removeClass('ug-dragging');
            });
        },

        setupHoverPreview: () => {
            const $strip = galleryOverlay.find('.ug-thumbnail-strip');
            let previewTimeout;
            $strip.on('mouseenter', `.${CSS.GALLERY.THUMBNAIL_WRAPPER}`, function () {
                const $thumb = $(this);
                const index = parseInt($thumb.data('index'));
                clearTimeout(previewTimeout);
                previewTimeout = setTimeout(() => ThumbnailStrip.showZoomPreview($thumb, index), 500);
            });
            $strip.on('mouseleave', `.${CSS.GALLERY.THUMBNAIL_WRAPPER}`, function () {
                clearTimeout(previewTimeout);
                ThumbnailStrip.hideZoomPreview();
            });
        },

        showZoomPreview: ($thumb, index) => {
            const mediaItem = state.fullSizeImageSrcs[index];
            if (!mediaItem) return;
            $('.ug-thumbnail-zoom-preview').remove();
            const thumbImgSrc = $thumb.find('img').attr('src');
            const src = mediaItem.type === 'video'
                ? (mediaItem.poster || thumbImgSrc)
                : (thumbImgSrc || mediaItem.src);
            if (!src) return;
            const $preview = $('<div>').addClass('ug-thumbnail-zoom-preview');
            $('<img>').attr('src', src).appendTo($preview);
            $('body').append($preview);
            const rect = $thumb[0].getBoundingClientRect();
            const previewWidth = 220;
            const left = Math.min(
                Math.max(rect.left + rect.width / 2, previewWidth / 2 + 8),
                window.innerWidth - previewWidth / 2 - 8
            );
            let top;
            let transform;
            if (rect.top > 240) {
                top = rect.top - 10;
                transform = 'translate(-50%, -100%)';
            } else {
                top = rect.bottom + 10;
                transform = 'translate(-50%, 0)';
            }
            $preview.css({
                position: 'fixed',
                left: `${left}px`,
                top: `${top}px`,
                bottom: 'auto',
                transform,
                zIndex: 10000
            });
            setTimeout(() => $preview.addClass('show'), 10);
        },

        hideZoomPreview: () => {
            const $preview = $('.ug-thumbnail-zoom-preview');
            if (!$preview.length) return;
            $preview.removeClass('show');
            setTimeout(() => { $preview.remove(); }, 300);
        },

        setupContextMenu: () => {
            const $strip = galleryOverlay.find('.ug-thumbnail-strip');
            $strip.on('contextmenu', `.${CSS.GALLERY.THUMBNAIL_WRAPPER}`, function (e) {
                e.preventDefault();
                ThumbnailStrip.showContextMenu($(this), parseInt($(this).data('index')), e.pageX, e.pageY);
            });
            $(document).on('click.thumbnailstrip', () => ThumbnailStrip.hideContextMenu());
        },

        showContextMenu: ($thumb, index, x, y) => {
            if (ThumbnailStrip._contextMenuTimeout) {
                clearTimeout(ThumbnailStrip._contextMenuTimeout);
                ThumbnailStrip._contextMenuTimeout = null;
            }
            $('.ug-thumbnail-context-menu').remove();
            const $menu = $('<div>').addClass('ug-thumbnail-context-menu');
            const menuItems = [
                { text: 'Open Image', action: () => Gallery.showExpandedView(index) },
                { text: 'Download Image', action: () => DownloadManager.downloadImageByIndex(index) },
                { text: 'Copy URL', action: () => ThumbnailStrip.copyImageUrl(index) },
                { text: 'Remove from Gallery', action: () => ThumbnailStrip.removeFromGallery(index), danger: true }
            ];
            menuItems.forEach(item => {
                $('<button>')
                    .addClass('ug-thumbnail-context-menu-item')
                    .text(item.text)
                    .toggleClass('danger', item.danger)
                    .on('click', (e) => {
                        e.stopPropagation();
                        item.action();
                        ThumbnailStrip.hideContextMenu();
                    })
                    .appendTo($menu);
            });
            $menu.css({
                left: Math.min(x, window.innerWidth - 170) + 'px',
                top: Math.min(y - 10, window.innerHeight - 200) + 'px'
            });
            $('body').append($menu);
            setTimeout(() => $menu.addClass('show'), 10);
        },

        hideContextMenu: () => {
            const $menu = $('.ug-thumbnail-context-menu');
            $menu.removeClass('show');
            if (ThumbnailStrip._contextMenuTimeout) clearTimeout(ThumbnailStrip._contextMenuTimeout);
            ThumbnailStrip._contextMenuTimeout = setTimeout(() => { $menu.remove(); }, CONFIG.CONTEXT_MENU_HIDE_DELAY);
        },

        copyImageUrl: (index) => {
            const mediaItem = state.fullSizeImageSrcs[index];
            if (!mediaItem) return;
            navigator.clipboard.writeText(mediaItem.src).then(() => {
                state.notificationType = 'success';
                state.notification = 'Image URL copied to clipboard';
            }).catch(err => {
                console.error('Failed to copy URL:', err);
                state.notificationType = 'error';
                state.notification = 'Failed to copy URL';
            });
        },

        removeFromGallery: (index) => {
            const doRemove = () => {
                state.fullSizeImageSrcs.splice(index, 1);
                state.originalImageSrcs.splice(index, 1);
                Gallery._clearPreloadCache();
                if (state.fullSizeImageSrcs.length === 0) {
                    Gallery.closeGallery();
                    return;
                }
                if (index < state.currentGalleryIndex) state.currentGalleryIndex--;
                if (state.currentGalleryIndex >= state.fullSizeImageSrcs.length) {
                    state.currentGalleryIndex = state.fullSizeImageSrcs.length - 1;
                }
                if (state.currentGalleryIndex < 0) state.currentGalleryIndex = 0;
                Gallery._populateAllThumbnails(galleryOverlay.find(`.${CSS.GALLERY.THUMBNAIL_STRIP}`));
                Gallery.showExpandedView(state.currentGalleryIndex);
                ThumbnailStrip.updateThumbnailNumbers();
                ThumbnailStrip.updateScrollIndicators();
                state.notificationType = 'info';
                state.notification = 'Image removed from gallery';
            };
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Remove from gallery?',
                    text: 'This only affects the current gallery view.',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Remove'
                }).then(({ isConfirmed }) => { if (isConfirmed) doRemove(); });
            } else if (confirm('Are you sure you want to remove this image from the gallery?')) {
                doRemove();
            }
        },

        updateThumbnailNumbers: () => {
            if (!galleryOverlay) return;
            galleryOverlay.find(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`).each(function () {
                const index = parseInt($(this).attr('data-index'), 10);
                const $number = $(this).find('.ug-thumbnail-number');
                if ($number.length === 0) {
                    $(this).append(`<span class="ug-thumbnail-number">${index + 1}</span>`);
                } else {
                    $number.text(index + 1);
                }
            });
        }
    };

    const UI = {
        _notificationTimeoutId: null,
        _notificationHideTimeoutId: null,

        createToggleButton: (name, action, disabled = false, actionName = null) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = name;
            btn.style.cursor = 'pointer';
            btn.classList.add(CSS.BTN);

            if (actionName) btn.dataset.action = actionName;

            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) {
                    e.preventDefault();
                    return;
                }

                action(e);
            });

            if (disabled) btn.classList.add('disabled');

            return btn;
        },

        createButtonGroup: (buttonsConfig) => {
            const div = document.createElement('div');
            div.classList.add(CSS.BTN_CONTAINER);

            buttonsConfig.forEach(config => {
                let createThisButton = true;

                switch (config.name) {
                    case 'FULL':
                        if (state.hideFullButton) createThisButton = false;
                        break;

                    case 'DOWNLOAD':
                        if (state.hideDownloadButton) createThisButton = false;
                        break;

                    case 'HEIGHT':
                        if (state.hideHeightButton) createThisButton = false;
                        break;

                    case 'WIDTH':
                        if (state.hideWidthButton) createThisButton = false;
                        break;
                }

                if (!createThisButton) return;

                const button = UI.createToggleButton(config.text, config.action, false, config.name);
                div.append(button);
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
            closeBtn.addEventListener('click', () => state.notification = null);
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

            if (UI._notificationHideTimeoutId) {
                clearTimeout(UI._notificationHideTimeoutId);
                UI._notificationHideTimeoutId = null;
            }

            container.classList.remove('ug-update', 'ug-slide-in', 'ug-slide-out');
            container.querySelector(`#${CSS.NOTIF_TEXT}`).textContent = message;
            container.className = `${CSS.NOTIF_CONTAINER} ${type}`;

            if (state.animationsEnabled) {
                if (isAlreadyVisible) {
                    container.classList.add('ug-update');
                    container.addEventListener('animationend', () => container.classList.remove('ug-update'), {
                        once: true
                    });
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

            if (UI._notificationHideTimeoutId) {
                clearTimeout(UI._notificationHideTimeoutId);
                UI._notificationHideTimeoutId = null;
            }

            if (state.animationsEnabled) {
                container.classList.add('ug-slide-out');
                container.classList.remove('ug-slide-in');

                UI._notificationHideTimeoutId = setTimeout(() => {
                    container.style.display = 'none';
                    container.classList.remove('ug-slide-out');
                    UI._notificationHideTimeoutId = null;
                }, 500);
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

            if (UI._notificationHideTimeoutId) {
                clearTimeout(UI._notificationHideTimeoutId);
                UI._notificationHideTimeoutId = null;
            }

            const container = document.getElementById(CSS.NOTIF_CONTAINER);
            if (container) container.remove();
        },

        _createSettingElement: (setting) => {
            const $div = $('<div>').addClass('ug-setting-item');
            const $label = $('<label>').attr('for', setting.id).text(setting.label);

            const handleChange = (value) => {
                if (setting.stateKey) state[setting.stateKey] = value;
                if (setting.gmKey) SettingsManager.saveSetting(setting.gmKey, value);
                if (setting.onChange) setting.onChange(value);
            };

            switch (setting.type) {
                case 'checkbox':
                    $div.addClass('ug-settings-checkbox-label');
                    $div.append(
                        $('<input type="checkbox">')
                            .attr('id', setting.id)
                            .prop('checked', state[setting.stateKey])
                            .on('change', e => handleChange($(e.target).prop('checked'))),
                        $label
                    );
                    break;

                case 'text':
                    $div.append($label);
                    $div.append(
                        $('<input type="text">')
                            .attr({
                                id: setting.id,
                                value: state[setting.stateKey],
                                maxlength: setting.maxLength || 50
                            })
                            .addClass('ug-settings-input')
                            .on('change', e => handleChange($(e.target).val()))
                    );
                    break;

                case 'select': {
                    $div.append($label);

                    const $select = $('<select>')
                        .attr('id', setting.id)
                        .addClass('ug-settings-input')
                        .on('change', e => handleChange(e.target.value));

                    setting.options.forEach(opt => {
                        $select.append($('<option>').val(opt.value).text(opt.text));
                    });

                    $select.val(state[setting.stateKey]);
                    $div.append($select);
                    break;
                }

                case 'button':
                    return $('<button>')
                        .addClass('ug-button ug-settings-input')
                        .text(setting.label)
                        .on('click', setting.action);
            }

            return $div;
        },

        createSettingsUI: () => {
            const settingsConfig = [
                {
                    title: 'General',
                    key: 'general',
                    settings: [
                        {
                            id: 'animationsToggle',
                            label: 'Enable Animations',
                            type: 'checkbox',
                            stateKey: 'animationsEnabled',
                            gmKey: 'animationsEnabled'
                        },
                        {
                            id: 'bottomStripeToggle',
                            label: 'Show Thumbnail Strip',
                            type: 'checkbox',
                            stateKey: 'bottomStripeVisible',
                            gmKey: 'bottomStripeVisible'
                        },
                        {
                            id: 'autoLoadOriginalsToggle',
                            label: 'Auto-load Original Images',
                            type: 'checkbox',
                            stateKey: 'autoLoadOriginals',
                            gmKey: 'autoLoadOriginals'
                        }
                    ]
                },
                {
                    title: 'Pan & Zoom',
                    key: 'panZoom',
                    settings: [
                        {
                            id: 'zoomEnabledToggle',
                            label: 'Enable Zoom & Pan',
                            type: 'checkbox',
                            stateKey: 'zoomEnabled',
                            gmKey: 'zoomEnabled'
                        },
                        {
                            id: 'inertiaEnabledToggle',
                            label: 'Enable Smooth Pan Inertia',
                            type: 'checkbox',
                            stateKey: 'inertiaEnabled',
                            gmKey: 'inertiaEnabled'
                        }
                    ]
                },
                {
                    title: 'Slideshow',
                    key: 'slideshow',
                    settings: [
                        {
                            id: 'slideshowDelay',
                            label: 'Slideshow Delay (ms):',
                            type: 'text',
                            stateKey: 'slideshowDelay',
                            gmKey: 'slideshowDelay',
                            maxLength: 5,
                            onChange: (value) => {
                                const validDelay = parseInt(value) || CONFIG.SLIDESHOW_DELAY;
                                state.slideshowDelay = validDelay;
                                Slideshow.setDelay(validDelay);
                            }
                        },
                        {
                            id: 'slideshowPauseOnHover',
                            label: 'Pause on Hover',
                            type: 'checkbox',
                            stateKey: 'slideshowPauseOnHover',
                            gmKey: 'slideshowPauseOnHover'
                        }
                    ]
                },
                {
                    title: 'Button Labels',
                    key: 'buttonLabels',
                    settings: [
                        {
                            id: 'downloadBtnTextInput',
                            label: 'Download Button:',
                            type: 'text',
                            stateKey: 'downloadBtnText',
                            gmKey: 'downloadBtnText',
                            onChange: updateButtonLabels
                        },
                        {
                            id: 'downloadAllBtnTextInput',
                            label: 'Download All Button:',
                            type: 'text',
                            stateKey: 'downloadAllBtnText',
                            gmKey: 'downloadAllBtnText',
                            onChange: updateButtonLabels
                        },
                        {
                            id: 'fullBtnTextInput',
                            label: 'Full Size Button:',
                            type: 'text',
                            stateKey: 'fullBtnText',
                            gmKey: 'fullBtnText',
                            onChange: updateButtonLabels
                        },
                        {
                            id: 'heightBtnTextInput',
                            label: 'Fill Height Button:',
                            type: 'text',
                            stateKey: 'heightBtnText',
                            gmKey: 'heightBtnText',
                            onChange: updateButtonLabels
                        },
                        {
                            id: 'widthBtnTextInput',
                            label: 'Fill Width Button:',
                            type: 'text',
                            stateKey: 'widthBtnText',
                            gmKey: 'widthBtnText',
                            onChange: updateButtonLabels
                        },
                        {
                            id: 'galleryBtnTextInput',
                            label: 'Gallery Button:',
                            type: 'text',
                            stateKey: 'galleryBtnText',
                            gmKey: 'galleryBtnText',
                            onChange: updateButtonLabels
                        }
                    ]
                },
                {
                    title: 'Buttons',
                    key: 'buttonVisibility',
                    settings: [
                        {
                            id: 'hideNavArrows',
                            label: 'Hide Navigation Arrows',
                            type: 'checkbox',
                            stateKey: 'hideNavArrows',
                            gmKey: 'hideNavArrows',
                            onChange: () => PostActions.updateButtonVisibilityLight()
                        },
                        {
                            id: 'hideFullBtn',
                            label: 'Hide Full Size Button',
                            type: 'checkbox',
                            stateKey: 'hideFullButton',
                            gmKey: 'hideFullButton',
                            onChange: () => PostActions.updateButtonVisibilityLight()
                        },
                        {
                            id: 'hideDownloadBtn',
                            label: 'Hide Download Button',
                            type: 'checkbox',
                            stateKey: 'hideDownloadButton',
                            gmKey: 'hideDownloadButton',
                            onChange: () => PostActions.updateButtonVisibilityLight()
                        },
                        {
                            id: 'hideHeightBtn',
                            label: 'Hide Fill Height Button',
                            type: 'checkbox',
                            stateKey: 'hideHeightButton',
                            gmKey: 'hideHeightButton',
                            onChange: () => PostActions.updateButtonVisibilityLight()
                        },
                        {
                            id: 'hideWidthBtn',
                            label: 'Hide Fill Width Button',
                            type: 'checkbox',
                            stateKey: 'hideWidthButton',
                            gmKey: 'hideWidthButton',
                            onChange: () => PostActions.updateButtonVisibilityLight()
                        }
                    ]
                },
                {
                    title: 'Keyboard',
                    key: 'keys',
                    settings: [
                        {
                            id: 'galleryKeyInput',
                            label: 'Gallery Key:',
                            type: 'text',
                            stateKey: 'galleryKey',
                            gmKey: 'galleryKey',
                            maxLength: 1
                        },
                        {
                            id: 'prevImageKeyInput',
                            label: 'Previous Image Key:',
                            type: 'text',
                            stateKey: 'prevImageKey',
                            gmKey: 'prevImageKey',
                            maxLength: 1
                        },
                        {
                            id: 'nextImageKeyInput',
                            label: 'Next Image Key:',
                            type: 'text',
                            stateKey: 'nextImageKey',
                            gmKey: 'nextImageKey',
                            maxLength: 1
                        }
                    ]
                },
                {
                    title: 'Notifications',
                    key: 'notifications',
                    settings: [
                        {
                            id: 'notificationsEnabledToggle',
                            label: 'Enable Notifications',
                            type: 'checkbox',
                            stateKey: 'notificationsEnabled',
                            gmKey: 'notificationsEnabled'
                        },
                        {
                            id: 'notificationPosition',
                            label: 'Notification Position:',
                            type: 'select',
                            stateKey: 'notificationPosition',
                            gmKey: 'notificationPosition',
                            options: [
                                { value: 'top', text: 'Top' },
                                { value: 'bottom', text: 'Bottom' }
                            ]
                        }
                    ]
                },
                {
                    title: 'Downloads',
                    key: 'optimizations',
                    settings: [
                        {
                            id: 'persistentCachingToggle',
                            label: 'Enable Persistent Image Caching',
                            type: 'checkbox',
                            stateKey: 'enablePersistentCaching',
                            gmKey: 'enablePersistentCaching'
                        },
                        {
                            id: 'clearCacheButton',
                            label: 'Clear Persistent Cache',
                            type: 'button',
                            action: clearDexieCache
                        },
                        {
                            id: 'exportSettingsButton',
                            label: 'Export Settings',
                            type: 'button',
                            action: () => {
                                const blob = new Blob([SettingsManager.exportSettings()], {
                                    type: 'application/json'
                                });

                                const url = URL.createObjectURL(blob);

                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'ultra-galleries-settings.json';
                                a.click();

                                URL.revokeObjectURL(url);

                                state.notificationType = 'success';
                                state.notification = 'Settings exported';
                            }
                        },
                        {
                            id: 'importSettingsButton',
                            label: 'Import Settings',
                            type: 'button',
                            action: () => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.json';

                                input.onchange = (e) => {
                                    const file = e.target.files[0];

                                    if (file) {
                                        const reader = new FileReader();

                                        reader.onload = (ev) => SettingsManager.importSettings(ev.target.result);
                                        reader.readAsText(file);
                                    }
                                };

                                input.click();
                            }
                        },
                        {
                            id: 'resetSettingsButton',
                            label: 'Reset to Defaults',
                            type: 'button',
                            action: () => {
                                const doReset = () => {
                                    SettingsManager.resetToDefaults();
                                    location.reload();
                                };

                                if (typeof Swal !== 'undefined') {
                                    Swal.fire({
                                        title: 'Reset settings?',
                                        text: 'All settings will return to defaults.',
                                        icon: 'warning',
                                        showCancelButton: true,
                                        confirmButtonText: 'Reset'
                                    }).then(({ isConfirmed }) => {
                                        if (isConfirmed) doReset();
                                    });
                                } else if (confirm('Are you sure you want to reset all settings to defaults?')) {
                                    doReset();
                                }
                            }
                        }
                    ]
                },
                {
                    title: 'File Formatting',
                    key: 'formatting',
                    settings: [
                        {
                            id: 'zipFileNameFormatInput',
                            label: 'Zip File Name Format:',
                            type: 'text',
                            stateKey: 'zipFileNameFormat',
                            gmKey: 'zipFileNameFormat'
                        },
                        {
                            id: 'imageFileNameFormatInput',
                            label: 'Image File Name Format:',
                            type: 'text',
                            stateKey: 'imageFileNameFormat',
                            gmKey: 'imageFileNameFormat'
                        }
                    ]
                }
            ];

            const $overlay = $('<div>')
                .attr({
                    id: 'ug-settings-overlay',
                    role: 'dialog',
                    'aria-modal': 'true',
                    'aria-labelledby': 'ug-settings-main-header'
                })
                .addClass('ug-settings-overlay');

            const $container = $('<div>').addClass('ug-settings-container').appendTo($overlay);
            const $sidebar = $('<div>').addClass('ug-settings-sidebar').appendTo($container);
            const $content = $('<div>').addClass('ug-settings-content').appendTo($container);

            const $header = $('<div>').addClass('ug-settings-header').appendTo($content);
            const $headerText = $('<h2>').attr('id', 'ug-settings-main-header').appendTo($header);

            $('<button>')
                .addClass('ug-settings-close-btn')
                .text(BUTTONS.CLOSE)
                .on('click', () => state.settingsOpen = false)
                .appendTo($header);

            const $body = $('<div>').addClass('ug-settings-body').appendTo($content);

            $('<div>').addClass('ug-sidebar-header').text('Settings').appendTo($sidebar);

            settingsConfig.forEach(section => {
                const $sectionEl = $('<div>')
                    .addClass('ug-settings-section')
                    .attr('data-section-key', section.key)
                    .hide()
                    .appendTo($body);

                section.settings.forEach(setting => {
                    $sectionEl.append(UI._createSettingElement(setting));
                });

                $('<button>')
                    .addClass('ug-sidebar-button')
                    .text(section.title)
                    .data('section-key', section.key)
                    .on('click', function () {
                        const key = $(this).data('section-key');

                        $('.ug-sidebar-button').removeClass('active');
                        $(this).addClass('active');

                        $('.ug-settings-section').hide();
                        $(`.ug-settings-section[data-section-key="${key}"]`).show();

                        $headerText.text(section.title);
                    })
                    .appendTo($sidebar);
            });

            $sidebar.find('.ug-sidebar-button').first().trigger('click');
            $('body').append($overlay);
        },

        showSettings: () => {
            lastFocusedElement = document.activeElement;

            const existingOverlay = document.getElementById('ug-settings-overlay');
            if (existingOverlay) existingOverlay.remove();

            UI.createSettingsUI();

            const overlay = document.getElementById('ug-settings-overlay');
            if (!overlay) return;

            overlay.classList.add('opening');

            const focusable = Array.from(overlay.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ));

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

    const Gallery = {
        _preloadedImageCache: {},
        _preloadingInProgress: {},

        _clearPreloadCache: function () {
            for (const index in Gallery._preloadedImageCache) {
                const cachedItem = Gallery._preloadedImageCache[index];
                if (typeof cachedItem === 'string' && cachedItem.startsWith('blob:')) {
                    BlobManager.revokeUrl(cachedItem);
                }
            }
            Gallery._preloadedImageCache = {};
            Gallery._preloadingInProgress = {};
        },

        _fetchAndCacheImage: async function (indexToPreload, sessionId = null) {
            if (indexToPreload < 0 || indexToPreload >= state.originalImageSrcs.length) return;
            if (Gallery._preloadedImageCache[indexToPreload] || Gallery._preloadingInProgress[indexToPreload]) return;
            const mediaItem = state.originalImageSrcs[indexToPreload];
            if (!mediaItem || mediaItem.type !== 'image') return;
            if (sessionId !== null && state.currentLoadSessionId !== sessionId) return;
            const originalImageUrl = mediaItem.src;
            if (!originalImageUrl) return;
            Gallery._preloadingInProgress[indexToPreload] = true;
            try {
                const blob = await ImageLoader.fetchWithRetry(originalImageUrl, sessionId);
                if (blob) {
                    Gallery._preloadedImageCache[indexToPreload] = BlobManager.createUrl(blob);
                }
            } catch (error) {
                console.error(`Preload failed for ${indexToPreload}`, error);
            } finally {
                delete Gallery._preloadingInProgress[indexToPreload];
            }
        },

        _preloadAdjacentImages: function (currentIndex) {
            const sessionId = state.currentLoadSessionId;
            const maxKeep = CONFIG.PRELOAD_COUNT + CONFIG.PRELOAD_WINDOW_BUFFER;
            for (const indexStr in Gallery._preloadedImageCache) {
                const index = parseInt(indexStr);
                if (Math.abs(index - currentIndex) > maxKeep) {
                    if (typeof Gallery._preloadedImageCache[indexStr] === 'string') {
                        BlobManager.revokeUrl(Gallery._preloadedImageCache[indexStr]);
                    }
                    delete Gallery._preloadedImageCache[indexStr];
                }
            }
            for (let i = 1; i <= CONFIG.PRELOAD_COUNT; i++) {
                Gallery._fetchAndCacheImage(currentIndex + i, sessionId);
            }
            Gallery._fetchAndCacheImage(currentIndex - 1, sessionId);
        },

        _releaseVideo: (video) => {
            if (!video || video.tagName !== 'VIDEO') return;
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch (e) { /* ignore */ }
        },

        _releaseMediaElements: ($scope) => {
            if (!$scope || !$scope.length) return;
            $scope.find('video').each(function () { Gallery._releaseVideo(this); });
        },

        safePlay: (video) => {
            if (!video) return;
            try {
                const p = video.play();
                if (p && typeof p.catch === 'function') {
                    p.catch(err => console.warn('Ultra Galleries: playback blocked:', err));
                }
            } catch (e) {
                console.warn('Ultra Galleries: playback error:', e);
            }
        },

        _attachVideoPlayOverlay: (video, $container) => {
            const $overlay = $('<button>')
                .addClass('ug-video-play-overlay')
                .attr({ 'aria-label': 'Play video', title: 'Play video' })
                .html('<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>');
            const hide = () => $overlay.addClass('ug-hidden');
            $overlay.on('click', (e) => {
                e.stopPropagation();
                Gallery.safePlay(video);
                hide();
            });
            video.addEventListener('play', hide, { once: true });
            $container.append($overlay);
        },

        _createGalleryOverlayAndContainer: function () {
            galleryOverlay = $('<div>')
                .attr('id', 'gallery-overlay')
                .addClass(CSS.GALLERY.OVERLAY);
            return $('<div>')
                .addClass(CSS.GALLERY.CONTAINER)
                .appendTo(galleryOverlay);
        },

        _createExpandedViewToolbar: function ($expandedViewElement) {
            const $toolbar = $('<div>')
                .addClass(CSS.GALLERY.TOOLBAR)
                .on('mousedown', e => e.stopPropagation());

            $('<button>')
                .attr({ id: 'reset-btn', title: 'Reset Zoom & Position' })
                .addClass(CSS.GALLERY.TOOLBAR_BTN)
                .text('Reset')
                .on('click', Zoom.resetZoom)
                .appendTo($toolbar);

            const $zoomControls = $('<div>').addClass('zoom-controls').appendTo($toolbar);
            $('<button>')
                .attr({ id: 'zoom-out-btn', title: 'Zoom Out' })
                .addClass(CSS.GALLERY.TOOLBAR_BTN)
                .html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="8" y1="11" x2="14" y2="11"></line><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>')
                .on('click', () => Zoom.zoom(-CONFIG.ZOOM_STEP))
                .appendTo($zoomControls);
            $('<span>')
                .attr('id', 'zoom-level')
                .addClass('zoom-level')
                .text('100%')
                .appendTo($zoomControls);
            $('<button>')
                .attr({ id: 'zoom-in-btn', title: 'Zoom In' })
                .addClass(CSS.GALLERY.TOOLBAR_BTN)
                .html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>')
                .on('click', () => Zoom.zoom(CONFIG.ZOOM_STEP))
                .appendTo($zoomControls);

            $('<button>')
                .attr({ id: 'slideshow-btn', title: 'Start Slideshow (Space)' })
                .addClass(CSS.GALLERY.TOOLBAR_BTN)
                .html('▶')
                .on('click', Slideshow.handleButton)
                .appendTo($toolbar);
            Slideshow.syncControls();

            $('<button>')
                .attr({ id: 'ug-fill-height-btn', 'aria-label': 'Fill Height' })
                .text(BUTTONS.HEIGHT)
                .addClass(CSS.GALLERY.TOOLBAR_BTN)
                .on('click', () => {
                    const $container = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
                    const $media = $container.find('img, video');
                    if ($media.length) ImageSizing.applyFillHeight($media[0]);
                })
                .appendTo($toolbar);

            $('<button>')
                .text(BUTTONS.FULLSCREEN)
                .addClass(CSS.GALLERY.FULLSCREEN)
                .addClass(CSS.GALLERY.TOOLBAR_BTN)
                .attr('aria-label', 'Toggle Fullscreen')
                .on('click', Gallery.toggleFullscreen)
                .appendTo($toolbar);

            $expandedViewElement.append($toolbar);
            $expandedViewElement.append(
                $('<button>')
                    .addClass('ug-gallery-close-button')
                    .attr('aria-label', 'Close Gallery')
                    .html(BUTTONS.CLOSE)
                    .on('click', Gallery.closeGallery)
            );
        },

        _createExpandedViewMainImageArea: function ($expandedViewElement) {
            const $zoomContainer = $('<div>')
                .addClass(CSS.GALLERY.ZOOM_CONTAINER)
                .appendTo($expandedViewElement);
            $('<div>').addClass('ug-ambient-background').appendTo($zoomContainer);
            const $mainImageContainer = $('<div>')
                .addClass(CSS.GALLERY.MAIN_IMG_CONTAINER)
                .addClass('image-container')
                .appendTo($zoomContainer);
            const $panIndicator = $('<div>').addClass('pan-indicator').appendTo($mainImageContainer);
            $panIndicator.append(
                $('<svg>').attr({
                    xmlns: 'http://www.w3.org/2000/svg',
                    width: '30', height: '30',
                    viewBox: '0 0 24 24',
                    fill: 'white', opacity: '0.7'
                }).html('<path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>')
            );
            return { $mainImageContainer };
        },

        _createExpandedViewNavigationAndCounter: function ($expandedViewElement) {
            const $navContainer = $('<div>')
                .addClass(CSS.GALLERY.NAV_CONTAINER)
                .on('mousedown', e => e.stopPropagation());
            if (!state.hideNavArrows) {
                $navContainer.append(
                    UI.createNavigationButton('prev'),
                    UI.createNavigationButton('next')
                );
            }
            $expandedViewElement.append($navContainer);
            $('<div>')
                .addClass(CSS.GALLERY.COUNTER)
                .addClass(CSS.GALLERY.HIDE)
                .appendTo($expandedViewElement);
        },

        _createExpandedViewThumbnailStrip: function ($expandedViewElement) {
            const $thumbnailStripContainer = $('<div>')
                .addClass(CSS.GALLERY.STRIP_CONTAINER)
                .css('display', state.bottomStripeVisible ? 'flex' : 'none')
                .on('mousedown', e => e.stopPropagation())
                .appendTo($expandedViewElement);
            return $('<div>')
                .addClass(CSS.GALLERY.THUMBNAIL_STRIP)
                .appendTo($thumbnailStripContainer);
        },

        _populateAllThumbnails: function ($stripThumbnailsContainer) {
            $stripThumbnailsContainer.empty();
            const stripFragment = document.createDocumentFragment();
            state.fullSizeImageSrcs.forEach((mediaItem, index) => {
                if (!mediaItem) return;
                const thumbSrc = mediaItem.type === 'video' ? mediaItem.poster : mediaItem.src;
                const $stripContainer = $('<div>').addClass(CSS.GALLERY.THUMBNAIL_WRAPPER);
                if (mediaItem.type === 'video') {
                    $stripContainer.append(
                        $('<div>')
                            .addClass('ug-play-icon')
                            .html('<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>')
                    );
                }
                $stripContainer.append(
                    $('<img>')
                        .attr({ src: thumbSrc, loading: 'lazy', decoding: 'async' })
                        .addClass(CSS.GALLERY.THUMBNAIL)
                );
                $stripContainer
                    .attr({
                        'data-index': index,
                        'aria-label': `Thumbnail ${index + 1}`,
                        tabindex: 0,
                        role: 'button'
                    })
                    .data('index', index)
                    .on('click', () => Gallery.showExpandedView(index));
                stripFragment.appendChild($stripContainer[0]);
            });
            $stripThumbnailsContainer[0].appendChild(stripFragment);
        },

        _setupGalleryInteractions: function ($expandedViewElement, $mainImageContainerElement) {
            $mainImageContainerElement.on('wheel', e => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (currentItem && currentItem.type === 'image') Zoom.handleWheelZoom(e);
            });

            $expandedViewElement.on('mousedown', e => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (currentItem && currentItem.type === 'image') {
                    if (
                        $(e.target).closest(
                            `.${CSS.GALLERY.TOOLBAR}, .${CSS.GALLERY.NAV_CONTAINER}, .${CSS.GALLERY.STRIP_CONTAINER}`
                        ).length || e.button === 2
                    ) { return; }
                    DragHandler.startDrag(e);
                }
            });

            $mainImageContainerElement.on('dblclick', e => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (currentItem && currentItem.type === 'image' && e.button === 0) {
                    if (viewState.zoomScale > 1) {
                        Zoom.resetZoom();
                    } else {
                        const rect = $mainImageContainerElement[0].getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        viewState.zoomOrigin = { x: clickX, y: clickY };
                        const newScale = 2.5;
                        const imageX = (clickX - viewState.imageOffset.x) / viewState.zoomScale;
                        const imageY = (clickY - viewState.imageOffset.y) / viewState.zoomScale;
                        const newOffsetX = clickX - (imageX * newScale);
                        const newOffsetY = clickY - (imageY * newScale);
                        const mainImageDOM = $mainImageContainerElement.find(`.${CSS.GALLERY.MAIN_IMG}`)[0];
                        if (!mainImageDOM) return;
                        const boundedOffset = ZoomHelper.calculateHardBoundaryOffsets(
                            newOffsetX, newOffsetY, newScale, rect, mainImageDOM
                        );
                        Zoom._applyTransition($mainImageContainerElement, () => {
                            viewState.imageOffset.x = boundedOffset.x;
                            viewState.imageOffset.y = boundedOffset.y;
                            viewState.zoomScale = newScale;
                            Zoom.applyZoom();
                        });
                    }
                }
            });

            let controlsTimeout;
            $expandedViewElement.on('mousemove', () => {
                state.controlsVisible = true;
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => {
                    if (!state.isDragging && !viewState.pinchZoomActive) {
                        state.controlsVisible = false;
                    }
                }, CONFIG.CONTROLS_HIDE_DELAY);
            });
            state.controlsVisible = true;
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                if (!state.isDragging && !viewState.pinchZoomActive) {
                    state.controlsVisible = false;
                }
            }, CONFIG.CONTROLS_HIDE_DELAY);

            Zoom.setupTouchEvents();
            $(document).on('mousemove.galleryDrag', DragHandler.dragImage);
            $(document).on('mouseup.galleryDrag', DragHandler.endDrag);
        },

        createGallery: function () {
            if (galleryOverlay && galleryOverlay.length) {
                Gallery.showExpandedView(0);
                state.isGalleryMode = true;
                return;
            }
            const fragment = document.createDocumentFragment();
            const $galleryContentContainer = Gallery._createGalleryOverlayAndContainer();
            const $expandedView = $('<div>')
                .addClass(CSS.GALLERY.EXPANDED_VIEW)
                .addClass(CSS.GALLERY.HIDE)
                .appendTo($galleryContentContainer);
            Gallery._createExpandedViewToolbar($expandedView);
            const { $mainImageContainer } = Gallery._createExpandedViewMainImageArea($expandedView);
            Gallery._createExpandedViewNavigationAndCounter($expandedView);
            const $stripThumbnailsContainer = Gallery._createExpandedViewThumbnailStrip($expandedView);
            fragment.appendChild(galleryOverlay[0]);
            document.body.appendChild(fragment);
            if (state.isFullscreen) {
                document.body.classList.add('ug-fullscreen');
                galleryOverlay.addClass(CSS.GALLERY.FULLSCREEN_OVERLAY);
            }
            Gallery._populateAllThumbnails($stripThumbnailsContainer);
            Gallery._setupGalleryInteractions($expandedView, $mainImageContainer);
            Gallery.showExpandedView(0);
            state.isGalleryMode = true;
            Accessibility.init();
        },

        showExpandedView: function (index) {
            if (!galleryOverlay || !galleryOverlay.length || index < 0) return;
            let mediaItem = state.fullSizeImageSrcs[index];
            if (!mediaItem && state.originalImageSrcs[index]) {
                mediaItem = state.originalImageSrcs[index];
            }
            const $mainMediaContainer = galleryOverlay.find(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`);
            const $ambientBackground = galleryOverlay.find('.ug-ambient-background');
            const $counter = galleryOverlay.find(`.${CSS.GALLERY.COUNTER}`);
            const $zoomControls = galleryOverlay.find('.zoom-controls');
            const $resetBtn = galleryOverlay.find('#reset-btn');
            const $fillHeightBtn = galleryOverlay.find('#ug-fill-height-btn');
            if (!$mainMediaContainer.length) return;

            state.currentGalleryIndex = index;

            if (!mediaItem || !mediaItem.src) {
                Gallery._releaseMediaElements($mainMediaContainer);
                $mainMediaContainer.empty().append(
                    $('<div>').addClass(CSS.GALLERY.IMAGE_ERROR_MSG).text('Loading media data...')
                );
                galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`).removeClass(CSS.GALLERY.HIDE);
                return;
            }

            // Release old video decoders before clearing
            Gallery._releaseMediaElements($mainMediaContainer);

            if (DragHandler.inertiaAnimation) {
                cancelAnimationFrame(DragHandler.inertiaAnimation);
                DragHandler.inertiaAnimation = null;
            }
            if (DragHandler.animationFrame) {
                cancelAnimationFrame(DragHandler.animationFrame);
                DragHandler.animationFrame = null;
            }

            $mainMediaContainer.empty().removeClass(CSS.GALLERY.ZOOMED);
            viewState.zoomScale = 1;
            viewState.imageOffset = { x: 0, y: 0 };
            DragHandler.cachedImgEl = null;
            DragHandler.cachedZoomEl = null;

            if (mediaItem.type === 'image' || !mediaItem.type) {
                $zoomControls.show();
                $resetBtn.show();
                $fillHeightBtn.hide();
                const imageUrlToLoad = Gallery._preloadedImageCache[index] || mediaItem.src;
                if ($ambientBackground.length) {
                    $ambientBackground.css('background-image', `url("${imageUrlToLoad}")`);
                }
                const $mainImage = $('<img>')
                    .addClass(CSS.GALLERY.MAIN_IMG)
                    .attr({ decoding: 'async' })
                    .on('dragstart', e => e.preventDefault())
                    .appendTo($mainMediaContainer);

                $mainImage.on('load', function () {
                    $(this).css('opacity', 1);
                    this.style.transformOrigin = '0 0';
                    ImageSizing.applyBestFit(this);
                    DragHandler.cachedImgEl = this;
                    DragHandler.cachedZoomEl = document.getElementById('zoom-level');
                    viewState.zoomScale = 1;
                    viewState.imageOffset = { x: 0, y: 0 };
                    Zoom.applyZoom();
                    Gallery._preloadAdjacentImages(index);
                }).on('error', function () {
                    if (imageUrlToLoad !== mediaItem.src && !this.dataset.ugRetried) {
                        this.dataset.ugRetried = 'true';
                        this.src = mediaItem.src;
                        return;
                    }
                    $mainMediaContainer.append(
                        $('<div>').addClass(CSS.GALLERY.IMAGE_ERROR_MSG).text('Failed to load image')
                    );
                });
                $mainImage.attr('src', imageUrlToLoad);

            } else if (mediaItem.type === 'video') {
                $zoomControls.hide();
                $resetBtn.hide();
                $fillHeightBtn.show();
                const $mainVideo = $('<video>')
                    .addClass(CSS.GALLERY.MAIN_VIDEO)
                    .attr({
                        src: mediaItem.src,
                        poster: mediaItem.poster,
                        controls: true,
                        loop: true,
                        preload: 'metadata',
                        playsinline: true
                    })
                    .on('dragstart', e => e.preventDefault())
                    .appendTo($mainMediaContainer);

                $mainVideo.on('loadedmetadata', function () {
                    this.style.transformOrigin = '0 0';
                    Utils.setImageStyle(this, {
                        width: '100%', height: '100%',
                        maxWidth: '100%', maxHeight: '100%',
                        objectFit: 'contain'
                    });
                    DragHandler.cachedImgEl = this;
                    DragHandler.cachedZoomEl = document.getElementById('zoom-level');
                });
                Gallery._attachVideoPlayOverlay($mainVideo[0], $mainMediaContainer);
            }

            $counter
                .text(`${index + 1} / ${state.fullSizeImageSrcs.length}`)
                .removeClass(CSS.GALLERY.HIDE);
            galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`).removeClass(CSS.GALLERY.HIDE);

            const $strip = galleryOverlay.find(`.${CSS.GALLERY.THUMBNAIL_STRIP}`);
            $strip.find('.selected').removeClass('selected');
            const $activeThumb = $strip.find(`[data-index="${index}"]`).addClass('selected');
            if ($activeThumb.length) {
                $strip.animate({
                    scrollLeft: $activeThumb.position().left + $strip.scrollLeft() - ($strip.width() / 2)
                }, 200);
            }

            setTimeout(() => {
                ThumbnailStrip.init();
                ThumbnailStrip.updateThumbnailNumbers();
                ThumbnailStrip.updateScrollIndicators();
            }, 100);
        },

        closeGallery: function () {
            if (!galleryOverlay || !galleryOverlay.length) {
                state.isGalleryMode = false;
                state.isFullscreen = false;
                Slideshow.stop();
                $(document).off('.galleryDrag');
                ThumbnailStrip.cleanup();
                return;
            }
            state.isGalleryMode = false;
            state.isFullscreen = false;
            Slideshow.stop();
            Gallery._clearPreloadCache();
            ThumbnailStrip.cleanup();
            if (DragHandler.inertiaAnimation) {
                cancelAnimationFrame(DragHandler.inertiaAnimation);
                DragHandler.inertiaAnimation = null;
            }
            if (DragHandler.animationFrame) {
                cancelAnimationFrame(DragHandler.animationFrame);
                DragHandler.animationFrame = null;
            }
            Gallery._releaseMediaElements(galleryOverlay);
            galleryOverlay.remove();
            galleryOverlay = null;
            DragHandler.cachedImgEl = null;
            DragHandler.cachedZoomEl = null;
            $(document).off('.galleryDrag');
        },

        toggleGallery: function () {
            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else {
                if (state.galleryReady && state.fullSizeImageSrcs.length > 0) {
                    Gallery.createGallery();
                } else {
                    if (Utils.isPostPage()) {
                        ImageLoader.loadImages();
                        state.notificationType = 'info';
                        state.notification = 'Refreshing gallery list...';
                    } else {
                        state.notificationType = 'warning';
                        state.notification = 'No post page detected.';
                    }
                }
            }
        },

        toggleFullscreen: function () {
            state.isFullscreen = !state.isFullscreen;
        },

        nextImage: function () {
            if (state.fullSizeImageSrcs.length === 0) return;
            Gallery.showExpandedView((state.currentGalleryIndex + 1) % state.fullSizeImageSrcs.length);
        },

        prevImage: function () {
            if (state.fullSizeImageSrcs.length === 0) return;
            Gallery.showExpandedView(
                (state.currentGalleryIndex - 1 + state.fullSizeImageSrcs.length) % state.fullSizeImageSrcs.length
            );
        }
    };

    const ImageLoader = {
        imageActions: ImageActionHandler.imageActions,
        _lazyObserver: null,
        _previousBlobUrls: null,

        simulateScrollDown: async () => {
            return new Promise(resolve => {
                const selectors = [
                    SELECTORS.IMAGE_LINK + ' img',
                    SELECTORS.MAIN_THUMBNAIL + ' img',
                    '.post__content img',
                    '.post__body img'
                ];
                const images = document.querySelectorAll(selectors.join(', '));
                if (images.length === 0) { resolve(); return; }
                let loadedCount = 0;
                const checkAllLoaded = () => {
                    loadedCount++;
                    if (loadedCount >= images.length) {
                        clearTimeout(timeout);
                        observer.disconnect();
                        resolve();
                    }
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
                const dynamicTimeout = Math.max(CONFIG.SCROLL_SIMULATION_BASE_TIMEOUT, images.length * 200);
                const timeout = setTimeout(() => {
                    observer.disconnect();
                    resolve();
                }, dynamicTimeout);
            });
        },

        fetchWithRetry: async (url, sessionId, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) => {
            if (state.currentLoadSessionId !== sessionId) return null;
            try {
                if (state.enablePersistentCaching && db) {
                    const cachedBlob = await getImageFromDexie(url);
                    if (cachedBlob) return cachedBlob;
                }
                return await new Promise((resolve, reject) => {
                    if (state.currentLoadSessionId !== sessionId) {
                        reject(new Error('Stale session'));
                    }
                    GM.xmlHttpRequest({
                        method: 'GET',
                        url: url,
                        responseType: 'blob',
                        timeout: 120000,
                        onload: async (response) => {
                            if (response.status === 200 || response.status === 206) {
                                const blob = response.response;
                                if (state.enablePersistentCaching && db) {
                                    await storeImageInDexie(url, blob);
                                }
                                resolve(blob);
                            } else {
                                const err = new Error(`HTTP ${response.status}`);
                                err.status = response.status;
                                reject(err);
                            }
                        },
                        onerror: (error) => reject(error),
                        ontimeout: () => reject(new Error('Request timeout'))
                    });
                });
            } catch (err) {
                if (err.message === 'Stale session') throw err;
                if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) throw err;
                if (retries <= 0) throw err;
                await Utils.delay(delay);
                return ImageLoader.fetchWithRetry(url, sessionId, retries - 1, delay * 1.5);
            }
        },

        fetchBlobDirect: async (url, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) => {
            try {
                if (state.enablePersistentCaching && db) {
                    const cachedBlob = await getImageFromDexie(url);
                    if (cachedBlob) return cachedBlob;
                }
                return await new Promise((resolve, reject) => {
                    GM.xmlHttpRequest({
                        method: 'GET',
                        url: url,
                        responseType: 'blob',
                        timeout: 120000,
                        onload: async (response) => {
                            if (response.status === 200 || response.status === 206) {
                                const blob = response.response;
                                if (state.enablePersistentCaching && db) {
                                    await storeImageInDexie(url, blob);
                                }
                                resolve(blob);
                            } else {
                                const err = new Error(`HTTP ${response.status}`);
                                err.status = response.status;
                                reject(err);
                            }
                        },
                        onerror: (error) => reject(error),
                        ontimeout: () => reject(new Error('Request timeout'))
                    });
                });
            } catch (err) {
                if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) throw err;
                if (retries <= 0) throw err;
                await Utils.delay(delay);
                return ImageLoader.fetchBlobDirect(url, retries - 1, delay * 1.5);
            }
        },

        loadImageAndApplyToPage: async (linkElement, galleryIndex, posterHref, isUniqueForGallery, sessionId, itemData) => {
            const imgElement = linkElement.querySelector('img') || linkElement;
            if (!imgElement) {
                if (state.currentLoadSessionId === sessionId) state.loadedImages++;
                return;
            }
            if (imgElement.tagName === 'IMG' && !imgElement.classList.contains('post__image')) {
                imgElement.classList.add('post__image');
            }
            const cacheKey = itemData.originalUrl;
            let blobUrlToUse = loadedBlobUrls.get(posterHref);
            try {
                if (!blobUrlToUse) {
                    if (itemData.type === 'video') {
                        const posterBlob = await ImageLoader.fetchWithRetry(posterHref, sessionId);
                        if (state.currentLoadSessionId !== sessionId) return;
                        if (!posterBlob) throw new Error('Failed to fetch poster blob');
                        blobUrlToUse = BlobManager.createUrl(posterBlob);
                    } else {
                        let blob = await ImageLoader.fetchWithRetry(cacheKey, sessionId);
                        if (state.currentLoadSessionId !== sessionId) return;
                        if (!blob) throw new Error('Failed to fetch blob');
                        blobUrlToUse = BlobManager.createUrl(blob);
                    }
                    loadedBlobUrls.set(posterHref, blobUrlToUse);
                }
                if (state.currentLoadSessionId !== sessionId) return;
                if (imgElement.tagName === 'IMG') {
                    imgElement.src = blobUrlToUse;
                    imgElement.dataset.originalSrc = cacheKey;
                    imgElement.classList.add('ug-image-loaded');
                    imgElement.style.cursor = 'default';
                    const parentLink = imgElement.closest('a');
                    if (parentLink) parentLink.style.cursor = 'default';
                    ImageLoader.imageActions[state.currentResizeMode](imgElement);
                }
                if (isUniqueForGallery) {
                    state.fullSizeImageSrcs[galleryIndex] = itemData.type === 'video'
                        ? { type: 'video', src: cacheKey, poster: blobUrlToUse }
                        : { type: 'image', src: cacheKey, originalSrc: cacheKey };
                    state.originalImageSrcs[galleryIndex] = {
                        src: cacheKey,
                        type: itemData.type,
                        fileName: linkElement.getAttribute('download') || cacheKey.split('/').pop()
                    };
                }
                state.loadedImages++;
            } catch (error) {
                ErrorHandler.handleImageError(
                    error, cacheKey,
                    imgElement.tagName === 'IMG' ? imgElement : null,
                    { linkElement, galleryIndex, posterHref, isUniqueForGallery, itemData }
                );
                if (state.currentLoadSessionId === sessionId) {
                    state.loadedImages++;
                    state.errorCount++;
                }
            }
        },

        collectUniqueMediaItems: (postContainer) => {
            const uniqueGalleryItems = new Map();
            const targets = postContainer.querySelectorAll(
                `${SELECTORS.IMAGE_LINK}, ${SELECTORS.ATTACHMENT_LINK}, ${SELECTORS.VIDEO_LINK}, ${SELECTORS.GENERIC_IMAGE_LINK}`
            );
            targets.forEach(linkElement => {
                if (
                    linkElement.closest('.post__user-profile') ||
                    linkElement.closest('.scrape__user-profile')
                ) { return; }
                if (linkElement.classList.contains('user-header__avatar')) return;
                const isVideo =
                    linkElement.matches(SELECTORS.VIDEO_LINK) ||
                    linkElement.href?.match(/\.(mp4|webm|mov)$/i);
                let url;
                let poster;
                let type = 'image';
                if (isVideo) {
                    type = 'video';
                    url = linkElement.getAttribute('href')?.split('?')[0];
                    poster = linkElement.querySelector('img, video')?.getAttribute('poster') ||
                        (linkElement.querySelector('img')?.getAttribute('data-src') || linkElement.querySelector('img')?.src);
                    if (!url) return;
                    if (!poster) poster = 'https://pawchive.pw/static/menu/recent.svg';
                    if (!uniqueGalleryItems.has(url)) {
                        uniqueGalleryItems.set(url, {
                            linkElement, originalUrl: url, posterUrl: poster, type: 'video',
                            fileName: linkElement.getAttribute('download') || url.split('/').pop()
                        });
                    }
                } else {
                    url = Utils.handleMediaSrc(linkElement);
                    if (!url && linkElement.href) { url = linkElement.href.split('?')[0]; }
                    if (!url || !/\.(jpe?g|png|gif|webp|bmp)$/i.test(url)) return;
                    if (!uniqueGalleryItems.has(url)) {
                        uniqueGalleryItems.set(url, {
                            linkElement, originalUrl: url, posterUrl: url, type: 'image',
                            fileName: linkElement.getAttribute('download') || url.split('/').pop()
                        });
                    }
                }
            });
            postContainer.querySelectorAll('video').forEach(videoEl => {
                let url = videoEl.getAttribute('src') || videoEl.querySelector('source')?.getAttribute('src');
                if (url) {
                    url = url.split('?')[0];
                    if (!uniqueGalleryItems.has(url)) {
                        let poster = videoEl.getAttribute('poster') || 'https://pawchive.pw/static/menu/recent.svg';
                        uniqueGalleryItems.set(url, {
                            linkElement: videoEl, originalUrl: url, posterUrl: poster, type: 'video',
                            fileName: url.split('/').pop()
                        });
                    }
                }
            });
            return uniqueGalleryItems;
        },

        _concurrentRunner: (items, sessionId) => {
            const concurrencyLimit = CONFIG.MAX_CONCURRENT_FETCHES;
            const tasks = items.map((item, index) => () => ImageLoader.loadImageAndApplyToPage(
                item.linkElement, index, item.posterUrl, true, sessionId, item
            ));
            return new Promise((resolve) => {
                let running = 0;
                let index = 0;
                const total = tasks.length;
                if (total === 0) { resolve(); return; }
                const next = () => {
                    if (state.currentLoadSessionId !== sessionId) { resolve(); return; }
                    if (index >= total) { if (running === 0) resolve(); return; }
                    const task = tasks[index++];
                    running++;
                    task().then(() => { running--; next(); }).catch(() => { running--; next(); });
                };
                for (let i = 0; i < concurrencyLimit && i < total; i++) { next(); }
            });
        },

        loadImages: async () => {
            const postContainer =
                document.querySelector('section.site-section--post') ||
                document.querySelector('section.site-section--scrape') ||
                document.querySelector('.post__body') ||
                document.querySelector('.post__content') ||
                document;
            if (!Utils.isPostPage() || state.isLoading) return;
            const sessionId = StateManager.generateSessionId();
            state.currentLoadSessionId = sessionId;
            try {
                state.isLoading = true;
                await Utils.delay(16);
                if (state.currentLoadSessionId !== sessionId) return;
                const previousBlobUrls = new Map(loadedBlobUrls);
                loadedBlobUrls.clear();
                Object.assign(state, {
                    fullSizeImageSrcs: [],
                    originalImageSrcs: [],
                    loadedImages: 0,
                    errorCount: 0
                });
                const uniqueGalleryItems = ImageLoader.collectUniqueMediaItems(postContainer);
                if (state.currentLoadSessionId !== sessionId) return;
                const uniqueItems = Array.from(uniqueGalleryItems.values());
                state.totalImages = uniqueItems.length;
                state.fullSizeImageSrcs = Array(uniqueItems.length).fill(null);
                state.originalImageSrcs = Array(uniqueItems.length).fill(null);
                uniqueItems.forEach((item, index) => {
                    if (item.type === 'video') {
                        state.fullSizeImageSrcs[index] = {
                            type: 'video', src: item.originalUrl, poster: item.posterUrl
                        };
                    } else {
                        state.fullSizeImageSrcs[index] = {
                            type: 'image', src: item.originalUrl, originalSrc: item.originalUrl
                        };
                    }
                    state.originalImageSrcs[index] = {
                        src: item.originalUrl, type: item.type, fileName: item.fileName
                    };
                });
                state.galleryReady = true;
                updateGalleryButton(true);
                if (state.autoLoadOriginals) {
                    await ImageLoader.simulateScrollDown();
                    Utils.ensureThumbnailsExist();
                    await ImageLoader._concurrentRunner(uniqueItems, sessionId);
                    if (state.currentLoadSessionId !== sessionId) return;
                    previousBlobUrls.forEach((url, key) => {
                        if (loadedBlobUrls.has(key)) BlobManager.revokeUrl(url);
                    });
                    ImageLoader.updateFinalStatus();
                    ImageActionHandler.applyDefaultSizingToLoadedImages();
                } else {
                    state.notificationType = 'success';
                    state.notification = `Gallery Ready (${state.totalImages} items).`;
                }
                state.isLoading = false;
            } catch (error) {
                console.error('Critical Error in ImageLoader.loadImages:', error);
                state.isLoading = false;
                state.galleryReady = true;
                updateGalleryButton(true);
            }
        },

        updateFinalStatus: () => {
            if (state.loadedImages >= state.totalImages && state.totalImages > 0) {
                if (state.errorCount === 0) {
                    state.notificationType = 'success';
                    state.notification = `Media Done Loading! Total: ${state.totalImages}`;
                } else {
                    state.notificationType = 'warning';
                    state.notification = `Gallery: Loaded with ${state.errorCount} error(s).`;
                }
            } else if (state.totalImages === 0) {
                state.notificationType = 'info';
                state.notification = 'No gallery images found.';
            }
        }
    };

    const DownloadManager = {
        _worker: null,
        _workerUrl: null,
        _pendingVideoPromises: [],

        _getPostMeta: () => ({
            title: document.querySelector(SELECTORS.POST_TITLE)?.textContent?.trim() || 'Untitled',
            artistName: document.querySelector(SELECTORS.POST_USER_NAME)?.textContent?.trim() || 'Unknown Artist',
            datePublished: Utils.getPostDate('published'),
            dateEdited: Utils.getPostDate('edited'),
            dateImported: Utils.getPostDate('imported')
        }),

        _buildFileName: (item, index) => {
            const meta = DownloadManager._getPostMeta();

            const extMatch = item.fileName.match(/\.([a-z0-9]+)$/i);
            const correctExt = extMatch
                ? extMatch[1].toLowerCase()
                : (item.type === 'video' ? 'mp4' : 'jpg');

            const fileNameWithoutExt = item.fileName.replace(/\.[^/.]+$/, '');

            let formattedName = state.imageFileNameFormat
                .replace(/{date_published}/gi, meta.datePublished)
                .replace(/{date_edited}/gi, meta.dateEdited)
                .replace(/{date_imported}/gi, meta.dateImported)
                .replace(/{date}/gi, meta.datePublished)
                .replace('{title}', Utils.sanitizeFileName(meta.title))
                .replace('{artistName}', Utils.sanitizeFileName(meta.artistName))
                .replace('{fileName}', Utils.sanitizeFileName(fileNameWithoutExt))
                .replace('{index}', index + 1);

            if (!formattedName.toLowerCase().endsWith(`.${correctExt}`)) {
                formattedName += `.${correctExt}`;
            }

            return Utils.sanitizeFileName(formattedName);
        },

        downloadVideo: (url, name) => new Promise(resolve => {
            if (typeof GM_download !== 'function') {
                resolve(false);
                return;
            }

            try {
                GM_download({
                    url,
                    name,
                    onload: () => resolve(true),
                    onerror: () => resolve(false),
                    ontimeout: () => resolve(false)
                });
            } catch (e) {
                console.error('GM_download failed:', e);
                resolve(false);
            }
        }),

        downloadAllImages: async () => {
            if (state.isDownloading) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Download in Progress', 'A download is already running.', 'info');
                } else {
                    alert('A download is already running.');
                }

                return;
            }

            const meta = DownloadManager._getPostMeta();

            const indexedItems = state.originalImageSrcs
                .map((item, index) => ({ item, index }))
                .filter(x => x.item && x.item.src);

            const imageEntries = indexedItems.filter(x => x.item.type !== 'video');
            const videoEntries = indexedItems.filter(x => x.item.type === 'video');

            if (indexedItems.length === 0) {
                state.notificationType = 'warning';
                state.notification = 'No media found to download.';
                return;
            }

            let confirmed = true;

            if (typeof Swal !== 'undefined') {
                const result = await Swal.fire({
                    title: 'Download All?',
                    text: `Create ZIP from ${imageEntries.length} image(s)? (${videoEntries.length} video(s) will be downloaded individually)`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Create ZIP',
                    cancelButtonText: 'Cancel'
                });

                confirmed = result.isConfirmed;
            } else {
                confirmed = confirm(
                    `Create ZIP from ${imageEntries.length} image(s)? (${videoEntries.length} video(s) will be downloaded individually)`
                );
            }

            if (!confirmed) return;

            state.isDownloading = true;
            state.notificationType = 'info';
            state.notification = 'Starting download...';

            if (imageEntries.length === 0) {
                state.notification = `Downloading ${videoEntries.length} video(s)...`;

                const results = await Promise.allSettled(
                    videoEntries.map(x => DownloadManager.downloadVideo(
                        x.item.src,
                        DownloadManager._buildFileName(x.item, x.index)
                    ))
                );

                const ok = results.filter(r => r.status === 'fulfilled' && r.value === true).length;

                state.notification = `Video downloads finished (${ok}/${videoEntries.length} succeeded).`;
                state.notificationType = ok > 0 ? 'success' : 'warning';
                state.isDownloading = false;

                return;
            }

            DownloadManager._pendingVideoPromises = videoEntries.map(x =>
                DownloadManager.downloadVideo(
                    x.item.src,
                    DownloadManager._buildFileName(x.item, x.index)
                )
            );

            const notifyProgress = Utils.throttle((message) => {
                state.notificationType = 'info';
                state.notification = message;
            }, CONFIG.PROGRESS_NOTIFY_INTERVAL);

            const workerCode = `
                self.usedNames = new Set();

                self.onmessage = async (e) => {
                    const { type, data } = e.data;

                    if (type === 'init') {
                        importScripts(data.jszipUrl);
                        self.zip = new self.JSZip();
                        self.filesAdded = 0;
                        self.totalFiles = data.totalFiles;
                        self.usedNames = new Set();
                    } else if (type === 'addFile') {
                        let { blob, name } = data;
                        let finalName = name;
                        let counter = 1;

                        const dotIndex = name.lastIndexOf('.');
                        const baseName = dotIndex > -1 ? name.substring(0, dotIndex) : name;
                        const ext = dotIndex > -1 ? name.substring(dotIndex) : '';

                        while (self.usedNames.has(finalName)) {
                            finalName = \`\${baseName}_\${counter}\${ext}\`;
                            counter++;
                        }

                        self.usedNames.add(finalName);
                        self.zip.file(finalName, blob);
                        self.filesAdded++;

                        self.postMessage({
                            type: 'progress',
                            message: \`Added \${self.filesAdded}/\${self.totalFiles}\`
                        });
                    } else if (type === 'generate') {
                        self.postMessage({
                            type: 'progress',
                            message: 'Bundling files... this may take a moment.'
                        });

                        try {
                            const zipBlob = await self.zip.generateAsync(
                                { type: 'blob', compression: "STORE" },
                                (meta) => {
                                    self.postMessage({
                                        type: 'progress',
                                        message: \`Bundling... \${Math.round(meta.percent)}%\`
                                    });
                                }
                            );

                            self.postMessage({
                                type: 'complete',
                                zipBlob: zipBlob
                            });
                        } catch (err) {
                            self.postMessage({
                                type: 'error',
                                message: err.message
                            });
                        }
                    }
                };
            `;

            const workerBlob = new Blob([workerCode], {
                type: 'application/javascript'
            });

            DownloadManager._workerUrl = URL.createObjectURL(workerBlob);
            DownloadManager._worker = new Worker(DownloadManager._workerUrl);

            DownloadManager._worker.onmessage = (e) => {
                const { type, message, zipBlob } = e.data;

                if (type === 'progress') {
                    notifyProgress(message);
                } else if (type === 'complete') {
                    const sanitizedTitle = Utils.sanitizeFileName(meta.title);
                    const sanitizedArtistName = Utils.sanitizeFileName(meta.artistName);

                    let zipFileName = state.zipFileNameFormat
                        .replace(/{date_published}/gi, meta.datePublished)
                        .replace(/{date_edited}/gi, meta.dateEdited)
                        .replace(/{date_imported}/gi, meta.dateImported)
                        .replace(/{date}/gi, meta.datePublished)
                        .replace('{artistName}', sanitizedArtistName)
                        .replace('{title}', sanitizedTitle);

                    if (!zipFileName.toLowerCase().endsWith('.zip')) {
                        zipFileName += '.zip';
                    }

                    saveAs(zipBlob, zipFileName);

                    const videoPromises = DownloadManager._pendingVideoPromises || [];

                    Promise.allSettled(videoPromises).then(results => {
                        const ok = results.filter(r => r.status === 'fulfilled' && r.value === true).length;

                        if (videoPromises.length > 0) {
                            state.notification = `ZIP complete! Videos: ${ok}/${videoPromises.length} downloaded.`;
                        } else {
                            state.notification = 'Download complete!';
                        }

                        state.notificationType = 'success';
                        DownloadManager.cleanupWorker();
                    });
                } else if (type === 'error') {
                    state.notificationType = 'error';
                    state.notification = `Download failed: ${message}`;

                    DownloadManager.cleanupWorker();
                }
            };

            DownloadManager._worker.postMessage({
                type: 'init',
                data: {
                    jszipUrl: 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
                    totalFiles: imageEntries.length
                }
            });

            const streamFiles = async () => {
                let index = 0;
                let running = 0;
                const concurrencyLimit = CONFIG.MAX_CONCURRENT_FETCHES;

                return new Promise((resolve) => {
                    const next = () => {
                        if (!state.isDownloading || index >= imageEntries.length) {
                            if (running === 0) resolve();
                            return;
                        }

                        while (running < concurrencyLimit && index < imageEntries.length) {
                            const entry = imageEntries[index++];
                            running++;

                            (async () => {
                                try {
                                    const pathInZip = DownloadManager._buildFileName(entry.item, entry.index);

                                    let blob = await getImageFromDexie(entry.item.src);
                                    if (!blob) blob = await ImageLoader.fetchBlobDirect(entry.item.src);

                                    if (blob && state.isDownloading && DownloadManager._worker) {
                                        DownloadManager._worker.postMessage({
                                            type: 'addFile',
                                            data: {
                                                blob,
                                                name: pathInZip
                                            }
                                        });
                                    }
                                } catch (e) {
                                    console.warn(`Skipping ${entry.item.src}`, e);
                                } finally {
                                    running--;
                                    next();
                                }
                            })();
                        }
                    };

                    next();
                }).then(() => {
                    if (state.isDownloading && DownloadManager._worker) {
                        DownloadManager._worker.postMessage({
                            type: 'generate'
                        });
                    }
                });
            };

            streamFiles();
        },

        downloadImageByIndex: async (index) => {
            const item = state.originalImageSrcs[index];

            if (!item || !item.src) {
                state.notificationType = 'warning';
                state.notification = 'No media found at this index.';
                return;
            }

            const formattedName = DownloadManager._buildFileName(item, index);

            if (item.type === 'video') {
                state.notificationType = 'info';
                state.notification = 'Starting video download...';

                const ok = await DownloadManager.downloadVideo(item.src, formattedName);

                state.notification = ok ? 'Video download complete' : 'Video download failed';
                state.notificationType = ok ? 'success' : 'error';
            } else {
                try {
                    let blob = await getImageFromDexie(item.src);
                    if (!blob) blob = await ImageLoader.fetchBlobDirect(item.src);

                    if (blob) {
                        saveAs(blob, formattedName);

                        state.notificationType = 'success';
                        state.notification = 'Download started';
                    } else {
                        state.notificationType = 'error';
                        state.notification = 'Download failed: Blob is null';
                    }
                } catch (e) {
                    state.notificationType = 'error';
                    state.notification = 'Download failed';

                    console.error(e);
                }
            }
        },

        cleanupWorker: () => {
            if (DownloadManager._worker) {
                DownloadManager._worker.terminate();
                DownloadManager._worker = null;
            }

            if (DownloadManager._workerUrl) {
                URL.revokeObjectURL(DownloadManager._workerUrl);
                DownloadManager._workerUrl = null;
            }

            DownloadManager._pendingVideoPromises = [];
            state.isDownloading = false;
        }
    };

    const PostActions = {
        imageLinkClickHandler: event => {
            if (event.button !== 0) return;

            const clickedImageLink =
                event.target.closest(SELECTORS.IMAGE_LINK) ||
                event.target.closest(SELECTORS.VIDEO_LINK);

            if (clickedImageLink) {
                event.preventDefault();
                event.stopPropagation();
            }
        },

        initPostActions: () => {
            try {
                let postActionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);

                if (!postActionsContainer) {
                    const fallbackContainer =
                        document.querySelector('.post__body') ||
                        document.querySelector('.post__files');

                    if (fallbackContainer) {
                        postActionsContainer = document.createElement('div');
                        postActionsContainer.className = 'post__actions ug-injected-ui';
                        fallbackContainer.prepend(postActionsContainer);
                    }
                }

                if (!postActionsContainer) return;

                const globalButtons = document.createElement('div');
                globalButtons.className = 'ug-injected-ui';

                elements.galleryButton = UI.createToggleButton(
                    'Loading Gallery...',
                    Gallery.toggleGallery,
                    true,
                    'GALLERY'
                );

                globalButtons.append(
                    UI.createToggleButton(BUTTONS.HEIGHT, () => PostActions.resizeAllImages('height'), false, 'HEIGHT'),
                    UI.createToggleButton(BUTTONS.WIDTH, () => PostActions.resizeAllImages('width'), false, 'WIDTH'),
                    UI.createToggleButton(BUTTONS.FULL, () => PostActions.resizeAllImages('full'), false, 'FULL'),
                    UI.createToggleButton(BUTTONS.DOWNLOAD_ALL, DownloadManager.downloadAllImages, false, 'DOWNLOAD_ALL'),
                    elements.galleryButton
                );

                postActionsContainer.append(globalButtons);

                if (!document.querySelector('.settings-button-wrapper')) {
                    const settingsButton = document.createElement('button');
                    settingsButton.type = 'button';
                    settingsButton.textContent = BUTTONS.SETTINGS;
                    settingsButton.className = 'settings-button';
                    settingsButton.addEventListener('click', () => state.settingsOpen = !state.settingsOpen);

                    const wrapper = document.createElement('div');
                    wrapper.className = 'settings-button-wrapper ug-injected-ui';
                    wrapper.appendChild(settingsButton);

                    document.body.appendChild(wrapper);

                    elements.settingsButton = settingsButton;
                }

                const filesArea = document.querySelector('div.post__files');

                if (filesArea) {
                    filesArea.querySelectorAll(SELECTORS.FILE_DIVS).forEach(thumbnailDiv => {
                        const imgElement = thumbnailDiv.querySelector('img');
                        if (!imgElement) return;

                        imgElement.classList.add('post__image');

                        const buttonGroupConfig = [
                            {
                                text: BUTTONS.HEIGHT,
                                action: (evt) => PostActions.resizeImage('height', evt),
                                name: 'HEIGHT'
                            },
                            {
                                text: BUTTONS.WIDTH,
                                action: (evt) => PostActions.resizeImage('width', evt),
                                name: 'WIDTH'
                            },
                            {
                                text: BUTTONS.FULL,
                                action: () => ImageLoader.imageActions.full(imgElement),
                                name: 'FULL'
                            },
                            {
                                text: BUTTONS.DOWNLOAD,
                                action: () => {
                                    const link = imgElement.closest('a');
                                    const originalSrc = link
                                        ? (link.href.split('?')[0])
                                        : imgElement.dataset.originalSrc;

                                    const downloadIndex = state.originalImageSrcs.findIndex(
                                        item => item && item.src === originalSrc
                                    );

                                    if (downloadIndex > -1) {
                                        DownloadManager.downloadImageByIndex(downloadIndex);
                                    }
                                },
                                name: 'DOWNLOAD'
                            }
                        ];

                        const buttonGroupElement = UI.createButtonGroup(buttonGroupConfig);

                        if (buttonGroupElement.childElementCount > 0) {
                            buttonGroupElement.classList.add('ug-injected-ui');
                            thumbnailDiv.parentNode.insertBefore(buttonGroupElement, thumbnailDiv);
                        }
                    });

                    if (!filesArea.dataset.ugLeftClickHandlerAttached) {
                        filesArea.addEventListener('click', PostActions.imageLinkClickHandler);
                        filesArea.dataset.ugLeftClickHandlerAttached = 'true';
                    }
                }

                ImageLoader.loadImages();
                state.currentPostUrl = window.location.href;
            } catch (error) {
                console.error('Error initializing post actions:', error);
            }
        },

        cleanupPostActions: () => {
            state.currentLoadSessionId = null;

            ErrorHandler.clearRetries();
            UI.forceHideNotification();

            document.querySelectorAll('img.post__image.ug-image-loaded').forEach(img => {
                img.classList.remove('ug-image-loaded');
            });

            document.querySelectorAll('.ug-injected-ui').forEach(el => el.remove());

            const notifArea = document.getElementById(CSS.NOTIF_AREA);
            if (notifArea) notifArea.remove();

            const filesArea = document.querySelector('div.post__files');
            if (filesArea) {
                filesArea.removeEventListener('click', PostActions.imageLinkClickHandler);
                filesArea.removeAttribute('data-ug-left-click-handler-attached');
            }

            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else if (galleryOverlay && galleryOverlay.length) {
                galleryOverlay.remove();
                galleryOverlay = null;
                $(document).off('.galleryDrag');
            }

            if (state.settingsOpen) {
                state.settingsOpen = false;
            } else {
                const settingsOverlay = document.getElementById('ug-settings-overlay');
                if (settingsOverlay) settingsOverlay.remove();
            }

            BlobManager.revokeAll();
            loadedBlobUrls.clear();

            state.notification = null;

            Object.assign(state, {
                fullSizeImageSrcs: [],
                originalImageSrcs: [],
                galleryReady: false,
                loadedImages: 0,
                totalImages: 0,
                errorCount: 0,
                isLoading: false
            });

            elements = {
                galleryButton: null,
                settingsButton: null
            };
        },

        updateButtonVisibilityLight: () => {
            const hideMap = {
                FULL: state.hideFullButton,
                DOWNLOAD: state.hideDownloadButton,
                HEIGHT: state.hideHeightButton,
                WIDTH: state.hideWidthButton
            };

            document.querySelectorAll(`.${CSS.BTN}[data-action]`).forEach(btn => {
                const action = btn.dataset.action;

                if (Object.prototype.hasOwnProperty.call(hideMap, action)) {
                    btn.style.display = hideMap[action] ? 'none' : '';
                }
            });

            if (galleryOverlay && galleryOverlay.length) {
                galleryOverlay.find(`.${CSS.GALLERY.NAV}`).toggle(!state.hideNavArrows);
            }
        },

        updateButtonVisibility: () => PostActions.updateButtonVisibilityLight(),

        resizeAllImages: action => {
            if (!ImageLoader.imageActions[action]) return;

            state.currentResizeMode = action;

            document.querySelectorAll('img.post__image').forEach(img => {
                ImageLoader.imageActions[action](img);
            });
        },

        resizeImage: (action, evt) => {
            if (!ImageLoader.imageActions[action]) return;

            state.currentResizeMode = action;

            const button = evt.currentTarget;
            let thumbContainer = button.closest('.post__thumbnail, .scrape__thumbnail');

            if (!thumbContainer) {
                const buttonContainer = button.closest(`.${CSS.BTN_CONTAINER}`);
                thumbContainer = buttonContainer?.nextElementSibling;
            }

            const displayedImage = thumbContainer?.querySelector('img.post__image');
            if (displayedImage) ImageLoader.imageActions[action](displayedImage);
        }
    };

    const EventHandlers = {
        keyMatchesSetting: (eventKey, settingValue) => {
            return Boolean(settingValue) &&
                String(eventKey).toLowerCase() === String(settingValue).toLowerCase();
        },

        handleGlobalKeyDown: event => {
            const activeEl = document.activeElement;

            if (
                activeEl &&
                (
                    activeEl.isContentEditable ||
                    ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)
                )
            ) {
                return;
            }

            const keyLower = event.key.toLowerCase();

            if (
                Utils.isPostPage() &&
                EventHandlers.keyMatchesSetting(event.key, state.galleryKey)
            ) {
                if (!event.altKey && !event.ctrlKey && !event.metaKey) {
                    event.preventDefault();

                    if (state.galleryReady) {
                        Gallery.toggleGallery();
                    } else {
                        state.notificationType = 'info';
                        state.notification = 'Gallery content is still loading.';
                    }
                }

                return;
            }

            if (state.settingsOpen && event.key === 'Escape') {
                event.preventDefault();
                state.settingsOpen = false;
                return;
            }

            if (state.isGalleryMode && galleryOverlay && galleryOverlay.length) {
                const $expandedView = galleryOverlay.find(`.${CSS.GALLERY.EXPANDED_VIEW}`);

                if (event.key === 'Escape') {
                    event.preventDefault();
                    Gallery.closeGallery();
                    return;
                }

                if (!$expandedView.hasClass(CSS.GALLERY.HIDE)) {
                    if (
                        EventHandlers.keyMatchesSetting(event.key, state.nextImageKey) ||
                        keyLower === 'arrowright'
                    ) {
                        event.preventDefault();
                        Gallery.nextImage();
                    } else if (
                        EventHandlers.keyMatchesSetting(event.key, state.prevImageKey) ||
                        keyLower === 'arrowleft'
                    ) {
                        event.preventDefault();
                        Gallery.prevImage();
                    } else if (event.key === 'Home') {
                        event.preventDefault();
                        Gallery.showExpandedView(0);
                    } else if (event.key === 'End') {
                        event.preventDefault();
                        Gallery.showExpandedView(state.fullSizeImageSrcs.length - 1);
                    }

                    if (keyLower === '+' || keyLower === '=') {
                        event.preventDefault();
                        Zoom.zoom(CONFIG.ZOOM_STEP);
                    } else if (keyLower === '-') {
                        event.preventDefault();
                        Zoom.zoom(-CONFIG.ZOOM_STEP);
                    } else if (keyLower === '0') {
                        event.preventDefault();
                        Zoom.resetZoom();
                    } else if (keyLower === ' ') {
                        event.preventDefault();
                        Slideshow.toggle();
                    }
                }
            }
        }
    };

    const updateGalleryButton = enabled => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = enabled ? BUTTONS.GALLERY : 'Loading Gallery...';
            elements.galleryButton.disabled = !enabled;
            elements.galleryButton.classList.toggle('disabled', !enabled);
        }
    };

    // ====================================================
    // SPA-safe UI injection
    // ====================================================
    const injectUI = () => {
        try {
            const onPostPage = Utils.isPostPage();

            const postContainer =
                document.querySelector('section.site-section--post') ||
                document.querySelector('section.site-section--scrape') ||
                document.querySelector('.post__body') ||
                document.querySelector('.post__content');

            const currentUrl = window.location.href;

            if (onPostPage && postContainer) {
                if (currentUrl !== lastProcessedUrl) {
                    if (
                        document.querySelector(SELECTORS.POST_ACTIONS) ||
                        document.querySelector('.post__files') ||
                        document.querySelector('.post__body')
                    ) {
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
        }
    };

    const fullCleanup = () => {
        if (uiObserver) {
            uiObserver.disconnect();
            uiObserver = null;
        }

        PostActions.cleanupPostActions();
        Gallery._clearPreloadCache();
        DownloadManager.cleanupWorker();
        UI.forceHideNotification();
        ErrorHandler.clearRetries();
        ThumbnailStrip.cleanup();

        document.removeEventListener('keydown', EventHandlers.handleGlobalKeyDown);
    };

    // ====================================================
    // Initialization
    // ====================================================
    const init = async () => {
        try {
            const cssText = GM_getResourceText('mainCSS');
            if (cssText) {
                const styleNode = GM_addStyle(cssText);
                // Pawchive's htmx swap script strips any <style> in <head> without 'data-keep'.
                if (styleNode && styleNode.setAttribute) {
                    styleNode.setAttribute('data-keep', '');
                } else {
                    const lastStyle = document.head.querySelector('style:last-of-type');
                    if (lastStyle) lastStyle.setAttribute('data-keep', '');
                }
            } else {
                console.warn('Ultra Galleries: Failed to load main CSS resource.');
            }

            Slideshow.init();
            const allSettings = SettingsManager.loadAllSettings();
            Object.assign(state, allSettings);
            document.body.classList.toggle('ug-animations-disabled', !state.animationsEnabled);
            updateButtonLabels();
            state.notification = null;
            if (state.enablePersistentCaching) {
                initDexie();
            }
            CONFIG.MAX_SCALE = SettingsManager.loadSetting('maxZoomScale', CONFIG.MAX_SCALE);
            document.addEventListener('keydown', EventHandlers.handleGlobalKeyDown);
            window.addEventListener('beforeunload', fullCleanup);

            // SPA Navigation Handling
            const originalPushState = history.pushState;
            history.pushState = function () {
                originalPushState.apply(this, arguments);
                window.dispatchEvent(new Event('ug-locationchange'));
            };
            const originalReplaceState = history.replaceState;
            history.replaceState = function () {
                originalReplaceState.apply(this, arguments);
                window.dispatchEvent(new Event('ug-locationchange'));
            };
            window.addEventListener('popstate', () => {
                window.dispatchEvent(new Event('ug-locationchange'));
            });
            window.addEventListener('ug-locationchange', Utils.debounce(injectUI, 150));

            const debouncedInject = Utils.debounce(injectUI, 150);
            uiObserver = new MutationObserver(debouncedInject);
            uiObserver.observe(document.body, { childList: true, subtree: true });
            injectUI();
            setTimeout(() => ThumbnailStrip.updateThumbnailNumbers(), 50);
        } catch (error) {
            console.error('Error in init:', error);
        }
    };

    init();
})();
