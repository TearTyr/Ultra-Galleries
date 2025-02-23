// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.3.5
// @description  Modern image gallery with enhanced browsing, fullscreen, and download features, now with thumbnail grid UI and zoom.
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

	// --- Utility Functions ---
	const getExtension = (filename) => filename.split('.').pop().toLowerCase() || 'jpg';
	const sanitizeFileName = (name) => name.replace(/[/\\:*?"<>|]/g, '-');
	const setImageStyle = (img, styles) => {
		if (img) {
			Object.assign(img.style, styles);
		}
	};

	// --- CSS Injection ---
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

	// --- Constants ---
	const website = window.location.hostname.split('.')[0];

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

	const CLASS_NAMES = {
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
		//PREV_BUTTON: 'navigation-button prev', // Removed - used directly in createNavigationButton
		//NEXT_BUTTON: 'navigation-button next', // Removed - used directly in createNavigationButton
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
		THUMBNAIL_PREVIEW: 'ug-thumbnail-preview', // Keep for now, in case we re-add previews
		UG_GALLERY_THUMBNAIL: 'ug-gallery-thumbnail',
		UG_GALLERY_THUMBNAIL_GRID_CONTAINER: 'ug-gallery-thumbnail-grid-container',
		UG_GALLERY_THUMBNAIL_GRID: 'ug-gallery-thumbnail-grid',
		UG_GALLERY_EXPANDED_MEDIA: 'ug-gallery-expanded-media',
		//BOTTOM_STRIPE: 'ug-bottom-stripe', // Removed - No longer a separate element
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
		UG_CONTROLS_HIDDEN_CLASS: 'ug-controls-hidden', // Class to hide controls
		UG_GRABBING_CURSOR: 'ug-grabbing', // Class for grabbing cursor
		//UG_BOTTOM_STRIPE_CONTAINER: 'ug-bottom-stripe-container', // Removed - No longer needed
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
		UG_GALLERY_NAV_CONTAINER: 'ug-gallery-nav-container', // Container for nav buttons
	};

	const MAX_RETRIES = 3;
	const RETRY_DELAY = 1500;
	const IMAGE_BATCH_SIZE = 5;

	// --- State Management ---
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
		bottomStripeVisible: true, // Keep this, but it now controls only the thumbnail strip
		dynamicResizing: GM_getValue('dynamicResizing', true),
		zoomEnabled: GM_getValue('zoomEnabled', true),
		isZoomed: false,
		zoomScale: 1,
		controlsVisible: true,
		isDragging: false,
		dragStartPosition: {
			x: 0,
			y: 0
		},
		imageOffset: {
			x: 0,
			y: 0
		},
		lastWidth: 0,
		lastHeight: 0,
		zoomOrigin: {
			x: 0,
			y: 0
		},
	}, {
		controlsVisible: (value) => {
			const toolbar = galleryOverlay?.querySelector(`.${CLASS_NAMES.UG_GALLERY_TOOLBAR}`);
			if (toolbar) toolbar.classList.toggle(CLASS_NAMES.UG_CONTROLS_HIDDEN_CLASS, !value);
		},
		galleryReady: (value) => {
			if (value) {
				updateGalleryButton(true);
			} else {
				updateGalleryButton(false);
			}
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
					showLoadingOverlay(state.loadingMessage);
				}
			} else if (!value && oldValue) {
				hideLoadingOverlay();
			}
		},
		loadingMessage: (value) => {
			if (state.isLoading && (state.galleryActive || state.isDownloading)) {
				updateLoadingOverlayText(value);
			}
		},
		hasImages: (value) => {
			if (elements.galleryButton) {
				elements.galleryButton.style.display = value ? 'inline-block' : 'none';
			}
		},
		isGalleryMode: (value) => {
			// Now toggleGallery handles gallery creation and destruction
		},
		notification: (value) => {
			if (value) {
				showNotification(value, state.notificationType);
			} else {
				hideNotification();
			}
		},
		settingsOpen: (value) => {
			if (value) {
				showSettings();
			} else {
				closeSettings();
			}
		},
		isFullscreen: (value) => {
			GM_setValue('isFullscreen', value);
			if (galleryOverlay) {
				if (value) {
					document.body.classList.add('ug-fullscreen');
					galleryOverlay.classList.add('ug-fullscreen-overlay');
				} else {
					document.body.classList.remove('ug-fullscreen');
					galleryOverlay.classList.remove('ug-fullscreen-overlay');
				}
			}
		},
		zoomEnabled: (value) => {
			GM_setValue('zoomEnabled', value);
		},
		bottomStripeVisible: (value) => { // Added update callback
			GM_setValue('bottomStripeVisible', value);
			if (galleryOverlay) {
				const thumbnailStripContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_THUMBNAIL_STRIP_CONTAINER}`);
				if (thumbnailStripContainer) {
					thumbnailStripContainer.style.display = value ? 'flex' : 'none';
				}
			}
		},
		zoomScale: (value, oldValue) => {
			applyZoom(); // Re-apply the transform whenever zoomScale changes
		},
		imageOffset: (value, oldValue) => {
			applyZoom(); // Re-apply the transform whenever imageOffset changes
		},
	});

	// --- Zoom & Pan Variables ---
	let scale = 1;
	let translateX = 0;
	let translateY = 0;
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let isTransformPending = false; // Flag to control requestAnimationFrame

	const minScale = 0.5;
	const maxScale = 5; // Increased maxScale slightly
	const zoomSensitivity = 0.1;
	const zoomStep = 0.2;
	const throttleInterval = 16; // milliseconds
	let lastMouseMoveTime = 0;

	// --- Zoom & Pan Functions ---
	function updateTransform() {
		if (!isTransformPending && galleryOverlay) { // Check if galleryOverlay exists
			isTransformPending = true;
			requestAnimationFrame(() => {
				const imageContainerElement = galleryOverlay.querySelector('.image-container'); // Get element within current gallery
				const zoomLevelDisplayElement = galleryOverlay.querySelector('#zoom-level'); // Get element within current gallery
				if (imageContainerElement && zoomLevelDisplayElement) { // Check if elements are found
					imageContainerElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
					zoomLevelDisplayElement.textContent = `${Math.round(scale * 100)}%`;
				}
				isTransformPending = false;
			});
		}
	}

	function zoom(zoomFactor, pointX, pointY) {
		let newScale = scale + zoomFactor * zoomSensitivity;
		newScale = Math.max(minScale, Math.min(newScale, maxScale));

		if (newScale !== scale) {
			const preZoomMouseX = (pointX - translateX) / scale;
			const preZoomMouseY = (pointY - translateY) / scale;

			scale = newScale;

			translateX = pointX - (preZoomMouseX * scale);
			translateY = pointY - (preZoomMouseY * scale);

			updateTransform();
		}
	}

	// --- Refactored handleWheelZoom (adapted for userscript context) ---
	const handleWheelZoom = (event) => {
		if (!state.zoomEnabled || !galleryOverlay) return; // Check galleryOverlay
		event.preventDefault();
		event.stopPropagation();

		const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		const mainImage = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE}`);
		if (!mainImage || !mainImageContainer) return;

		// Get bounding rect relative to viewport
		const containerRect = mainImageContainer.getBoundingClientRect();

		// Mouse position relative to container
		const mouseX = event.clientX - containerRect.left;
		const mouseY = event.clientY - containerRect.top;

		// Calculate zoom direction and clamp scale
		const delta = Math.sign(event.deltaY) * -0.1;
		const newZoomScale = Math.max(1, Math.min(state.zoomScale + delta, maxScale)); // Increased max zoom to 5

		// Calculate image position relative to original image
		const imageX = (mouseX - translateX) / state.zoomScale;
		const imageY = (mouseY - translateY) / state.zoomScale;

		// Calculate new offset to keep zoom centered
		const newOffsetX = mouseX - (imageX * newZoomScale);
		const newOffsetY = mouseY - (imageY * newZoomScale);

		// Apply boundaries
		const boundedOffset = enforceBoundaries(newOffsetX, newOffsetY, newZoomScale, containerRect, mainImage);

		// Update state
		state.imageOffset.x = boundedOffset.x;
		state.imageOffset.y = boundedOffset.y;
		state.zoomScale = newZoomScale;

		// Smooth transition
		mainImageContainer.style.transition = 'transform 0.1s ease-out';
		setTimeout(() => mainImageContainer.style.transition = '', 100);
	};

	// --- Boundary Enforcement Function ---
	const enforceBoundaries = (offsetX, offsetY, scale, containerRect, image) => {
		const imgWidth = image.naturalWidth * scale;
		const imgHeight = image.naturalHeight * scale;
		const containerWidth = containerRect.width;
		const containerHeight = containerRect.height;

		const maxX = Math.max(0, (imgWidth - containerWidth) / 2);
		const maxY = Math.max(0, (imgHeight - containerHeight) / 2);

		const minX = -maxX;
		const minY = -maxY;

		// Clamp the offset values
		const boundedX = Math.max(minX, Math.min(maxX, offsetX));
		const boundedY = Math.max(minY, Math.min(maxY, offsetY));

		return {
			x: boundedX,
			y: boundedY
		};
	};

	// --- Improved Drag Handling (adapted for userscript context) ---
	const startDrag = (event) => {
		if (state.zoomScale <= 1 || !galleryOverlay) return; // Check galleryOverlay
		state.isDragging = true;

		const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		if (!mainImageContainer) return; // Prevent errors
		mainImageContainer.style.cursor = 'grabbing';
		mainImageContainer.style.transition = 'none';

		// Store initial positions with current offset
		state.dragStartPosition = {
			x: event.clientX - state.imageOffset.x,
			y: event.clientY - state.imageOffset.y
		};
	};

	const dragImage = (event) => {
		if (!state.isDragging || !galleryOverlay) return; // Check galleryOverlay

		const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		if (!mainImageContainer) return; // Prevent errors
		const containerRect = mainImageContainer.getBoundingClientRect();
		const mainImage = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE}`);

		// Calculate new offset based on drag
		const newX = event.clientX - state.dragStartPosition.x;
		const newY = event.clientY - state.dragStartPosition.y;

		// Apply boundaries
		const boundedOffset = enforceBoundaries(newX, newY, state.zoomScale, containerRect, mainImage);

		state.imageOffset.x = boundedOffset.x;
		state.imageOffset.y = boundedOffset.y;
	};

	const endDrag = () => {
		if (!state.isDragging || !galleryOverlay) return; // Check galleryOverlay
		state.isDragging = false;

		const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		if (!mainImageContainer) return; // Prevent errors
		mainImageContainer.style.cursor = 'grab';
		mainImageContainer.style.transition = 'transform 0.3s ease-out';
	};

	const resetZoom = () => {
		state.zoomScale = 1;
		state.imageOffset = {
			x: 0,
			y: 0
		};
		const mainImageContainer = galleryOverlay?.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		if (mainImageContainer) {
			mainImageContainer.style.transform = `translate(0px, 0px) scale(1)`;
		}
		updateTransform(); // Ensure zoom level display updates immediately
	};

	// --- Settings ---  (This section remains largely the same, just updating for the removed zoom settings)
	const createSettingsUI = () => {
		const settingsOverlay = document.createElement('div');
		settingsOverlay.id = 'ug-settings-overlay';
		settingsOverlay.classList.add(CLASS_NAMES.UG_SETTINGS_OVERLAY);

		const settingsContainer = document.createElement('div');
		settingsContainer.classList.add(CLASS_NAMES.UG_SETTINGS_CONTAINER);
		settingsOverlay.appendChild(settingsContainer);

		const settingsHeader = document.createElement('div');
		settingsHeader.classList.add(CLASS_NAMES.UG_SETTINGS_HEADER);
		settingsContainer.appendChild(settingsHeader);

		const headerText = document.createElement('h2');
		headerText.textContent = 'Ultra Galleries Settings';
		settingsHeader.appendChild(headerText);

		const closeButton = document.createElement('button');
		closeButton.classList.add(CLASS_NAMES.UG_SETTINGS_CLOSE_BTN);
		closeButton.textContent = BUTTONS.CLOSE;
		closeButton.addEventListener('click', () => state.settingsOpen = false);
		settingsHeader.appendChild(closeButton);

		const settingsBody = document.createElement('div');
		settingsBody.classList.add(CLASS_NAMES.UG_SETTINGS_BODY);
		settingsContainer.appendChild(settingsBody);

		const sectionGeneral = document.createElement('div');
		sectionGeneral.classList.add(CLASS_NAMES.UG_SETTINGS_SECTION);
		sectionGeneral.innerHTML = `<h3 class="${CLASS_NAMES.UG_SETTINGS_SECTION_HEADER}">General Settings</h3>`;
		settingsBody.appendChild(sectionGeneral);

		const sectionKeys = document.createElement('div');
		sectionKeys.classList.add(CLASS_NAMES.UG_SETTINGS_SECTION);
		sectionKeys.innerHTML = `<h3 class="${CLASS_NAMES.UG_SETTINGS_SECTION_HEADER}">Keyboard Shortcuts</h3>`;
		settingsBody.appendChild(sectionKeys);

		const sectionNotifications = document.createElement('div');
		sectionNotifications.classList.add(CLASS_NAMES.UG_SETTINGS_SECTION);
		sectionNotifications.innerHTML = `<h3 class="${CLASS_NAMES.UG_SETTINGS_SECTION_HEADER}">Notifications</h3>`;
		settingsBody.appendChild(sectionNotifications);

		const sectionFormatting = document.createElement('div');
		sectionFormatting.classList.add(CLASS_NAMES.UG_SETTINGS_SECTION);
		sectionFormatting.innerHTML = `<h3 class="${CLASS_NAMES.UG_SETTINGS_SECTION_HEADER}">File Formatting</h3>`;
		settingsBody.appendChild(sectionFormatting);

		// --- General Settings ---
		// Dynamic Resizing Toggle
		const dynamicResizingLabel = document.createElement('div');
		dynamicResizingLabel.classList.add(CLASS_NAMES.UG_SETTINGS_CHECKBOX_LABEL);
		dynamicResizingLabel.innerHTML = `<input type="checkbox" id="dynamicResizingToggle" ${state.dynamicResizing ? 'checked' : ''} class="${CLASS_NAMES.UG_SETTINGS_INPUT}"> <label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="dynamicResizingToggle">Dynamic Resizing</label>`;
		dynamicResizingLabel.querySelector('input').addEventListener('change', (e) => {
			state.dynamicResizing = e.target.checked;
			GM_setValue('dynamicResizing', state.dynamicResizing);
		});
		sectionGeneral.appendChild(dynamicResizingLabel);

		// Animations Toggle
		const animationsLabel = document.createElement('div');
		animationsLabel.classList.add(CLASS_NAMES.UG_SETTINGS_CHECKBOX_LABEL);
		animationsLabel.innerHTML = `<input type="checkbox" id="animationsToggle" ${state.animationsEnabled ? 'checked' : ''} class="${CLASS_NAMES.UG_SETTINGS_INPUT}"> <label class="${CLASS_NAMES.UG_SETTINGS_label}" for="animationsToggle">Enable Animations</label>`;
		animationsLabel.querySelector('input').addEventListener('change', (e) => {
			state.animationsEnabled = e.target.checked;
			GM_setValue('animationsEnabled', state.animationsEnabled);
		});
		sectionGeneral.appendChild(animationsLabel);

		// Bottom Stripe Visibility Toggle (now only controls thumbnail strip)
		const bottomStripeLabel = document.createElement('div');
		bottomStripeLabel.classList.add(CLASS_NAMES.UG_SETTINGS_CHECKBOX_LABEL);
		bottomStripeLabel.innerHTML = `<input type="checkbox" id="bottomStripeToggle" ${state.bottomStripeVisible ? 'checked' : ''} class="${CLASS_NAMES.UG_SETTINGS_INPUT}"> <label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="bottomStripeToggle">Show Thumbnail Strip</label>`;
		bottomStripeLabel.querySelector('input').addEventListener('change', (e) => {
			state.bottomStripeVisible = e.target.checked; // This will now trigger the update callback
		});
		sectionGeneral.appendChild(bottomStripeLabel);

		// Zoom Enable Toggle
		const zoomEnabledLabel = document.createElement('div');
		zoomEnabledLabel.classList.add(CLASS_NAMES.UG_SETTINGS_CHECKBOX_LABEL);
		zoomEnabledLabel.innerHTML = `<input type="checkbox" id="zoomEnabledToggle" ${state.zoomEnabled ? 'checked' : ''} class="${CLASS_NAMES.UG_SETTINGS_INPUT}"> <label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="zoomEnabledToggle">Enable Zoom & Pan</label>`;
		zoomEnabledLabel.querySelector('input').addEventListener('change', (e) => {
			state.zoomEnabled = e.target.checked;
			GM_setValue('zoomEnabled', state.zoomEnabled);
		});
		sectionGeneral.appendChild(zoomEnabledLabel);

		// --- Keyboard Shortcuts ---
		const galleryKeyLabel = document.createElement('div');
		galleryKeyLabel.classList.add(CLASS_NAMES.UG_SETTINGS_LABEL);
		galleryKeyLabel.innerHTML = `<label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="galleryKeyInput">Gallery Key:</label> <input type="text" id="galleryKeyInput" value="${state.galleryKey}" maxlength="1" style="width: 2em;" class="${CLASS_NAMES.UG_SETTINGS_INPUT}">`;
		galleryKeyLabel.querySelector('input').addEventListener('change', (e) => {
			state.galleryKey = e.target.value;
			GM_setValue('galleryKey', state.galleryKey);
		});
		sectionKeys.appendChild(galleryKeyLabel);

		const prevImageKeyLabel = document.createElement('div');
		prevImageKeyLabel.classList.add(CLASS_NAMES.UG_SETTINGS_LABEL);
		prevImageKeyLabel.innerHTML = `<label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="prevImageKeyInput">Previous Image Key:</label> <input type="text" id="prevImageKeyInput" value="${state.prevImageKey}" maxlength="1" style="width: 2em;" class="${CLASS_NAMES.UG_SETTINGS_INPUT}">`;
		prevImageKeyLabel.querySelector('input').addEventListener('change', (e) => {
			state.prevImageKey = e.target.value;
			GM_setValue('prevImageKey', state.prevImageKey);
		});
		sectionKeys.appendChild(prevImageKeyLabel);

		const nextImageKeyLabel = document.createElement('div');
		nextImageKeyLabel.classList.add(CLASS_NAMES.UG_SETTINGS_LABEL);
		nextImageKeyLabel.innerHTML = `<label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="nextImageKeyInput">Next Image Key:</label> <input type="text" id="nextImageKeyInput" value="${state.nextImageKey}" maxlength="1" style="width: 2em;" class="${CLASS_NAMES.UG_SETTINGS_INPUT}">`;
		nextImageKeyLabel.querySelector('input').addEventListener('change', (e) => {
			state.nextImageKey = e.target.value;
			GM_setValue('nextImageKey', state.nextImageKey);
		});
		sectionKeys.appendChild(nextImageKeyLabel);

		// --- Notifications Settings ---
		const notificationsEnabledLabel = document.createElement('div');
		notificationsEnabledLabel.classList.add(CLASS_NAMES.UG_SETTINGS_CHECKBOX_LABEL);
		notificationsEnabledLabel.innerHTML = `<input type="checkbox" id="notificationsEnabledToggle" ${state.notificationsEnabled ? 'checked' : ''} class="${CLASS_NAMES.UG_SETTINGS_INPUT}"> <label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="notificationsEnabledToggle">Enable Notifications</label>`;
		notificationsEnabledLabel.querySelector('input').addEventListener('change', (e) => {
			state.notificationsEnabled = e.target.checked;
			GM_setValue('notificationsEnabled', state.notificationsEnabled);
		});
		sectionNotifications.appendChild(notificationsEnabledLabel);

		const notificationAreaVisibleLabel = document.createElement('div');
		notificationAreaVisibleLabel.classList.add(CLASS_NAMES.UG_SETTINGS_CHECKBOX_LABEL);
		notificationAreaVisibleLabel.innerHTML = `<input type="checkbox" id="notificationAreaVisibleToggle" ${state.notificationAreaVisible ? 'checked' : ''} class="${CLASS_NAMES.UG_SETTINGS_INPUT}"> <label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="notificationAreaVisibleToggle">Show Notification Area</label>`;
		notificationAreaVisibleLabel.querySelector('input').addEventListener('change', (e) => {
			state.notificationAreaVisible = e.target.checked;
			GM_setValue('notificationAreaVisible', state.notificationAreaVisible);
			const notificationArea = document.getElementById(CLASS_NAMES.NOTIFICATION_AREA);
			if (notificationArea) {
				notificationArea.style.display = state.notificationAreaVisible ? 'flex' : 'none';
			}
		});
		sectionNotifications.appendChild(notificationAreaVisibleLabel);

		// --- File Formatting Settings ---
		const zipFileNameFormatLabel = document.createElement('div');
		zipFileNameFormatLabel.classList.add(CLASS_NAMES.UG_SETTINGS_LABEL);
		zipFileNameFormatLabel.innerHTML = `<label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="zipFileNameFormatInput">Zip File Name Format:</label> <input type="text" id="zipFileNameFormatInput" value="${state.zipFileNameFormat}" style="width: 100%;" class="${CLASS_NAMES.UG_SETTINGS_INPUT}">`;
		zipFileNameFormatLabel.querySelector('input').addEventListener('change', (e) => {
			state.zipFileNameFormat = e.target.value;
			GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
		});
		sectionFormatting.appendChild(zipFileNameFormatLabel);

		const imageFileNameFormatLabel = document.createElement('div');
		imageFileNameFormatLabel.classList.add(CLASS_NAMES.UG_SETTINGS_LABEL);
		imageFileNameFormatLabel.innerHTML = `<label class="${CLASS_NAMES.UG_SETTINGS_LABEL}" for="imageFileNameFormatInput">Image File Name Format:</label> <input type="text" id="imageFileNameFormatInput" value="${state.imageFileNameFormat}" style="width: 100%;" class="${CLASS_NAMES.UG_SETTINGS_INPUT}">`;
		imageFileNameFormatLabel.querySelector('input').addEventListener('change', (e) => {
			state.imageFileNameFormat = e.target.value;
			GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
		});
		sectionFormatting.appendChild(imageFileNameFormatLabel);

		document.body.appendChild(settingsOverlay);
	};

	const showSettings = () => {
		createSettingsUI();
		const overlay = document.getElementById('ug-settings-overlay');
		if (overlay) {
			overlay.classList.remove('closing');
			overlay.classList.add('opening');
			overlay.style.width = '100%';
			overlay.style.height = '100%';
		}
	};

	const closeSettings = () => {
		const overlay = document.getElementById('ug-settings-overlay');
		if (overlay) {
			overlay.classList.add('closing');
			setTimeout(() => {
				overlay.remove();
			}, 300);
		}
	};

	// --- UI Element Creation Functions ---
	const createToggleButton = (name, action, disabled = false) => {
		const toggle = document.createElement('a');
		toggle.textContent = name;
		toggle.addEventListener('click', action);
		toggle.style.cursor = 'pointer';
		toggle.classList.add(CLASS_NAMES.UG_BUTTON);
		if (disabled) {
			toggle.disabled = true;
			toggle.classList.add('disabled');
		}
		return toggle;
	};

	const createLoadingOverlay = (text = 'Loading...') => {
		const overlay = document.createElement('div');
		overlay.className = CLASS_NAMES.LOADING_OVERLAY;
		const loadingText = document.createElement('div');
		loadingText.textContent = text;
		overlay.appendChild(loadingText);
		return overlay;
	};

	const createStatusElement = () => {
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
	};

	const createButtonGroup = (buttonsConfig) => {
		const newDiv = document.createElement('div');
		newDiv.classList.add(CLASS_NAMES.UG_BUTTON_CONTAINER);
		buttonsConfig.forEach(config => {
			if ((config.name === 'REMOVE' && state.hideRemoveButton) ||
				(config.name === 'FULL' && state.hideFullButton) ||
				(config.name === 'DOWNLOAD' && state.hideDownloadButton)) return;

			const button = createToggleButton(config.text, config.action);
			newDiv.append(button);
			button.classList.add(CLASS_NAMES.UG_BUTTON);
		});
		return newDiv;
	};

	// Simplified Navigation Button Creation
	const createNavigationButton = (direction) => {
		const button = document.createElement('button');
		button.textContent = direction === 'prev' ? '←' : '→';
		button.className = `${CLASS_NAMES.UG_GALLERY_NAV} ${direction === 'prev' ? CLASS_NAMES.UG_GALLERY_PREV : CLASS_NAMES.UG_GALLERY_NEXT}`; // Directly apply classes
		button.addEventListener('click', direction === 'prev' ? prevImage : nextImage);
		button.setAttribute('aria-label', direction === 'prev' ? 'Previous Image' : 'Next Image');
		return button;
	};


	// --- Image Loading Functions ---
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

	const imageActions = {
		height: (img) => setImageStyle(img, {
			maxHeight: '100vh',
			maxWidth: '100%',
			width: 'auto',
			height: 'auto'
		}),
		width: (img) => setImageStyle(img, {
			maxHeight: '100%',
			maxWidth: '100vw',
			width: 'auto',
			height: 'auto'
		}),
		full: (img) => setImageStyle(img, {
			maxHeight: 'none',
			maxWidth: 'none',
			height: 'auto',
			width: 'auto'
		}),
	};

	const handleMediaSrc = (mediaLink) => {
		const fileThumbDiv = mediaLink.querySelector('.fileThumb');
		return fileThumbDiv?.getAttribute('href')?.split('?')[0] || mediaLink.getAttribute('href')?.split('?')[0] || null;
	};

	const simulateScrollDown = async () => {
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
			await new Promise(resolve => setTimeout(resolve, 250));
		};
		window.scrollTo(0, originalScrollPosition);
	};


	const loadImage = async (mediaLink, index) => {
		try {
			const mediaSrc = handleMediaSrc(mediaLink);
			if (!mediaSrc) {
				console.warn(`Skipping media at index ${index} due to undefined mediaSrc.`, mediaLink);
				state.loadedImages++;
				state.virtualGallery[index] = null;
				return;
			}
			state.fullSizeImageSrcs[index] = mediaSrc;
			const img = mediaLink.querySelector('img');

			if (img) {
				await new Promise((resolve, reject) => {
					GM.xmlHttpRequest({
						method: 'GET',
						url: mediaSrc,
						responseType: 'blob',
						onload: function(response) {
							if (response.status === 200 || response.status === 206) {
								const blobUrl = URL.createObjectURL(response.response);
								img.src = blobUrl;
								img.dataset.originalSrc = blobUrl;
								imageActions.height(img);
								img.onload = () => {
									state.loadedImages++;
									state.mediaLoaded[index] = true;
									mediaLink.classList.add(CLASS_NAMES.NO_CLICK);
									resolve();
								};
								img.onerror = () => handleImageError(mediaSrc, reject);
							} else {
								handleImageFetchError(mediaSrc, response.status, reject);
							}
						},
						onerror: (error) => {
							handleImageFetchError(mediaSrc, 'Error', reject, error);
						},
					});
				});
			}
			state.virtualGallery[index] = mediaSrc;
		} catch (error) {
			handleGeneralImageLoadError(mediaLink.href, error);
		}
	};

	const loadImages = async () => {
		if (!isPostPage() || state.galleryReady || state.isLoading) return;

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

		await simulateScrollDown();

		const batchSize = IMAGE_BATCH_SIZE;
		for (let i = 0; i < mediaLinks.length; i += batchSize) {
			const batchPromises = [];
			for (let j = 0; j < batchSize && i + j < mediaLinks.length; j++) {
				batchPromises.push(loadImage(mediaLinks[i + j], i + j));
			}
			await Promise.all(batchPromises);
		}

		if (state.loadedImages === state.totalImages && state.virtualGallery.every((item) => item === null)) {
			state.notification = 'Error loading some media.';
			state.notificationType = 'error';
		}

		createVirtualGallery();
		state.galleryReady = true;
		state.isLoading = false;
		state.loadingMessage = null;
	};

	const createVirtualGallery = () => {
		cleanupVirtualGallery();
		elements.virtualGalleryContainer = document.createElement('div');
		elements.virtualGalleryContainer.style.display = 'none';
		state.virtualGallery.forEach((mediaSrc) => {
			if (mediaSrc) {
				const mediaElement = document.createElement('img');
				mediaElement.src = mediaSrc;
				mediaElement.className = CLASS_NAMES.VIRTUAL_IMAGE;
				elements.virtualGalleryContainer.appendChild(mediaElement);
			}

		});
		document.body.appendChild(elements.virtualGalleryContainer);
	};

	const cleanupVirtualGallery = () => {
		if (elements.virtualGalleryContainer) {
			elements.virtualGalleryContainer.remove();
			elements.virtualGalleryContainer = null;
		}
		state.galleryReady = false;
	};

	let galleryOverlay = null;

	const createGallery = () => {
		if (galleryOverlay) return;

		galleryOverlay = document.createElement('div');
		galleryOverlay.id = 'gallery-overlay';
		galleryOverlay.classList.add('ug-gallery-overlay');

		const galleryContainer = document.createElement('div');
		galleryContainer.classList.add('ug-gallery-container');
		galleryOverlay.appendChild(galleryContainer);

		const gridView = document.createElement('div');
		gridView.classList.add(CLASS_NAMES.UG_GALLERY_GRID_VIEW);
		galleryContainer.appendChild(gridView);

		const expandedView = document.createElement('div');
		expandedView.classList.add(CLASS_NAMES.UG_GALLERY_EXPANDED_VIEW, CLASS_NAMES.UG_GALLERY_HIDE);
		galleryContainer.appendChild(expandedView);

		// Toolbar for expanded view
		const toolbar = document.createElement('div');
		toolbar.classList.add(CLASS_NAMES.UG_GALLERY_TOOLBAR);
		expandedView.appendChild(toolbar);
		toolbar.addEventListener('mousedown', (e) => e.stopPropagation());

		const expandedCloseButton = document.createElement('button');
		expandedCloseButton.classList.add(CLASS_NAMES.UG_TOOLBAR_BUTTON);
		expandedCloseButton.textContent = BUTTONS.CLOSE;
		expandedCloseButton.addEventListener('click', showGridView);
		expandedCloseButton.setAttribute('aria-label', 'Close Expanded View');
		toolbar.appendChild(expandedCloseButton);

		// ** --- Zoom Controls Container --- **
		const zoomControlsContainer = document.createElement('div');
		zoomControlsContainer.classList.add('zoom-controls'); // Add class for styling
		toolbar.appendChild(zoomControlsContainer);

		const zoomOutBtn = document.createElement('button');
		zoomOutBtn.id = 'zoom-out-btn';
		zoomOutBtn.title = 'Zoom Out';
		zoomOutBtn.classList.add(CLASS_NAMES.UG_TOOLBAR_BUTTON); // Apply toolbar button style
		zoomOutBtn.innerHTML = '<img src="https://www.svgrepo.com/show/263638/zoom-out-search.svg" alt="Zoom Out">'; // Icon
		zoomOutBtn.addEventListener('click', () => {
			if (galleryOverlay) { // Check if galleryOverlay exists
				const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
				if (mainImageContainer) {
					zoom(-zoomStep, mainImageContainer.offsetWidth / 2, mainImageContainer.offsetHeight / 2); // Zoom out center
				}
			}
		});
		zoomControlsContainer.appendChild(zoomOutBtn);

		const zoomLevelDisplay = document.createElement('span');
		zoomLevelDisplay.id = 'zoom-level';
		zoomLevelDisplay.classList.add('zoom-level'); // Add class for styling
		zoomLevelDisplay.textContent = '100%';
		zoomControlsContainer.appendChild(zoomLevelDisplay);

		const zoomInBtn = document.createElement('button');
		zoomInBtn.id = 'zoom-in-btn';
		zoomInBtn.title = 'Zoom In';
		zoomInBtn.classList.add(CLASS_NAMES.UG_TOOLBAR_BUTTON);
		zoomInBtn.innerHTML = '<img src="https://www.svgrepo.com/show/263635/zoom-in.svg" alt="Zoom In">';
		// **Modified Event Listener:**
		zoomInBtn.addEventListener('click', () => {
			if (galleryOverlay) { // Check if galleryOverlay exists
				const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
				if (mainImageContainer) {
					zoom(zoomStep, mainImageContainer.offsetWidth / 2, mainImageContainer.offsetHeight / 2); // Zoom in center
				}
			}
		});
		zoomControlsContainer.appendChild(zoomInBtn);

		const resetZoomBtn = document.createElement('button');
		resetZoomBtn.id = 'reset-btn';
		resetZoomBtn.title = 'Reset Zoom & Position';
		resetZoomBtn.classList.add(CLASS_NAMES.UG_TOOLBAR_BUTTON);
		resetZoomBtn.textContent = 'Reset';
		// **Modified Event Listener:**
		resetZoomBtn.addEventListener('click', resetZoom);
		zoomControlsContainer.appendChild(resetZoomBtn);
		// ** --- End Zoom Controls Container --- **


		const thumbnailGrid = document.createElement('div');
		thumbnailGrid.classList.add(CLASS_NAMES.UG_GALLERY_THUMBNAIL_GRID);
		gridView.appendChild(thumbnailGrid);

		// ** --- Main Image Container (with image-container class) --- **
		const expandedZoomContainer = document.createElement('div');
		expandedZoomContainer.classList.add(CLASS_NAMES.UG_GALLERY_ZOOM_CONTAINER);
		expandedView.appendChild(expandedZoomContainer);

		const mainImageContainer = document.createElement('div');
		mainImageContainer.classList.add(CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER, 'image-container'); // **Added 'image-container' class here**
		expandedZoomContainer.appendChild(mainImageContainer);
		mainImageContainer.addEventListener('wheel', handleWheelZoom, {
			passive: false
		});

		// Smooth Panning
		mainImageContainer.addEventListener('mousedown', startDrag);
		document.addEventListener('mousemove', dragImage);
		document.addEventListener('mouseup', endDrag);
		document.addEventListener('mouseleave', endDrag);


		const mainImage = document.createElement('img');
		mainImage.classList.add(CLASS_NAMES.UG_MAIN_IMAGE, CLASS_NAMES.UG_GALLERY_ZOOM_IMAGE, 'gallery-image'); // **Added 'gallery-image' class here**
		mainImageContainer.appendChild(mainImage);
		// ** --- End Main Image Container --- **


		const navContainer = document.createElement('div');
		navContainer.classList.add(CLASS_NAMES.UG_GALLERY_NAV_CONTAINER);
		expandedView.appendChild(navContainer); // Directly in expandedView
		navContainer.addEventListener('mousedown', (e) => e.stopPropagation());

		const prevButton = createNavigationButton('prev'); // Use the simplified function
		navContainer.appendChild(prevButton);

		const nextButton = createNavigationButton('next'); // Use the simplified function
		navContainer.appendChild(nextButton);

		const fullscreenButton = document.createElement('button');
		fullscreenButton.textContent = BUTTONS.FULLSCREEN;
		fullscreenButton.classList.add(CLASS_NAMES.UG_GALLERY_FULLSCREEN, CLASS_NAMES.UG_TOOLBAR_BUTTON);
		toolbar.appendChild(fullscreenButton);
		fullscreenButton.addEventListener('click', toggleFullscreen);
		fullscreenButton.setAttribute('aria-label', 'Toggle Fullscreen');

		const counter = document.createElement('div');
		counter.classList.add(CLASS_NAMES.UG_GALLERY_COUNTER, CLASS_NAMES.UG_GALLERY_HIDE);
		expandedView.appendChild(counter); // Directly in expandedView

		// Thumbnail Strip Container - Directly inside expandedView, no extra wrapper
		const thumbnailStripContainer = document.createElement('div');
		thumbnailStripContainer.classList.add(CLASS_NAMES.UG_GALLERY_THUMBNAIL_STRIP_CONTAINER);
		expandedView.appendChild(thumbnailStripContainer); // Directly in expandedView
		thumbnailStripContainer.addEventListener('mousedown', (e) => e.stopPropagation());

		const thumbnailStrip = document.createElement('div');
		thumbnailStrip.classList.add(CLASS_NAMES.UG_THUMBNAIL_STRIP);
		thumbnailStripContainer.appendChild(thumbnailStrip);

		const gridCloseButton = document.createElement('button');
		gridCloseButton.textContent = BUTTONS.CLOSE;
		gridCloseButton.classList.add(CLASS_NAMES.UG_GALLERY_GRID_CLOSE);
		gridView.appendChild(gridCloseButton);
		gridCloseButton.addEventListener('click', closeGallery);
		gridCloseButton.setAttribute('aria-label', 'Close Gallery');

		document.body.appendChild(galleryOverlay);

		state.fullSizeImageSrcs.forEach((src, index) => {
			const thumbnailContainer = document.createElement('div');
			thumbnailContainer.classList.add(CLASS_NAMES.UG_GALLERY_THUMBNAIL_GRID_CONTAINER);
			const thumbnail = document.createElement('img');
			thumbnail.src = src;
			thumbnail.classList.add(CLASS_NAMES.UG_GALLERY_THUMBNAIL);
			thumbnail.dataset.index = index;
			thumbnail.addEventListener('click', () => showExpandedView(index));
			thumbnailContainer.appendChild(thumbnail);
			thumbnailGrid.appendChild(thumbnailContainer);

			const stripThumbnail = document.createElement('img');
			stripThumbnail.src = src;
			stripThumbnail.classList.add(CLASS_NAMES.UG_THUMBNAIL);
			stripThumbnail.dataset.index = index;
			stripThumbnail.setAttribute('aria-label', `Thumbnail ${index + 1}`);
			stripThumbnail.addEventListener('click', () => showExpandedView(index));
			thumbnailStrip.appendChild(stripThumbnail);
		});

		showGridView();
	};

	const showGridView = () => {
		if (!galleryOverlay) return;
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_GRID_VIEW}`).classList.remove(CLASS_NAMES.UG_GALLERY_HIDE);
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_EXPANDED_VIEW}`).classList.add(CLASS_NAMES.UG_GALLERY_HIDE);
		resetZoom();
		state.isZoomed = false;
		state.controlsVisible = true;
	};

	const showExpandedView = (index) => {
		if (!galleryOverlay) return;

		const mainImage = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE}`);
		const counter = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_COUNTER}`);
		const prevButton = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_PREV}`);
		const nextButton = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_NEXT}`);
		const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_THUMBNAIL_STRIP}`);

		if (index < 0 || index >= state.fullSizeImageSrcs.length) {
			console.error("Invalid image index:", index);
			return;
		}

		const imageUrl = state.fullSizeImageSrcs[index];

		mainImage.onload = () => {
			initializeImage(mainImage, galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`));
		};

		mainImage.onerror = () => {
			console.error("Error loading image:", imageUrl);
			mainImage.src = '';
			mainImage.alt = "Error loading image";
		};

		mainImage.src = imageUrl;
		mainImage.alt = `Image ${index + 1} of ${state.fullSizeImageSrcs.length}`;
		resetZoom();
		state.isZoomed = false;
		state.controlsVisible = true;

		counter.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;

		state.currentGalleryIndex = index;

		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_GRID_VIEW}`).classList.add(CLASS_NAMES.UG_GALLERY_HIDE);
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_EXPANDED_VIEW}`).classList.remove(CLASS_NAMES.UG_GALLERY_HIDE);
		counter.classList.remove(CLASS_NAMES.UG_GALLERY_HIDE);

		// Scroll the thumbnail strip
		thumbnailStrip.scrollLeft = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_THUMBNAIL}[data-index="${index}"]`).offsetLeft - thumbnailStrip.offsetWidth / 2 + 50;

		galleryOverlay.querySelectorAll(`.${CLASS_NAMES.UG_THUMBNAIL}`).forEach(thumb => {
			thumb.classList.remove('selected');
		});
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_THUMBNAIL}[data-index="${index}"]`).classList.add('selected');

		prevButton.classList[index === 0 ? 'add' : 'remove'](CLASS_NAMES.UG_GALLERY_HIDE);
		nextButton.classList[index === state.fullSizeImageSrcs.length - 1 ? 'add' : 'remove'](CLASS_NAMES.UG_GALLERY_HIDE);
	};

	const updateGallery = (index) => {
		showExpandedView(index);
	};

	const nextImage = () => {
		let newIndex = (state.currentGalleryIndex + 1) % state.fullSizeImageSrcs.length;
		updateGallery(newIndex);
	};

	const prevImage = () => {
		let newIndex = (state.currentGalleryIndex - 1 + state.fullSizeImageSrcs.length) % state.fullSizeImageSrcs.length;
		updateGallery(newIndex);
	};

	const closeGallery = () => {
		if (!galleryOverlay) return;
		document.body.removeChild(galleryOverlay);
		galleryOverlay = null;
		document.body.classList.remove('ug-fullscreen');
		state.isGalleryMode = false;
		state.isFullscreen = false;
	};

	const toggleGallery = () => {
		if (state.isGalleryMode) {
			closeGallery();
		} else {
			createGallery();
		}
		state.isGalleryMode = !state.isGalleryMode;
	};

	const toggleFullscreen = () => {
		state.isFullscreen = !state.isFullscreen;
		if (state.isFullscreen) {
			document.body.classList.add('ug-fullscreen');
			galleryOverlay.classList.add('ug-fullscreen-overlay');
		} else {
			document.body.classList.remove('ug-fullscreen');
			galleryOverlay.classList.remove('ug-fullscreen-overlay');
		}
	};


	// --- applyZoom ---
	const applyZoom = () => {
		const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		if (!mainImageContainer) return;

		// Apply the transform. Order is VERY important: translate THEN scale.
		mainImageContainer.style.transform = `translate(${state.imageOffset.x}px, ${state.imageOffset.y}px) scale(${state.zoomScale})`;

		// Update cursor (grab/grabbing).
		mainImageContainer.classList.toggle(CLASS_NAMES.UG_GRABBING_CURSOR, state.zoomScale > 1);
	};

	// --- initializeImage ---
	const initializeImage = (image, container) => {
		const containerWidth = container.offsetWidth;
		const containerHeight = container.offsetHeight;
		const imageWidth = image.naturalWidth;
		const imageHeight = image.naturalHeight;

		const aspectRatio = imageWidth / imageHeight;
		let newWidth, newHeight;

		if (aspectRatio > containerWidth / containerHeight) {
			newWidth = containerWidth;
			newHeight = containerWidth / aspectRatio;
		} else {
			newHeight = containerHeight;
			newWidth = containerHeight * aspectRatio;
		}

		const initialScale = newWidth / imageWidth;
		const translateX = (containerWidth - newWidth) / 2;
		const translateY = (containerHeight - newHeight) / 2;

		// Set initial state (VERY IMPORTANT)
		state.zoomScale = initialScale;
		state.imageOffset.x = translateX;
		state.imageOffset.y = translateY;

		// Apply initial transform using state (for consistency)
		applyZoom();
	};
	const toggleControlsVisibility = () => {
		state.controlsVisible = !state.controlsVisible;
	};

	const handleWindowResize = () => {
		if (!galleryOverlay) return;
		const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		const newWidth = mainImageContainer.offsetWidth;
		const newHeight = mainImageContainer.offsetHeight;

		if (newWidth !== state.lastWidth || newHeight !== state.lastHeight) {
			state.lastWidth = newWidth;
			state.lastHeight = newHeight;
			resetZoom();
			applyZoom();
		}
	};

	const handleGalleryKey = (event) => {
		if (!isPostPage()) return;

		if (event.key === state.galleryKey && state.galleryReady) {
			toggleGallery();
		} else if (state.isGalleryMode && !galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_GRID_VIEW}`).classList.contains(CLASS_NAMES.UG_GALLERY_HIDE)) {
			return;
		} else if (state.isGalleryMode) {
			if (['Escape', state.prevImageKey, state.nextImageKey, 'ArrowLeft', 'ArrowRight', 'k', 'l'].includes(event.key)) {
				event.preventDefault();
				switch (event.key) {
					case 'Escape':
						showGridView();
						break;
					case state.prevImageKey:
					case 'k':
					case 'ArrowLeft':
						prevImage();
						break;
					case state.nextImageKey:
					case 'l':
					case 'ArrowRight':
						nextImage();
						break;
				}
			}
		}
	};

	const handleSettingsKey = (event) => {
		if (state.settingsOpen && event.key === 'Escape') {
			state.settingsOpen = false;
		}
	};

	const clickAllImageButtons = (action) => {
		const fileDivs = document.querySelectorAll(SELECTORS.FILE_DIVS);
		const parentDiv = fileDivs[0]?.parentNode;
		if (!parentDiv) return;
		state.displayedImages.forEach((img) => {
			const buttonGroup = img.closest(SELECTORS.THUMBNAIL)?.previousElementSibling;
			if (buttonGroup) {
				const button = Array.from(buttonGroup.querySelectorAll(`.${CLASS_NAMES.UG_BUTTON}`)).find(button => button.textContent === BUTTONS[action.toUpperCase()]);
				if (button) {
					button.click();
				}
			}
		});
	};

	const downloadAllImages = async () => {
		const images = document.querySelectorAll(SELECTORS.IMAGE_LINK);
		const attachmentLinks = document.querySelectorAll(SELECTORS.ATTACHMENT_LINK);
		const title = document.querySelector(SELECTORS.POST_TITLE)?.textContent?.trim() || "Untitled";
		const artistName = document.querySelector(SELECTORS.POST_USER_NAME)?.textContent?.trim() || "Unknown Artist";

		const total = images.length + attachmentLinks.length;
		if (total === 0) return;

		if (state.isGalleryMode) {
			const result = await Swal.fire({
				title: 'Download All Images?',
				text: `You are about to download ${total} images.  Proceed?`,
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

		const sanitizedTitle = sanitizeFileName(title);
		const sanitizedArtistName = sanitizeFileName(artistName);

		const zip = new JSZip();
		let downloaded = 0;
		const downloadPromises = [];

		const downloadAndAddToZip = (url, originalFilename, index) => {
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
							let ext = getExtension(filename);

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
										ext = getExtension(originalFilename);
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
								.replace("{fileName}", sanitizeFileName(filename.replace(/\.[^/.]+$/, "")))
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
	};

	const downloadImageByIndex = (index) => {
		const imgLink = document.querySelectorAll(SELECTORS.IMAGE_LINK)[index];

		if (imgLink) {
			const imgSrc = imgLink.href.split("?")[0];
			let fileName = imgLink.getAttribute('download');

			if (!fileName) {
				fileName = `image_${index + 1}.jpg`;
			}

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
					} else {
						console.error('Error downloading image:', response.status);
						Swal.fire('Error!', `Failed to download image: HTTP ${response.status}`, 'error');
					}
				},
				onerror: function(error) {
					console.error('Error downloading image:', error);
					Swal.fire('Error!', `Failed to download image: ${error.message}`, 'error');
				}
			});
		} else {
			console.error("imgLink not found for index:", index);
		}
	};

	const initPostActions = () => { // Remains largely unchanged
		state.postActionsInitialized = true;
		if (!isPostPage() || state.currentPostUrl === window.location.href) return;
		cleanupPostActions();

		const currentPageUrl = window.location.href;

		document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img')
			.forEach((img) => (img.className = CLASS_NAMES.POST_IMAGE));
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
				} = createStatusElement();
				elements.statusContainer = statusContainer;
				elements.statusElement = statusElement;
				elements.postActions.appendChild(elements.statusContainer);
			}

			if (!elements.postActions.querySelector(`.${CLASS_NAMES.UG_BUTTON}`)) {
				const downloadAllButton = createToggleButton(BUTTONS.DOWNLOAD_ALL, downloadAllImages);
				const galleryButton = createToggleButton('Loading Gallery...', toggleGallery, true);
				elements.galleryButton = galleryButton;

				const heightButton = createToggleButton(BUTTONS.HEIGHT, () => clickAllImageButtons('height'));
				const widthButton = createToggleButton(BUTTONS.WIDTH, () => clickAllImageButtons('width'));
				const fullButton = createToggleButton(BUTTONS.FULL, () => clickAllImageButtons('full'));

				elements.postActions.append(heightButton, widthButton, fullButton, downloadAllButton, galleryButton);
				elements.galleryButton.style.display = 'inline-block';
			}
		}

		if (!elements.settingsButton) {
			const settingsButton = document.createElement('button');
			settingsButton.textContent = BUTTONS.SETTINGS;
			settingsButton.className = CLASS_NAMES.SETTINGS_BUTTON;
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

			const existingButtonGroups = Array.from(parentDiv.querySelectorAll(`.${CLASS_NAMES.UG_BUTTON_CONTAINER}`));
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

				if (!img.closest(SELECTORS.THUMBNAIL).previousElementSibling?.classList.contains(CLASS_NAMES.UG_BUTTON_CONTAINER)) {
					const newDiv = createButtonGroup([{
							text: BUTTONS.HEIGHT,
							action: resizeImage
						},
						{
							text: BUTTONS.WIDTH,
							action: resizeImage
						},
						{
							text: BUTTONS.FULL,
							action: () => imageActions.full(img),
							name: 'FULL'
						},
						{
							text: BUTTONS.DOWNLOAD,
							action: () => downloadImageByIndex(index),
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
				img.addEventListener('click', () => toggleGallery());
			});

			parentDiv.addEventListener('click', delegatedImageClickHandler);

			const favoriteButton = document.querySelector(SELECTORS.FAVORITE_BUTTON);
			if (favoriteButton) {
				const newDiv = createButtonGroup([{
						text: BUTTONS.HEIGHT,
						action: () => resizeAllImages('height')
					},
					{
						text: BUTTONS.WIDTH,
						action: () => resizeAllImages('width')
					},
					{
						text: BUTTONS.FULL,
						action: () => resizeAllImages('full')
					}
				]);
				if (!favoriteButton.nextElementSibling?.classList.contains(CLASS_NAMES.UG_BUTTON_CONTAINER)) {
					favoriteButton.parentNode.insertBefore(newDiv, favoriteButton.nextSibling);
				}
			}
		}
		state.currentPostUrl = currentPageUrl;
	};

	const updateGalleryButton = (enabled) => {
		if (elements.galleryButton) {
			elements.galleryButton.textContent = enabled ? BUTTONS.GALLERY : 'Loading Gallery...';
			elements.galleryButton.disabled = !enabled;
			elements.galleryButton.classList.toggle('disabled', !enabled);
		}
	};

	const cleanupPostActions = () => {
		if (elements.postActions) {
			elements.postActions.querySelectorAll(`.${CLASS_NAMES.UG_BUTTON}`).forEach(button => button.remove());
		}

		if (elements.settingsButton) {
			elements.settingsButton.remove();
			elements.settingsButton = null
		}

		const parentDiv = document.querySelector(website === 'nekohouse' ? '.scrape__thumbnails' : '.post__thumbnails');
		if (parentDiv) {
			parentDiv.removeEventListener('click', delegatedImageClickHandler);
		}


		if (elements.statusContainer) {
			elements.statusContainer.remove();
			elements.statusContainer = null;
			elements.statusElement = null;
		}

		elements.postActions = null;
	};

	const resizeAllImages = (action) => {
		document
			.querySelectorAll(SELECTORS.FILES_IMG)
			.forEach((img) => {
				if (imageActions[action]) {
					imageActions[action](img);
				}
			});
	};

	const resizeImage = (evt) => {
		const action = Object.keys(BUTTONS)
			.find((key) => BUTTONS[key] === evt.currentTarget.textContent)
			?.toLowerCase();
		const buttonContainer = evt.currentTarget.closest('div');
		const imageContainer = buttonContainer?.nextElementSibling;
		const displayedImage = imageContainer?.querySelector('img');

		if (displayedImage && imageActions[action]) {
			imageActions[action](displayedImage);
		}
	};

	const showLoadingOverlay = (text) => {
		if (!elements.loadingOverlay) {
			elements.loadingOverlay = createLoadingOverlay(text);
			document.body.appendChild(elements.loadingOverlay);
		} else {
			updateLoadingOverlayText(text);
		}
	};

	const updateLoadingOverlayText = (text) => {
		if (elements.loadingOverlay) {
			const loadingText = elements.loadingOverlay.querySelector('div');
			if (loadingText) {
				loadingText.textContent = text;
			}
		}
	};

	const hideLoadingOverlay = () => {
		if (elements.loadingOverlay) {
			elements.loadingOverlay.remove();
			elements.loadingOverlay = null;
		}
	};

	const createNotificationArea = () => {
		const notificationArea = document.createElement('div');
		notificationArea.id = CLASS_NAMES.NOTIFICATION_AREA;
		notificationArea.classList.add(CLASS_NAMES.NOTIFICATION_AREA);
		document.body.appendChild(notificationArea);
		return notificationArea;
	};

	const createNotification = () => {
		let notificationArea = document.getElementById(CLASS_NAMES.NOTIFICATION_AREA);
		if (!notificationArea) {
			notificationArea = createNotificationArea();
		}

		const notificationContainer = document.createElement('div');
		notificationContainer.id = CLASS_NAMES.NOTIFICATION_CONTAINER;
		notificationContainer.classList.add(CLASS_NAMES.NOTIFICATION_CONTAINER);

		const notificationText = document.createElement('div');
		notificationText.id = CLASS_NAMES.NOTIFICATION_TEXT;
		notificationContainer.appendChild(notificationText);

		const closeButton = document.createElement('button');
		closeButton.id = CLASS_NAMES.NOTIFICATION_CLOSE;
		closeButton.textContent = '×';
		closeButton.addEventListener('click', () => {
			state.notification = null;
		});
		notificationContainer.appendChild(closeButton);

		const reportButton = document.createElement('a');
		reportButton.id = CLASS_NAMES.NOTIFICATION_REPORT;
		reportButton.textContent = 'Report Issue';
		reportButton.href = 'https://github.com/TearTyr/Ultra-Galleries/issues';
		reportButton.target = '_blank';
		notificationContainer.appendChild(reportButton);

		notificationArea.appendChild(notificationContainer);
		return notificationContainer;
	};

	const showNotification = (message, type = 'info') => {
		if (!state.notificationsEnabled && type !== 'error') return;
		let notificationArea = document.getElementById(CLASS_NAMES.NOTIFICATION_AREA);

		if (!notificationArea) {
			notificationArea = createNotificationArea();
		}
		let notificationContainer = notificationArea.querySelector(`.${CLASS_NAMES.NOTIFICATION_CONTAINER}`);
		if (!notificationContainer) {
			notificationContainer = createNotification();
		}
		if (notificationArea) {
			notificationArea.style.display = state.notificationAreaVisible ? 'flex' : 'none';
		}
		const notificationText = notificationContainer.querySelector(`#${CLASS_NAMES.NOTIFICATION_TEXT}`);
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
	};

	const hideNotification = () => {
		const notificationContainer = document.getElementById(CLASS_NAMES.NOTIFICATION_CONTAINER);
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
	};

	const handleImageError = (mediaSrc, reject) => {
		console.error(`Image failed to load: ${mediaSrc}`);
		state.loadedImages++;
		state.notification = 'Error loading some media.';
		state.notificationType = 'error';
		reject();
	};

	const handleImageFetchError = (mediaSrc, status, reject, error = null) => {
		console.error(`Failed to fetch image (status ${status}): ${mediaSrc}`, error);
		state.loadedImages++;
		state.notification = 'Error loading some media.';
		state.notificationType = 'error';
		reject();
	};

	const handleGeneralImageLoadError = (mediaHref, error) => {
		console.error(`Failed to load media: ${mediaHref}`, error);
		state.virtualGallery = null; // Clear virtual gallery on error
		state.loadedImages++;
		state.notification = 'Error loading some media.';
		state.notificationType = 'error';
		reject();
	};

	const isPostPage = () => {
		const url = window.location.href;
		const validPatterns = [
			/https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/post\//,
			/https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/user\/.*\/post\//,
		];
		return validPatterns.some((pattern) => pattern.test(url));
	};

	const delegatedImageClickHandler = (event) => {
		const clickedImage = event.target.closest(SELECTORS.IMAGE_LINK + ' img');
		if (clickedImage) {
			const index = Array.from(
				document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img')
			).indexOf(clickedImage);
			if (index !== -1) {
				toggleGallery();
			}
		}
	};

	let uiCache = {};
	let previousPageUrl = null;

	const injectUI = () => { // Remains largely unchanged
		if (!isPostPage()) {
			state.postActionsInitialized = false;
			state.notification = null;
			state.notificationType = 'info';
			state.loadingMessage = null;
			state.isLoading = false;
			state.galleryReady = false;
			state.hasImages = false;
			state.totalImages = 0;
			cleanupPostActions();
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
					} = createStatusElement();
					elements.statusContainer = statusContainer;
					elements.statusElement = statusElement;
					const actionsContainer = document.querySelector(SELECTORS.POST_ACTIONS);
					if (actionsContainer) {
						actionsContainer.appendChild(elements.statusContainer);
					}
				}
				state.notification = `Loading media (${state.loadedImages}/${state.totalImages})...`;
			}
			loadImages();
			initPostActions();
			state.currentPostUrl = currentPageUrl;
			previousPageUrl = currentPageUrl;
		} else if (currentPageUrl !== state.currentPostUrl) {
			cleanupPostActions();
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
					} = createStatusElement();
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
			loadImages();
			initPostActions();
			state.currentPostUrl = currentPageUrl;
			previousPageUrl = currentPageUrl;
		}
	};

	const init = () => {
		if (!galleryKeyListenerAttached) {
			window.addEventListener('keydown', handleGalleryKey);
			window.addEventListener('keydown', handleSettingsKey);
			galleryKeyListenerAttached = true;
		}
		if (!document.getElementById(CLASS_NAMES.NOTIFICATION_AREA) && state.notificationAreaVisible) {
			createNotificationArea();
		}

		window.addEventListener('resize', handleWindowResize);

		const targetNode = document.body;
		const config = {
			childList: true,
			subtree: true
		};

		const observer = new MutationObserver(injectUI);

		observer.observe(targetNode, config);

		if (isPostPage()) {
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

	init();
})();