// ==UserScript==
// @name         Ultra Kemono Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      1.9
// @description  Load original resolution, toggle fitted zoom views, remove photos, and batch download images and videos. Can't do cross-origin downloads with JS alone.
// @author       Meri
// @match        *://kemono.party/*/user/*/post/*
// @match        *://kemono.su/*/user/*/post/*
// @match        *://coomer.party/*/user/*/post/*
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
  const DL = '【DOWNLOAD】';
  const DLALL = '【DL ALL】';
  const FULL = '【FULL】';
  const HEIGHT = '【FILL HEIGHT】';
  const RM = '【REMOVE】';
  const WIDTH = '【FILL WIDTH】';
  const MAX_RETRIES = 10;

  // Variables
  let imageCount = 0;
  let downloadedCount = 0;
  let totalImages = 0;
  let imageStatusUpdated = false;

  // Helper functions
  function createToggleButton(name, action) {
    const toggle = document.createElement('a');
    toggle.textContent = name;
    toggle.addEventListener('click', action);
    toggle.style.cursor = 'pointer';
    return toggle;
  }

  function updateStatus(text) {
    const statusElement = document.getElementById('Status');
    if (statusElement) {
      statusElement.textContent = text;
    }
  }

  function updateImageLoadingStatus() {
    const imageLoadingStatus = imageCount === totalImages || imageStatusUpdated === true
      ? `Images Done Loading! Total: ${totalImages}`
      : `Loading images (${imageCount}/${totalImages})...`;

    updateStatus(imageLoadingStatus);
  }

  function updateDownloadStatus() {
    const downloadStatus = downloadedCount === totalImages
      ? `Downloading...`
      : `Done Downloading!`;

    updateStatus(downloadStatus);
  }

  // Image manipulation functions
  function setImageHeight(img) {
    if (img) {
      img.style.maxHeight = '100vh';
      img.style.maxWidth = '100%';
    }
  }
  
  function setImageWidth(img) {
    if (img) {
      img.style.maxHeight = '100%';
      img.style.maxWidth = '100vw';
    }
  }
  
  function setFullSize(img) {
    if (img) {
      img.style.maxHeight = 'none';
      img.style.maxWidth = 'none';
    }
  }

  function resizeImage(evt) {
    const name = evt.currentTarget.textContent;
    const img = evt.currentTarget.parentNode.nextSibling.lastElementChild;
    if (img) {
      if (name === WIDTH) setImageWidth(img);
      else if (name === HEIGHT) setImageHeight(img);
      else if (name === FULL) setFullSize(img);
    }
}

  function removeImage(evt) {
    evt.currentTarget.parentNode.nextSibling.remove();
    evt.currentTarget.parentNode.remove();
  }

  // Zip archive creation
  function addImageToZip(zip, imgSrc, fileName, retryCount = 0) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url: imgSrc,
        responseType: 'blob',
        headers: { referer: 'https://kemono.party/' },
        onload: function (response) {
          if (response.status === 200) {
            zip.file(fileName, response.response);
            downloadedCount++;
            resolve();
          } else {
            reject(new Error(`Failed to download image: ${imgSrc}`));
          }
        },
        onerror: function (error) {
          if (retryCount < MAX_RETRIES) {
            console.warn(`Failed to download image: ${imgSrc}, retrying... (Attempt ${retryCount + 1})`);
            setTimeout(function () {
              addImageToZip(zip, imgSrc, fileName, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, 1250);
          } else {
            reject(error);
          }
        },
      });
    });
  }

  function addVideoToZip(zip, videoSrc, fileName) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url: videoSrc,
        responseType: 'blob',
        headers: { referer: 'https://kemono.party/' },
        onload: function (response) {
          if (response.status === 200) {
            zip.file(fileName, response.response);
            resolve();
          } else {
            reject(new Error(`Failed to download video: ${videoSrc}`));
          }
        },
        onerror: function (error) {
          reject(error);
        },
      });
    });
  }

  function downloadImage(evt) {
    evt.preventDefault();
    const img = evt.currentTarget.parentNode.nextSibling?.lastElementChild;
    if (img) {
      const imgSrc = img.getAttribute('src');
      const titleElement = document.querySelector('.post__title');
      const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
      const artistName = document.querySelector('.post__user-name').textContent.trim();
      const imgName = `${artistName}-${title}.png`.replace(/[\\/:*?"<>|]/g, '-');

      GM_download({
        url: imgSrc,
        name: imgName,
        onload: function () {
          console.log('Image downloaded successfully:', imgName);
          downloadedCount++;
          updateDownloadStatus();
        },
        onerror: function (error) {
          console.error('Failed to download image:', imgName, error);
        },
      });
    }
  }

  function downloadAllImagesAndVideos() {
    const images = document.querySelectorAll('.post__image');
    const attachmentLinks = document.querySelectorAll('.post__attachment-link');
    const titleElement = document.querySelector('.post__title');
    const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
    const artistName = document.querySelector('.post__user-name').textContent.trim();

    const total = images.length + attachmentLinks.length;
    let downloadedCount = 0;

    const zip = new JSZip();

    const imagePromises = Array.from(images).map((img, index) => {
      const imgSrc = img.getAttribute('src');
      const extension = imgSrc.split('.').pop();
      const imgName = `${artistName}-${title}-${index}.${extension}`.replace(/[\\/:*?"<>|]/g, '-');
      return addImageToZip(zip, imgSrc, imgName);
    });

    const videoPromises = Array.from(attachmentLinks).map((link) => {
      const videoSrc = link.getAttribute('href');
      const videoName = link.dataset.fileName.replace(/[\\/:*?"<>|]/g, '-');
      return addVideoToZip(zip, videoSrc, videoName);
    });

    Promise.all([...imagePromises, ...videoPromises])
      .then(() => {
        zip.generateAsync({ type: 'blob' })
          .then((content) => {
            const zipFileName = `${artistName}-${title}.zip`.replace(/[\\/:*?"<>|]/g, '-');
            saveAs(content, zipFileName);
          })
          .finally(() => {
            updateStatus(`Done Downloading and adding to a zip! Total: ${total}`);
          });
      })
      .catch((error) => {
        console.error(error);
        updateStatus(`Failed to download and add to zip.`);
      });
  }

  // Force image load
  function forceLoadImage(imgSrc, status) {
    if (status === 429) {
      fetch(imgSrc, { method: 'HEAD' })
        .then((response) => {
          if (response.status === 200) {
            console.log('Force loaded image:', imgSrc);
            imageCount++;
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
  }

  function loadImageWithRetriesAndReplace(img, a, retryCount) {
    const imgSrc = a.getAttribute('href');

    GM_xmlhttpRequest({
      method: 'HEAD',
      url: imgSrc,
      onload: function (response) {
        const status = response.status;
        if (status === 200) {
          console.log('Image loaded successfully:', imgSrc);
          img.setAttribute('src', imgSrc);
          img.test = a.test;
          a.outerHTML = a.innerHTML;
          imageCount++;
          updateImageLoadingStatus();
        } else if (status === 429) {
          console.warn('Image rate limited:', imgSrc);
          if (retryCount <= MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`Retrying image load: ${img.getAttribute('src')} in ${delay / 1000} seconds (Attempt ${retryCount + 1})`);
            setTimeout(function () {
              loadImageWithRetriesAndReplace(img, a, retryCount + 1);
            }, delay);
          } else {
            console.error(`Max retries exceeded for image: ${img.getAttribute('src')}`);
            showRetryOption(a); // Implement this function
            updateStatus(`Image loading failed: ${img.getAttribute('src')}`);
          }
        } else {
          console.error('Failed to load image:', imgSrc, 'Status:', status);
          updateImageLoadingStatus();
          forceLoadImage(imgSrc, status);
        }
      },
      onerror: function (error) {
        console.error('Failed to load image:', imgSrc, error);
        updateImageLoadingStatus();
        forceLoadImage(imgSrc);
      },
    });
  }

  function loadImages() {
    const A = document.querySelectorAll('a.fileThumb.image-link');
    const IMG = document.querySelectorAll('.post__image');

    totalImages = A.length;

    const loadImagePromises = Array.from(A).map((a, index) => {
      return new Promise((resolve, reject) => {
        const img = IMG[index];
        const imgSrc = a.getAttribute('href');

        let retryCount = 0;

        function loadImageWithRetry() {
          GM_xmlhttpRequest({
            method: 'HEAD',
            url: imgSrc,
            onload: function (response) {
              const status = response.status;
              if (status === 200) {
                console.log('Image loaded successfully:', imgSrc);
                img.setAttribute('src', imgSrc);
                img.test = a.test;
                a.outerHTML = a.innerHTML;
                imageCount++;
                updateImageLoadingStatus();
                resolve();
              } else if (status === 429) {
                console.warn('Image rate limited:', imgSrc);
                if (retryCount <= MAX_RETRIES) {
                  const delay = Math.pow(2, retryCount) * 1000;
                  console.log(`Retrying image load: ${imgSrc} in ${delay / 1000} seconds (Attempt ${retryCount + 1})`);
                  retryCount++;
                  setTimeout(loadImageWithRetry, delay);
                } else {
                  console.error(`Max retries exceeded for image: ${imgSrc}`);
                  showRetryOption(a); // Implement this function
                  updateStatus(`Image loading failed: ${imgSrc}`);
                  reject(new Error(`Max retries exceeded for image: ${imgSrc}`));
                }
              } else {
                console.error('Failed to load image:', imgSrc, 'Status:', status);
                updateImageLoadingStatus();
                forceLoadImage(imgSrc, status);
                reject(new Error(`Failed to load image: ${imgSrc}, Status: ${status}`));
              }
            },
            onerror: function (error) {
              console.error('Failed to load image:', imgSrc, error);
              updateImageLoadingStatus();
              forceLoadImage(imgSrc);
              reject(error);
            },
          });
        }

        loadImageWithRetry();
      });
    });

    Promise.all(loadImagePromises)
      .then(() => {
        console.log('All images loaded successfully');
      })
      .catch((error) => {
        console.error('Error loading images:', error);
      });
  }

  // Main script execution
  document.querySelectorAll('a.fileThumb.image-link img').forEach((img) => (img.className = 'post__image'));

  const attachmentLinks = document.querySelectorAll('.post__attachment-link');
  attachmentLinks.forEach((link) => {
    const fileName = link.getAttribute('download');
    link.dataset.fileName = fileName;
  });

  const DIV = document.querySelectorAll('.post__thumbnail');
  const parentDiv = DIV[0]?.parentNode;

  const ContainerStatus = document.createElement('div');
  ContainerStatus.style.display = 'inline-flex';

  const downloadAllButton = createToggleButton(DLALL, downloadAllImagesAndVideos);
  const statusElement = document.createElement('span');
  statusElement.id = 'Status';
  statusElement.textContent = '';

  ContainerStatus.append(downloadAllButton, statusElement);

  if (parentDiv) {
    for (let i = 0; i < DIV.length; i++) {
      const newDiv = document.createElement('div');
      newDiv.append(
        createToggleButton(WIDTH, resizeImage),
        createToggleButton(HEIGHT, resizeImage),
        createToggleButton(FULL, resizeImage),
        createToggleButton(DL, downloadImage),
        createToggleButton(RM, removeImage)
      );
      parentDiv.insertBefore(newDiv, DIV[i]);
    }
  }

  setImageHeight();

  const postActions = document.querySelector('.post__actions');
  postActions.append(
    createToggleButton(WIDTH, setImageWidth),
    createToggleButton(HEIGHT, setImageHeight),
    createToggleButton(FULL, setFullSize)
  );
  postActions.append(ContainerStatus);

  loadImages();
})();