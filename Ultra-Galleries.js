// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1477603-%E3%83%A1%E3%83%AA%E3%83%BC
// @version      4.0.1
// @description  Modern image gallery with highly efficient background zipping, video playback, browsing, fullscreen, and download features. Native DOM, unified pointer gestures, and zero external UI dependencies.
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
// @grant        GM_download
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getResourceText
// @resource     mainCSS https://cdn.jsdelivr.net/gh/TearTyr/Ultra-Galleries@TestingBranch/Ultra-Galleries.css
// @resource     jszipScript https://unpkg.com/jszip@3.10.1/dist/jszip.min.js
// @downloadURL  https://update.sleazyfork.org/scripts/537986/Ultra%20Galleries.user.js
// @updateURL    https://update.sleazyfork.org/scripts/537986/Ultra%20Galleries.meta.js
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    // ====================================================
    // Core Configuration & Constants
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
    // Native DOM Helpers
    // ====================================================
    const DOM = {
        $(selector, parent = document) {
            return parent.querySelector(selector);
        },

        $$(selector, parent = document) {
            return Array.from(parent.querySelectorAll(selector));
        },

        create(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);
            for (const [key, value] of Object.entries(attributes)) {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'html') {
                    element.innerHTML = value;
                } else if (key === 'text') {
                    element.textContent = value;
                } else if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else if (key.startsWith('on') && typeof value === 'function') {
                    element.addEventListener(key.slice(2).toLowerCase(), value);
                } else if (key.startsWith('data-')) {
                    element.setAttribute(key, value);
                } else {
                    element.setAttribute(key, value);
                }
            }

            const childArray = Array.isArray(children) ? children : [children];
            for (const child of childArray) {
                if (!child) continue;
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    element.appendChild(child);
                }
            }
            return element;
        },

        scrollToCenter(container, element) {
            if (!container || !element) return;
            const offset = element.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
            container.scrollTo({ left: offset, behavior: 'smooth' });
        },

        saveBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
    };

    // ====================================================
    // Built-in Native Modal System (Replaces SweetAlert2)
    // ====================================================
    const UGModal = {
        confirm({ title, text, confirmText = 'Confirm', cancelText = 'Cancel', icon = 'question' }) {
            return new Promise((resolve) => {
                DOM.$('.ug-modal-overlay')?.remove();

                const iconSvgs = {
                    question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
                };

                const actions = [];
                const confirmBtn = DOM.create('button', {
                    className: 'ug-modal-btn ug-modal-confirm',
                    text: confirmText,
                    onclick: () => close(true)
                });
                actions.push(confirmBtn);

                if (cancelText) {
                    const cancelBtn = DOM.create('button', {
                        className: 'ug-modal-btn ug-modal-cancel',
                        text: cancelText,
                        onclick: () => close(false)
                    });
                    actions.push(cancelBtn);
                }

                const overlay = DOM.create('div', { className: 'ug-modal-overlay' }, [
                    DOM.create('div', { className: 'ug-modal-container' }, [
                        DOM.create('div', { className: `ug-modal-icon ${icon}`, html: iconSvgs[icon] || iconSvgs.info }),
                        DOM.create('h3', { className: 'ug-modal-title', text: title }),
                        DOM.create('p', { className: 'ug-modal-text', text: text }),
                        DOM.create('div', { className: 'ug-modal-actions' }, actions)
                    ])
                ]);

                document.body.appendChild(overlay);
                requestAnimationFrame(() => overlay.classList.add('show'));
                confirmBtn.focus();

                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        close(false);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        close(true);
                    }
                };
                window.addEventListener('keydown', onKey);

                function close(result) {
                    window.removeEventListener('keydown', onKey);
                    overlay.classList.remove('show');
                    setTimeout(() => overlay.remove(), 200);
                    resolve({ isConfirmed: result });
                }
            });
        },

        alert(title, text, icon = 'info') {
            return UGModal.confirm({ title, text, confirmText: 'OK', cancelText: null, icon });
        }
    };

    // ====================================================
    // Native IndexedDB Cache Manager (Replaces Dexie)
    // ====================================================
    const ImageCacheDB = {
        DB_NAME: 'UltraGalleriesCache',
        STORE_NAME: 'imageCache',
        dbPromise: null,

        init() {
            if (this.dbPromise) return this.dbPromise;
            this.dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(this.DB_NAME, 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                        const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'url' });
                        store.createIndex('cachedAt', 'cachedAt', { unique: false });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            return this.dbPromise;
        },

        async get(url) {
            try {
                const db = await this.init();
                return new Promise((resolve) => {
                    const tx = db.transaction(this.STORE_NAME, 'readwrite');
                    const store = tx.objectStore(this.STORE_NAME);
                    const req = store.get(url);
                    req.onsuccess = () => {
                        const record = req.result;
                        if (record && record.blob) {
                            record.cachedAt = Date.now();
                            store.put(record);
                            resolve(record.blob);
                        } else {
                            resolve(null);
                        }
                    };
                    req.onerror = () => resolve(null);
                });
            } catch {
                return null;
            }
        },

        async put(url, blob) {
            try {
                const db = await this.init();
                return new Promise((resolve) => {
                    const tx = db.transaction(this.STORE_NAME, 'readwrite');
                    tx.objectStore(this.STORE_NAME).put({ url, blob, cachedAt: Date.now() });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = async (e) => {
                        if (e.target.error && e.target.error.name === 'QuotaExceededError') {
                            await this.evictOldest(CONFIG.CACHE_EVICTION_COUNT);
                        }
                        resolve(false);
                    };
                });
            } catch {
                return false;
            }
        },

        async evictOldest(count = 20) {
            try {
                const db = await this.init();
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                const index = store.index('cachedAt');
                let deleted = 0;
                index.openCursor().onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && deleted < count) {
                        cursor.delete();
                        deleted++;
                        cursor.continue();
                    }
                };
            } catch {
                // Ignore eviction errors
            }
        },

        async clear() {
            try {
                const db = await this.init();
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                tx.objectStore(this.STORE_NAME).clear();
                state.notificationType = 'success';
                state.notification = 'Persistent image cache cleared.';
            } catch {
                state.notificationType = 'error';
                state.notification = 'Error clearing cache.';
            }
        }
    };

    // ====================================================
    // Shared Mutable References
    // ====================================================
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
    // Utilities
    // ====================================================
    const Utils = {
        sanitizeFileName: name => String(name || '').replace(/[/\\:*?"<>|]/g, '-'),

        getPostDate: (type = 'published') => {
            let selector;
            if (type === 'edited') selector = '.post__edited, .scrape__edited';
            else if (type === 'added' || type === 'imported') selector = '.post__added, .scrape__added';
            else selector = '.post__published, .scrape__published, time[datetime]';

            const timeEl = DOM.$(selector);
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
                DOM.$(SELECTORS.IMAGE_LINK) ||
                DOM.$(SELECTORS.GENERIC_IMAGE_LINK) ||
                DOM.$('div.post__files');

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

        ensureThumbnailsExist: () => {
            try {
                const videoLinks = DOM.$$(SELECTORS.VIDEO_LINK);
                videoLinks.forEach(videoLink => {
                    const videoThumb = videoLink.closest(SELECTORS.VIDEO_THUMBNAIL);
                    if (!videoThumb) {
                        const video = videoLink.querySelector('video');
                        if (video && video.hasAttribute('poster')) {
                            const posterUrl = video.getAttribute('poster');
                            if (videoLink.parentNode) {
                                const thumbnailContainer = DOM.create('div', {
                                    className: isNekohouse ? 'scrape__video-thumbnail' : 'post__video-thumbnail'
                                }, [
                                    DOM.create('img', {
                                        src: posterUrl,
                                        className: isNekohouse ? 'scrape__thumbnail-img' : 'post__thumbnail-img'
                                    })
                                ]);
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

    const notifyLoadProgress = Utils.throttle((message, type = 'info') => {
        state.notificationType = type;
        state.notification = message;
    }, CONFIG.PROGRESS_NOTIFY_INTERVAL);

    // ====================================================
    // Image Sizing Module
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
    // Unified Pointer Events & Gesture Engine
    // ====================================================
    const PointerEngine = {
        activePointers: new Map(),
        isDragging: false,
        dragStartTime: 0,
        lastUpdateTime: 0,
        velocity: { x: 0, y: 0 },
        lastPosition: { x: 0, y: 0 },
        animationFrame: null,
        inertiaAnimation: null,
        cachedImgEl: null,
        cachedZoomEl: null,
        lastTapTime: 0,

        init(containerDOM) {
            containerDOM.addEventListener('pointerdown', PointerEngine.onPointerDown, { passive: false });
            containerDOM.addEventListener('pointermove', PointerEngine.onPointerMove, { passive: false });
            containerDOM.addEventListener('pointerup', PointerEngine.onPointerUp, { passive: false });
            containerDOM.addEventListener('pointercancel', PointerEngine.onPointerUp, { passive: false });
        },

        updateTransform() {
            if (!PointerEngine.cachedImgEl && galleryOverlay) {
                const container = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
                PointerEngine.cachedImgEl = container?.querySelector('img, video');
                PointerEngine.cachedZoomEl = DOM.$('#zoom-level');
            }

            if (PointerEngine.cachedImgEl) {
                PointerEngine.cachedImgEl.style.transformOrigin = '0 0';
                PointerEngine.cachedImgEl.style.transform =
                    `translate(${viewState.imageOffset.x}px, ${viewState.imageOffset.y}px) scale(${viewState.zoomScale})`;
            }

            if (PointerEngine.cachedZoomEl) {
                PointerEngine.cachedZoomEl.textContent = `${Math.round(viewState.zoomScale * 100)}%`;
            }

            PointerEngine.animationFrame = null;
        },

        onPointerDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();

            PointerEngine.activePointers.set(e.pointerId, e);
            const container = e.currentTarget;
            container.setPointerCapture(e.pointerId);

            if (PointerEngine.inertiaAnimation) {
                cancelAnimationFrame(PointerEngine.inertiaAnimation);
                PointerEngine.inertiaAnimation = null;
            }

            if (PointerEngine.activePointers.size === 1) {
                const now = Date.now();
                if (now - PointerEngine.lastTapTime < CONFIG.DOUBLE_TAP_THRESHOLD) {
                    PointerEngine.handleDoubleTap(e);
                    PointerEngine.lastTapTime = 0;
                    return;
                }
                PointerEngine.lastTapTime = now;

                PointerEngine.isDragging = true;
                PointerEngine.dragStartTime = performance.now();
                PointerEngine.lastUpdateTime = PointerEngine.dragStartTime;

                viewState.dragStartPosition = { x: e.clientX, y: e.clientY };
                viewState.dragStartOffset = { x: viewState.imageOffset.x, y: viewState.imageOffset.y };
                PointerEngine.lastPosition = { x: e.clientX, y: e.clientY };
                PointerEngine.velocity = { x: 0, y: 0 };

                container.classList.add(CSS.GALLERY.GRABBING);
                container.style.willChange = 'transform';
            } else if (PointerEngine.activePointers.size === 2) {
                PointerEngine.isDragging = false;
                viewState.pinchZoomActive = true;
                const [p1, p2] = Array.from(PointerEngine.activePointers.values());
                viewState.initialTouchDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
                viewState.initialScale = viewState.zoomScale;

                const rect = container.getBoundingClientRect();
                viewState.zoomOrigin = {
                    x: ((p1.clientX + p2.clientX) / 2) - rect.left,
                    y: ((p1.clientY + p2.clientY) / 2) - rect.top
                };
            }
        },

        onPointerMove(e) {
            if (!PointerEngine.activePointers.has(e.pointerId)) return;
            e.preventDefault();
            PointerEngine.activePointers.set(e.pointerId, e);

            if (PointerEngine.isDragging && PointerEngine.activePointers.size === 1) {
                const currentTime = performance.now();
                const deltaTime = currentTime - PointerEngine.lastUpdateTime;

                if (deltaTime > 0) {
                    PointerEngine.velocity.x = (e.clientX - PointerEngine.lastPosition.x) / deltaTime * 16;
                    PointerEngine.velocity.y = (e.clientY - PointerEngine.lastPosition.y) / deltaTime * 16;
                }

                PointerEngine.lastPosition = { x: e.clientX, y: e.clientY };
                PointerEngine.lastUpdateTime = currentTime;

                const deltaX = e.clientX - viewState.dragStartPosition.x;
                const deltaY = e.clientY - viewState.dragStartPosition.y;

                viewState.imageOffset.x = viewState.dragStartOffset.x + deltaX;
                viewState.imageOffset.y = viewState.dragStartOffset.y + deltaY;

                if (!PointerEngine.animationFrame) {
                    PointerEngine.animationFrame = requestAnimationFrame(PointerEngine.updateTransform);
                }
            } else if (viewState.pinchZoomActive && PointerEngine.activePointers.size === 2) {
                const [p1, p2] = Array.from(PointerEngine.activePointers.values());
                const currentDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
                if (viewState.initialTouchDistance === 0) return;

                const scaleFactor = currentDistance / viewState.initialTouchDistance;
                const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.initialScale * scaleFactor, CONFIG.MAX_SCALE));

                const imageX = (viewState.zoomOrigin.x - viewState.imageOffset.x) / viewState.zoomScale;
                const imageY = (viewState.zoomOrigin.y - viewState.imageOffset.y) / viewState.zoomScale;

                viewState.imageOffset.x = viewState.zoomOrigin.x - (imageX * newScale);
                viewState.imageOffset.y = viewState.zoomOrigin.y - (imageY * newScale);
                viewState.zoomScale = newScale;

                PointerEngine.updateTransform();
            }
        },

        onPointerUp(e) {
            if (PointerEngine.activePointers.has(e.pointerId)) {
                try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                    // Ignore capture errors
                }
                PointerEngine.activePointers.delete(e.pointerId);
            }

            if (PointerEngine.activePointers.size === 0) {
                if (PointerEngine.isDragging) {
                    PointerEngine.isDragging = false;
                    const container = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
                    if (container) {
                        container.classList.remove(CSS.GALLERY.GRABBING);
                        setTimeout(() => container.style.willChange = '', 1000);
                    }

                    if (state.inertiaEnabled && (Math.abs(PointerEngine.velocity.x) > 0.5 || Math.abs(PointerEngine.velocity.y) > 0.5)) {
                        PointerEngine.applyInertia();
                    } else {
                        PointerEngine.enforceBoundaries();
                    }
                }
                viewState.pinchZoomActive = false;
            } else if (PointerEngine.activePointers.size === 1) {
                const remaining = PointerEngine.activePointers.values().next().value;
                viewState.dragStartPosition = { x: remaining.clientX, y: remaining.clientY };
                viewState.dragStartOffset = { ...viewState.imageOffset };
                PointerEngine.lastPosition = { x: remaining.clientX, y: remaining.clientY };
                PointerEngine.isDragging = true;
            }
        },

        applyInertia() {
            const friction = 0.95;
            const minVelocity = 0.5;

            const animate = () => {
                PointerEngine.velocity.x *= friction;
                PointerEngine.velocity.y *= friction;

                viewState.imageOffset.x += PointerEngine.velocity.x;
                viewState.imageOffset.y += PointerEngine.velocity.y;

                if (Math.abs(PointerEngine.velocity.x) < minVelocity && Math.abs(PointerEngine.velocity.y) < minVelocity) {
                    PointerEngine.inertiaAnimation = null;
                    PointerEngine.enforceBoundaries();
                    return;
                }

                PointerEngine.updateTransform();
                PointerEngine.inertiaAnimation = requestAnimationFrame(animate);
            };

            PointerEngine.inertiaAnimation = requestAnimationFrame(animate);
        },

        enforceBoundaries() {
            if (!galleryOverlay) return;
            const containerDOM = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
            const imageDOM = DOM.$(`.${CSS.GALLERY.MAIN_IMG}`, containerDOM);
            if (!containerDOM || !imageDOM) return;

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

                    PointerEngine.updateTransform();

                    if (progress < 1) {
                        requestAnimationFrame(animateToBoundary);
                    }
                };

                requestAnimationFrame(animateToBoundary);
            }
        },

        handleDoubleTap(e) {
            e.preventDefault();
            if (!galleryOverlay) return;

            const containerDOM = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
            if (!containerDOM) return;

            const rect = containerDOM.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            if (viewState.zoomScale > 1) {
                Zoom.resetZoom();
            } else {
                const newScale = 2.5;
                const imageX = (clickX - viewState.imageOffset.x) / viewState.zoomScale;
                const imageY = (clickY - viewState.imageOffset.y) / viewState.zoomScale;

                const newOffsetX = clickX - (imageX * newScale);
                const newOffsetY = clickY - (imageY * newScale);

                Zoom._applyTransition(containerDOM, () => {
                    viewState.imageOffset.x = newOffsetX;
                    viewState.imageOffset.y = newOffsetY;
                    viewState.zoomScale = newScale;
                    PointerEngine.updateTransform();
                });
            }
        }
    };

    // ====================================================
    // Slideshow Module
    // ====================================================
    const Slideshow = {
        interval: null,
        isActive: false,
        delay: CONFIG.SLIDESHOW_DELAY,
        pauseOnHover: true,

        init() {
            Slideshow.delay = SettingsManager.loadSetting('slideshowDelay', CONFIG.SLIDESHOW_DELAY);
            Slideshow.pauseOnHover = SettingsManager.loadSetting('slideshowPauseOnHover', true);
        },

        start() {
            if (Slideshow.isActive) return;
            Slideshow.isActive = true;
            state.isSlideshowActive = true;
            Slideshow.interval = setInterval(() => Gallery.nextImage(), Slideshow.delay);
            Slideshow.showIndicator();

            if (Slideshow.pauseOnHover && galleryOverlay) {
                galleryOverlay.addEventListener('mouseenter', Slideshow.pause);
                galleryOverlay.addEventListener('mouseleave', Slideshow.resume);
            }
            Slideshow.syncControls();
            Accessibility.announce('Slideshow started');
            state.notificationType = 'info';
            state.notification = 'Slideshow started';
        },

        stop() {
            if (!Slideshow.isActive) return;
            Slideshow.isActive = false;
            state.isSlideshowActive = false;
            if (Slideshow.interval) {
                clearInterval(Slideshow.interval);
                Slideshow.interval = null;
            }
            if (galleryOverlay) {
                Slideshow.hideIndicator();
                galleryOverlay.removeEventListener('mouseenter', Slideshow.pause);
                galleryOverlay.removeEventListener('mouseleave', Slideshow.resume);
            }
            Slideshow.syncControls();
            Accessibility.announce('Slideshow stopped');
            state.notificationType = 'info';
            state.notification = 'Slideshow stopped';
        },

        pause() {
            if (Slideshow.interval && Slideshow.isActive) {
                clearInterval(Slideshow.interval);
                Slideshow.interval = null;
                Slideshow.updateIndicator(true);
                Slideshow.syncControls();
            }
        },

        resume() {
            if (!Slideshow.interval && Slideshow.isActive) {
                Slideshow.interval = setInterval(() => Gallery.nextImage(), Slideshow.delay);
                Slideshow.updateIndicator(false);
                Slideshow.syncControls();
            }
        },

        toggle() {
            Slideshow.isActive ? Slideshow.stop() : Slideshow.start();
        },

        handleButton() {
            if (!Slideshow.isActive) Slideshow.start();
            else if (Slideshow.interval) Slideshow.pause();
            else Slideshow.resume();
        },

        syncControls() {
            if (!galleryOverlay) return;
            const btn = DOM.$('#slideshow-btn', galleryOverlay);
            if (!btn) return;

            if (!Slideshow.isActive) {
                btn.innerHTML = '▶';
                btn.setAttribute('title', 'Start Slideshow (Space)');
                btn.classList.remove('slideshow-running', 'slideshow-paused');
            } else if (Slideshow.interval) {
                btn.innerHTML = '❚❚';
                btn.setAttribute('title', 'Pause Slideshow');
                btn.classList.add('slideshow-running');
                btn.classList.remove('slideshow-paused');
            } else {
                btn.innerHTML = '▶';
                btn.setAttribute('title', 'Resume Slideshow');
                btn.classList.add('slideshow-paused');
                btn.classList.remove('slideshow-running');
            }
        },

        showIndicator() {
            if (!galleryOverlay || DOM.$('.ug-slideshow-indicator', galleryOverlay)) return;
            const toolbar = DOM.$(`.${CSS.GALLERY.TOOLBAR}`, galleryOverlay);
            if (!toolbar) return;

            const indicator = DOM.create('div', { className: 'ug-slideshow-indicator' }, [
                DOM.create('span', { className: 'ug-slideshow-icon', text: '▶' }),
                DOM.create('span', { className: 'ug-slideshow-text', text: 'Slideshow' }),
                DOM.create('button', {
                    className: 'ug-slideshow-stop',
                    title: 'Stop slideshow',
                    text: '✕',
                    onclick: (e) => {
                        e.stopPropagation();
                        Slideshow.stop();
                    }
                })
            ]);
            toolbar.appendChild(indicator);
        },

        hideIndicator() {
            DOM.$('.ug-slideshow-indicator', galleryOverlay)?.remove();
        },

        updateIndicator(isPaused) {
            const indicator = DOM.$('.ug-slideshow-indicator', galleryOverlay);
            if (!indicator) return;
            const icon = DOM.$('.ug-slideshow-icon', indicator);
            if (isPaused) {
                if (icon) icon.textContent = '❚❚';
                indicator.classList.add('paused');
            } else {
                if (icon) icon.textContent = '▶';
                indicator.classList.remove('paused');
            }
        },

        setDelay(delay) {
            Slideshow.delay = delay;
            SettingsManager.saveSetting('slideshowDelay', delay);
            if (Slideshow.isActive) {
                Slideshow.stop();
                Slideshow.start();
            }
        }
    };

    // ====================================================
    // Error Handler Module
    // ====================================================
    const ErrorHandler = {
        retryAttempts: new Map(),

        async handleImageError(error, url, element = null, context = {}) {
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

        showErrorPlaceholder(element, url, context) {
            if (!element) return;

            const errorContainer = DOM.create('div', { className: 'ug-error-container' }, [
                DOM.create('div', {
                    className: 'ug-error-icon',
                    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>'
                }),
                DOM.create('div', { className: 'ug-error-message', text: 'Failed to load image' }),
                DOM.create('button', {
                    className: 'ug-error-retry',
                    text: 'Retry',
                    title: 'Retry loading',
                    onclick: () => {
                        if (errorContainer.parentNode) {
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
                    }
                })
            ]);

            if (element.parentNode) {
                element.parentNode.replaceChild(errorContainer, element);
            }
        },

        clearRetries() {
            ErrorHandler.retryAttempts.clear();
        }
    };

    // ====================================================
    // Settings Manager
    // ====================================================
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
                } catch {
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

    // ====================================================
    // Accessibility Module
    // ====================================================
    const Accessibility = {
        init() {
            if (galleryOverlay) {
                galleryOverlay.setAttribute('role', 'dialog');
                galleryOverlay.setAttribute('aria-modal', 'true');
                galleryOverlay.setAttribute('aria-label', 'Image Gallery');
            }

            if (!DOM.$('.ug-sr-only')) {
                const liveRegion = DOM.create('div', {
                    className: 'ug-sr-only',
                    'aria-live': 'polite',
                    'aria-atomic': 'true'
                });
                document.body.appendChild(liveRegion);
            }
        },

        announce(message) {
            const sr = DOM.$('.ug-sr-only');
            if (sr) sr.textContent = message;
        }
    };

    // ====================================================
    // Blob Manager
    // ====================================================
    const BlobManager = {
        blobUrls: new Set(),

        createUrl(blob) {
            if (!blob) return '';
            const url = URL.createObjectURL(blob);
            BlobManager.blobUrls.add(url);
            return url;
        },

        revokeUrl(url) {
            if (typeof url === 'string' && url.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(url);
                    BlobManager.blobUrls.delete(url);
                } catch {
                    // Ignore revoke errors
                }
            }
        },

        revokeAll() {
            BlobManager.blobUrls.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch {
                    // Ignore revoke errors
                }
            });
            BlobManager.blobUrls.clear();
        }
    };

    // ====================================================
    // State Manager & Reactive State
    // ====================================================
    const StateManager = {
        generateSessionId: () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),

        withSessionCheck(callback) {
            return (value, oldValue) => {
                if (state.currentLoadSessionId === null) return;
                callback(value, oldValue);
            };
        },

        createReactiveState(initialState, updateCallbacks = {}) {
            return new Proxy(initialState, {
                set(target, key, value) {
                    const oldValue = target[key];
                    target[key] = value;
                    if (updateCallbacks[key]) {
                        try {
                            updateCallbacks[key](value, oldValue);
                        } catch (e) {
                            console.error(`Error in state callback for "${key}":`, e);
                        }
                    }
                    return true;
                }
            });
        }
    };

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
        controlsVisible(value) {
            if (galleryOverlay) {
                const toolbar = DOM.$(`.${CSS.GALLERY.TOOLBAR}`, galleryOverlay);
                const expandedView = DOM.$(`.${CSS.GALLERY.EXPANDED_VIEW}`, galleryOverlay);
                toolbar?.classList.toggle(CSS.GALLERY.CONTROLS_HIDDEN, !value);
                expandedView?.classList.toggle(CSS.GALLERY.CONTROLS_HIDDEN, !value);
            }
        },

        galleryReady(value) {
            updateGalleryButton(value);
        },

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

        notification(value) {
            if (value) UI.showNotification(value, state.notificationType);
            else UI.hideNotification();
        },

        notificationType(value) {
            const container = document.getElementById(CSS.NOTIF_CONTAINER);
            if (container && state.notification && container.style.display === 'flex') {
                container.classList.remove('info', 'success', 'error', 'warning');
                container.classList.add(value);
            }
        },

        settingsOpen(value) {
            value ? UI.showSettings() : UI.closeSettings();
        },

        isFullscreen(value) {
            SettingsManager.saveSetting('isFullscreen', value);
            if (value) {
                document.body.classList.add('ug-fullscreen');
                galleryOverlay?.classList.add(CSS.GALLERY.FULLSCREEN_OVERLAY);
            } else {
                document.body.classList.remove('ug-fullscreen');
                galleryOverlay?.classList.remove(CSS.GALLERY.FULLSCREEN_OVERLAY);
            }
        },

        zoomEnabled(value) {
            SettingsManager.saveSetting('zoomEnabled', value);
        },

        animationsEnabled(value) {
            SettingsManager.saveSetting('animationsEnabled', value);
            document.body.classList.toggle('ug-animations-disabled', !value);
        },

        bottomStripeVisible(value) {
            SettingsManager.saveSetting('bottomStripeVisible', value);
            if (galleryOverlay) {
                const stripContainer = DOM.$(`.${CSS.GALLERY.STRIP_CONTAINER}`, galleryOverlay);
                if (stripContainer) stripContainer.style.display = value ? 'flex' : 'none';
            }
        },

        isDragging(value) {
            if (galleryOverlay) {
                const container = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
                container?.classList.toggle(CSS.GALLERY.GRABBING, value);
            }
        },

        notificationPosition(value) {
            SettingsManager.saveSetting('notificationPosition', value);
            const notifArea = document.getElementById(CSS.NOTIF_AREA);
            if (notifArea) {
                notifArea.style.top = value === 'top' ? '10px' : 'auto';
                notifArea.style.bottom = value === 'bottom' ? '10px' : 'auto';
            }
        },

        enablePersistentCaching(value) {
            SettingsManager.saveSetting('enablePersistentCaching', value);
            if (value) ImageCacheDB.init();
        },

        currentResizeMode(value) {
            SettingsManager.saveSetting('currentResizeMode', value);
        }
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

        DOM.$$(`.${CSS.BTN}[data-action]`).forEach(btn => {
            const label = labels[btn.dataset.action];
            if (label) btn.textContent = label;
        });

        updateGalleryButton(state.galleryReady);
        PostActions.updateButtonVisibilityLight();
    }

    // ====================================================
    // Zoom Module
    // ====================================================
    const Zoom = {
        _applyTransition(element, action) {
            element.classList.add(CSS.GALLERY.IS_TRANSITIONING);
            action();
            let cleared = false;
            const clear = () => {
                if (!cleared) {
                    cleared = true;
                    element.classList.remove(CSS.GALLERY.IS_TRANSITIONING);
                }
            };
            element.addEventListener('transitionend', clear, { once: true });
            setTimeout(clear, 600);
        },

        applyZoom() {
            if (!galleryOverlay) return;
            const container = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
            if (!container) return;

            PointerEngine.updateTransform();
            const zoomDisplay = DOM.$('#zoom-level', galleryOverlay);
            if (zoomDisplay) {
                zoomDisplay.textContent = `${Math.round(viewState.zoomScale * 100)}%`;
            }
            container.classList.toggle(CSS.GALLERY.ZOOMED, viewState.zoomScale !== 1);
        },

        handleWheelZoom(event) {
            if (!state.zoomEnabled || !galleryOverlay) return;

            event.preventDefault();
            event.stopPropagation();

            const container = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
            if (!container) return;

            const rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const delta = event.deltaY;

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

        resetZoom() {
            if (!galleryOverlay) return;
            const container = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
            if (container) {
                Zoom._applyTransition(container, () => {
                    viewState.zoomScale = 1;
                    viewState.imageOffset = { x: 0, y: 0 };
                    Zoom.applyZoom();
                });
            }
        },

        zoom(step) {
            if (!galleryOverlay) return;
            const container = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.zoomScale + step, CONFIG.MAX_SCALE));

            if (viewState.zoomScale !== newScale) {
                const imageX = (centerX - viewState.imageOffset.x) / viewState.zoomScale;
                const imageY = (centerY - viewState.imageOffset.y) / viewState.zoomScale;

                const newOffsetX = centerX - (imageX * newScale);
                const newOffsetY = centerY - (imageY * newScale);

                Zoom._applyTransition(container, () => {
                    viewState.imageOffset.x = newOffsetX;
                    viewState.imageOffset.y = newOffsetY;
                    viewState.zoomScale = newScale;
                    Zoom.applyZoom();
                });
            }
        }
    };

    // ====================================================
    // Thumbnail Strip Module
    // ====================================================
    const ThumbnailStrip = {
        _contextMenuTimeout: null,

        init() {
            if (!galleryOverlay) return;
            const strip = DOM.$('.ug-thumbnail-strip', galleryOverlay);
            if (!strip) return;

            ThumbnailStrip.updateScrollIndicators();
            ThumbnailStrip.setupKeyboardNavigation();
            ThumbnailStrip.setupDragNavigation();
            ThumbnailStrip.setupHoverPreview();
            ThumbnailStrip.setupContextMenu();
            strip.addEventListener('scroll', Utils.throttle(ThumbnailStrip.updateScrollIndicators, 100));
        },

        cleanup() {
            ThumbnailStrip.hideContextMenu();
            DOM.$('.ug-thumbnail-zoom-preview')?.remove();
            DOM.$('.ug-slideshow-indicator', galleryOverlay)?.remove();
        },

        updateScrollIndicators() {
            if (!galleryOverlay) return;
            const strip = DOM.$('.ug-thumbnail-strip', galleryOverlay);
            if (!strip) return;
            const hasScroll = strip.scrollWidth > strip.clientWidth;
            strip.classList.toggle('no-scroll', !hasScroll);
        },

        setupKeyboardNavigation() {
            const strip = DOM.$('.ug-thumbnail-strip', galleryOverlay);
            if (!strip) return;

            strip.onkeydown = (e) => {
                const focused = e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (!focused) return;
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
                        Gallery.showExpandedView(parseInt(focused.dataset.index, 10));
                        break;
                }
            };
        },

        navigateThumbnails(direction) {
            const strip = DOM.$('.ug-thumbnail-strip', galleryOverlay);
            const current = DOM.$(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}.selected`, strip);
            const currentIndex = current ? parseInt(current.dataset.index, 10) : state.currentGalleryIndex;
            const total = state.fullSizeImageSrcs.length;
            if (!total) return;

            const target = Math.max(0, Math.min(total - 1, currentIndex + (direction === 'next' ? 1 : -1)));
            const targetEl = DOM.$(`[data-index="${target}"]`, strip);
            if (targetEl) {
                targetEl.focus();
                DOM.scrollToCenter(strip, targetEl);
            } else {
                Gallery.showExpandedView(target);
            }
        },

        setupDragNavigation() {
            const strip = DOM.$('.ug-thumbnail-strip', galleryOverlay);
            if (!strip) return;

            let isDragging = false;
            let startX = 0;
            let scrollLeft = 0;

            strip.onmousedown = (e) => {
                if (e.button !== 0 || e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`)) return;
                isDragging = true;
                startX = e.pageX - strip.offsetLeft;
                scrollLeft = strip.scrollLeft;
                strip.style.cursor = 'grabbing';
                strip.classList.add('ug-dragging');
            };

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.pageX - strip.offsetLeft;
                strip.scrollLeft = scrollLeft - (x - startX) * 2;
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    strip.style.cursor = '';
                    strip.classList.remove('ug-dragging');
                }
            });
        },

        setupHoverPreview() {
            const strip = DOM.$('.ug-thumbnail-strip', galleryOverlay);
            if (!strip) return;

            let previewTimeout;
            strip.addEventListener('mouseover', (e) => {
                const thumb = e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (!thumb) return;
                clearTimeout(previewTimeout);
                previewTimeout = setTimeout(() => {
                    const index = parseInt(thumb.dataset.index, 10);
                    ThumbnailStrip.showZoomPreview(thumb, index);
                }, 500);
            });

            strip.addEventListener('mouseout', (e) => {
                if (e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`)) {
                    clearTimeout(previewTimeout);
                    ThumbnailStrip.hideZoomPreview();
                }
            });
        },

        showZoomPreview(thumb, index) {
            const mediaItem = state.fullSizeImageSrcs[index];
            if (!mediaItem) return;

            DOM.$('.ug-thumbnail-zoom-preview')?.remove();
            const thumbImg = thumb.querySelector('img');
            const src = mediaItem.type === 'video' ? (mediaItem.poster || thumbImg?.src) : (thumbImg?.src || mediaItem.src);
            if (!src) return;

            const preview = DOM.create('div', { className: 'ug-thumbnail-zoom-preview' }, [
                DOM.create('img', { src })
            ]);
            document.body.appendChild(preview);

            const rect = thumb.getBoundingClientRect();
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

            Object.assign(preview.style, {
                position: 'fixed',
                left: `${left}px`,
                top: `${top}px`,
                bottom: 'auto',
                transform,
                zIndex: '10000'
            });

            setTimeout(() => preview.classList.add('show'), 10);
        },

        hideZoomPreview() {
            const preview = DOM.$('.ug-thumbnail-zoom-preview');
            if (!preview) return;
            preview.classList.remove('show');
            setTimeout(() => preview.remove(), 300);
        },

        setupContextMenu() {
            const strip = DOM.$('.ug-thumbnail-strip', galleryOverlay);
            if (!strip) return;

            strip.oncontextmenu = (e) => {
                const thumb = e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (!thumb) return;
                e.preventDefault();
                ThumbnailStrip.showContextMenu(thumb, parseInt(thumb.dataset.index, 10), e.pageX, e.pageY);
            };

            window.addEventListener('click', ThumbnailStrip.hideContextMenu);
        },

        showContextMenu(thumb, index, x, y) {
            if (ThumbnailStrip._contextMenuTimeout) {
                clearTimeout(ThumbnailStrip._contextMenuTimeout);
                ThumbnailStrip._contextMenuTimeout = null;
            }
            DOM.$('.ug-thumbnail-context-menu')?.remove();

            const menuItems = [
                { text: 'Open Image', action: () => Gallery.showExpandedView(index) },
                { text: 'Download Image', action: () => DownloadManager.downloadImageByIndex(index) },
                { text: 'Copy URL', action: () => ThumbnailStrip.copyImageUrl(index) },
                { text: 'Remove from Gallery', action: () => ThumbnailStrip.removeFromGallery(index), danger: true }
            ];

            const menu = DOM.create('div', { className: 'ug-thumbnail-context-menu' },
                menuItems.map(item => DOM.create('button', {
                    className: `ug-thumbnail-context-menu-item${item.danger ? ' danger' : ''}`,
                    text: item.text,
                    onclick: (e) => {
                        e.stopPropagation();
                        item.action();
                        ThumbnailStrip.hideContextMenu();
                    }
                }))
            );

            menu.style.left = `${Math.min(x, window.innerWidth - 170)}px`;
            menu.style.top = `${Math.min(y - 10, window.innerHeight - 200)}px`;
            document.body.appendChild(menu);

            setTimeout(() => menu.classList.add('show'), 10);
        },

        hideContextMenu() {
            const menu = DOM.$('.ug-thumbnail-context-menu');
            if (!menu) return;
            menu.classList.remove('show');
            if (ThumbnailStrip._contextMenuTimeout) clearTimeout(ThumbnailStrip._contextMenuTimeout);
            ThumbnailStrip._contextMenuTimeout = setTimeout(() => menu.remove(), CONFIG.CONTEXT_MENU_HIDE_DELAY);
        },

        copyImageUrl(index) {
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

        async removeFromGallery(index) {
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

                const strip = DOM.$(`.${CSS.GALLERY.THUMBNAIL_STRIP}`, galleryOverlay);
                if (strip) Gallery._populateAllThumbnails(strip);

                Gallery.showExpandedView(state.currentGalleryIndex);
                ThumbnailStrip.updateThumbnailNumbers();
                ThumbnailStrip.updateScrollIndicators();
                state.notificationType = 'info';
                state.notification = 'Image removed from gallery';
            };

            const result = await UGModal.confirm({
                title: 'Remove from gallery?',
                text: 'This only affects the current gallery view.',
                icon: 'question',
                confirmText: 'Remove'
            });

            if (result.isConfirmed) {
                doRemove();
            }
        },

        updateThumbnailNumbers() {
            if (!galleryOverlay) return;
            DOM.$$(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`, galleryOverlay).forEach(wrapper => {
                const index = parseInt(wrapper.dataset.index, 10);
                let numberEl = DOM.$('.ug-thumbnail-number', wrapper);
                if (!numberEl) {
                    wrapper.appendChild(DOM.create('span', { className: 'ug-thumbnail-number', text: index + 1 }));
                } else {
                    numberEl.textContent = index + 1;
                }
            });
        }
    };

    // ====================================================
    // UI Builder & Notifications
    // ====================================================
    const UI = {
        _notificationTimeoutId: null,
        _notificationHideTimeoutId: null,

        createToggleButton(name, action, disabled = false, actionName = null) {
            const btn = DOM.create('button', {
                type: 'button',
                text: name,
                className: CSS.BTN,
                style: { cursor: 'pointer' },
                onclick: (e) => {
                    if (btn.classList.contains('disabled')) {
                        e.preventDefault();
                        return;
                    }
                    action(e);
                }
            });

            if (actionName) btn.dataset.action = actionName;
            if (disabled) btn.classList.add('disabled');
            return btn;
        },

        createButtonGroup(buttonsConfig) {
            const div = DOM.create('div', { className: CSS.BTN_CONTAINER });
            buttonsConfig.forEach(config => {
                let createThisButton = true;
                switch (config.name) {
                    case 'FULL': if (state.hideFullButton) createThisButton = false; break;
                    case 'DOWNLOAD': if (state.hideDownloadButton) createThisButton = false; break;
                    case 'HEIGHT': if (state.hideHeightButton) createThisButton = false; break;
                    case 'WIDTH': if (state.hideWidthButton) createThisButton = false; break;
                }
                if (!createThisButton) return;
                div.appendChild(UI.createToggleButton(config.text, config.action, false, config.name));
            });
            return div;
        },

        createNavigationButton(direction) {
            return DOM.create('button', {
                text: direction === 'prev' ? '←' : '→',
                className: `${CSS.GALLERY.NAV} ${direction === 'prev' ? CSS.GALLERY.PREV : CSS.GALLERY.NEXT}`,
                'aria-label': direction === 'prev' ? 'Previous Image' : 'Next Image',
                onclick: direction === 'prev' ? Gallery.prevImage : Gallery.nextImage
            });
        },

        createNotificationArea() {
            const area = DOM.create('div', {
                id: CSS.NOTIF_AREA,
                className: CSS.NOTIF_AREA,
                style: {
                    top: state.notificationPosition === 'top' ? '10px' : 'auto',
                    bottom: state.notificationPosition === 'bottom' ? '10px' : 'auto'
                }
            });
            document.body.appendChild(area);
            return area;
        },

        createNotification() {
            let area = document.getElementById(CSS.NOTIF_AREA) || UI.createNotificationArea();
            const container = DOM.create('div', { id: CSS.NOTIF_CONTAINER, className: CSS.NOTIF_CONTAINER }, [
                DOM.create('div', { id: CSS.NOTIF_TEXT }),
                DOM.create('button', {
                    id: CSS.NOTIF_CLOSE,
                    text: '×',
                    onclick: () => state.notification = null
                }),
                DOM.create('a', {
                    id: CSS.NOTIF_REPORT,
                    text: 'Report Issue',
                    href: 'https://github.com/TearTyr/Ultra-Galleries/issues',
                    target: '_blank'
                })
            ]);
            area.appendChild(container);
            return container;
        },

        showNotification(message, type = 'info') {
            if (!state.notificationsEnabled && !['error', 'warning'].includes(type)) return;

            let area = document.getElementById(CSS.NOTIF_AREA) || UI.createNotificationArea();
            let container = DOM.$(`.${CSS.NOTIF_CONTAINER}`, area) || UI.createNotification();

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
            const textNode = DOM.$(`#${CSS.NOTIF_TEXT}`, container);
            if (textNode) textNode.textContent = message;
            container.className = `${CSS.NOTIF_CONTAINER} ${type}`;

            if (state.animationsEnabled) {
                if (isAlreadyVisible) {
                    container.classList.add('ug-update');
                    container.addEventListener('animationend', () => container.classList.remove('ug-update'), { once: true });
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

        hideNotification() {
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

        forceHideNotification() {
            if (UI._notificationTimeoutId) clearTimeout(UI._notificationTimeoutId);
            if (UI._notificationHideTimeoutId) clearTimeout(UI._notificationHideTimeoutId);
            document.getElementById(CSS.NOTIF_CONTAINER)?.remove();
        },

        _createSettingElement(setting) {
            const div = DOM.create('div', { className: 'ug-setting-item' });
            const label = DOM.create('label', { for: setting.id, text: setting.label });

            const handleChange = (value) => {
                if (setting.stateKey) state[setting.stateKey] = value;
                if (setting.gmKey) SettingsManager.saveSetting(setting.gmKey, value);
                if (setting.onChange) setting.onChange(value);
            };

            switch (setting.type) {
                case 'checkbox': {
                    div.className = 'ug-setting-item ug-settings-checkbox-label';
                    const checkbox = DOM.create('input', {
                        type: 'checkbox',
                        id: setting.id,
                        onchange: (e) => handleChange(e.target.checked)
                    });
                    checkbox.checked = state[setting.stateKey];
                    div.append(checkbox, label);
                    break;
                }

                case 'text': {
                    div.appendChild(label);
                    const input = DOM.create('input', {
                        type: 'text',
                        id: setting.id,
                        value: state[setting.stateKey] || '',
                        maxlength: setting.maxLength || 50,
                        className: 'ug-settings-input',
                        onchange: (e) => handleChange(e.target.value)
                    });
                    div.appendChild(input);
                    break;
                }

                case 'select': {
                    div.appendChild(label);
                    const select = DOM.create('select', {
                        id: setting.id,
                        className: 'ug-settings-input',
                        onchange: (e) => handleChange(e.target.value)
                    });
                    setting.options.forEach(opt => {
                        const optEl = DOM.create('option', { value: opt.value, text: opt.text });
                        if (opt.value === state[setting.stateKey]) optEl.selected = true;
                        select.appendChild(optEl);
                    });
                    div.appendChild(select);
                    break;
                }

                case 'button':
                    return DOM.create('button', {
                        className: 'ug-button ug-settings-input',
                        text: setting.label,
                        onclick: setting.action
                    });
            }
            return div;
        },

        createSettingsUI() {
            const settingsConfig = [
                {
                    title: 'General',
                    key: 'general',
                    settings: [
                        { id: 'animationsToggle', label: 'Enable Animations', type: 'checkbox', stateKey: 'animationsEnabled', gmKey: 'animationsEnabled' },
                        { id: 'bottomStripeToggle', label: 'Show Thumbnail Strip', type: 'checkbox', stateKey: 'bottomStripeVisible', gmKey: 'bottomStripeVisible' },
                        { id: 'autoLoadOriginalsToggle', label: 'Auto-load Original Images', type: 'checkbox', stateKey: 'autoLoadOriginals', gmKey: 'autoLoadOriginals' }
                    ]
                },
                {
                    title: 'Pan & Zoom',
                    key: 'panZoom',
                    settings: [
                        { id: 'zoomEnabledToggle', label: 'Enable Zoom & Pan', type: 'checkbox', stateKey: 'zoomEnabled', gmKey: 'zoomEnabled' },
                        { id: 'inertiaEnabledToggle', label: 'Enable Smooth Pan Inertia', type: 'checkbox', stateKey: 'inertiaEnabled', gmKey: 'inertiaEnabled' }
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
                                const validDelay = parseInt(value, 10) || CONFIG.SLIDESHOW_DELAY;
                                state.slideshowDelay = validDelay;
                                Slideshow.setDelay(validDelay);
                            }
                        },
                        { id: 'slideshowPauseOnHover', label: 'Pause on Hover', type: 'checkbox', stateKey: 'slideshowPauseOnHover', gmKey: 'slideshowPauseOnHover' }
                    ]
                },
                {
                    title: 'Button Labels',
                    key: 'buttonLabels',
                    settings: [
                        { id: 'downloadBtnTextInput', label: 'Download Button:', type: 'text', stateKey: 'downloadBtnText', gmKey: 'downloadBtnText', onChange: updateButtonLabels },
                        { id: 'downloadAllBtnTextInput', label: 'Download All Button:', type: 'text', stateKey: 'downloadAllBtnText', gmKey: 'downloadAllBtnText', onChange: updateButtonLabels },
                        { id: 'fullBtnTextInput', label: 'Full Size Button:', type: 'text', stateKey: 'fullBtnText', gmKey: 'fullBtnText', onChange: updateButtonLabels },
                        { id: 'heightBtnTextInput', label: 'Fill Height Button:', type: 'text', stateKey: 'heightBtnText', gmKey: 'heightBtnText', onChange: updateButtonLabels },
                        { id: 'widthBtnTextInput', label: 'Fill Width Button:', type: 'text', stateKey: 'widthBtnText', gmKey: 'widthBtnText', onChange: updateButtonLabels },
                        { id: 'galleryBtnTextInput', label: 'Gallery Button:', type: 'text', stateKey: 'galleryBtnText', gmKey: 'galleryBtnText', onChange: updateButtonLabels }
                    ]
                },
                {
                    title: 'Buttons',
                    key: 'buttonVisibility',
                    settings: [
                        { id: 'hideNavArrows', label: 'Hide Navigation Arrows', type: 'checkbox', stateKey: 'hideNavArrows', gmKey: 'hideNavArrows', onChange: () => PostActions.updateButtonVisibilityLight() },
                        { id: 'hideFullBtn', label: 'Hide Full Size Button', type: 'checkbox', stateKey: 'hideFullButton', gmKey: 'hideFullButton', onChange: () => PostActions.updateButtonVisibilityLight() },
                        { id: 'hideDownloadBtn', label: 'Hide Download Button', type: 'checkbox', stateKey: 'hideDownloadButton', gmKey: 'hideDownloadButton', onChange: () => PostActions.updateButtonVisibilityLight() },
                        { id: 'hideHeightBtn', label: 'Hide Fill Height Button', type: 'checkbox', stateKey: 'hideHeightButton', gmKey: 'hideHeightButton', onChange: () => PostActions.updateButtonVisibilityLight() },
                        { id: 'hideWidthBtn', label: 'Hide Fill Width Button', type: 'checkbox', stateKey: 'hideWidthButton', gmKey: 'hideWidthButton', onChange: () => PostActions.updateButtonVisibilityLight() }
                    ]
                },
                {
                    title: 'Keyboard',
                    key: 'keys',
                    settings: [
                        { id: 'galleryKeyInput', label: 'Gallery Key:', type: 'text', stateKey: 'galleryKey', gmKey: 'galleryKey', maxLength: 1 },
                        { id: 'prevImageKeyInput', label: 'Previous Image Key:', type: 'text', stateKey: 'prevImageKey', gmKey: 'prevImageKey', maxLength: 1 },
                        { id: 'nextImageKeyInput', label: 'Next Image Key:', type: 'text', stateKey: 'nextImageKey', gmKey: 'nextImageKey', maxLength: 1 }
                    ]
                },
                {
                    title: 'Notifications',
                    key: 'notifications',
                    settings: [
                        { id: 'notificationsEnabledToggle', label: 'Enable Notifications', type: 'checkbox', stateKey: 'notificationsEnabled', gmKey: 'notificationsEnabled' },
                        {
                            id: 'notificationPosition',
                            label: 'Notification Position:',
                            type: 'select',
                            stateKey: 'notificationPosition',
                            gmKey: 'notificationPosition',
                            options: [{ value: 'top', text: 'Top' }, { value: 'bottom', text: 'Bottom' }]
                        }
                    ]
                },
                {
                    title: 'Downloads',
                    key: 'optimizations',
                    settings: [
                        { id: 'persistentCachingToggle', label: 'Enable Persistent Image Caching', type: 'checkbox', stateKey: 'enablePersistentCaching', gmKey: 'enablePersistentCaching' },
                        { id: 'clearCacheButton', label: 'Clear Persistent Cache', type: 'button', action: () => ImageCacheDB.clear() },
                        {
                            id: 'exportSettingsButton',
                            label: 'Export Settings',
                            type: 'button',
                            action: () => {
                                const blob = new Blob([SettingsManager.exportSettings()], { type: 'application/json' });
                                DOM.saveBlob(blob, 'ultra-galleries-settings.json');
                                state.notificationType = 'success';
                                state.notification = 'Settings exported';
                            }
                        },
                        {
                            id: 'importSettingsButton',
                            label: 'Import Settings',
                            type: 'button',
                            action: () => {
                                const input = DOM.create('input', { type: 'file', accept: '.json' });
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
                            action: async () => {
                                const result = await UGModal.confirm({
                                    title: 'Reset settings?',
                                    text: 'All settings will return to defaults.',
                                    icon: 'warning',
                                    confirmText: 'Reset'
                                });
                                if (result.isConfirmed) {
                                    SettingsManager.resetToDefaults();
                                    location.reload();
                                }
                            }
                        }
                    ]
                },
                {
                    title: 'File Formatting',
                    key: 'formatting',
                    settings: [
                        { id: 'zipFileNameFormatInput', label: 'Zip File Name Format:', type: 'text', stateKey: 'zipFileNameFormat', gmKey: 'zipFileNameFormat' },
                        { id: 'imageFileNameFormatInput', label: 'Image File Name Format:', type: 'text', stateKey: 'imageFileNameFormat', gmKey: 'imageFileNameFormat' }
                    ]
                }
            ];

            const headerText = DOM.create('h2', { id: 'ug-settings-main-header' });
            const body = DOM.create('div', { className: 'ug-settings-body' });
            const sidebar = DOM.create('div', { className: 'ug-sidebar-header', text: 'Settings' });
            const sidebarContainer = DOM.create('div', { className: 'ug-settings-sidebar' }, [sidebar]);

            const overlay = DOM.create('div', {
                id: 'ug-settings-overlay',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'ug-settings-main-header',
                className: 'ug-settings-overlay'
            }, [
                DOM.create('div', { className: 'ug-settings-container' }, [
                    sidebarContainer,
                    DOM.create('div', { className: 'ug-settings-content' }, [
                        DOM.create('div', { className: 'ug-settings-header' }, [
                            headerText,
                            DOM.create('button', {
                                className: 'ug-settings-close-btn',
                                text: BUTTONS.CLOSE,
                                onclick: () => state.settingsOpen = false
                            })
                        ]),
                        body
                    ])
                ])
            ]);

            settingsConfig.forEach(section => {
                const sectionEl = DOM.create('div', {
                    className: 'ug-settings-section',
                    'data-section-key': section.key,
                    style: { display: 'none' }
                });

                section.settings.forEach(setting => {
                    sectionEl.appendChild(UI._createSettingElement(setting));
                });
                body.appendChild(sectionEl);

                const sideBtn = DOM.create('button', {
                    className: 'ug-sidebar-button',
                    text: section.title,
                    onclick: function () {
                        DOM.$$('.ug-sidebar-button', sidebarContainer).forEach(b => b.classList.remove('active'));
                        this.classList.add('active');

                        DOM.$$('.ug-settings-section', body).forEach(s => s.style.display = 'none');
                        sectionEl.style.display = 'block';

                        headerText.textContent = section.title;
                    }
                });
                sidebarContainer.appendChild(sideBtn);
            });

            DOM.$('.ug-sidebar-button', sidebarContainer)?.click();
            document.body.appendChild(overlay);
        },

        showSettings() {
            lastFocusedElement = document.activeElement;
            document.getElementById('ug-settings-overlay')?.remove();

            UI.createSettingsUI();
            const overlay = document.getElementById('ug-settings-overlay');
            if (!overlay) return;

            overlay.classList.add('opening');
            const focusable = DOM.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', overlay);
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

        closeSettings() {
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
    // Gallery Core Module
    // ====================================================
    const Gallery = {
        _preloadedImageCache: {},
        _preloadingInProgress: {},

        _clearPreloadCache() {
            for (const index in Gallery._preloadedImageCache) {
                const cachedItem = Gallery._preloadedImageCache[index];
                if (typeof cachedItem === 'string' && cachedItem.startsWith('blob:')) {
                    BlobManager.revokeUrl(cachedItem);
                }
            }
            Gallery._preloadedImageCache = {};
            Gallery._preloadingInProgress = {};
        },

        async _fetchAndCacheImage(indexToPreload, sessionId = null) {
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

        _preloadAdjacentImages(currentIndex) {
            const sessionId = state.currentLoadSessionId;
            const maxKeep = CONFIG.PRELOAD_COUNT + CONFIG.PRELOAD_WINDOW_BUFFER;

            for (const indexStr in Gallery._preloadedImageCache) {
                const index = parseInt(indexStr, 10);
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

        _releaseVideo(video) {
            if (!video || video.tagName !== 'VIDEO') return;
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch {
                // Ignore release errors
            }
        },

        _releaseMediaElements(container) {
            if (!container) return;
            DOM.$$('video', container).forEach(v => Gallery._releaseVideo(v));
        },

        safePlay(video) {
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

        _attachVideoPlayOverlay(video, container) {
            const overlay = DOM.create('button', {
                className: 'ug-video-play-overlay',
                'aria-label': 'Play video',
                title: 'Play video',
                html: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
                onclick: (e) => {
                    e.stopPropagation();
                    Gallery.safePlay(video);
                    overlay.classList.add('ug-hidden');
                }
            });

            video.addEventListener('play', () => overlay.classList.add('ug-hidden'), { once: true });
            container.appendChild(overlay);
        },

        _createExpandedViewToolbar(expandedView) {
            const toolbar = DOM.create('div', {
                className: CSS.GALLERY.TOOLBAR,
                onmousedown: e => e.stopPropagation()
            });

            const resetBtn = DOM.create('button', {
                id: 'reset-btn',
                title: 'Reset Zoom & Position',
                className: CSS.GALLERY.TOOLBAR_BTN,
                text: 'Reset',
                onclick: Zoom.resetZoom
            });

            const zoomControls = DOM.create('div', { className: 'zoom-controls' }, [
                DOM.create('button', {
                    id: 'zoom-out-btn',
                    title: 'Zoom Out',
                    className: CSS.GALLERY.TOOLBAR_BTN,
                    html: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    onclick: () => Zoom.zoom(-CONFIG.ZOOM_STEP)
                }),
                DOM.create('span', { id: 'zoom-level', className: 'zoom-level', text: '100%' }),
                DOM.create('button', {
                    id: 'zoom-in-btn',
                    title: 'Zoom In',
                    className: CSS.GALLERY.TOOLBAR_BTN,
                    html: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    onclick: () => Zoom.zoom(CONFIG.ZOOM_STEP)
                })
            ]);

            const slideshowBtn = DOM.create('button', {
                id: 'slideshow-btn',
                title: 'Start Slideshow (Space)',
                className: CSS.GALLERY.TOOLBAR_BTN,
                text: '▶',
                onclick: Slideshow.handleButton
            });

            const fillHeightBtn = DOM.create('button', {
                id: 'ug-fill-height-btn',
                'aria-label': 'Fill Height',
                className: CSS.GALLERY.TOOLBAR_BTN,
                text: BUTTONS.HEIGHT,
                onclick: () => {
                    const media = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay)?.querySelector('img, video');
                    if (media) ImageSizing.applyFillHeight(media);
                }
            });

            const fullscreenBtn = DOM.create('button', {
                className: `${CSS.GALLERY.FULLSCREEN} ${CSS.GALLERY.TOOLBAR_BTN}`,
                'aria-label': 'Toggle Fullscreen',
                text: BUTTONS.FULLSCREEN,
                onclick: Gallery.toggleFullscreen
            });

            toolbar.append(resetBtn, zoomControls, slideshowBtn, fillHeightBtn, fullscreenBtn);
            expandedView.append(
                toolbar,
                DOM.create('button', {
                    className: 'ug-gallery-close-button',
                    'aria-label': 'Close Gallery',
                    text: BUTTONS.CLOSE,
                    onclick: Gallery.closeGallery
                })
            );
        },

        _createExpandedViewMainImageArea(expandedView) {
            const zoomContainer = DOM.create('div', { className: CSS.GALLERY.ZOOM_CONTAINER });
            const ambientBg = DOM.create('div', { className: 'ug-ambient-background' });
            const mainImageContainer = DOM.create('div', { className: `${CSS.GALLERY.MAIN_IMG_CONTAINER} image-container` });
            const panIndicator = DOM.create('div', {
                className: 'pan-indicator',
                html: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white" opacity="0.7"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>'
            });

            mainImageContainer.appendChild(panIndicator);
            zoomContainer.append(ambientBg, mainImageContainer);
            expandedView.appendChild(zoomContainer);

            return { mainImageContainer };
        },

        _createExpandedViewNavigationAndCounter(expandedView) {
            const navContainer = DOM.create('div', {
                className: CSS.GALLERY.NAV_CONTAINER,
                onmousedown: e => e.stopPropagation()
            });

            if (!state.hideNavArrows) {
                navContainer.append(
                    UI.createNavigationButton('prev'),
                    UI.createNavigationButton('next')
                );
            }

            expandedView.append(
                navContainer,
                DOM.create('div', { className: `${CSS.GALLERY.COUNTER} ${CSS.GALLERY.HIDE}` })
            );
        },

        _createExpandedViewThumbnailStrip(expandedView) {
            const thumbnailStripContainer = DOM.create('div', {
                className: CSS.GALLERY.STRIP_CONTAINER,
                style: { display: state.bottomStripeVisible ? 'flex' : 'none' },
                onmousedown: e => e.stopPropagation()
            });

            const strip = DOM.create('div', { className: CSS.GALLERY.THUMBNAIL_STRIP });
            thumbnailStripContainer.appendChild(strip);
            expandedView.appendChild(thumbnailStripContainer);
            return strip;
        },

        _populateAllThumbnails(stripThumbnailsContainer) {
            stripThumbnailsContainer.replaceChildren();
            const fragment = document.createDocumentFragment();

            state.fullSizeImageSrcs.forEach((mediaItem, index) => {
                if (!mediaItem) return;
                const thumbSrc = mediaItem.type === 'video' ? mediaItem.poster : mediaItem.src;
                const wrapper = DOM.create('div', {
                    className: CSS.GALLERY.THUMBNAIL_WRAPPER,
                    'data-index': index,
                    'aria-label': `Thumbnail ${index + 1}`,
                    tabindex: '0',
                    role: 'button',
                    onclick: () => Gallery.showExpandedView(index)
                });

                if (mediaItem.type === 'video') {
                    wrapper.appendChild(DOM.create('div', {
                        className: 'ug-play-icon',
                        html: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
                    }));
                }

                wrapper.appendChild(DOM.create('img', {
                    src: thumbSrc,
                    loading: 'lazy',
                    decoding: 'async',
                    className: CSS.GALLERY.THUMBNAIL
                }));

                fragment.appendChild(wrapper);
            });
            stripThumbnailsContainer.appendChild(fragment);
        },

        _setupGalleryInteractions(expandedView, mainImageContainer) {
            mainImageContainer.addEventListener('wheel', (e) => {
                const currentItem = state.fullSizeImageSrcs[state.currentGalleryIndex];
                if (currentItem && currentItem.type === 'image') Zoom.handleWheelZoom(e);
            }, { passive: false });

            PointerEngine.init(mainImageContainer);

            let controlsTimeout;
            const resetControlsTimer = () => {
                state.controlsVisible = true;
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => {
                    if (!PointerEngine.isDragging && !viewState.pinchZoomActive) {
                        state.controlsVisible = false;
                    }
                }, CONFIG.CONTROLS_HIDE_DELAY);
            };

            expandedView.addEventListener('mousemove', resetControlsTimer);
            resetControlsTimer();
        },

        createGallery() {
            if (galleryOverlay) {
                Gallery.showExpandedView(0);
                state.isGalleryMode = true;
                return;
            }

            galleryOverlay = DOM.create('div', {
                id: 'gallery-overlay',
                className: CSS.GALLERY.OVERLAY
            });

            const galleryContainer = DOM.create('div', { className: CSS.GALLERY.CONTAINER });
            galleryOverlay.appendChild(galleryContainer);

            const expandedView = DOM.create('div', {
                className: `${CSS.GALLERY.EXPANDED_VIEW} ${CSS.GALLERY.HIDE}`
            });
            galleryContainer.appendChild(expandedView);

            Gallery._createExpandedViewToolbar(expandedView);
            const { mainImageContainer } = Gallery._createExpandedViewMainImageArea(expandedView);
            Gallery._createExpandedViewNavigationAndCounter(expandedView);
            const stripThumbnailsContainer = Gallery._createExpandedViewThumbnailStrip(expandedView);

            document.body.appendChild(galleryOverlay);

            if (state.isFullscreen) {
                document.body.classList.add('ug-fullscreen');
                galleryOverlay.classList.add(CSS.GALLERY.FULLSCREEN_OVERLAY);
            }

            Gallery._populateAllThumbnails(stripThumbnailsContainer);
            Gallery._setupGalleryInteractions(expandedView, mainImageContainer);
            Gallery.showExpandedView(0);
            state.isGalleryMode = true;
            Accessibility.init();
        },

        showExpandedView(index) {
            if (!galleryOverlay || index < 0) return;

            let mediaItem = state.fullSizeImageSrcs[index] || state.originalImageSrcs[index];
            const mainMediaContainer = DOM.$(`.${CSS.GALLERY.MAIN_IMG_CONTAINER}`, galleryOverlay);
            const ambientBackground = DOM.$('.ug-ambient-background', galleryOverlay);
            const counter = DOM.$(`.${CSS.GALLERY.COUNTER}`, galleryOverlay);
            const zoomControls = DOM.$('.zoom-controls', galleryOverlay);
            const resetBtn = DOM.$('#reset-btn', galleryOverlay);
            const fillHeightBtn = DOM.$('#ug-fill-height-btn', galleryOverlay);
            const expandedView = DOM.$(`.${CSS.GALLERY.EXPANDED_VIEW}`, galleryOverlay);

            if (!mainMediaContainer) return;
            state.currentGalleryIndex = index;

            if (!mediaItem || !mediaItem.src) {
                Gallery._releaseMediaElements(mainMediaContainer);
                mainMediaContainer.replaceChildren(
                    DOM.create('div', { className: CSS.GALLERY.IMAGE_ERROR_MSG, text: 'Loading media data...' })
                );
                expandedView?.classList.remove(CSS.GALLERY.HIDE);
                return;
            }

            Gallery._releaseMediaElements(mainMediaContainer);

            if (PointerEngine.inertiaAnimation) {
                cancelAnimationFrame(PointerEngine.inertiaAnimation);
                PointerEngine.inertiaAnimation = null;
            }
            if (PointerEngine.animationFrame) {
                cancelAnimationFrame(PointerEngine.animationFrame);
                PointerEngine.animationFrame = null;
            }

            mainMediaContainer.replaceChildren();
            mainMediaContainer.classList.remove(CSS.GALLERY.ZOOMED);

            viewState.zoomScale = 1;
            viewState.imageOffset = { x: 0, y: 0 };
            PointerEngine.cachedImgEl = null;
            PointerEngine.cachedZoomEl = null;

            if (mediaItem.type === 'image' || !mediaItem.type) {
                if (zoomControls) zoomControls.style.display = 'flex';
                if (resetBtn) resetBtn.style.display = 'block';
                if (fillHeightBtn) fillHeightBtn.style.display = 'none';

                const imageUrlToLoad = Gallery._preloadedImageCache[index] || mediaItem.src;
                if (ambientBackground) {
                    ambientBackground.style.backgroundImage = `url("${imageUrlToLoad}")`;
                }

                const mainImage = DOM.create('img', {
                    className: CSS.GALLERY.MAIN_IMG,
                    decoding: 'async',
                    ondragstart: e => e.preventDefault(),
                    onload() {
                        this.style.opacity = '1';
                        this.style.transformOrigin = '0 0';
                        ImageSizing.applyBestFit(this);
                        PointerEngine.cachedImgEl = this;
                        PointerEngine.cachedZoomEl = DOM.$('#zoom-level');
                        viewState.zoomScale = 1;
                        viewState.imageOffset = { x: 0, y: 0 };
                        Zoom.applyZoom();
                        Gallery._preloadAdjacentImages(index);
                    },
                    onerror() {
                        if (imageUrlToLoad !== mediaItem.src && !this.dataset.ugRetried) {
                            this.dataset.ugRetried = 'true';
                            this.src = mediaItem.src;
                            return;
                        }
                        mainMediaContainer.appendChild(
                            DOM.create('div', { className: CSS.GALLERY.IMAGE_ERROR_MSG, text: 'Failed to load image' })
                        );
                    }
                });

                mainImage.src = imageUrlToLoad;
                mainMediaContainer.appendChild(mainImage);

            } else if (mediaItem.type === 'video') {
                if (zoomControls) zoomControls.style.display = 'none';
                if (resetBtn) resetBtn.style.display = 'none';
                if (fillHeightBtn) fillHeightBtn.style.display = 'block';

                const mainVideo = DOM.create('video', {
                    className: CSS.GALLERY.MAIN_VIDEO,
                    src: mediaItem.src,
                    poster: mediaItem.poster,
                    controls: 'true',
                    loop: 'true',
                    preload: 'metadata',
                    playsinline: 'true',
                    ondragstart: e => e.preventDefault(),
                    onloadedmetadata() {
                        this.style.transformOrigin = '0 0';
                        Utils.setImageStyle(this, {
                            width: '100%',
                            height: '100%',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain'
                        });
                        PointerEngine.cachedImgEl = this;
                        PointerEngine.cachedZoomEl = DOM.$('#zoom-level');
                    }
                });

                mainMediaContainer.appendChild(mainVideo);
                Gallery._attachVideoPlayOverlay(mainVideo, mainMediaContainer);
            }

            if (counter) {
                counter.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
                counter.classList.remove(CSS.GALLERY.HIDE);
            }
            expandedView?.classList.remove(CSS.GALLERY.HIDE);

            const strip = DOM.$(`.${CSS.GALLERY.THUMBNAIL_STRIP}`, galleryOverlay);
            if (strip) {
                DOM.$$('.selected', strip).forEach(s => s.classList.remove('selected'));
                const activeThumb = DOM.$(`[data-index="${index}"]`, strip);
                if (activeThumb) {
                    activeThumb.classList.add('selected');
                    DOM.scrollToCenter(strip, activeThumb);
                }
            }

            setTimeout(() => {
                ThumbnailStrip.init();
                ThumbnailStrip.updateThumbnailNumbers();
                ThumbnailStrip.updateScrollIndicators();
            }, 100);
        },

        closeGallery() {
            if (!galleryOverlay) {
                state.isGalleryMode = false;
                state.isFullscreen = false;
                Slideshow.stop();
                ThumbnailStrip.cleanup();
                return;
            }
            state.isGalleryMode = false;
            state.isFullscreen = false;
            Slideshow.stop();
            Gallery._clearPreloadCache();
            ThumbnailStrip.cleanup();

            if (PointerEngine.inertiaAnimation) cancelAnimationFrame(PointerEngine.inertiaAnimation);
            if (PointerEngine.animationFrame) cancelAnimationFrame(PointerEngine.animationFrame);

            Gallery._releaseMediaElements(galleryOverlay);
            galleryOverlay.remove();
            galleryOverlay = null;
            PointerEngine.cachedImgEl = null;
            PointerEngine.cachedZoomEl = null;
        },

        toggleGallery() {
            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else {
                if (state.galleryReady && state.fullSizeImageSrcs.length > 0) {
                    Gallery.createGallery();
                } else if (Utils.isPostPage()) {
                    ImageLoader.loadImages();
                    state.notificationType = 'info';
                    state.notification = 'Refreshing gallery list...';
                } else {
                    state.notificationType = 'warning';
                    state.notification = 'No post page detected.';
                }
            }
        },

        toggleFullscreen() {
            state.isFullscreen = !state.isFullscreen;
        },

        nextImage() {
            if (state.fullSizeImageSrcs.length === 0) return;
            Gallery.showExpandedView((state.currentGalleryIndex + 1) % state.fullSizeImageSrcs.length);
        },

        prevImage() {
            if (state.fullSizeImageSrcs.length === 0) return;
            Gallery.showExpandedView(
                (state.currentGalleryIndex - 1 + state.fullSizeImageSrcs.length) % state.fullSizeImageSrcs.length
            );
        }
    };

    // ====================================================
    // Image Loader Module
    // ====================================================
    const ImageLoader = {
        imageActions: {
            height: ImageSizing.applyFillHeight,
            width: ImageSizing.applyFillWidth,
            full: ImageSizing.applyFullSize
        },

        async simulateScrollDown() {
            return new Promise(resolve => {
                const selectors = [
                    SELECTORS.IMAGE_LINK + ' img',
                    SELECTORS.MAIN_THUMBNAIL + ' img',
                    '.post__content img',
                    '.post__body img'
                ];
                const images = DOM.$$(selectors.join(', '));
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

        async fetchWithRetry(url, sessionId, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) {
            if (state.currentLoadSessionId !== sessionId) return null;
            try {
                if (state.enablePersistentCaching) {
                    const cachedBlob = await ImageCacheDB.get(url);
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
                                if (state.enablePersistentCaching) {
                                    await ImageCacheDB.put(url, blob);
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

        async fetchBlobDirect(url, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) {
            try {
                if (state.enablePersistentCaching) {
                    const cachedBlob = await ImageCacheDB.get(url);
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
                                if (state.enablePersistentCaching) {
                                    await ImageCacheDB.put(url, blob);
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

        async loadImageAndApplyToPage(linkElement, galleryIndex, posterHref, isUniqueForGallery, sessionId, itemData) {
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
                        const blob = await ImageLoader.fetchWithRetry(cacheKey, sessionId);
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

        collectUniqueMediaItems(postContainer) {
            const uniqueGalleryItems = new Map();
            const targets = DOM.$$(`${SELECTORS.IMAGE_LINK}, ${SELECTORS.ATTACHMENT_LINK}, ${SELECTORS.VIDEO_LINK}, ${SELECTORS.GENERIC_IMAGE_LINK}`, postContainer);

            targets.forEach(linkElement => {
                if (linkElement.closest('.post__user-profile') || linkElement.closest('.scrape__user-profile')) return;
                if (linkElement.classList.contains('user-header__avatar')) return;

                const isVideo = linkElement.matches(SELECTORS.VIDEO_LINK) || linkElement.href?.match(/\.(mp4|webm|mov)$/i);
                let url;
                let poster;

                if (isVideo) {
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
                    if (!url && linkElement.href) url = linkElement.href.split('?')[0];
                    if (!url || !/\.(jpe?g|png|gif|webp|bmp)$/i.test(url)) return;

                    if (!uniqueGalleryItems.has(url)) {
                        uniqueGalleryItems.set(url, {
                            linkElement, originalUrl: url, posterUrl: url, type: 'image',
                            fileName: linkElement.getAttribute('download') || url.split('/').pop()
                        });
                    }
                }
            });

            DOM.$$('video', postContainer).forEach(videoEl => {
                let url = videoEl.getAttribute('src') || videoEl.querySelector('source')?.getAttribute('src');
                if (url) {
                    url = url.split('?')[0];
                    if (!uniqueGalleryItems.has(url)) {
                        const poster = videoEl.getAttribute('poster') || 'https://pawchive.pw/static/menu/recent.svg';
                        uniqueGalleryItems.set(url, {
                            linkElement: videoEl, originalUrl: url, posterUrl: poster, type: 'video',
                            fileName: url.split('/').pop()
                        });
                    }
                }
            });

            return uniqueGalleryItems;
        },

        _concurrentRunner(items, sessionId) {
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

        async loadImages() {
            const postContainer =
                DOM.$('section.site-section--post') ||
                DOM.$('section.site-section--scrape') ||
                DOM.$('.post__body') ||
                DOM.$('.post__content') ||
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
                        state.fullSizeImageSrcs[index] = { type: 'video', src: item.originalUrl, poster: item.posterUrl };
                    } else {
                        state.fullSizeImageSrcs[index] = { type: 'image', src: item.originalUrl, originalSrc: item.originalUrl };
                    }
                    state.originalImageSrcs[index] = { src: item.originalUrl, type: item.type, fileName: item.fileName };
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
                    DOM.$$('img.post__image.ug-image-loaded').forEach(img => {
                        ImageLoader.imageActions[state.currentResizeMode](img);
                    });
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

        updateFinalStatus() {
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

    // ====================================================
    // CSP-Safe Background Download Manager
    // ====================================================
    const DownloadManager = {
        _worker: null,
        _workerUrl: null,
        _pendingVideoPromises: [],

        _getPostMeta: () => ({
            title: DOM.$(SELECTORS.POST_TITLE)?.textContent?.trim() || 'Untitled',
            artistName: DOM.$(SELECTORS.POST_USER_NAME)?.textContent?.trim() || 'Unknown Artist',
            datePublished: Utils.getPostDate('published'),
            dateEdited: Utils.getPostDate('edited'),
            dateImported: Utils.getPostDate('imported')
        }),

        _buildFileName: (item, index) => {
            const meta = DownloadManager._getPostMeta();
            const extMatch = item.fileName.match(/\.([a-z0-9]+)$/i);
            const correctExt = extMatch ? extMatch[1].toLowerCase() : (item.type === 'video' ? 'mp4' : 'jpg');
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

        createZipWorker() {
            const jszipSource = GM_getResourceText('jszipScript') || '';
            const workerHandlerCode = `
                self.usedNames = new Set();
                self.onmessage = async (e) => {
                    const { type, data } = e.data;
                    if (type === 'init') {
                        self.zip = new self.JSZip();
                        self.totalFiles = data.totalFiles;
                        self.filesAdded = 0;
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
                        self.postMessage({ type: 'progress', message: \`Added \${self.filesAdded}/\${self.totalFiles}\` });
                    } else if (type === 'generate') {
                        self.postMessage({ type: 'progress', message: 'Bundling files... this may take a moment.' });
                        try {
                            const zipBlob = await self.zip.generateAsync({ type: 'blob', compression: 'STORE' }, (meta) => {
                                self.postMessage({ type: 'progress', message: \`Bundling... \${Math.round(meta.percent)}%\` });
                            });
                            self.postMessage({ type: 'complete', zipBlob });
                        } catch (err) {
                            self.postMessage({ type: 'error', message: err.message });
                        }
                    }
                };
            `;

            const blob = new Blob([jszipSource, '\n', workerHandlerCode], { type: 'application/javascript' });
            DownloadManager._workerUrl = URL.createObjectURL(blob);
            DownloadManager._worker = new Worker(DownloadManager._workerUrl);
            return DownloadManager._worker;
        },

        downloadAllImages: async () => {
            if (state.isDownloading) {
                UGModal.alert('Download in Progress', 'A download is already running.', 'info');
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

            const result = await UGModal.confirm({
                title: 'Download All?',
                text: `Create ZIP from ${imageEntries.length} image(s)? (${videoEntries.length} video(s) will be downloaded individually)`,
                icon: 'question',
                confirmText: 'Create ZIP',
                cancelText: 'Cancel'
            });

            if (!result.isConfirmed) return;

            state.isDownloading = true;
            state.notificationType = 'info';
            state.notification = 'Starting download...';

            if (imageEntries.length === 0) {
                state.notification = `Downloading ${videoEntries.length} video(s)...`;
                const results = await Promise.allSettled(
                    videoEntries.map(x => DownloadManager.downloadVideo(x.item.src, DownloadManager._buildFileName(x.item, x.index)))
                );
                const ok = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
                state.notification = `Video downloads finished (${ok}/${videoEntries.length} succeeded).`;
                state.notificationType = ok > 0 ? 'success' : 'warning';
                state.isDownloading = false;
                return;
            }

            DownloadManager._pendingVideoPromises = videoEntries.map(x =>
                DownloadManager.downloadVideo(x.item.src, DownloadManager._buildFileName(x.item, x.index))
            );

            const notifyProgress = Utils.throttle((message) => {
                state.notificationType = 'info';
                state.notification = message;
            }, CONFIG.PROGRESS_NOTIFY_INTERVAL);

            const worker = DownloadManager.createZipWorker();

            worker.onmessage = (e) => {
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

                    DOM.saveBlob(zipBlob, zipFileName);

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

            worker.postMessage({
                type: 'init',
                data: { totalFiles: imageEntries.length }
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
                                    let blob = await ImageCacheDB.get(entry.item.src);
                                    if (!blob) blob = await ImageLoader.fetchBlobDirect(entry.item.src);

                                    if (blob && state.isDownloading && DownloadManager._worker) {
                                        DownloadManager._worker.postMessage({
                                            type: 'addFile',
                                            data: { blob, name: pathInZip }
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
                        DownloadManager._worker.postMessage({ type: 'generate' });
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
                    let blob = await ImageCacheDB.get(item.src);
                    if (!blob) blob = await ImageLoader.fetchBlobDirect(item.src);

                    if (blob) {
                        DOM.saveBlob(blob, formattedName);
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

        cleanupWorker() {
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

    // ====================================================
    // Post Actions & UI Injection
    // ====================================================
    const PostActions = {
        imageLinkClickHandler: (event) => {
            if (event.button !== 0) return;
            const clickedImageLink = event.target.closest(SELECTORS.IMAGE_LINK) || event.target.closest(SELECTORS.VIDEO_LINK);
            if (clickedImageLink) {
                event.preventDefault();
                event.stopPropagation();
            }
        },

        initPostActions() {
            try {
                let postActionsContainer = DOM.$(SELECTORS.POST_ACTIONS);
                if (!postActionsContainer) {
                    const fallbackContainer = DOM.$('.post__body') || DOM.$('.post__files');
                    if (fallbackContainer) {
                        postActionsContainer = DOM.create('div', { className: 'post__actions ug-injected-ui' });
                        fallbackContainer.prepend(postActionsContainer);
                    }
                }

                if (postActionsContainer && !DOM.$('.ug-global-actions', postActionsContainer)) {
                    const globalButtons = DOM.create('div', { className: 'ug-injected-ui ug-global-actions' });
                    elements.galleryButton = UI.createToggleButton('Loading Gallery...', Gallery.toggleGallery, true, 'GALLERY');

                    globalButtons.append(
                        UI.createToggleButton(BUTTONS.HEIGHT, () => PostActions.resizeAllImages('height'), false, 'HEIGHT'),
                        UI.createToggleButton(BUTTONS.WIDTH, () => PostActions.resizeAllImages('width'), false, 'WIDTH'),
                        UI.createToggleButton(BUTTONS.FULL, () => PostActions.resizeAllImages('full'), false, 'FULL'),
                        UI.createToggleButton(BUTTONS.DOWNLOAD_ALL, DownloadManager.downloadAllImages, false, 'DOWNLOAD_ALL'),
                        elements.galleryButton
                    );

                    postActionsContainer.appendChild(globalButtons);
                }

                if (!DOM.$('.settings-button-wrapper')) {
                    const settingsButton = DOM.create('button', {
                        type: 'button',
                        text: BUTTONS.SETTINGS,
                        className: 'settings-button',
                        onclick: () => state.settingsOpen = !state.settingsOpen
                    });

                    const wrapper = DOM.create('div', { className: 'settings-button-wrapper ug-injected-ui' }, [settingsButton]);
                    document.body.appendChild(wrapper);
                    elements.settingsButton = settingsButton;
                }

                const filesArea = DOM.$('div.post__files') || DOM.$('section.site-section--post') || DOM.$('.post__body');
                if (filesArea) {
                    DOM.$$(SELECTORS.FILE_DIVS, filesArea).forEach(thumbnailDiv => {
                        const imgElement = thumbnailDiv.querySelector('img');
                        if (!imgElement) return;

                        // Prevent duplicate button bars if already initialized
                        if (thumbnailDiv.querySelector(`.${CSS.BTN_CONTAINER}`)) return;

                        imgElement.classList.add('post__image');
                        const buttonGroupConfig = [
                            { text: BUTTONS.HEIGHT, action: (evt) => PostActions.resizeImage('height', evt), name: 'HEIGHT' },
                            { text: BUTTONS.WIDTH, action: (evt) => PostActions.resizeImage('width', evt), name: 'WIDTH' },
                            { text: BUTTONS.FULL, action: () => ImageLoader.imageActions.full(imgElement), name: 'FULL' },
                            {
                                text: BUTTONS.DOWNLOAD,
                                action: () => {
                                    const link = imgElement.closest('a');
                                    const originalSrc = link ? link.href.split('?')[0] : imgElement.dataset.originalSrc;
                                    const downloadIndex = state.originalImageSrcs.findIndex(item => item && item.src === originalSrc);
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
                            // Prepend directly INSIDE thumbnailDiv so it sits centered right above the image
                            thumbnailDiv.insertBefore(buttonGroupElement, thumbnailDiv.firstChild);
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

        cleanupPostActions() {
            state.currentLoadSessionId = null;
            ErrorHandler.clearRetries();
            UI.forceHideNotification();

            DOM.$$('img.post__image.ug-image-loaded').forEach(img => img.classList.remove('ug-image-loaded'));
            DOM.$$('.ug-injected-ui').forEach(el => el.remove());
            document.getElementById(CSS.NOTIF_AREA)?.remove();

            const filesArea = DOM.$('div.post__files');
            if (filesArea) {
                filesArea.removeEventListener('click', PostActions.imageLinkClickHandler);
                filesArea.removeAttribute('data-ug-left-click-handler-attached');
            }

            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else if (galleryOverlay) {
                galleryOverlay.remove();
                galleryOverlay = null;
            }

            if (state.settingsOpen) {
                state.settingsOpen = false;
            } else {
                document.getElementById('ug-settings-overlay')?.remove();
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

        updateButtonVisibilityLight() {
            const hideMap = {
                FULL: state.hideFullButton,
                DOWNLOAD: state.hideDownloadButton,
                HEIGHT: state.hideHeightButton,
                WIDTH: state.hideWidthButton
            };

            DOM.$$(`.${CSS.BTN}[data-action]`).forEach(btn => {
                const action = btn.dataset.action;
                if (Object.prototype.hasOwnProperty.call(hideMap, action)) {
                    btn.style.display = hideMap[action] ? 'none' : '';
                }
            });

            if (galleryOverlay) {
                DOM.$$(`.${CSS.GALLERY.NAV}`, galleryOverlay).forEach(n => n.style.display = state.hideNavArrows ? 'none' : '');
            }
        },

        resizeAllImages(action) {
            if (!ImageLoader.imageActions[action]) return;
            state.currentResizeMode = action;
            DOM.$$('img.post__image').forEach(img => ImageLoader.imageActions[action](img));
        },

        resizeImage(action, evt) {
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

    // ====================================================
    // Keyboard & Event Handlers
    // ====================================================
    const EventHandlers = {
        keyMatchesSetting: (eventKey, settingValue) => {
            return Boolean(settingValue) && String(eventKey).toLowerCase() === String(settingValue).toLowerCase();
        },

        handleGlobalKeyDown(event) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName))) {
                return;
            }

            const keyLower = event.key.toLowerCase();

            if (Utils.isPostPage() && EventHandlers.keyMatchesSetting(event.key, state.galleryKey)) {
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

            if (state.isGalleryMode && galleryOverlay) {
                const expandedView = DOM.$(`.${CSS.GALLERY.EXPANDED_VIEW}`, galleryOverlay);
                if (event.key === 'Escape') {
                    event.preventDefault();
                    Gallery.closeGallery();
                    return;
                }

                if (expandedView && !expandedView.classList.contains(CSS.GALLERY.HIDE)) {
                    if (EventHandlers.keyMatchesSetting(event.key, state.nextImageKey) || keyLower === 'arrowright') {
                        event.preventDefault();
                        Gallery.nextImage();
                    } else if (EventHandlers.keyMatchesSetting(event.key, state.prevImageKey) || keyLower === 'arrowleft') {
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
    // SPA-Safe Injection & Initialization
    // ====================================================
    const injectUI = () => {
        try {
            const onPostPage = Utils.isPostPage();
            const postContainer =
                DOM.$('section.site-section--post') ||
                DOM.$('section.site-section--scrape') ||
                DOM.$('.post__body') ||
                DOM.$('.post__content');

            const currentUrl = window.location.href;

            if (onPostPage && postContainer) {
                if (currentUrl !== lastProcessedUrl) {
                    if (
                        DOM.$(SELECTORS.POST_ACTIONS) ||
                        DOM.$('.post__files') ||
                        DOM.$('.post__body')
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

    const init = async () => {
        try {
            const cssText = GM_getResourceText('mainCSS');
            if (cssText) {
                const styleNode = GM_addStyle(cssText);
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
                ImageCacheDB.init();
            }

            CONFIG.MAX_SCALE = SettingsManager.loadSetting('maxZoomScale', CONFIG.MAX_SCALE);
            document.addEventListener('keydown', EventHandlers.handleGlobalKeyDown);
            window.addEventListener('beforeunload', fullCleanup);

            // Modern Navigation API with Fallback
            const debouncedInject = Utils.debounce(injectUI, 150);

            if ('navigation' in window) {
                window.navigation.addEventListener('navigate', (e) => {
                    if (!e.canIntercept || e.hashChange) return;
                    e.intercept({
                        async handler() {
                            await Utils.delay(100);
                            injectUI();
                        }
                    });
                });
            } else {
                const originalPushState = history.pushState;
                history.pushState = function (...args) {
                    originalPushState.apply(this, args);
                    debouncedInject();
                };
                const originalReplaceState = history.replaceState;
                history.replaceState = function (...args) {
                    originalReplaceState.apply(this, args);
                    debouncedInject();
                };
                window.addEventListener('popstate', debouncedInject);
            }

            // Target-filtered MutationObserver (ignores own injected UI overlay updates)
            uiObserver = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.target?.closest?.('.ug-gallery-overlay, #ug-settings-overlay, .ug-notification-area, .ug-modal-overlay')) continue;
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1 && (node.matches?.('.post__files, .scrape__files, article, .post__body') || node.querySelector?.('a.fileThumb, .post__thumbnail'))) {
                            debouncedInject();
                            return;
                        }
                    }
                }
            });

            uiObserver.observe(document.body, { childList: true, subtree: true });
            injectUI();
            setTimeout(() => ThumbnailStrip.updateThumbnailNumbers(), 50);
        } catch (error) {
            console.error('Error in init:', error);
        }
    };

    init();
})();
