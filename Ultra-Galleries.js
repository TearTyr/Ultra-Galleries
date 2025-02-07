// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.4.1
// @description  Modern image gallery with enhanced browsing, fullscreen, and download features.
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
		url: 'https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/TestingBranch/Ultra-Galleries.css', // Or your CSS file URL
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
		FULLSCREEN: '【FULLSCREEN】',
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
	};

	const MAX_RETRIES = 3;
	const RETRY_DELAY = 1500;
	const IMAGE_BATCH_SIZE = 5;
	const DEBOUNCE_DELAY = 300;

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
		expandedViewActive: false,
		controlsVisible: true,
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
		currentGalleryIndex: 0,
		isFullscreen: false,
		prevImageKey: GM_getValue('prevImageKey', 'k'),
		nextImageKey: GM_getValue('nextImageKey', 'l'),
		bottomStripeVisible: true,
		dynamicResizing: GM_getValue('dynamicResizing', true), // Default to on
	}, {
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
			if (value) {
				showGallery();
			} else {
				closeGallery();
			}
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
		notificationAreaVisible: (value) => {
			const notificationArea = document.getElementById(CLASS_NAMES.NOTIFICATION_AREA);
			if (notificationArea) {
				notificationArea.style.display = value ? 'flex' : 'none';
			}
		},
		isFullscreen: (value, oldValue) => {
			const galleryOverlay = document.getElementById('gallery-overlay');
			if (galleryOverlay) {
				galleryOverlay.classList.toggle(CLASS_NAMES.FULLSCREEN_GALLERY, value);
			}
		},
		bottomStripeVisible: (value) => {
			const bottomStripe = document.querySelector(`.${CLASS_NAMES.BOTTOM_STRIPE}`);
			if (bottomStripe) {
				bottomStripe.style.display = value ? 'flex' : 'none';
			}
		},
	});

	// --- Settings ---
	const createSettingsUI = () => {
		const overlay = document.createElement('div');
		overlay.id = 'ug-settings-overlay';
		overlay.classList.add('ug-settings-overlay');

		const container = document.createElement('div');
		container.id = 'ug-settings-container';
		container.classList.add('ug-settings-container');

		const ribbon = document.createElement('div');
		ribbon.id = 'ug-settings-ribbon';
		ribbon.classList.add('ug-settings-ribbon');

		const content = document.createElement('div');
		content.classList.add('ug-settings-content');

		const closeButton = document.createElement('button');
		closeButton.id = 'ug-settings-close-btn';
		closeButton.classList.add('ug-settings-close-btn');
		closeButton.innerHTML = '×';
		closeButton.addEventListener('click', () => {
			state.settingsOpen = false;
		});

		const tabs = {
			general: {
				label: 'General',
				content: () => {
					const generalContent = document.createElement('div');
					generalContent.classList.add('ug-settings-tab-content');
					generalContent.innerHTML = `
                             <div class="ug-setting">
                                <label for="galleryKey">Gallery Key:</label>
                                <input type="text" id="galleryKey" class="ug-settings-input" value="${state.galleryKey}" maxlength="1">
                                <p class="ug-placeholder-info">Press this key to open the gallery when it's loaded.</p>
                            </div>
                            <div class="ug-setting">
                                <label for="prevImageKey">Previous Image Key:</label>
                                <input type="text" id="prevImageKey" class="ug-settings-input" value="${state.prevImageKey}" maxlength="1">
                                <p class="ug-placeholder-info">Key to navigate to the previous image in expanded view.</p>
                            </div>
                            <div class="ug-setting">
                                <label for="nextImageKey">Next Image Key:</label>
                                <input type="text" id="nextImageKey" class="ug-settings-input" value="${state.nextImageKey}" maxlength="1">
                                <p class="ug-placeholder-info">Key to navigate to the next image in expanded view.</p>
                            </div>
                    `;
					return generalContent;
				},
			},
			options: {
				label: 'Options',
				content: () => {
					const optionsContent = document.createElement('div');
					optionsContent.classList.add('ug-settings-tab-content');
					optionsContent.innerHTML = `
                          <div class="ug-setting">
                                <label for="hideNavArrows">Hide Gallery Navigation Arrows:</label>
                                <input type="checkbox" id="hideNavArrows" class="ug-settings-input" style="width: fit-content;" ${state.hideNavArrows ? 'checked' : ''}>
                            </div>
                            <div class="ug-setting">
                                <label for="hideRemoveButton">Hide Remove Button:</label>
                                <input type="checkbox" id="hideRemoveButton" class="ug-settings-input" style="width: fit-content;" ${state.hideRemoveButton ? 'checked' : ''}>
                            </div>
                             <div class="ug-setting">
                                <label for="hideFullButton">Hide Full Button:</label>
                                <input type="checkbox" id="hideFullButton" class="ug-settings-input" style="width: fit-content;" ${state.hideFullButton ? 'checked' : ''}>
                            </div>
                             <div class="ug-setting">
                                <label for="hideDownloadButton">Hide Download Button:</label>
                                <input type="checkbox" id="hideDownloadButton" class="ug-settings-input" style="width: fit-content;" ${state.hideDownloadButton ? 'checked' : ''}>
                            </div>
                            <div class="ug-setting">
                                <label for="notificationAreaVisible">Hide Notification Area:</label>
                                <input type="checkbox" id="notificationAreaVisible" class="ug-settings-input" style="width: fit-content;" ${state.notificationAreaVisible ? 'checked' : ''}>
                            </div>
                            <div class="ug-setting">
                                <label for="dynamicResizing">Dynamic Image Resizing:</label>
                                <input type="checkbox" id="dynamicResizing" class="ug-settings-input" style="width: fit-content;" ${state.dynamicResizing ? 'checked' : ''}>
                            </div>
                        `;

					optionsContent.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
						checkbox.addEventListener('change', (e) => {
							state[e.target.id] = e.target.checked;
							GM_setValue(e.target.id, e.target.checked);
						});
					});

					return optionsContent;
				},

			},
			filenames: {
				label: 'Filenames',
				content: () => {
					const filenamesContent = document.createElement('div');
					filenamesContent.classList.add('ug-settings-tab-content');
					filenamesContent.innerHTML = `
                             <div class="ug-setting">
                                <label for="zipFileNameFormat">Zip Filename Format:</label>
                                <input type="text" id="zipFileNameFormat" class="ug-settings-input" value="${state.zipFileNameFormat}" placeholder="{title}-{artistName}.zip">
                                <p class="ug-placeholder-info">Available placeholders: {artistName}, {title}</p>
                            </div>
                            <div class="ug-setting">
                                <label for="imageFileNameFormat">Image Filename Format:</label>
                                <input type="text" id="imageFileNameFormat" class="ug-settings-input" value="${state.imageFileNameFormat}" placeholder="{title}-{artistName}-{fileName}-{index}">
                                <p class="ug-placeholder-info">Available placeholders: {artistName}, {title}, {fileName}, {index}, {ext}</p>
                            </div>
                        `;
					return filenamesContent;
				},
			},
			notifications: {
				label: 'Notifications',
				content: () => {
					const notificationsContent = document.createElement('div');
					notificationsContent.classList.add('ug-settings-tab-content');
					notificationsContent.innerHTML = `
                             <div class="ug-setting">
                                <label for="notificationsEnabled">Enable Notifications:</label>
                                <input type="checkbox" id="notificationsEnabled" class="ug-settings-input" style="width: fit-content;" ${state.notificationsEnabled ? 'checked' : ''}>
                            </div>
                            <div class="ug-setting">
                                <label for="animationsEnabled">Enable Animations:</label>
                                <input type="checkbox" id="animationsEnabled" class="ug-settings-input" style="width: fit-content;" ${state.animationsEnabled ? 'checked' : ''}>
                            </div>
                       `;

					notificationsContent.querySelector('#animationsEnabled').addEventListener('change', (e) => {
						state.animationsEnabled = e.target.checked;
						GM_setValue('animationsEnabled', e.target.checked);
					});

					return notificationsContent;
				},
			},
			credits: {
				label: 'Credits',
				content: () => {
					const creditsContent = document.createElement('div');
					creditsContent.classList.add('ug-settings-tab-content');
					creditsContent.innerHTML = `
                        <div class="ug-credits">
                             <p>Original author: ntf</p>
                             <p>Forked by: Meri/TearTyr</p>
                         </div>
                        `;
					return creditsContent;
				}
			}
		};

		let activeTab = 'general';
		const ribbonButtons = {};

		const showTabContent = (tabId) => {
			content.innerHTML = '';
			content.appendChild(tabs[tabId].content());
			activeTab = tabId;
			for (const tabKey in ribbonButtons) {
				ribbonButtons[tabKey].classList.toggle('active', tabKey === activeTab);
			}
		};

		for (const tabId in tabs) {
			const button = document.createElement('button');
			button.textContent = tabs[tabId].label;
			button.classList.add('ug-settings-ribbon-button');
			button.addEventListener('click', () => showTabContent(tabId));
			ribbon.appendChild(button);
			ribbonButtons[tabId] = button;
		}

		const saveSettings = () => {
			state.zipFileNameFormat = document.getElementById('zipFileNameFormat')?.value || state.zipFileNameFormat;
			state.imageFileNameFormat = document.getElementById('imageFileNameFormat')?.value || state.imageFileNameFormat;
			state.galleryKey = document.getElementById('galleryKey')?.value || state.galleryKey;
			state.prevImageKey = document.getElementById('prevImageKey')?.value || state.prevImageKey;
			state.nextImageKey = document.getElementById('nextImageKey')?.value || state.nextImageKey;

			state.zipFileNameFormat = state.zipFileNameFormat.trim();
			state.imageFileNameFormat = state.imageFileNameFormat.trim();
			state.galleryKey = state.galleryKey.trim();
			state.prevImageKey = state.prevImageKey.trim();
			state.nextImageKey = state.nextImageKey.trim();

			GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
			GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
			GM_setValue('galleryKey', state.galleryKey);
			GM_setValue('prevImageKey', state.prevImageKey);
			GM_setValue('nextImageKey', state.nextImageKey);
			state.notificationAreaVisible = document.getElementById('notificationAreaVisible')?.checked;
			GM_setValue('notificationAreaVisible', state.notificationAreaVisible);

			state.settingsOpen = false;
		}

		const saveButton = document.createElement('button');
		saveButton.textContent = 'Save';
		saveButton.className = 'swal2-confirm';
		saveButton.classList.add('ug-settings-save-button');
		saveButton.addEventListener('click', saveSettings);
		content.appendChild(saveButton);
		showTabContent(activeTab);

		container.appendChild(ribbon);
		container.appendChild(content);
		overlay.appendChild(container);
		container.appendChild(closeButton);
		document.body.appendChild(overlay);
	};

	const showSettings = () => {
		createSettingsUI(); // This creates the HTML if it doesn't exist
		const overlay = document.getElementById('ug-settings-overlay');
		if (overlay) {
			// Remove closing class if present, add opening
			overlay.classList.remove('closing');
			overlay.classList.add('opening');
			overlay.style.width = '100%'; // Add this line
			overlay.style.height = '100%'; // Add this line
		}
	};

	const closeSettings = () => {
		const overlay = document.getElementById('ug-settings-overlay');
		if (overlay) {
			overlay.classList.add('closing'); // Add closing class to start animation
			setTimeout(() => {
				overlay.remove();
			}, 300); // Remove after animation (0.3s)
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
		settingsButton: null
	};

	//Variable to track if key listeners have been added
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
		}
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
		elements.virtualGalleryContainer = document.createElement('div'); // Use document here
		elements.virtualGalleryContainer.style.display = 'none';
		state.virtualGallery.forEach((mediaSrc) => {
			if (mediaSrc) {
				const mediaElement = document.createElement('img'); // And here
				mediaElement.src = mediaSrc;
				mediaElement.className = CLASS_NAMES.VIRTUAL_IMAGE;
				elements.virtualGalleryContainer.appendChild(mediaElement);
			}

		});
		document.body.appendChild(elements.virtualGalleryContainer); // And here
	};

	const cleanupVirtualGallery = () => {
		if (elements.virtualGalleryContainer) {
			elements.virtualGalleryContainer.remove();
			elements.virtualGalleryContainer = null;
		}
		state.galleryReady = false;
	};
	// --- Gallery Display and Navigation --- (Rewritten Section) ---

	let galleryOverlay = null; // Store the gallery overlay globally

	// Creates the gallery overlay (only called once)
	const createGalleryOverlay = () => {
		const overlay = document.createElement('div');
		overlay.id = 'gallery-overlay';
		overlay.classList.add('ug-gallery-overlay');

		const galleryModal = document.createElement('div');
		galleryModal.classList.add('ug-gallery-modal');

		const controlsContainer = document.createElement('div');
		controlsContainer.classList.add(CLASS_NAMES.GALLERY_CONTROLS_CONTAINER, CLASS_NAMES.CONTROLS_VISIBLE);

		const closeButton = document.createElement('button');
		closeButton.textContent = '×';
		closeButton.className = CLASS_NAMES.GALLERY_CLOSE_BUTTON;
		closeButton.addEventListener('click', closeGallery); // Use the named function

		const fullscreenButton = document.createElement('button');
		fullscreenButton.textContent = '⛶';
		fullscreenButton.className = CLASS_NAMES.FULLSCREEN_BUTTON;
		fullscreenButton.addEventListener('click', toggleFullscreenGallery);

		//ADD BACK BUTTON
		const backButton = document.createElement('button');
		backButton.textContent = '← Back'; // Or an icon if you prefer
		backButton.className = 'ug-gallery-back-button';
		backButton.addEventListener('click', hideExpandedImage); // Reuse the existing function

		controlsContainer.append(backButton, closeButton, fullscreenButton); // Add backButton first


		const mainView = document.createElement('div');
		mainView.classList.add(CLASS_NAMES.GALLERY_MAIN_VIEW);
		mainView.addEventListener('click', toggleControls); // Toggle controls on click

		const expandedImageContainer = document.createElement('div');
		expandedImageContainer.classList.add(CLASS_NAMES.EXPANDED_VIEW_CONTAINER);

		const expandedMedia = document.createElement('div');
		expandedMedia.classList.add(CLASS_NAMES.UG_GALLERY_EXPANDED_MEDIA);

		const prevButton = createNavigationButton('prev');
		prevButton.addEventListener('click', (event) => {
			event.stopPropagation(); // Prevent event bubbling
			navigateGallery(-1);
		});

		const nextButton = createNavigationButton('next');
		nextButton.addEventListener('click', (event) => {
			event.stopPropagation(); // Prevent event bubbling
			navigateGallery(1);
		});

		const pageNumber = document.createElement('div');
		pageNumber.className = CLASS_NAMES.PAGE_NUMBER;

		const thumbnailStrip = document.createElement('div');
		thumbnailStrip.classList.add(CLASS_NAMES.THUMBNAIL_STRIP);

		const thumbnailGrid = document.createElement('div');
		thumbnailGrid.classList.add(CLASS_NAMES.THUMBNAIL_GRID);

		const bottomStripe = document.createElement('div');
		bottomStripe.classList.add(CLASS_NAMES.BOTTOM_STRIPE);

		// Assemble the gallery elements
		mainView.append(expandedImageContainer);
		//controlsContainer.append(closeButton, fullscreenButton); //MOVED
		galleryModal.append(controlsContainer, mainView, bottomStripe, pageNumber, prevButton, nextButton);
		expandedImageContainer.append(expandedMedia);
		overlay.appendChild(galleryModal);

		bottomStripe.appendChild(thumbnailStrip);
		bottomStripe.appendChild(thumbnailGrid);

		return overlay;
	};

	const toggleFullscreenGallery = () => {
		state.isFullscreen = !state.isFullscreen;
	};

	const toggleControls = () => {
		state.controlsVisible = !state.controlsVisible;
		updateControlVisibility();
		state.bottomStripeVisible = state.controlsVisible; // Sync bottom stripe visibility
	};

	const updateControlVisibility = () => {
		if (!galleryOverlay) return;
		const controlsContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_CONTROLS_CONTAINER}`);
		if (controlsContainer) {
			controlsContainer.classList.toggle(CLASS_NAMES.CONTROLS_VISIBLE, state.controlsVisible);
			controlsContainer.classList.toggle(CLASS_NAMES.CONTROLS_HIDDEN, !state.controlsVisible);
		}
	};
	// Add this helper function (outside of updateExpandedView, but in the same scope)
	const toggleImageSize = (img) => {
		if (img.classList.contains('ug-resized')) {
			// Currently resized, revert to original
			img.style.maxWidth = '100%';
			img.style.maxHeight = '100%';
			img.style.width = 'auto';
			img.style.height = 'auto';
			img.classList.remove('ug-resized');
		} else {
			// Currently at original size, resize to fit
			updateMediaElementSize(img, galleryOverlay); // Use the existing function
			img.classList.add('ug-resized');
		}
	};
	// Updates the content of the expanded view with the image at the given index.
	const updateExpandedView = (index) => {
		if (!galleryOverlay) return;

		const expandedMedia = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_EXPANDED_MEDIA}`);
		if (!expandedMedia) return;
		expandedMedia.innerHTML = ''; // Clear previous content

		const imageSrc = state.fullSizeImageSrcs[index];
		if (!imageSrc) {
			console.error("Image source is undefined for index:", index);
			return;
		}

		const img = new Image();
		img.src = imageSrc;
		img.classList.add('ug-gallery-expanded-media-item', 'visible'); // Add visibility class
		img.onload = () => {
			// Image loaded, update size and append
			updateMediaElementSize(img, galleryOverlay);
			expandedMedia.appendChild(img);
		};
		img.onerror = () => {
			console.error("Error loading image:", imageSrc);
			expandedMedia.textContent = "Error loading image."; // Display error message
		};
		// Inside updateExpandedView, AFTER creating the 'img' element:
		if (state.dynamicResizing) {
			img.addEventListener('click', (event) => {
				event.stopPropagation(); // Prevent the mainView click (toggleControls)
				toggleImageSize(img);
			});
		}
		// Update page number
		const pageNumber = galleryOverlay.querySelector(`.${CLASS_NAMES.PAGE_NUMBER}`);
		if (pageNumber) {
			pageNumber.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
		}
	};


	// Updates the thumbnail strip (for expanded view)
	const updateThumbnailStrip = () => {
		if (!galleryOverlay) return;
		const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_STRIP}`);
		if (!thumbnailStrip) return;

		thumbnailStrip.innerHTML = ''; // Clear existing thumbnails
		state.fullSizeImageSrcs.forEach((src, index) => {
			if (!src) return; // Skip if src is null

			const thumbnailContainer = document.createElement('div');
			thumbnailContainer.classList.add(CLASS_NAMES.UG_THUMBNAIL_CONTAINER);

			const thumbnail = document.createElement('img');
			thumbnail.src = src;
			thumbnail.className = CLASS_NAMES.UG_GALLERY_THUMBNAIL;
			thumbnail.classList.toggle('active', index === state.currentGalleryIndex);
			thumbnail.addEventListener('click', () => showExpandedImage(index));

			thumbnailContainer.appendChild(thumbnail);
			thumbnailStrip.appendChild(thumbnailContainer);
		});
	};

	// Updates the thumbnail grid (for initial view)
	const updateThumbnailGrid = () => {
		if (!galleryOverlay) return;
		const thumbnailGrid = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_GRID}`);
		if (!thumbnailGrid) return;

		thumbnailGrid.innerHTML = ''; // Clear existing thumbnails

		state.fullSizeImageSrcs.forEach((src, index) => {
			if (!src) return; // Skip null sources

			const thumbnailContainer = document.createElement('div');
			thumbnailContainer.classList.add(CLASS_NAMES.UG_GALLERY_THUMBNAIL_GRID_CONTAINER);

			const thumbnail = document.createElement('img');
			thumbnail.src = src;
			thumbnail.className = CLASS_NAMES.UG_GALLERY_THUMBNAIL_GRID;
			thumbnail.addEventListener('click', () => showExpandedImage(index));

			thumbnailContainer.appendChild(thumbnail);
			thumbnailGrid.appendChild(thumbnailContainer);
		});

		// Adjust grid layout based on modal width
		const galleryModal = galleryOverlay.querySelector('.ug-gallery-modal');
		if (galleryModal) {
			const modalWidth = galleryModal.offsetWidth;
			const numColumns = Math.max(2, Math.floor((modalWidth - 20) / 150)); // At least 2 columns
			thumbnailGrid.style.gridTemplateColumns = `repeat(${numColumns}, 1fr)`;
		}
	};

	// Shows the expanded image view for a specific image.
	const showExpandedImage = (index) => {
		if (!galleryOverlay) return;

		state.expandedViewActive = true;
		state.currentGalleryIndex = index;

		// Hide grid, show strip
		const thumbnailGrid = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_GRID}`);
		const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_STRIP}`);
		if (thumbnailGrid) thumbnailGrid.style.display = 'none';
		if (thumbnailStrip) thumbnailStrip.style.display = 'flex';

		// Show/hide navigation buttons
		const prevButton = galleryOverlay.querySelector('.navigation-button.prev');
		const nextButton = galleryOverlay.querySelector('.navigation-button.next');
		if (prevButton && nextButton) {
			prevButton.style.display = state.hideNavArrows ? 'none' : 'flex';
			nextButton.style.display = state.hideNavArrows ? 'none' : 'flex';
		}

		// Add download button if it doesn't exist
		const controlsContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_CONTROLS_CONTAINER}`);
		if (controlsContainer && !controlsContainer.querySelector(`.${CLASS_NAMES.DOWNLOAD_BUTTON}`)) {
			const downloadButton = document.createElement('button');
			downloadButton.textContent = '↓';
			downloadButton.className = CLASS_NAMES.DOWNLOAD_BUTTON;
			downloadButton.addEventListener('click', () => downloadImageByIndex(state.currentGalleryIndex));
			controlsContainer.appendChild(downloadButton);
		}

		updateExpandedView(index);
		updateThumbnailStrip();
		state.bottomStripeVisible = false; // Hide bottom stripe in expanded view
	};

	// Hides the expanded image view.
	const hideExpandedImage = () => {
		if (!galleryOverlay) return;

		state.expandedViewActive = false;

		// Clear expanded view
		const expandedMedia = galleryOverlay.querySelector(`.${CLASS_NAMES.UG_GALLERY_EXPANDED_MEDIA}`);
		if (expandedMedia) expandedMedia.innerHTML = '';

		// Show grid, hide strip
		const thumbnailGrid = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_GRID}`);
		const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_STRIP}`);
		if (thumbnailGrid) thumbnailGrid.style.display = 'grid';
		if (thumbnailStrip) thumbnailStrip.style.display = 'none';

		// Hide navigation buttons
		const prevButton = galleryOverlay.querySelector('.navigation-button.prev');
		const nextButton = galleryOverlay.querySelector('.navigation-button.next');
		if (prevButton && nextButton) {
			prevButton.style.display = 'none';
			nextButton.style.display = 'none';
		}

		// Remove download button
		const controlsContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_CONTROLS_CONTAINER}`);
		const downloadButton = controlsContainer.querySelector(`.${CLASS_NAMES.DOWNLOAD_BUTTON}`);
		if (downloadButton) {
			downloadButton.remove();
		}

		state.bottomStripeVisible = true; // Show bottom stripe
	};

	// Navigates to the next or previous image in the gallery.
	const navigateGallery = (direction) => {
		if (!galleryOverlay) return;

		const numImages = state.fullSizeImageSrcs.length;
		let newIndex = (state.currentGalleryIndex + direction + numImages) % numImages;
		showExpandedImage(newIndex);
	};

	// Function to update media element size
	const updateMediaElementSize = (mediaElement, galleryOverlay) => {
		const expandedMedia = galleryOverlay.querySelector('.ug-gallery-expanded-media');
		if (!expandedMedia || !mediaElement) return;

		mediaElement.style.maxWidth = '100%';
		mediaElement.style.maxHeight = '100%';
		mediaElement.style.width = 'auto';
		mediaElement.style.height = 'auto';

		const naturalWidth = mediaElement.naturalWidth;
		const naturalHeight = mediaElement.naturalHeight;

		if (naturalWidth && naturalHeight) {
			const availableWidth = expandedMedia.offsetWidth;
			const availableHeight = expandedMedia.offsetHeight;
			const aspectRatio = naturalWidth / naturalHeight;
			let newWidth = availableWidth;
			let newHeight = availableWidth / aspectRatio;

			if (newHeight > availableHeight) {
				newHeight = availableHeight;
				newWidth = availableHeight * aspectRatio;
			}

			mediaElement.style.width = `${newWidth}px`;
			mediaElement.style.height = `${newHeight}px`;
		} else {
			console.warn('Could not determine natural dimensions for', mediaElement);
		}
	};

	// Shows the gallery (initial view with the grid).
	const showGallery = () => {
		if (!isPostPage() || !state.galleryReady) return;

		// Reset to grid view
		state.expandedViewActive = false;

		if (!galleryOverlay) {
			galleryOverlay = createGalleryOverlay(); // Create if it doesn't exist
			document.body.appendChild(galleryOverlay);
		}

		updateThumbnailGrid(); // Populate the grid

		// Show grid, hide strip initially
		const thumbnailGrid = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_GRID}`);
		const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_STRIP}`);
		if (thumbnailGrid) thumbnailGrid.style.display = 'grid';
		if (thumbnailStrip) thumbnailStrip.style.display = 'none';

		// Hide nav buttons and download button
		const prevButton = galleryOverlay.querySelector('.navigation-button.prev');
		const nextButton = galleryOverlay.querySelector('.navigation-button.next');
		if (prevButton) prevButton.style.display = 'none';
		if (nextButton) nextButton.style.display = 'none';

		const controlsContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_CONTROLS_CONTAINER}`);
		const downloadButton = controlsContainer.querySelector(`.${CLASS_NAMES.DOWNLOAD_BUTTON}`);
		if (downloadButton) downloadButton.style.display = 'none';

		state.isGalleryMode = true;
		state.bottomStripeVisible = true; // Show bottom stripe
	};

	// Closes the gallery.
	const closeGallery = () => {
		if (galleryOverlay) {
			document.body.removeChild(galleryOverlay);
			galleryOverlay = null; // Remove reference
		}
		state.isGalleryMode = false;
		state.expandedViewActive = false;
		state.loadingMessage = null;
		state.isFullscreen = false;
	};

	// --- Keyboard event handlers ---
	const handleGalleryKey = (event) => {
		if (!isPostPage()) return;

		if (event.key === state.galleryKey && state.galleryReady) {
			state.isGalleryMode = !state.isGalleryMode; // Toggle gallery mode
			if (!state.isGalleryMode) state.isFullscreen = false; // Reset fullscreen on close
		} else if (state.isGalleryMode && state.expandedViewActive) {
			// Handle keys within expanded view
			if (['Escape', state.prevImageKey, state.nextImageKey, 'ArrowLeft', 'ArrowRight', 'k', 'l'].includes(event.key)) {
				event.preventDefault();
				switch (event.key) {
					case 'Escape':
						hideExpandedImage();
						break;
					case state.prevImageKey:
					case 'ArrowLeft':
					case 'k':
						navigateGallery(-1);
						break;
					case state.nextImageKey:
					case 'ArrowRight':
					case 'l':
						navigateGallery(1);
						break;
				}
			}
		} else if (state.isGalleryMode && event.key === 'Escape') {
			closeGallery(); // Close gallery on Escape
		}
	};


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
				const galleryButton = createToggleButton('Loading Gallery...', () => {
					state.isGalleryMode = !state.isGalleryMode;
				}, true); // Initially disabled
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
				img.addEventListener('click', () => showExpandedImage(index));
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
			notificationContainer.style.animation = 'ug-slide-in 0.5s ease-in-out forwards';
		} else {
			notificationContainer.style.animation = 'none';
		}
		notificationContainer.style.display = 'flex';
	};

	// Function to hide a notification
	const hideNotification = () => {
		const notificationContainer = document.getElementById(CLASS_NAMES.NOTIFICATION_CONTAINER);
		if (!notificationContainer) return;

		if (state.animationsEnabled) {
			notificationContainer.style.animation = 'ug-slide-out 0.5s ease-in-out forwards';
			setTimeout(() => {
				notificationContainer.style.display = 'none';
			}, 500);
		} else {
			notificationContainer.style.animation = 'none';
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
				showExpandedImage(index);
			}
		}
	};

	let uiCache = {};
	let previousPageUrl = null;
	const injectUI = debounce(() => {
		// Very first thing: check if we're on a post page.  If not, return immediately.
		if (!isPostPage()) {
			// Reset state when leaving a post page
			state.postActionsInitialized = false;
			state.notification = null;
			state.notificationType = 'info';
			state.loadingMessage = null;
			state.isLoading = false;
			state.galleryReady = false; // Ensure gallery is marked as not ready
			state.hasImages = false;
			state.totalImages = 0;
			cleanupPostActions(); // Clean up any existing elements
			uiCache = {}; // Clear UI cache
			previousPageUrl = null; // Clear previous URL
			return; // Exit early
		}

		const mediaLinks = [...document.querySelectorAll(SELECTORS.IMAGE_LINK)];
		const currentTotalImages = mediaLinks.length;
		const currentPageUrl = window.location.href;

		const postSection = document.querySelector('.site-section.site-section--post');

		// If we're on a new post page, or re-visiting a post page and haven't initialized:
		if (!state.postActionsInitialized && postSection) {
			// Reset gallery state for the new post
			state.galleryReady = false;
			state.loadedImages = 0;
			state.hasImages = false;
			state.totalImages = currentTotalImages; // Set total images for this post

			const hasMediaContent = document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;
			if (hasMediaContent) {
				// Create status container if it doesn't exist
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
			// Load images and initialize post actions
			loadImages();
			initPostActions();
			state.currentPostUrl = currentPageUrl; // Track the current post URL
			previousPageUrl = currentPageUrl;
		}
		// Handle URL changes within the same post (e.g., navigating to different pages of the same post)
		else if (currentPageUrl !== state.currentPostUrl) {
			cleanupPostActions(); // Clean up previous UI
			state.totalImages = currentTotalImages;
			state.galleryReady = false; // Reset gallery readiness
			state.loadedImages = 0; // Reset loaded images count
			state.hasImages = false;
			state.notification = null; // Clear any previous notifications
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
				// If no media content, remove the status container if it exists
				if (elements.statusContainer) {
					elements.statusContainer.remove();
					elements.statusContainer = null;
					elements.statusElement = null;
				}
			}
			loadImages();
			initPostActions(); // Re-initialize post actions
			state.currentPostUrl = currentPageUrl; // Update current post URL
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