// ==UserScript==
// @name         Modified Kemono Galleries
// @version      1.2
// @description  Load original resolution, toggle fitted zoom views, remove photos. Use a plug-in for batch download, can't do cross-origin image downloads with JS alone.
// @match        *://kemono.party/*/user/*/post/*
// @match        *://coomer.party/*/user/*/post/*
// @icon         https://kemono.party/static/menu/recent.svg
// @grant        GM_download
// @license      Unlicense
// ==/UserScript==

// Define constants for button labels
const DLALL = '【DL ALL】';
const DL = '【DOWNLOAD】';
const WIDTH = '【FILL WIDTH】';
const HEIGHT = '【FILL HEIGHT】';
const FULL = '【FULL】';
const RM = '【REMOVE】';

function Height() {
  document.querySelectorAll('.post__image').forEach(img => height(img));
}

function height(img) {
  img.style.maxHeight = '100vh';
  img.style.maxWidth = '100%';
}

function Width() {
  document.querySelectorAll('.post__image').forEach(img => width(img));
}

function width(img) {
  img.style.maxHeight = '100%';
  img.style.maxWidth = '100vw';
}

function Full() {
  document.querySelectorAll('.post__image').forEach(img => full(img));
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

// Image refresher
function handleImageError(evt) {
  const img = evt.currentTarget;
  img.src = img.src;
}

function downloadImg(evt) {
  evt.preventDefault();
  const img = evt.currentTarget.parentNode.nextSibling?.lastElementChild;
  if (img) {
    const imgSrc = img.getAttribute('src');
    const titleElement = document.querySelector('.post__title');
    const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
    const username = document.querySelector('.post__user-name').textContent.trim();
    const imgName = `${title}_${username}.png`.replace(/[\\/:*?"<>|]/g, '-');

    const downloadImage = () => {
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
    };

    // Create a new image element to wait for the image to load before downloading
    const tempImg = new Image();
    tempImg.addEventListener('load', downloadImage);
    tempImg.src = imgSrc;
  }
}

function DownloadAllImages() {
  const images = document.querySelectorAll('.post__image');
  const titleElement = document.querySelector('.post__title');
  const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
  const username = document.querySelector('.post__user-name').textContent.trim();

  const downloadProgressText = document.createElement('span');
  downloadProgressText.style.display = 'block';
  downloadProgressText.style.marginTop = '5px';
  document.querySelector('.post__actions').appendChild(downloadProgressText);

  const downloadImageAtIndex = (index) => {
    if (index >= images.length) {
      console.log('All images downloaded successfully.');
      downloadProgressText.textContent = 'Download complete';
      return;
    }

    const img = images[index];
    const imgSrc = img.getAttribute('src');
    const imgName = `${title}_${username}_${index}.png`.replace(/[\\/:*?"<>|]/g, '-');

    const downloadImage = () => {
      GM_download({
        url: imgSrc,
        name: imgName,
        onload: function () {
          console.log('Image downloaded successfully:', imgName);
          downloadProgressText.textContent = `Downloading... ${index + 1} / ${images.length}`;
          downloadImageAtIndex(index + 1); // Download the next image
        },
        onerror: function (error) {
          console.error('Failed to download image:', imgName, error);
          downloadProgressText.textContent = `Downloading... ${index + 1} / ${images.length}`;
          downloadImageAtIndex(index + 1); // Download the next image
        },
      });
    };

    // Create a new image element to wait for the image to load before downloading
    const tempImg = new Image();
    tempImg.addEventListener('load', downloadImage);
    tempImg.src = imgSrc;
  };

  downloadProgressText.textContent = 'Downloading... 0 / ' + images.length;
  downloadImageAtIndex(0); // Start downloading from the first image
}

(function () {
  'use strict';

  document.querySelectorAll('a.fileThumb.image-link img').forEach((img) => (img.className = 'post__image'));

  // Match each picture card with its corresponding spot on the board
  let A = document.querySelectorAll('a.fileThumb.image-link');
  let IMG = document.querySelectorAll('.post__image');

  // Loop through each picture card
  for (let i = 0; i < A.length; i++) {
    // Step 1: Get the URL of the picture card and assign it to the corresponding spot on the board
    IMG[i].setAttribute('src', A[i].getAttribute('href'));

    // Step 2a: Assign a special identifier to each spot on the board
    IMG[i].test = i;

    // Step 2b: Replace the picture card's HTML with just the picture itself
    A[i].outerHTML = A[i].innerHTML;
  }

  let DIV = document.querySelectorAll('.post__thumbnail');
  let parentDiv = DIV[0].parentNode;
  for (let i = 0; i < DIV.length; i++) {
    let newDiv = document.createElement('div');
    newDiv.append(newToggle(WIDTH, resizer), newToggle(HEIGHT, resizer), newToggle(FULL, resizer), newToggle(DL, downloadImg), newToggle(RM, removeImg));
    parentDiv.insertBefore(newDiv, DIV[i]);
  }

  Height();

  const downloadAllButton = newToggle(DLALL, DownloadAllImages);
  const downloadProgressText = document.createElement('span');
  downloadProgressText.style.display = 'block';
  downloadProgressText.style.marginTop = '5px';

  const actionsContainer = document.querySelector('.post__actions');
  actionsContainer.append(newToggle(WIDTH, Width), newToggle(HEIGHT, Height), newToggle(FULL, Full), downloadAllButton, downloadProgressText);
})();
