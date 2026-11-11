// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1477603-%E3%83%A1%E3%83%AA%E3%83%BC
// @version      4.5.1
// @description  Modern image gallery with streaming ZIP downloads, video playback, browsing, fullscreen with a floating (higher-layer) thumbnail strip, and download features. Native DOM, unified pointer gestures, and zero external UI dependencies.
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
// @resource     mainCSS https://cdn.jsdelivr.net/gh/TearTyr/Ultra-Galleries@26bc08aa2897f03a2d68c30902cf0480d3418d76/Ultra-Galleries.css
// @require      https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js
// @downloadURL  https://update.sleazyfork.org/scripts/537986/Ultra%20Galleries.user.js
// @updateURL    https://update.sleazyfork.org/scripts/537986/Ultra%20Galleries.meta.js
// @noframes
// ==/UserScript==

/* global fflate */

(() => {
    'use strict';

    // ====================================================
    // Core Configuration & Constants
    // ====================================================
    const CONFIG = {
        MAX_CONCURRENT_FETCHES: 3,
        MAX_RETRIES: 5,
        RETRY_DELAY: 2000,
        ERROR_HANDLER_RETRIES: 2,
        MIN_SCALE: 0.05,
        ZOOM_STEP: 0.2,
        DOUBLE_TAP_THRESHOLD: 300,
        SWIPE_NAV_THRESHOLD: 80,
        CACHE_EVICTION_COUNT: 20,
        MAX_CACHE_ENTRIES: 800,
        MAX_CACHE_KEEP_ENTRIES: 600,
        CACHE_TRIM_INTERVAL_WRITES: 25,
        CACHE_TOUCH_INTERVAL: 6 * 60 * 60 * 1000,
        CACHE_MAX_BLOB_BYTES: 30 * 1024 * 1024,
        PRELOAD_COUNT: 2,
        THUMBNAIL_CHUNK_SIZE: 150,
        THUMBNAIL_CHUNK_THRESHOLD: 300,
        SCROLL_SIMULATION_BASE_TIMEOUT: 3000,
        SLIDESHOW_DELAY: 3000,
        CONTROLS_HIDE_DELAY: 3000,
        CONTEXT_MENU_HIDE_DELAY: 200,
        PRELOAD_WINDOW_BUFFER: 4,
        PROGRESS_NOTIFY_INTERVAL: 250,
        ZIP_LOOKAHEAD: 4,
        ZIP_MAX_BYTES: 0xFFFFFFFF - 1_000_000, // fflate writes no ZIP64; stay under the 32-bit limit
        BLOB_URL_REVOKE_DELAY: 60_000,
        LAZY_LOAD_MARGIN: '150% 0px',
        LAZY_UNLOAD_MARGIN: '400% 0px'
    };

    // ====================================================
    // Pawchive Compliance Configuration & Pacer
    // ====================================================
    const SCRIPT_VERSION = '4.5.1';

    const PAWCHIVE_CONFIG = {
        USER_AGENT: `UltraGalleries/${SCRIPT_VERSION} (+https://github.com/TearTyr/Ultra-Galleries; contact: Meri/TearTyr)`,
        MIN_REQUEST_INTERVAL: 1050 // Enforces <= 1 request/second
    };

    const PAWCHIVE_RE = /pawchive\.(st|pw)/i;
    const IS_PAWCHIVE_PAGE = PAWCHIVE_RE.test(window.location.hostname);
    const isPawchiveHost = (url = '') => IS_PAWCHIVE_PAGE || PAWCHIVE_RE.test(url);

    // Post text is author-controlled: only fetch media from the supported sites,
    // never from arbitrary hosts a post links to (tracking / LAN requests).
    const TRUSTED_MEDIA_HOST_RE = /(^|\.)(kemono|coomer|nekohouse|pawchive)\.(su|cr|st|pw)$/i;
    const isTrustedMediaUrl = (url) => {
        if (typeof url !== 'string' || !url) return false;
        if (url.startsWith('data:') || url.startsWith('blob:')) return true;
        try { return TRUSTED_MEDIA_HOST_RE.test(new URL(url, location.href).hostname); } catch { return false; }
    };

    const RequestPacer = {
        lastRequestTime: 0,
        queue: Promise.resolve(),

        throttle(url) {
            if (!isPawchiveHost(url)) return Promise.resolve();
            this.queue = this.queue.catch(() => {}).then(async () => {
                const elapsed = Date.now() - this.lastRequestTime;
                if (elapsed < PAWCHIVE_CONFIG.MIN_REQUEST_INTERVAL) {
                    await Utils.delay(PAWCHIVE_CONFIG.MIN_REQUEST_INTERVAL - elapsed);
                }
                this.lastRequestTime = Date.now();
            });
            return this.queue;
        },

        getHeaders(url) {
            return isPawchiveHost(url) ? { 'User-Agent': PAWCHIVE_CONFIG.USER_AGENT } : {};
        }
    };

    const ActiveRequests = {
        bySession: new Map(),

        add(sessionId, handle) {
            if (!sessionId || !handle) return;
            let set = this.bySession.get(sessionId);
            if (!set) {
                set = new Set();
                this.bySession.set(sessionId, set);
            }
            set.add(handle);
        },

        remove(sessionId, handle) {
            if (!sessionId) return;
            this.bySession.get(sessionId)?.delete(handle);
        },

        abortSession(sessionId) {
            if (!sessionId) return;
            const set = this.bySession.get(sessionId);
            if (!set) return;
            set.forEach(h => { try { h.abort(); } catch { /* ignore */ } });
            this.bySession.delete(sessionId);
        },

        abortAll() {
            for (const set of this.bySession.values()) {
                set.forEach(h => { try { h.abort(); } catch { /* ignore */ } });
            }
            this.bySession.clear();
        }
    };

    const FALLBACK_POSTER = 'data:image/svg+xml;base64,' + btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="#666"><path d="M8 5v14l11-7z"/></svg>'
    );

    const FALLBACK_ATTACHMENT = 'data:image/svg+xml;base64,' + btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    );

    const BUTTONS = {
        DOWNLOAD: '【DOWNLOAD】',
        DOWNLOAD_ALL: '【DL ALL】',
        DOWNLOAD_IMAGES: '【DL IMAGES】',
        DOWNLOAD_ATTACHMENTS: '【DL FILES】',
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
            STRIP_TOGGLE: 'ug-strip-toggle',
            STRIP_FLOATING: 'ug-strip-floating',
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

    const POST_PATH_PATTERNS = [
        /\/user\/.*\/post\//,
        /\/server\/.*\/channel\//,
        /\/post\//
    ];

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
                } else {
                    element.setAttribute(key, value);
                }
            }

            const childArray = Array.isArray(children) ? children : [children];
            for (const child of childArray) {
                if (!child) continue;
                element.append(child);
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
            setTimeout(() => URL.revokeObjectURL(url), CONFIG.BLOB_URL_REVOKE_DELAY);
        }
    };

    // ====================================================
    // Built-in Native Modal System
    // ====================================================
    const MODAL_ICON_SVGS = {
        question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12.01" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    const PLAY_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    const FILE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

    const UGModal = {
        // Tracks the currently-open modal so a superseding modal (or page
        // cleanup) can close it properly — resolving its promise and
        // removing its keydown listener.
        _active: null,

        closeAny() {
            const active = UGModal._active;
            UGModal._active = null;
            if (active) {
                try { active.cancel(); } catch { /* ignore */ }
            }
        },

        isOpen() {
            return UGModal._active !== null;
        },

        // Shared implementation for confirm/alert/choose.
        // `buttons`: [{ label, value, primary }]; `enterValue`: value Enter
        // resolves with (undefined = Enter does nothing special);
        // `escapeValue`: value Escape resolves with.
        _open({ title, text, icon, buttons, enterValue, escapeValue }) {
            return new Promise((resolve) => {
                UGModal.closeAny();

                const opener = document.activeElement;
                const prevOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';

                let closed = false;
                const focusables = buttons.map(opt => DOM.create('button', {
                    className: `ug-modal-btn ${opt.primary ? 'ug-modal-confirm' : 'ug-modal-cancel'}`,
                    text: opt.label,
                    onclick: () => close(opt.value)
                }));

                const overlay = DOM.create('div', { className: 'ug-modal-overlay' }, [
                    DOM.create('div', { className: 'ug-modal-container' }, [
                        DOM.create('div', { className: `ug-modal-icon ${icon}`, html: MODAL_ICON_SVGS[icon] || MODAL_ICON_SVGS.info }),
                        DOM.create('h3', { className: 'ug-modal-title', text: title }),
                        DOM.create('p', { className: 'ug-modal-text', text }),
                        DOM.create('div', { className: 'ug-modal-actions' }, focusables)
                    ])
                ]);

                document.body.appendChild(overlay);
                requestAnimationFrame(() => overlay.classList.add('show'));
                focusables[0]?.focus();

                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        close(escapeValue);
                        return;
                    }
                    if (e.key === 'Enter' && enterValue !== undefined) {
                        const t = e.target;
                        if (focusables.includes(t) || t === overlay || t === document.body) {
                            e.preventDefault();
                            // Enter on a focused button activates THAT button.
                            const idx = focusables.indexOf(t);
                            close(idx > -1 ? buttons[idx].value : enterValue);
                        }
                        return;
                    }
                    if (e.key === 'Tab') {
                        const first = focusables[0];
                        const last = focusables[focusables.length - 1];
                        if (!focusables.includes(document.activeElement)) {
                            e.preventDefault();
                            first.focus();
                        } else if (e.shiftKey && document.activeElement === first) {
                            e.preventDefault();
                            last.focus();
                        } else if (!e.shiftKey && document.activeElement === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                };
                window.addEventListener('keydown', onKey);

                const handle = { cancel: () => close(escapeValue) };
                function close(value) {
                    if (closed) return;
                    closed = true;
                    if (UGModal._active === handle) UGModal._active = null;
                    window.removeEventListener('keydown', onKey);
                    overlay.classList.remove('show');
                    document.body.style.overflow = prevOverflow;
                    setTimeout(() => {
                        overlay.remove();
                        try { opener?.focus?.(); } catch { /* ignore */ }
                    }, 200);
                    resolve(value);
                }
                UGModal._active = handle;
            });
        },

        async confirm({ title, text, confirmText = 'Confirm', cancelText = 'Cancel', icon = 'question' }) {
            const buttons = [{ label: confirmText, value: true, primary: true }];
            if (cancelText) buttons.push({ label: cancelText, value: false });
            const result = await UGModal._open({ title, text, icon, buttons, enterValue: true, escapeValue: false });
            return { isConfirmed: result === true };
        },

        alert(title, text, icon = 'info') {
            return UGModal.confirm({ title, text, confirmText: 'OK', cancelText: null, icon });
        },

        async choose({ title, text, icon = 'question', options }) {
            const value = await UGModal._open({ title, text, icon, buttons: options, enterValue: undefined, escapeValue: null });
            return { value };
        }
    };

    // ====================================================
    // Native IndexedDB Cache Manager
    // ====================================================
    const ImageCacheDB = {
        DB_NAME: 'UltraGalleriesCache',
        STORE_NAME: 'imageCache',
        dbPromise: null,
        _writesSinceTrim: 0,

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
                req.onsuccess = () => {
                    const db = req.result;
                    // Another tab upgrading the DB must not be blocked by us.
                    db.onversionchange = () => { db.close(); ImageCacheDB.dbPromise = null; };
                    resolve(db);
                };
                req.onerror = () => { ImageCacheDB.dbPromise = null; reject(req.error); };
            });
            return this.dbPromise;
        },

        // Readonly lookup. The LRU stamp is refreshed at most every
        // CACHE_TOUCH_INTERVAL — rewriting the record (blob included) on
        // every hit was the single most expensive thing the cache did.
        async get(url) {
            try {
                const db = await this.init();
                return await new Promise((resolve) => {
                    const tx = db.transaction(this.STORE_NAME, 'readonly');
                    const req = tx.objectStore(this.STORE_NAME).get(url);
                    req.onsuccess = () => {
                        const record = req.result;
                        if (!record?.blob) { resolve(null); return; }
                        resolve(record.blob);
                        if (Date.now() - (record.cachedAt || 0) > CONFIG.CACHE_TOUCH_INTERVAL) {
                            ImageCacheDB._touch(db, record);
                        }
                    };
                    req.onerror = () => resolve(null);
                    tx.onabort = () => resolve(null);
                });
            } catch {
                return null;
            }
        },

        _touch(db, record) {
            try {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                tx.objectStore(this.STORE_NAME).put({ ...record, cachedAt: Date.now() });
            } catch { /* best effort */ }
        },

        async put(url, blob) {
            if (!blob || blob.size > CONFIG.CACHE_MAX_BLOB_BYTES) return false;
            try {
                const db = await this.init();
                return await new Promise((resolve) => {
                    let settled = false;
                    const done = (result) => { if (!settled) { settled = true; resolve(result); } };
                    const tx = db.transaction(this.STORE_NAME, 'readwrite');
                    tx.objectStore(this.STORE_NAME).put({ url, blob, cachedAt: Date.now() });
                    tx.oncomplete = () => {
                        done(true);
                        if (++ImageCacheDB._writesSinceTrim >= CONFIG.CACHE_TRIM_INTERVAL_WRITES) {
                            ImageCacheDB._writesSinceTrim = 0;
                            ImageCacheDB.enforceCap();
                        }
                    };
                    tx.onerror = async (e) => {
                        if (e.target.error?.name === 'QuotaExceededError') {
                            await ImageCacheDB.evictOldest(CONFIG.CACHE_EVICTION_COUNT);
                        }
                        done(false);
                    };
                    // An abort can fire without onerror (quota hit at commit).
                    tx.onabort = () => done(false);
                });
            } catch {
                return false;
            }
        },

        evictOldest(count = 20) {
            return this.init().then(db => new Promise((resolve) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const index = tx.objectStore(this.STORE_NAME).index('cachedAt');
                let deleted = 0;
                // Key cursor: walks the index without loading any blobs.
                index.openKeyCursor().onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && deleted < count) {
                        tx.objectStore(this.STORE_NAME).delete(cursor.primaryKey);
                        deleted++;
                        cursor.continue();
                    }
                };
                tx.oncomplete = () => resolve(deleted);
                tx.onerror = () => resolve(deleted);
                tx.onabort = () => resolve(deleted);
            })).catch(() => 0);
        },

        async count() {
            const db = await this.init();
            return new Promise((resolve) => {
                const tx = db.transaction(this.STORE_NAME, 'readonly');
                const req = tx.objectStore(this.STORE_NAME).count();
                req.onsuccess = () => resolve(req.result || 0);
                req.onerror = () => resolve(0);
                tx.onabort = () => resolve(0);
            });
        },

        // Keeps the store under MAX_CACHE_ENTRIES by dropping least-recently-used records.
        async enforceCap() {
            try {
                const count = await this.count();
                if (count > CONFIG.MAX_CACHE_ENTRIES) {
                    await this.evictOldest(count - CONFIG.MAX_CACHE_KEEP_ENTRIES);
                }
            } catch { /* ignore */ }
        },

        async getStats() {
            try {
                const count = await this.count();
                // The Storage API gives the real on-disk figure without
                // reading every blob back out of IndexedDB.
                let bytes = 0;
                if (navigator.storage?.estimate) {
                    const est = await navigator.storage.estimate();
                    bytes = est.usageDetails?.indexedDB ?? est.usage ?? 0;
                }
                return { count, bytes };
            } catch {
                return { count: 0, bytes: 0 };
            }
        },

        async clear() {
            try {
                const db = await this.init();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(this.STORE_NAME, 'readwrite');
                    tx.objectStore(this.STORE_NAME).clear();
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(tx.error);
                });
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
    const loadedBlobUrls = new Map();
    const elements = {
        galleryButton: null,
        settingsButton: null
    };
    let lastFocusedElement = null;
    let galleryOpenerElement = null;
    let focusTrapListener = null;
    let uiObserver = null;
    let lastProcessedUrl = null;

    // Cached gallery DOM references (filled in createGallery, cleared in
    // closeGallery). Saves a querySelector on every frame/navigation.
    const galleryRefs = {
        mainContainer: null,
        ambient: null,
        counter: null,
        zoomControls: null,
        resetBtn: null,
        fillHeightBtn: null,
        expandedView: null,
        toolbar: null,
        strip: null,
        stripContainer: null,
        stripToggle: null,
        fullscreenBtn: null,
        zoomLevel: null,
        slideshowBtn: null,

        clear() {
            for (const key of Object.keys(this)) {
                if (typeof this[key] !== 'function') this[key] = null;
            }
        }
    };

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
    const DATE_SELECTORS = {
        edited: '.post__edited, .scrape__edited',
        added: '.post__added, .scrape__added',
        imported: '.post__added, .scrape__added',
        published: '.post__published, .scrape__published, time[datetime]'
    };

    const Utils = {
        sanitizeFileName: name => String(name || '').replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-').trim(),

        // Created once — Intl.Collator is expensive to instantiate, cheap to reuse.
        _naturalCollator: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }),

        naturalCompare(a, b) {
            return Utils._naturalCollator.compare(String(a ?? ''), String(b ?? ''));
        },

        // Original filename, in reliability order: download attr → ?f= → URL tail.
        extractFileName(linkEl, fallbackUrl) {
            const dl = linkEl?.getAttribute?.('download');
            if (dl && dl.trim()) return dl.trim();

            const href = linkEl?.getAttribute?.('href') || '';
            const fMatch = href.match(/[?&]f=([^&#]+)/);
            if (fMatch) {
                try { return decodeURIComponent(fMatch[1]); } catch { return fMatch[1]; }
            }

            try {
                return String(fallbackUrl || '').split('?')[0].split('/').pop() || '';
            } catch {
                return '';
            }
        },

        sortItems(items, mode) {
            if (mode === 'filename-asc') {
                items.sort((a, b) => Utils.naturalCompare(a.fileName, b.fileName));
            } else if (mode === 'filename-desc') {
                items.sort((a, b) => Utils.naturalCompare(b.fileName, a.fileName));
            }
            return items;
        },

        _getDateRaw(type) {
            const timeEl = DOM.$(DATE_SELECTORS[type] || DATE_SELECTORS.published);
            if (!timeEl) return '';
            return (
                timeEl.getAttribute('datetime') ||
                timeEl.querySelector('time[datetime]')?.getAttribute('datetime') ||
                timeEl.textContent || ''
            ).trim();
        },

        getPostDate(type = 'published') {
            const dateStr = Utils._getDateRaw(type);
            if (!dateStr) return 'UnknownDate';
            const match = dateStr.match(/\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?|\d{4}-\d{2}/);
            if (match) {
                return Utils.sanitizeFileName(match[0].replace(/[ T]/g, '_').replace(/:/g, '-'));
            }
            return Utils.sanitizeFileName(dateStr.replace(/.*?:\s*/, ''));
        },

        // fflate writes ZIP (DOS) timestamps from LOCAL date components,
        // so the Date is built in local time to reproduce the exact
        // wall-clock shown on the post page.
        getPostDateObject(type = 'published') {
            const raw = Utils._getDateRaw(type);
            const match = raw.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
            if (!match) return null;
            const [, y, mo, d, h = '00', mi = '00', s = '00'] = match;
            const date = new Date(+y, +mo - 1, +d, +h, +mi, +s);
            // fflate throws on ZIP (DOS) dates outside 1980-2099.
            return (Number.isNaN(date.getTime()) || date.getFullYear() < 1980 || date.getFullYear() > 2099) ? null : date;
        },

        setImageStyle(img, styles) {
            if (!img) return;
            for (const key in styles) {
                const kebabKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                img.style.setProperty(kebabKey, styles[key], 'important');
            }
        },

        isPostPage() {
            if (POST_PATH_PATTERNS.some(pattern => pattern.test(window.location.pathname))) return true;
            return Boolean(
                DOM.$(SELECTORS.IMAGE_LINK) ||
                DOM.$('div.post__files') ||
                DOM.$(SELECTORS.GENERIC_IMAGE_LINK)
            );
        },

        delay: ms => new Promise(resolve => setTimeout(resolve, ms)),

        debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        // Leading + trailing throttle: the last call in a burst always runs.
        throttle(func, limit) {
            let lastRan = 0;
            let trailing = null;
            return function (...args) {
                const now = Date.now();
                const remaining = limit - (now - lastRan);
                if (remaining <= 0) {
                    clearTimeout(trailing);
                    trailing = null;
                    lastRan = now;
                    func.apply(this, args);
                } else {
                    clearTimeout(trailing);
                    trailing = setTimeout(() => {
                        lastRan = Date.now();
                        trailing = null;
                        func.apply(this, args);
                    }, remaining);
                }
            };
        },

        handleMediaSrc(mediaLink) {
            let href = mediaLink.getAttribute('href') || mediaLink.querySelector('.fileThumb')?.getAttribute('href');
            if (!href && mediaLink.href) href = mediaLink.href;

            if (href) {
                return href.split('?')[0].replace('/thumbnail/', '/data/');
            }

            const directImg = mediaLink.querySelector('img');
            if (directImg) {
                const rawSrc = directImg.getAttribute('data-src') || directImg.src;
                if (!rawSrc) return null;
                return rawSrc.split('?')[0].replace('/thumbnail/', '/data/');
            }
            return null;
        },

        ensureThumbnailsExist() {
            try {
                DOM.$$(SELECTORS.VIDEO_LINK).forEach(videoLink => {
                    if (videoLink.closest(SELECTORS.VIDEO_THUMBNAIL)) return;
                    const video = videoLink.querySelector('video');
                    const posterUrl = video?.getAttribute('poster');
                    if (!posterUrl || !videoLink.parentNode) return;
                    const thumbnailContainer = DOM.create('div', {
                        className: isNekohouse ? 'scrape__video-thumbnail' : 'post__video-thumbnail'
                    }, [
                        DOM.create('img', {
                            src: posterUrl,
                            className: isNekohouse ? 'scrape__thumbnail-img' : 'post__thumbnail-img'
                        })
                    ]);
                    videoLink.before(thumbnailContainer);
                });
            } catch (error) {
                console.warn('Minor error ensuring thumbnails:', error);
            }
        }
    };

    const notifyLoadProgress = Utils.throttle((message, type = 'info') => {
        if (!state.isLoading) return;
        state.notificationType = type;
        state.notification = message;
    }, CONFIG.PROGRESS_NOTIFY_INTERVAL);

    // ====================================================
    // Image Sizing Module
    // ====================================================
    const ImageSizing = {
        applyBestFit(el) {
            Utils.setImageStyle(el, {
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                margin: '0'
            });
        },

        applyFillHeight(el) {
            Utils.setImageStyle(el, {
                maxHeight: '90vh',
                maxWidth: '100%',
                width: 'auto',
                height: '90vh',
                objectFit: 'contain'
            });
        },

        applyFillWidth(el) {
            Utils.setImageStyle(el, {
                maxHeight: 'none',
                maxWidth: '100vw',
                width: '100%',
                height: 'auto',
                objectFit: 'contain'
            });
        },

        applyFullSize(el) {
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
        calculateHardBoundaryOffsets(offsetX, offsetY, scale, containerRect, imageDOM) {
            if (!imageDOM || !containerRect) return { x: offsetX, y: offsetY };

            // Rendered layout box (offsetWidth ignores transforms), not intrinsic pixels.
            const baseW = imageDOM.offsetWidth || imageDOM.naturalWidth || imageDOM.videoWidth || 0;
            const baseH = imageDOM.offsetHeight || imageDOM.naturalHeight || imageDOM.videoHeight || 0;
            const imgWidth = baseW * scale;
            const imgHeight = baseH * scale;

            const x = imgWidth > containerRect.width
                ? Math.max(containerRect.width - imgWidth, Math.min(offsetX, 0))
                : 0;
            const y = imgHeight > containerRect.height
                ? Math.max(containerRect.height - imgHeight, Math.min(offsetY, 0))
                : 0;

            return { x, y };
        }
    };

    // ====================================================
    // Unified Pointer Events & Gesture Engine
    // ====================================================
    const PointerEngine = {
        activePointers: new Map(),
        isDragging: false,
        lastUpdateTime: 0,
        velocity: { x: 0, y: 0 },
        lastPosition: { x: 0, y: 0 },
        animationFrame: null,
        inertiaAnimation: null,
        boundaryAnimation: null,
        cachedImgEl: null,
        lastTapTime: 0,
        lastTapMoved: false,
        lastPointerType: '',

        init(containerDOM, signal) {
            const opts = { passive: false, signal };
            containerDOM.addEventListener('pointerdown', PointerEngine.onPointerDown, opts);
            containerDOM.addEventListener('pointermove', PointerEngine.onPointerMove, opts);
            containerDOM.addEventListener('pointerup', PointerEngine.onPointerUp, opts);
            containerDOM.addEventListener('pointercancel', PointerEngine.onPointerUp, opts);
        },

        cancelAnimations() {
            if (PointerEngine.inertiaAnimation) cancelAnimationFrame(PointerEngine.inertiaAnimation);
            if (PointerEngine.animationFrame) cancelAnimationFrame(PointerEngine.animationFrame);
            if (PointerEngine.boundaryAnimation) cancelAnimationFrame(PointerEngine.boundaryAnimation);
            PointerEngine.inertiaAnimation = null;
            PointerEngine.animationFrame = null;
            PointerEngine.boundaryAnimation = null;
        },

        reset() {
            PointerEngine.cancelAnimations();
            PointerEngine.activePointers.clear();
            PointerEngine.isDragging = false;
            PointerEngine.cachedImgEl = null;
            viewState.pinchZoomActive = false;
        },

        scheduleTransform() {
            if (!PointerEngine.animationFrame) {
                PointerEngine.animationFrame = requestAnimationFrame(PointerEngine.updateTransform);
            }
        },

        updateTransform() {
            PointerEngine.animationFrame = null;
            if (!PointerEngine.cachedImgEl?.isConnected) {
                PointerEngine.cachedImgEl = galleryRefs.mainContainer?.querySelector('img, video') || null;
            }

            const el = PointerEngine.cachedImgEl;
            if (el) {
                el.style.transform =
                    `translate(${viewState.imageOffset.x}px, ${viewState.imageOffset.y}px) scale(${viewState.zoomScale})`;
            }

            if (galleryRefs.zoomLevel) {
                galleryRefs.zoomLevel.textContent = `${Math.round(viewState.zoomScale * 100)}%`;
            }
        },

        onPointerDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            PointerEngine.lastPointerType = e.pointerType || '';
            // Let native <video> controls receive input at rest scale.
            if (e.target instanceof HTMLVideoElement && viewState.zoomScale <= 1) return;
            // Buttons inside the media area (play overlay, attachment download).
            if (e.target.closest?.('button')) return;
            e.preventDefault();

            PointerEngine.activePointers.set(e.pointerId, e);
            const container = e.currentTarget;
            container.setPointerCapture(e.pointerId);

            if (PointerEngine.inertiaAnimation) {
                cancelAnimationFrame(PointerEngine.inertiaAnimation);
                PointerEngine.inertiaAnimation = null;
            }
            if (PointerEngine.boundaryAnimation) {
                cancelAnimationFrame(PointerEngine.boundaryAnimation);
                PointerEngine.boundaryAnimation = null;
            }

            if (PointerEngine.activePointers.size === 1) {
                const now = Date.now();
                // A double-tap only counts if the previous tap stayed put.
                if (e.pointerType === 'touch' && !PointerEngine.lastTapMoved &&
                    now - PointerEngine.lastTapTime < CONFIG.DOUBLE_TAP_THRESHOLD) {
                    PointerEngine.handleDoubleTap(e);
                    PointerEngine.lastTapTime = 0;
                    return;
                }
                PointerEngine.lastTapTime = now;
                PointerEngine.lastTapMoved = false;

                PointerEngine.isDragging = true;
                PointerEngine.lastUpdateTime = performance.now();

                viewState.dragStartPosition = { x: e.clientX, y: e.clientY };
                viewState.dragStartOffset = { ...viewState.imageOffset };
                PointerEngine.lastPosition = { x: e.clientX, y: e.clientY };
                PointerEngine.velocity = { x: 0, y: 0 };

                container.classList.add(CSS.GALLERY.GRABBING);
                container.style.willChange = 'transform';
            } else if (PointerEngine.activePointers.size === 2) {
                PointerEngine.isDragging = false;
                viewState.pinchZoomActive = true;
                const [p1, p2] = PointerEngine.activePointers.values();
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

                if (!PointerEngine.lastTapMoved && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                    PointerEngine.lastTapMoved = true;
                }

                viewState.imageOffset.x = viewState.dragStartOffset.x + deltaX;
                viewState.imageOffset.y = viewState.dragStartOffset.y + deltaY;
                PointerEngine.scheduleTransform();
            } else if (viewState.pinchZoomActive && PointerEngine.activePointers.size === 2) {
                if (viewState.initialTouchDistance === 0) return;
                const [p1, p2] = PointerEngine.activePointers.values();
                const currentDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);

                const scaleFactor = currentDistance / viewState.initialTouchDistance;
                const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.initialScale * scaleFactor, state.maxZoomScale));

                const imageX = (viewState.zoomOrigin.x - viewState.imageOffset.x) / viewState.zoomScale;
                const imageY = (viewState.zoomOrigin.y - viewState.imageOffset.y) / viewState.zoomScale;

                viewState.imageOffset.x = viewState.zoomOrigin.x - (imageX * newScale);
                viewState.imageOffset.y = viewState.zoomOrigin.y - (imageY * newScale);
                viewState.zoomScale = newScale;

                // Coalesced to one write per frame (was synchronous per event).
                PointerEngine.scheduleTransform();
            }
        },

        onPointerUp(e) {
            if (PointerEngine.activePointers.has(e.pointerId)) {
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                PointerEngine.activePointers.delete(e.pointerId);
            }

            if (PointerEngine.activePointers.size === 0) {
                if (PointerEngine.isDragging) {
                    // A pinch that ended one finger at a time still needs its zoom class synced.
                    if (viewState.pinchZoomActive) Zoom.applyZoom();
                    PointerEngine.isDragging = false;
                    const container = galleryRefs.mainContainer;
                    if (container) {
                        container.classList.remove(CSS.GALLERY.GRABBING);
                        setTimeout(() => { container.style.willChange = ''; }, 1000);
                    }

                    // Swipe-to-navigate at rest scale.
                    const swipeDx = PointerEngine.lastPosition.x - viewState.dragStartPosition.x;
                    const swipeDy = PointerEngine.lastPosition.y - viewState.dragStartPosition.y;
                    if (viewState.zoomScale <= 1 &&
                        Math.abs(swipeDx) >= CONFIG.SWIPE_NAV_THRESHOLD &&
                        Math.abs(swipeDx) > Math.abs(swipeDy)) {
                        viewState.pinchZoomActive = false;
                        viewState.imageOffset = { x: 0, y: 0 };
                        PointerEngine.velocity = { x: 0, y: 0 };
                        PointerEngine.updateTransform();
                        if (swipeDx < 0) Gallery.nextImage();
                        else Gallery.prevImage();
                        return;
                    }

                    if (state.inertiaEnabled && (Math.abs(PointerEngine.velocity.x) > 0.5 || Math.abs(PointerEngine.velocity.y) > 0.5)) {
                        PointerEngine.applyInertia();
                    } else {
                        PointerEngine.enforceBoundaries();
                    }
                } else if (viewState.pinchZoomActive) {
                    Zoom.applyZoom();
                    PointerEngine.enforceBoundaries();
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
            // Time-based decay: identical feel on 60/120 Hz/VRR displays.
            const FRAME_MS = 1000 / 60;
            const FRICTION_PER_FRAME = 0.95;
            const minVelocity = 0.5;
            let lastTime = performance.now();

            const animate = (now) => {
                const dt = Math.min(Math.max(now - lastTime, 0), 100);
                lastTime = now;
                const frames = dt / FRAME_MS;
                const decay = FRICTION_PER_FRAME ** frames;

                PointerEngine.velocity.x *= decay;
                PointerEngine.velocity.y *= decay;

                viewState.imageOffset.x += PointerEngine.velocity.x * frames;
                viewState.imageOffset.y += PointerEngine.velocity.y * frames;

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
            const containerDOM = galleryRefs.mainContainer;
            const imageDOM = containerDOM?.querySelector(`.${CSS.GALLERY.MAIN_IMG}, .${CSS.GALLERY.MAIN_VIDEO}`);
            if (!containerDOM || !imageDOM) return;

            const containerRect = containerDOM.getBoundingClientRect();
            const bounded = ZoomHelper.calculateHardBoundaryOffsets(
                viewState.imageOffset.x,
                viewState.imageOffset.y,
                viewState.zoomScale,
                containerRect,
                imageDOM
            );

            if (bounded.x === viewState.imageOffset.x && bounded.y === viewState.imageOffset.y) return;

            const duration = 300;
            const startX = viewState.imageOffset.x;
            const startY = viewState.imageOffset.y;
            const deltaX = bounded.x - startX;
            const deltaY = bounded.y - startY;
            const startTime = performance.now();

            const animateToBoundary = (currentTime) => {
                const progress = Math.min((currentTime - startTime) / duration, 1);
                const ease = 1 - (1 - progress) ** 3;

                viewState.imageOffset.x = startX + deltaX * ease;
                viewState.imageOffset.y = startY + deltaY * ease;
                PointerEngine.updateTransform();

                PointerEngine.boundaryAnimation = progress < 1 ? requestAnimationFrame(animateToBoundary) : null;
            };

            if (PointerEngine.boundaryAnimation) cancelAnimationFrame(PointerEngine.boundaryAnimation);
            PointerEngine.boundaryAnimation = requestAnimationFrame(animateToBoundary);
        },

        handleDoubleTap(e) {
            e.preventDefault();
            if (!galleryOverlay || !state.zoomEnabled) return;

            const containerDOM = galleryRefs.mainContainer;
            if (!containerDOM) return;

            if (viewState.zoomScale > 1) {
                Zoom.resetZoom();
                return;
            }

            const rect = containerDOM.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const newScale = Math.min(2.5, state.maxZoomScale);
            const imageX = (clickX - viewState.imageOffset.x) / viewState.zoomScale;
            const imageY = (clickY - viewState.imageOffset.y) / viewState.zoomScale;

            Zoom._applyTransition(containerDOM, () => {
                viewState.imageOffset.x = clickX - (imageX * newScale);
                viewState.imageOffset.y = clickY - (imageY * newScale);
                viewState.zoomScale = newScale;
                Zoom.applyZoom();
            });
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
            Slideshow.delay = state.slideshowDelay || CONFIG.SLIDESHOW_DELAY;
            Slideshow.pauseOnHover = state.slideshowPauseOnHover !== false;
        },

        _tick() {
            // Don't advance while the user is panning/pinching or the tab is hidden.
            if (document.hidden || PointerEngine.isDragging || viewState.pinchZoomActive) return;
            // Let a playing video finish instead of cutting it off.
            if (galleryRefs.mainContainer?.querySelector('video')?.paused === false) return;
            Gallery.nextImage();
        },

        start() {
            if (Slideshow.isActive) return;
            Slideshow.init();
            Slideshow.isActive = true;
            Slideshow.interval = setInterval(Slideshow._tick, Slideshow.delay);
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

        stop(silent = false) {
            if (!Slideshow.isActive) return;
            Slideshow.isActive = false;
            clearInterval(Slideshow.interval);
            Slideshow.interval = null;
            if (galleryOverlay) {
                Slideshow.hideIndicator();
                galleryOverlay.removeEventListener('mouseenter', Slideshow.pause);
                galleryOverlay.removeEventListener('mouseleave', Slideshow.resume);
            }
            Slideshow.syncControls();
            if (silent) return;
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
                Slideshow.interval = setInterval(Slideshow._tick, Slideshow.delay);
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
            const btn = galleryRefs.slideshowBtn;
            if (!btn) return;

            if (!Slideshow.isActive) {
                btn.textContent = '▶';
                btn.title = 'Start Slideshow (Space)';
                btn.classList.remove('slideshow-running', 'slideshow-paused');
            } else if (Slideshow.interval) {
                btn.textContent = '❚❚';
                btn.title = 'Pause Slideshow';
                btn.classList.add('slideshow-running');
                btn.classList.remove('slideshow-paused');
            } else {
                btn.textContent = '▶';
                btn.title = 'Resume Slideshow';
                btn.classList.add('slideshow-paused');
                btn.classList.remove('slideshow-running');
            }
        },

        showIndicator() {
            const toolbar = galleryRefs.toolbar;
            if (!toolbar || DOM.$('.ug-slideshow-indicator', toolbar)) return;

            toolbar.appendChild(DOM.create('div', { className: 'ug-slideshow-indicator' }, [
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
            ]));
        },

        hideIndicator() {
            galleryOverlay?.querySelector('.ug-slideshow-indicator')?.remove();
        },

        updateIndicator(isPaused) {
            const indicator = galleryOverlay?.querySelector('.ug-slideshow-indicator');
            if (!indicator) return;
            const icon = DOM.$('.ug-slideshow-icon', indicator);
            if (icon) icon.textContent = isPaused ? '❚❚' : '▶';
            indicator.classList.toggle('paused', isPaused);
        },

        setDelay(delay) {
            Slideshow.delay = delay;
            if (Slideshow.isActive) {
                Slideshow.stop(true);
                Slideshow.start();
            }
        }
    };

    // ====================================================
    // Error Handler Module
    // ====================================================
    const ErrorHandler = {
        retryAttempts: new Map(),

        // fetchBlob already retries MAX_RETRIES times with backoff, so the
        // outer layer only does a couple of single-shot attempts (the old
        // nested retries could hit one dead URL ~30 times).
        async handleImageError(error, url, element = null, context = {}) {
            if (error?.message === 'Stale session' || error?.message === 'Request aborted') return;

            const permanent = error?.status >= 400 && error.status < 500 && error.status !== 429;
            const retryCount = ErrorHandler.retryAttempts.get(url) || 0;
            console.error(`Image load error (${retryCount + 1}/${CONFIG.ERROR_HANDLER_RETRIES}):`, error, url);

            if (permanent || retryCount >= CONFIG.ERROR_HANDLER_RETRIES) {
                ErrorHandler.showErrorPlaceholder(element, url, context);
                ErrorHandler.retryAttempts.delete(url);
                state.notificationType = 'error';
                state.notification = permanent
                    ? `Image unavailable (HTTP ${error.status})`
                    : 'Failed to load image after several attempts';
                return;
            }

            ErrorHandler.retryAttempts.set(url, retryCount + 1);
            if (retryCount === 0) {
                state.notificationType = 'warning';
                state.notification = 'Retrying failed image...';
            }

            const sessionId = state.currentLoadSessionId;
            await Utils.delay(2 ** retryCount * 4000);
            if (state.currentLoadSessionId !== sessionId) return;

            try {
                element?.classList.add('retrying');
                const blob = await ImageLoader.fetchBlob(url, sessionId, 0);
                if (blob && element?.isConnected) {
                    element.src = BlobManager.createUrl(blob);
                    element.classList.remove('error', 'retrying');
                    ErrorHandler.retryAttempts.delete(url);
                    state.notificationType = 'success';
                    state.notification = 'Image loaded successfully';
                }
            } catch (retryError) {
                ErrorHandler.handleImageError(retryError, url, element, context);
            }
        },

        showErrorPlaceholder(element, url, context) {
            if (!element?.parentNode) return;

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
                        errorContainer.replaceWith(element);
                        element.classList.add('loading');
                        ErrorHandler.retryAttempts.delete(url);
                        if (!context.linkElement || !context.itemData) return;
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

            element.replaceWith(errorContainer);
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
            stripMode: 'floating',
            hideNavArrows: false,

            hideGlobalGalleryButton: false,
            hideGlobalHeightButton: false,
            hideGlobalWidthButton: false,
            hideGlobalFullButton: false,
            hideGlobalDownloadAllButton: false,
            hideGlobalDownloadImagesButton: false,
            hideGlobalDownloadAttachmentsButton: false,

            hideThumbnailHeightButton: false,
            hideThumbnailWidthButton: false,
            hideThumbnailFullButton: false,
            hideThumbnailDownloadButton: false,

            enablePersistentCaching: true,
            preserveFileDates: true,
            slideshowDelay: CONFIG.SLIDESHOW_DELAY,
            slideshowPauseOnHover: true,
            inertiaEnabled: true,
            maxZoomScale: 5,
            zipFileNameFormat: '{date_published}-{title}-{artistName}.zip',
            imageFileNameFormat: '{date_published}-{title}-{artistName}-{fileName}-{index}',
            autoLoadOriginals: true,
            downloadBtnText: '【DOWNLOAD】',
            downloadAllBtnText: '【DL ALL】',
            downloadImagesBtnText: '【DL IMAGES】',
            downloadAttachmentsBtnText: '【DL FILES】',
            fullBtnText: '【FULL】',
            heightBtnText: '【FILL HEIGHT】',
            widthBtnText: '【FILL WIDTH】',
            galleryBtnText: '【GALLERY】',
            sortMode: 'dom',
            currentResizeMode: 'height',
            fullscreenMode: 'native'
        },

        saveSetting(key, value) {
            try {
                GM_setValue(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('Failed to save setting:', key, error);
                return false;
            }
        },

        loadSetting(key, defaultValue = null) {
            try {
                const value = GM_getValue(key);
                if (value === undefined) return defaultValue;
                try { return JSON.parse(value); } catch { return value; }
            } catch (error) {
                console.error('Failed to load setting:', key, error);
                return defaultValue;
            }
        },

        // Loads AND sanitizes, so a corrupted stored value can't break the UI.
        loadAllSettings() {
            const settings = {};
            for (const [key, def] of Object.entries(SettingsManager.defaultSettings)) {
                settings[key] = SettingsManager.sanitizeSetting(key, SettingsManager.loadSetting(key, def));
            }
            return settings;
        },

        saveAllSettings(settings) {
            let success = true;
            for (const [key, value] of Object.entries(settings)) {
                if (!SettingsManager.saveSetting(key, value)) success = false;
            }
            return success;
        },

        resetToDefaults: () => SettingsManager.saveAllSettings(SettingsManager.defaultSettings),

        exportSettings: () => JSON.stringify(SettingsManager.loadAllSettings(), null, 2),

        sanitizeSetting(key, value) {
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
                case 'stripMode':
                    return ['floating', 'docked'].includes(value) ? value : 'floating';
                case 'fullscreenMode':
                    return ['native', 'css', 'ask'].includes(value) ? value : 'native';
                case 'sortMode':
                    return ['dom', 'filename-asc', 'filename-desc'].includes(value) ? value : 'dom';
                case 'currentResizeMode':
                    return ['height', 'width', 'full'].includes(value) ? value : 'height';
                case 'zipFileNameFormat':
                case 'imageFileNameFormat':
                    return (typeof value === 'string' && value.trim()) ? value : def;
                default:
                    if (typeof def === 'boolean') return Boolean(value);
                    if (typeof def === 'string') return (typeof value === 'string') ? value : def;
                    return value;
            }
        },

        importSettings(settingsJson) {
            try {
                const settings = JSON.parse(settingsJson);
                const validated = {};
                for (const key of Object.keys(SettingsManager.defaultSettings)) {
                    const incoming = Object.hasOwn(settings, key) ? settings[key] : SettingsManager.defaultSettings[key];
                    validated[key] = SettingsManager.sanitizeSetting(key, incoming);
                }

                if (SettingsManager.saveAllSettings(validated)) {
                    Object.assign(state, validated);
                    updateButtonLabels();
                    Slideshow.init();
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
        _liveRegion: null,

        init() {
            if (galleryOverlay) {
                galleryOverlay.setAttribute('role', 'dialog');
                galleryOverlay.setAttribute('aria-modal', 'true');
                galleryOverlay.setAttribute('aria-label', 'Image Gallery');
            }

            if (!Accessibility._liveRegion?.isConnected) {
                Accessibility._liveRegion = DOM.create('div', {
                    className: 'ug-sr-only',
                    'aria-live': 'polite',
                    'aria-atomic': 'true'
                });
                document.body.appendChild(Accessibility._liveRegion);
            }
        },

        announce(message) {
            const sr = Accessibility._liveRegion;
            if (!sr?.isConnected) return;
            sr.textContent = '';
            requestAnimationFrame(() => { sr.textContent = message; });
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
            if (typeof url !== 'string' || !url.startsWith('blob:')) return;
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
            BlobManager.blobUrls.delete(url);
        },

        revokeAll() {
            BlobManager.blobUrls.forEach(url => {
                try { URL.revokeObjectURL(url); } catch { /* ignore */ }
            });
            BlobManager.blobUrls.clear();
        }
    };

    // ====================================================
    // State Manager & Reactive State
    // ====================================================
    // Keys whose callbacks must run even when the value didn't change
    // (re-showing the same notification text must still show it).
    const ALWAYS_NOTIFY_KEYS = new Set(['notification']);

    const StateManager = {
        generateSessionId: () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),

        withSessionCheck(callback) {
            return (value, oldValue) => {
                if (state.currentLoadSessionId === null) return;
                callback(value, oldValue);
            };
        },

        // Same-value writes are skipped: e.g. `controlsVisible = true` on
        // every pointermove used to run a DOM query + classList toggle
        // dozens of times per second.
        createReactiveState(initialState, updateCallbacks = {}) {
            return new Proxy(initialState, {
                set(target, key, value) {
                    const oldValue = target[key];
                    if (Object.is(oldValue, value) && !ALWAYS_NOTIFY_KEYS.has(key)) return true;
                    target[key] = value;
                    const cb = updateCallbacks[key];
                    if (cb) {
                        try {
                            cb(value, oldValue);
                        } catch (e) {
                            console.error(`Error in state callback for "${String(key)}":`, e);
                        }
                    }
                    return true;
                }
            });
        }
    };

    // Persist-on-change helper for settings that only need saving.
    const persist = key => value => SettingsManager.saveSetting(key, value);

    const state = StateManager.createReactiveState({
        // Settings (overwritten with sanitized stored values in init()).
        ...SettingsManager.defaultSettings,

        // Runtime state.
        galleryReady: false,
        currentGalleryIndex: 0,
        isFullscreen: false,
        originalImageSrcs: [],
        fullSizeImageSrcs: [],
        totalImages: 0,
        loadedImages: 0,
        isLoading: false,
        isGalleryMode: false,
        isDownloading: false,
        errorCount: 0,
        currentLoadSessionId: null,
        notification: null,
        notificationType: 'info',
        settingsOpen: false,
        controlsVisible: true
    }, {
        controlsVisible(value) {
            galleryRefs.toolbar?.classList.toggle(CSS.GALLERY.CONTROLS_HIDDEN, !value);
            galleryRefs.expandedView?.classList.toggle(CSS.GALLERY.CONTROLS_HIDDEN, !value);
        },

        galleryReady(value) {
            updateGalleryButton(value);
        },

        loadedImages: StateManager.withSessionCheck((value) => {
            if (state.totalImages > 0 && value < state.totalImages) {
                notifyLoadProgress(`Loading media (${value}/${state.totalImages})...`, 'info');
            }
        }),

        totalImages: StateManager.withSessionCheck((value) => {
            if (value > 0) notifyLoadProgress(`Loading media (${state.loadedImages}/${value})...`, 'info');
        }),

        notification(value) {
            if (value) UI.showNotification(value, state.notificationType);
            else UI.hideNotification();
        },

        settingsOpen(value) {
            value ? UI.showSettings() : UI.closeSettings();
        },

        isFullscreen(value) {
            document.body.classList.toggle('ug-fullscreen', value);
            galleryOverlay?.classList.toggle(CSS.GALLERY.FULLSCREEN_OVERLAY, value);
            galleryRefs.fullscreenBtn?.classList.toggle('active', value);

            clearTimeout(Gallery._controlsHideTimer);
            if (value) {
                // Settle into a clean view shortly after entering fullscreen.
                Gallery._controlsHideTimer = setTimeout(() => {
                    if (!PointerEngine.isDragging && !viewState.pinchZoomActive) {
                        state.controlsVisible = false;
                    }
                }, 900);
            } else {
                state.controlsVisible = true;
            }
        },

        zoomEnabled: persist('zoomEnabled'),
        inertiaEnabled: persist('inertiaEnabled'),
        preserveFileDates: persist('preserveFileDates'),
        autoLoadOriginals(value) {
            SettingsManager.saveSetting('autoLoadOriginals', value);
            // Apply now instead of on the next navigation (skipped during startup).
            if (state.currentLoadSessionId !== null && Utils.isPostPage()) ImageLoader.loadImages({ force: true });
        },
        notificationsEnabled: persist('notificationsEnabled'),
        sortMode: persist('sortMode'),
        fullscreenMode: persist('fullscreenMode'),
        currentResizeMode: persist('currentResizeMode'),

        slideshowDelay(value) {
            SettingsManager.saveSetting('slideshowDelay', value);
            Slideshow.setDelay(value);
        },

        slideshowPauseOnHover(value) {
            SettingsManager.saveSetting('slideshowPauseOnHover', value);
            Slideshow.pauseOnHover = value !== false;
        },

        animationsEnabled(value) {
            SettingsManager.saveSetting('animationsEnabled', value);
            document.body.classList.toggle('ug-animations-disabled', !value);
        },

        bottomStripeVisible(value) {
            SettingsManager.saveSetting('bottomStripeVisible', value);
            if (galleryRefs.stripContainer) galleryRefs.stripContainer.style.display = value ? 'flex' : 'none';
            const toggle = galleryRefs.stripToggle;
            if (toggle) {
                toggle.classList.toggle('active', Boolean(value));
                toggle.title = value ? 'Hide thumbnail strip' : 'Show thumbnail strip';
            }
        },

        stripMode(value) {
            SettingsManager.saveSetting('stripMode', value);
            galleryOverlay?.classList.toggle(CSS.GALLERY.STRIP_FLOATING, value !== 'docked');
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
            if (value) ImageCacheDB.init().catch(() => {});
        }
    });

    function updateButtonLabels() {
        BUTTONS.DOWNLOAD = state.downloadBtnText || '【DOWNLOAD】';
        BUTTONS.DOWNLOAD_ALL = state.downloadAllBtnText || '【DL ALL】';
        BUTTONS.DOWNLOAD_IMAGES = state.downloadImagesBtnText || '【DL IMAGES】';
        BUTTONS.DOWNLOAD_ATTACHMENTS = state.downloadAttachmentsBtnText || '【DL FILES】';
        BUTTONS.FULL = state.fullBtnText || '【FULL】';
        BUTTONS.HEIGHT = state.heightBtnText || '【FILL HEIGHT】';
        BUTTONS.WIDTH = state.widthBtnText || '【FILL WIDTH】';
        BUTTONS.GALLERY = state.galleryBtnText || '【GALLERY】';

        DOM.$$(`.${CSS.BTN}[data-action]`).forEach(btn => {
            const action = btn.dataset.action;
            if (action === 'GALLERY') return; // handled by updateGalleryButton
            const label = BUTTONS[action];
            if (label) btn.textContent = label;
        });

        if (galleryRefs.fillHeightBtn) galleryRefs.fillHeightBtn.textContent = BUTTONS.HEIGHT;
        updateGalleryButton(state.galleryReady);
        PostActions.updateButtonVisibilityLight();
    }

    // ====================================================
    // Zoom Module
    // ====================================================
    const Zoom = {
        _applyTransition(element, action) {
            if (!state.animationsEnabled) {
                action();
                return;
            }
            element.classList.add(CSS.GALLERY.IS_TRANSITIONING);
            action();
            let cleared = false;
            const clear = () => {
                if (cleared) return;
                cleared = true;
                element.classList.remove(CSS.GALLERY.IS_TRANSITIONING);
            };
            element.addEventListener('transitionend', clear, { once: true });
            setTimeout(clear, 600);
        },

        applyZoom() {
            const container = galleryRefs.mainContainer;
            if (!container) return;
            PointerEngine.updateTransform();
            container.classList.toggle(CSS.GALLERY.ZOOMED, viewState.zoomScale !== 1);
        },

        _zoomAt(px, py, newScale) {
            const imageX = (px - viewState.imageOffset.x) / viewState.zoomScale;
            const imageY = (py - viewState.imageOffset.y) / viewState.zoomScale;
            viewState.imageOffset.x = px - (imageX * newScale);
            viewState.imageOffset.y = py - (imageY * newScale);
            viewState.zoomScale = newScale;
        },

        _wheelFrame: null,
        _wheelEvent: null,

        // Wheel events can fire at 100+ Hz on high-resolution trackpads;
        // they're coalesced to one zoom step per animation frame.
        handleWheelZoom(event) {
            if (!state.zoomEnabled || !galleryOverlay) return;
            event.preventDefault();
            event.stopPropagation();

            Zoom._wheelEvent = { clientX: event.clientX, clientY: event.clientY, deltaY: event.deltaY, ctrl: event.ctrlKey };
            if (Zoom._wheelFrame) return;

            Zoom._wheelFrame = requestAnimationFrame(() => {
                Zoom._wheelFrame = null;
                const ev = Zoom._wheelEvent;
                const container = galleryRefs.mainContainer;
                if (!ev || !container) return;

                const rect = container.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;

                // Pinch-to-zoom on trackpads arrives as ctrl+wheel with small
                // deltas; scale proportionally instead of fixed steps.
                const factor = ev.ctrl
                    ? Math.exp(-ev.deltaY * 0.01)
                    : (ev.deltaY > 0 ? (1 - CONFIG.ZOOM_STEP) : (1 + CONFIG.ZOOM_STEP));
                const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.zoomScale * factor, state.maxZoomScale));
                if (newScale === viewState.zoomScale) return;

                Zoom._zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, newScale);
                Zoom.applyZoom();
            });
        },

        resetZoom() {
            const container = galleryRefs.mainContainer;
            if (!container) return;
            Zoom._applyTransition(container, () => {
                viewState.zoomScale = 1;
                viewState.imageOffset = { x: 0, y: 0 };
                Zoom.applyZoom();
            });
        },

        zoom(step) {
            const container = galleryRefs.mainContainer;
            if (!container) return;

            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(viewState.zoomScale + step, state.maxZoomScale));
            if (viewState.zoomScale === newScale) return;

            const rect = container.getBoundingClientRect();
            Zoom._applyTransition(container, () => {
                Zoom._zoomAt(rect.width / 2, rect.height / 2, newScale);
                Zoom.applyZoom();
            });
        }
    };

    // ====================================================
    // Thumbnail Strip Module
    // ====================================================
    const ThumbnailStrip = {
        _contextMenuTimeout: null,
        _abortController: null,
        _previewTimeout: null,

        init() {
            const strip = galleryRefs.strip;
            if (!strip) return;

            ThumbnailStrip._abortController?.abort();
            ThumbnailStrip._abortController = new AbortController();
            const signal = ThumbnailStrip._abortController.signal;

            ThumbnailStrip.setupKeyboardNavigation(signal);
            ThumbnailStrip.setupDragNavigation(signal);
            ThumbnailStrip.setupHoverPreview(signal);
            ThumbnailStrip.setupContextMenu(signal);

            // ResizeObserver replaces the scroll listener + per-navigation
            // re-measuring: the "scrollable" flag only changes when the
            // strip or its content changes size.
            const ro = new ResizeObserver(() => ThumbnailStrip.updateScrollIndicators());
            ro.observe(strip);
            signal.addEventListener('abort', () => ro.disconnect(), { once: true });
            ThumbnailStrip.updateScrollIndicators();
        },

        cleanup() {
            ThumbnailStrip._abortController?.abort();
            ThumbnailStrip._abortController = null;
            clearTimeout(ThumbnailStrip._previewTimeout);
            ThumbnailStrip.hideContextMenu();
            DOM.$('.ug-thumbnail-zoom-preview')?.remove();
        },

        updateScrollIndicators() {
            const strip = galleryRefs.strip;
            if (!strip) return;
            strip.classList.toggle('no-scroll', strip.scrollWidth <= strip.clientWidth);
        },

        setupKeyboardNavigation(signal) {
            const strip = galleryRefs.strip;
            strip.addEventListener('keydown', (e) => {
                // Mouse-focused thumbnail: the global handler navigates instead.
                if (!keyboardFocus) return;
                const focused = e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (!focused) return;
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        ThumbnailStrip.navigateThumbnails(focused, -1);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        ThumbnailStrip.navigateThumbnails(focused, 1);
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        Gallery.showExpandedView(Number(focused.dataset.index));
                        break;
                }
            }, { signal });
        },

        navigateThumbnails(focused, step) {
            const strip = galleryRefs.strip;
            const total = state.fullSizeImageSrcs.length;
            if (!strip || !total) return;

            const currentIndex = focused ? Number(focused.dataset.index) : state.currentGalleryIndex;
            const target = Math.max(0, Math.min(total - 1, currentIndex + step));
            Gallery._ensureThumbnailsUpTo(target);
            const targetEl = strip.children[target];
            if (targetEl?.dataset.index === String(target)) {
                targetEl.focus({ preventScroll: true });
                DOM.scrollToCenter(strip, targetEl);
            } else {
                Gallery.showExpandedView(target);
            }
        },

        setupDragNavigation(signal) {
            const strip = galleryRefs.strip;
            let isDragging = false;
            let startX = 0;
            let scrollLeft = 0;

            strip.addEventListener('pointerdown', (e) => {
                if (e.pointerType !== 'mouse' || e.button !== 0) return;
                if (e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`)) return;
                isDragging = true;
                startX = e.clientX;
                scrollLeft = strip.scrollLeft;
                strip.setPointerCapture(e.pointerId);
                strip.style.cursor = 'grabbing';
                strip.classList.add('ug-dragging');
            }, { signal });

            strip.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                strip.scrollLeft = scrollLeft - (e.clientX - startX) * 2;
            }, { signal });

            const end = (e) => {
                if (!isDragging) return;
                isDragging = false;
                try { strip.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                strip.style.cursor = '';
                strip.classList.remove('ug-dragging');
            };
            strip.addEventListener('pointerup', end, { signal });
            strip.addEventListener('pointercancel', end, { signal });

            // Vertical wheel scrolls the strip horizontally.
            strip.addEventListener('wheel', (e) => {
                if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
                e.preventDefault();
                strip.scrollLeft += e.deltaY;
            }, { signal, passive: false });
        },

        setupHoverPreview(signal) {
            const strip = galleryRefs.strip;

            strip.addEventListener('pointerover', (e) => {
                if (e.pointerType !== 'mouse') return;
                const thumb = e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (!thumb) return;
                clearTimeout(ThumbnailStrip._previewTimeout);
                ThumbnailStrip._previewTimeout = setTimeout(() => {
                    if (thumb.isConnected) ThumbnailStrip.showZoomPreview(thumb, Number(thumb.dataset.index));
                }, 500);
            }, { signal });

            strip.addEventListener('pointerout', (e) => {
                if (e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`)) {
                    clearTimeout(ThumbnailStrip._previewTimeout);
                    ThumbnailStrip.hideZoomPreview();
                }
            }, { signal });
        },

        showZoomPreview(thumb, index) {
            const mediaItem = state.fullSizeImageSrcs[index];
            if (!mediaItem || mediaItem.type === 'attachment') return;

            DOM.$('.ug-thumbnail-zoom-preview')?.remove();

            const thumbImg = thumb.querySelector('img');
            const src = mediaItem.type === 'video'
                ? (mediaItem.poster || thumbImg?.src)
                : (thumbImg?.currentSrc || thumbImg?.src || mediaItem.src);
            if (!src) return;

            const preview = DOM.create('div', { className: 'ug-thumbnail-zoom-preview' }, [
                DOM.create('img', { src, decoding: 'async' })
            ]);

            const rect = thumb.getBoundingClientRect();
            const previewWidth = 220;
            const left = Math.min(
                Math.max(rect.left + rect.width / 2, previewWidth / 2 + 8),
                window.innerWidth - previewWidth / 2 - 8
            );
            const above = rect.top > 240;

            Object.assign(preview.style, {
                position: 'fixed',
                left: `${left}px`,
                top: `${above ? rect.top - 10 : rect.bottom + 10}px`,
                bottom: 'auto',
                transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                zIndex: '10000'
            });

            document.body.appendChild(preview);
            requestAnimationFrame(() => preview.classList.add('show'));
        },

        hideZoomPreview() {
            const preview = DOM.$('.ug-thumbnail-zoom-preview');
            if (!preview) return;
            preview.classList.remove('show');
            setTimeout(() => preview.remove(), 300);
        },

        setupContextMenu(signal) {
            const strip = galleryRefs.strip;

            strip.addEventListener('contextmenu', (e) => {
                const thumb = e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (!thumb) return;
                e.preventDefault();
                ThumbnailStrip.showContextMenu(Number(thumb.dataset.index), e.clientX, e.clientY);
            }, { signal });

            window.addEventListener('click', ThumbnailStrip.hideContextMenu, { signal });
        },

        showContextMenu(index, x, y) {
            clearTimeout(ThumbnailStrip._contextMenuTimeout);
            ThumbnailStrip._contextMenuTimeout = null;
            DOM.$('.ug-thumbnail-context-menu')?.remove();

            const menuItems = [
                { text: 'Open Image', action: () => Gallery.showExpandedView(index) },
                { text: 'Download File', action: () => DownloadManager.downloadImageByIndex(index) },
                { text: 'Copy URL', action: () => ThumbnailStrip.copyImageUrl(index) },
                { text: 'Remove from Gallery', action: () => ThumbnailStrip.removeFromGallery(index), danger: true }
            ];

            const menu = DOM.create('div', { className: 'ug-thumbnail-context-menu', role: 'menu' },
                menuItems.map(item => DOM.create('button', {
                    className: `ug-thumbnail-context-menu-item${item.danger ? ' danger' : ''}`,
                    role: 'menuitem',
                    text: item.text,
                    onclick: (e) => {
                        e.stopPropagation();
                        item.action();
                        ThumbnailStrip.hideContextMenu();
                    }
                }))
            );

            Object.assign(menu.style, {
                position: 'fixed',
                left: `${Math.min(x, window.innerWidth - 170)}px`,
                top: `${Math.min(y - 10, window.innerHeight - 200)}px`
            });
            document.body.appendChild(menu);
            requestAnimationFrame(() => menu.classList.add('show'));
        },

        hideContextMenu() {
            const menu = DOM.$('.ug-thumbnail-context-menu');
            if (!menu) return;
            menu.classList.remove('show');
            clearTimeout(ThumbnailStrip._contextMenuTimeout);
            ThumbnailStrip._contextMenuTimeout = setTimeout(() => menu.remove(), CONFIG.CONTEXT_MENU_HIDE_DELAY);
        },

        async copyImageUrl(index) {
            const mediaItem = state.fullSizeImageSrcs[index];
            if (!mediaItem) return;
            try {
                await navigator.clipboard.writeText(new URL(mediaItem.src, location.href).href);
                state.notificationType = 'success';
                state.notification = 'URL copied to clipboard';
            } catch (err) {
                console.error('Failed to copy URL:', err);
                state.notificationType = 'error';
                state.notification = 'Failed to copy URL';
            }
        },

        async removeFromGallery(index) {
            const { isConfirmed } = await UGModal.confirm({
                title: 'Remove from gallery?',
                text: 'This only affects the current gallery view.',
                icon: 'question',
                confirmText: 'Remove'
            });
            if (!isConfirmed || !galleryOverlay) return;

            state.fullSizeImageSrcs.splice(index, 1);
            state.originalImageSrcs.splice(index, 1);
            Gallery._clearPreloadCache();

            if (state.fullSizeImageSrcs.length === 0) {
                Gallery.closeGallery();
                return;
            }

            const strip = galleryRefs.strip;
            if (strip) {
                const thumbToRemove = strip.children[index];
                if (thumbToRemove?.dataset.index === String(index)) {
                    thumbToRemove.remove();
                    if (index < Gallery._thumbRenderedCount) Gallery._thumbRenderedCount--;
                }
                // Only wrappers after the removed one need renumbering.
                for (let i = index; i < strip.children.length; i++) {
                    const w = strip.children[i];
                    if (!w.classList.contains(CSS.GALLERY.THUMBNAIL_WRAPPER)) continue;
                    w.dataset.index = String(i);
                    w.setAttribute('aria-label', `Thumbnail ${i + 1}`);
                    const num = w.querySelector('.ug-thumbnail-number');
                    if (num) num.textContent = String(i + 1);
                }
            }

            let next = state.currentGalleryIndex;
            if (index < next) next--;
            next = Math.max(0, Math.min(next, state.fullSizeImageSrcs.length - 1));

            Gallery.showExpandedView(next);
            state.notificationType = 'info';
            state.notification = 'Item removed from gallery';
        }
    };

    // ====================================================
    // UI Builder & Notifications
    // ====================================================
    const UI = {
        _notificationTimeoutId: null,
        _notificationHideTimeoutId: null,

        createToggleButton(name, action, disabled = false, actionName = null, scope = 'global') {
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
            if (scope) btn.dataset.scope = scope;
            if (disabled) btn.classList.add('disabled');
            return btn;
        },

        createButtonGroup(buttonsConfig) {
            const hidden = {
                FULL: state.hideThumbnailFullButton,
                DOWNLOAD: state.hideThumbnailDownloadButton,
                HEIGHT: state.hideThumbnailHeightButton,
                WIDTH: state.hideThumbnailWidthButton
            };
            const div = DOM.create('div', { className: CSS.BTN_CONTAINER });
            for (const config of buttonsConfig) {
                if (hidden[config.name]) continue;
                div.appendChild(UI.createToggleButton(config.text, config.action, false, config.name, 'thumbnail'));
            }
            return div;
        },

        createNavigationButton(direction) {
            const isPrev = direction === 'prev';
            return DOM.create('button', {
                type: 'button',
                text: isPrev ? '←' : '→',
                className: `${CSS.GALLERY.NAV} ${isPrev ? CSS.GALLERY.PREV : CSS.GALLERY.NEXT}`,
                'aria-label': isPrev ? 'Previous Image' : 'Next Image',
                onclick: isPrev ? Gallery.prevImage : Gallery.nextImage
            });
        },

        createNotificationArea() {
            const area = DOM.create('div', {
                id: CSS.NOTIF_AREA,
                className: CSS.NOTIF_AREA,
                role: 'status',
                style: {
                    top: state.notificationPosition === 'top' ? '10px' : 'auto',
                    bottom: state.notificationPosition === 'bottom' ? '10px' : 'auto'
                }
            });
            document.body.appendChild(area);
            return area;
        },

        createNotification(area) {
            const container = DOM.create('div', { id: CSS.NOTIF_CONTAINER, className: CSS.NOTIF_CONTAINER }, [
                DOM.create('div', { id: CSS.NOTIF_TEXT, className: CSS.NOTIF_TEXT }),
                DOM.create('button', {
                    id: CSS.NOTIF_CLOSE,
                    className: CSS.NOTIF_CLOSE,
                    type: 'button',
                    'aria-label': 'Dismiss',
                    text: '×',
                    onclick: () => { state.notification = null; }
                }),
                DOM.create('a', {
                    id: CSS.NOTIF_REPORT,
                    className: CSS.NOTIF_REPORT,
                    text: 'Report Issue',
                    href: 'https://github.com/TearTyr/Ultra-Galleries/issues',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                })
            ]);
            area.appendChild(container);
            return container;
        },

        _clearNotificationTimers() {
            clearTimeout(UI._notificationTimeoutId);
            clearTimeout(UI._notificationHideTimeoutId);
            UI._notificationTimeoutId = null;
            UI._notificationHideTimeoutId = null;
        },

        showNotification(message, type = 'info') {
            if (!state.notificationsEnabled && !['error', 'warning'].includes(type)) return;

            const area = document.getElementById(CSS.NOTIF_AREA) || UI.createNotificationArea();
            const container = DOM.$(`.${CSS.NOTIF_CONTAINER}`, area) || UI.createNotification(area);
            const textNode = DOM.$(`#${CSS.NOTIF_TEXT}`, container);

            // Identical message already on screen: just extend its lifetime.
            const isAlreadyVisible = container.style.display === 'flex' && !container.classList.contains('ug-slide-out');
            const sameContent = isAlreadyVisible && textNode?.textContent === message && container.classList.contains(type);

            UI._clearNotificationTimers();

            if (!sameContent) {
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
            }

            if (type === 'info' || type === 'success') {
                UI._notificationTimeoutId = setTimeout(() => { state.notification = null; }, 5000);
            }
        },

        hideNotification() {
            const container = document.getElementById(CSS.NOTIF_CONTAINER);
            if (!container) return;

            UI._clearNotificationTimers();

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
            UI._clearNotificationTimers();
            document.getElementById(CSS.NOTIF_CONTAINER)?.remove();
        },

        _createSettingElement(setting) {
            if (setting.type === 'header') {
                return DOM.create('h3', { className: 'ug-settings-subheader', text: setting.label });
            }
            if (setting.type === 'divider') {
                return DOM.create('hr', { className: 'ug-settings-divider' });
            }
            if (setting.type === 'description') {
                return DOM.create('p', { className: 'ug-settings-description', text: setting.label });
            }
            if (setting.type === 'button') {
                return DOM.create('button', {
                    type: 'button',
                    className: 'ug-button ug-settings-input',
                    text: setting.label,
                    onclick: setting.action
                });
            }

            const div = DOM.create('div', { className: 'ug-setting-item' });
            const label = DOM.create('label', { for: setting.id, text: setting.label });

            const handleChange = (rawValue, inputEl) => {
                // `parse` normalizes/validates BEFORE the value reaches state,
                // so callbacks never see an invalid intermediate value.
                const value = setting.parse ? setting.parse(rawValue) : rawValue;
                if (inputEl && setting.parse && inputEl.type !== 'checkbox') inputEl.value = value;
                if (setting.stateKey) state[setting.stateKey] = value;
                if (setting.gmKey) SettingsManager.saveSetting(setting.gmKey, value);
                setting.onChange?.(value);
            };

            switch (setting.type) {
                case 'checkbox': {
                    div.className = 'ug-setting-item ug-settings-checkbox-label';
                    const checkbox = DOM.create('input', {
                        type: 'checkbox',
                        id: setting.id,
                        onchange: (e) => handleChange(e.target.checked, e.target)
                    });
                    checkbox.checked = Boolean(state[setting.stateKey]);
                    div.append(checkbox, label);
                    break;
                }

                case 'text': {
                    const input = DOM.create('input', {
                        type: setting.inputType || 'text',
                        id: setting.id,
                        maxlength: setting.maxLength || 50,
                        className: 'ug-settings-input',
                        autocomplete: 'off',
                        spellcheck: 'false',
                        onchange: (e) => handleChange(e.target.value, e.target)
                    });
                    input.value = state[setting.stateKey] ?? '';
                    div.append(label, input);
                    break;
                }

                case 'select': {
                    const select = DOM.create('select', {
                        id: setting.id,
                        className: 'ug-settings-input',
                        onchange: (e) => handleChange(e.target.value, e.target)
                    });
                    for (const opt of setting.options) {
                        const optEl = DOM.create('option', { value: opt.value, text: opt.text });
                        optEl.selected = opt.value === state[setting.stateKey];
                        select.appendChild(optEl);
                    }
                    div.append(label, select);
                    break;
                }
            }
            return div;
        },

        _settingsConfig() {
            const visibilityRefresh = () => PostActions.updateButtonVisibilityLight();
            const thumbRefresh = () => PostActions.refreshThumbnailButtonGroups();
            const singleKey = (fallback) => (v) => (typeof v === 'string' && v.length === 1) ? v : fallback;

            const globalHide = (key, label) => ({ id: key, label, type: 'checkbox', stateKey: key, gmKey: key, onChange: visibilityRefresh });
            const thumbHide = (key, label) => ({ id: key, label, type: 'checkbox', stateKey: key, gmKey: key, onChange: thumbRefresh });
            const labelInput = (key, label) => ({ id: `${key}Input`, label, type: 'text', stateKey: key, gmKey: key, maxLength: 40, onChange: updateButtonLabels });

            return [
                {
                    title: 'General',
                    key: 'general',
                    settings: [
                        { type: 'header', label: 'Appearance' },
                        { id: 'animationsToggle', label: 'Enable Animations', type: 'checkbox', stateKey: 'animationsEnabled' },
                        { id: 'bottomStripeToggle', label: 'Show Thumbnail Strip in Gallery', type: 'checkbox', stateKey: 'bottomStripeVisible' },
                        {
                            id: 'stripMode', label: 'Thumbnail Strip Mode', type: 'select', stateKey: 'stripMode',
                            options: [
                                { value: 'floating', text: 'Floating — higher layer above the image (true fullscreen)' },
                                { value: 'docked', text: 'Docked — classic pinned bottom bar' }
                            ]
                        },
                        { type: 'description', label: 'Floating mode layers the thumbnail strip above the media and slides it completely off-screen when controls hide, so fullscreen is truly fullscreen. Move the mouse to bring it back.' },
                        { type: 'divider' },
                        { type: 'header', label: 'Notifications' },
                        { id: 'notificationsEnabledToggle', label: 'Enable Notifications', type: 'checkbox', stateKey: 'notificationsEnabled' },
                        {
                            id: 'notificationPosition', label: 'Notification Position', type: 'select', stateKey: 'notificationPosition',
                            options: [{ value: 'top', text: 'Top' }, { value: 'bottom', text: 'Bottom' }]
                        },
                        { type: 'divider' },
                        { type: 'header', label: 'Fullscreen' },
                        {
                            id: 'fullscreenMode', label: 'Fullscreen Mode', type: 'select', stateKey: 'fullscreenMode',
                            options: [
                                { value: 'native', text: 'Native (browser fullscreen)' },
                                { value: 'css', text: 'CSS (styled overlay)' },
                                { value: 'ask', text: 'Ask each time' }
                            ]
                        },
                        { type: 'divider' },
                        { type: 'header', label: 'Image Loading' },
                        { id: 'autoLoadOriginalsToggle', label: 'Auto-load Original Images', type: 'checkbox', stateKey: 'autoLoadOriginals' }
                    ]
                },
                {
                    title: 'Gallery Viewer',
                    key: 'galleryViewer',
                    settings: [
                        { type: 'header', label: 'Navigation' },
                        { id: 'hideNavArrows', label: 'Hide Navigation Arrows in Gallery', type: 'checkbox', stateKey: 'hideNavArrows', gmKey: 'hideNavArrows', onChange: visibilityRefresh },
                        { type: 'divider' },
                        { type: 'header', label: 'Zoom & Pan' },
                        { id: 'zoomEnabledToggle', label: 'Enable Zoom & Pan', type: 'checkbox', stateKey: 'zoomEnabled' },
                        { id: 'inertiaEnabledToggle', label: 'Enable Smooth Pan Inertia', type: 'checkbox', stateKey: 'inertiaEnabled' },
                        {
                            id: 'maxZoomScaleInput', label: 'Maximum Zoom (×)', type: 'text', inputType: 'number',
                            stateKey: 'maxZoomScale', gmKey: 'maxZoomScale', maxLength: 3,
                            parse: v => SettingsManager.sanitizeSetting('maxZoomScale', v)
                        },
                        { type: 'divider' },
                        { type: 'header', label: 'Slideshow' },
                        {
                            id: 'slideshowDelay', label: 'Slideshow Delay (ms)', type: 'text', inputType: 'number',
                            stateKey: 'slideshowDelay', maxLength: 6,
                            parse: v => SettingsManager.sanitizeSetting('slideshowDelay', v)
                        },
                        { id: 'slideshowPauseOnHover', label: 'Pause Slideshow on Hover', type: 'checkbox', stateKey: 'slideshowPauseOnHover' }
                    ]
                },
                {
                    title: 'Downloads',
                    key: 'downloads',
                    settings: [
                        { type: 'header', label: 'Behavior' },
                        { id: 'preserveFileDatesToggle', label: 'Preserve Post Date on ZIP Files', type: 'checkbox', stateKey: 'preserveFileDates' },
                        { type: 'description', label: 'ZIP entries will be stamped with the post\'s published date. Requires an archive tool that restores timestamps (7-Zip, WinRAR, Explorer).' },
                        { type: 'description', label: 'On Chromium browsers you\'ll be asked where to save the ZIP first; it is then streamed straight to disk, so even very large posts use little memory.' },
                        { type: 'divider' },
                        { type: 'header', label: 'Caching' },
                        { id: 'persistentCachingToggle', label: 'Enable Persistent Image Caching', type: 'checkbox', stateKey: 'enablePersistentCaching' },
                        { id: 'clearCacheButton', label: 'Clear Persistent Cache', type: 'button', action: () => ImageCacheDB.clear() },
                        {
                            id: 'cacheStatsButton', label: 'Show Cache Statistics', type: 'button',
                            action: async () => {
                                const stats = await ImageCacheDB.getStats();
                                const mb = (stats.bytes / 1048576).toFixed(1);
                                UGModal.alert('Persistent Cache', `${stats.count} cached file(s), ~${mb} MB stored.`, 'info');
                            }
                        },
                        { type: 'divider' },
                        { type: 'header', label: 'File Naming' },
                        {
                            id: 'zipFileNameFormatInput', label: 'ZIP Filename Format', type: 'text', stateKey: 'zipFileNameFormat', gmKey: 'zipFileNameFormat', maxLength: 200,
                            parse: v => SettingsManager.sanitizeSetting('zipFileNameFormat', v)
                        },
                        { type: 'description', label: 'Tokens: {date_published}, {date_edited}, {date_imported}, {date}, {title}, {artistName}' },
                        {
                            id: 'imageFileNameFormatInput', label: 'Image Filename Format', type: 'text', stateKey: 'imageFileNameFormat', gmKey: 'imageFileNameFormat', maxLength: 200,
                            parse: v => SettingsManager.sanitizeSetting('imageFileNameFormat', v)
                        },
                        { type: 'description', label: 'Tokens: same as above plus {fileName} and {index}' }
                    ]
                },
                {
                    title: 'Sorting',
                    key: 'sorting',
                    settings: [
                        { type: 'header', label: 'Media Order' },
                        { type: 'description', label: 'Fixes scrambled order — especially useful for comic posts where pages are numbered ("page_01.jpg", "page_02.jpg", …). Natural sort treats numbers as numbers, so "page_10" comes after "page_9" instead of before it.' },
                        {
                            id: 'sortModeSelect', label: 'Sort Order', type: 'select', stateKey: 'sortMode',
                            options: [
                                { value: 'dom', text: 'Default (site order)' },
                                { value: 'filename-asc', text: 'Filename: A → Z (natural)' },
                                { value: 'filename-desc', text: 'Filename: Z → A (natural)' }
                            ],
                            onChange: () => {
                                if (state.isGalleryMode) Gallery.closeGallery();
                                if (Utils.isPostPage()) {
                                    state.notificationType = 'info';
                                    state.notification = 'Applying sort order...';
                                    ImageLoader.loadImages({ force: true });
                                }
                            }
                        },
                        { type: 'divider' },
                        { type: 'header', label: 'How it works' },
                        { type: 'description', label: 'Filenames are read from the post\'s download attribute, the file URL\'s ?f= parameter, or the URL itself — in that order. If none contain a usable name, items fall back to the site\'s DOM order.' }
                    ]
                },
                {
                    title: 'Post Actions',
                    key: 'postActions',
                    settings: [
                        { type: 'header', label: 'Button Visibility' },
                        { type: 'description', label: 'The bar that appears at the top of a post.' },
                        globalHide('hideGlobalGalleryButton', 'Hide GALLERY Button'),
                        globalHide('hideGlobalHeightButton', 'Hide FILL HEIGHT Button'),
                        globalHide('hideGlobalWidthButton', 'Hide FILL WIDTH Button'),
                        globalHide('hideGlobalFullButton', 'Hide FULL Button'),
                        globalHide('hideGlobalDownloadAllButton', 'Hide DL ALL Button'),
                        globalHide('hideGlobalDownloadImagesButton', 'Hide DL IMAGES Button'),
                        globalHide('hideGlobalDownloadAttachmentsButton', 'Hide DL FILES Button')
                    ]
                },
                {
                    title: 'Thumbnails',
                    key: 'thumbnails',
                    settings: [
                        { type: 'header', label: 'Per-Image Button Visibility' },
                        { type: 'description', label: 'The small button row that appears above each thumbnail image.' },
                        thumbHide('hideThumbnailHeightButton', 'Hide FILL HEIGHT Button'),
                        thumbHide('hideThumbnailWidthButton', 'Hide FILL WIDTH Button'),
                        thumbHide('hideThumbnailFullButton', 'Hide FULL Button'),
                        thumbHide('hideThumbnailDownloadButton', 'Hide DOWNLOAD Button')
                    ]
                },
                {
                    title: 'Button Labels',
                    key: 'buttonLabels',
                    settings: [
                        { type: 'header', label: 'Download Buttons' },
                        labelInput('downloadBtnText', 'DOWNLOAD'),
                        labelInput('downloadAllBtnText', 'DL ALL'),
                        labelInput('downloadImagesBtnText', 'DL IMAGES'),
                        labelInput('downloadAttachmentsBtnText', 'DL FILES'),
                        { type: 'divider' },
                        { type: 'header', label: 'Sizing & View Buttons' },
                        labelInput('fullBtnText', 'FULL'),
                        labelInput('heightBtnText', 'FILL HEIGHT'),
                        labelInput('widthBtnText', 'FILL WIDTH'),
                        labelInput('galleryBtnText', 'GALLERY')
                    ]
                },
                {
                    title: 'Keyboard',
                    key: 'keyboard',
                    settings: [
                        { type: 'header', label: 'Shortcuts' },
                        { type: 'description', label: 'Single letters work best. These shortcuts are disabled while typing in any input field.' },
                        { id: 'galleryKeyInput', label: 'Open / Close Gallery', type: 'text', stateKey: 'galleryKey', gmKey: 'galleryKey', maxLength: 1, parse: singleKey('g') },
                        { id: 'prevImageKeyInput', label: 'Previous Image', type: 'text', stateKey: 'prevImageKey', gmKey: 'prevImageKey', maxLength: 1, parse: singleKey('k') },
                        { id: 'nextImageKeyInput', label: 'Next Image', type: 'text', stateKey: 'nextImageKey', gmKey: 'nextImageKey', maxLength: 1, parse: singleKey('l') },
                        { type: 'divider' },
                        { type: 'header', label: 'Fixed Shortcuts (in Gallery)' },
                        { type: 'description', label: '← / →  Navigate   ·   Home / End  First / Last   ·   + / −  Zoom   ·   0  Reset Zoom   ·   Space  Slideshow   ·   F  Fullscreen   ·   ?  Help   ·   Esc  Close' }
                    ]
                },
                {
                    title: 'Advanced',
                    key: 'advanced',
                    settings: [
                        { type: 'header', label: 'Backup & Restore' },
                        {
                            id: 'exportSettingsButton', label: 'Export Settings to File', type: 'button',
                            action: () => {
                                const blob = new Blob([SettingsManager.exportSettings()], { type: 'application/json' });
                                DOM.saveBlob(blob, 'ultra-galleries-settings.json');
                                state.notificationType = 'success';
                                state.notification = 'Settings exported';
                            }
                        },
                        {
                            id: 'importSettingsButton', label: 'Import Settings from File', type: 'button',
                            action: () => {
                                const input = DOM.create('input', { type: 'file', accept: '.json,application/json' });
                                input.onchange = async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (SettingsManager.importSettings(await file.text()) && state.settingsOpen) {
                                        // Rebuild so the panel reflects the imported values.
                                        UI.showSettings();
                                    }
                                };
                                input.click();
                            }
                        },
                        { type: 'divider' },
                        { type: 'header', label: 'Danger Zone' },
                        { type: 'description', label: 'This will erase all your customizations and reload the page.' },
                        {
                            id: 'resetSettingsButton', label: 'Reset All Settings to Defaults', type: 'button',
                            action: async () => {
                                const { isConfirmed } = await UGModal.confirm({
                                    title: 'Reset settings?',
                                    text: 'All settings will return to defaults.',
                                    icon: 'warning',
                                    confirmText: 'Reset'
                                });
                                if (isConfirmed) {
                                    SettingsManager.resetToDefaults();
                                    location.reload();
                                }
                            }
                        }
                    ]
                }
            ];
        },

        createSettingsUI(activeKey = null) {
            const headerText = DOM.create('h2', { id: 'ug-settings-main-header' });
            const body = DOM.create('div', { className: 'ug-settings-body' });
            const sidebarContainer = DOM.create('div', { className: 'ug-settings-sidebar', role: 'tablist' }, [
                DOM.create('div', { className: 'ug-sidebar-header', text: 'Settings' })
            ]);

            const overlay = DOM.create('div', {
                id: 'ug-settings-overlay',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'ug-settings-main-header',
                className: 'ug-settings-overlay',
                onclick: (e) => { if (e.target === overlay) state.settingsOpen = false; }
            }, [
                DOM.create('div', { className: 'ug-settings-container' }, [
                    sidebarContainer,
                    DOM.create('div', { className: 'ug-settings-content' }, [
                        DOM.create('div', { className: 'ug-settings-header' }, [
                            headerText,
                            DOM.create('button', {
                                type: 'button',
                                className: 'ug-settings-close-btn',
                                'aria-label': 'Close settings',
                                text: BUTTONS.CLOSE,
                                onclick: () => { state.settingsOpen = false; }
                            })
                        ]),
                        body
                    ])
                ])
            ]);

            // Sections are built lazily on first open of each tab.
            const sections = new Map();
            const sideButtons = [];

            const activate = (section, btn) => {
                sideButtons.forEach(b => {
                    b.classList.toggle('active', b === btn);
                    b.setAttribute('aria-selected', String(b === btn));
                });
                sections.forEach(el => { el.style.display = 'none'; });

                let sectionEl = sections.get(section.key);
                if (!sectionEl) {
                    sectionEl = DOM.create('div', {
                        className: 'ug-settings-section',
                        'data-section-key': section.key,
                        role: 'tabpanel'
                    }, section.settings.map(s => UI._createSettingElement(s)));
                    sections.set(section.key, sectionEl);
                    body.appendChild(sectionEl);
                }
                sectionEl.style.display = 'block';
                headerText.textContent = section.title;
                body.scrollTop = 0;
                UI._activeSettingsKey = section.key;
            };

            const config = UI._settingsConfig();
            let initial = null;
            for (const section of config) {
                const btn = DOM.create('button', {
                    type: 'button',
                    className: 'ug-sidebar-button',
                    role: 'tab',
                    text: section.title,
                    onclick: () => activate(section, btn)
                });
                sideButtons.push(btn);
                sidebarContainer.appendChild(btn);
                if (!initial || section.key === activeKey) initial = { section, btn };
            }
            if (initial) activate(initial.section, initial.btn);

            document.body.appendChild(overlay);
            return overlay;
        },

        _activeSettingsKey: null,

        showSettings() {
            if (!document.getElementById('ug-settings-overlay')) {
                lastFocusedElement = document.activeElement;
            }
            clearTimeout(UI._settingsCloseTimer);
            document.getElementById('ug-settings-overlay')?.remove();
            if (focusTrapListener) document.removeEventListener('keydown', focusTrapListener);

            const overlay = UI.createSettingsUI(UI._activeSettingsKey);
            overlay.classList.add('opening');

            const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            overlay.querySelector(focusableSelector)?.focus();

            // Focusables are re-queried on every Tab because sections render lazily.
            focusTrapListener = (e) => {
                if (e.key !== 'Tab') return;
                const focusable = DOM.$$(focusableSelector, overlay).filter(el => el.offsetParent !== null);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            };
            document.addEventListener('keydown', focusTrapListener);
        },

        _settingsCloseTimer: null,

        closeSettings() {
            if (focusTrapListener) {
                document.removeEventListener('keydown', focusTrapListener);
                focusTrapListener = null;
            }
            const overlay = document.getElementById('ug-settings-overlay');
            if (!overlay) return;
            overlay.classList.remove('opening');
            clearTimeout(UI._settingsCloseTimer);
            UI._settingsCloseTimer = setTimeout(() => {
                overlay.remove();
                // Reopened within the fade-out: don't pull focus out of the new dialog.
                if (!state.settingsOpen) lastFocusedElement?.focus?.();
            }, 300);
        }
    };

    // ====================================================
    // Gallery Core Module
    // ====================================================
    const Gallery = {
        _preloadedImageCache: new Map(),
        _preloadingInProgress: new Set(),
        _controlsHideTimer: null,
        _thumbObserver: null,
        _thumbSentinel: null,
        _thumbRenderedCount: 0,
        _selectedThumb: null,
        _interactionAbort: null,
        _videoFetchAbort: null,

        _clearPreloadCache() {
            for (const url of Gallery._preloadedImageCache.values()) BlobManager.revokeUrl(url);
            Gallery._preloadedImageCache.clear();
            Gallery._preloadingInProgress.clear();
        },

        // Best already-downloaded URL for an image: preload cache, then the
        // blob the post page already fetched, then the network URL.
        _resolveImageUrl(index, mediaItem) {
            return Gallery._preloadedImageCache.get(index) || loadedBlobUrls.get(mediaItem.src) || mediaItem.src;
        },

        async _fetchAndCacheImage(index, sessionId = null) {
            if (index < 0 || index >= state.originalImageSrcs.length) return;
            if (Gallery._preloadedImageCache.has(index) || Gallery._preloadingInProgress.has(index)) return;

            const mediaItem = state.originalImageSrcs[index];
            if (mediaItem?.type !== 'image' || !mediaItem.src) return;
            if (loadedBlobUrls.has(mediaItem.src)) return; // page already has it
            if (sessionId !== null && state.currentLoadSessionId !== sessionId) return;

            Gallery._preloadingInProgress.add(index);
            try {
                const blob = await ImageLoader.fetchBlob(mediaItem.src, sessionId);
                // The gallery may have closed or moved on while we waited.
                if (blob && galleryOverlay && state.originalImageSrcs[index]?.src === mediaItem.src) {
                    Gallery._preloadedImageCache.set(index, BlobManager.createUrl(blob));
                }
            } catch (error) {
                if (error?.message !== 'Stale session' && error?.message !== 'Request aborted') {
                    console.warn(`Preload failed for ${index}`, error);
                }
            } finally {
                Gallery._preloadingInProgress.delete(index);
            }
        },

        _preloadAdjacentImages(currentIndex) {
            const sessionId = state.currentLoadSessionId;
            const maxKeep = CONFIG.PRELOAD_COUNT + CONFIG.PRELOAD_WINDOW_BUFFER;

            for (const [index, url] of Gallery._preloadedImageCache) {
                if (Math.abs(index - currentIndex) > maxKeep) {
                    BlobManager.revokeUrl(url);
                    Gallery._preloadedImageCache.delete(index);
                }
            }

            const run = () => {
                for (let i = 1; i <= CONFIG.PRELOAD_COUNT; i++) {
                    Gallery._fetchAndCacheImage(currentIndex + i, sessionId);
                }
                Gallery._fetchAndCacheImage(currentIndex - 1, sessionId);
            };
            // Preloading is low priority; let the current image paint first.
            if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 500 });
            else setTimeout(run, 50);
        },

        async _fetchVideoForElement(videoEl, url, sessionId, signal) {
            try {
                const blob = await ImageLoader.fetchBlob(url, sessionId);
                if (signal.aborted || !videoEl.isConnected) return;
                videoEl.src = blob ? BlobManager.createUrl(blob) : url;
            } catch (err) {
                if (signal.aborted || !videoEl.isConnected) return;
                console.warn('Ultra Galleries: video blob fetch failed, falling back:', err);
                videoEl.src = url;
            }
        },

        _releaseVideo(video) {
            try {
                video.pause();
                const src = video.getAttribute('src');
                video.removeAttribute('src');
                video.load();
                if (src?.startsWith('blob:')) BlobManager.revokeUrl(src);
            } catch { /* ignore */ }
        },

        _releaseMediaElements(container) {
            container?.querySelectorAll('video').forEach(v => Gallery._releaseVideo(v));
            // Detached <img> elements keep downloading; drop the src so skipped images stop.
            container?.querySelectorAll(`img.${CSS.GALLERY.MAIN_IMG}`).forEach(i => i.removeAttribute('src'));
        },

        safePlay(video) {
            video?.play?.()?.catch?.(err => console.warn('Ultra Galleries: playback blocked:', err));
        },

        _attachVideoPlayOverlay(video, container) {
            const overlay = DOM.create('button', {
                type: 'button',
                className: 'ug-video-play-overlay',
                'aria-label': 'Play video',
                title: 'Play video',
                html: PLAY_ICON_SVG,
                onclick: (e) => {
                    e.stopPropagation();
                    Gallery.safePlay(video);
                    overlay.classList.add('ug-hidden');
                }
            });
            video.addEventListener('play', () => overlay.classList.add('ug-hidden'), { once: true });
            container.appendChild(overlay);
        },

        _toolbarButton(attrs) {
            return DOM.create('button', { type: 'button', className: CSS.GALLERY.TOOLBAR_BTN, ...attrs });
        },

        _createExpandedViewToolbar(expandedView) {
            const toolbar = DOM.create('div', {
                className: CSS.GALLERY.TOOLBAR,
                onpointerdown: e => e.stopPropagation()
            });

            const resetBtn = Gallery._toolbarButton({
                id: 'reset-btn',
                title: 'Reset Zoom & Position (0)',
                text: 'Reset',
                onclick: Zoom.resetZoom
            });

            const zoomLevel = DOM.create('span', { id: 'zoom-level', className: 'zoom-level', text: '100%' });
            const zoomControls = DOM.create('div', { className: 'zoom-controls' }, [
                Gallery._toolbarButton({
                    id: 'zoom-out-btn',
                    title: 'Zoom Out (−)',
                    'aria-label': 'Zoom Out',
                    html: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    onclick: () => Zoom.zoom(-CONFIG.ZOOM_STEP)
                }),
                zoomLevel,
                Gallery._toolbarButton({
                    id: 'zoom-in-btn',
                    title: 'Zoom In (+)',
                    'aria-label': 'Zoom In',
                    html: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    onclick: () => Zoom.zoom(CONFIG.ZOOM_STEP)
                })
            ]);

            const slideshowBtn = Gallery._toolbarButton({
                id: 'slideshow-btn',
                title: 'Start Slideshow (Space)',
                text: '▶',
                onclick: Slideshow.handleButton
            });

            const fillHeightBtn = Gallery._toolbarButton({
                id: 'ug-fill-height-btn',
                'aria-label': 'Fill Height',
                text: BUTTONS.HEIGHT,
                onclick: () => {
                    const media = galleryRefs.mainContainer?.querySelector('img, video');
                    if (media) ImageSizing.applyFillHeight(media);
                }
            });

            const stripToggleBtn = Gallery._toolbarButton({
                className: `${CSS.GALLERY.STRIP_TOGGLE} ${CSS.GALLERY.TOOLBAR_BTN}`,
                'aria-label': 'Toggle Thumbnail Strip',
                title: state.bottomStripeVisible ? 'Hide thumbnail strip' : 'Show thumbnail strip',
                html: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="13" width="20" height="8" rx="2"></rect><line x1="7" y1="13" x2="7" y2="21"></line><line x1="12" y1="13" x2="12" y2="21"></line><line x1="17" y1="13" x2="17" y2="21"></line></svg>',
                onclick: () => { state.bottomStripeVisible = !state.bottomStripeVisible; }
            });
            stripToggleBtn.classList.toggle('active', Boolean(state.bottomStripeVisible));

            const fullscreenBtn = Gallery._toolbarButton({
                className: `${CSS.GALLERY.FULLSCREEN} ${CSS.GALLERY.TOOLBAR_BTN}`,
                'aria-label': 'Toggle Fullscreen',
                title: 'Fullscreen (F)',
                text: BUTTONS.FULLSCREEN,
                onclick: Gallery.toggleFullscreen
            });

            toolbar.append(resetBtn, zoomControls, slideshowBtn, fillHeightBtn, stripToggleBtn, fullscreenBtn);
            expandedView.append(
                toolbar,
                DOM.create('button', {
                    type: 'button',
                    className: 'ug-gallery-close-button',
                    'aria-label': 'Close Gallery',
                    title: 'Close (Esc)',
                    text: BUTTONS.CLOSE,
                    onclick: Gallery.closeGallery
                })
            );

            Object.assign(galleryRefs, {
                toolbar, resetBtn, zoomControls, zoomLevel, slideshowBtn, fillHeightBtn,
                stripToggle: stripToggleBtn, fullscreenBtn
            });
        },

        _createExpandedViewMainImageArea(expandedView) {
            const ambient = DOM.create('div', { className: 'ug-ambient-background' });
            const mainContainer = DOM.create('div', { className: `${CSS.GALLERY.MAIN_IMG_CONTAINER} image-container` });
            mainContainer.style.touchAction = 'none';

            expandedView.appendChild(DOM.create('div', { className: CSS.GALLERY.ZOOM_CONTAINER }, [ambient, mainContainer]));
            Object.assign(galleryRefs, { ambient, mainContainer });
        },

        _createExpandedViewNavigationAndCounter(expandedView) {
            const navContainer = DOM.create('div', {
                className: CSS.GALLERY.NAV_CONTAINER,
                onpointerdown: e => e.stopPropagation()
            });

            if (!state.hideNavArrows) {
                navContainer.append(UI.createNavigationButton('prev'), UI.createNavigationButton('next'));
            }

            const counter = DOM.create('div', { className: `${CSS.GALLERY.COUNTER} ${CSS.GALLERY.HIDE}` });
            expandedView.append(navContainer, counter);
            galleryRefs.counter = counter;
        },

        _createExpandedViewThumbnailStrip(expandedView) {
            const stripContainer = DOM.create('div', {
                className: CSS.GALLERY.STRIP_CONTAINER,
                style: { display: state.bottomStripeVisible ? 'flex' : 'none' },
                onpointerdown: e => e.stopPropagation()
            });
            const strip = DOM.create('div', { className: CSS.GALLERY.THUMBNAIL_STRIP, role: 'listbox', 'aria-label': 'Thumbnails' });
            stripContainer.appendChild(strip);
            expandedView.appendChild(stripContainer);
            Object.assign(galleryRefs, { strip, stripContainer });
            return strip;
        },

        _makeThumbnailWrapper(mediaItem, index) {
            const wrapper = DOM.create('div', {
                className: CSS.GALLERY.THUMBNAIL_WRAPPER,
                'data-index': index,
                'aria-label': `Thumbnail ${index + 1}`,
                tabindex: '0',
                role: 'option'
            });

            if (mediaItem.type === 'video') {
                wrapper.append(
                    DOM.create('div', { className: 'ug-play-icon', html: PLAY_ICON_SVG }),
                    DOM.create('img', {
                        src: mediaItem.poster || FALLBACK_POSTER,
                        loading: 'lazy',
                        decoding: 'async',
                        alt: '',
                        className: CSS.GALLERY.THUMBNAIL
                    })
                );
            } else if (mediaItem.type === 'attachment') {
                wrapper.appendChild(DOM.create('div', {
                    className: 'ug-thumbnail-file-icon',
                    html: FILE_ICON_SVG
                }));
            } else {
                // The site's small thumbnail — not the full-resolution original.
                wrapper.appendChild(DOM.create('img', {
                    src: mediaItem.thumb || mediaItem.src,
                    loading: 'lazy',
                    decoding: 'async',
                    alt: '',
                    className: CSS.GALLERY.THUMBNAIL
                }));
            }

            // Numbered once at creation (was re-numbered on every navigation).
            wrapper.appendChild(DOM.create('span', { className: 'ug-thumbnail-number', text: String(index + 1) }));
            return wrapper;
        },

        _appendThumbnailChunk(strip, from, to) {
            const items = state.fullSizeImageSrcs;
            const end = Math.min(to, items.length);
            const fragment = document.createDocumentFragment();
            for (let i = from; i < end; i++) {
                const mediaItem = items[i];
                if (mediaItem) fragment.appendChild(Gallery._makeThumbnailWrapper(mediaItem, i));
            }
            Gallery._thumbSentinel?.remove();
            strip.appendChild(fragment);
            Gallery._thumbRenderedCount = Math.max(Gallery._thumbRenderedCount, end);

            if (Gallery._thumbRenderedCount < items.length) {
                Gallery._thumbSentinel ??= DOM.create('div', {
                    className: 'ug-thumbnail-strip-sentinel',
                    'aria-hidden': 'true',
                    style: { flex: '0 0 1px', width: '1px', alignSelf: 'stretch' }
                });
                strip.appendChild(Gallery._thumbSentinel);
                Gallery._thumbObserver ??= new IntersectionObserver((entries) => {
                    if (entries.some(en => en.isIntersecting)) {
                        Gallery._appendThumbnailChunk(
                            strip,
                            Gallery._thumbRenderedCount,
                            Gallery._thumbRenderedCount + CONFIG.THUMBNAIL_CHUNK_SIZE
                        );
                    }
                }, { root: strip, rootMargin: '400px' });
                Gallery._thumbObserver.disconnect();
                Gallery._thumbObserver.observe(Gallery._thumbSentinel);
            } else {
                Gallery._thumbSentinel = null;
                Gallery._thumbObserver?.disconnect();
                Gallery._thumbObserver = null;
            }
        },

        _populateAllThumbnails(strip) {
            strip.replaceChildren();
            Gallery._thumbObserver?.disconnect();
            Gallery._thumbObserver = null;
            Gallery._thumbSentinel = null;
            Gallery._thumbRenderedCount = 0;
            Gallery._selectedThumb = null;

            const total = state.fullSizeImageSrcs.length;
            const firstChunk = total > CONFIG.THUMBNAIL_CHUNK_THRESHOLD ? CONFIG.THUMBNAIL_CHUNK_SIZE : total;
            Gallery._appendThumbnailChunk(strip, 0, firstChunk);
        },

        // Synchronously renders chunks until `index` exists in the DOM.
        _ensureThumbnailsUpTo(index) {
            const strip = galleryRefs.strip;
            if (!strip || !Number.isFinite(index)) return;
            const total = state.fullSizeImageSrcs.length;
            while (Gallery._thumbRenderedCount <= index && Gallery._thumbRenderedCount < total) {
                Gallery._appendThumbnailChunk(
                    strip,
                    Gallery._thumbRenderedCount,
                    Gallery._thumbRenderedCount + CONFIG.THUMBNAIL_CHUNK_SIZE
                );
            }
        },

        _selectThumbnail(index) {
            const strip = galleryRefs.strip;
            if (!strip) return;
            Gallery._ensureThumbnailsUpTo(index);

            Gallery._selectedThumb?.classList.remove('selected');
            Gallery._selectedThumb?.setAttribute('aria-selected', 'false');

            const thumb = strip.children[index];
            if (thumb?.dataset.index === String(index)) {
                thumb.classList.add('selected');
                thumb.setAttribute('aria-selected', 'true');
                Gallery._selectedThumb = thumb;
                if (state.bottomStripeVisible) DOM.scrollToCenter(strip, thumb);
            } else {
                Gallery._selectedThumb = null;
            }
        },

        _showControlsTemporarily() {
            state.controlsVisible = true;
            clearTimeout(Gallery._controlsHideTimer);
            Gallery._controlsHideTimer = setTimeout(() => {
                if (!PointerEngine.isDragging && !viewState.pinchZoomActive) {
                    state.controlsVisible = false;
                }
            }, CONFIG.CONTROLS_HIDE_DELAY);
        },

        _setupGalleryInteractions(expandedView, mainContainer) {
            Gallery._interactionAbort?.abort();
            Gallery._interactionAbort = new AbortController();
            const signal = Gallery._interactionAbort.signal;

            const currentIsImage = () => state.fullSizeImageSrcs[state.currentGalleryIndex]?.type === 'image';

            mainContainer.addEventListener('wheel', (e) => {
                if (currentIsImage()) Zoom.handleWheelZoom(e);
            }, { passive: false, signal });

            mainContainer.addEventListener('dblclick', (e) => {
                if (PointerEngine.lastPointerType && PointerEngine.lastPointerType !== 'mouse') return;
                if (currentIsImage()) PointerEngine.handleDoubleTap(e);
            }, { signal });

            PointerEngine.init(mainContainer, signal);

            // One delegated listener for the whole strip instead of one per thumbnail.
            galleryRefs.strip?.addEventListener('click', (e) => {
                const thumb = e.target.closest(`.${CSS.GALLERY.THUMBNAIL_WRAPPER}`);
                if (thumb) Gallery.showExpandedView(Number(thumb.dataset.index));
            }, { signal });

            expandedView.addEventListener('pointermove', Gallery._showControlsTemporarily, { passive: true, signal });
            expandedView.addEventListener('pointerdown', Gallery._showControlsTemporarily, { passive: true, signal });
            Gallery._showControlsTemporarily();
        },

        createGallery() {
            if (galleryOverlay) {
                Gallery.showExpandedView(0);
                state.isGalleryMode = true;
                return;
            }

            galleryOpenerElement = document.activeElement;

            galleryOverlay = DOM.create('div', { id: 'gallery-overlay', className: CSS.GALLERY.OVERLAY });
            const galleryContainer = DOM.create('div', { className: CSS.GALLERY.CONTAINER });
            const expandedView = DOM.create('div', { className: `${CSS.GALLERY.EXPANDED_VIEW} ${CSS.GALLERY.HIDE}` });
            galleryContainer.appendChild(expandedView);
            galleryOverlay.appendChild(galleryContainer);
            galleryRefs.expandedView = expandedView;

            Gallery._createExpandedViewToolbar(expandedView);
            Gallery._createExpandedViewMainImageArea(expandedView);
            Gallery._createExpandedViewNavigationAndCounter(expandedView);
            const strip = Gallery._createExpandedViewThumbnailStrip(expandedView);

            galleryOverlay.classList.toggle(CSS.GALLERY.STRIP_FLOATING, state.stripMode !== 'docked');
            if (state.isFullscreen) {
                document.body.classList.add('ug-fullscreen');
                galleryOverlay.classList.add(CSS.GALLERY.FULLSCREEN_OVERLAY);
            }

            Gallery._populateAllThumbnails(strip);
            document.body.appendChild(galleryOverlay);

            Gallery._setupGalleryInteractions(expandedView, galleryRefs.mainContainer);
            ThumbnailStrip.init();
            Accessibility.init();
            PostActions.updateButtonVisibilityLight();
            Gallery.showExpandedView(0);
            state.isGalleryMode = true;
        },

        _setToolbarMode(mode) {
            const show = (el, visible, display = 'block') => { if (el) el.style.display = visible ? display : 'none'; };
            show(galleryRefs.zoomControls, mode === 'image', 'flex');
            show(galleryRefs.resetBtn, mode === 'image');
            show(galleryRefs.fillHeightBtn, mode === 'video');
            if (mode !== 'image' && galleryRefs.ambient) galleryRefs.ambient.style.backgroundImage = '';
        },

        _renderImage(container, index, mediaItem) {
            Gallery._setToolbarMode('image');

            const imageUrl = Gallery._resolveImageUrl(index, mediaItem);
            if (galleryRefs.ambient) {
                // Small thumbnail for the blurred backdrop: no second full-res decode.
                const bgUrl = String(mediaItem.thumb || imageUrl).replace(/["\\\n\r]/g, '');
                galleryRefs.ambient.style.backgroundImage = `url("${bgUrl}")`;
            }

            const img = DOM.create('img', {
                className: CSS.GALLERY.MAIN_IMG,
                decoding: 'async',
                fetchpriority: 'high',
                alt: mediaItem.fileName || `Image ${index + 1}`,
                draggable: 'false'
            });
            img.style.transformOrigin = '0 0';

            img.addEventListener('load', () => {
                if (!img.isConnected) return;
                img.style.opacity = '1';
                ImageSizing.applyBestFit(img);
                PointerEngine.cachedImgEl = img;
                Zoom.applyZoom();
                Gallery._preloadAdjacentImages(index);
            }, { once: true });

            img.addEventListener('error', function onError() {
                if (!img.isConnected) return;
                if (imageUrl !== mediaItem.src && !img.dataset.ugRetried) {
                    img.dataset.ugRetried = 'true';
                    img.addEventListener('error', onError, { once: true });
                    img.src = mediaItem.src;
                    return;
                }
                container.appendChild(DOM.create('div', { className: CSS.GALLERY.IMAGE_ERROR_MSG, text: 'Failed to load image' }));
            }, { once: true });

            img.src = imageUrl;
            container.appendChild(img);
        },

        _renderVideo(container, mediaItem) {
            Gallery._setToolbarMode('video');

            const video = DOM.create('video', {
                className: CSS.GALLERY.MAIN_VIDEO,
                poster: mediaItem.poster || '',
                controls: '',
                loop: '',
                preload: 'metadata',
                playsinline: '',
                draggable: 'false'
            });
            video.style.transformOrigin = '0 0';
            video.addEventListener('loadedmetadata', () => {
                Utils.setImageStyle(video, {
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                });
                PointerEngine.cachedImgEl = video;
            }, { once: true });

            container.appendChild(video);

            if (isPawchiveHost(mediaItem.src)) {
                // Pawchive requires paced, UA-tagged requests, so the video is
                // fetched through GM.xmlHttpRequest rather than streamed.
                Gallery._videoFetchAbort = new AbortController();
                Gallery._fetchVideoForElement(video, mediaItem.src, state.currentLoadSessionId, Gallery._videoFetchAbort.signal);
            } else {
                video.src = mediaItem.src;
            }

            Gallery._attachVideoPlayOverlay(video, container);
        },

        _renderAttachment(container, index, mediaItem) {
            Gallery._setToolbarMode('attachment');

            const fileName = mediaItem.fileName || mediaItem.src.split('/').pop() || 'attachment';
            const fileExt = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] || 'file').toUpperCase();

            container.appendChild(DOM.create('div', { className: 'ug-attachment-preview' }, [
                DOM.create('div', { html: FILE_ICON_SVG }),
                DOM.create('div', { className: 'ug-attachment-type', text: fileExt }),
                DOM.create('div', { className: 'ug-attachment-info', text: fileName }),
                DOM.create('button', {
                    type: 'button',
                    className: 'ug-attachment-download-btn',
                    text: 'Download File',
                    onclick: (e) => {
                        e.stopPropagation();
                        DownloadManager.downloadImageByIndex(index);
                    }
                })
            ]));
        },

        showExpandedView(index) {
            const container = galleryRefs.mainContainer;
            if (!galleryOverlay || !container || !Number.isInteger(index) || index < 0) return;

            const mediaItem = state.fullSizeImageSrcs[index] || state.originalImageSrcs[index];
            state.currentGalleryIndex = index;

            Gallery._videoFetchAbort?.abort();
            Gallery._videoFetchAbort = null;
            Gallery._releaseMediaElements(container);
            PointerEngine.reset();

            container.replaceChildren();
            container.classList.remove(CSS.GALLERY.ZOOMED);
            viewState.zoomScale = 1;
            viewState.imageOffset = { x: 0, y: 0 };
            if (galleryRefs.zoomLevel) galleryRefs.zoomLevel.textContent = '100%';

            galleryRefs.expandedView?.classList.remove(CSS.GALLERY.HIDE);

            if (!mediaItem?.src) {
                container.appendChild(DOM.create('div', { className: CSS.GALLERY.IMAGE_ERROR_MSG, text: 'Loading media data...' }));
                return;
            }

            if (mediaItem.type === 'video') Gallery._renderVideo(container, mediaItem);
            else if (mediaItem.type === 'attachment') Gallery._renderAttachment(container, index, mediaItem);
            else Gallery._renderImage(container, index, mediaItem);

            const total = state.fullSizeImageSrcs.length;
            if (galleryRefs.counter) {
                galleryRefs.counter.textContent = `${index + 1} / ${total}`;
                galleryRefs.counter.classList.remove(CSS.GALLERY.HIDE);
            }
            Accessibility.announce(`Item ${index + 1} of ${total}`);
            Gallery._selectThumbnail(index);
        },

        closeGallery() {
            if (document.fullscreenElement && document.fullscreenElement === galleryOverlay) {
                document.exitFullscreen().catch(() => {});
            }
            state.isGalleryMode = false;
            state.isFullscreen = false;
            clearTimeout(Gallery._controlsHideTimer);
            Gallery._controlsHideTimer = null;
            Slideshow.stop(true);
            ThumbnailStrip.cleanup();

            if (!galleryOverlay) return;

            Gallery._interactionAbort?.abort();
            Gallery._interactionAbort = null;
            Gallery._videoFetchAbort?.abort();
            Gallery._videoFetchAbort = null;
            Gallery._clearPreloadCache();
            PointerEngine.reset();
            if (Zoom._wheelFrame) cancelAnimationFrame(Zoom._wheelFrame);
            Zoom._wheelFrame = null;

            Gallery._releaseMediaElements(galleryOverlay);
            galleryOverlay.remove();
            galleryOverlay = null;
            galleryRefs.clear();

            Gallery._thumbObserver?.disconnect();
            Gallery._thumbObserver = null;
            Gallery._thumbSentinel = null;
            Gallery._thumbRenderedCount = 0;
            Gallery._selectedThumb = null;

            // Reset so the next gallery starts with visible controls (state
            // skips same-value writes, so a stale `false` would stick).
            state.controlsVisible = true;

            try {
                if (galleryOpenerElement?.isConnected) galleryOpenerElement.focus({ preventScroll: true });
            } catch { /* ignore */ }
            galleryOpenerElement = null;
        },

        toggleGallery() {
            if (state.isGalleryMode) {
                Gallery.closeGallery();
            } else if (state.galleryReady && state.fullSizeImageSrcs.length > 0) {
                Gallery.createGallery();
            } else if (Utils.isPostPage()) {
                ImageLoader.loadImages();
                state.notificationType = 'info';
                state.notification = 'Refreshing gallery list...';
            } else {
                state.notificationType = 'warning';
                state.notification = 'No post page detected.';
            }
        },

        async toggleFullscreen() {
            let mode = state.fullscreenMode || 'native';

            if (mode === 'ask') {
                if (state.isFullscreen) {
                    // Leaving: undo whatever mode we entered with — don't ask again.
                    mode = document.fullscreenElement === galleryOverlay ? 'native' : 'css';
                } else {
                    const { value } = await UGModal.choose({
                        title: 'Fullscreen mode',
                        text: 'How should the gallery enter fullscreen?',
                        icon: 'question',
                        options: [
                            { label: 'Native', value: 'native', primary: true },
                            { label: 'CSS', value: 'css' }
                        ]
                    });
                    if (!value) return;
                    mode = value;
                }
            }

            state.isFullscreen = !state.isFullscreen;
            if (mode !== 'native' || typeof galleryOverlay?.requestFullscreen !== 'function') return;

            try {
                if (state.isFullscreen && !document.fullscreenElement) {
                    await galleryOverlay.requestFullscreen({ navigationUI: 'hide' });
                } else if (!state.isFullscreen && document.fullscreenElement === galleryOverlay) {
                    await document.exitFullscreen();
                }
            } catch (err) {
                console.warn('Ultra Galleries: native fullscreen failed, staying in CSS mode:', err);
            }
        },

        nextImage() {
            const total = state.fullSizeImageSrcs.length;
            if (total === 0) return;
            Gallery.showExpandedView((state.currentGalleryIndex + 1) % total);
        },

        prevImage() {
            const total = state.fullSizeImageSrcs.length;
            if (total === 0) return;
            Gallery.showExpandedView((state.currentGalleryIndex - 1 + total) % total);
        }
    };

    // ====================================================
    // Image Loader Module
    // ====================================================
    const ImageLoader = {
        _inflight: new Map(),

        imageActions: {
            height: ImageSizing.applyFillHeight,
            width: ImageSizing.applyFillWidth,
            full: ImageSizing.applyFullSize
        },

        applyResize(img) {
            (ImageLoader.imageActions[state.currentResizeMode] || ImageSizing.applyFillHeight)(img);
        },

        // Requests are tracked per scope: a page-load session id, 'dl' for a
        // cancellable ZIP (has a signal), or 'direct' for one-off downloads.
        // Page navigation aborts sessions only; downloads outlive it.
        async _fetchBlobInternal(url, sessionId, retries, delay, signal = null) {
            try {
                await RequestPacer.throttle(url);

                return await new Promise((resolve, reject) => {
                    if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                        reject(new Error('Stale session'));
                        return;
                    }
                    if (signal?.aborted) {
                        reject(new Error('Request aborted'));
                        return;
                    }

                    let handle = null;
                    const trackId = sessionId ?? (signal ? 'dl' : 'direct');
                    const cleanup = () => ActiveRequests.remove(trackId, handle);

                    handle = GM.xmlHttpRequest({
                        method: 'GET',
                        url,
                        headers: RequestPacer.getHeaders(url),
                        responseType: 'blob',
                        timeout: 120000,
                        onload: (response) => {
                            cleanup();
                            if (response.status === 200 || response.status === 206) {
                                const blob = response.response;
                                // Fire-and-forget: the image is shown without waiting
                                // for an IndexedDB commit. Partial (206) bodies are
                                // never cached.
                                if (state.enablePersistentCaching && response.status === 200) {
                                    ImageCacheDB.put(url, blob);
                                }
                                resolve(blob);
                            } else {
                                const err = new Error(`HTTP ${response.status}`);
                                err.status = response.status;
                                reject(err);
                            }
                        },
                        onerror: (error) => { cleanup(); reject(error instanceof Error ? error : new Error(error?.error || 'Network error')); },
                        ontimeout: () => { cleanup(); reject(new Error('Request timeout')); },
                        onabort: () => { cleanup(); reject(new Error('Request aborted')); }
                    });

                    ActiveRequests.add(trackId, handle);
                });
            } catch (err) {
                if (err.message === 'Stale session' || err.message === 'Request aborted') throw err;
                if (err.status >= 400 && err.status < 500 && err.status !== 429) throw err;
                if (retries <= 0) throw err;
                // Jittered backoff so parallel failures don't retry in lockstep.
                await Utils.delay(delay * (0.75 + Math.random() * 0.5));
                if (sessionId !== null && state.currentLoadSessionId !== sessionId) throw new Error('Stale session');
                if (signal?.aborted) throw new Error('Request aborted');
                return ImageLoader._fetchBlobInternal(url, sessionId, retries - 1, delay * 1.5, signal);
            }
        },

        // Cache-first, de-duplicated (concurrent callers for the same URL in
        // the same scope share one request). `signal` makes it cancellable.
        fetchBlob(url, sessionId = null, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY, signal = null) {
            if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                return Promise.reject(new Error('Stale session'));
            }
            if (signal?.aborted) return Promise.reject(new Error('Request aborted'));

            const key = `${sessionId ?? (signal ? 'dl' : 'direct')}:${url}`;
            const existing = ImageLoader._inflight.get(key);
            if (existing) return existing;

            const promise = (async () => {
                if (state.enablePersistentCaching) {
                    const cachedBlob = await ImageCacheDB.get(url);
                    if (cachedBlob) return cachedBlob;
                }
                if (sessionId !== null && state.currentLoadSessionId !== sessionId) {
                    throw new Error('Stale session');
                }
                if (signal?.aborted) throw new Error('Request aborted');
                return ImageLoader._fetchBlobInternal(url, sessionId, retries, delay, signal);
            })();

            ImageLoader._inflight.set(key, promise);
            const cleanup = () => {
                if (ImageLoader._inflight.get(key) === promise) ImageLoader._inflight.delete(key);
            };
            promise.then(cleanup, cleanup);
            return promise;
        },

        fetchBlobDirect(url, signal = null) {
            return ImageLoader.fetchBlob(url, null, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, signal);
        },

        // Cheapest source first: blob already in memory → IndexedDB → network
        // (fetchBlob itself checks IndexedDB first).
        async getBestBlob(url, signal = null) {
            const blobUrl = loadedBlobUrls.get(url);
            if (blobUrl) {
                try {
                    const res = await fetch(blobUrl);
                    if (res.ok) return await res.blob();
                } catch { /* revoked meanwhile: fall through */ }
            }
            return ImageLoader.fetchBlobDirect(url, signal);
        },

        _pruneBlobUrls() {
            if (loadedBlobUrls.size === 0) return;
            const inUse = new Set();
            document.querySelectorAll('img[src^="blob:"], video[src^="blob:"], video[poster^="blob:"]').forEach(el => {
                const src = el.getAttribute('src');
                if (src?.startsWith('blob:')) inUse.add(src);
                const poster = el.getAttribute('poster');
                if (poster?.startsWith('blob:')) inUse.add(poster);
            });
            for (const item of state.fullSizeImageSrcs) {
                if (!item) continue;
                for (const v of [item.src, item.poster, item.thumb]) {
                    if (typeof v === 'string' && v.startsWith('blob:')) inUse.add(v);
                }
            }
            for (const [key, url] of loadedBlobUrls) {
                if (!inUse.has(url)) {
                    BlobManager.revokeUrl(url);
                    loadedBlobUrls.delete(key);
                }
            }
        },

        _buildGalleryEntry(item, posterOverride = null) {
            if (item.type === 'video') {
                return { type: 'video', src: item.originalUrl, poster: posterOverride || item.posterUrl };
            }
            if (item.type === 'attachment') {
                return { type: 'attachment', src: item.originalUrl, poster: FALLBACK_ATTACHMENT, fileName: item.fileName };
            }
            return { type: 'image', src: item.originalUrl, originalSrc: item.originalUrl, thumb: item.thumbUrl, fileName: item.fileName };
        },

        async loadImageAndApplyToPage(linkElement, galleryIndex, posterHref, isUniqueForGallery, sessionId, itemData) {
            const imgElement = linkElement.querySelector?.('img') || linkElement;
            const cacheKey = itemData.originalUrl;

            if (imgElement.tagName === 'IMG') imgElement.classList.add('post__image');

            let blobUrlToUse = loadedBlobUrls.get(posterHref);
            // For videos only the poster is fetched here — never the video itself.
            const fetchUrl = itemData.type === 'video' ? posterHref : cacheKey;

            try {
                if (itemData.type !== 'attachment') {
                    if (!blobUrlToUse) {
                        // Data-URI fallback posters don't need fetching.
                        if (!fetchUrl.startsWith('data:')) {
                            const blob = await ImageLoader.fetchBlob(fetchUrl, sessionId);
                            if (state.currentLoadSessionId !== sessionId) return;
                            if (!blob) throw new Error('Failed to fetch blob');
                            blobUrlToUse = BlobManager.createUrl(blob);
                            loadedBlobUrls.set(posterHref, blobUrlToUse);
                        }
                    }

                    if (state.currentLoadSessionId !== sessionId) return;

                    if (imgElement.tagName === 'IMG' && blobUrlToUse) {
                        // Remember the site's small thumbnail before the
                        // full-resolution blob replaces it.
                        if (!imgElement.dataset.ugThumbSrc) {
                            const current = imgElement.getAttribute('src') || '';
                            if (current && !current.startsWith('blob:')) imgElement.dataset.ugThumbSrc = current;
                        }
                        imgElement.decoding = 'async';
                        imgElement.src = blobUrlToUse;
                        imgElement.dataset.originalSrc = cacheKey;
                        imgElement.classList.add('ug-image-loaded');
                        imgElement.style.cursor = 'default';
                        const parentLink = imgElement.closest('a');
                        if (parentLink) parentLink.style.cursor = 'default';
                        ImageLoader.applyResize(imgElement);
                    }
                }

                if (isUniqueForGallery) {
                    // Find the slot by URL, not by the index captured when loading
                    // started: "Remove from Gallery" shifts indices, and a removed
                    // item (slot -1) must stay removed.
                    const slot = state.originalImageSrcs.findIndex(x => x?.src === cacheKey);
                    if (slot > -1) {
                        state.fullSizeImageSrcs[slot] = ImageLoader._buildGalleryEntry(
                            itemData,
                            itemData.type === 'video' ? blobUrlToUse : null
                        );
                        state.originalImageSrcs[slot] = {
                            src: cacheKey,
                            type: itemData.type,
                            fileName: itemData.fileName || linkElement.getAttribute?.('download') || cacheKey.split('/').pop()
                        };
                    }
                }

                // Items can reload after being unloaded; count each only once.
                if (state.currentLoadSessionId === sessionId && !itemData._counted) {
                    itemData._counted = true;
                    state.loadedImages++;
                }
            } catch (error) {
                if (state.currentLoadSessionId !== sessionId) return;
                ErrorHandler.handleImageError(
                    error, fetchUrl,
                    imgElement.tagName === 'IMG' ? imgElement : null,
                    { linkElement, galleryIndex, posterHref, isUniqueForGallery, itemData }
                );
                if (!itemData._counted) {
                    itemData._counted = true;
                    state.loadedImages++;
                }
                state.errorCount++;
            }
        },

        _thumbSrcOf(linkElement) {
            const img = linkElement.querySelector?.('img');
            if (!img) return null;
            const src = img.dataset.ugThumbSrc || img.getAttribute('data-src') || img.getAttribute('src');
            return src && !src.startsWith('blob:') ? src : null;
        },

        collectUniqueMediaItems(postContainer) {
            const items = new Map();
            const targets = postContainer.querySelectorAll(
                `${SELECTORS.IMAGE_LINK}, ${SELECTORS.ATTACHMENT_LINK}, ${SELECTORS.VIDEO_LINK}, ${SELECTORS.GENERIC_IMAGE_LINK}`
            );

            // Blob → original URL reverse map, built once (was a linear scan per video).
            const blobToOriginal = new Map();
            for (const [orig, blobbed] of loadedBlobUrls) blobToOriginal.set(blobbed, orig);

            for (const linkElement of targets) {
                if (linkElement.closest('.post__user-profile, .scrape__user-profile')) continue;
                if (linkElement.classList.contains('user-header__avatar')) continue;

                const cleanHref = (linkElement.getAttribute('href') || linkElement.href || '').split('?')[0];
                const isVideo = linkElement.matches(SELECTORS.VIDEO_LINK) || /\.(mp4|webm|mov)$/i.test(cleanHref);

                if (isVideo) {
                    const url = cleanHref;
                    if (!url || items.has(url) || !isTrustedMediaUrl(url)) continue;
                    const posterImg = linkElement.querySelector('img');
                    let posterSrc = posterImg?.getAttribute('data-src') || posterImg?.getAttribute('src');
                    if (posterSrc?.startsWith('blob:')) posterSrc = blobToOriginal.get(posterSrc) || posterSrc;
                    const rawPoster = linkElement.querySelector('video')?.getAttribute('poster') || posterSrc;
                    const poster = isTrustedMediaUrl(rawPoster) ? rawPoster : FALLBACK_POSTER;

                    items.set(url, {
                        linkElement, originalUrl: url, posterUrl: poster, type: 'video',
                        fileName: Utils.extractFileName(linkElement, url)
                    });
                    continue;
                }

                let url = Utils.handleMediaSrc(linkElement);
                if (!url && linkElement.href) url = linkElement.href.split('?')[0];
                if (!url || items.has(url) || !isTrustedMediaUrl(url)) continue;

                if (/\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(url)) {
                    items.set(url, {
                        linkElement, originalUrl: url, posterUrl: url, type: 'image',
                        thumbUrl: ImageLoader._thumbSrcOf(linkElement),
                        fileName: Utils.extractFileName(linkElement, url)
                    });
                } else if (linkElement.matches(SELECTORS.ATTACHMENT_LINK)) {
                    items.set(url, {
                        linkElement, originalUrl: url, posterUrl: FALLBACK_ATTACHMENT, type: 'attachment',
                        fileName: Utils.extractFileName(linkElement, url)
                    });
                }
            }

            for (const videoEl of postContainer.querySelectorAll('video')) {
                let url = videoEl.getAttribute('src') || videoEl.querySelector('source')?.getAttribute('src');
                if (!url || url.startsWith('blob:')) continue;
                url = url.split('?')[0];
                if (items.has(url) || !isTrustedMediaUrl(url)) continue;
                const rawPoster = videoEl.getAttribute('poster');
                items.set(url, {
                    linkElement: videoEl, originalUrl: url,
                    posterUrl: isTrustedMediaUrl(rawPoster) ? rawPoster : FALLBACK_POSTER, type: 'video',
                    fileName: Utils.extractFileName(videoEl, url)
                });
            }

            return items;
        },

        // Lazy original loading. Items upgrade to full resolution only while they
        // are within LAZY_LOAD_MARGIN of the viewport, and image blobs are freed
        // again once they drift beyond LAZY_UNLOAD_MARGIN (wider, so items don't
        // thrash at the boundary). Keeps memory flat on 200+ image posts.
        _lazy: null,

        stopLazyLoading() {
            const lazy = ImageLoader._lazy;
            if (!lazy) return;
            lazy.loadObserver.disconnect();
            lazy.unloadObserver.disconnect();
            lazy.queue.length = 0;
            ImageLoader._lazy = null;
        },

        // Frees one image's blob and restores the site's thumbnail.
        _unloadOriginal(item) {
            const imgElement = item.linkElement?.querySelector?.('img');
            const thumbSrc = imgElement?.dataset.ugThumbSrc;
            if (!imgElement || !thumbSrc) return false; // nothing to restore → keep it
            if (state.currentResizeMode === 'full') return false; // thumbnail would reflow the page
            if (galleryOverlay && state.fullSizeImageSrcs[state.currentGalleryIndex]?.src === item.originalUrl) return false;

            const blobUrl = loadedBlobUrls.get(item.posterUrl);
            imgElement.src = thumbSrc;
            imgElement.classList.remove('ug-image-loaded');
            if (blobUrl) {
                BlobManager.revokeUrl(blobUrl);
                loadedBlobUrls.delete(item.posterUrl);
            }
            return true;
        },

        _startLazyLoading(items, sessionId) {
            ImageLoader.stopLazyLoading();

            const limit = CONFIG.MAX_CONCURRENT_FETCHES;
            // `band`: element → inside the unload margin? (absent until first reported)
            const lazy = { queue: [], active: 0, status: new Map(), byElement: new Map(), band: new Map(), loadObserver: null, unloadObserver: null };
            ImageLoader._lazy = lazy;

            const pump = () => {
                while (ImageLoader._lazy === lazy && state.currentLoadSessionId === sessionId &&
                       lazy.active < limit && lazy.queue.length) {
                    const entry = lazy.queue.shift();
                    if (lazy.status.get(entry.item) !== 'queued') continue; // left the band while waiting
                    lazy.status.set(entry.item, 'loading');
                    lazy.active++;
                    ImageLoader.loadImageAndApplyToPage(
                        entry.item.linkElement, entry.index, entry.item.posterUrl, true, sessionId, entry.item
                    ).catch(() => { /* handled inside */ }).finally(() => {
                        lazy.active--;
                        if (lazy.status.get(entry.item) === 'loading') {
                            lazy.status.set(entry.item, 'loaded');
                            // Scrolled far past while it was loading: free it now,
                            // the unload observer won't fire again for it.
                            if (entry.item.type === 'image' && lazy.band.get(entry.item.linkElement) === false &&
                                ImageLoader._unloadOriginal(entry.item)) {
                                lazy.status.set(entry.item, 'idle');
                            }
                        }
                        pump();
                    });
                }
            };

            lazy.loadObserver = new IntersectionObserver((entries) => {
                for (const e of entries) {
                    const entry = lazy.byElement.get(e.target);
                    if (!entry || !e.isIntersecting || lazy.status.get(entry.item) !== 'idle') continue;
                    lazy.status.set(entry.item, 'queued');
                    lazy.queue.push(entry);
                }
                pump();
            }, { rootMargin: CONFIG.LAZY_LOAD_MARGIN });

            lazy.unloadObserver = new IntersectionObserver((entries) => {
                for (const e of entries) {
                    lazy.band.set(e.target, e.isIntersecting);
                    if (e.isIntersecting) continue;
                    const entry = lazy.byElement.get(e.target);
                    const status = entry && lazy.status.get(entry.item);
                    if (status === 'queued') {
                        lazy.status.set(entry.item, 'idle');
                    } else if (status === 'loaded' && entry.item.type === 'image' && ImageLoader._unloadOriginal(entry.item)) {
                        lazy.status.set(entry.item, 'idle');
                    }
                }
            }, { rootMargin: CONFIG.LAZY_UNLOAD_MARGIN });

            items.forEach((item, index) => {
                const el = item.linkElement;
                if (!el || lazy.byElement.has(el)) return;
                lazy.byElement.set(el, { item, index });
                lazy.status.set(item, 'idle');
                lazy.loadObserver.observe(el);
                lazy.unloadObserver.observe(el);
            });
        },

        _findPostContainer() {
            return DOM.$('section.site-section--post') ||
                DOM.$('section.site-section--scrape') ||
                DOM.$('.post__body') ||
                DOM.$('.post__content');
        },

        async loadImages({ force = false } = {}) {
            if (!Utils.isPostPage()) return;
            if (state.isLoading && !force) return;

            if (state.currentLoadSessionId) ActiveRequests.abortSession(state.currentLoadSessionId);

            const sessionId = StateManager.generateSessionId();
            state.currentLoadSessionId = sessionId;
            state.isLoading = true;

            try {
                // Yield one frame so the page can finish its own render first.
                await new Promise(r => requestAnimationFrame(() => r()));
                if (state.currentLoadSessionId !== sessionId) return;

                const postContainer = ImageLoader._findPostContainer() || document;
                const uniqueItems = Array.from(ImageLoader.collectUniqueMediaItems(postContainer).values());
                Utils.sortItems(uniqueItems, state.sortMode);

                state.loadedImages = 0;
                state.errorCount = 0;
                state.fullSizeImageSrcs = uniqueItems.map(item => ImageLoader._buildGalleryEntry(item));
                state.originalImageSrcs = uniqueItems.map(item => ({ src: item.originalUrl, type: item.type, fileName: item.fileName }));
                state.totalImages = uniqueItems.length;

                state.galleryReady = true;
                updateGalleryButton(true);

                if (state.autoLoadOriginals) {
                    Utils.ensureThumbnailsExist();
                    ImageLoader._startLazyLoading(uniqueItems, sessionId);
                } else {
                    ImageLoader.stopLazyLoading();
                    ImageLoader._pruneBlobUrls();
                }
                state.isLoading = false;
                state.notificationType = 'success';
                state.notification = state.totalImages
                    ? `Gallery Ready (${state.totalImages} items).`
                    : 'No gallery images found.';
            } catch (error) {
                console.error('Critical Error in ImageLoader.loadImages:', error);
                state.galleryReady = true;
                updateGalleryButton(true);
            } finally {
                if (state.currentLoadSessionId === sessionId) state.isLoading = false;
            }
        }
    };

    // ====================================================
    // Streaming ZIP Download Manager
    // ----------------------------------------------------
    // fflate STORE-mode streaming: files are fetched ZIP_LOOKAHEAD ahead and
    // written in gallery order. On Chromium the archive streams straight to
    // disk via the File System Access API, so memory stays flat no matter
    // how big the post is; elsewhere chunks are collected into one Blob.
    // ====================================================
    const DownloadManager = {
        _abort: null,
        _sink: null,

        _getPostMeta: () => ({
            title: DOM.$(SELECTORS.POST_TITLE)?.textContent?.trim() || 'Untitled',
            artistName: DOM.$(SELECTORS.POST_USER_NAME)?.textContent?.trim() || 'Unknown Artist',
            datePublished: Utils.getPostDate('published'),
            dateEdited: Utils.getPostDate('edited'),
            dateImported: Utils.getPostDate('imported'),
            publishedDate: Utils.getPostDateObject('published')
        }),

        _applyTokens(format, meta) {
            return String(format)
                .replace(/{date_published}/gi, () => meta.datePublished)
                .replace(/{date_edited}/gi, () => meta.dateEdited)
                .replace(/{date_imported}/gi, () => meta.dateImported)
                .replace(/{date}/gi, () => meta.datePublished)
                .replace(/{title}/gi, () => Utils.sanitizeFileName(meta.title))
                .replace(/{artistName}/gi, () => Utils.sanitizeFileName(meta.artistName));
        },

        _buildFileName(item, index, meta = DownloadManager._getPostMeta()) {
            const rawName = String(item.fileName || '');
            const ext = rawName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ||
                (item.type === 'video' ? 'mp4' : item.type === 'attachment' ? 'bin' : 'jpg');
            const baseName = rawName.replace(/\.[^/.]+$/, '');

            let name = DownloadManager._applyTokens(state.imageFileNameFormat, meta)
                .replace(/{fileName}/gi, () => Utils.sanitizeFileName(baseName))
                .replace(/{index}/gi, () => String(index + 1));
            if (!name.toLowerCase().endsWith(`.${ext}`)) name += `.${ext}`;
            return Utils.sanitizeFileName(name);
        },

        _buildZipName(meta, filter, suffix) {
            let name = DownloadManager._applyTokens(state.zipFileNameFormat, meta);
            if (name.toLowerCase().endsWith('.zip')) name = name.slice(0, -4);
            if (filter !== 'all') name += `-${suffix}`;
            return `${Utils.sanitizeFileName(name) || 'download'}.zip`;
        },

        async downloadFile(url, name) {
            await RequestPacer.throttle(url);

            const gmResult = await new Promise(resolve => {
                if (typeof GM_download !== 'function') { resolve(null); return; }
                try {
                    GM_download({
                        url,
                        name,
                        headers: RequestPacer.getHeaders(url),
                        onload: () => resolve(true),
                        // A dismissed Save As dialog also lands here: don't re-download.
                        onerror: (e) => resolve(/cancel/i.test(`${e?.error} ${e?.details}`) ? 'cancelled' : false),
                        ontimeout: () => resolve(false)
                    });
                } catch (e) {
                    console.error('GM_download failed:', e);
                    resolve(false);
                }
            });
            if (gmResult === true || gmResult === 'cancelled') return gmResult;

            try {
                const blob = await ImageLoader.fetchBlobDirect(url);
                if (!blob) return false;
                DOM.saveBlob(blob, name);
                return true;
            } catch (e) {
                console.error('Ultra Galleries: fallback download failed:', e);
                return false;
            }
        },

        // Returns a writer, or null if the user dismissed the save dialog.
        async _openZipSink(suggestedName) {
            if (typeof window.showSaveFilePicker === 'function') {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName,
                        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }]
                    });
                    const writable = await handle.createWritable();
                    return {
                        streamed: true,
                        write: chunk => writable.write(chunk),
                        close: () => writable.close(),
                        abort: () => writable.abort().catch(() => {})
                    };
                } catch (e) {
                    if (e?.name === 'AbortError') return null;
                    console.warn('Ultra Galleries: save picker unavailable, buffering in memory:', e);                }
            }
            let chunks = [];
            return {
                streamed: false,
                write: chunk => { chunks.push(chunk); },
                close: () => {
                    DOM.saveBlob(new Blob(chunks, { type: 'application/zip' }), suggestedName);
                    chunks = [];
                },
                abort: () => { chunks = []; }
            };
        },

        // Fetches up to `lookahead` entries concurrently, yields them in order.
        // A "heavy" entry (big file) is only fetched alone, so RAM holds at most
        // one of them. Abort ends the iteration at once instead of waiting for
        // the head-of-line fetch.
        async *_orderedFetch(entries, fetcher, lookahead, signal, isHeavy = () => false) {
            const pending = [];
            const aborted = new Promise(r => signal.addEventListener('abort', () => r(null), { once: true }));
            let next = 0;
            const fill = () => {
                while (!signal.aborted && pending.length < lookahead && next < entries.length) {
                    const entry = entries[next];
                    const heavy = isHeavy(entry);
                    if (pending.length && (heavy || pending.some(p => p.heavy))) break;
                    next++;
                    pending.push({
                        heavy,
                        promise: fetcher(entry).then(
                            blob => ({ entry, blob }),
                            error => ({ entry, blob: null, error })
                        )
                    });
                }
            };
            fill();
            while (pending.length) {
                const result = await Promise.race([pending.shift().promise, aborted]);
                if (!result) return;
                fill();
                yield result;
            }
        },

        _ensureCancelStyle() {
            addStyle(
                '#ug-dl-cancel{position:fixed;right:20px;bottom:20px;z-index:2147483000;' +
                'padding:8px 16px;border:1px solid rgba(255,110,110,.55);border-radius:999px;' +
                'background:rgba(24,24,28,.94);color:#ff8a8a;font:600 13px/1.2 system-ui,sans-serif;' +
                'cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.5);}' +
                '#ug-dl-cancel:hover{background:rgba(60,24,28,.96);color:#ffb3b3;}',
                'ug-dl-cancel-style'
            );
        },

        _showCancelButton() {
            if (document.getElementById('ug-dl-cancel')) return;
            DownloadManager._ensureCancelStyle();
            document.body.appendChild(DOM.create('button', {
                id: 'ug-dl-cancel',
                type: 'button',
                text: '\u2715 Cancel download',
                title: 'Cancel the running ZIP download',
                onclick: () => DownloadManager.cancelDownload()
            }));
        },

        _hideCancelButton() {
            document.getElementById('ug-dl-cancel')?.remove();
        },

        cancelDownload() {
            if (!state.isDownloading) return;
            DownloadManager._abort?.abort();
            ActiveRequests.abortSession('dl');
            state.notificationType = 'warning';
            state.notification = 'Download cancelled.';
        },

        async downloadAllImages(filter = 'all') {
            if (state.isDownloading) {
                UGModal.alert('Download in Progress', 'A download is already running.', 'info');
                return;
            }
            if (typeof fflate === 'undefined' || typeof fflate.Zip !== 'function') {
                UGModal.alert(
                    'Download Unavailable',
                    'The ZIP library failed to load. Check your connection, then update or reinstall the script.',
                    'warning'
                );
                return;
            }

            const meta = DownloadManager._getPostMeta();

            let entries = state.originalImageSrcs
                .map((item, index) => ({ item, index }))
                .filter(x => x.item?.src);
            if (filter === 'images') entries = entries.filter(x => x.item.type === 'image');
            else if (filter === 'attachments') entries = entries.filter(x => x.item.type !== 'image');

            if (entries.length === 0) {
                state.notificationType = 'warning';
                state.notification = {
                    images: 'No images found to download.',
                    attachments: 'No attachments found to download.'
                }[filter] || 'No media found to download.';
                return;
            }

            const copy = {
                images: { title: 'Download Images?', text: `Create ZIP from ${entries.length} image(s)?`, suffix: 'images' },
                attachments: { title: 'Download Files?', text: `Create ZIP from ${entries.length} attachment(s)? (videos + other files)`, suffix: 'files' },
                all: { title: 'Download All?', text: `Create ZIP from all ${entries.length} item(s)? (images + videos + attachments)`, suffix: 'all' }
            }[filter];
            if (!copy) return;

            const { isConfirmed } = await UGModal.confirm({
                title: copy.title, text: copy.text, icon: 'question',
                confirmText: 'Create ZIP', cancelText: 'Cancel'
            });
            if (!isConfirmed) return;

            // Opened immediately after the click so the picker keeps user activation.
            const sink = await DownloadManager._openZipSink(DownloadManager._buildZipName(meta, filter, copy.suffix));
            if (!sink) return;

            const abort = new AbortController();
            DownloadManager._abort = abort;
            DownloadManager._sink = sink;
            state.isDownloading = true;
            DownloadManager._showCancelButton();
            state.notificationType = 'info';
            state.notification = sink.streamed ? 'Streaming ZIP to disk...' : 'Preparing ZIP in memory...';

            const notifyProgress = Utils.throttle((message) => {
                if (!state.isDownloading) return;
                state.notificationType = 'info';
                state.notification = message;
            }, CONFIG.PROGRESS_NOTIFY_INTERVAL);

            const mtime = state.preserveFileDates ? meta.publishedDate : null;

            let zipError = null;
            let writeChain = Promise.resolve();
            let resolveFinal;
            const finished = new Promise(r => { resolveFinal = r; });

            const zip = new fflate.Zip((err, chunk, final) => {
                if (err) { zipError ??= err; resolveFinal(); return; }
                writeChain = writeChain
                    .then(() => sink.write(chunk))
                    .catch(e => { zipError ??= e; });
                if (final) writeChain.then(resolveFinal);
            });

            const usedNames = new Set();
            const uniqueName = (name) => {
                if (!usedNames.has(name)) { usedNames.add(name); return name; }
                const dot = name.lastIndexOf('.');
                const base = dot > -1 ? name.slice(0, dot) : name;
                const ext = dot > -1 ? name.slice(dot) : '';
                let n = 1;
                while (usedNames.has(`${base}_${n}${ext}`)) n++;
                const unique = `${base}_${n}${ext}`;
                usedNames.add(unique);
                return unique;
            };

            const fetchEntry = ({ item }) => ImageLoader.getBestBlob(item.src, abort.signal);
            const isHeavy = ({ item }) => item.type !== 'image';

            let written = 0;
            let skipped = 0;
            let totalBytes = 0;

            try {
                for await (const { entry, blob, error } of
                    DownloadManager._orderedFetch(entries, fetchEntry, CONFIG.ZIP_LOOKAHEAD, abort.signal, isHeavy)) {
                    if (abort.signal.aborted || zipError) break;
                    if (!blob) {
                        skipped++;
                        console.warn(`Skipping ${entry.item.src}`, error);
                        continue;
                    }

                    totalBytes += blob.size;
                    if (totalBytes > CONFIG.ZIP_MAX_BYTES) {
                        throw new Error('archive would pass 4 GiB (ZIP64 is not supported). Use DL IMAGES and DL FILES separately.');
                    }

                    const file = new fflate.ZipPassThrough(
                        uniqueName(DownloadManager._buildFileName(entry.item, entry.index, meta))
                    );
                    if (mtime) file.mtime = mtime;
                    zip.add(file);

                    if (typeof blob.stream === 'function') {
                        const reader = blob.stream().getReader();
                        try {
                            for (;;) {
                                const { done, value } = await reader.read();
                                if (done || abort.signal.aborted) break;
                                file.push(value);
                                await writeChain; // backpressure: don't outrun the disk
                            }
                        } finally {
                            reader.releaseLock();
                        }
                        file.push(new Uint8Array(0), true);
                    } else {
                        file.push(new Uint8Array(await blob.arrayBuffer()), true);
                    }
                    await writeChain;

                    written++;
                    notifyProgress(`Zipping ${written}/${entries.length}...`);
                }

                if (abort.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
                if (zipError) throw zipError;

                zip.end();
                await finished;
                if (zipError) throw zipError;
                await sink.close();

                state.notificationType = skipped ? 'warning' : 'success';
                state.notification = skipped
                    ? `Download complete — ${skipped} file(s) could not be fetched.`
                    : 'Download complete!';
            } catch (e) {
                abort.abort(); // stop fetches still running ahead of a failed write/size check
                ActiveRequests.abortSession('dl');
                try { zip.terminate(); } catch { /* ignore */ }
                await sink.abort();
                if (e?.name !== 'AbortError') {
                    console.error('Ultra Galleries: ZIP failed:', e);
                    state.notificationType = 'error';
                    state.notification = `Download failed: ${e?.message || e}`;
                }
            } finally {
                DownloadManager._finish();
            }
        },

        async downloadImageByIndex(index) {
            const item = state.originalImageSrcs[index];
            if (!item?.src) {
                state.notificationType = 'warning';
                state.notification = 'No media found at this index.';
                return;
            }

            const formattedName = DownloadManager._buildFileName(item, index);

            if (item.type === 'video' || item.type === 'attachment') {
                const label = item.type === 'video' ? 'Video' : 'File';
                state.notificationType = 'info';
                state.notification = `Starting ${label.toLowerCase()} download...`;
                const ok = await DownloadManager.downloadFile(item.src, formattedName);
                if (ok === 'cancelled') {
                    state.notificationType = 'info';
                    state.notification = `${label} download cancelled`;
                    return;
                }
                state.notificationType = ok ? 'success' : 'error';
                state.notification = `${label} download ${ok ? 'complete' : 'failed'}`;
                return;
            }

            try {
                const blob = await ImageLoader.getBestBlob(item.src);
                if (!blob) throw new Error('Blob is null');
                DOM.saveBlob(blob, formattedName);
                state.notificationType = 'success';
                state.notification = 'Download started';
            } catch (e) {
                console.error(e);
                state.notificationType = 'error';
                state.notification = 'Download failed';
            }
        },

        _finish() {
            DownloadManager._hideCancelButton();
            DownloadManager._abort = null;
            DownloadManager._sink = null;
            state.isDownloading = false;
        },

        // Aborts any running download (used by page teardown).
        cleanup() {
            if (state.isDownloading) {
                DownloadManager._abort?.abort();
                DownloadManager._sink?.abort();
            }
            DownloadManager._finish();
        }
    };

    // ====================================================
    // Post Actions & UI Injection
    // ====================================================
    const PostActions = {
        imageLinkClickHandler(event) {
            if (event.button !== 0) return;
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            if (event.target.closest(`${SELECTORS.IMAGE_LINK}, ${SELECTORS.VIDEO_LINK}`)) {
                event.preventDefault();
                event.stopPropagation();
            }
        },

        _filesArea() {
            return DOM.$('div.post__files') || DOM.$('section.site-section--post') ||
                DOM.$('section.site-section--scrape') || DOM.$('.post__body');
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
                    elements.galleryButton = UI.createToggleButton('Loading Gallery...', Gallery.toggleGallery, true, 'GALLERY', 'global');

                    const globalButtons = DOM.create('div', { className: 'ug-injected-ui ug-global-actions' }, [
                        UI.createToggleButton(BUTTONS.HEIGHT, () => PostActions.resizeAllImages('height'), false, 'HEIGHT', 'global'),
                        UI.createToggleButton(BUTTONS.WIDTH, () => PostActions.resizeAllImages('width'), false, 'WIDTH', 'global'),
                        UI.createToggleButton(BUTTONS.FULL, () => PostActions.resizeAllImages('full'), false, 'FULL', 'global'),
                        UI.createToggleButton(BUTTONS.DOWNLOAD_ALL, () => DownloadManager.downloadAllImages('all'), false, 'DOWNLOAD_ALL', 'global'),
                        UI.createToggleButton(BUTTONS.DOWNLOAD_IMAGES, () => DownloadManager.downloadAllImages('images'), false, 'DOWNLOAD_IMAGES', 'global'),
                        UI.createToggleButton(BUTTONS.DOWNLOAD_ATTACHMENTS, () => DownloadManager.downloadAllImages('attachments'), false, 'DOWNLOAD_ATTACHMENTS', 'global'),
                        elements.galleryButton
                    ]);
                    postActionsContainer.appendChild(globalButtons);
                }

                if (!DOM.$('.settings-button-wrapper')) {
                    const settingsButton = DOM.create('button', {
                        type: 'button',
                        text: BUTTONS.SETTINGS,
                        className: CSS.SETTINGS_BTN,
                        'aria-label': 'Ultra Galleries settings',
                        onclick: () => { state.settingsOpen = !state.settingsOpen; }
                    });
                    document.body.appendChild(DOM.create('div', { className: 'settings-button-wrapper ug-injected-ui' }, [settingsButton]));
                    elements.settingsButton = settingsButton;
                }

                const filesArea = PostActions._filesArea();
                if (filesArea) {
                    PostActions._injectThumbButtonGroups(filesArea, false);
                    if (!filesArea.dataset.ugLeftClickHandlerAttached) {
                        filesArea.addEventListener('click', PostActions.imageLinkClickHandler);
                        filesArea.dataset.ugLeftClickHandlerAttached = 'true';
                    }
                }

                PostActions.updateButtonVisibilityLight();
                ImageLoader.loadImages();
            } catch (error) {
                console.error('Error initializing post actions:', error);
            }
        },

        cleanupPostActions() {
            ImageLoader.stopLazyLoading();
            // Page sessions only: a running download must survive navigation.
            ActiveRequests.abortSession(state.currentLoadSessionId);
            ImageLoader._inflight.clear();
            UGModal.closeAny();
            state.currentLoadSessionId = null;
            ErrorHandler.clearRetries();
            UI.forceHideNotification();

            DOM.$$('img.post__image.ug-image-loaded').forEach(img => img.classList.remove('ug-image-loaded'));
            DOM.$$('.ug-injected-ui').forEach(el => el.remove());
            document.getElementById(CSS.NOTIF_AREA)?.remove();

            DOM.$$('[data-ug-left-click-handler-attached]').forEach(area => {
                area.removeEventListener('click', PostActions.imageLinkClickHandler);
                area.removeAttribute('data-ug-left-click-handler-attached');
            });

            Gallery.closeGallery();

            if (state.settingsOpen) state.settingsOpen = false;
            else document.getElementById('ug-settings-overlay')?.remove();

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

            elements.galleryButton = null;
            elements.settingsButton = null;
        },

        _buildThumbButtonGroup(imgElement) {
            return UI.createButtonGroup([
                { text: BUTTONS.HEIGHT, action: (evt) => PostActions.resizeImage('height', evt), name: 'HEIGHT' },
                { text: BUTTONS.WIDTH, action: (evt) => PostActions.resizeImage('width', evt), name: 'WIDTH' },
                { text: BUTTONS.FULL, action: () => ImageLoader.imageActions.full(imgElement), name: 'FULL' },
                {
                    text: BUTTONS.DOWNLOAD,
                    name: 'DOWNLOAD',
                    action: () => {
                        const link = imgElement.closest('a');
                        const originalSrc = imgElement.dataset.originalSrc ||
                            (link ? Utils.handleMediaSrc(link) : null);
                        const downloadIndex = state.originalImageSrcs.findIndex(item => item?.src === originalSrc);
                        if (downloadIndex > -1) {
                            DownloadManager.downloadImageByIndex(downloadIndex);
                        } else {
                            state.notificationType = 'warning';
                            state.notification = 'This image is not in the gallery list yet.';
                        }
                    }
                }
            ]);
        },

        _injectThumbButtonGroups(filesArea, replace) {
            for (const thumbnailDiv of filesArea.querySelectorAll(SELECTORS.FILE_DIVS)) {
                const imgElement = thumbnailDiv.querySelector('img');
                if (!imgElement) continue;
                const existing = thumbnailDiv.querySelector(`.${CSS.BTN_CONTAINER}`);
                if (existing && !replace) continue;
                existing?.remove();

                imgElement.classList.add('post__image');
                const group = PostActions._buildThumbButtonGroup(imgElement);
                if (group.childElementCount > 0) {
                    group.classList.add('ug-injected-ui');
                    thumbnailDiv.prepend(group);
                }
            }
        },

        refreshThumbnailButtonGroups() {
            const filesArea = PostActions._filesArea();
            if (!filesArea) return;
            PostActions._injectThumbButtonGroups(filesArea, true);
            PostActions.updateButtonVisibilityLight();
        },

        updateButtonVisibilityLight() {
            const maps = {
                global: {
                    GALLERY: state.hideGlobalGalleryButton,
                    HEIGHT: state.hideGlobalHeightButton,
                    WIDTH: state.hideGlobalWidthButton,
                    FULL: state.hideGlobalFullButton,
                    DOWNLOAD_ALL: state.hideGlobalDownloadAllButton,
                    DOWNLOAD_IMAGES: state.hideGlobalDownloadImagesButton,
                    DOWNLOAD_ATTACHMENTS: state.hideGlobalDownloadAttachmentsButton
                },
                thumbnail: {
                    HEIGHT: state.hideThumbnailHeightButton,
                    WIDTH: state.hideThumbnailWidthButton,
                    FULL: state.hideThumbnailFullButton,
                    DOWNLOAD: state.hideThumbnailDownloadButton
                }
            };

            for (const btn of document.querySelectorAll(`.${CSS.BTN}[data-action]`)) {
                const map = maps[btn.dataset.scope] || maps.global;
                const action = btn.dataset.action;
                if (Object.hasOwn(map, action)) btn.classList.toggle('ug-hidden', Boolean(map[action]));
            }

            galleryOverlay?.querySelectorAll(`.${CSS.GALLERY.NAV}`).forEach(n => {
                n.classList.toggle('ug-hidden', Boolean(state.hideNavArrows));
            });
        },

        resizeAllImages(action) {
            const fn = ImageLoader.imageActions[action];
            if (!fn) return;
            state.currentResizeMode = action;
            document.querySelectorAll('img.post__image').forEach(img => fn(img));
        },

        resizeImage(action, evt) {
            const fn = ImageLoader.imageActions[action];
            if (!fn) return;
            state.currentResizeMode = action;

            const button = evt.currentTarget;
            const thumbContainer = button.closest('.post__thumbnail, .scrape__thumbnail') ||
                button.closest(`.${CSS.BTN_CONTAINER}`)?.nextElementSibling;
            const displayedImage = thumbContainer?.querySelector('img.post__image');
            if (displayedImage) fn(displayedImage);
        }
    };

    // ====================================================
    // Keyboard & Event Handlers
    // ====================================================
    // True after Tab, false after any pointer press (see focusIsControl).
    let keyboardFocus = false;
    const clearKeyboardFocus = () => { keyboardFocus = false; };

    const EventHandlers = {
        keyMatchesSetting(eventKey, settingValue) {
            return Boolean(settingValue) && String(eventKey).toLowerCase() === String(settingValue).toLowerCase();
        },

        showShortcutHelp() {
            const up = (k) => String(k || '').toUpperCase();
            UGModal.alert(
                'Keyboard Shortcuts',
                `Navigate: \u2190 / \u2192 (or ${up(state.prevImageKey)} / ${up(state.nextImageKey)})  \u00b7  First / Last: Home / End  \u00b7  ` +
                `Zoom: + / \u2212  \u00b7  Reset zoom: 0  \u00b7  Slideshow: Space  \u00b7  Fullscreen: F  \u00b7  ` +
                `Close gallery: Esc  \u00b7  Open/close gallery: ${up(state.galleryKey)}  \u00b7  This help: ?`,
                'info'
            );
        },

        handleResize: Utils.debounce(() => {
            if (galleryOverlay && state.isGalleryMode) {
                PointerEngine.enforceBoundaries();
                ThumbnailStrip.updateScrollIndicators();
            }
        }, 150),

        handleGlobalKeyDown(event) {
            if (!event.key || event.isComposing) return;
            if (event.key === 'Tab') keyboardFocus = true;
            if (UGModal.isOpen()) return;

            // Settings: Esc closes the panel even while an input has focus.
            if (state.settingsOpen) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    state.settingsOpen = false;
                }
                return;
            }

            const activeEl = document.activeElement;
            if (activeEl && (activeEl.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName))) {
                return;
            }

            const keyLower = event.key.toLowerCase();
            const noModifiers = !event.altKey && !event.ctrlKey && !event.metaKey;

            // Cheap key comparison first; the DOM-touching isPostPage() only if it matches.
            if (noModifiers && EventHandlers.keyMatchesSetting(event.key, state.galleryKey) && Utils.isPostPage()) {
                event.preventDefault();
                if (state.galleryReady) {
                    Gallery.toggleGallery();
                } else {
                    state.notificationType = 'info';
                    state.notification = 'Gallery content is still loading.';
                }
                return;
            }

            if (!state.isGalleryMode || !galleryOverlay) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                Gallery.closeGallery();
                return;
            }
            if (!noModifiers) return;

            // Only controls reached with Tab keep their own keys; a control left
            // focused by a mouse click must not swallow ←/→/Space.
            const focusIsControl = Boolean(activeEl) && activeEl !== document.body && keyboardFocus &&
                (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'A' || activeEl.hasAttribute('tabindex'));
            const stripOwnsArrows = focusIsControl &&
                Boolean(activeEl.closest?.(`.${CSS.GALLERY.THUMBNAIL_STRIP}`)) &&
                (keyLower === 'arrowleft' || keyLower === 'arrowright');
            if (stripOwnsArrows || (keyLower === ' ' && focusIsControl)) return;

            if (event.key === '?') {
                event.preventDefault();
                EventHandlers.showShortcutHelp();
                return;
            }

            if (galleryRefs.expandedView?.classList.contains(CSS.GALLERY.HIDE)) return;

            let handled = true;
            if (EventHandlers.keyMatchesSetting(event.key, state.nextImageKey) || keyLower === 'arrowright') {
                Gallery.nextImage();
            } else if (EventHandlers.keyMatchesSetting(event.key, state.prevImageKey) || keyLower === 'arrowleft') {
                Gallery.prevImage();
            } else if (event.key === 'Home') {
                Gallery.showExpandedView(0);
            } else if (event.key === 'End') {
                Gallery.showExpandedView(state.fullSizeImageSrcs.length - 1);
            } else if (keyLower === '+' || keyLower === '=') {
                Zoom.zoom(CONFIG.ZOOM_STEP);
            } else if (keyLower === '-') {
                Zoom.zoom(-CONFIG.ZOOM_STEP);
            } else if (keyLower === '0') {
                Zoom.resetZoom();
            } else if (keyLower === ' ') {
                // Drop mouse-given focus so the button doesn't also fire on key release.
                if (activeEl instanceof HTMLButtonElement) activeEl.blur();
                Slideshow.toggle();
            } else if (keyLower === 'f') {
                Gallery.toggleFullscreen();
            } else {
                handled = false;
            }
            if (handled) event.preventDefault();
        }
    };

    function updateGalleryButton(enabled) {
        const btn = elements.galleryButton;
        if (!btn) return;
        btn.textContent = enabled ? BUTTONS.GALLERY : 'Loading Gallery...';
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
    }

    // ====================================================
    // SPA-Safe Injection & Initialization
    // ====================================================
    const injectUI = () => {
        try {
            // Fragment-only changes (#anchors) are not navigations.
            const currentUrl = location.origin + location.pathname + location.search;
            const postContainer = ImageLoader._findPostContainer();
            const onPostPage = Boolean(postContainer) && Utils.isPostPage();

            if (onPostPage) {
                if (currentUrl !== lastProcessedUrl &&
                    (DOM.$(SELECTORS.POST_ACTIONS) || DOM.$('.post__files') || DOM.$('.post__body'))) {
                    PostActions.cleanupPostActions();
                    PostActions.initPostActions();
                    lastProcessedUrl = currentUrl;
                }
            } else if (lastProcessedUrl !== null) {
                PostActions.cleanupPostActions();
                lastProcessedUrl = null;
            }
        } catch (error) {
            console.error('Error in injectUI:', error);
        }
    };

    const fullCleanup = () => {
        uiObserver?.disconnect();
        uiObserver = null;

        if (galleryOverlay && document.fullscreenElement === galleryOverlay) {
            document.exitFullscreen().catch(() => {});
        }
        ImageLoader.stopLazyLoading();
        ActiveRequests.abortAll();
        ImageLoader._inflight.clear();
        PostActions.cleanupPostActions();
        Gallery._clearPreloadCache();
        DownloadManager.cleanup();
        UI.forceHideNotification();
        ErrorHandler.clearRetries();
        ThumbnailStrip.cleanup();

        document.removeEventListener('keydown', EventHandlers.handleGlobalKeyDown);
        document.removeEventListener('pointerdown', clearKeyboardFocus, true);
        window.removeEventListener('resize', EventHandlers.handleResize);
    };

    // ====================================================
    // Floating Thumbnail Strip Styles
    // Supplement to the external main CSS (pinned @resource), injected
    // AFTER mainCSS so it wins the cascade at equal specificity.
    // ====================================================
    const STRIP_MODE_CSS = `
/* ---- Ultra Galleries: floating thumbnail strip ("higher layer" mode) ---- */
.ug-gallery-overlay.ug-strip-floating .ug-gallery-thumbnail-strip-container {
    left: 16px;
    right: 16px;
    bottom: 14px;
    width: auto;
    height: calc(var(--ug-strip-height, 76px) - 10px);
    border: 1px solid var(--ug-border-strong, rgba(255, 255, 255, 0.12));
    border-radius: var(--ug-radius-lg, 16px);
    box-shadow: var(--ug-shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.45));
    z-index: 30;
    transition:
        transform var(--ug-duration-slow, 400ms) var(--ug-ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
        opacity var(--ug-duration-normal, 250ms) var(--ug-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}

.ug-gallery-overlay.ug-strip-floating .ug-gallery-expanded-view.ug-controls-hidden .ug-gallery-thumbnail-strip-container {
    transform: translateY(calc(100% + 32px));
    opacity: 0;
    pointer-events: none;
}

.ug-gallery-overlay.ug-strip-floating .ug-gallery-nav-container { bottom: 0; }
.ug-gallery-overlay.ug-strip-floating .ug-gallery-counter {
    bottom: calc(var(--ug-strip-height, 76px) + 18px);
}

.ug-strip-toggle.active {
    color: var(--ug-accent, #6f5fff);
    background: var(--ug-accent-subtle, rgba(111, 95, 255, 0.08));
}

@media (max-width: 640px) {
    .ug-gallery-overlay.ug-strip-floating .ug-gallery-thumbnail-strip-container {
        left: 8px;
        right: 8px;
        bottom: 8px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .ug-gallery-overlay.ug-strip-floating .ug-gallery-thumbnail-strip-container { transition: none; }
}
`;

    const addStyle = (css, id) => {
        if (document.getElementById(id)) return;
        const node = GM_addStyle(css);
        node?.setAttribute?.('id', id);
    };

    const migrateLegacySettings = () => {
        if (GM_getValue('hideFullButton') === undefined || GM_getValue('hideThumbnailFullButton') !== undefined) return;
        const pairs = [
            ['hideFullButton', 'hideThumbnailFullButton'],
            ['hideWidthButton', 'hideThumbnailWidthButton'],
            ['hideHeightButton', 'hideThumbnailHeightButton'],
            ['hideDownloadButton', 'hideThumbnailDownloadButton']
        ];
        for (const [from, to] of pairs) {
            SettingsManager.saveSetting(to, SettingsManager.loadSetting(from, false));
        }
    };

    const setupNavigationHooks = (onNavigate) => {
        if ('navigation' in window) {
            // Observe only — never intercept the site's own navigations.
            window.navigation.addEventListener('currententrychange', onNavigate);
            return;
        }
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            history[method] = function (...args) {
                const result = original.apply(this, args);
                onNavigate();
                return result;
            };
        }
        window.addEventListener('popstate', onNavigate);
    };

    const init = () => {
        try {
            const cssText = GM_getResourceText('mainCSS');
            if (cssText) {
                const styleNode = GM_addStyle(cssText);
                styleNode?.setAttribute?.('data-keep', '');
            } else {
                console.warn('Ultra Galleries: Failed to load main CSS resource.');
            }
            addStyle(STRIP_MODE_CSS, 'ug-strip-mode-style');

            migrateLegacySettings();
            Object.assign(state, SettingsManager.loadAllSettings());
            Slideshow.init();
            document.body.classList.toggle('ug-animations-disabled', !state.animationsEnabled);
            updateButtonLabels();

            if (state.enablePersistentCaching) ImageCacheDB.init().catch(() => {});

            document.addEventListener('keydown', EventHandlers.handleGlobalKeyDown);
            document.addEventListener('pointerdown', clearKeyboardFocus, true);
            window.addEventListener('resize', EventHandlers.handleResize, { passive: true });
            // pagehide instead of beforeunload: keeps the page eligible for the
            // back/forward cache, and skips teardown when it's being cached.
            window.addEventListener('pagehide', (e) => { if (!e.persisted) fullCleanup(); });

            let galleryWasNativeFullscreen = false;
            document.addEventListener('fullscreenchange', () => {
                const isGalleryNative = Boolean(galleryOverlay) && document.fullscreenElement === galleryOverlay;
                if (galleryWasNativeFullscreen && !isGalleryNative && state.isFullscreen) {
                    state.isFullscreen = false;
                }
                galleryWasNativeFullscreen = isGalleryNative;
            });

            const debouncedInject = Utils.debounce(injectUI, 150);
            setupNavigationHooks(debouncedInject);

            const UG_ROOT_SELECTOR = '.ug-gallery-overlay, #ug-settings-overlay, .ug-notification-area, .ug-modal-overlay, .ug-injected-ui, .ug-thumbnail-context-menu, .ug-thumbnail-zoom-preview, .settings-button-wrapper, #ug-dl-cancel';
            const POST_CONTENT_SELECTOR = '.post__files, .scrape__files, article, .post__body';

            uiObserver = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.target?.closest?.(UG_ROOT_SELECTOR)) continue;
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== Node.ELEMENT_NODE) continue;
                        if (node.matches(UG_ROOT_SELECTOR)) continue;
                        if (node.matches(POST_CONTENT_SELECTOR) ||
                            node.querySelector('a.fileThumb, .post__thumbnail, .scrape__thumbnail')) {
                            debouncedInject();
                            return;
                        }
                    }
                }
            });
            uiObserver.observe(document.body, { childList: true, subtree: true });

            injectUI();
        } catch (error) {
            console.error('Error in init:', error);
        }
    };

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
