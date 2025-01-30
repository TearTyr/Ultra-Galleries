// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.4
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
		FULLSCREEN: '【FULLSCREEN】', // Added FULLSCREEN button
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
		FULLSCREEN_BUTTON: 'ug-fullscreen-button', // Added FULLSCREEN_BUTTON class
		NO_CLICK: 'ug-no-click',
		FADE_OUT: 'fade-out',
		FADE_IN: 'fade-in',
		THUMBNAIL_CROPPED: 'thumbnail-cropped',
		THUMBNAIL_VISIBLE: 'thumbnail-visible',
		GALLERY_CONTROLS_CONTAINER: 'ug-gallery-controls-container',
		CONTROLS_VISIBLE: 'ug-controls-visible',
		CONTROLS_HIDDEN: 'ug-controls-hidden',
		FULLSCREEN_GALLERY: 'fullscreen-gallery', // Added FULLSCREEN_GALLERY class
		EXPANDED_VIEW_CONTAINER: 'ug-expanded-view-container', // Added container for expanded view
	};

	const MAX_RETRIES = 3;
	const RETRY_DELAY = 1500;
	const IMAGE_BATCH_SIZE = 5;
	const DEBOUNCE_DELAY = 300;

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

	// --- Helper function to create button groups (for redundancy reduction) ---
	const createButtonGroup = (buttonsConfig) => {
		const newDiv = document.createElement('div');
		newDiv.classList.add(CLASS_NAMES.UG_BUTTON_CONTAINER);
		buttonsConfig.forEach(config => {
			const button = createToggleButton(config.text, config.action);
			newDiv.append(button);
			button.classList.add(CLASS_NAMES.UG_BUTTON); // Ensure class is added
		});
		return newDiv;
	};

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
		isFullscreen: false, // Added isFullscreen state
	}, {
		galleryReady: (value) => {
			if (value) {
				updateGalleryButton(true);
			} else {
				updateGalleryButton(false);
			}
		},
		loadedImages: (value, oldValue) => {
			// Update status when loadedImages changes
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
			// Only update the status if totalImages changes from 0 to a positive number
			if (oldValue === 0 && value > 0) {
				state.notification = `Loading media (${state.loadedImages}/${value})...`;
			} else if (value > 0) {
				state.notification = `Loading media (${state.loadedImages}/${value})...`;
			}
			// Set hasImages flag based on totalImages
			state.hasImages = value > 0;
			console.log("totalImages changed:", value, "hasImages:", state.hasImages); // Debug log
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
			// Show/hide gallery button based on hasImages
			if (elements.galleryButton) {
				elements.galleryButton.style.display = value ? 'inline-block' : 'none';
				console.log("galleryButton display updated:", elements.galleryButton.style.display); // Debug log
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
                        `;

					// Attach change events to the checkboxes to update the state
					optionsContent.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
						checkbox.addEventListener('change', (e) => {
							state[e.target.id] = e.target.checked; // Update state
							GM_setValue(e.target.id, e.target.checked); // Persist setting
							console.log(`Setting ${e.target.id} changed to ${e.target.checked}`);
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
						console.log(`Setting animationsEnabled changed to ${e.target.checked}`);
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
		const ribbonButtons = {}; // Store buttons for active styling

		const showTabContent = (tabId) => {
			content.innerHTML = '';
			content.appendChild(tabs[tabId].content());
			activeTab = tabId; // Update activeTab
			// Update styles based on activeTab
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
			ribbonButtons[tabId] = button; // Store the button
		}

		// Function to save settings and close
		const saveSettings = () => {
			state.zipFileNameFormat = document.getElementById('zipFileNameFormat')?.value || state.zipFileNameFormat;
			state.imageFileNameFormat = document.getElementById('imageFileNameFormat')?.value || state.imageFileNameFormat;
			state.galleryKey = document.getElementById('galleryKey')?.value || state.galleryKey;

			// Trim whitespace from input values before saving
			state.zipFileNameFormat = state.zipFileNameFormat.trim();
			state.imageFileNameFormat = state.imageFileNameFormat.trim();
			state.galleryKey = state.galleryKey.trim();

			GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
			GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
			GM_setValue('galleryKey', state.galleryKey);
			state.notificationAreaVisible = document.getElementById('notificationAreaVisible')?.checked;
			GM_setValue('notificationAreaVisible', state.notificationAreaVisible);

			state.settingsOpen = false;
		}

		// Create the save button
		const saveButton = document.createElement('button');
		saveButton.textContent = 'Save';
		saveButton.className = 'swal2-confirm';
		saveButton.classList.add('ug-settings-save-button'); // Added class for styling
		saveButton.addEventListener('click', saveSettings);
		content.appendChild(saveButton);
		showTabContent(activeTab); // Default active tab

		container.appendChild(ribbon);
		container.appendChild(content);
		overlay.appendChild(container);
		container.appendChild(closeButton);
		document.body.appendChild(overlay);
	};

	const showSettings = () => {
		createSettingsUI();
	};

	const closeSettings = () => {
		const overlay = document.getElementById('ug-settings-overlay');
		if (overlay) {
			overlay.classList.add('closing'); // Add closing class for animation
			setTimeout(() => {
				overlay.remove();
			}, 300);
		}
	};

	// --- Image Loading and Gallery Functions ---

	let elements = {};

	const handleMediaSrc = (mediaLink) => {
		// Removed video check here, only handle image links
		const fileThumbDiv = mediaLink.querySelector('.fileThumb');
		if (fileThumbDiv && fileThumbDiv.getAttribute('href')) {
			return fileThumbDiv.getAttribute('href').split('?')[0];
		}
		if (mediaLink.getAttribute('href')) {
			return mediaLink.getAttribute('href').split('?')[0];
		}
		return null;
	};
	const simulateScrollDown = async () => {
		const originalScrollPosition = window.pageYOffset;
		const maxScrollHeight = document.body.scrollHeight - window.innerHeight;
		const scrollStep = window.innerHeight * 0.75; // Adjust scroll step as needed

		for (let scrollPos = originalScrollPosition; scrollPos < maxScrollHeight; scrollPos += scrollStep) {
			window.scrollTo(0, scrollPos);
			await new Promise(resolve => setTimeout(resolve, 100)); // Short delay
		}

		// Return to the original position
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
								img.onerror = () => {
									console.error(`Image failed to load: ${mediaSrc}`);
									state.loadedImages++;
									state.notification = 'Error loading some media.';
									state.notificationType = 'error';
									reject();
								};
							} else {
								console.error(`Failed to fetch image (status ${response.status}): ${mediaSrc}`);
								state.loadedImages++;
								state.notification = 'Error loading some media.';
								state.notificationType = 'error';
								reject();
							}
						},
						onerror: function(error) {
							console.error(`Failed to fetch image: ${mediaSrc}`, error);
							state.loadedImages++;
							state.notification = 'Error loading some media.';
							state.notificationType = 'error';
							reject();
						},
					});
				});
			}
			state.virtualGallery[index] = mediaSrc;
		} catch (error) {
			console.error(`Failed to load media: ${mediaLink.href}`, error);
			state.virtualGallery[index] = null;
			state.loadedImages++;
			state.notification = 'Error loading some media.';
			state.notificationType = 'error';
		}
	};

	// --- Modified loadImages for Batch Loading ---
	const loadImages = async () => {
		if (!isPostPage() || state.galleryReady || state.isLoading) return;

		state.isLoading = true;
		state.loadingMessage = 'Loading Media...';

		const mediaLinks = [
			...document.querySelectorAll(SELECTORS.IMAGE_LINK),
			// Removed video selectors
			...document.querySelectorAll(SELECTORS.ATTACHMENT_LINK), // Include attachments
		];

		state.totalImages = mediaLinks.length;
		state.virtualGallery = Array(state.totalImages).fill(null);
		state.fullSizeImageSrcs = Array(state.totalImages).fill(null);
		state.loadedImages = 0;
		state.mediaLoaded = {}; // Reset media loaded status

		await simulateScrollDown();

		// Load images in batches
		const batchSize = IMAGE_BATCH_SIZE;
		for (let i = 0; i < mediaLinks.length; i += batchSize) {
			const batchPromises = [];
			for (let j = 0; j < batchSize && i + j < mediaLinks.length; j++) {
				batchPromises.push(loadImage(mediaLinks[i + j], i + j));
			}
			await Promise.all(batchPromises);
		}

		// Check if all images failed to load
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
				// Only create image elements now
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
			elements.virtualGalleryContainer = null; // Reset the container
		}
		state.galleryReady = false;
	};

	// --- Gallery Display and Navigation ---
	let galleryKeyListenerAttached = false;
	let images;
	let currentIndex;

	const createGalleryOverlay = () => {
		const overlay = document.createElement('div');
		overlay.id = 'gallery-overlay';
		overlay.classList.add('ug-gallery-overlay');

		const galleryModal = document.createElement('div');
		galleryModal.classList.add('ug-gallery-modal');

		// Container for controls (to manage visibility with CSS classes)
		const controlsContainer = document.createElement('div');
		controlsContainer.classList.add(CLASS_NAMES.GALLERY_CONTROLS_CONTAINER, CLASS_NAMES.CONTROLS_VISIBLE);

		const closeButton = document.createElement('button');
		closeButton.textContent = '×';
		closeButton.className = CLASS_NAMES.GALLERY_CLOSE_BUTTON;
		closeButton.addEventListener('click', () => {
			state.isGalleryMode = false;
			state.isFullscreen = false; // Exit fullscreen when closing gallery
		});
		const downloadButton = document.createElement('button');
		downloadButton.textContent = '↓';
		downloadButton.className = CLASS_NAMES.DOWNLOAD_BUTTON;
		downloadButton.addEventListener('click', () => {
			downloadImageByIndex(state.currentGalleryIndex);
		});
		const fullscreenButton = document.createElement('button'); // Create fullscreen button
		fullscreenButton.textContent = '⛶';
		fullscreenButton.className = CLASS_NAMES.FULLSCREEN_BUTTON;
		fullscreenButton.addEventListener('click', () => {
			toggleFullscreenGallery();
		});

		const mainView = document.createElement('div');
		mainView.classList.add(CLASS_NAMES.GALLERY_MAIN_VIEW);
		mainView.addEventListener('click', () => {
			state.controlsVisible = !state.controlsVisible;
			updateControlVisibility();
		})

		const expandedImageContainer = document.createElement('div');
		expandedImageContainer.classList.add('ug-gallery-expanded-container');

		// Create a new container for the expanded view
		const expandedViewContainer = document.createElement('div');
		expandedViewContainer.classList.add(CLASS_NAMES.EXPANDED_VIEW_CONTAINER);

		const expandedMedia = document.createElement('div'); // Container for images
		expandedMedia.classList.add('ug-gallery-expanded-media');

		const prevButton = createNavigationButton('prev');
		const nextButton = createNavigationButton('next');

		const pageNumber = document.createElement('div');
		pageNumber.className = CLASS_NAMES.PAGE_NUMBER;

		const thumbnailGrid = document.createElement('div');
		thumbnailGrid.classList.add(CLASS_NAMES.THUMBNAIL_GRID);

		const thumbnailStrip = document.createElement('div');
		thumbnailStrip.classList.add(CLASS_NAMES.THUMBNAIL_STRIP);

		mainView.append(expandedImageContainer);
		controlsContainer.append(closeButton, downloadButton, fullscreenButton, thumbnailStrip, pageNumber); // Added fullscreenButton
		galleryModal.append(controlsContainer, mainView, thumbnailGrid); // Added controlsContainer
		expandedImageContainer.append(expandedViewContainer); // Add expandedViewContainer to expandedImageContainer
		expandedViewContainer.append(expandedMedia); // Add expandedMedia to expandedViewContainer
		galleryModal.append(prevButton, nextButton);
		overlay.appendChild(galleryModal);

		return overlay;
	};

	// Function to toggle fullscreen mode
	const toggleFullscreenGallery = () => {
		state.isFullscreen = !state.isFullscreen;
	};

	const createNavigationButton = (direction) => {
		const button = document.createElement('button');
		button.textContent = direction === 'prev' ? '←' : '→';
		button.className = `${CLASS_NAMES.NAVIGATION_BUTTON} ${direction}`;
		return button;
	};

	// Updated to use CSS classes for control visibility
	const updateControlVisibility = () => {
		const galleryOverlay = document.getElementById('gallery-overlay');
		if (!galleryOverlay) return;

		const controlsContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_CONTROLS_CONTAINER}`);
		if (!controlsContainer) return;

		if (state.controlsVisible) {
			controlsContainer.classList.remove(CLASS_NAMES.CONTROLS_HIDDEN);
			controlsContainer.classList.add(CLASS_NAMES.CONTROLS_VISIBLE);
		} else {
			controlsContainer.classList.remove(CLASS_NAMES.CONTROLS_VISIBLE);
			controlsContainer.classList.add(CLASS_NAMES.CONTROLS_HIDDEN);
		}
	};

	const hideExpandedImage = () => {
		state.expandedViewActive = false;
		const galleryOverlay = document.getElementById('gallery-overlay');
		if (galleryOverlay) {
			galleryOverlay.classList.remove('expanded');
			const expandedMedia = galleryOverlay.querySelector('.ug-gallery-expanded-media');
			expandedMedia.innerHTML = '';

			// Hide navigation buttons
			const mainView = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_MAIN_VIEW}`);
			const prevButton = mainView.querySelector('.navigation-button.prev');
			const nextButton = mainView.querySelector('.navigation-button.next');
			if (prevButton && nextButton) {
				prevButton.style.display = 'none';
				nextButton.style.display = 'none';
			}
		}
		state.loadingMessage = null;
	};

	const updateMediaElementSize = (mediaElement, galleryOverlay) => {
		const expandedMedia = galleryOverlay.querySelector('.ug-gallery-expanded-media');
		if (!expandedMedia || !mediaElement) {
			return;
		}

		// Set initial styles to make the container as big as possible
		mediaElement.style.maxWidth = '100%';
		mediaElement.style.maxHeight = '100%';
		mediaElement.style.width = 'auto';
		mediaElement.style.height = 'auto';

		// Determine if it is a video element (always false now as we only handle images)
		const isVideo = false; //mediaElement.tagName === 'VIDEO';

		// Use natural dimensions for images
		const naturalWidth = mediaElement.naturalWidth;
		const naturalHeight = mediaElement.naturalHeight;

		if (naturalWidth && naturalHeight) {
			const availableWidth = expandedMedia.offsetWidth;
			const availableHeight = expandedMedia.offsetHeight;
			const aspectRatio = naturalWidth / naturalHeight;
			let newWidth = availableWidth;
			let newHeight = availableWidth / aspectRatio;
			// Check if the height exceeds the available height
			if (newHeight > availableHeight) {
				newHeight = availableHeight;
				newWidth = availableHeight * aspectRatio;
			}

			// Apply the new dimensions
			mediaElement.style.width = `${newWidth}px`;
			mediaElement.style.height = `${newHeight}px`;
		} else {
			console.warn('Could not determine natural dimensions for', mediaElement);
		}
	};

	const loadAndDisplayMedia = (index) => {
		if (
			state.fullSizeImageSrcs.length === 0 ||
			index < 0 ||
			index >= state.fullSizeImageSrcs.length
		) {
			console.error('Invalid media index:', index);
			return;
		}

		const mediaSrc = state.fullSizeImageSrcs[index];
		if (!mediaSrc) {
			console.error('Media source is undefined for index:', index);
			return;
		}

		const galleryOverlay = document.getElementById('gallery-overlay');
		if (!galleryOverlay) return;

		// Get the new expanded view container
		const expandedViewContainer = galleryOverlay.querySelector(`.${CLASS_NAMES.EXPANDED_VIEW_CONTAINER}`);
		const expandedMedia = expandedViewContainer.querySelector('.ug-gallery-expanded-media');

		let loadingOverlay = galleryOverlay.querySelector(`.${CLASS_NAMES.LOADING_OVERLAY}`);

		if (!loadingOverlay) {
			loadingOverlay = createLoadingOverlay();
			expandedMedia.appendChild(loadingOverlay); // Append loading overlay to expandedMedia
		}

		expandedMedia.innerHTML = '';

		const mediaElement = new Image(); // Only handle images now


		const onMediaLoad = () => {
			if (expandedMedia.contains(loadingOverlay)) {
				expandedMedia.removeChild(loadingOverlay);
			}
			galleryOverlay.classList.add('expanded');
			mediaElement.classList.add('ug-gallery-expanded-media-item', 'visible');
			expandedMedia.appendChild(mediaElement);

			currentIndex = index;
			state.currentGalleryIndex = index;
			const pageNumber = galleryOverlay.querySelector(`.${CLASS_NAMES.PAGE_NUMBER}`);
			pageNumber.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
			state.loadingMessage = null;

			updateMediaElementSize(mediaElement, galleryOverlay);

			const resizeObserver = new ResizeObserver(() => {
				updateMediaElementSize(mediaElement, galleryOverlay);
			});
			resizeObserver.observe(expandedViewContainer);
		};

		const onMediaError = () => {
			console.error('Failed to load media in expanded view:', mediaSrc);
			if (expandedMedia.contains(loadingOverlay)) {
				expandedMedia.removeChild(loadingOverlay);
			}
			state.loadingMessage = null;
			const pageNumber = galleryOverlay.querySelector(`.${CLASS_NAMES.PAGE_NUMBER}`);
			pageNumber.textContent = 'Error loading media';
		};

		mediaElement.onload = onMediaLoad;
		mediaElement.onerror = onMediaError;
		mediaElement.src = mediaSrc;
	};

	const updateThumbnailStrip = () => {
		const galleryOverlay = document.getElementById('gallery-overlay');
		if (!galleryOverlay) return;
		const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_STRIP}`);
		if (!thumbnailStrip) return;

		thumbnailStrip.innerHTML = ''; // Clear previous thumbnails
		images.forEach((img, index) => {
			const thumbnailContainer = document.createElement('div');
			thumbnailContainer.classList.add('ug-gallery-thumbnail-container');

			const thumbnail = document.createElement('img');
			thumbnail.src = img.src;
			thumbnail.className = `ug-gallery-thumbnail ${
                index === state.currentGalleryIndex ? 'active' : ''
            }`;
			thumbnail.addEventListener('click', () => {
				showExpandedImage(index);
			});

			thumbnailContainer.appendChild(thumbnail);
			thumbnailStrip.appendChild(thumbnailContainer);
		});
	};

	const updateThumbnailGrid = () => {
		const galleryModal = document.querySelector('.ug-gallery-modal');
		const thumbnailGrid = galleryModal.querySelector(`.${CLASS_NAMES.THUMBNAIL_GRID}`);
		const modalWidth = galleryModal.offsetWidth;
		const numColumns = Math.max(2, Math.floor((modalWidth - 20) / 100));
		thumbnailGrid.style.gridTemplateColumns = `repeat(${numColumns}, 1fr)`;
	};

	const showExpandedImage = (index) => {
		state.expandedViewActive = true;
		state.loadingMessage = 'Loading Media...';
		const galleryOverlay = document.getElementById('gallery-overlay');
		if (galleryOverlay) {
			galleryOverlay.classList.add('expanded');
			// Show navigation buttons
			const mainView = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_MAIN_VIEW}`);
			const prevButton = mainView.querySelector('.navigation-button.prev');
			const nextButton = mainView.querySelector('.navigation-button.next');
			const closeButton = galleryOverlay.querySelector(`.${CLASS_NAMES.GALLERY_CLOSE_BUTTON}`);
			const downloadButton = galleryOverlay.querySelector(`.${CLASS_NAMES.DOWNLOAD_BUTTON}`);
			const fullscreenButton = galleryOverlay.querySelector(`.${CLASS_NAMES.FULLSCREEN_BUTTON}`); // Get fullscreen button
			const thumbnailStrip = galleryOverlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_STRIP}`);
			const pageNumber = galleryOverlay.querySelector(`.${CLASS_NAMES.PAGE_NUMBER}`);
			if (prevButton && nextButton && !state.hideNavArrows) {
				prevButton.style.display = 'flex';
				nextButton.style.display = 'flex';
				closeButton.style.display = 'block';
				downloadButton.style.display = 'block';
				fullscreenButton.style.display = 'block'; // Show fullscreen button
				thumbnailStrip.style.display = 'block';
				pageNumber.style.display = 'block';
			}
		}
		state.controlsVisible = true;
		updateControlVisibility();
		loadAndDisplayMedia(index);
		updateThumbnailStrip(); // Update thumbnail strip with the new active index
	};

	const showGallery = () => {
		if (!isPostPage() || !state.galleryReady) return;
		const overlay = createGalleryOverlay();
		const galleryModal = overlay.querySelector('.ug-gallery-modal');
		const mainView = overlay.querySelector(`.${CLASS_NAMES.GALLERY_MAIN_VIEW}`);
		const thumbnailStrip = overlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_STRIP}`);
		const thumbnailGrid = overlay.querySelector(`.${CLASS_NAMES.THUMBNAIL_GRID}`);
		const pageNumber = overlay.querySelector(`.${CLASS_NAMES.PAGE_NUMBER}`);
		images = Array.from(elements.virtualGalleryContainer.querySelectorAll(`.${CLASS_NAMES.VIRTUAL_IMAGE}`));
		currentIndex = 0;
		state.currentGalleryIndex = 0;

		thumbnailGrid.innerHTML = '';
		images.forEach((img, index) => {
			const thumbnailContainer = document.createElement('div');
			thumbnailContainer.classList.add('ug-gallery-thumbnail-container');

			const thumbnail = document.createElement('img');
			thumbnail.src = img.src;
			thumbnail.className = CLASS_NAMES.THUMBNAIL;
			thumbnail.addEventListener('click', () => {
				showExpandedImage(index);
			});
			thumbnailContainer.appendChild(thumbnail);
			thumbnailGrid.appendChild(thumbnailContainer);
		});

		document.body.appendChild(overlay);
		// Show navigation buttons initially
		const prevButton = mainView?.querySelector('.navigation-button.prev');
		const nextButton = mainView?.querySelector('.navigation-button.next');
		const closeButton = galleryModal?.querySelector(`.${CLASS_NAMES.GALLERY_CLOSE_BUTTON}`);
		const downloadButton = galleryModal?.querySelector(`.${CLASS_NAMES.DOWNLOAD_BUTTON}`);
		const fullscreenButton = galleryModal?.querySelector(`.${CLASS_NAMES.FULLSCREEN_BUTTON}`); // Get fullscreen button
		if (prevButton && nextButton) {
			prevButton.style.display = 'flex';
			nextButton.style.display = 'flex';
			if (closeButton) closeButton.style.display = 'block';
			if (downloadButton) downloadButton.style.display = 'block';
			if (fullscreenButton) fullscreenButton.style.display = 'block'; // Show fullscreen button
			if (thumbnailStrip) thumbnailStrip.style.display = 'flex'; // Make sure this is flex
			if (pageNumber) pageNumber.style.display = 'block';
		}

		// Navigation button event listeners
		if (prevButton && nextButton) {
			prevButton.addEventListener('click', () => {
				if (currentIndex > 0) {
					showExpandedImage(currentIndex - 1);
				} else {
					showExpandedImage(images.length - 1);
				}
			});

			nextButton.addEventListener('click', () => {
				if (currentIndex < images.length - 1) {
					showExpandedImage(currentIndex + 1);
				} else {
					showExpandedImage(0);
				}
			});
		}

		// Add resize observer for dynamic resizing
		const resizeObserver = new ResizeObserver(() => {
			updateThumbnailGrid();
		});
		resizeObserver.observe(galleryModal);
	};

	const closeGallery = () => {
		const overlay = document.getElementById('gallery-overlay');
		if (overlay) {
			document.body.removeChild(overlay);
			state.isGalleryMode = false;
			state.expandedViewActive = false;
			state.loadingMessage = null;
			state.isFullscreen = false; // Exit fullscreen when closing gallery
		}
	};

	const handleGalleryKey = (event) => {
		if (!isPostPage()) return;
		if (event.key === state.galleryKey && state.galleryReady) {
			state.isGalleryMode = !state.isGalleryMode;
			if (!state.isGalleryMode) state.isFullscreen = false;
		} else if (state.isGalleryMode) {
			if (event.key === 'Escape') {
				if (state.expandedViewActive) {
					hideExpandedImage();
				} else {
					closeGallery();
				}
			} else if (state.expandedViewActive) {
				event.preventDefault();
				if (event.key === 'ArrowLeft' || event.key === 'k') {
					showExpandedImage((currentIndex - 1 + images.length) % images.length);
				} else if (event.key === 'ArrowRight' || event.key === 'l') {
					showExpandedImage((currentIndex + 1) % images.length);
				}
			}
		}
	};
	const handleSettingsKey = (event) => {
		if (state.settingsOpen && event.key === 'Escape') {
			state.settingsOpen = false;
		}
	}
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
	}

	// --- Downloading and Post Actions ---
	const downloadAllImages = async () => {
		const images = document.querySelectorAll(SELECTORS.IMAGE_LINK);
		const attachmentLinks = document.querySelectorAll(SELECTORS.ATTACHMENT_LINK);
		const title = document.querySelector(SELECTORS.POST_TITLE)?.textContent?.trim() || "Untitled";
		const artistName = document.querySelector(SELECTORS.POST_USER_NAME)?.textContent?.trim() || "Unknown Artist";

		const total = images.length + attachmentLinks.length; // Only count images and attachments
		if (total === 0) return;

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

							// If extension is missing or not detected, try to determine from MIME type
							if (!ext || ext === 'jpg') { // Default to jpg if not detected or if it's just 'jpg'
								const contentType = response.responseHeaders.match(/content-type:\s*([^;]*)/i)?.[1];
								if (contentType) {
									if (contentType.startsWith('image/')) {
										const imageExt = contentType.split('/')[1].replace('jpeg', 'jpg'); // Normalize jpeg to jpg
										if (imageExt && imageExt !== 'octet-stream' && imageExt !== 'x-icon') { // Basic filtering
											ext = imageExt;
											filename = originalFilename.replace(/\.[^/.]+$/, '') + '.' + ext; // Re-apply extension
										}
									} else if (contentType === 'application/octet-stream' && originalFilename.includes('.')) {
										// If octet-stream and original filename has extension, use it
										ext = getExtension(originalFilename);
									}
									// Default to jpg if still no valid extension
									if (!ext || !['jpg', 'png', 'gif', 'webp'].includes(ext)) { // Removed video extensions
										ext = 'jpg';
										filename = originalFilename.replace(/\.[^/.]+$/, '') + '.jpg';
									}
								} else {
									ext = 'jpg'; // Fallback to jpg if content-type is not available
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

	const downloadByAnchor = (url, filename) => {
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.style.display = 'none';
		document.body.appendChild(anchor);
		anchor.click();
		setTimeout(() => {
			document.body.removeChild(anchor);
		}, 100);
	};

	const downloadImageByIndex = (index) => {
		console.log("downloadImageByIndex called with index:", index);
		const mediaSrc = state.fullSizeImageSrcs[index];
		console.log("mediaSrc:", mediaSrc);
		const imgLink = document.querySelectorAll(SELECTORS.IMAGE_LINK)[index]; // Only image links now
		console.log("imgLink:", imgLink);

		if (imgLink) {
			const imgSrc = imgLink.href.split("?")[0];
			console.log("imgSrc:", imgSrc);
			let fileName = imgLink.getAttribute('download');
			console.log("fileName (original):", fileName);

			if (!fileName) {
				fileName = `image_${index + 1}.jpg`;
				console.warn("Download attribute missing, using fallback filename:", fileName);
			}

			// Use downloadByAnchor directly for Firefox compatibility
			downloadByAnchor(imgSrc, fileName);
			console.log("Using downloadByAnchor.");

		} else {
			console.error("imgLink not found for index:", index);
		}
	};

	const initPostActions = () => {
		state.postActionsInitialized = true;
		if (!isPostPage() || state.currentPostUrl === window.location.href) return;
		cleanupPostActions();

		const currentPageUrl = window.location.href;

		document
			.querySelectorAll(SELECTORS.IMAGE_LINK + ' img')
			.forEach((img) => (img.className = CLASS_NAMES.POST_IMAGE));
		document
			.querySelectorAll(SELECTORS.ATTACHMENT_LINK)
			.forEach((link) => (link.dataset.fileName = link.getAttribute('download')));

		elements.postActions = document.querySelector(SELECTORS.POST_ACTIONS);
		if (!elements.postActions) return;

		// Check for the presence of images
		const hasMediaContent =
			document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0; // Only check for images

		if (hasMediaContent) {
			// Add status container only if it doesn't exist
			if (!elements.statusContainer) {
				const {
					container: statusContainer,
					element: statusElement
				} = createStatusElement();
				elements.statusContainer = statusContainer;
				elements.statusElement = statusElement;
				elements.postActions.appendChild(elements.statusContainer);
			}

			// Add buttons only if they don't exist
			if (!elements.postActions.querySelector(`.${CLASS_NAMES.UG_BUTTON}`)) {
				const downloadAllButton = createToggleButton(
					BUTTONS.DOWNLOAD_ALL,
					downloadAllImages
				);
				const galleryButton = createToggleButton(
					'Loading Gallery...',
					() => {
						state.isGalleryMode = !state.isGalleryMode;
					},
					true
				); // Initially disabled
				elements.galleryButton = galleryButton;

				const heightButton = createToggleButton(BUTTONS.HEIGHT, () => clickAllImageButtons('height'));
				const widthButton = createToggleButton(BUTTONS.WIDTH, () => clickAllImageButtons('width'));
				const fullButton = createToggleButton(BUTTONS.FULL, () => clickAllImageButtons('full'));

				elements.postActions.append(
					heightButton,
					widthButton,
					fullButton,
					downloadAllButton,
					galleryButton
				);

				// Always show the gallery button
				elements.galleryButton.style.display = 'inline-block';
			}
		}

		if (!elements.settingsButton) {
			elements.settingsButton = createToggleButton(BUTTONS.SETTINGS, () => {
				state.settingsOpen = !state.settingsOpen;
			});
			elements.settingsButton.className = CLASS_NAMES.SETTINGS_BUTTON;
			document.body.appendChild(elements.settingsButton);
		}
		const fileDivs = document.querySelectorAll(SELECTORS.FILE_DIVS);
		const parentDiv = fileDivs[0]?.parentNode;

		if (parentDiv) {
			state.displayedImages = Array.from(
				document.querySelectorAll(SELECTORS.IMAGE_LINK + ' img')
			);

			// Remove old button groups
			const existingButtonGroups = Array.from(parentDiv.querySelectorAll(`.${CLASS_NAMES.UG_BUTTON_CONTAINER}`));

			existingButtonGroups.forEach((buttonGroup) => {
				const imageContainer = buttonGroup.nextElementSibling;
				if (!imageContainer || !state.displayedImages.some(img => img.closest(SELECTORS.THUMBNAIL) === imageContainer)) {
					buttonGroup.remove();
				}
			});

			state.displayedImages.forEach((img, index) => {
				const downloadLink = img
					.closest(SELECTORS.THUMBNAIL)
					?.querySelector(SELECTORS.IMAGE_LINK);
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

				// Check if buttons already exist before adding them
				if (
					!img
					.closest(SELECTORS.THUMBNAIL)
					.previousElementSibling?.classList.contains(CLASS_NAMES.UG_BUTTON_CONTAINER)
				) {
					// Use the helper function to create button groups
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
							action: () => imageActions.full(img)
						},
						{
							text: BUTTONS.DOWNLOAD,
							action: () => downloadImageByIndex(index)
						},
						{
							text: BUTTONS.REMOVE,
							action: removeImage
						}
					]);

					//parentDiv.insertBefore(newDiv, img.closest(SELECTORS.THUMBNAIL));
					const thumbnail = img.closest(SELECTORS.THUMBNAIL);

					// Insert the newDiv before the thumbnail
					if (thumbnail && thumbnail.parentNode) {
						thumbnail.parentNode.insertBefore(newDiv, thumbnail);
					}
				}
				img.addEventListener('click', () => showExpandedImage(index));
			});

			// Use event delegation for dynamically added images
			parentDiv.addEventListener('click', delegatedImageClickHandler);

			const favoriteButton = document.querySelector(SELECTORS.FAVORITE_BUTTON);
			if (favoriteButton) {
				// Use the helper function to create button groups
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
				// Check if buttons already exist before adding them
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
		// Remove only elements with the 'ug-button' class
		if (elements.postActions) {
			elements.postActions.querySelectorAll(`.${CLASS_NAMES.UG_BUTTON}`).forEach(button => button.remove());
		}

		if (elements.settingsButton) {
			elements.settingsButton.remove();
			elements.settingsButton = null;
		}

		// Clean up event delegation from parentDiv
		const parentDiv = document.querySelector(website === 'nekohouse' ? '.scrape__thumbnails' : '.post__thumbnails');
		if (parentDiv) {
			parentDiv.removeEventListener('click', delegatedImageClickHandler);
		}

		if (elements.statusContainer) {
			elements.statusContainer.remove();
			elements.statusContainer = null;
			elements.statusElement = null;
		}

		elements.postActions = null; // Reset postActions
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
		const displayedImage = imageContainer?.querySelector('img'); // Target the img tag directly

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

	// --- Notification System ---
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
			notificationContainer.style.animation = 'ug-slide-in 0.5s ease-in-out forwards';
		} else {
			notificationContainer.style.animation = 'none';
		}
		notificationContainer.style.display = 'flex';
	};

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

	// --- Mutation Observer and Initialization ---
	const isPostPage = () => {
		const url = window.location.href;
		const validPatterns = [
			/https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/post\//,
			/https:\/\/(kemono\.su|coomer\.su|nekohouse\.su)\/.*\/user\/.*\/post\//,
		];
		return validPatterns.some((pattern) => pattern.test(url));
	};

	// Named function for the delegated event handler (for removal in cleanup)
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

	let uiCache = {}; // Object to store cached UI states
	let previousPageUrl = null;
	const injectUI = debounce(() => {
		if (!isPostPage()) {
			// Reset the flag when not on a post page
			state.postActionsInitialized = false;
			state.notification = null; // Clear notifications when not on a post page
			state.notificationType = 'info';
			state.loadingMessage = null;
			state.isLoading = false;
			state.galleryReady = false;
			state.hasImages = false;
			state.totalImages = 0; // Reset totalImages when not on a post page
			cleanupPostActions();
			uiCache = {}; //clear cache on page exit
			previousPageUrl = null;
			return;
		}
		const mediaLinks = [
			...document.querySelectorAll(SELECTORS.IMAGE_LINK),
		];
		const currentTotalImages = mediaLinks.length;
		const currentPageUrl = window.location.href;

		const postSection = document.querySelector('.site-section.site-section--post');

		if (!state.postActionsInitialized && postSection) {
			state.galleryReady = false;
			state.loadedImages = 0;
			state.hasImages = false;
			state.totalImages = currentTotalImages;
			const hasMediaContent =
				document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0; // Only check for images
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
			// check for the presence of images, create status container only if the page has them.
			const hasMediaContent =
				document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0;
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