// ==UserScript==
// @name         Ultra Kemono Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      1.6.4
// @description  Load original resolution, toggle fitted zoom views, remove photos, and batch download images and videos. Can't do cross-origin downloads with JS alone.
// @author       ntf
// MODIFIED BY MERI
// @match        *://kemono.party/*/user/*/post/*
// @match        *://kemono.su/*/user/*/post/*
// @match        *://coomer.party/*/user/*/post/*
// @match        *://coomer.su/*/user/*/post/*
// @icon         https://kemono.party/static/menu/recent.svg
// @grant        GM_download
// @grant        GM_info
// @license      Unlicense
// ==/UserScript==


// Define constants for button labels
const DL = '【DOWNLOAD】';
const DLALL = '【DL ALL】';
const FULL = '【FULL】';
const HEIGHT = '【FILL HEIGHT】';
const RM = '【REMOVE】';
const WIDTH = '【FILL WIDTH】';

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
        // Retry downloading the image
        retryDownload(imgSrc, imgName);
      },
    });
  }
}

function retryDownload(url, name) {
  let retryCount = 0;
  const maxRetries = 3;

  const retry = () => {
    retryCount++;
    console.log(`Retrying download: ${name} (Attempt ${retryCount})`);

    GM_download({
      url: url,
      name: name,
      onload: function (details) {
        if (details.totalBytes && details.totalBytes > 1024) {
          console.log('Image downloaded successfully:', name);
        } else {
          console.error(`Image size is too small: ${name}`);
        }
      },
      onerror: function (error) {
        console.error('Failed to download image:', name, error);
        if (retryCount < maxRetries) {
          retry();
        } else {
          console.error(`Max retries exceeded for image: ${name}`);
        }
      },
    });
  };

  retry();
}


function DownloadAllImagesAndVideos() {
  const images = document.querySelectorAll('.post__image');
  const titleElement = document.querySelector('.post__title');
  const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
  const artistName = document.querySelector('.post__user-name').textContent.trim();

  let total = images.length; // Start with the number of images
  let count = 0;

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
        updateDownloadStatus(++count, total);

        if (count === total) {
          setDownloadComplete();
        }
      },
      onerror: function (error) {
        console.error('Failed to download image:', imgName, error);
        updateDownloadStatus(++count, total);

        if (count === total) {
          setDownloadComplete();
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
        updateDownloadStatus(++count, total);

        if (count === total) {
          setDownloadComplete();
        }
      },
      onerror: function (error) {
        console.error('Failed to download video:', videoName, error);
        updateDownloadStatus(++count, total);

        if (count === total) {
          setDownloadComplete();
        }
      },
    });
  });
}


let refreshInterval;

function refreshImages() {
  const images = document.querySelectorAll('.post__image');
  const totalImages = images.length;
  let loadedImages = 0;

  const checkImageLoadStatus = () => {
    loadedImages++;
    updateDownloadStatus(loadedImages, totalImages);

    if (loadedImages === totalImages) {
      clearInterval(refreshInterval);
    }
  };

  images.forEach((img) => {
    if (img.complete) {
      checkImageLoadStatus();
    } else {
      img.addEventListener('load', checkImageLoadStatus);
      img.addEventListener('error', checkImageLoadStatus);
    }
  });

  const gifs = document.querySelectorAll('.post__image[src$=".gif"]');
  const totalGifs = gifs.length;
  let loadedGifs = 0;

  const checkGifLoadStatus = () => {
    loadedGifs++;
    updateDownloadStatus(loadedImages + loadedGifs, totalImages + totalGifs);

    if (loadedGifs === totalGifs) {
      clearInterval(refreshInterval);
    }
  };

  gifs.forEach((gif) => {
    if (gif.complete) {
      checkGifLoadStatus();
    } else {
      gif.addEventListener('load', checkGifLoadStatus);
      gif.addEventListener('error', checkGifLoadStatus);
    }
  });
}

function updateDownloadStatus(count, total) {
  const downloadStatus = document.getElementById('downloadStatus');
  if (downloadStatus) {
    if (count === 0) {
      downloadStatus.textContent = 'Waiting for images to load';
    } else if (count === total) {
      downloadStatus.textContent = `Download Ready!`;
    } else {
      downloadStatus.textContent = `Downloading: ${count} / ${total}`;
    }
  }
}

function setDownloadComplete() {
  const downloadStatus = document.getElementById('downloadStatus');
  if (downloadStatus) {
    downloadStatus.textContent = 'Download Complete';
  }
}

(function () {
  'use strict';

  document.querySelectorAll('a.fileThumb.image-link img').forEach((img) => (img.className = 'post__image'));

  // Match each picture card with its corresponding spot on the board
  const A = document.querySelectorAll('a.fileThumb.image-link');
  const IMG = document.querySelectorAll('.post__image');

  // Loop through each picture card
  for (let i = 0; i < A.length; i++) {
    IMG[i].setAttribute('src', A[i].getAttribute('href'));
    IMG[i].test = i;
    A[i].outerHTML = A[i].innerHTML;
  }

  // Extract video attachment information
  const attachmentLinks = document.querySelectorAll('.post__attachment-link');
  attachmentLinks.forEach((link) => {
    const fileName = link.getAttribute('download');
    link.dataset.fileName = fileName;
  });

  const DIV = document.querySelectorAll('.post__thumbnail');
  const parentDiv = DIV[0]?.parentNode;

  const downloadAllContainer = document.createElement('div');
  downloadAllContainer.style.display = 'inline-flex';

  const downloadAllButton = newToggle(DLALL, DownloadAllImagesAndVideos);
  const downloadStatus = document.createElement('span');
  downloadStatus.id = 'downloadStatus';
  downloadStatus.textContent = 'Waiting for images to load';

  downloadAllContainer.append(downloadAllButton, downloadStatus);

  if (parentDiv) {
    for (let i = 0; i < DIV.length; i++) {
      const newDiv = document.createElement('div');
      newDiv.append(newToggle(WIDTH, resizer), newToggle(HEIGHT, resizer), newToggle(FULL, resizer), newToggle(DL, downloadImg), newToggle(RM, removeImg));
      parentDiv.insertBefore(newDiv, DIV[i]);
    }
  }

  Height();
  refreshInterval = setInterval(refreshImages, 5000);

  const postActions = document.querySelector('.post__actions');
  postActions.append(newToggle(WIDTH, Width), newToggle(HEIGHT, Height), newToggle(FULL, Full));
  postActions.append(downloadAllContainer);
})();
