// Ultra-Galleries.js
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
	const debounce = (func, delay) => {
		let timeout;
		return function(...args) {
			const context = this;
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(context, args), delay);
		};
	};
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
		GRID_VIEW: '🖼️',
		EXPANDED_VIEW: '🔍',
		ZOOM_IN: '+',
		ZOOM_OUT: '-',
		ZOOM_RESET: 'Reset',
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
		PREV_BUTTON: 'navigation-button prev',
		NEXT_BUTTON: 'navigation-button next',
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
		BOTTOM_STRIPE: 'ug-bottom-stripe',
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
		/* New container for thumbnail strip */
		UG_GALLERY_ZOOM_CONTAINER: 'ug-gallery-zoom-container',
		/* Container for zoom functionality */
		UG_GALLERY_ZOOM_IMAGE: 'ug-gallery-zoom-image',
		/* Image within zoom container */
		/* Class for the new grid close button */
		UG_GALLERY_TOOLBAR: 'ug-gallery-toolbar',
		UG_TOOLBAR_BUTTON: 'ug-toolbar-button',
		UG_ZOOM_CONTROLS: 'ug-zoom-controls',
		UG_ZOOM_BUTTON: 'ug-zoom-button',
		UG_CONTROLS_HIDDEN_CLASS: 'ug-controls-hidden', // Class to hide controls
		UG_GRABBING_CURSOR: 'ug-grabbing', // Class for grabbing cursor
		UG_BOTTOM_STRIPE_CONTAINER: 'ug-bottom-stripe-container', //New container for bottom stripe
	};

	const MAX_RETRIES = 3;
	const RETRY_DELAY = 1500;
	const IMAGE_BATCH_SIZE = 5;
	const DEBOUNCE_DELAY = 10; // Reduced debounce for smoother drag

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
		bottomStripeVisible: true,
		dynamicResizing: GM_getValue('dynamicResizing', true), // Default to on
		zoomEnabled: GM_getValue('zoomEnabled', true), // Default zoom enabled
		isZoomed: false, // Track zoom state
		zoomScale: 1, // Current zoom scale
		controlsVisible: true, // Initially controls are visible,
		isDragging: false, // Track if image is being dragged
		dragStartPosition: {
			x: 0,
			y: 0
		}, // Track drag start position
		imageOffset: {
			x: 0,
			y: 0
		}, // Track current image offset
	}, {
		controlsVisible: (value) => {
			const toolbar = galleryOverlay?.querySelector(`.${CLASS_NAMES.UG_GALLERY_TOOLBAR}`);
			const zoomControls = galleryOverlay?.querySelector(`.${CLASS_NAMES.UG_ZOOM_CONTROLS}`);
			if (toolbar) toolbar.classList.toggle(CLASS_NAMES.UG_CONTROLS_HIDDEN_CLASS, !value);
			if (zoomControls) zoomControls.classList.toggle(CLASS_NAMES.UG_CONTROLS_HIDDEN_CLASS, !value);
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
		}
	});

	// --- Settings ---
	const createSettingsUI = () => {
		// Settings Overlay Container
		const settingsOverlay = document.createElement('div');
		settingsOverlay.id = 'ug-settings-overlay';
		settingsOverlay.classList.add('ug-settings-overlay');

		// Settings Container - inner panel
		const settingsContainer = document.createElement('div');
		settingsContainer.classList.add('ug-settings-container');
		settingsOverlay.appendChild(settingsContainer);

		// Settings Header
		const settingsHeader = document.createElement('div');
		settingsHeader.classList.add('ug-settings-header');
		settingsContainer.appendChild(settingsHeader);

		const headerText = document.createElement('h2');
		headerText.textContent = 'Ultra Galleries Settings';
		settingsHeader.appendChild(headerText);

		// Close Button (X) - Top Right
		const closeButton = document.createElement('button');
		closeButton.classList.add('ug-settings-close-btn');
		closeButton.textContent = BUTTONS.CLOSE;
		closeButton.addEventListener('click', () => state.settingsOpen = false);
		settingsHeader.appendChild(closeButton);

		// Settings Body - for options
		const settingsBody = document.createElement('div');
		settingsBody.classList.add('ug-settings-body');
		settingsContainer.appendChild(settingsBody);

		// Settings Sections - layout as needed, e.g., using fieldsets or divs
		const sectionGeneral = document.createElement('fieldset');
		sectionGeneral.innerHTML = `<legend>General Settings</legend>`;
		settingsBody.appendChild(sectionGeneral);

		const sectionKeys = document.createElement('fieldset');
		sectionKeys.innerHTML = `<legend>Keyboard Shortcuts</legend>`;
		settingsBody.appendChild(sectionKeys);

		const sectionNotifications = document.createElement('fieldset');
		sectionNotifications.innerHTML = `<legend>Notifications</legend>`;
		settingsBody.appendChild(sectionNotifications);

		const sectionFormatting = document.createElement('fieldset');
		sectionFormatting.innerHTML = `<legend>File Formatting</legend>`;
		settingsBody.appendChild(sectionFormatting);

		const sectionZoom = document.createElement('fieldset'); // New section for zoom
		sectionZoom.innerHTML = `<legend>Zoom Settings</legend>`;
		settingsBody.appendChild(sectionZoom);

		// --- General Settings ---
		// Dynamic Resizing Toggle
		const dynamicResizingLabel = document.createElement('label');
		dynamicResizingLabel.innerHTML = `Dynamic Resizing: <input type="checkbox" id="dynamicResizingToggle" ${state.dynamicResizing ? 'checked' : ''}>`;
		const dynamicResizingInput = dynamicResizingLabel.querySelector('input');
		dynamicResizingInput.addEventListener('change', (e) => {
			state.dynamicResizing = e.target.checked;
			GM_setValue('dynamicResizing', state.dynamicResizing);
		});
		sectionGeneral.appendChild(dynamicResizingLabel);

		// Animations Toggle
		const animationsLabel = document.createElement('label');
		animationsLabel.innerHTML = `Enable Animations: <input type="checkbox" id="animationsToggle" ${state.animationsEnabled ? 'checked' : ''}>`;
		const animationsInput = animationsLabel.querySelector('input');
		animationsInput.addEventListener('change', (e) => {
			state.animationsEnabled = e.target.checked;
			GM_setValue('animationsEnabled', state.animationsEnabled);
		});
		sectionGeneral.appendChild(animationsLabel);

		// Bottom Stripe Visibility Toggle
		const bottomStripeLabel = document.createElement('label');
		bottomStripeLabel.innerHTML = `Show Thumbnail Stripe: <input type="checkbox" id="bottomStripeToggle" ${state.bottomStripeVisible ? 'checked' : ''}>`;
		const bottomStripeInput = bottomStripeLabel.querySelector('input');
		bottomStripeInput.addEventListener('change', (e) => {
			state.bottomStripeVisible = e.target.checked;
			GM_setValue('bottomStripeVisible', state.bottomStripeVisible);
			if (galleryOverlay) {
				const bottomStripeContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_BOTTOM_STRIPE_CONTAINER}`);
				if (bottomStripeContainer) {
					bottomStripeContainer.style.display = state.bottomStripeVisible ? 'flex' : 'none';
				}
			}
		});
		sectionGeneral.appendChild(bottomStripeLabel);


		// --- Zoom Settings ---
		// Zoom Enable Toggle
		const zoomEnableLabel = document.createElement('label');
		zoomEnableLabel.innerHTML = `Enable Zoom Functionality: <input type="checkbox" id="zoomEnableToggle" ${state.zoomEnabled ? 'checked' : ''}>`;
		const zoomEnableInput = zoomEnableLabel.querySelector('input');
		zoomEnableInput.addEventListener('change', (e) => {
			state.zoomEnabled = e.target.checked;
			GM_setValue('zoomEnabled', state.zoomEnabled);
			if (!state.zoomEnabled) {
				state.isZoomed = false; // Reset zoom state if disabled
				updateZoomToggleButton(); // Update zoom toggle button
				resetZoom(); // Reset zoom
				const zoomControls = galleryOverlay?.querySelector(`.${CLASS_NAMES.UG_ZOOM_CONTROLS}`);
				if (zoomControls) zoomControls.classList.add(CLASS_NAMES.UG_GALLERY_HIDE); // Hide zoom controls
			}
		});
		sectionZoom.appendChild(zoomEnableLabel);


		// --- Keyboard Shortcuts ---
		// Gallery Key Input
		const galleryKeyLabel = document.createElement('label');
		galleryKeyLabel.innerHTML = `Gallery Key: <input type="text" id="galleryKeyInput" value="${state.galleryKey}" maxlength="1" style="width: 2em;">`;
		const galleryKeyInput = galleryKeyLabel.querySelector('input');
		galleryKeyInput.addEventListener('change', (e) => {
			state.galleryKey = e.target.value;
			GM_setValue('galleryKey', state.galleryKey);
		});
		sectionKeys.appendChild(galleryKeyLabel);

		// Prev Image Key Input
		const prevImageKeyLabel = document.createElement('label');
		prevImageKeyLabel.innerHTML = `Previous Image Key: <input type="text" id="prevImageKeyInput" value="${state.prevImageKey}" maxlength="1" style="width: 2em;">`;
		const prevImageKeyInput = prevImageKeyLabel.querySelector('input');
		prevImageKeyInput.addEventListener('change', (e) => {
			state.prevImageKey = e.target.value;
			GM_setValue('prevImageKey', state.prevImageKey);
		});
		sectionKeys.appendChild(prevImageKeyLabel);

		// Next Image Key Input
		const nextImageKeyLabel = document.createElement('label');
		nextImageKeyLabel.innerHTML = `Next Image Key: <input type="text" id="nextImageKeyInput" value="${state.nextImageKey}" maxlength="1" style="width: 2em;">`;
		const nextImageKeyInput = nextImageKeyLabel.querySelector('input');
		nextImageKeyInput.addEventListener('change', (e) => {
			state.nextImageKey = e.target.value;
			GM_setValue('nextImageKey', state.nextImageKey);
		});
		sectionKeys.appendChild(nextImageKeyLabel);

		// --- Notifications Settings ---
		// Notifications Enabled Toggle
		const notificationsEnabledLabel = document.createElement('label');
		notificationsEnabledLabel.innerHTML = `Enable Notifications: <input type="checkbox" id="notificationsEnabledToggle" ${state.notificationsEnabled ? 'checked' : ''}>`;
		const notificationsEnabledInput = notificationsEnabledLabel.querySelector('input');
		notificationsEnabledInput.addEventListener('change', (e) => {
			state.notificationsEnabled = e.target.checked;
			GM_setValue('notificationsEnabled', state.notificationsEnabled);
		});
		sectionNotifications.appendChild(notificationsEnabledLabel);

		// Notification Area Visibility Toggle
		const notificationAreaVisibleLabel = document.createElement('label');
		notificationAreaVisibleLabel.innerHTML = `Show Notification Area: <input type="checkbox" id="notificationAreaVisibleToggle" ${state.notificationAreaVisible ? 'checked' : ''}>`;
		const notificationAreaVisibleInput = notificationAreaVisibleLabel.querySelector('input');
		notificationAreaVisibleInput.addEventListener('change', (e) => {
			state.notificationAreaVisible = e.target.checked;
			GM_setValue('notificationAreaVisible', state.notificationAreaVisible);
			const notificationArea = document.getElementById(CLASS_NAMES.NOTIFICATION_AREA);
			if (notificationArea) {
				notificationArea.style.display = state.notificationAreaVisible ? 'flex' : 'none';
			}
		});
		sectionNotifications.appendChild(notificationAreaVisibleLabel);


		// --- File Formatting Settings ---
		// Zip File Name Format Input
		const zipFileNameFormatLabel = document.createElement('label');
		zipFileNameFormatLabel.innerHTML = `Zip File Name Format: <input type="text" id="zipFileNameFormatInput" value="${state.zipFileNameFormat}" style="width: 100%;">`;
		const zipFileNameFormatInput = zipFileNameFormatLabel.querySelector('input');
		zipFileNameFormatInput.addEventListener('change', (e) => {
			state.zipFileNameFormat = e.target.value;
			GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
		});
		sectionFormatting.appendChild(zipFileNameFormatLabel);

		// Image File Name Format Input
		const imageFileNameFormatLabel = document.createElement('label');
		imageFileNameFormatLabel.innerHTML = `Image File Name Format: <input type="text" id="imageFileNameFormatInput" value="${state.imageFileNameFormat}" style="width: 100%;">`;
		const imageFileNameFormatInput = imageFileNameFormatLabel.querySelector('input');
		imageFileNameFormatInput.addEventListener('change', (e) => {
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

	const createNavigationButton = (direction) => {
		const button = document.createElement('button');
		button.textContent = direction === 'prev' ? '←' : '→';
		button.className = `${CLASS_NAMES.NAVIGATION_BUTTON} ${direction}`;
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
		zoomToggleButton: null
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

		for (let scrollPos = originalScrollPosition; scrollPos < maxScrollHeight; scrollPos += scrollStep) {
			window.scrollTo(0, scrollPos);
			await new Promise(resolve => setTimeout(resolve, 100));
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
		//expandedView.addEventListener('click', toggleControlsVisibility); // Click to hide controls - Removed for now, click on image instead

		// Toolbar for expanded view
		const toolbar = document.createElement('div');
		toolbar.classList.add(CLASS_NAMES.UG_GALLERY_TOOLBAR);
		expandedView.appendChild(toolbar);
		toolbar.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent toolbar interactions from triggering image drag

		// Zoom Controls - moved to toolbar
		const zoomControls = document.createElement('div');
		zoomControls.classList.add(CLASS_NAMES.UG_ZOOM_CONTROLS);
		toolbar.appendChild(zoomControls);
		zoomControls.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent zoom controls interaction from triggering image drag

		const zoomInButton = document.createElement('button');
		zoomInButton.textContent = BUTTONS.ZOOM_IN;
		zoomInButton.classList.add(CLASS_NAMES.UG_ZOOM_BUTTON);
		zoomInButton.addEventListener('click', zoomIn);
		zoomInButton.setAttribute('aria-label', 'Zoom In'); // Accessibility
		zoomControls.appendChild(zoomInButton);

		const zoomOutButton = document.createElement('button');
		zoomOutButton.textContent = BUTTONS.ZOOM_OUT;
		zoomOutButton.classList.add(CLASS_NAMES.UG_ZOOM_BUTTON);
		zoomOutButton.addEventListener('click', zoomOut);
		zoomOutButton.setAttribute('aria-label', 'Zoom Out'); // Accessibility
		zoomControls.appendChild(zoomOutButton);

		const zoomResetButton = document.createElement('button');
		zoomResetButton.textContent = BUTTONS.ZOOM_RESET;
		zoomResetButton.classList.add(CLASS_NAMES.UG_ZOOM_BUTTON);
		zoomResetButton.addEventListener('click', resetZoom);
		zoomResetButton.setAttribute('aria-label', 'Reset Zoom'); // Accessibility
		zoomControls.appendChild(zoomResetButton);
		zoomControls.classList.add(CLASS_NAMES.UG_GALLERY_HIDE); // Initially hidden


		const zoomToggleButton = document.createElement('button');
		zoomToggleButton.classList.add(CLASS_NAMES.UG_TOOLBAR_BUTTON);
		zoomToggleButton.textContent = BUTTONS.EXPANDED_VIEW;
		zoomToggleButton.addEventListener('click', toggleZoom);
		zoomToggleButton.setAttribute('aria-label', 'Toggle Zoom'); // Accessibility
		toolbar.appendChild(zoomToggleButton);
		elements.zoomToggleButton = zoomToggleButton; // Store for state update

		const expandedCloseButton = document.createElement('button');
		expandedCloseButton.classList.add(CLASS_NAMES.UG_TOOLBAR_BUTTON);
		expandedCloseButton.textContent = BUTTONS.CLOSE;
		expandedCloseButton.addEventListener('click', showGridView); // Go back to grid view
		expandedCloseButton.setAttribute('aria-label', 'Close Expanded View'); // Accessibility
		toolbar.appendChild(expandedCloseButton);


		const thumbnailGrid = document.createElement('div');
		thumbnailGrid.classList.add(CLASS_NAMES.UG_GALLERY_THUMBNAIL_GRID);
		gridView.appendChild(thumbnailGrid);

		const expandedZoomContainer = document.createElement('div'); // Zoom Container
		expandedZoomContainer.classList.add(CLASS_NAMES.UG_GALLERY_ZOOM_CONTAINER);
		expandedView.appendChild(expandedZoomContainer);

		const mainImageContainer = document.createElement('div');
		mainImageContainer.classList.add(CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER);
		expandedZoomContainer.appendChild(mainImageContainer); // Append to zoom container
		mainImageContainer.addEventListener('click', handleImageClickForZoom); // Click to zoom
		mainImageContainer.addEventListener('wheel', handleWheelZoom, {
			passive: false
		}); // Add wheel zoom listener
		mainImageContainer.addEventListener('mousedown', startDrag);
		mainImageContainer.addEventListener('mousemove', debouncedDragImage); // Use debounced drag function
		mainImageContainer.addEventListener('mouseup', endDrag);
		mainImageContainer.addEventListener('mouseleave', endDrag);


		const mainImage = document.createElement('img');
		mainImage.classList.add(CLASS_NAMES.UG_MAIN_IMAGE, CLASS_NAMES.UG_GALLERY_ZOOM_IMAGE); // Add zoom image class
		mainImageContainer.appendChild(mainImage);

		const navContainer = document.createElement('div'); // Container for nav buttons
		navContainer.classList.add(CLASS_NAMES.UG_GALLERY_NAV_CONTAINER); // Add class for styling if needed
		expandedView.appendChild(navContainer);
		navContainer.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent nav buttons interaction from triggering image drag

		const prevButton = document.createElement('button');
		prevButton.textContent = '←';
		prevButton.classList.add(CLASS_NAMES.UG_GALLERY_NAV, CLASS_NAMES.UG_GALLERY_PREV, CLASS_NAMES.UG_GALLERY_HIDE);
		navContainer.appendChild(prevButton); // Append to nav container
		prevButton.addEventListener('click', prevImage);
		prevButton.setAttribute('aria-label', 'Previous Image'); // Accessibility

		const nextButton = document.createElement('button');
		nextButton.textContent = '→';
		nextButton.classList.add(CLASS_NAMES.UG_GALLERY_NAV, CLASS_NAMES.UG_GALLERY_NEXT, CLASS_NAMES.UG_GALLERY_HIDE);
		navContainer.appendChild(nextButton); // Append to nav container
		nextButton.addEventListener('click', nextImage);
		nextButton.setAttribute('aria-label', 'Next Image'); // Accessibility


		const fullscreenButton = document.createElement('button');
		fullscreenButton.textContent = BUTTONS.FULLSCREEN;
		fullscreenButton.classList.add(CLASS_NAMES.UG_GALLERY_FULLSCREEN, CLASS_NAMES.UG_TOOLBAR_BUTTON); // Added toolbar button class
		toolbar.appendChild(fullscreenButton);
		fullscreenButton.addEventListener('click', toggleFullscreen);
		fullscreenButton.setAttribute('aria-label', 'Toggle Fullscreen'); // Accessibility

		const counter = document.createElement('div');
		counter.classList.add(CLASS_NAMES.UG_GALLERY_COUNTER, CLASS_NAMES.UG_GALLERY_HIDE);
		expandedView.appendChild(counter);

		// Bottom Stripe Container - NEW CONTAINER
		const bottomStripeContainer = document.createElement('div');
		bottomStripeContainer.classList.add(CLASS_NAMES.UG_BOTTOM_STRIPE_CONTAINER);
		expandedView.appendChild(bottomStripeContainer);


		// Thumbnail Strip Container - MOVED TO BOTTOM STRIPE CONTAINER
		const thumbnailStripContainer = document.createElement('div');
		thumbnailStripContainer.classList.add(CLASS_NAMES.UG_GALLERY_THUMBNAIL_STRIP_CONTAINER);
		bottomStripeContainer.appendChild(thumbnailStripContainer);
		thumbnailStripContainer.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent thumbnail strip interaction from triggering image drag


		const thumbnailStrip = document.createElement('div');
		thumbnailStrip.classList.add(CLASS_NAMES.UG_THUMBNAIL_STRIP);
		thumbnailStripContainer.appendChild(thumbnailStrip);

		const gridCloseButton = document.createElement('button');
		gridCloseButton.textContent = BUTTONS.CLOSE;
		gridCloseButton.classList.add(CLASS_NAMES.UG_GALLERY_GRID_CLOSE);
		gridView.appendChild(gridCloseButton);
		gridCloseButton.addEventListener('click', closeGallery);
		gridCloseButton.setAttribute('aria-label', 'Close Gallery'); // Accessibility

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

			// Thumbnails for expanded view strip
			const stripThumbnail = document.createElement('img');
			stripThumbnail.src = src;
			stripThumbnail.classList.add(CLASS_NAMES.UG_THUMBNAIL);
			stripThumbnail.dataset.index = index;
			stripThumbnail.setAttribute('aria-label', `Thumbnail ${index + 1}`); // Accessibility
			stripThumbnail.addEventListener('click', () => showExpandedView(index));
			thumbnailStrip.appendChild(stripThumbnail);
		});

		showGridView();
	};

	const showGridView = () => {
		if (!galleryOverlay) return;
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_GRID_VIEW}`).classList.remove(CLASS_NAMES.UG_GALLERY_HIDE);
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_EXPANDED_VIEW}`).classList.add(CLASS_NAMES.UG_GALLERY_HIDE);
		resetZoom(); // Reset zoom when going back to grid
		state.isZoomed = false;
		updateZoomToggleButton(); // Update zoom toggle button state
		state.controlsVisible = true; // Show controls when returning to grid
	};

	const showExpandedView = (index) => {
		if (!galleryOverlay) return;

		const mainImage = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE}`);
		const counter = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_COUNTER}`);
		const prevButton = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_PREV}`);
		const nextButton = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_NEXT}`);
		const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_THUMBNAIL_STRIP}`);
		const zoomControls = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_ZOOM_CONTROLS}`);

		if (index < 0 || index >= state.fullSizeImageSrcs.length) {
			console.error("Invalid image index:", index);
			return;
		}

		const imageUrl = state.fullSizeImageSrcs[index];

		mainImage.onload = () => {
			// Image loaded successfully
		};

		mainImage.onerror = () => {
			console.error("Error loading image:", imageUrl);
			mainImage.src = ''; // Clear src to prevent retries
			mainImage.alt = "Error loading image";
		};

		mainImage.src = imageUrl;
		mainImage.alt = `Image ${index + 1} of ${state.fullSizeImageSrcs.length}`;
		resetZoom(); // Reset zoom when loading a new image
		state.isZoomed = false;
		updateZoomToggleButton(); // Update zoom toggle button state
		state.controlsVisible = true; // Ensure controls are visible when image changes

		counter.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;

		state.currentGalleryIndex = index;

		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_GRID_VIEW}`).classList.add(CLASS_NAMES.UG_GALLERY_HIDE); // Hide grid view
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_EXPANDED_VIEW}`).classList.remove(CLASS_NAMES.UG_GALLERY_HIDE); // Show expanded view
		counter.classList.remove(CLASS_NAMES.UG_GALLERY_HIDE); // Show counter
		prevButton.classList.remove(CLASS_NAMES.UG_GALLERY_HIDE); // Show nav buttons
		nextButton.classList.remove(CLASS_NAMES.UG_GALLERY_HIDE);
		zoomControls.classList.remove(CLASS_NAMES.UG_GALLERY_HIDE); // Show zoom controls if zoom is enabled
		thumbnailStrip.scrollLeft = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_THUMBNAIL}[data-index="${index}"]`).offsetLeft - thumbnailStrip.offsetWidth / 2 + 50; // Scroll to selected thumbnail

		// Update thumbnail strip selection
		galleryOverlay.querySelectorAll(`.${CLASS_NAMES.UG_THUMBNAIL}`).forEach(thumb => {
			thumb.classList.remove('selected');
		});
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_THUMBNAIL}[data-index="${index}"]`).classList.add('selected');

		// Update nav button visibility based on index
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

	// Zoom functions
	const toggleZoom = () => {
		if (!state.zoomEnabled) return;

		state.isZoomed = !state.isZoomed;
		updateZoomToggleButton();
		const zoomControls = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_ZOOM_CONTROLS}`);

		if (state.isZoomed) {
			zoomControls.classList.remove(CLASS_NAMES.UG_GALLERY_HIDE);
		} else {
			zoomControls.classList.add(CLASS_NAMES.UG_GALLERY_HIDE);
			resetZoom();
		}
	};

	const updateZoomToggleButton = () => {
		if (elements.zoomToggleButton) {
			elements.zoomToggleButton.textContent = state.isZoomed ? BUTTONS.GRID_VIEW : BUTTONS.EXPANDED_VIEW;
			elements.zoomToggleButton.setAttribute('aria-label', state.isZoomed ? 'Grid View' : 'Expanded View');
		}
	};

	const zoomIn = () => {
		if (!state.zoomEnabled || !state.isZoomed) return;
		state.zoomScale = Math.min(state.zoomScale + 0.25, 2);
		applyZoom();
	};

	const zoomOut = () => {
		if (!state.zoomEnabled || !state.isZoomed) return;
		state.zoomScale = Math.max(state.zoomScale - 0.25, 0.25);
		applyZoom();
	};

	const resetZoom = () => {
		state.zoomScale = 1;
		state.imageOffset = {
			x: 0,
			y: 0
		};
		applyZoom();
	};

	const applyZoom = () => {
		const mainImageContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`);
		mainImageContainer.style.transform = `scale(${state.zoomScale}) translate(${state.imageOffset.x}px, ${state.imageOffset.y}px)`;
		if (state.isZoomed && state.zoomScale > 1) {
			mainImageContainer.classList.add(CLASS_NAMES.UG_GRABBING_CURSOR);
		} else {
			mainImageContainer.classList.remove(CLASS_NAMES.UG_GRABBING_CURSOR);
		}
	};

	const handleImageClickForZoom = () => {
		if (state.zoomEnabled) {
			toggleZoom();
		}
	};

	const handleWheelZoom = (event) => {
		if (!state.zoomEnabled || !state.isZoomed) return;
		event.preventDefault();
		const delta = event.deltaY > 0 ? -0.25 : 0.25;
		state.zoomScale = Math.max(0.25, Math.min(state.zoomScale + delta, 2));
		applyZoom();
	};

	const toggleControlsVisibility = () => {
		state.controlsVisible = !state.controlsVisible;
	};

	// Dragging functions
	const startDrag = (event) => {
		if (!state.isZoomed || state.zoomScale <= 1) return;
		state.isDragging = true;
		state.dragStartPosition = {
			x: event.clientX,
			y: event.clientY
		};
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`).style.cursor = 'grabbing';
	};

	const dragImage = (event) => {
		if (!state.isDragging) return;

		const deltaX = event.clientX - state.dragStartPosition.x;
		const deltaY = event.clientY - state.dragStartPosition.y;

		state.imageOffset = {
			x: state.imageOffset.x + deltaX,
			y: state.imageOffset.y + deltaY
		};
		applyZoom();
		state.dragStartPosition = {
			x: event.clientX,
			y: event.clientY
		};
	};

	// Debounced drag function
	const debouncedDragImage = debounce(dragImage, DEBOUNCE_DELAY);

	const endDrag = () => {
		state.isDragging = false;
		galleryOverlay.querySelector(`.${CLASS_NAMES.UG_MAIN_IMAGE_CONTAINER}`).style.cursor = 'grab';
	};


	const handleGalleryKey = (event) => {
		if (!isPostPage()) return;

		if (event.key === state.galleryKey && state.galleryReady) {
			toggleGallery();
		} else if (state.isGalleryMode && !galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_GRID_VIEW}`).classList.contains(CLASS_NAMES.UG_GALLERY_HIDE)) {
			return;
		} else if (state.isGalleryMode) {
			if (['Escape', state.prevImageKey, state.nextImageKey, 'ArrowLeft', 'ArrowRight', '+', '-', 'k', 'l'].includes(event.key)) {
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
					case '+':
						zoomIn();
						break;
					case '-':
						zoomOut();
						break;
				}
			}
		}
	};

	// --- Keyboard event handlers ---
	const handleSettingsKey = (event) => {
		if (state.settingsOpen && event.key === 'Escape') {
			state.settingsOpen = false;
		}
	};
	// Function to simulate button clicks for all images
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

	// --- Downloading and Post Actions ---
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

	// Function to download a single image by its index
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

	const initPostActions = () => {
		state.postActionsInitialized = true;
		if (!isPostPage() || state.currentPostUrl === window.location.href) return;
		cleanupPostActions(); // Clean up before doing anything

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
				const galleryButton = createToggleButton('Loading Gallery...', toggleGallery, true); // Initially disabled, toggleGallery function
				elements.galleryButton = galleryButton;

				const heightButton = createToggleButton(BUTTONS.HEIGHT, () => clickAllImageButtons('height'));
				const widthButton = createToggleButton(BUTTONS.WIDTH, () => clickAllImageButtons('width'));
				const fullButton = createToggleButton(BUTTONS.FULL, () => clickAllImageButtons('full'));

				elements.postActions.append(heightButton, widthButton, fullButton, downloadAllButton, galleryButton);
				elements.galleryButton.style.display = 'inline-block'; // Always show
			}
		}

		// settings button
		if (!elements.settingsButton) {
			const settingsButton = document.createElement('button');
			settingsButton.textContent = BUTTONS.SETTINGS;
			settingsButton.className = CLASS_NAMES.SETTINGS_BUTTON;
			settingsButton.addEventListener('click', () => {
				state.settingsOpen = !state.settingsOpen;
			});
			document.body.appendChild(settingsButton); // Append to body
			elements.settingsButton = settingsButton; // Keep track of it
		}

		const fileDivs = document.querySelectorAll(SELECTORS.FILE_DIVS);
		const parentDiv = fileDivs[0]?.parentNode;

		if (parentDiv) {
			state.displayedImages = Array.from(document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img'));

			const existingButtonGroups = Array.from(parentDiv.querySelectorAll(`.${CLASS_NAMES.UG_BUTTON_CONTAINER}`));
			existingButtonGroups.forEach(buttonGroup => {
				const imageContainer = buttonGroup.nextElementSibling;
				if (!imageContainer || !state.displayedImages.some(img => img.closest(SELECTORS.THUMBNAIL) === imageContainer)) {
					buttonGroup.remove(); // Remove only if not associated with a current image
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

					state.virtualGallery.splice(index, 1); // Remove from virtual gallery
					state.originalImageSrcs.splice(index, 1); // And original srcs
					state.totalImages--;
					state.displayedImages.splice(index, 1); // and displayed images
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
						}, // Add name for hiding
						{
							text: BUTTONS.DOWNLOAD,
							action: () => downloadImageByIndex(index),
							name: 'DOWNLOAD'
						}, // Add name for hiding
						{
							text: BUTTONS.REMOVE,
							action: removeImage,
							name: 'REMOVE'
						} // Add name for hiding
					]);

					const thumbnail = img.closest(SELECTORS.THUMBNAIL);
					if (thumbnail && thumbnail.parentNode) {
						thumbnail.parentNode.insertBefore(newDiv, thumbnail);
					}
				}
				img.addEventListener('click', () => toggleGallery()); // Open gallery on thumbnail click
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

	// Function to update the gallery button state
	const updateGalleryButton = (enabled) => {
		if (elements.galleryButton) {
			elements.galleryButton.textContent = enabled ? BUTTONS.GALLERY : 'Loading Gallery...';
			elements.galleryButton.disabled = !enabled;
			elements.galleryButton.classList.toggle('disabled', !enabled);
		}
	};

	// Function to clean up post actions and UI elements
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

	// Function to resize all images
	const resizeAllImages = (action) => {
		document
			.querySelectorAll(SELECTORS.FILES_IMG)
			.forEach((img) => {
				if (imageActions[action]) {
					imageActions[action](img);
				}
			});
	};

	// Function to resize a single image
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

	// Function to show the loading overlay
	const showLoadingOverlay = (text) => {
		if (!elements.loadingOverlay) {
			elements.loadingOverlay = createLoadingOverlay(text);
			document.body.appendChild(elements.loadingOverlay);
		} else {
			updateLoadingOverlayText(text);
		}
	};

	// Function to update the loading overlay text
	const updateLoadingOverlayText = (text) => {
		if (elements.loadingOverlay) {
			const loadingText = elements.loadingOverlay.querySelector('div');
			if (loadingText) {
				loadingText.textContent = text;
			}
		}
	};

	// Function to hide the loading overlay
	const hideLoadingOverlay = () => {
		if (elements.loadingOverlay) {
			elements.loadingOverlay.remove();
			elements.loadingOverlay = null;
		}
	};

	// --- Notification System ---
	// Function to create the notification area
	const createNotificationArea = () => {
		const notificationArea = document.createElement('div');
		notificationArea.id = CLASS_NAMES.NOTIFICATION_AREA;
		notificationArea.classList.add(CLASS_NAMES.NOTIFICATION_AREA);
		document.body.appendChild(notificationArea);
		return notificationArea;
	};

	// Function to create a notification
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

	// Function to show a notification
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
		}
		notificationContainer.style.display = 'flex';
	};

	// Function to hide a notification
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

	// --- Error Handling Functions ---
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
	};


	// --- Mutation Observer and Initialization ---
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
	const injectUI = debounce(() => {
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
	}, DEBOUNCE_DELAY);

	const init = () => {
		if (!galleryKeyListenerAttached) {
			window.addEventListener('keydown', handleGalleryKey);
			window.addEventListener('keydown', handleSettingsKey);
			galleryKeyListenerAttached = true;
		}
		if (!document.getElementById(CLASS_NAMES.NOTIFICATION_AREA) && state.notificationAreaVisible) {
			createNotificationArea();
		}
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