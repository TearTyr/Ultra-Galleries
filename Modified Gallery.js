// ==UserScript==
// @name         Modified Kemono Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      1.0
// @description  Load original resolution, and Download the Images
// @author       ntf
// @author       Modified by Meri
// @match        *://kemono.party/*/user/*/post/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=kemono.party
// @grant        none
// @license      Unlicense
// ==/UserScript==
const DLALL = '【DL ALL】';
const RM = '【REMOVE】';
const DL = '【DOWNLOAD】';

function newToggle(name, action) {
  const toggle = document.createElement('a');
  toggle.textContent = name;
  toggle.addEventListener('click', action);
  toggle.style.cursor = 'pointer';
  return toggle;
}

function removeImg(evt) {
  const post = evt.currentTarget.closest('.post');
  post.querySelector('.post__thumbnail').remove();
  post.querySelector('.post__image').remove();
}

function downloadImg(evt) {
  const imgSrc = evt.currentTarget.parentNode.nextElementSibling.lastElementChild.getAttribute('src');
  const imgName = imgSrc.substring(imgSrc.lastIndexOf('/') + 1);
  fetch(imgSrc)
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = imgName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
}

function DownloadAllImages() {
  const images = document.querySelectorAll('.post__image');
  images.forEach((img, index) => {
    const imgSrc = img.getAttribute('src');
    const titleElement = document.querySelector('.post__title');
    const title = `${titleElement.querySelector('span:first-child').textContent.trim()} ${titleElement.querySelector('span:last-child').textContent.trim()}`;
    const username = document.querySelector('.post__user-name').textContent.trim();
    const imgName = `${title}_${username}_${index}.png`.replace("/[/\\?%*:|\"<>]/g", '-'); // replace invalid  characters in filename
    setTimeout(() => {
      fetch(imgSrc)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = imgName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        });
    }, 250 * index); // add delay based on index
  });
}

function loadFullResolutionImages() {
  setTimeout(function() {
    let G = document.querySelector("#page > div > div.post__files").childElementCount;
    for (let i = 1; i <= G; i++) {
      let imgEl = document.querySelector("#page > div > div.post__files > div:nth-child("+i+") > a > img");
      let linkEl = document.querySelector("#page > div > div.post__files > div:nth-child("+i+") > a");
      if (imgEl && linkEl) {
        imgEl.src = linkEl.href;
        imgEl.setAttribute("type", "image/png");
      }
    }
  }, 500);
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
    newDiv.append(newToggle(DL, downloadImg), newToggle(RM, removeImg));
    parentDiv.insertBefore(newDiv, DIV[i]);
  }

  document.querySelector('.post__actions').append(newToggle(DLALL, DownloadAllImages));

  loadFullResolutionImages();
})();
