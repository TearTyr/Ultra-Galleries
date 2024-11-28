// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.3.3
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
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// ==/UserScript==

(function () {
    'use strict';

    // --- CSS Injection ---
    GM.xmlHttpRequest({
        method: "GET",
        url: "https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/main/Ultra-Galleries.css",
        onload: function (response) {
            if (response.status === 200) {
                GM_addStyle(response.responseText);
            } else {
                console.error("Error loading CSS:", response.status, response.statusText);
            }
        },
        onerror: function (error) {
            console.error("Error loading CSS:", error);
        }
    });

    // --- Constants ---
    const BUTTONS = {
        DOWNLOAD: "【DOWNLOAD】",
        DOWNLOAD_ALL: "【DL ALL】",
        FULL: "【FULL】",
        HEIGHT: "【FILL HEIGHT】",
        REMOVE: "【REMOVE】",
        WIDTH: "【FILL WIDTH】",
        GALLERY: "【GALLERY】",
        SETTINGS: "⚙️",
    };

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500;
    const IMAGE_BATCH_SIZE = 3; // Number of images to load at a time
    const DEBOUNCE_DELAY = 300;

    const website = window.location.hostname.split(".")[0];

    // --- Utility Functions ---
    const getExtension = (filename) => (filename.split('.').pop().toLowerCase() || "jpg");

    const sanitizeFileName = (name) => name.replace(/[/\\:*?"<>|]/g, "-");

    const debounce = (func, delay) => {
        let timeout;
        return function (...args) {
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
        height: (img) => setImageStyle(img, { maxHeight: "100vh", maxWidth: "100%", width: "auto" }),
        width: (img) => setImageStyle(img, { maxHeight: "100%", maxWidth: "100vw", height: "auto" }),
        full: (img) => setImageStyle(img, { maxHeight: "none", maxWidth: "none", height: "auto", width: "auto" }),
    };

    const createToggleButton = (name, action, disabled = false) => {
        const toggle = document.createElement("a");
        toggle.textContent = name;
        toggle.addEventListener("click", action);
        toggle.style.cursor = "pointer";
        if (disabled) {
            toggle.disabled = true;
            toggle.classList.add('disabled');
        }
        return toggle;
    };

    const createLoadingOverlay = (text = "Loading...") => {
        const overlay = document.createElement("div");
        overlay.className = "loading-overlay";
        const loadingText = document.createElement("div");
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
        return { container: containerStatus, element: statusElement };
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
        fullSizeImageSrcs: [] // Array to store full-size image URLs
    }, {
        galleryReady: (value) => {
            if (value) {
                enableGalleryButton();
            } else {
                disableGalleryButton();
            }
        },
        loadedImages: () => updateImageLoadingStatus(),
        downloadedCount: () => updateDownloadStatus(),
        totalImages: () => updateImageLoadingStatus(),
        isLoading: (value, oldValue) => {
            if (value && !oldValue) {
                if (state.galleryActive || state.isDownloading) { // Only show if gallery or download is active
                    showLoadingOverlay(state.loadingMessage);
                }
            } else if (!value && oldValue) {
                hideLoadingOverlay();
            }
        },
        loadingMessage: (value) => {
            if (state.isLoading && (state.galleryActive || state.isDownloading)) { // Only update if relevant
                updateLoadingOverlayText(value);
            }
        }
    });

    // --- Settings ---
    const showSettings = () => {
        let settings = { zipFileNameFormat: state.zipFileNameFormat, imageFileNameFormat: state.imageFileNameFormat, galleryKey: state.galleryKey };
        Swal.fire({
            title: 'Ultra Galleries - Settings',
            html: `
                <div><label for="zipFileNameFormat">Zip Filename Format:</label><input type="text" id="zipFileNameFormat" value="${settings.zipFileNameFormat}" placeholder="{title}-{artistName}.zip"><p>Available placeholders: {artistName}, {title}</p></div>
                <div><label for="imageFileNameFormat">Image Filename Format:</label><input type="text" id="imageFileNameFormat" value="${settings.imageFileNameFormat}" placeholder="{title}-{artistName}-{fileName}-{index}"><p>Available placeholders: {artistName}, {title}, {fileName}, {index}, {ext}</p></div>
                <div><label for="galleryKey">Gallery Key:</label><input type="text" id="galleryKey" value="${settings.galleryKey}" maxlength="1"><p>Press this key to open the gallery when it's loaded.</p></div>
                <div><p>Original author: ntf</p><p>Forked by: Meri/TearTyr</p></div>
            `,
            confirmButtonText: 'Save',
            focusConfirm: false,
            preConfirm: () => ({
                zipFileNameFormat: document.getElementById('zipFileNameFormat').value,
                imageFileNameFormat: document.getElementById('imageFileNameFormat').value,
                galleryKey: document.getElementById('galleryKey').value
            })
        }).then(result => {
            if (result.isConfirmed) {
                state.zipFileNameFormat = result.value.zipFileNameFormat;
                state.imageFileNameFormat = result.value.imageFileNameFormat;
                state.galleryKey = result.value.galleryKey;
                GM_setValue('zipFileNameFormat', state.zipFileNameFormat);
                GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
                GM_setValue('galleryKey', state.galleryKey);
            }
        });
    };

    // --- Image Loading and Gallery Functions ---

    let elements = {};

    const loadImage = async (imgLink, index) => {
        try {
            const imgSrc = imgLink.href.split("?")[0];
            state.fullSizeImageSrcs[index] = imgSrc;

            const img = imgLink.querySelector('img');
            if (img) {
                img.src = imgSrc;
                img.dataset.originalSrc = imgSrc;
                await new Promise(resolve => img.onload = resolve);
            }

            state.virtualGallery[index] = imgSrc;
            state.loadedImages++;

        } catch (error) {
            console.error(`Failed to load image: ${imgLink.href}`, error);
            state.virtualGallery[index] = null; // Placeholder for failed image
            state.loadedImages++;
        } finally {
            if (state.loadedImages === state.totalImages) {
                createVirtualGallery();
                state.galleryReady = true;
                state.isLoading = false;
                state.loadingMessage = null;
            }
        }
    };

    const loadImages = async () => {
        if (state.galleryReady || state.isLoading) return;

        state.isLoading = true;
        state.loadingMessage = "Loading Images...";

        const imageLinks = document.querySelectorAll(website === "nekohouse" ? "a.image-link:not(.scrape__user-profile)" : "a.fileThumb.image-link");
        state.totalImages = imageLinks.length;
        state.virtualGallery = Array(state.totalImages).fill(null);
        state.fullSizeImageSrcs = Array(state.totalImages).fill(null);
        state.loadedImages = 0;

        const loadingPromises = [];
        for (let i = 0; i < imageLinks.length; i++) {
            loadingPromises.push(loadImage(imageLinks[i], i));
        }

        await Promise.all(loadingPromises);
    };

    const createVirtualGallery = () => {
        cleanupVirtualGallery();

        elements.virtualGalleryContainer = document.createElement('div');
        elements.virtualGalleryContainer.style.display = 'none';
        state.virtualGallery.forEach(imageUrl => {
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
            state.virtualGallery.forEach(url => URL.revokeObjectURL(url)); // Revoke object URLs
            state.virtualGallery = [];
        }
        state.galleryReady = false;
    };

    // --- Gallery Display and Navigation ---
    let galleryKeyListenerAttached = false;
    let images;
    let currentIndex;

    const createGalleryOverlay = () => {
        const overlay = document.createElement("div");
        overlay.id = "gallery-overlay";
        const galleryContainer = document.createElement("div");
        galleryContainer.className = "gallery-container";
        const closeButton = document.createElement("button");
        closeButton.textContent = "×";
        closeButton.className = "gallery-close-button";
        closeButton.addEventListener("click", closeGallery);
        const galleryContent = document.createElement("div");
        galleryContent.className = "gallery-content";

        const expandedView = document.createElement("div");
        expandedView.className = "expanded-view";
        const expandedImage = document.createElement("img");
        expandedImage.className = "expanded-image";
        const pageNumber = document.createElement("div");
        pageNumber.className = "page-number";
        const thumbnailContainer = document.createElement("div");
        thumbnailContainer.className = "thumbnail-container";

        const prevButton = createNavigationButton("prev");
        const nextButton = createNavigationButton("next");

        prevButton.addEventListener("click", () => showExpandedImage((currentIndex - 1 + images.length) % images.length));
        nextButton.addEventListener("click", () => showExpandedImage((currentIndex + 1) % images.length));

        expandedView.append(expandedImage, pageNumber, thumbnailContainer, prevButton, nextButton);
        expandedView.addEventListener("click", e => {
            if (e.target === expandedView) hideExpandedImage();
        });

        galleryContainer.append(closeButton, galleryContent, expandedView);
        overlay.appendChild(galleryContainer);
        return overlay;
    };

    const createNavigationButton = (direction) => {
        const button = document.createElement("button");
        button.textContent = direction === "prev" ? "←" : "→";
        button.className = `navigation-button ${direction}`;
        return button;
    };

    let showExpandedImage, hideExpandedImage; // Declared with let

    const showGallery = () => {
        if (state.galleryActive || !state.galleryReady) return;
        state.galleryActive = true;
        state.loadingMessage = "Loading Gallery..."; // Set loading message here

        const overlay = createGalleryOverlay();
        const galleryContent = overlay.querySelector(".gallery-content");
        const expandedView = overlay.querySelector(".expanded-view");
        const expandedImage = expandedView.querySelector("img");
        const thumbnailContainer = expandedView.querySelector(".thumbnail-container");
        const pageNumber = expandedView.querySelector(".page-number");
        images = Array.from(elements.virtualGalleryContainer.querySelectorAll('.virtual-image'));
        currentIndex = 0;

        showExpandedImage = (index) => {
            if (state.fullSizeImageSrcs.length === 0 || index < 0 || index >= state.fullSizeImageSrcs.length) {
                console.error("Invalid image index:", index);
                return; // Handle invalid index
            }

            state.expandedViewActive = true;
            state.loadingMessage = "Loading Image...";

            const imgSrc = state.fullSizeImageSrcs[index]; // Use fullSizeImageSrcs

            if (!imgSrc) {
                console.error("Image source is undefined for index:", index);
                state.loadingMessage = null;
                return;
            }

            const expandedView = document.querySelector(".expanded-view"); // Make sure this selector is correct
            const expandedImage = expandedView.querySelector("img");
            const pageNumber = expandedView.querySelector(".page-number");
            const thumbnailContainer = expandedView.querySelector(".thumbnail-container");

            const loadingOverlay = createLoadingOverlay();
            expandedView.appendChild(loadingOverlay);

            const tempImg = new Image();
            tempImg.onload = () => {
                expandedImage.src = tempImg.src;
                expandedView.removeChild(loadingOverlay);
                expandedView.style.display = "flex";
                currentIndex = index;
                pageNumber.textContent = `${index + 1} / ${state.fullSizeImageSrcs.length}`;
                thumbnailContainer.querySelectorAll(".expanded-thumbnail").forEach((thumb, i) => thumb.classList.toggle("active", i === index));
                state.loadingMessage = null;
            };
            tempImg.onerror = () => {
                console.error("Failed to load image in expanded view:", imgSrc);
                expandedView.removeChild(loadingOverlay);
                state.loadingMessage = null;
                // Optionally, display an error message in the expanded view
                expandedImage.src = ""; // Clear the image
                pageNumber.textContent = "Error loading image";
            };
            tempImg.src = imgSrc;
        };

        hideExpandedImage = () => {  // Now assigned inside showGallery
            state.expandedViewActive = false;
            expandedView.style.display = "none";
            state.loadingMessage = null; // Clear loading message when hiding
        };

        images.forEach((img, index) => {
            const thumbnail = document.createElement("img");
            thumbnail.src = img.src;
            thumbnail.className = "thumbnail";
            thumbnail.addEventListener("click", () => showExpandedImage(index));
            galleryContent.appendChild(thumbnail);

            const expandedThumbnail = thumbnail.cloneNode(true);
            expandedThumbnail.className = "expanded-thumbnail";
            expandedThumbnail.addEventListener("click", () => showExpandedImage(index));
            thumbnailContainer.appendChild(expandedThumbnail);
        });

        document.body.appendChild(overlay);
        showExpandedImage(currentIndex); // Show the first image after images is populated
    };

    const closeGallery = () => {
        const overlay = document.getElementById("gallery-overlay");
        if (overlay) {
            document.body.removeChild(overlay);
            state.galleryActive = false;
            state.expandedViewActive = false;
            state.loadingMessage = null; // Clear loading message when closing
        }
    };

    const handleGalleryKey = (event) => {
        if (event.key === state.galleryKey && state.galleryReady) {
            showGallery();
        } else if (state.galleryActive) {
            if (event.key === "Escape") {
                state.expandedViewActive ? hideExpandedImage() : closeGallery();
            } else if (state.expandedViewActive) {
                event.preventDefault();
                if (event.key === "ArrowLeft") {
                    showExpandedImage((currentIndex - 1 + images.length) % images.length);
                } else if (event.key === "ArrowRight") {
                    showExpandedImage((currentIndex + 1) % images.length);
                }
            }
        }
    };

    // --- Downloading and Post Actions ---

    const downloadAllImagesAndVideos = async () => {
        const images = document.querySelectorAll(website === "nekohouse" ? "a.image-link:not(.scrape__user-profile)" : "a.fileThumb.image-link");
        const attachmentLinks = document.querySelectorAll(website === "nekohouse" ? ".scrape__attachment-link" : ".post__attachment-link");
        const title = document.querySelector(website === "nekohouse" ? ".scrape__title" : ".post__title")?.textContent?.trim() || "Untitled";
        const artistName = document.querySelector(website === "nekohouse" ? ".scrape__user-name" : ".post__user-name")?.textContent?.trim() || "Unknown Artist";

        const total = images.length + attachmentLinks.length;
        if (total === 0) return;

        state.isDownloading = true;
        state.loadingMessage = "Downloading...";
        state.downloadedCount = 0;
        state.totalImages = total;

        const zip = new JSZip(); // Create zip instance outside worker

        const zipWorker = new Worker(URL.createObjectURL(new Blob([`
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
            let zip; // Declare zip inside worker
            self.onmessage = async (e) => {
                const { type, data } = e.data;
                if (type === 'addFile') {
                    const { src, fileName } = data;
                    try {
                        const response = await fetch(src, { headers: { referer: 'https://${website}.su/' } });
                        if (!response.ok) {
                            throw new Error(\`Failed to fetch: \${src}, Status: \${response.status}\`);
                        }
                        const blob = await response.blob();
                        zip.file(fileName, blob);
                        self.postMessage({ type: 'progress', downloaded: 1 });
                    } catch (error) {
                        console.error('Error in Web Worker:', error);
                        self.postMessage({ type: 'error', error: error.message });
                    }
                } else if (type === 'generateZip') {
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    self.postMessage({ type: 'zipReady', blob: zipBlob });
                }
            };
        `], { type: 'application/javascript' })));

        zipWorker.onmessage = (e) => {
            const { type, downloaded, blob, error } = e.data;
            if (type === 'progress') {
                state.downloadedCount += downloaded;
            } else if (type === 'zipReady') {
                const zipFileName = state.zipFileNameFormat.replace("{artistName}", sanitizeFileName(artistName)).replace("{title}", sanitizeFileName(title));
                saveAs(blob, zipFileName);
                state.isDownloading = false;
                state.loadingMessage = null;
                zipWorker.terminate();
                updateStatus(elements.statusElement, `Done! Total: ${total}`);
            } else if (type === 'error') {
                console.error('Web Worker Error:', error);
                state.isDownloading = false;
                state.loadingMessage = null;
                zipWorker.terminate();
                updateStatus(elements.statusElement, `Error creating zip`);
            }
        };

        const addFileToZip = async (src, fileName) => { // Made async
            try {
                const response = await fetch(src, { headers: { referer: 'https://${website}.su/' } });
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${src}, Status: ${response.status}`);
                }
                const blob = await response.blob();
                zip.file(fileName, blob);
                self.postMessage({ type: 'progress', downloaded: 1 });
            } catch (error) {
                console.error('Error in Web Worker:', error);
                self.postMessage({ type: 'error', error: error.message });
            }
        }; // Now handles fetching and error handling internally

        const downloadPromises = [
            ...Array.from(images).map((imgLink, index) => {
                const imgSrc = imgLink.href.split("?")[0];
                const fileName = imgLink.getAttribute("download") || `image-${index + 1}.jpg`;
                const imgName = state.imageFileNameFormat
                    .replace("{title}", sanitizeFileName(title))
                    .replace("{artistName}", sanitizeFileName(artistName))
                    .replace("{fileName}", fileName.replace(/\.[^/.]+$/, ""))
                    .replace("{index}", index + 1)
                    .replace("{ext}", getExtension(fileName));
                return addFileToZip(imgSrc, imgName);
            }),
            ...Array.from(attachmentLinks).map((link, index) => {
                const videoSrc = link.getAttribute("href");
                const videoName = link.textContent.trim().replace("Download ", "") || `attachment-${index + 1}`;
                return addFileToZip(videoSrc, videoName);
            }),
        ];

        Promise.all(downloadPromises).then(() => {
            zipWorker.postMessage({ type: 'generateZip' });
        });
    };

    const downloadImageByIndex = (index) => {
        const downloadFunction = typeof GM_download !== 'undefined' ? GM_download : GM.download;
        const imgLink = document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link')[index];

        if (imgLink) {
            const imgSrc = imgLink.href.split("?")[0];
            const fileName = imgLink.getAttribute('download');
            const options = { url: imgSrc, name: fileName, headers: { referer: `https://${website}.su/` } };
            downloadFunction(options);
        }
    };

    const initPostActions = () => {
        if (!isPostPage() || state.currentPostUrl === window.location.href) return;
        cleanupPostActions(); // Clean up previous actions and listeners
        state.currentPostUrl = window.location.href;

        document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile) img' : 'a.fileThumb.image-link img').forEach(img => img.className = 'post__image');
        document.querySelectorAll(website === 'nekohouse' ? '.scrape__attachment-link' : '.post__attachment-link').forEach(link => link.dataset.fileName = link.getAttribute('download'));

        const { container: statusContainer, element: statusElement } = createStatusElement();
        elements.statusElement = statusElement;

        elements.postActions = document.querySelector(website === "nekohouse" ? ".scrape__actions" : ".post__actions");
        if (!elements.postActions) return;

        const downloadAllButton = createToggleButton(BUTTONS.DOWNLOAD_ALL, downloadAllImagesAndVideos);
        const galleryButton = createToggleButton("Loading Gallery...", showGallery, true); // Initially disabled
        elements.galleryButton = galleryButton;

        elements.postActions.append(
            createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
            createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
            createToggleButton(BUTTONS.FULL, () => resizeAllImages('full')),
            downloadAllButton, statusContainer, galleryButton
        );

        if (!elements.settingsButton) {
            elements.settingsButton = createToggleButton(BUTTONS.SETTINGS, showSettings);
            elements.settingsButton.className = 'settings-button';
            document.body.appendChild(elements.settingsButton);
        }

        const fileDivs = document.querySelectorAll(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail');
        const parentDiv = fileDivs[0]?.parentNode;

        if (parentDiv) {
            state.displayedImages = Array.from(document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile) img' : 'a.fileThumb.image-link img'));

            state.displayedImages.forEach((img, index) => {
                const downloadLink = img.closest(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail')?.querySelector(website === 'nekohouse' ? 'a.image-link' : '.fileThumb');
                if (!downloadLink) return;

                const removeImage = (evt) => {
                    const buttonContainer = evt.currentTarget.closest("div");
                    const imageContainer = buttonContainer?.nextElementSibling;
                    if (!imageContainer || !imageContainer.parentNode) return;

                    imageContainer.parentNode.removeChild(imageContainer);
                    buttonContainer.parentNode.removeChild(buttonContainer);

                    state.virtualGallery.splice(index, 1);
                    state.originalImageSrcs.splice(index, 1);
                    state.totalImages--;
                    state.displayedImages.splice(index, 1);
                    updateImageLoadingStatus();
                };

                const newDiv = document.createElement('div');
                newDiv.append(
                    createToggleButton(BUTTONS.WIDTH, resizeImage),
                    createToggleButton(BUTTONS.HEIGHT, resizeImage),
                    createToggleButton(BUTTONS.FULL, () => imageActions.full(img)),
                    createToggleButton(BUTTONS.DOWNLOAD, () => downloadImageByIndex(index)),
                    createToggleButton(BUTTONS.REMOVE, removeImage)
                );

                parentDiv.insertBefore(newDiv, img.closest(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail'));
                img.addEventListener('click', () => showExpandedImage(index));
            });

            const favoriteButton = document.querySelector(website === "nekohouse" ? ".scrape__actions a.favorite-button" : ".post__actions a.favorite-button");
            if (favoriteButton) {
                const newDiv = document.createElement('div');
                newDiv.style.display = 'inline-block';
                newDiv.append(
                    createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
                    createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
                    createToggleButton(BUTTONS.FULL, () => resizeAllImages('full'))
                );
                favoriteButton.parentNode.insertBefore(newDiv, favoriteButton.nextSibling);
            }
        }
    };

    const cleanupPostActions = () => {
        if (elements.postActions) {
            while (elements.postActions.firstChild) {
                elements.postActions.removeChild(elements.postActions.firstChild);
            }
        }
        if (elements.settingsButton) {
            elements.settingsButton.remove();
            elements.settingsButton = null;
        }

        state.displayedImages.forEach(img => {
            img.removeEventListener('click', () => showExpandedImage(index)); // Remove any lingering event listeners
        });
        state.displayedImages = [];

        // Clean up status element
        if (elements.statusElement && elements.statusElement.parentNode) {
            elements.statusElement.parentNode.removeChild(elements.statusElement);
            elements.statusElement = null;
        }

        // Clean up download all button
        if (elements.downloadAllButton && elements.downloadAllButton.parentNode) {
            elements.downloadAllButton.parentNode.removeChild(elements.downloadAllButton);
            elements.downloadAllButton = null;
        }

        // Clean up gallery button
        if (elements.galleryButton && elements.galleryButton.parentNode) {
            elements.galleryButton.parentNode.removeChild(elements.galleryButton);
            elements.galleryButton = null;
        }

        elements.postActions = null; // Reset postActions
        state.currentPostUrl = null; // Reset current post URL
    };

    const resizeAllImages = (action) => {
        document.querySelectorAll(website === "nekohouse" ? ".scrape__files img" : "img.post__image").forEach((img) => imageActions[action](img));
    };

    const resizeImage = (evt) => {
        const action = Object.keys(BUTTONS).find((key) => BUTTONS[key] === evt.currentTarget.textContent)?.toLowerCase();
        const buttonContainer = evt.currentTarget.closest("div");
        const imageContainer = buttonContainer?.nextElementSibling;
        const displayedImage = imageContainer?.querySelector('img'); // Target the img tag directly

        if (displayedImage && imageActions[action]) {
            imageActions[action](displayedImage);
        }
    };

    const updateImageLoadingStatus = () => {
        const { loadedImages, totalImages } = state;
        const status = loadedImages === totalImages ? `Images Done Loading! Total: ${totalImages}` : `Loading images (${loadedImages}/${totalImages})...`;
        updateStatus(elements.statusElement, status);
    };

    const updateDownloadStatus = () => {
        const { downloadedCount, totalImages } = state;
        const status = downloadedCount === totalImages ? "Done Downloading!" : `Downloading... (${downloadedCount}/${totalImages})`;
        updateStatus(elements.statusElement, status);
    };

    const enableGalleryButton = () => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = BUTTONS.GALLERY;
            elements.galleryButton.disabled = false;
            elements.galleryButton.classList.remove("disabled");
        }
    };

    const disableGalleryButton = () => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = "Loading Gallery...";
            elements.galleryButton.disabled = true;
            elements.galleryButton.classList.add("disabled");
        }
    };

    const showLoadingOverlay = () => {
        if (!elements.loadingOverlay) {
            elements.loadingOverlay = createLoadingOverlay();
            document.body.appendChild(elements.loadingOverlay);
        }
    };

    const hideLoadingOverlay = () => {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.remove();
            elements.loadingOverlay = null;
        }
    };

    // --- Mutation Observer and Initialization ---
    const isPostPage = () => !!document.querySelector(".site-section.site-section--post");

    const injectUI = debounce(() => {
        if (!isPostPage()) return;

        if (state.currentPostUrl !== window.location.href || !elements.postActions) {
            if (state.currentPostUrl !== window.location.href) {
                // Reset gallery state if navigating to a new post
                state.galleryReady = false;
                state.galleryActive = false;
                state.expandedViewActive = false;
                state.virtualGallery = [];
                state.originalImageSrcs = [];
                state.displayedImages = [];
                state.totalImages = 0;
                state.loadedImages = 0;
                state.downloadedCount = 0;
                state.isLoading = false;
                state.loadingMessage = null;
                cleanupVirtualGallery();
                cleanupPostActions();
            }
            loadImages();
            initPostActions();
        }
    }, DEBOUNCE_DELAY);

    const init = () => {
        if (!galleryKeyListenerAttached) {
            window.addEventListener('keydown', handleGalleryKey);
            galleryKeyListenerAttached = true;
        }

        const targetNode = document.body;
        const config = { childList: true, subtree: true };

        const observer = new MutationObserver(injectUI);

        observer.observe(targetNode, config);
        injectUI(); // Initial check
    };

    init();
})();
