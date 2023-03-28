// ==UserScript==
// @name         Modified Kemono Galleries
// @version      1.0
// @description  Load original resolution, toggle fitted zoom views, remove photos. Use a plug-in for batch download, can't do cross-origin image downloads with JS alone.
// @author       ntf
// @author       Modified by Meri
// @match        *://kemono.party/*/user/*/post/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=kemono.party
// @grant        none
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
    img.style.maxWidth = '100%';
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

// Function to download an image
function downloadImg(evt) {
  // Get the source URL of the image
  const imgSrc = evt.currentTarget.parentNode.nextElementSibling.lastElementChild.getAttribute('src');
  // Get the title and username information from the post
  const titleElement = document.querySelector('.post__title');
  const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
  const username = document.querySelector('.post__user-name').textContent.trim();
  // Construct a filename for the downloaded image
  const imgName = `${title}_${username}.png`.replace("/[/\\?%*:|\"<>]/g", '-'); // replace invalid characters in filename
  // Fetch the image data as a blob
  fetch(imgSrc)
    .then(response => response.blob())
    .then(blob => {
      // Create a download link for the image blob
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = imgName;
      // Programmatically click the download link and then remove it from the document
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke the object URL to free up memory
      window.URL.revokeObjectURL(url);
    });
}

// Function to download all images on the page in their original resolution
function DownloadAllImages() {
  // Select all full-size image elements on the page
  const images = document.querySelectorAll('.post__image');
  // Iterate over the images and download each one with a delay between downloads
  images.forEach((img, index) => {
    // Get the source URL of the image
    const imgSrc = img.getAttribute('src');
    // Get the title and username information from the post
    const titleElement = document.querySelector('.post__title');
    const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
    const username = document.querySelector('.post__user-name').textContent.trim();
    // Construct a filename for the downloaded image
    const imgName = `${title}_${username}_${index}.png`.replace("/[/\\?%*:|\"<>]/g", '-'); // replace invalid characters in filename
    // Fetch the image data as a blob with a delay based on the index
    setTimeout(() => {
      fetch(imgSrc)
        .then(response => response.blob())
        .then(blob => {
          // Create a download link for the image blob
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = imgName;
          // Programmatically click the download link and then remove it from the document
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        });
    }, 250 * index); // Add delay based on index
  });
}


(function() {
    'use strict';

    document.querySelectorAll('a.fileThumb.image-link img').forEach(img => (img.className = 'post__image'));

    let A = document.querySelectorAll('a.fileThumb.image-link');
    let IMG = document.querySelectorAll('.post__image');
    for (let i = 0; i < A.length; i++) {
        IMG[i].setAttribute('src', A[i].getAttribute('href'));
        IMG[i].test = i;
        A[i].outerHTML = A[i].innerHTML;
    }

    let DIV = document.querySelectorAll('.post__thumbnail');
    let parentDiv = DIV[0].parentNode;
    for (let i = 0; i < DIV.length; i++) {
        let newDiv = document.createElement('div');
        newDiv.append(newToggle(WIDTH, resizer), newToggle(HEIGHT, resizer), newToggle(FULL, resizer), newToggle(DL, downloadImg), newToggle(RM, removeImg));
        parentDiv.insertBefore(newDiv, DIV[i]);
    }

    Full();

    document.querySelector('.post__actions').append(newToggle(WIDTH, Width), newToggle(HEIGHT, Height), newToggle(FULL, Full), newToggle(DLALL, DownloadAllImages));

})();
