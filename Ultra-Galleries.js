// ==UserScript==
// @name         Ultra Kemono Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.0.6
// @description  Load original resolution, toggle fitted zoom views, remove photos, batch download images and videos, and view images in a modern, scalable gallery with new features.
// @author       ntf (original), Meri (updates)
// @match        *://kemono.su/*/user/*/post/*
// @match        *://coomer.su/*/user/*/post/*
// @icon         https://kemono.party/static/menu/recent.svg
// @grant        GM_download
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
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
    WIDTH: '【FILL WIDTH】',
    GALLERY: '【GALLERY】'
  };
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 1250;

  // State
  const state = {
    imageCount: 0,
    downloadedCount: 0,
    totalImages: 0,
    imagesLoaded: false
  };

  // DOM Elements
  const elements = {
    statusElement: null,
    postActions: null,
    galleryButton: null
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
    const { imageCount, totalImages } = state;
    const status = imageCount === totalImages
      ? `Images Done Loading! Total: ${totalImages}`
      : `Loading images (${imageCount}/${totalImages})...`;
    updateStatus(status);

    if (imageCount === totalImages) {
      state.imagesLoaded = true;
      enableGalleryButton();
    }
  };

  const updateDownloadStatus = () => {
    const { downloadedCount, totalImages } = state;
    const status = downloadedCount === totalImages
      ? 'Done Downloading!'
      : 'Downloading...';
    updateStatus(status);
  };

  const enableGalleryButton = () => {
    if (elements.galleryButton) {
      elements.galleryButton.textContent = 'Click for Gallery';
      elements.galleryButton.disabled = false;
      elements.galleryButton.style.opacity = '1';
      elements.galleryButton.style.cursor = 'pointer';
      elements.galleryButton.addEventListener('click', showGallery);
    }
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
    height: (img) => setImageStyle(img, { maxHeight: '100vh', maxWidth: '100%', width: 'auto' }),
    width: (img) => setImageStyle(img, { maxHeight: '100%', maxWidth: '100vw', height: 'auto' }),
    full: (img) => setImageStyle(img, { maxHeight: 'none', maxWidth: 'none', height: 'auto', width: 'auto' })
  };

  const removeImage = (evt) => {
    const buttonContainer = evt.currentTarget.closest('div');
    const imageContainer = buttonContainer?.nextElementSibling;
    if (imageContainer) {
      imageContainer.remove();
      buttonContainer.remove();
    } else {
      console.error('Could not find image container to remove');
    }
  };

  const resizeImage = (evt) => {
    const action = Object.keys(BUTTONS).find(key => BUTTONS[key] === evt.currentTarget.textContent)?.toLowerCase();
    const imgContainer = evt.currentTarget.closest('.gallery-item') || evt.currentTarget.closest('.expanded-view') || evt.currentTarget.closest('.post__files');
    const img = imgContainer?.querySelector('img');

    if (img && imageActions[action]) {
      imageActions[action](img);
    } else {
      console.error('Image element or action not found for resize:', imgContainer, action);
    }
  };

  const resizeAllImages = (action) => {
    document.querySelectorAll('.post__image').forEach(img => imageActions[action](img));
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

    const container = evt.target.closest('.post__files');
    const img = container?.querySelector('.post__image');
    const imgSrc = img?.getAttribute('src');

    if (!imgSrc) {
      console.error('Could not find image source to download');
      return;
    }

    try {
      const url = new URL(imgSrc, document.baseURI);
      const fileName = url.pathname.split('/').pop();
      const [baseFileName, fileExtension] = fileName.split('.');

      const title = document.querySelector('.post__title')?.textContent?.trim() ?? 'Untitled';
      const artistName = document.querySelector('.post__user-name')?.textContent?.trim() ?? 'Unknown';

      const downloadLink = container?.querySelector('.fileThumb');
      const imgName = downloadLink?.getAttribute('download') || `${artistName}-${baseFileName}.${fileExtension}`;

      // Firefox fix: Use GM.download instead of GM_download
      if (typeof GM_download === 'undefined' && typeof GM.download === 'function') {
        GM.download({
          url: imgSrc,
          name: imgName,
          onload: () => console.log('Image downloaded successfully:', imgName),
          onerror: (error) => console.error('Failed to download image:', imgName, error),
          headers: { referer: 'https://kemono.su/' } // Add referer header for Firefox
        });
      } else {
        GM_download({
          url: imgSrc,
          name: imgName,
          onload: () => console.log('Image downloaded successfully:', imgName),
          onerror: (error) => console.error('Failed to download image:', imgName, error)
        });
      }
    } catch (error) {
      console.error('Error processing image source:', imgSrc, error);
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

    let downloadPromises = [
      ...Array.from(images).map((img) => {
        let imgSrc = img.getAttribute('src').split('?')[0];
        const fileName = imgSrc.split('/').pop();
        const [baseFileName, fileExtension] = fileName.split('.'); // Fixed: fileExtension was not defined
        const imgName = `${artistName}-${sanitizeFileName(title)}-${baseFileName}.${fileExtension}`;
        return addToZipWithRetry(zip, imgSrc, imgName, 'image');
      }),
      ...Array.from(attachmentLinks).map((link) => {
        const videoSrc = link.getAttribute('href');
        const videoName = link.textContent.trim().replace('Download ', '');
        return addToZipWithRetry(zip, videoSrc, videoName, 'Attachment');
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

  // Force image load (for rate limiting)
  const forceLoadImage = (imgSrc) => {
    fetch(imgSrc, { method: 'HEAD' })
      .then((response) => {
        if (response.status === 200) {
          console.log('Force loaded image:', imgSrc);
          state.imageCount++;
          updateImageLoadingStatus();
        } else {
          console.error('Failed to force load image:', imgSrc, response.status);
        }
      })
      .catch((error) => {
        console.error('Failed to force load image:', imgSrc, error);
      })
      .finally(() => updateImageLoadingStatus());
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

      if (response.status === 200) {
        console.log('Image loaded successfully:', imgSrc);
        img.src = imgSrc;
      } else if (response.status === 429) {
        console.warn('Image rate limited:', imgSrc);
        throw new Error(`Image rate limited: ${imgSrc}`);
      } else {
        console.error('Failed to load image:', imgSrc, 'Status:', response.status);
        throw new Error(`Failed to load image: ${imgSrc}, Status: ${response.status}`);
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying image load: ${imgSrc} in ${delay / 1000} seconds (Attempt ${retryCount + 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await loadImageWithRetry(img, imgSrc, retryCount + 1);
      } else {
        console.error('Failed to load image after all retries:', imgSrc, error);
        forceLoadImage(imgSrc); // Try force loading after retries fail
      }
    } finally {
      state.imageCount++;
      updateImageLoadingStatus();
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
      } catch (error) {
        console.error('Failed to load image:', imgSrc, error);
      }
    }

    console.log('All images loaded');
  };

  // Gallery functions
  const createGalleryOverlay = () => {
    const overlay = document.createElement('div');
    overlay.id = 'gallery-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    const galleryContainer = document.createElement('div');
    galleryContainer.style.cssText = `
      width: 95%;
      height: 95%;
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      display: flex;
      flex-direction: column;
      position: relative;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 24px;
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      z-index: 10;
    `;
    closeButton.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    const galleryContent = document.createElement('div');
    galleryContent.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      grid-gap: 10px;
      padding: 20px;
      overflow-y: auto;
    `;

    const expandedView = document.createElement('div');
    expandedView.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.9);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 11;
    `;

    const expandedImage = document.createElement('img');
    expandedImage.style.cssText = `
      max-width: 90vw;
      max-height: 80vh;
      object-fit: contain;
    `;

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 100px;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: rgba(0, 0, 0, 0.5);
      overflow-x: auto;
      padding: 10px;
    `;

    expandedView.appendChild(expandedImage);
    expandedView.appendChild(thumbnailContainer);
    galleryContainer.appendChild(closeButton);
    galleryContainer.appendChild(galleryContent);
    galleryContainer.appendChild(expandedView);
    overlay.appendChild(galleryContainer);

    return overlay;
  };

  const createNavigationButton = (direction) => {
    const button = document.createElement('button');
    button.textContent = direction === 'prev' ? '←' : '→';
    button.style.cssText = `
      position: absolute;
      top: 50%;
      ${direction === 'prev' ? 'left' : 'right'}: 10px;
      transform: translateY(-50%);
      font-size: 24px;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.3s ease;
      z-index: 12;
    `;
    button.addEventListener('mouseover', () => {
      button.style.opacity = '1';
    });
    button.addEventListener('mouseout', () => {
      button.style.opacity = '0.7';
    });
    return button;
  };

  const createLoadingOverlay = () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 12;
    `;
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading...';
    loadingText.style.color = 'white';
    overlay.appendChild(loadingText);
    return overlay;
  };

  const showGallery = () => {
    const overlay = createGalleryOverlay();
    const galleryContent = overlay.querySelector('#gallery-overlay > div > div:first-of-type');
    const expandedView = overlay.querySelector('#gallery-overlay > div > div:last-of-type');
    const expandedImage = expandedView?.querySelector('img');
    const thumbnailContainer = expandedView?.querySelector('div');
    const images = Array.from(document.querySelectorAll('.post__image'));

    let currentIndex = 0;

    const pageNumber = document.createElement('div');
    pageNumber.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-size: 16px;
    `;
    expandedView.appendChild(pageNumber);

    const showExpandedImage = (index) => {
      if (expandedImage && expandedView) {
        const loadingOverlay = createLoadingOverlay();
        expandedView.appendChild(loadingOverlay);

        expandedImage.onload = () => {
          expandedView.removeChild(loadingOverlay);
          expandedView.style.display = 'flex';
        };

        expandedImage.onerror = () => {
          expandedView.removeChild(loadingOverlay);
          // Handle error, maybe show an error message
        };

        expandedImage.src = images[index].src;
        currentIndex = index;
        pageNumber.textContent = `${index + 1} / ${images.length}`;

        // Update thumbnail selection
        thumbnailContainer?.querySelectorAll('.thumbnail').forEach((thumb, i) => {
          thumb.style.opacity = i === index ? '1' : '0.5';
        });
      } else {
        console.error("Unable to show expanded image. Missing elements:", { expandedImage, expandedView });
      }
    };

    const hideExpandedImage = () => {
      expandedView.style.display = 'none';
    };

    images.forEach((img, index) => {
      const thumbnail = document.createElement('img');
      thumbnail.src = img.src;
      thumbnail.className = 'thumbnail';
      thumbnail.style.cssText = `
        width: 100%;
        height: 200px;
        object-fit: cover;
        cursor: pointer;
        transition: transform 0.3s ease;
      `;
      thumbnail.addEventListener('click', () => showExpandedImage(index));
      thumbnail.addEventListener('mouseover', () => thumbnail.style.transform = 'scale(1.05)');
      thumbnail.addEventListener('mouseout', () => thumbnail.style.transform = 'scale(1)');

      galleryContent.appendChild(thumbnail);

      // Create thumbnails for the expanded view
      const expandedThumbnail = thumbnail.cloneNode(true);
      expandedThumbnail.style.cssText = `
        width: 60px;
        height: 60px;
        object-fit: cover;
        margin: 0 5px;
        cursor: pointer;
        opacity: 0.5;
        transition: opacity 0.3s ease;
        /* Fix for scaling issue: Add vertical-align */
        vertical-align: top;
      `;
      expandedThumbnail.addEventListener('click', () => showExpandedImage(index));
      thumbnailContainer.appendChild(expandedThumbnail);
    });

    const prevButton = createNavigationButton('prev');
    const nextButton = createNavigationButton('next');

    prevButton.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      showExpandedImage(currentIndex);
    });

    nextButton.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % images.length;
      showExpandedImage(currentIndex);
    });

    expandedView.appendChild(prevButton);
    expandedView.appendChild(nextButton);

    // Close expanded view when clicking outside the image
    expandedView.addEventListener('click', (e) => {
      if (e.target === expandedView) {
        hideExpandedImage();
      }
    });

    document.body.appendChild(overlay);
  };

  const init = () => {
    document.querySelectorAll('a.fileThumb.image-link img').forEach((img) => (img.className = 'post__image'));

    document.querySelectorAll('.post__attachment-link').forEach((link) => {
      link.dataset.fileName = link.getAttribute('download');
    });

    const containerStatus = document.createElement('div');
    containerStatus.style.cssText = `
      display: inline-flex;
    `;

    const downloadAllButton = createToggleButton(BUTTONS.DOWNLOAD_ALL, downloadAllImagesAndVideos);
    elements.statusElement = document.createElement('span');
    elements.statusElement.id = 'Status';
    elements.statusElement.textContent = '';
    elements.statusElement.style.marginLeft = '10px';

    containerStatus.append(downloadAllButton, elements.statusElement);

    elements.postActions = document.querySelector('.post__actions');
    elements.galleryButton = createToggleButton(BUTTONS.GALLERY, null);
    elements.galleryButton.disabled = true;
    elements.galleryButton.style.opacity = '0.6';
    elements.galleryButton.style.cursor = 'not-allowed';

    elements.postActions.append(
      createToggleButton(BUTTONS.WIDTH, () => resizeAllImages('width')),
      createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages('height')),
      createToggleButton(BUTTONS.FULL, () => resizeAllImages('full')),
      containerStatus,
      elements.galleryButton
    );


    const fileDivs = document.querySelectorAll('.post__thumbnail');
    const parentDiv = fileDivs[0]?.parentNode;

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

    loadImages();
  };

  init();
})();
