// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.3.2
// @description  Enhanced gallery experience with modern features and optimizations
// @author       ntf (original), Meri/TearTyr (updates)
// @match        *://kemono.su/*/user/*/post/*
// @match        *://coomer.su/*/user/*/post/*
// @match        *://nekohouse.su/*/user/*/post/*
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
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
    'use strict';

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

    const MAX_RETRIES = 10;
    const RETRY_DELAY = 1250;

    const website = window.location.hostname.split(".")[0];

    const createReactiveState = (initialState) => new Proxy(initialState, {
        set(target, key, value) {
            target[key] = value;
            if (key === "imageCount" || key === "totalImages") updateImageLoadingStatus();
            else if (key === "downloadedCount") updateDownloadStatus();
            return true;
        },
    });

    const state = createReactiveState({
        imageCount: 0, downloadedCount: 0, totalImages: 0, imagesLoaded: false, galleryActive: false, expandedViewActive: false,
        zipFileNameFormat: GM_getValue('zipFileNameFormat', '{title}-{artistName}.zip'),
        imageFileNameFormat: GM_getValue('imageFileNameFormat', '{title}-{artistName}-{fileName}-{index}'),
        galleryKey: GM_getValue('galleryKey', 'g'), galleryButtonInitialized: false, galleryReady: false, postActionsHooked: false,
        virtualGallery: [], originalImageSrcs: [], currentPostUrl: window.location.href, displayedImages: []
    });

    const elements = { statusElement: null, postActions: null, galleryButton: null, settingsButton: null, virtualGalleryContainer: null };

    const createToggleButton = (name, action) => {
        const toggle = document.createElement("a");
        toggle.textContent = name;
        toggle.addEventListener("click", action);
        toggle.style.cursor = "pointer";
        return toggle;
    };

    const updateStatus = (text) => { if (elements.statusElement) elements.statusElement.textContent = text; };

    const updateImageLoadingStatus = () => {
        const { imageCount, totalImages } = state;
        const status = imageCount === totalImages ? `Images Done Loading! Total: ${totalImages}` : `Loading images (${imageCount}/${totalImages})...`;
        updateStatus(status);
        if (imageCount === totalImages && !state.galleryReady) {
            setTimeout(() => { state.galleryReady = true; enableGalleryButton(); }, 1000);
        }
    };

    const updateDownloadStatus = () => {
        const { downloadedCount, totalImages } = state;
        const status = downloadedCount === totalImages ? "Done Downloading!" : `Downloading... (${downloadedCount}/${totalImages})`;
        updateStatus(status);
    };

    const enableGalleryButton = () => {
        if (elements.galleryButton) {
            elements.galleryButton.textContent = BUTTONS.GALLERY;
            elements.galleryButton.disabled = false;
            elements.galleryButton.classList.remove("disabled");
        }
    };

    const setImageStyle = (img, styles) => { if (img) Object.assign(img.style, styles); };

    const imageActions = {
        height: (img) => setImageStyle(img, { maxHeight: "100vh", maxWidth: "100%", width: "auto" }),
        width: (img) => setImageStyle(img, { maxHeight: "100%", maxWidth: "100vw", height: "auto" }),
        full: (img) => setImageStyle(img, { maxHeight: "none", maxWidth: "none", height: "auto", width: "auto" })
    };

    const removeImage = (evt) => {
        const buttonContainer = evt.currentTarget.closest("div");
        const imageContainer = buttonContainer?.nextElementSibling;
        if (imageContainer) {
            const index = Array.from(imageContainer.parentNode.children).indexOf(imageContainer) - 1;
            imageContainer.remove(); buttonContainer.remove();
            state.virtualGallery.splice(index, 1); state.originalImageSrcs.splice(index, 1);
            state.totalImages--; state.displayedImages.splice(index, 1); updateImageLoadingStatus();
        }
    };

    const resizeImage = (evt) => {
        const action = Object.keys(BUTTONS).find(key => BUTTONS[key] === evt.currentTarget.textContent)?.toLowerCase();
        const imgContainer = evt.currentTarget.closest(website === "nekohouse" ? ".scrape__files" : ".post__files");
        const displayedImage = imgContainer?.querySelector('img.post__image');
        if (displayedImage && imageActions[action]) imageActions[action](displayedImage);
    };

    const resizeAllImages = (action) => {
        document.querySelectorAll(website === "nekohouse" ? ".scrape__files img" : "img.post__image").forEach(img => imageActions[action](img));
    };

    const addToZip = async (zip, src, fileName, type, retryCount = 0) => {
        try {
            const response = await new Promise((resolve, reject) => {
                GM.xmlHttpRequest({ method: "GET", url: src, responseType: "blob", headers: { referer: `https://${website}.su/` }, onload: resolve, onerror: reject });
            });
            if (response.status === 200) { zip.file(fileName, response.response); if (type === "image") state.downloadedCount++; }
            else throw new Error(`Failed to download ${type}: ${src}, Status: ${response.status}`);
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                console.warn(`Failed to download ${type}: ${src}, retrying... (Attempt ${retryCount + 1})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return addToZip(zip, src, fileName, type, retryCount + 1);
            }
            console.error(`Failed to download ${type} after ${MAX_RETRIES} attempts:`, src, error); return false;
        }
        return true;
    };

    const downloadAllImagesAndVideos = async () => {
        const images = document.querySelectorAll(website === "nekohouse" ? "a.image-link:not(.scrape__user-profile)" : "a.fileThumb.image-link");
        const attachmentLinks = document.querySelectorAll(website === "nekohouse" ? ".scrape__attachment-link" : ".post__attachment-link");
        const title = document.querySelector(website === "nekohouse" ? ".scrape__title" : ".post__title")?.textContent.trim();
        const artistName = document.querySelector(website === "nekohouse" ? ".scrape__user-name" : ".post__user-name")?.textContent.trim();
        if (!title || !artistName) return; // Handle cases where title or artistName are not found

        const total = images.length + attachmentLinks.length; const zip = new JSZip();
        const sanitizeFileName = (name) => name.replace(/[/\\:*?"<>|]/g, "-");
        state.downloadedCount = 0; state.totalImages = total;

        const downloadPromises = [
            ...Array.from(images).map((imgLink, index) => {
                const imgSrc = imgLink.href.split("?")[0]; const fileName = imgLink.getAttribute("download");
                const imgName = state.imageFileNameFormat.replace("{title}", sanitizeFileName(title)).replace("{artistName}", sanitizeFileName(artistName)).replace("{fileName}", fileName.replace(/\.[^/.]+$/, "")).replace("{index}", index + 1).replace("{ext}", getExtension(fileName));
                return addToZip(zip, imgSrc, imgName, "image");
            }),
            ...Array.from(attachmentLinks).map(link => {
                const videoSrc = link.getAttribute("href"); const videoName = link.textContent.trim().replace("Download ", "");
                return addToZip(zip, videoSrc, videoName, "attachment");
            })
        ];

        try {
            await Promise.all(downloadPromises); const content = await zip.generateAsync({ type: "blob" });
            const zipFileName = state.zipFileNameFormat.replace("{artistName}", sanitizeFileName(artistName)).replace("{title}", sanitizeFileName(title));
            saveAs(content, zipFileName); updateStatus(`Done Downloading and adding to a zip! Total: ${total}`);
        } catch (error) { console.error(error); updateStatus(`Failed to download and add to zip.`); }
    };

    const loadImage = async (imgLink, retryCount = 0) => {
        try {
            const imgSrc = imgLink.href.split("?")[0];
            const response = await new Promise((resolve, reject) => {
                GM.xmlHttpRequest({ method: "GET", url: imgSrc, responseType: 'blob', headers: { referer: `https://${website}.su/` }, onload: resolve, onerror: reject });
            });
            if (response.status === 200) {
                const blob = response.response; const url = URL.createObjectURL(blob);
                state.virtualGallery.push(url); state.imageCount++;
            } else throw new Error(`Failed to load image: ${imgSrc}, Status: ${response.status}`);
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                console.warn(`Failed to load image: ${imgSrc}, retrying... (Attempt ${retryCount + 1})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); return loadImage(imgLink, retryCount + 1);
            }
            console.error(`Failed to load image after retries: ${imgLink.href}`, error); state.imageCount++;
        }
    };

    const loadImages = async () => {
        const imageLinks = document.querySelectorAll(website === "nekohouse" ? "a.image-link:not(.scrape__user-profile)" : "a.fileThumb.image-link");
        state.totalImages = imageLinks.length; state.virtualGallery = []; state.originalImageSrcs = []; state.displayedImages = [];
        for (const imgLink of imageLinks) { state.originalImageSrcs.push(imgLink.href.split("?")[0]); await loadImage(imgLink); }
        createVirtualGallery(); updateDisplayedImages();
    };

    const createVirtualGallery = () => {
        if (elements.virtualGalleryContainer) elements.virtualGalleryContainer.remove();
        elements.virtualGalleryContainer = document.createElement('div');
        elements.virtualGalleryContainer.style.display = 'none';
        state.virtualGallery.forEach(imageUrl => {
            const img = document.createElement('img'); img.src = imageUrl; img.className = 'virtual-image';
            elements.virtualGalleryContainer.appendChild(img);
        });
        document.body.appendChild(elements.virtualGalleryContainer);
    };

    const createGalleryOverlay = () => {
        const overlay = document.createElement("div"); overlay.id = "gallery-overlay";
        const galleryContainer = document.createElement("div"); galleryContainer.className = "gallery-container";
        const closeButton = document.createElement("button"); closeButton.textContent = "×"; closeButton.className = "gallery-close-button";
        closeButton.addEventListener("click", closeGallery);
        const galleryContent = document.createElement("div"); galleryContent.className = "gallery-content";
        const expandedView = document.createElement("div"); expandedView.className = "expanded-view";
        const expandedImage = document.createElement("img"); expandedImage.className = "expanded-image";
        const thumbnailContainer = document.createElement("div"); thumbnailContainer.className = "thumbnail-container";
        expandedView.append(expandedImage, thumbnailContainer); galleryContainer.append(closeButton, galleryContent, expandedView);
        overlay.appendChild(galleryContainer); return overlay;
    };

    const createNavigationButton = (direction) => {
        const button = document.createElement("button");
        button.textContent = direction === "prev" ? "←" : "→"; button.className = `navigation-button ${direction}`;
        return button;
    };

    const createLoadingOverlay = () => {
        const overlay = document.createElement("div"); overlay.className = "loading-overlay";
        const loadingText = document.createElement("div"); loadingText.textContent = "Loading...";
        overlay.appendChild(loadingText); return overlay;
    };

    let galleryKeyListenerAttached = false;
    let images;
    let currentIndex = 0;

    const handleGalleryKey = (event) => {
        if (event.key === state.galleryKey && state.galleryReady) showGallery();
        else if (state.galleryActive) {
            if (event.key === "Escape") state.expandedViewActive ? hideExpandedImage() : closeGallery();
            else if (state.expandedViewActive) {
                event.preventDefault();
                if (event.key === "ArrowLeft") { currentIndex = (currentIndex - 1 + images.length) % images.length; showExpandedImage(currentIndex); }
                else if (event.key === "ArrowRight") { currentIndex = (currentIndex + 1) % images.length; showExpandedImage(currentIndex); }
            }
        }
    };

    const closeGallery = () => {
        const overlay = document.getElementById("gallery-overlay");
        if (overlay) { document.body.removeChild(overlay); state.galleryActive = false; state.expandedViewActive = false; }
    };


    let showExpandedImage;
    let hideExpandedImage;

    const showGallery = () => {
        if (state.galleryActive) { closeGallery(); return; }
        state.galleryActive = true; const overlay = createGalleryOverlay();
        const galleryContent = overlay.querySelector(".gallery-content");
        const expandedView = overlay.querySelector(".expanded-view"); const expandedImage = expandedView.querySelector("img");
        const thumbnailContainer = expandedView.querySelector(".thumbnail-container");
        images = Array.from(elements.virtualGalleryContainer.querySelectorAll('.virtual-image')); currentIndex = 0;
        const pageNumber = document.createElement("div"); pageNumber.className = "page-number"; expandedView.appendChild(pageNumber);

        showExpandedImage = (index) => {
            state.expandedViewActive = true; const imgSrc = images[index].src;
            const loadingOverlay = createLoadingOverlay(); expandedView.appendChild(loadingOverlay);
            const tempImg = new Image();
            tempImg.onload = () => {
                expandedImage.src = tempImg.src; expandedView.removeChild(loadingOverlay); expandedView.style.display = "flex";
                currentIndex = index; pageNumber.textContent = `${index + 1} / ${images.length}`;
                thumbnailContainer.querySelectorAll(".expanded-thumbnail").forEach((thumb, i) => thumb.classList.toggle("active", i === index));
            };
            tempImg.onerror = () => { console.error("Failed to load image in expanded view:", imgSrc); expandedView.removeChild(loadingOverlay); };
            tempImg.src = imgSrc;
        };

        hideExpandedImage = () => { state.expandedViewActive = false; expandedView.style.display = "none"; };

        images.forEach((img, index) => {
            const thumbnail = document.createElement("img"); thumbnail.src = img.src; thumbnail.className = "thumbnail";
            thumbnail.addEventListener("click", () => showExpandedImage(index)); galleryContent.appendChild(thumbnail);
            const expandedThumbnail = thumbnail.cloneNode(true); expandedThumbnail.className = "expanded-thumbnail";
            expandedThumbnail.addEventListener("click", () => showExpandedImage(index)); thumbnailContainer.appendChild(expandedThumbnail);
        });

        const prevButton = createNavigationButton("prev"); const nextButton = createNavigationButton("next");
        prevButton.addEventListener("click", () => { currentIndex = (currentIndex - 1 + images.length) % images.length; showExpandedImage(currentIndex); });
        nextButton.addEventListener("click", () => { currentIndex = (currentIndex + 1) % images.length; showExpandedImage(currentIndex); });
        expandedView.append(prevButton, nextButton);
        expandedView.addEventListener("click", e => { if (e.target === expandedView) hideExpandedImage(); });
        document.body.appendChild(overlay);
    };

    const getExtension = (filename) => (filename.split('.').pop().toLowerCase() || "jpg");

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
            confirmButtonText: 'Save', focusConfirm: false,
            preConfirm: () => ({
                zipFileNameFormat: document.getElementById('zipFileNameFormat').value,
                imageFileNameFormat: document.getElementById('imageFileNameFormat').value,
                galleryKey: document.getElementById('galleryKey').value
            })
        }).then(result => {
            if (result.isConfirmed) {
                state.zipFileNameFormat = result.value.zipFileNameFormat; state.imageFileNameFormat = result.value.imageFileNameFormat;
                state.galleryKey = result.value.galleryKey;
                GM_setValue('zipFileNameFormat', state.zipFileNameFormat); GM_setValue('imageFileNameFormat', state.imageFileNameFormat);
                GM_setValue('galleryKey', state.galleryKey);
            }
        });
    };

    const initPostActions = () => {
        if (state.postActionsHooked && state.currentPostUrl === window.location.href) return;
        if (elements.postActions) elements.postActions.innerHTML = '';
        else {
            if (website === "nekohouse") elements.postActions = document.querySelector(".scrape__actions");
            else elements.postActions = document.querySelector(".post__actions");
        }
        if (!elements.postActions) return;

        state.postActionsHooked = false; state.currentPostUrl = window.location.href;
        document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile) img' : 'a.fileThumb.image-link img').forEach(img => img.className = 'post__image');
        document.querySelectorAll(website === 'nekohouse' ? '.scrape__attachment-link' : '.post__attachment-link').forEach(link => link.dataset.fileName = link.getAttribute('download'));

        const containerStatus = document.createElement('div'); containerStatus.style.display = 'inline-flex';
        const downloadAllButton = createToggleButton(BUTTONS.DOWNLOAD_ALL, downloadAllImagesAndVideos);
        elements.statusElement = document.createElement('span'); elements.statusElement.id = 'Status'; elements.statusElement.style.marginLeft = '10px';
        containerStatus.append(downloadAllButton, elements.statusElement);

        elements.galleryButton = createToggleButton("Loading Gallery...", showGallery);
        elements.galleryButton.disabled = true; elements.galleryButton.classList.add('disabled');
        elements.postActions.append(
            createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
            createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
            createToggleButton(BUTTONS.FULL, () => resizeAllImages('full')),
            containerStatus, elements.galleryButton
        );

        elements.settingsButton = createToggleButton(BUTTONS.SETTINGS, showSettings); elements.settingsButton.className = 'settings-button';
        document.body.appendChild(elements.settingsButton);

        const fileDivs = document.querySelectorAll(website === 'nekohouse' ? '.scrape__thumbnail' : '.post__thumbnail');
        const parentDiv = fileDivs[0]?.parentNode;
        if (parentDiv) {
            fileDivs.forEach((div, index) => {
                const downloadLink = div.querySelector(website === 'nekohouse' ? 'a.image-link' : '.fileThumb');
                if (downloadLink) {
                    const newDiv = document.createElement('div');
                    newDiv.append(
                        createToggleButton(BUTTONS.WIDTH, resizeImage), createToggleButton(BUTTONS.HEIGHT, resizeImage),
                        createToggleButton(BUTTONS.FULL, () => imageActions.full(div.querySelector('img.post__image'))),
                        createToggleButton(BUTTONS.DOWNLOAD, () => downloadImageByIndex(index)), createToggleButton(BUTTONS.REMOVE, removeImage)
                    );
                    parentDiv.insertBefore(newDiv, div); const displayedImage = div.querySelector('img.post__image');
                    if (displayedImage) state.displayedImages.push(displayedImage);
                }
            });
            const favoriteButton = document.querySelector(website === "nekohouse" ? ".scrape__actions a.favorite-button" : ".post__actions a.favorite-button");
            if (favoriteButton) {
                const newDiv = document.createElement('div'); newDiv.style.display = 'inline-block';
                newDiv.append(
                    createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
                    createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
                    createToggleButton(BUTTONS.FULL, () => resizeAllImages('full'))
                );
                favoriteButton.parentNode.insertBefore(newDiv, favoriteButton.nextSibling);
            }
        }
        state.postActionsHooked = true;
    };

    const downloadImageByIndex = (index) => {
        const downloadFunction = typeof GM_download !== 'undefined' ? GM_download : GM.download;
        const imgLink = document.querySelectorAll(website === 'nekohouse' ? 'a.image-link:not(.scrape__user-profile)' : 'a.fileThumb.image-link')[index];
        if (imgLink) {
            const imgSrc = imgLink.href.split("?")[0]; const fileName = imgLink.getAttribute('download');
            const options = { url: imgSrc, name: fileName, headers: { referer: `https://${website}.su/` } };
            downloadFunction(options);
        }
    };

    const init = () => {
        if (!galleryKeyListenerAttached) { window.addEventListener('keydown', handleGalleryKey); galleryKeyListenerAttached = true; }
        const postActionsObserver = new MutationObserver(initPostActions);
        postActionsObserver.observe(document.body, { childList: true, subtree: true });
        const pageChangeObserver = new MutationObserver(() => {
            if (state.currentPostUrl !== window.location.href) {
                state.postActionsHooked = false; state.currentPostUrl = window.location.href; loadImages();
            }
        });
        pageChangeObserver.observe(document.body, { childList: true, subtree: true }); loadImages();
    };

    const arraysEqual = (arr1, arr2) => {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) if (arr1[i] !== arr2[i]) return false;
        return true;
    };

    const updateDisplayedImages = () => {
        state.displayedImages.forEach((img, index) => {
            if (state.virtualGallery[index]) {
                img.src = state.virtualGallery[index];
                img.addEventListener('click', () => showExpandedImage(index)); // Fix: Use arrow function to preserve 'this'
            }
        });
    };

    init();
})();
