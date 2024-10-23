// ==UserScript==
// @name         Ultra Galleries
// @namespace    https://sleazyfork.org/en/users/1027300-ntf
// @version      2.4.2
// @description  Enhanced gallery experience with modern features and optimizations
// @author       ntf (original), Meri/TearTyr (updates)
// @match        *://kemono.su/*/user/*/post/*
// @match        *://coomer.su/*/user/*/post/*
// @match        *://nekohouse.su/*/user/*/post/*
// @icon         https://kemono.party/static/menu/recent.svg
// @grant        GM_download
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://unpkg.com/jquery@3.7.1/dist/jquery.min.js
// @require      https://unpkg.com/jszip@3.10.1/dist/jszip.min.js
// @require      https://unpkg.com/file-saver@2.0.5/dist/FileSaver.min.js
// @require      https://unpkg.com/sweetalert2@11.14.2/dist/sweetalert2.js
// @require      https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/refs/heads/TestingBranch/Settings.js
// @run-at       document-end
// @noframes
// ==/UserScript==

(async function () {
  "use strict";

  // Constants
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

  // Configuration object for selectors
  const CONFIG = {
    nekohouse: {
      imageSelector: "a.image-link:not(.scrape__user-profile)",
      thumbnailSelector: ".scrape__thumbnail",
      postActionsSelector: ".scrape__actions",
      attachmentLinkSelector: ".scrape__attachment-link",
      titleSelector: ".scrape__title",
      userNameSelector: ".scrape__user-name",
      navLinkSelector: ".scrape__nav-link.next",
    },
    default: {
      imageSelector: "a.fileThumb.image-link",
      thumbnailSelector: ".post__thumbnail",
      postActionsSelector: ".post__actions",
      attachmentLinkSelector: ".post__attachment-link",
      titleSelector: ".post__title",
      userNameSelector: ".post__user-name",
      navLinkSelector: ".paginator__link--next",
    },
  };

  // Utility Functions
  const getConfig = (key) => CONFIG[website]?.[key] || CONFIG.default[key];

  const createReactiveState = (initialState) => {
    return new Proxy(initialState, {
      set(target, key, value) {
        target[key] = value;
        if (key === "imageCount" || key === "totalImages") {
          updateImageLoadingStatus();
        } else if (key === "downloadedCount") {
          updateDownloadStatus();
        }
        return true;
      },
    });
  };

  const createToggleButton = (name, action) => {
    const toggle = document.createElement("a");
    toggle.textContent = name;
    toggle.addEventListener("click", action);
    toggle.style.cursor = "pointer";
    return toggle;
  };

  const updateStatus = (text) => {
    if (elements.statusElement) {
      elements.statusElement.textContent = text;
    }
  };

  const updateImageLoadingStatus = () => {
    const { imageCount, totalImages } = state;
    const status =
      imageCount === totalImages
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
    const status =
      downloadedCount === totalImages
        ? "Done Downloading!"
        : `Downloading... (${downloadedCount}/${totalImages})`;
    updateStatus(status);
  };

  const enableGalleryButton = () => {
    if (elements.galleryButton) {
      elements.galleryButton.textContent = BUTTONS.GALLERY;
      elements.galleryButton.disabled = false;
      elements.galleryButton.classList.remove("disabled");
      elements.galleryButton.addEventListener("click", showGallery);
    }
  };

  // State management
  const state = createReactiveState({
    imageCount: 0,
    downloadedCount: 0,
    totalImages: 0,
    imagesLoaded: false,
    galleryActive: false,
    expandedViewActive: false,
    zipFileNameFormat: "{title}-{artistName}.zip",
    imageFileNameFormat: "{title}-{artistName}-{fileName}-{index}",
  });

  // DOM Elements
  const elements = {
    statusElement: null,
    postActions: null,
    galleryButton: null,
    settingsButton: null,
  };

  // Image handling functions
  const setImageStyle = (img, styles) => {
    if (img) {
      Object.assign(img.style, styles);
    } else {
      console.error("Image element is undefined or null:", img);
    }
  };

  const imageActions = {
    height: (img) =>
      setImageStyle(img, {
        maxHeight: "100vh",
        maxWidth: "100%",
        width: "auto",
      }),
    width: (img) =>
      setImageStyle(img, {
        maxHeight: "100%",
        maxWidth: "100vw",
        height: "auto",
      }),
    full: (img) =>
      setImageStyle(img, {
        maxHeight: "none",
        maxWidth: "none",
        height: "auto",
        width: "auto",
      }),
  };

  const removeImage = (evt) => {
    const buttonContainer = evt.currentTarget.closest("div");
    const imageContainer = buttonContainer?.nextElementSibling;
    if (imageContainer) {
      imageContainer.remove();
      buttonContainer.remove();
    } else {
      console.error("Could not find image container to remove");
    }
  };

  const resizeImage = (evt) => {
    const action = Object.keys(BUTTONS)
      .find((key) => BUTTONS[key] === evt.currentTarget.textContent)
      ?.toLowerCase();
    const imgContainer =
      evt.currentTarget.closest(".gallery-item") ||
      evt.currentTarget.closest(".expanded-view") ||
      evt.currentTarget.closest(getConfig("thumbnailSelector"));
    const img = imgContainer?.querySelector("img");

    if (img && imageActions[action]) {
      imageActions[action](img);
    } else {
      console.error(
        "Image element or action not found for resize:",
        imgContainer,
        action,
      );
    }
  };

  const resizeAllImages = (action) => {
    document
      .querySelectorAll(".post__image")
      .forEach((img) => imageActions[action](img));
  };

  // ZIP handling functions
  const addToZip = async (zip, src, fileName, type) => {
    try {
      const response = await new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
          method: "GET",
          url: src,
          responseType: "blob",
          headers: { referer: `https://${website}.su/` },
          onload: resolve,
          onerror: reject,
        });
      });

      if (response.status === 200) {
        zip.file(fileName, response.response);
        if (type === "image") {
          state.downloadedCount++;
        }
        return true;
      } else {
        throw new Error(`Failed to download ${type}: ${src}`);
      }
    } catch (error) {
      console.error(`Error downloading ${type}:`, error);
      return false;
    }
  };

  const addToZipWithRetry = async (
    zip,
    src,
    fileName,
    type,
    retryCount = 0,
  ) => {
    try {
      const success = await addToZip(zip, src, fileName, type);
      if (!success && retryCount < MAX_RETRIES) {
        console.warn(
          `Failed to download ${type}: ${src}, retrying... (Attempt ${retryCount + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return addToZipWithRetry(zip, src, fileName, type, retryCount + 1);
      }
      return success;
    } catch (error) {
      console.error(
        `Failed to download ${type} after ${MAX_RETRIES} attempts:`,
        src,
        error,
      );
      return false;
    }
  };

  const downloadAllImagesAndVideos = async () => {
    try {
      const images = document.querySelectorAll(getConfig("imageSelector"));
      const attachmentLinks = document.querySelectorAll(
        getConfig("attachmentLinkSelector"),
      );
      const title = document
        .querySelector(getConfig("titleSelector"))
        .textContent.trim();
      const artistName = document
        .querySelector(getConfig("userNameSelector"))
        .textContent.trim();

      const total = images.length + attachmentLinks.length;
      const zip = new JSZip();

      state.downloadedCount = 0;
      state.totalImages = images.length;

      const downloadPromises = [
        ...Array.from(images).map((imgLink, index) => {
          const imgSrc =
            website === "nekohouse"
              ? imgLink.querySelector(".fileThumb").getAttribute("href")
              : imgLink.getAttribute("href").split("?")[0];
          const fileName =
            website === "nekohouse"
              ? imgLink.querySelector("img").getAttribute("alt") ||
                imgSrc.split("/").pop()
              : imgLink.getAttribute("download");
          const imgName = getFormattedFileName(state.imageFileNameFormat, {
            title,
            artistName,
            fileName: fileName.replace(/\.[^/.]+$/, ""),
            index: index + 1,
            ext: getExtension(fileName),
          });
          return addToZipWithRetry(zip, imgSrc, imgName, "image");
        }),
        ...Array.from(attachmentLinks).map((link) => {
          const videoSrc = link.getAttribute("href");
          const videoName = link.textContent.trim().replace("Download ", "");
          return addToZipWithRetry(zip, videoSrc, videoName, "Attachment");
        }),
      ];

      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: "blob" });

      const zipFileName = getFormattedFileName(state.zipFileNameFormat, {
        artistName,
        title,
      });

      saveAs(content, zipFileName);
      updateStatus(`Done Downloading and adding to a zip! Total: ${total}`);
    } catch (error) {
      console.error("Error in downloadAllImagesAndVideos:", error);
      updateStatus(`Failed to download and add to zip: ${error.message}`);
    }
  };

  // Image loading functions
  const forceLoadImage = async (imgSrc) => {
    try {
      const response = await fetch(imgSrc, {
        method: "HEAD",
        headers: { referer: `https://${website}.su/` },
      });
      if (response.ok) {
        console.log("Force loaded image:", imgSrc);
        state.imageCount++;
      } else {
        console.error("Failed to force load image:", imgSrc, response.status);
      }
    } catch (error) {
      console.error("Failed to force load image:", imgSrc, error);
    }
  };

  const loadImageWithRetry = async (img, imgSrc, retryCount = 0) => {
    try {
      const response = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "HEAD",
          url: imgSrc,
          headers: { referer: `https://${website}.su/` },
          onload: resolve,
          onerror: reject,
        });
      });

      if (response.status === 200) {
        console.log("Image loaded successfully:", imgSrc);
        img.src = imgSrc;
      } else if (response.status === 429) {
        throw new Error(`Image rate limited: ${imgSrc}`);
      } else {
        throw new Error(
          `Failed to load image: ${imgSrc}, Status: ${response.status}`,
        );
      }
    } catch (error) {
      console.warn(`Error loading image: ${imgSrc}`, error);
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(
          `Retrying image load: ${imgSrc} in ${delay / 1000} seconds (Attempt ${retryCount + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        await loadImageWithRetry(img, imgSrc, retryCount + 1);
      } else {
        console.error("Failed to load image after all retries:", imgSrc);
        await forceLoadImage(imgSrc);
      }
    } finally {
      state.imageCount++;
    }
  };

  const loadImages = async () => {
    const images = document.querySelectorAll(
      `${getConfig("imageSelector")} img`,
    );
    state.totalImages = images.length;

    await Promise.all(
      Array.from(images).map(async (img) => {
        const fileThumbElement =
          website === "nekohouse"
            ? img.parentNode.querySelector(".fileThumb")
            : null;

        const imgSrc =
          website === "nekohouse" && fileThumbElement
            ? fileThumbElement.getAttribute("href")
            : img.parentNode.getAttribute("href");

        await loadImageWithRetry(img, imgSrc);
      }),
    );

    console.log("All images loaded");
  };

  // Gallery functions
  const createGalleryOverlay = () => {
    const overlay = document.createElement("div");
    overlay.id = "gallery-overlay";

    const galleryContainer = document.createElement("div");
    galleryContainer.className = "gallery-container";

    const closeButton = document.createElement("button");
    closeButton.textContent = "×";
    closeButton.className = "gallery-close-button";
    closeButton.addEventListener("click", closeGallery);

    const galleryContent = document.createElement("div");
    galleryContent.className = "gallery-content";

    const expandedView = document.createElement("div");
    expandedView.className = "expanded-view";

    const expandedImage = document.createElement("img");
    expandedImage.className = "expanded-image";

    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.className = "thumbnail-container";

    expandedView.appendChild(expandedImage);
    expandedView.appendChild(thumbnailContainer);
    galleryContainer.appendChild(closeButton);
    galleryContainer.appendChild(galleryContent);
    galleryContainer.appendChild(expandedView);
    overlay.appendChild(galleryContainer);

    return overlay;
  };

  const createNavigationButton = (direction) => {
    const button = document.createElement("button");
    button.textContent = direction === "prev" ? "←" : "→";
    button.className = `navigation-button ${direction}`;
    return button;
  };

  const createLoadingOverlay = () => {
    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    const loadingText = document.createElement("div");
    loadingText.textContent = "Loading...";
    overlay.appendChild(loadingText);
    return overlay;
  };

  const closeGallery = () => {
    const overlay = document.getElementById("gallery-overlay");
    if (overlay) {
      document.body.removeChild(overlay);
      state.galleryActive = false;
      state.expandedViewActive = false;
    }
  };

  const showGallery = () => {
    state.galleryActive = true;
    const overlay = createGalleryOverlay();
    const galleryContent = overlay.querySelector(".gallery-content");
    const expandedView = overlay.querySelector(".expanded-view");
    const expandedImage = expandedView?.querySelector("img");
    const thumbnailContainer = expandedView?.querySelector(
      ".thumbnail-container",
    );
    const images = Array.from(document.querySelectorAll(".post__image"));

    let currentIndex = 0;

    const pageNumber = document.createElement("div");
    pageNumber.className = "page-number";
    expandedView.appendChild(pageNumber);

    const showExpandedImage = (index) => {
      if (expandedImage && expandedView) {
        state.expandedViewActive = true;
        const loadingOverlay = createLoadingOverlay();
        expandedView.appendChild(loadingOverlay);

        expandedImage.onload = () => {
          expandedView.removeChild(loadingOverlay);
          expandedView.style.display = "flex";
        };

        expandedImage.onerror = () => {
          expandedView.removeChild(loadingOverlay);
          console.error("Failed to load expanded image");
        };

        expandedImage.src = images[index].src;
        currentIndex = index;
        pageNumber.textContent = `${index + 1} / ${images.length}`;

        thumbnailContainer
          ?.querySelectorAll(".expanded-thumbnail")
          .forEach((thumb, i) => {
            thumb.classList.toggle("active", i === index);
          });
      } else {
        console.error("Unable to show expanded image. Missing elements:", {
          expandedImage,
          expandedView,
        });
      }
    };

    const hideExpandedImage = () => {
      state.expandedViewActive = false;
      expandedView.style.display = "none";
    };

    images.forEach((img, index) => {
      const thumbnail = document.createElement("img");
      thumbnail.src = img.src;
      thumbnail.className = "thumbnail";
      thumbnail.addEventListener("click", () => showExpandedImage(index));

      galleryContent.appendChild(thumbnail);

      const expandedThumbnail = thumbnail.cloneNode(true);
      expandedThumbnail.className = "expanded-thumbnail";
      expandedThumbnail.addEventListener("click", () =>
        showExpandedImage(index),
      );
      thumbnailContainer.appendChild(expandedThumbnail);
    });

    const prevButton = createNavigationButton("prev");
    const nextButton = createNavigationButton("next");

    prevButton.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      showExpandedImage(currentIndex);
    });

    nextButton.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % images.length;
      showExpandedImage(currentIndex);
    });

    expandedView.appendChild(prevButton);
    expandedView.appendChild(nextButton);

    expandedView.addEventListener("click", (e) => {
      if (e.target === expandedView) {
        hideExpandedImage();
      }
    });

    document.body.appendChild(overlay);

    const handleKeydown = (event) => {
      if (state.galleryActive) {
        if (event.key === "Escape") {
          state.expandedViewActive ? hideExpandedImage() : closeGallery();
        } else if (state.expandedViewActive) {
          if (event.key === "ArrowLeft") {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            showExpandedImage(currentIndex);
          } else if (event.key === "ArrowRight") {
            currentIndex = (currentIndex + 1) % images.length;
            showExpandedImage(currentIndex);
          }
        }
      } else {
        const prevPageLink = document.querySelector(
          website === "nekohouse"
            ? ".scrape__nav-link.next"
            : ".paginator__link--prev",
        );
        const nextPageLink = document.querySelector(
          getConfig("navLinkSelector"),
        );
        if (event.key === "ArrowLeft" && prevPageLink) {
          prevPageLink.click();
          event.preventDefault();
        } else if (event.key === "ArrowRight" && nextPageLink) {
          nextPageLink.click();
          event.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  };

  // Utility functions
  const getExtension = (filename) => {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
  };

  const sanitizeFileName = (name) => name.replace(/[/\\:*?"<>|]/g, "-");

  const getFormattedFileName = (format, data) => {
    return format.replace(/{(\w+)}/g, (match, key) =>
      sanitizeFileName(data[key] || match),
    );
  };

  // Settings function
  const showSettings = () => {
    if (typeof window.showSettings === "function") {
      window.showSettings();
    } else {
      console.error("Settings module not loaded properly");
    }
  };

  // Initialization
  const init = async () => {
    try {
      // Load CSS
      const cssResponse = await fetch(
        "https://raw.githubusercontent.com/TearTyr/Ultra-Galleries/refs/heads/TestingBranch/Styles.css",
      );
      const css = await cssResponse.text();
      GM_addStyle(css);

      // Wait for Settings.js to initialize
      if (!window.UGSettings) {
        await new Promise((resolve) => {
          const checkSettings = setInterval(() => {
            if (window.UGSettings) {
              clearInterval(checkSettings);
              resolve();
            }
          }, 100);
        });
      }

      window.onSettingsChanged = function (newSettings) {
        state.zipFileNameFormat = newSettings.filenameFormat;
        state.imageFileNameFormat = newSettings.filenameFormat;
      };
      // Get post actions container
      elements.postActions = document.querySelector(
        getConfig("postActionsSelector"),
      );

      if (!elements.postActions) {
        throw new Error("Post actions container not found!");
      }

      // Add image class based on website
      document
        .querySelectorAll(`${getConfig("imageSelector")} img`)
        .forEach((img) => (img.className = "post__image"));

      document
        .querySelectorAll(getConfig("attachmentLinkSelector"))
        .forEach((link) => {
          link.dataset.fileName = link.getAttribute("download");
        });

      const containerStatus = document.createElement("div");
      containerStatus.style.display = "inline-flex";

      const downloadAllButton = createToggleButton(
        BUTTONS.DOWNLOAD_ALL,
        downloadAllImagesAndVideos,
      );
      elements.statusElement = document.createElement("span");
      elements.statusElement.id = "Status";
      elements.statusElement.style.marginLeft = "10px";

      containerStatus.append(downloadAllButton, elements.statusElement);

      elements.galleryButton = createToggleButton(BUTTONS.GALLERY, null);
      elements.galleryButton.disabled = true;
      elements.galleryButton.classList.add("disabled");

      elements.postActions.append(
        createToggleButton(BUTTONS.WIDTH, () => resizeAllImages("width")),
        createToggleButton(BUTTONS.HEIGHT, () => resizeAllImages("height")),
        createToggleButton(BUTTONS.FULL, () => resizeAllImages("full")),
        containerStatus,
        elements.galleryButton,
      );

      elements.settingsButton = createToggleButton(
        BUTTONS.SETTINGS,
        showSettings,
      );
      elements.settingsButton.className = "settings-button";
      document.body.appendChild(elements.settingsButton);

      const fileDivs = document.querySelectorAll(
        getConfig("thumbnailSelector"),
      );
      const parentDiv = fileDivs[0]?.parentNode;

      if (parentDiv) {
        fileDivs.forEach((div, index) => {
          const downloadLink = div.querySelector(
            website === "nekohouse" ? "a.image-link" : ".fileThumb",
          );
          if (downloadLink) {
            const newDiv = document.createElement("div");
            newDiv.append(
              createToggleButton(BUTTONS.WIDTH, resizeImage),
              createToggleButton(BUTTONS.HEIGHT, resizeImage),
              createToggleButton(BUTTONS.FULL, resizeImage),
              createToggleButton(BUTTONS.DOWNLOAD, () =>
                downloadImageByIndex(index),
              ),
              createToggleButton(BUTTONS.REMOVE, removeImage),
            );
            parentDiv.insertBefore(newDiv, div);
          }
        });
      }

      await loadImages();

      window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
        }
      });
    } catch (error) {
      console.error("Initialization error:", error);
    }
  };

  // Start the script
  init();
})();
