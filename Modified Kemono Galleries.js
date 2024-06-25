// ==UserScript==
// @name         Ultra Kemono Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      1.8.3
// @description  Load original resolution, toggle fitted zoom views, remove photos, and batch download images and videos.
// @author       Meri
// @match        *://kemono.su/*/user/*/post/*
// @match        *://coomer.su/*/user/*/post/*
// @icon         https://kemono.party/static/menu/recent.svg
// @grant        GM_download
// @grant        GM_info
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @grant        GM.xmlHttpRequest
// @grant        GM.setClipboard
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.bootcdn.net/ajax/libs/jquery/2.2.4/jquery.min.js
// @require      https://cdn.bootcss.com/jszip/3.1.4/jszip.min.js
// @require      https://cdn.bootcss.com/FileSaver.js/1.3.2/FileSaver.min.js
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Constants
  const BUTTONS = {
    DOWNLOAD: '【DOWNLOAD】',
    DOWNLOAD_ALL: '【DL ALL】',
    FULL: '【FULL】',
    HEIGHT: '【FILL HEIGHT】',
    REMOVE: '【REMOVE】',
    WIDTH: '【FILL WIDTH】'
  };
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 1250;

  // State
  const state = {
    imageCount: 0,
    downloadedCount: 0,
    totalImages: 0,
    imageStatusUpdated: false
  };

  // DOM Elements
  const elements = {
    statusElement: null,
    postActions: null
  };

  // Helper functions
  const createToggleButton = (name, action) => {
    const toggle = document.createElement('a');
    toggle.textContent = name;
    toggle.addEventListener('click', action);
    toggle.style.cursor = 'pointer';
    return toggle;
  };

  const updateStatus = (text) => {
    if (elements.statusElement) {
      elements.statusElement.textContent = text;
    }
  };

  const updateImageLoadingStatus = () => {
    const { imageCount, totalImages, imageStatusUpdated } = state;
    const status = imageCount === totalImages || imageStatusUpdated
      ? `Images Done Loading! Total: ${totalImages}`
      : `Loading images (${imageCount}/${totalImages})...`;
    updateStatus(status);
  };

  const updateDownloadStatus = () => {
    const { downloadedCount, totalImages } = state;
    const status = downloadedCount === totalImages
      ? 'Done Downloading!'
      : 'Downloading...';
    updateStatus(status);
  };

  // Image manipulation functions
  const setImageStyle = (img, styles) => {
    if (img) {
      Object.assign(img.style, styles);
    } else {
      console.error('Image element is undefined or null:', img);
    }
  };

  const imageActions = {
    setHeight: (img) => setImageStyle(img, { maxHeight: '100vh', maxWidth: '100%', width: 'auto' }),
    setWidth: (img) => setImageStyle(img, { maxHeight: '100%', maxWidth: '100vw', height: 'auto' }),
    setFull: (img) => setImageStyle(img, { maxHeight: 'none', maxWidth: 'none', height: 'auto', width: 'auto' })
  };

  const removeImage = (evt) => {
    const parent = evt.currentTarget.parentNode;
    parent.nextSibling.remove();
    parent.remove();
  };

  const resizeImage = (evt) => {
    const name = evt.currentTarget.textContent;
    const imgContainer = evt.currentTarget.parentNode.nextElementSibling;
    const img = imgContainer?.querySelector('.post__image');

    if (img) {
      const action = Object.entries(BUTTONS).find(([_, value]) => value === name)?.[0].toLowerCase();
      if (action && imageActions[`set${action.charAt(0).toUpperCase() + action.slice(1)}`]) {
        imageActions[`set${action.charAt(0).toUpperCase() + action.slice(1)}`](img);
      }
    } else {
      console.error('Image element not found for resize:', evt.currentTarget.parentNode);
    }
  };

  const resizeAllImages = (actionName) => {
    const imgs = document.querySelectorAll('.post__image');
    const action = Object.entries(BUTTONS).find(([_, value]) => value === actionName)?.[0].toLowerCase();
    if (action && imageActions[`set${action.charAt(0).toUpperCase() + action.slice(1)}`]) {
      imgs.forEach(img => imageActions[`set${action.charAt(0).toUpperCase() + action.slice(1)}`](img));
    }
  };

  // Zip archive creation
  const addToZip = (zip, src, fileName, type) => {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url: src,
        responseType: 'blob',
        headers: { referer: 'https://kemono.su/' },
        onload: (response) => {
          if (response.status === 200) {
            zip.file(fileName, response.response);
            if (type === 'image') {
              state.downloadedCount++;
              updateDownloadStatus();
            }
            resolve();
          } else {
            reject(new Error(`Failed to download ${type}: ${src}`));
          }
        },
        onerror: (error) => reject(error)
      });
    });
  };

  const addToZipWithRetry = async (zip, src, fileName, type, retryCount = 0) => {
    try {
      await addToZip(zip, src, fileName, type);
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Failed to download ${type}: ${src}, retrying... (Attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        await addToZipWithRetry(zip, src, fileName, type, retryCount + 1);
      } else {
        throw error;
      }
    }
  };

  const downloadImage = (evt) => {
    evt.preventDefault();
    const img = evt.target.parentNode.nextElementSibling.querySelector('.post__image');
    if (img) {
      const imgSrc = img.getAttribute('src');
      try {
        const url = new URL(imgSrc, document.baseURI);
        const fileName = url.pathname.split('/').pop();
        const [baseFileName, fileExtension] = fileName.split('.');
        const title = document.querySelector('.post__title').textContent.trim();
        const artistName = document.querySelector('.post__user-name').textContent.trim();
        const imgName = `${artistName}-${baseFileName}.${fileExtension}`;
        GM_download({
          url: imgSrc,
          name: imgName,
          onload: () => console.log('Image downloaded successfully:', imgName),
          onerror: (error) => console.error('Failed to download image:', imgName, error)
        });
      } catch (error) {
        console.error('Error processing image source:', imgSrc, error);
      }
    } else {
      console.error('Image source is empty:', evt.target);
    }
  };

  const downloadAllImagesAndVideos = async () => {
    const images = document.querySelectorAll('.post__image');
    const attachmentLinks = document.querySelectorAll('.post__attachment-link');
    const title = document.querySelector('.post__title').textContent.trim();
    const artistName = document.querySelector('.post__user-name').textContent.trim();

    const total = images.length + attachmentLinks.length;
    const zip = new JSZip();

    const sanitizeFileName = (name) => name.replace(/[/\\:*?"<>|]/g, '-');

    const downloadPromises = [
      ...Array.from(images).map((img, index) => {
        const imgSrc = img.getAttribute('src');
        const fileName = imgSrc.split('/').pop();
        const [baseFileName, fileExtension] = fileName.split('.');
        const imgName = `${artistName}-${sanitizeFileName(title)}-${baseFileName}.${fileExtension}`;
        return addToZipWithRetry(zip, imgSrc, imgName, 'image');
      }),
      ...Array.from(attachmentLinks).map((link) => {
        const videoSrc = link.getAttribute('href');
        const videoName = sanitizeFileName(link.dataset.fileName);
        return addToZipWithRetry(zip, videoSrc, videoName, 'video');
      })
    ];

    try {
      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `${artistName}-${sanitizeFileName(title)}.zip`;
      saveAs(content, zipFileName);
      updateStatus(`Done Downloading and adding to a zip! Total: ${total}`);
    } catch (error) {
      console.error(error);
      updateStatus(`Failed to download and add to zip.`);
    }
  };

  // Force image load
  const forceLoadImage = (imgSrc, status) => {
    if (status === 429) {
      fetch(imgSrc, { method: 'HEAD' })
        .then((response) => {
          if (response.status === 200) {
            console.log('Force loaded image:', imgSrc);
            state.imageCount++;
            updateImageLoadingStatus();
          } else {
            console.error('Failed to force load image:', imgSrc, response.status);
            updateImageLoadingStatus();
          }
        })
        .catch((error) => {
          console.error('Failed to force load image:', imgSrc, error);
          updateImageLoadingStatus();
        });
    }
  };

  const loadImageWithRetry = async (img, imgSrc, retryCount = 0) => {
    try {
      const response = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'HEAD',
          url: imgSrc,
          onload: resolve,
          onerror: reject
        });
      });

      const status = response.status;
      if (status === 200) {
        console.log('Image loaded successfully:', imgSrc);
        img.src = imgSrc;
      } else if (status === 429) {
        console.warn('Image rate limited:', imgSrc);
        throw new Error(`Image rate limited: ${imgSrc}`);
      } else {
        console.error('Failed to load image:', imgSrc, 'Status:', status);
        forceLoadImage(imgSrc, status);
        throw new Error(`Failed to load image: ${imgSrc}, Status: ${status}`);
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying image load: ${imgSrc} in ${delay / 1000} seconds (Attempt ${retryCount + 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await loadImageWithRetry(img, imgSrc, retryCount + 1);
      } else {
        throw error;
      }
    }
  };

  const loadImages = async () => {
    const images = document.querySelectorAll('a.fileThumb.image-link');
    state.totalImages = images.length;

    for (const a of images) {
      const img = a.querySelector('img');
      const imgSrc = a.getAttribute('href');

      try {
        await loadImageWithRetry(img, imgSrc);
        state.imageCount++;
        updateImageLoadingStatus();
      } catch (error) {
        console.error('Failed to load image after all retries:', imgSrc, error);
        updateStatus(`Image loading failed: ${imgSrc}`);
      }
    }

    console.log('All images loaded successfully');
  };

  // Main script execution
  const init = () => {
    document.querySelectorAll('a.fileThumb.image-link img').forEach((img) => (img.className = 'post__image'));

    document.querySelectorAll('.post__attachment-link').forEach((link) => {
      link.dataset.fileName = link.getAttribute('download');
    });

    const fileDivs = document.querySelectorAll('.post__thumbnail');
    const parentDiv = fileDivs[0]?.parentNode;

    const containerStatus = document.createElement('div');
    containerStatus.style.display = 'inline-flex';

    const downloadAllButton = createToggleButton(BUTTONS.DOWNLOAD_ALL, downloadAllImagesAndVideos);
    elements.statusElement = document.createElement('span');
    elements.statusElement.id = 'Status';
    elements.statusElement.textContent = '';

    containerStatus.append(downloadAllButton, elements.statusElement);

    if (parentDiv) {
      fileDivs.forEach((div) => {
        const newDiv = document.createElement('div');
        newDiv.append(
          createToggleButton(BUTTONS.WIDTH, resizeImage),
          createToggleButton(BUTTONS.HEIGHT, resizeImage),
          createToggleButton(BUTTONS.FULL, resizeImage),
          createToggleButton(BUTTONS.DOWNLOAD, downloadImage),
          createToggleButton(BUTTONS.REMOVE, removeImage)
        );
        parentDiv.insertBefore(newDiv, div);
      });
    }

    imageActions.setHeight();

    elements.postActions = document.querySelector('.post__actions');
    elements.postActions.append(
      createToggleButton(BUTTONS.WIDTH, () => resizeAllImages(BUTTONS.WIDTH)),
      createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages(BUTTONS.HEIGHT)),
      createToggleButton(BUTTONS.FULL, () => resizeAllImages(BUTTONS.FULL)),
      containerStatus
    );

    loadImages();
  };

  init();
})();
