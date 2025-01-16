// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.4.2
// @description  Enhanced gallery experience (SPA-compatible Testing Phase)
// @author       ntf (original), Meri/TearTyr
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
	};

	const SELECTORS = {
		IMAGE_LINK: website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link',
		VIDEO_LINK: '.post__video-link',
		ATTACHMENT_LINK: website === 'nekohouse' ? '.scrape__attachment-link' : '.post__attachment-link',
		POST_TITLE: website === 'nekohouse' ? '.scrape__title' : '.post__title',
		POST_USER_NAME: website === 'nekohouse' ? '.scrape__user-name' : '.post__user-name',
		POST_IMAGE: 'img.post__image',
		THUMBNAIL: website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail',
		POST_ACTIONS: website === 'nekohouse' ? '.scrape__actions' : '.post__actions',
		FAVORITE_BUTTON: website === 'nekohouse' ? '.scrape__actions a.favorite-button' : '.post__actions a.favorite-button',
		FILE_DIVS: website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail',
		FILES_IMG: website === 'nekohouse' ? '.scrape__files img' : 'img.post__image',
		VIDEO_ELEMENT: 'video.post__video',
	};

	const CLASS_NAMES = {
		UG_BUTTON: 'ug-button',
		UG_BUTTON_CONTAINER: 'ug-button-container',
		LOADING_OVERLAY: 'loading-overlay',
		GALLERY_CONTAINER: 'gallery-container',
		GALLERY_CLOSE_BUTTON: 'gallery-close-button',
		GALLERY_CONTENT: 'gallery-content',
		EXPANDED_VIEW: 'expanded-view',
		EXPANDED_IMAGE: 'expanded-image',
		PAGE_NUMBER: 'page-number',
		THUMBNAIL_CONTAINER: 'thumbnail-container',
		NAVIGATION_BUTTON: 'navigation-button',
		PREV_BUTTON: 'navigation-button prev',
		NEXT_BUTTON: 'navigation-button next',
		VIRTUAL_IMAGE: 'virtual-image',
		THUMBNAIL: 'thumbnail',
		EXPANDED_THUMBNAIL: 'expanded-thumbnail',
		SETTINGS_BUTTON: 'settings-button',
		NOTIFICATION_CONTAINER: 'ug-notification-container',
		NOTIFICATION_TEXT: 'ug-notification-text',
		NOTIFICATION_CLOSE: 'ug-notification-close',
		NOTIFICATION_REPORT: 'ug-notification-report',
		NO_CLICK: 'ug-no-click',
	};

	const MAX_RETRIES = 3;
	const RETRY_DELAY = 1500;
	const IMAGE_BATCH_SIZE = 3; // Number of images to load at a time
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
		animationsEnabled: GM_getValue('animationsEnabled', true),
		notification: null,
		notificationType: 'info',
		hideNavArrows: GM_getValue('hideNavArrows', false),
		hideRemoveButton: GM_getValue('hideRemoveButton', false),
		hideFullButton: GM_getValue('hideFullButton', false),
		hideDownloadButton: GM_getValue('hideDownloadButton', false),
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
				state.notification = `Images and Videos Done Loading! Total: ${state.totalImages}`;
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
	});

	// --- Settings ---
	const createSettingsUI = () => {
		const overlay = document.createElement('div');
		overlay.id = 'ug-settings-overlay';
		overlay.style.display = 'flex';
		overlay.style.justifyContent = 'center';
		overlay.style.alignItems = 'center';
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
		overlay.style.backdropFilter = 'blur(0px)';
		overlay.style.zIndex = '10001';
		overlay.style.transition = 'background-color 0.3s ease, backdrop-filter 0.3s ease';
		setTimeout(() => {
			overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
			overlay.style.backdropFilter = 'blur(10px)';
		}, 0);

		const container = document.createElement('div');
		container.id = 'ug-settings-container';
		container.style.display = 'flex';
		container.style.width = '95vw';
		container.style.maxWidth = '800px';
		container.style.maxHeight = '80vh';
		container.style.backgroundColor = '#222';
		container.style.borderRadius = '8px';
		container.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.1)';
		container.style.transition = 'transform 0.3s ease';
		container.style.transform = 'scale(0.9)';
		setTimeout(() => {
			container.style.transform = 'scale(1)';
		}, 0);


		const ribbon = document.createElement('div');
		ribbon.id = 'ug-settings-ribbon';
		ribbon.style.display = 'flex';
		ribbon.style.flexDirection = 'column';
		ribbon.style.padding = '10px';
		ribbon.style.borderRight = '1px solid #555';

		const content = document.createElement('div');
		content.style.flexGrow = '1';
		content.style.overflowY = 'auto';
		content.style.padding = '20px';


		const closeButton = document.createElement('button');
		closeButton.id = 'ug-settings-close-btn';
		closeButton.innerHTML = '×';
		closeButton.style.position = 'absolute';
		closeButton.style.top = '15px';
		closeButton.style.right = '15px';
		closeButton.style.fontSize = '2em';
		closeButton.style.background = 'none';
		closeButton.style.border = 'none';
		closeButton.style.color = '#eee';
		closeButton.style.cursor = 'pointer';
		closeButton.addEventListener('click', () => {
			container.style.transform = 'scale(0.9)';
			overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
			overlay.style.backdropFilter = 'blur(0px)';
			setTimeout(() => {
				overlay.remove();
			}, 300);

		});

		const tabs = {
			general: {
				label: 'General',
				content: () => {
					const generalContent = document.createElement('div');
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
					return notificationsContent;
				},
			},
			credits: {
				label: 'Credits',
				content: () => {
					const creditsContent = document.createElement('div');
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
				ribbonButtons[tabKey].style.backgroundColor = tabKey === activeTab ? '#222' : 'transparent';
				ribbonButtons[tabKey].style.borderBottomColor = tabKey === activeTab ? '#007bff' : 'transparent';
			}
		};


		for (const tabId in tabs) {
			const button = document.createElement('button');
			button.textContent = tabs[tabId].label;
			button.style.padding = '10px 15px';
			button.style.border = 'none';
			button.style.background = 'none';
			button.style.color = '#eee';
			button.style.cursor = 'pointer';
			button.style.transition = 'background-color 0.3s ease';
			button.style.borderBottom = '3px solid transparent';
			button.style.fontSize = '1em';
			button.addEventListener('click', () => showTabContent(tabId));
			ribbon.appendChild(button);
			ribbonButtons[tabId] = button; // Store the button
		}

		// Function to save settings and close
		const saveSettings = () => {
			state.zipFileNameFormat = document.getElementById('zipFileNameFormat')?.value || state.zipFileNameFormat;
			state.imageFileNameFormat = document.getElementById('imageFileNameFormat')?.value || state.imageFileNameFormat;
			state.galleryKey = document.getElementById('galleryKey')?.value || state.galleryKey;
			GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
			GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
			GM_setValue('galleryKey', state.galleryKey);

			container.style.transform = 'scale(0.9)';
			overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
			overlay.style.backdropFilter = 'blur(0px)';
			setTimeout(() => {
				overlay.remove();
			}, 300);
		}

		// Create the save button
		const saveButton = document.createElement('button');
		saveButton.textContent = 'Save';
		saveButton.className = 'swal2-confirm';
		saveButton.style.marginLeft = 'auto';
		saveButton.style.marginTop = '20px';
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

	// --- Image Loading and Gallery Functions ---

	let elements = {};

	const handleMediaSrc = (mediaLink) => {
		if (mediaLink.href && mediaLink.href.toLowerCase().endsWith('.mp4')) {
			const videoElement = mediaLink.querySelector('video');
			if (videoElement && videoElement.src) {
				return videoElement.src;
			}
			return mediaLink.href;
		}
		const fileThumbDiv = mediaLink.querySelector('.fileThumb');
		if (fileThumbDiv && fileThumbDiv.getAttribute('href')) {
			return fileThumbDiv.getAttribute('href').split('?')[0];
		}
		if (mediaLink.getAttribute('href')) {
			return mediaLink.getAttribute('href').split('?')[0];
		}
		return null;
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

	const loadImages = async () => {
		if (!isPostPage() || state.galleryReady || state.isLoading) return;

		state.isLoading = true;
		state.loadingMessage = 'Loading Media...';

		const mediaLinks = [
			...document.querySelectorAll(SELECTORS.IMAGE_LINK),
			...document.querySelectorAll(SELECTORS.VIDEO_ELEMENT),
			...document.querySelectorAll(SELECTORS.VIDEO_LINK),
			...document.querySelectorAll(SELECTORS.ATTACHMENT_LINK), // Include attachments
		];

		state.totalImages = mediaLinks.length;
		state.virtualGallery = Array(state.totalImages).fill(null);
		state.fullSizeImageSrcs = Array(state.totalImages).fill(null);
		state.loadedImages = 0;
		state.mediaLoaded = {}; // Reset media loaded status

		const loadingPromises = [];
		for (let i = 0; i < mediaLinks.length; i++) {
			loadingPromises.push(loadImage(mediaLinks[i], i));
		}

		await Promise.all(loadingPromises);

		// Check if all images/videos failed to load
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
				const isVideo = mediaSrc.toLowerCase().endsWith('.mp4');
				let mediaElement;
				if (isVideo) {
					mediaElement = document.createElement('video');
					mediaElement.src = mediaSrc;
					mediaElement.controls = true;
				} else {
					mediaElement = document.createElement('img');
					mediaElement.src = mediaSrc;
				}
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

		const closeButton = document.createElement('button');
		closeButton.textContent = '×';
		closeButton.className = CLASS_NAMES.GALLERY_CLOSE_BUTTON;
		closeButton.addEventListener('click', () => {
			state.isGalleryMode = false;
		});


		const expandedImageContainer = document.createElement('div');
		expandedImageContainer.classList.add('ug-gallery-expanded-container');

		const expandedMedia = document.createElement('div'); // Container for either img or video
		expandedMedia.classList.add('ug-gallery-expanded-media');

		const prevButton = createNavigationButton('prev');
		const nextButton = createNavigationButton('next');

		const pageNumber = document.createElement('div');
		pageNumber.className = CLASS_NAMES.PAGE_NUMBER;

		expandedImageContainer.append(expandedMedia, pageNumber, prevButton, nextButton);
		galleryModal.append(closeButton, expandedImageContainer);

		const thumbnailGrid = document.createElement('div');
		thumbnailGrid.classList.add('ug-gallery-thumbnail-grid');
		galleryModal.appendChild(thumbnailGrid);


		overlay.appendChild(galleryModal);
		return overlay;
	};

	const createNavigationButton = (direction) => {
		const button = document.createElement('button');
		button.textContent = direction === 'prev' ? '←' : '→';
		button.className = `${CLASS_NAMES.NAVIGATION_BUTTON} ${direction}`;
		return button;
	};

	const hideExpandedImage = () => {
		state.expandedViewActive = false;
		const galleryOverlay = document.getElementById('gallery-overlay');
		if (galleryOverlay) {
			galleryOverlay.classList.remove('expanded');
			const expandedMedia = galleryOverlay.querySelector('.ug-gallery-expanded-media');
			expandedMedia.innerHTML = '';
		}
		state.loadingMessage = null;
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

		// const isVideo = mediaSrc.toLowerCase().endsWith('.mp4');
		const galleryOverlay = document.getElementById('gallery-overlay');
		if (!galleryOverlay) return;
		const expandedMedia = galleryOverlay.querySelector('.ug-gallery-expanded-media');
		let loadingOverlay = galleryOverlay.querySelector(`.${CLASS_NAMES.LOADING_OVERLAY}`);

		if (!loadingOverlay) {
			loadingOverlay = createLoadingOverlay();
			expandedMedia.appendChild(loadingOverlay);
		}

		expandedMedia.innerHTML = '';

		let mediaElement;
		// if (isVideo) {
		// 	mediaElement = document.createElement('video');
		// 	mediaElement.controls = true;
		// } else {
			mediaElement = new Image();
		// }

		const onMediaLoad = () => {
			if (expandedMedia.contains(loadingOverlay)) {
				expandedMedia.removeChild(loadingOverlay);
			}
			galleryOverlay.classList.add('expanded');

			mediaElement.classList.add('ug-gallery-expanded-media-item');
			expandedMedia.appendChild(mediaElement);

			currentIndex = index;
			const pageNumber = galleryOverlay.querySelector(`.${CLASS_NAMES.PAGE_NUMBER}`);
			pageNumber.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
			state.loadingMessage = null;
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

		// if (isVideo && mediaElement.readyState >= 2) {
		// 	onMediaLoad();
		// }
	};

	const showExpandedImage = (index) => {
		state.expandedViewActive = true;
		state.loadingMessage = 'Loading Media...';
		loadAndDisplayMedia(index);
	};

	const showGallery = () => {
		if (!isPostPage() || !state.galleryReady) return;
		const overlay = createGalleryOverlay();
		const galleryModal = overlay.querySelector('.ug-gallery-modal');
		const thumbnailGrid = overlay.querySelector('.ug-gallery-thumbnail-grid');
		const expandedImageContainer = overlay.querySelector('.ug-gallery-expanded-container');
		const prevButton = overlay.querySelector('.navigation-button.prev');
		const nextButton = overlay.querySelector('.navigation-button.next');


		images = Array.from(elements.virtualGalleryContainer.querySelectorAll(`.${CLASS_NAMES.VIRTUAL_IMAGE}`));
		currentIndex = 0;


		thumbnailGrid.innerHTML = '';
		expandedImageContainer.style.display = 'none';
		prevButton.style.display = 'none';
		nextButton.style.display = 'none';


		images.forEach((img, index) => {
			const thumbnail = document.createElement('img');
			thumbnail.src = img.src;
			thumbnail.className = 'ug-gallery-thumbnail';
			thumbnail.addEventListener('click', () => {
				expandedImageContainer.style.display = 'flex';
				prevButton.style.display = 'block';
				nextButton.style.display = 'block';
				showExpandedImage(index);
			});
			thumbnailGrid.appendChild(thumbnail);
		});

		document.body.appendChild(overlay);
		// Navigation button event listeners
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
	};

	const closeGallery = () => {
		const overlay = document.getElementById('gallery-overlay');
		if (overlay) {
			document.body.removeChild(overlay);
			state.isGalleryMode = false;
			state.expandedViewActive = false;
			state.loadingMessage = null;
		}
	};

	const handleGalleryKey = (event) => {
		if (!isPostPage()) return;
		if (event.key === state.galleryKey && state.galleryReady) {
			state.isGalleryMode = !state.isGalleryMode;
		} else if (state.isGalleryMode) {
			if (event.key === 'Escape') {
				if (state.expandedViewActive) {
					hideExpandedImage();
				} else {
					closeGallery();
				}
			} else if (state.expandedViewActive) {
				event.preventDefault();
				if (event.key === 'k') {
					showExpandedImage((currentIndex - 1 + images.length) % images.length);
				} else if (event.key === 'l') {
					showExpandedImage((currentIndex + 1) % images.length);
				}
			}
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
	}

	// --- Downloading and Post Actions ---
	const downloadAllImagesAndVideos = async () => {
		const images = document.querySelectorAll(SELECTORS.IMAGE_LINK);
		const videoLinks = document.querySelectorAll(SELECTORS.VIDEO_LINK);
		const attachmentLinks = document.querySelectorAll(SELECTORS.ATTACHMENT_LINK);
		const title =
			document.querySelector(SELECTORS.POST_TITLE)?.textContent?.trim() ||
			'Untitled';
		const artistName =
			document.querySelector(SELECTORS.POST_USER_NAME)?.textContent?.trim() ||
			'Unknown Artist';

		const total = images.length + videoLinks.length + attachmentLinks.length;
		if (total === 0) return;

		state.notification = `Downloading... (0/${total})`;
		state.downloadedCount = 0;

		const sanitizedTitle = sanitizeFileName(title);
		const sanitizedArtistName = sanitizeFileName(artistName);

		const zip = new JSZip();
		let downloaded = 0;
		const downloadPromises = [];

		const downloadAndAddToZip = (url, filename) => {
			return new Promise((resolve, reject) => {
				GM.xmlHttpRequest({
					method: 'GET',
					url: url,
					responseType: 'blob',
					onload: function(response) {
						if (response.status === 200) {
							const decodedFilename = decodeURIComponent(filename);
							zip.file(decodedFilename, response.response);
							downloaded++;
							state.downloadedCount = downloaded;
							resolve();
						} else {
							console.error('Error downloading:', response.status, filename);
							reject(new Error(`Failed to fetch ${filename}: ${response.status}`));
						}
					},
					onerror: function(error) {
						console.error('Error downloading:', error, filename);
						reject(error);
					},
				});
			});
		};

		for (let i = 0; i < images.length; i++) {
			const imgLink = images[i];
			const imgSrc = imgLink.href.split('?')[0];
			const originalFileName = imgLink.getAttribute('download') || `image-${i + 1}.jpg`;
			const ext = getExtension(originalFileName);

			const fileName = state.imageFileNameFormat
				.replace('{title}', sanitizedTitle)
				.replace('{artistName}', sanitizedArtistName)
				.replace('{fileName}', originalFileName.replace(/\.[^/.]+$/, ''))
				.replace('{index}', i + 1)
				.replace('{ext}', ext);

			downloadPromises.push(downloadAndAddToZip(imgSrc, fileName));
		}

		for (let i = 0; i < videoLinks.length; i++) {
			const videoLink = videoLinks[i];
			const videoSrc = videoLink.href;
			const originalFileName = videoLink.getAttribute('download') || 'video-${i + 1.mp4}';
			const ext = getExtension(originalFileName);

			const fileName = state.imageFileNameFormat
				.replace('{title}', sanitizedTitle)
				.replace('{artistName}', sanitizedArtistName)
				.replace('{fileName}', originalFileName.replace(/\.[^/.]+$/, ''))
				.replace('{ext}', ext);

			downloadPromises.push(downloadAndAddToZip(videoSrc, fileName));
		}

		for (let i = 0; i < attachmentLinks.length; i++) {
			const link = attachmentLinks[i];
			const attachmentSrc = link.href;
			const originalFileName = link.textContent.trim().replace('Download ', '');
			const ext = getExtension(originalFileName);

			const fileName = state.imageFileNameFormat
				.replace('{title}', sanitizedTitle)
				.replace('{artistName}', sanitizedArtistName)
				.replace('{fileName}', originalFileName.replace(/\.[^/.]+$/, ''))
				.replace('{index}', i + 1)
				.replace('{ext}', ext);

			downloadPromises.push(downloadAndAddToZip(attachmentSrc, fileName));
		}

		try {
			await Promise.all(downloadPromises);

			const zipBlob = await zip.generateAsync({
				type: 'blob'
			});
			const zipFileName = state.zipFileNameFormat.replace('{artistName}', sanitizedArtistName).replace('{title}', sanitizedTitle);
			saveAs(zipBlob, zipFileName);
			state.notification = `Done! Total: ${total}`;
			state.notificationType = 'success';
		} catch (error) {
			console.error('Error creating zip:', error);
			Swal.fire('Error!', `Failed to create zip file: ${error.message}`, 'error');
			state.notification = `Failed to create zip file: ${error.message}`;
			state.notificationType = 'error';
		}
	};

	const downloadImageByIndex = (index) => {
		const downloadFunction = typeof GM_download !== 'undefined' ? GM_download : GM.download;
		const imgLink = document.querySelectorAll(SELECTORS.IMAGE_LINK)[index];

		if (imgLink) {
			const imgSrc = imgLink.href.split('?')[0];
			const fileName = imgLink.getAttribute('download');
			const options = {
				url: imgSrc,
				name: fileName
			};
			downloadFunction(options);
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

		// Check for the presence of images or videos
		const hasMediaContent =
			document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0 ||
			document.querySelectorAll(SELECTORS.VIDEO_LINK).length > 0;

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
					downloadAllImagesAndVideos
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
			elements.settingsButton = createToggleButton(BUTTONS.SETTINGS, showSettings);
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

			const currentButtonGroups = [];
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
					const newDiv = document.createElement('div');
					newDiv.classList.add(CLASS_NAMES.UG_BUTTON_CONTAINER);

					const heightButton = createToggleButton(BUTTONS.HEIGHT, resizeImage);
					const widthButton = createToggleButton(BUTTONS.WIDTH, resizeImage);
					const fullButton = createToggleButton(BUTTONS.FULL, () => imageActions.full(img));
					const downloadButton = createToggleButton(BUTTONS.DOWNLOAD, () => downloadImageByIndex(index));
					const removeButton = createToggleButton(BUTTONS.REMOVE, removeImage);
					// Initial visibility based on settings
					const optionsButtons = [];

					if (!state.hideRemoveButton) {
						optionsButtons.push(removeButton);
					}
					if (!state.hideFullButton) {
						optionsButtons.push(fullButton);
					}
					if (!state.hideDownloadButton) {
						optionsButtons.push(downloadButton);
					}
					optionsButtons.forEach(button => {
						newDiv.append(button)
					});

					newDiv.append(heightButton);
					newDiv.append(widthButton);

					// Add 'ug-button' class to the buttons in the newDiv
					Array.from(newDiv.children).forEach((button) => button.classList.add(CLASS_NAMES.UG_BUTTON));

					parentDiv.insertBefore(newDiv, img.closest(SELECTORS.THUMBNAIL));
				}
				img.addEventListener('click', () => showExpandedImage(index));
			});

			// Use event delegation for dynamically added images
			parentDiv.addEventListener('click', delegatedImageClickHandler);

			const favoriteButton = document.querySelector(SELECTORS.FAVORITE_BUTTON);
			if (favoriteButton) {
				const newDiv = document.createElement('div');
				newDiv.style.display = 'inline-block';
				// Check if buttons already exist before adding them
				if (!favoriteButton.nextElementSibling?.classList.contains(CLASS_NAMES.UG_BUTTON_CONTAINER)) {
					newDiv.classList.add(CLASS_NAMES.UG_BUTTON_CONTAINER);
					newDiv.append(
						createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
						createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
						createToggleButton(BUTTONS.FULL, () => resizeAllImages('full'))
					);

					// Add 'ug-button' class to the buttons in the newDiv
					Array.from(newDiv.children).forEach((button) => button.classList.add(CLASS_NAMES.UG_BUTTON));
					favoriteButton.parentNode.insertBefore(newDiv, favoriteButton.nextSibling);
				}
			}
			// Cache the UI state
			if (currentPageUrl) {
				uiCache[currentPageUrl] = {
					cachedButtonGroups: Array.from(parentDiv.querySelectorAll(`.${CLASS_NAMES.UG_BUTTON_CONTAINER}`)).map(group => group.cloneNode(true)),
					cachedTotalImages: state.totalImages,
				};
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
	const createNotification = () => {
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

		document.body.appendChild(notificationContainer);
		return notificationContainer;
	};

	const showNotification = (message, type = 'info') => {
		if (!state.notificationsEnabled && type !== 'error') return;

		let notificationContainer = document.getElementById(CLASS_NAMES.NOTIFICATION_CONTAINER);
		if (!notificationContainer) {
			notificationContainer = createNotification();
		}

		const notificationText = document.getElementById(CLASS_NAMES.NOTIFICATION_TEXT);
		notificationText.textContent = message;

		notificationContainer.classList.remove('info', 'success', 'error');
		notificationContainer.classList.add(type);

		if (state.animationsEnabled) {
			notificationContainer.style.animation = 'slide-in 0.5s ease-in-out forwards';
		} else {
			notificationContainer.style.animation = 'none';
		}
		notificationContainer.style.display = 'flex';
	};

	const hideNotification = () => {
		const notificationContainer = document.getElementById(CLASS_NAMES.NOTIFICATION_CONTAINER);
		if (!notificationContainer) return;

		if (state.animationsEnabled) {
			notificationContainer.style.animation = 'slide-out 0.5s ease-in-out forwards';
			setTimeout(() => {
				notificationContainer.style.display = 'none';
			}, 500);
		} else {
			notificationContainer.style.animation = 'none';
			notificationContainer.style.display = 'none';
		}
	};

	const updateOverallStatus = () => {};

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
			...document.querySelectorAll(SELECTORS.VIDEO_LINK),
		];
		const currentTotalImages = mediaLinks.length;
		const currentPageUrl = window.location.href;

		const postSection = document.querySelector('.site-section.site-section--post');

		if (!state.postActionsInitialized && postSection) {
			state.galleryReady = false;
			state.loadedImages = 0;
			state.hasImages = false;
			state.totalImages = currentTotalImages; // Update totalImages on a new post page
			// check for the presence of images or videos, create status container only if the page has them.
			const hasMediaContent =
				document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0 || document.querySelectorAll(SELECTORS.VIDEO_LINK).length > 0;
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
			state.totalImages = currentTotalImages; // Update totalImages on URL change
			state.galleryReady = false;
			state.loadedImages = 0;
			state.hasImages = false;
			state.notification = null; // Clear notifications on page change
			state.notificationType = 'info';
			state.loadingMessage = null;
			state.isLoading = false;
			// check for the presence of images or videos, create status container only if the page has them.
			const hasMediaContent =
				document.querySelectorAll(SELECTORS.IMAGE_LINK).length > 0 || document.querySelectorAll(SELECTORS.VIDEO_LINK).length > 0;
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
			galleryKeyListenerAttached = true;
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
				state.notification = `Images and Videos Done Loading! Total: ${state.totalImages}`;
				state.notificationType = 'success';
			} else if (state.notificationType === 'error') {
				state.notification = 'Error loading some media.';
			}
		} else {
			state.notification = null; // Clear notifications when not on a post page
			state.notificationType = 'info';
			state.loadingMessage = null;
			state.isLoading = false;
			state.galleryReady = false;
		}
		elements.galleryThumbnailsInitialized = false;
	};


	init();
})();