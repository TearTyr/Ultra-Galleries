// ==UserScript==
// @name         Modified Kemono Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      1.0
// @description  Load original resolution, toggle fitted zoom views, remove photos. Use a plug-in for batch download, can't do cross-origin image downloads with JS alone.
// @author       ntf
// @author       Modified by Meri/Tear
// @match        *://kemono.party/*/user/*/post/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=kemono.party
// @grant        none
// @license      Unlicense
// ==/UserScript==
// Define constants for button labels
const DLALL = '【DL ALL】';
const RM = '【REMOVE】';
const DL = '【DOWNLOAD】';

// Helper function to create a new toggle button element
function newToggle(name, action) {
  const toggle = document.createElement('a');
  toggle.textContent = name;
  toggle.addEventListener('click', action);
  toggle.style.cursor = 'pointer';
  return toggle;
}

// Function to remove an image from the page
function removeImg(evt) {
  // Get the closest ancestor element with class 'post'
  const post = evt.currentTarget.closest('.post');
  // Remove the thumbnail image element from the post
  post.querySelector('.post__thumbnail').remove();
  // Remove the full-size image element from the post
  post.querySelector('.post__image').remove();
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
    const imgSrc = img.getAttribute('data-file-url');
    // Get the title and username information from the post
    const titleElement = document.querySelector('.post__title');
    const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
    const username = document.querySelector('.post__user-name').textContent.trim();
    // Construct a filename for the downloaded image
    const imgName = `${title}_${username}_${index}.png`.replace(/[/\\?%*:|"<>.]/g, '-'); // Replace invalid characters in filename
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

// Function to load full-resolution images
function loadFullResolutionImages() {
  setTimeout(function() {
    // Get the total number of images in the post
    let G = document.querySelector("#page > div > div.post__files").childElementCount;
    // Iterate over each image in the post
    for (let i = 1; i <= G; i++) {
      // Get the image and link elements for the current image
      let imgEl = document.querySelector("#page > div > div.post__files > div:nth-child("+i+") > a > img");
      let linkEl = document.querySelector("#page > div > div.post__files > div:nth-child("+i+") > a");
      // Check if both elements exist for the current image
      if (imgEl && linkEl) {
        // Set the source URL of the full-resolution image
        imgEl.src = linkEl.href;
        // Set the type attribute of the image element to "image/png"
        imgEl.setAttribute("type", "image/png");
      }
    }
  }, 500); // Add a delay of 500 milliseconds before running the function to ensure all images have loaded
}

// Main function to execute all other functions on the page
(function() {
  'use strict';

  // Convert all image thumbnails to full-size images
  document.querySelectorAll('a.fileThumb.image-link img').forEach(img => (img.className = 'post__image'));

  // Replace all image links with their source URLs
  let A = document.querySelectorAll('a.fileThumb.image-link');
  let IMG = document.querySelectorAll('.post__image');
  for (let i = 0; i < A.length; i++) {
    IMG[i].setAttribute('data-file-url', A[i].getAttribute('href')); // Set the data-file-url attribute to the image source URL
    IMG[i].test = i;
    A[i].outerHTML = A[i].innerHTML;
  }

  // Add download and remove buttons to all images on the page
  let DIV = document.querySelectorAll('.post__thumbnail');
  let parentDiv = DIV[0].parentNode;
  for (let i = 0; i < DIV.length; i++) {
    let newDiv = document.createElement('div');
    newDiv.append(newToggle(DL, downloadImg), newToggle(RM, removeImg)); // Add download and remove buttons to the new div
    parentDiv.insertBefore(newDiv, DIV[i]);
  }

  // Add a download all button to the post actions section
  document.querySelector('.post__actions').append(newToggle(DLALL, DownloadAllImages));

  // Load full-resolution images on the page
  loadFullResolutionImages();
})();
