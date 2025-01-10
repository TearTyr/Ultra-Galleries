// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.4.5
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
// @require      https://cdn.bootcss.com/jszip/3.1.4/jszip.min.js
// @require      https://cdn.bootcss.com/FileSaver.js/1.3.2/FileSaver.min.js
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

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500;
    const IMAGE_BATCH_SIZE = 3; // Number of images to load at a time
    const DEBOUNCE_DELAY = 300;

    const website = window.location.hostname.split('.')[0];

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
            width: 'auto'
        }),
        width: (img) => setImageStyle(img, {
            maxHeight: '100%',
            maxWidth: '100vw',
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
        toggle.classList.add('ug-button');
        if (disabled) {
            toggle.disabled = true;
            toggle.classList.add('disabled');
        }
        return toggle;
    };

    const createLoadingOverlay = (text = 'Loading...') => {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
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

    const updateStatus = (statusElement, text) => {
        if (statusElement) {
            statusElement.textContent = text;
        }
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
        overallStatus: 'idle', // "idle", "loading-media", "loading-gallery", "downloading", "completed", "error"
        postActionsInitialized: false,
        mediaLoaded: {}, // Object to track loaded media
        isGalleryMode: false,
        notificationsEnabled: GM_getValue('notificationsEnabled', true),
        animationsEnabled: GM_getValue('animationsEnabled', true),
        notification: null,
        notificationType: 'info', // Type of notification (info, success, error)
    }, {
        galleryReady: (value) => {
            if (value) {
                enableGalleryButton();
            } else {
                disableGalleryButton();
            }
        },
        loadedImages: (value, oldValue) => {
            // Update status when loadedImages changes
            if (value === state.totalImages && state.totalImages > 0) {
                state.overallStatus = 'completed';
            }
        },
        downloadedCount: (value) => {
            updateDownloadStatus();
        },
        totalImages: (value, oldValue) => {
            // Only update the status if totalImages changes from 0 to a positive number
            if (oldValue === 0 && value > 0) {
                state.overallStatus = 'loading-media';
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
        overallStatus: (value, oldValue) => {
            // Update the overall status and send a notification
            updateOverallStatus();
            if (value !== 'idle') {
                state.notification = elements.statusElement.textContent;
                state.notificationType = value === 'error' ? 'error' : 'info';
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
    const showSettings = () => {
        let settings = {
            zipFileNameFormat: state.zipFileNameFormat,
            imageFileNameFormat: state.imageFileNameFormat,
            galleryKey: state.galleryKey,
        };
        Swal.fire({
            title: 'Ultra Galleries - Settings',
            html: `
                <div class="ug-settings-popup"><div class="ug-settings-title">Ultra Galleries - Settings</div><div class="ug-settings-container"><div class="ug-setting"><label for="zipFileNameFormat">Zip Filename Format:</label><input type="text" id="zipFileNameFormat" class="ug-settings-input" value="${settings.zipFileNameFormat}" placeholder="{title}-{artistName}.zip"><p class="ug-placeholder-info">Available placeholders: {artistName}, {title}</p></div><div class="ug-setting"><label for="imageFileNameFormat">Image Filename Format:</label><input type="text" id="imageFileNameFormat" class="ug-settings-input" value="${settings.imageFileNameFormat}" placeholder="{title}-{artistName}-{fileName}-{index}"><p class="ug-placeholder-info">Available placeholders: {artistName}, {title}, {fileName}, {index}, {ext}</p></div><div class="ug-setting"><label for="galleryKey">Gallery Key:</label><input type="text" id="galleryKey" class="ug-settings-input" value="${settings.galleryKey}" maxlength="1"><p class="ug-placeholder-info">Press this key to open the gallery when it's loaded.</p></div><div class="ug-setting"><label for="notificationsEnabled">Enable Notifications:</label><input type="checkbox" id="notificationsEnabled" ${state.notificationsEnabled ? 'checked' : ''}></div><div class="ug-setting"><label for="animationsEnabled">Enable Animations:</label><input type="checkbox" id="animationsEnabled" ${state.animationsEnabled ? 'checked' : ''}></div></div><div class="ug-credits"><p>Original author: ntf</p><p>Forked by: Meri/TearTyr</p></div></div>
            `,
            confirmButtonText: 'Save',
            focusConfirm: false,
            customClass: {
                confirmButton: 'ug-settings-confirm',
                cancelButton: 'ug-settings-cancel',
            },
            preConfirm: () => ({
                zipFileNameFormat: document.getElementById('zipFileNameFormat').value,
                imageFileNameFormat: document.getElementById('imageFileNameFormat').value,
                galleryKey: document.getElementById('galleryKey').value,
                notificationsEnabled: document.getElementById('notificationsEnabled').checked,
                animationsEnabled: document.getElementById('animationsEnabled').checked,
            }),
        }).then((result) => {
            if (result.isConfirmed) {
                state.zipFileNameFormat = result.value.zipFileNameFormat;
                state.imageFileNameFormat = result.value.imageFileNameFormat;
                state.galleryKey = result.value.galleryKey;
                GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
                GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
                GM_setValue('galleryKey', state.galleryKey);
                state.notificationsEnabled = result.value.notificationsEnabled;
                state.animationsEnabled = result.value.animationsEnabled;
                GM_setValue('notificationsEnabled', state.notificationsEnabled);
                GM_setValue('animationsEnabled', state.animationsEnabled);
            }
        });
    };

    // --- Image Loading and Gallery Functions ---

    let elements = {};

    const loadImage = async (mediaLink, index) => {
        try {
            let mediaSrc;
            if (mediaLink.href && mediaLink.href.toLowerCase().endsWith('.mp4')) {
                // Check if it's a video
                mediaSrc = mediaLink.querySelector('video')?.src;
            } else {
                const fileThumbDiv = mediaLink.querySelector('.fileThumb');
                if (fileThumbDiv && fileThumbDiv.getAttribute('href')) {
                    mediaSrc = fileThumbDiv.getAttribute('href').split('?')[0];
                } else if (mediaLink.getAttribute('href')) {
                    mediaSrc = mediaLink.getAttribute('href').split('?')[0];
                } else {
                    return;
                }
            }

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
                                    mediaLink.classList.add('ug-no-click');
                                    resolve();
                                };
                                img.onerror = () => {
                                    console.error(`Image failed to load: ${mediaSrc}`);
                                    state.loadedImages++;
                                    state.overallStatus = 'error';
                                    reject();
                                };
                            } else {
                                console.error(`Failed to fetch image (status ${response.status}): ${mediaSrc}`);
                                state.loadedImages++;
                                state.overallStatus = 'error';
                                reject();
                            }
                        },
                        onerror: function(error) {
                            console.error(`Failed to fetch image: ${mediaSrc}`, error);
                            state.loadedImages++;
                            state.overallStatus = 'error';
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
            state.overallStatus = 'error';
        }
    };

    const loadImages = async () => {
        if (state.galleryReady || state.isLoading) return;

        state.isLoading = true;
        state.loadingMessage = 'Loading Media...';

        const mediaLinks = [
            ...document.querySelectorAll(
                website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link'
            ),
            ...document.querySelectorAll('.post__video-link'),
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
            state.overallStatus = 'error';
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
        state.virtualGallery.forEach((imageUrl) => {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'virtual-image';
            elements.virtualGalleryContainer.appendChild(img);
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
        const galleryContainer = document.createElement('div');
        galleryContainer.className = 'gallery-container';
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.className = 'gallery-close-button';
        closeButton.addEventListener('click', () => {
            state.isGalleryMode = false;
        });
        const galleryContent = document.createElement('div');
        galleryContent.className = 'gallery-content';

        const expandedView = document.createElement('div');
        expandedView.className = 'expanded-view';
        const expandedImage = document.createElement('img');
        expandedImage.className = 'expanded-image';
        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'thumbnail-container';

        const prevButton = createNavigationButton('prev');
        const nextButton = createNavigationButton('next');

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


        expandedView.append(expandedImage, pageNumber, thumbnailContainer, prevButton, nextButton);
        expandedView.addEventListener('click', (e) => {
            if (e.target === expandedView) hideExpandedImage();
        });

        galleryContainer.append(closeButton, galleryContent, expandedView);
        overlay.appendChild(galleryContainer);
        return overlay;
    };


    const createNavigationButton = (direction) => {
        const button = document.createElement('button');
        button.textContent = direction === 'prev' ? '←' : '→';
        button.className = `navigation-button ${direction}`;
        return button;
    };

    let showExpandedImage, hideExpandedImage;

    const showGallery = () => {
        if (state.isGalleryMode || !state.galleryReady) return;
        state.isGalleryMode = true;
        state.overallStatus = 'loading-gallery';

        const overlay = createGalleryOverlay();
        const galleryContent = overlay.querySelector('.gallery-content');
        const expandedView = overlay.querySelector('.expanded-view');
        const expandedImage = expandedView.querySelector('img');
        const thumbnailContainer = expandedView.querySelector('.thumbnail-container');
        const pageNumber = expandedView.querySelector('.page-number');
        images = Array.from(elements.virtualGalleryContainer.querySelectorAll('.virtual-image'));
        currentIndex = 0;

        const loadAndDisplayMedia = async (index) => {
            if (state.fullSizeImageSrcs.length === 0 || index < 0 || index >= state.fullSizeImageSrcs.length) {
                console.error('Invalid media index:', index);
                return;
            }

            const mediaSrc = state.fullSizeImageSrcs[index];
            if (!mediaSrc) {
                console.error('Media source is undefined for index:', index);
                return;
            }

            const isVideo = mediaSrc.toLowerCase().endsWith('.mp4');
            const expandedView = document.querySelector('.expanded-view');
            const expandedImage = expandedView.querySelector('img');
            const pageNumber = expandedView.querySelector('.page-number');
            const thumbnailContainer = expandedView.querySelector('.thumbnail-container');

            const loadingOverlay = createLoadingOverlay();
            expandedView.appendChild(loadingOverlay);

            // Clear existing content
            if (expandedImage.parentNode) {
                expandedImage.parentNode.querySelectorAll('video, img').forEach(el => {
                    if (el !== expandedImage) el.remove();
                });
            }

            let mediaElement;
            if (isVideo) {
                mediaElement = document.createElement('video');
                mediaElement.controls = true;
                mediaElement.src = mediaSrc;
            } else {
                mediaElement = new Image();
                mediaElement.src = mediaSrc;
            }

            mediaElement.onload = () => {
                expandedView.removeChild(loadingOverlay);
                expandedView.style.display = 'flex';
                if (isVideo) {
                    expandedImage.replaceWith(mediaElement);
                } else {
                    expandedImage.src = mediaSrc;
                }
                currentIndex = index;
                pageNumber.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
                thumbnailContainer
                    .querySelectorAll('.expanded-thumbnail')
                    .forEach((thumb, i) => thumb.classList.toggle('active', i === index));
                state.loadingMessage = null;
                state.mediaLoaded[index] = true;
            };

            mediaElement.onerror = () => {
                console.error('Failed to load media in expanded view:', mediaSrc);
                expandedView.removeChild(loadingOverlay);
                state.loadingMessage = null;
                if (!isVideo) {
                    expandedImage.src = '';
                }
                pageNumber.textContent = 'Error loading media';
            };
        };

        showExpandedImage = (index) => {
            state.expandedViewActive = true;
            state.loadingMessage = 'Loading Media...';
            loadAndDisplayMedia(index);
        };

        hideExpandedImage = () => {
            state.expandedViewActive = false;
            expandedView.style.display = 'none';
            state.loadingMessage = null;
        };

        galleryContent.innerHTML = '';
        thumbnailContainer.innerHTML = '';
        images.forEach((img, index) => {
            const thumbnail = document.createElement('img');
            thumbnail.src = img.src;
            thumbnail.className = 'thumbnail';
            thumbnail.addEventListener('click', () => showExpandedImage(index));
            galleryContent.appendChild(thumbnail);

            const expandedThumbnail = thumbnail.cloneNode(true);
            expandedThumbnail.className = 'expanded-thumbnail';
            expandedThumbnail.addEventListener('click', () => showExpandedImage(index));
            thumbnailContainer.appendChild(expandedThumbnail);
        });

        document.body.appendChild(overlay);
        loadAndDisplayMedia(currentIndex);
    };

    const closeGallery = () => {
        const overlay = document.getElementById('gallery-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
            state.isGalleryMode = false;
            state.expandedViewActive = false;
            state.loadingMessage = null; // Clear loading message when closing

            // Revoke object URLs when the gallery is closed
            if (elements.virtualGalleryContainer) {
                state.virtualGallery.forEach((url) => {
                    if (url && url.startsWith('blob:')) {
                        // Check if it's a blob URL
                        URL.revokeObjectURL(url);
                    }
                });
                state.virtualGallery = [];
            }
        }
    };

    const handleGalleryKey = (event) => {
        if (event.key === state.galleryKey && state.galleryReady) {
            // Use state.isGalleryMode instead of state.galleryActive
            state.isGalleryMode = !state.isGalleryMode;
        } else if (state.isGalleryMode) {
            // Only handle k/l if in gallery mode
            if (event.key === 'Escape') {
                state.expandedViewActive ? hideExpandedImage() : (state.isGalleryMode = false);
            } else if (state.expandedViewActive) {
                event.preventDefault(); // Prevent default behavior for k/l
                if (event.key === 'k') {
                    showExpandedImage((currentIndex - 1 + images.length) % images.length);
                } else if (event.key === 'l') {
                    showExpandedImage((currentIndex + 1) % images.length);
                }
            }
        }
    };

    // --- Downloading and Post Actions ---
    const downloadAllImagesAndVideos = async () => {
        const images = document.querySelectorAll(
            website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link'
        );
        const videoLinks = document.querySelectorAll('.post__video-link');
        const attachmentLinks = document.querySelectorAll(
            website === 'nekohouse' ? '.scrape__attachment-link' : '.post__attachment-link'
        );
        const title =
            document.querySelector(website === 'nekohouse' ? '.scrape__title' : '.post__title')?.textContent?.trim() ||
            'Untitled';
        const artistName =
            document.querySelector(website === 'nekohouse' ? '.scrape__user-name' : '.post__user-name')?.textContent?.trim() ||
            'Unknown Artist';

        const total = images.length + videoLinks.length + attachmentLinks.length;
        if (total === 0) return;

        state.overallStatus = 'downloading';
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
            const originalFileName = videoLink.getAttribute('download') || `video-${i + 1}.mp4`;
            const ext = getExtension(originalFileName);

            const fileName = state.imageFileNameFormat
                .replace('{title}', sanitizedTitle)
                .replace('{artistName}', sanitizedArtistName)
                .replace('{fileName}', originalFileName.replace(/\.[^/.]+$/, ''))
                .replace('{index}', i + 1)
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
            state.overallStatus = 'completed';
        } catch (error) {
            console.error('Error creating zip:', error);
            Swal.fire('Error!', `Failed to create zip file: ${error.message}`, 'error');
            state.overallStatus = 'error';
        }
    };

    const downloadImageByIndex = (index) => {
        const downloadFunction = typeof GM_download !== 'undefined' ? GM_download : GM.download;
        const imgLink = document.querySelectorAll(
            website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link'
        )[index];

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
        state.currentPostUrl = window.location.href;

        document
            .querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile) img' : 'a.fileThumb.image-link img')
            .forEach((img) => (img.className = 'post__image'));
        document
            .querySelectorAll(website === 'nekohouse' ? '.scrape__attachment-link' : '.post__attachment-link')
            .forEach((link) => (link.dataset.fileName = link.getAttribute('download')));

        elements.postActions = document.querySelector(website === 'nekohouse' ? '.scrape__actions' : '.post__actions');
        if (!elements.postActions) return;

        // Check for the presence of images or videos
        const hasMediaContent =
            document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link')
            .length > 0 || document.querySelectorAll('.post__video-link').length > 0;

        // Add buttons and status container only if there are images or videos and they don't already exist
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

            if (!elements.postActions.querySelector('.ug-button')) {
                const downloadAllButton = createToggleButton(BUTTONS.DOWNLOAD_ALL, downloadAllImagesAndVideos);
                const galleryButton = createToggleButton('Loading Gallery...', () => {
                    state.isGalleryMode = !state.isGalleryMode;
                }, true); // Initially disabled
                elements.galleryButton = galleryButton;

                elements.postActions.append(
                    createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
                    createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
                    createToggleButton(BUTTONS.FULL, () => resizeAllImages('full')),
                    downloadAllButton,
                    galleryButton
                );

                // Always show the gallery button
                elements.galleryButton.style.display = 'inline-block';
            }
        }

        if (!elements.settingsButton) {
            elements.settingsButton = createToggleButton(BUTTONS.SETTINGS, showSettings);
            elements.settingsButton.className = 'settings-button';
            document.body.appendChild(elements.settingsButton);
        }

        const fileDivs = document.querySelectorAll(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail');
        const parentDiv = fileDivs[0]?.parentNode;

        if (parentDiv) {
            state.displayedImages = Array.from(
                document.querySelectorAll(
                    website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile) img' : 'a.fileThumb.image-link img'
                )
            );

            state.displayedImages.forEach((img, index) => {
                const downloadLink = img
                    .closest(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail')
                    ?.querySelector(website === 'nekohouse' ? 'a.image-link' : '.fileThumb');
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
                    updateOverallStatus();
                };

                // Check if buttons already exist before adding them
                if (
                    !img
                    .closest(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail')
                    .previousElementSibling?.classList.contains('ug-button-container')
                ) {
                    const newDiv = document.createElement('div');
                    newDiv.classList.add('ug-button-container');
                    newDiv.append(
                        createToggleButton(BUTTONS.HEIGHT, resizeImage),
                        createToggleButton(BUTTONS.WIDTH, resizeImage),
                        createToggleButton(BUTTONS.FULL, () => imageActions.full(img)),
                        createToggleButton(BUTTONS.DOWNLOAD, () => downloadImageByIndex(index)),
                        createToggleButton(BUTTONS.REMOVE, removeImage)
                    );

                    // Add 'ug-button' class to the buttons in the newDiv
                    Array.from(newDiv.children).forEach((button) => button.classList.add('ug-button'));

                    parentDiv.insertBefore(newDiv, img.closest(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail'));
                }
                img.addEventListener('click', () => showExpandedImage(index));
            });

            // Use event delegation for dynamically added images
            parentDiv.addEventListener('click', delegatedImageClickHandler);

            const favoriteButton = document.querySelector(
                website === 'nekohouse' ? '.scrape__actions a.favorite-button' : '.post__actions a.favorite-button'
            );
            if (favoriteButton) {
                const newDiv = document.createElement('div');
                newDiv.style.display = 'inline-block';
                // Check if buttons already exist before adding them
                if (!favoriteButton.nextElementSibling?.classList.contains('ug-button-container')) {
                    newDiv.classList.add('ug-button-container');
                    newDiv.append(
                        createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
                        createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
                        createToggleButton(BUTTONS.FULL, () => resizeAllImages('full'))
                    );

                    // Add 'ug-button' class to the buttons in the newDiv
                    Array.from(newDiv.children).forEach((button) => button.classList.add('ug-button'));
                    favoriteButton.parentNode.insertBefore(newDiv, favoriteButton.nextSibling);
                }
            }
        }
    };

    const cleanupPostActions = () => {
        // Remove only elements with the 'ug-button' class
        if (elements.postActions) {
            const ugButtons = elements.postActions.querySelectorAll('.ug-button');
            ugButtons.forEach((button) => button.remove());
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

        // Remove status container
        if (elements.statusContainer) {
            elements.statusContainer.remove();
            elements.statusContainer = null;
            elements.statusElement = null;
        }

        elements.postActions = null; // Reset postActions
    };

    const resizeAllImages = (action) => {
        document
            .querySelectorAll(website === 'nekohouse' ? '.scrape__files img' : 'img.post__image')
            .forEach((img) => imageActions[action](img));
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

    const updateDownloadStatus = () => {
        const {
            downloadedCount,
            totalImages
        } = state;
        const status =
            downloadedCount === totalImages ? 'Done Downloading!' : `Downloading... (${downloadedCount}/${totalImages})`;
        updateStatus(elements.statusElement, status);
    };

    const updateOverallStatus = () => {
        const {
            overallStatus,
            loadedImages,
            totalImages,
            downloadedCount
        } = state;
        let statusMessage = '';

        switch (overallStatus) {
            case 'idle':
                statusMessage = '';
                break;
            case 'loading-media':
                if (totalImages > 0) {
                    statusMessage = `Loading media (${loadedImages}/${totalImages})...`;
                } else {
                    statusMessage = 'Loading media...';
                }
                break;
            case 'loading-gallery':
                statusMessage = 'Loading gallery...';
                break;
            case 'downloading':
                statusMessage = `Downloading... (${downloadedCount}/${totalImages})`;
                break;
            case 'completed':
                const imageLinks = document.querySelectorAll(
                    website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link'
                );
                const videoLinks = document.querySelectorAll('.post__video-link');
                const totalImagesCount = imageLinks.length;
                const totalVideosCount = videoLinks.length;

                if (totalVideosCount > 0 && totalImagesCount > 0) {
                    statusMessage = `Images and Videos Done Loading! Total: ${totalImages} (${totalImagesCount} images, ${totalVideosCount} videos)`;
                } else if (totalVideosCount > 0) {
                    statusMessage = `Videos Done Loading! Total: ${totalVideosCount}`;
                } else if (totalImagesCount > 0) {
                    statusMessage = `Images Done Loading! Total: ${totalImagesCount}`;
                }
                break;
            case 'error':
                statusMessage = 'Error loading some media.';
                break;
        }

        updateStatus(elements.statusElement, statusMessage);
    };

    const enableGalleryButton = () => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = BUTTONS.GALLERY;
            elements.galleryButton.disabled = false;
            elements.galleryButton.classList.remove('disabled');
        }
    };

    const disableGalleryButton = () => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = 'Loading Gallery...';
            elements.galleryButton.disabled = true;
            elements.galleryButton.classList.add('disabled');
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
        notificationContainer.id = 'ug-notification-container';
        notificationContainer.classList.add('ug-notification-container');

        const notificationText = document.createElement('div');
        notificationText.id = 'ug-notification-text';
        notificationContainer.appendChild(notificationText);

        const closeButton = document.createElement('button');
        closeButton.id = 'ug-notification-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => {
            state.notification = null;
        });
        notificationContainer.appendChild(closeButton);

        const reportButton = document.createElement('a');
        reportButton.id = 'ug-notification-report';
        reportButton.textContent = 'Report Issue';
        reportButton.href = 'https://github.com/TearTyr/Ultra-Galleries/issues';
        reportButton.target = '_blank';
        notificationContainer.appendChild(reportButton);

        document.body.appendChild(notificationContainer);
        return notificationContainer;
    };

    const showNotification = (message, type = 'info') => {
        if (!state.notificationsEnabled && type !== 'error') return;

        let notificationContainer = document.getElementById('ug-notification-container');
        if (!notificationContainer) {
            notificationContainer = createNotification();
        }

        const notificationText = document.getElementById('ug-notification-text');
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
        const notificationContainer = document.getElementById('ug-notification-container');
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
        const clickedImage = event.target.closest(
            website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile) img' : 'a.fileThumb.image-link img'
        );
        if (clickedImage) {
            const index = Array.from(
                document.querySelectorAll(
                    website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile) img' : 'a.fileThumb.image-link img'
                )
            ).indexOf(clickedImage);
            if (index !== -1) {
                showExpandedImage(index);
            }
        }
    };

    const injectUI = debounce(() => {
        if (!isPostPage()) {
            // Reset the flag when not on a post page
            state.postActionsInitialized = false;
            return;
        }

        const postSection = document.querySelector('.site-section.site-section--post');
        if (!state.postActionsInitialized && postSection) {
            state.galleryReady = false;
            state.loadedImages = 0;
            state.hasImages = false;
            // check for the presence of images or videos, create status container only if the page has them.
            const hasMediaContent =
                document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link')
                .length > 0 || document.querySelectorAll('.post__video-link').length > 0;
            if (hasMediaContent) {
                if (!elements.statusContainer) {
                    const {
                        container: statusContainer,
                        element: statusElement
                    } = createStatusElement();
                    elements.statusContainer = statusContainer;
                    elements.statusElement = statusElement;
                    const actionsContainer = document.querySelector(website === 'nekohouse' ? '.scrape__actions' : '.post__actions');
                    if (actionsContainer) {
                        actionsContainer.appendChild(elements.statusContainer);
                    }
                }
                state.overallStatus = 'loading-media';
            }

            loadImages();
            initPostActions();
            state.currentPostUrl = window.location.href;
        } else if (window.location.href !== state.currentPostUrl) {
            // Instead of reloading, re-initialize post actions and update the URL
            state.galleryReady = false;
            state.loadedImages = 0;
            state.hasImages = false;

            // check for the presence of images or videos, create status container only if the page has them.
            const hasMediaContent =
                document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link')
                .length > 0 || document.querySelectorAll('.post__video-link').length > 0;
            if (hasMediaContent) {
                if (!elements.statusContainer) {
                    const {
                        container: statusContainer,
                        element: statusElement
                    } = createStatusElement();
                    elements.statusContainer = statusContainer;
                    elements.statusElement = statusElement;
                    const actionsContainer = document.querySelector(website === 'nekohouse' ? '.scrape__actions' : '.post__actions');
                    if (actionsContainer) {
                        actionsContainer.appendChild(elements.statusContainer);
                    }
                }
                state.overallStatus = 'loading-media';
            }
            loadImages();
            initPostActions();
            state.currentPostUrl = window.location.href;
        }
    }, DEBOUNCE_DELAY);

    //old init
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
        if (state.overallStatus === 'completed') {
            state.notification = `Images Done Loading! Total: ${state.totalImages}`;
            state.notificationType = 'success';
        } else if (state.overallStatus === 'error') {
            state.notification = 'Error loading some media.';
            state.notificationType = 'error';
        }
    };

    init();
})();
