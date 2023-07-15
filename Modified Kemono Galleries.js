// ==UserScript==
// @name         Ultra Kemono Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      1.6.7
// @description  Load original resolution, toggle fitted zoom views, remove photos, and batch download images and videos. Can't do cross-origin downloads with JS alone.
// @author       Meri
// @match        *://kemono.party/*/user/*/post/*
// @match        *://kemono.su/*/user/*/post/*
// @match        *://coomer.party/*/user/*/post/*
// @match        *://coomer.su/*/user/*/post/*
// @icon         https://kemono.party/static/menu/recent.svg
// @grant        GM_download
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @license      Unlicense
// @source       https://sleazyfork.org/en/scripts/460064-better-kemono-galleries
// @source       https://sleazyfork.org/en/scripts/469063-%E8%BC%89%E5%85%A5kemono-party%E8%88%87coomer-party%E5%8E%9F%E5%A7%8B%E5%9C%96%E6%AA%94
// ==/UserScript==

// Define constants for button labels
const DL = '【DOWNLOAD】';
const DLALL = '【DL ALL】';
const FULL = '【FULL】';
const HEIGHT = '【FILL HEIGHT】';
const RM = '【REMOVE】';
const WIDTH = '【FILL WIDTH】';

// Define variables for counts
let imageCount = 0;
let downloadedCount = 0;
let totalImages = 0;
let imageStatusUpdated = false; // Track whether the image status has been updated

function Height() {
  document.querySelectorAll('.post__image').forEach((img) => height(img));
}

function height(img) {
  img.style.maxHeight = '100vh';
  img.style.maxWidth = '100%';
}

function Width() {
  document.querySelectorAll('.post__image').forEach((img) => width(img));
}

function width(img) {
  img.style.maxHeight = '100%';
  img.style.maxWidth = '100vw';
}

function Full() {
  document.querySelectorAll('.post__image').forEach((img) => full(img));
}

function full(img) {
  img.style.maxHeight = 'none';
  img.style.maxWidth = 'none';
}

function newToggle(name, action) {
  const toggle = document.createElement('a');
  toggle.text = name;
  toggle.addEventListener('click', action);
  toggle.style.cursor = 'pointer';
  return toggle;
}

function resizer(evt) {
  const name = evt.currentTarget.text;
  const img = evt.currentTarget.parentNode.nextSibling.lastElementChild;
  if (name === WIDTH) width(img);
  else if (name === HEIGHT) height(img);
  else if (name === FULL) full(img);
}

function removeImg(evt) {
  evt.currentTarget.parentNode.nextSibling.remove();
  evt.currentTarget.parentNode.remove();
}

function downloadImg(evt) {
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
      },
      onerror: function (error) {
        console.error('Failed to download image:', imgName, error);
      },
    });
  }
}

function DownloadAllImagesAndVideos() {
  const images = document.querySelectorAll('.post__image');
  const titleElement = document.querySelector('.post__title');
  const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
  const artistName = document.querySelector('.post__user-name').textContent.trim();

  let total = totalImages; // Use the totalImages variable instead of images.length
  downloadedCount = 0; // Reset the downloaded count

  // Update the status to show "Downloading images"
  const Status = document.getElementById('Status');
  if (Status) {
    Status.textContent = `Downloading images (${downloadedCount}/${total})...`;
  }

  // Download images and GIFs
  images.forEach((img, index) => {
    const imgSrc = img.getAttribute('src');
    const extension = imgSrc.split('.').pop(); // Get the file extension
    let imgName;
    if (extension.toLowerCase() === 'gif') {
      imgName = `${artistName}-${title}_${index}.gif`.replace(/[\\/:*?"<>|]/g, '-');
    } else {
      imgName = `${artistName}-${title}_${index}.png`.replace(/[\\/:*?"<>|]/g, '-');
    }

    GM_download({
      url: imgSrc,
      name: imgName,
      onload: function () {
        console.log('Image downloaded successfully:', imgName);
        downloadedCount++; // Increment downloaded count
        updateStatusDownload(); // Update status after each download
        if (downloadedCount === total) {
          updateStatusDownload();
        }
      },
      onerror: function (error) {
        console.error('Failed to download image:', imgName, error);
        downloadedCount++; // Increment downloaded count even on error
        updateStatusDownload(); // Update status after each download
        if (downloadedCount === total) {
          updateStatusDownload();
        }
      },
    });
  });

  // Download videos
  const attachmentLinks = document.querySelectorAll('.post__attachment-link');
  total += attachmentLinks.length;

  attachmentLinks.forEach((link) => {
    const videoSrc = link.getAttribute('href');
    const videoName = link.dataset.fileName.replace(/[\\/:*?"<>|]/g, '-');

    GM_download({
      url: videoSrc,
      name: videoName,
      onload: function () {
        console.log('Video downloaded successfully:', videoName);
        downloadedCount++; // Increment downloaded count
        updateStatusDownload(); // Update status after each download
        if (downloadedCount === total) {
          updateStatusDownload();
        }
      },
      onerror: function (error) {
        console.error('Failed to download video:', videoName, error);
        downloadedCount++; // Increment downloaded count even on error
        updateStatusDownload(); // Update status after each download
        if (downloadedCount === total) {
          updateStatusDownload();
        }
      },
    });
  });
}

function updateStatusImage() {
  const Status = document.getElementById('Status');
  if (Status) {
    if (imageCount === totalImages || imageStatusUpdated === true) {
      Status.textContent = `Images Done Loading! Total: ${totalImages}`;
      if (!imageStatusUpdated){
        imageStatusUpdated = false;
      }
    } else {
      Status.textContent = `Loading images (${imageCount}/${totalImages})...`;
      if (imageCount === totalImages) {
        imageStatusUpdated = true;
      }
    }
    
  }
}

function updateStatusDownload() {
  const Status = document.getElementById('Status');
  if (Status) {
    if (downloadedCount === totalImages) {
      Status.textContent = `Done Downloading! Total: ${totalImages}`;
    } else {
      Status.textContent = `Downloading images (${downloadedCount}/${totalImages})...`;
    }
  }
}

function loadImage(img, retryCount) {
  const imgSrc = img.getAttribute('src');
  GM_xmlhttpRequest({
    method: 'HEAD',
    url: imgSrc,
    onload: function (response) {
      const status = response.status;
      if (status === 200) {
        console.log('Image loaded successfully:', imgSrc);
        imageCount++; // Increment image count on successful load
      } else if (status === 429) {
        console.warn('Image rate limited:', imgSrc);
        retryLoadImage(img, retryCount + 1);
      } else {
        console.error('Failed to load image:', imgSrc, 'Status:', status);
      }
      updateStatusImage(); // Update status after each image load
    },
    onerror: function (error) {
      console.error('Failed to load image:', imgSrc, error);
      updateStatusImage(); // Update status even if there's an error
    },
  });
}

function retryLoadImage(img, retryCount) {
  const maxRetries = 10;
  if (retryCount <= maxRetries) {
    console.log(`Retrying image load: ${img.getAttribute('src')} (Attempt ${retryCount})`);
    setTimeout(function () {
      loadImage(img, retryCount);
    }, 50);
  } else {
    console.error(`Max retries exceeded for image: ${img.getAttribute('src')}`);
    showRetryOption(img);
    updateStatusImage(); // Update status even if max retries exceeded
  }
}

function loadImages() {
  const images = document.querySelectorAll('.post__image');
  totalImages = images.length; // Update the total number of images

  images.forEach((img) => {
    loadImage(img, 1);
  });

  downloadedCount = totalImages; // Set downloaded count to total images initially
}

(function () {
  'use strict';

  document.querySelectorAll('a.fileThumb.image-link img').forEach((img) => (img.className = 'post__image'));

  // Match each picture card with its corresponding spot on the board
  const A = document.querySelectorAll('a.fileThumb.image-link');
  const IMG = document.querySelectorAll('.post__image');

  // Loop through each picture card to load the full image
  for (let i = 0; i < A.length; i++) {
    setTimeout(function (index) {
      IMG[index].setAttribute('src', A[index].getAttribute('href'));
      IMG[index].test = index;
      A[index].outerHTML = A[index].innerHTML;
    }, i * 300, i);
  }

  // Extract video attachment information
  const attachmentLinks = document.querySelectorAll('.post__attachment-link');
  attachmentLinks.forEach((link) => {
    const fileName = link.getAttribute('download');
    link.dataset.fileName = fileName;
  });

  const DIV = document.querySelectorAll('.post__thumbnail');
  const parentDiv = DIV[0]?.parentNode;

  const ContainerStatus = document.createElement('div');
  ContainerStatus.style.display = 'inline-flex';

  const downloadAllButton = newToggle(DLALL, DownloadAllImagesAndVideos);
  const Status = document.createElement('span');
  Status.id = 'Status';
  Status.textContent = '';

  ContainerStatus.append(downloadAllButton, Status);

  if (parentDiv) {
    for (let i = 0; i < DIV.length; i++) {
      const newDiv = document.createElement('div');
      newDiv.append(newToggle(WIDTH, resizer), newToggle(HEIGHT, resizer), newToggle(FULL, resizer), newToggle(DL, downloadImg), newToggle(RM, removeImg));
      parentDiv.insertBefore(newDiv, DIV[i]);
    }
  }

  Height();
  loadImages();

  const postActions = document.querySelector('.post__actions');
  postActions.append(newToggle(WIDTH, Width), newToggle(HEIGHT, Height), newToggle(FULL, Full));
  postActions.append(ContainerStatus);
})();
