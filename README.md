# Ultra Galleries

**Ultra Galleries** is a powerful userscript that enhances the browsing and downloading experience on `kemono.su`, `coomer.su`, `nekohouse.su`, and `pawchive.st` by adding features for image manipulation, viewing, and batch downloading. It was originally based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) but has been significantly expanded and improved.

## Overview

This userscript provides a seamless and efficient way to interact with image and video content on supported websites, making it easier to view, resize, download, and manage your favorite media.

## Features

### Image Viewing and Manipulation

-   **Original Resolution Loading:** Directly loads images in their original resolution.
-   **Auto-Load Originals:** Toggleable feature to automatically fetch and display high-res media in the background without interrupting your browsing with annoying loading screens.
-   **Resize Options:**
    -   Toggle to resize individual or all images in a gallery to fit:
    -   Vertical height (`FILL HEIGHT`)
    -   Horizontal width (`FILL WIDTH`)
    -   Full resolution (`FULL`)
-   **Gallery View:** A modern, feature-rich gallery view for easier browsing of images within a post. Grid view has been removed for a cleaner, unified presentation.
-   **Slideshow Mode:** Automatically cycle through gallery media with customizable delays and pause-on-hover capabilities.
-   **Zoom & Pan:** Advanced zooming with mouse wheel, buttons, and double-click support, plus smooth, inertia-based panning capabilities. *Optimized to prevent layout thrashing and ensure 60fps rendering.*

### Video Handling

-   **In-Gallery Playback:** Videos are fully playable directly inside the expanded gallery view with native controls and looping.
-   **Batch Inclusion:** Includes video files in batch downloads alongside images.
-   **Preserves Filenames:** Retains original video filenames upon downloading.

### Downloading

-   **Individual Media Download:** Download single images or videos with a click.
-   **Batch Downloading:** Download all images and videos from a post, packaged in a single zip archive. *Utilizes Web Workers for highly efficient, non-blocking background zipping.*
-   **Custom Naming & Date Archiving:** Configurable naming patterns for zip archives and individual images. Supports dynamic date placeholders (`{date_published}`, `{date_edited}`, `{date_imported}`) to cleanly sort and archive your downloads.
-   **CORS Bypass:** Includes universal `@connect` permissions to effortlessly download assets hosted on external CDNs or dynamic subdomains (like `file.pawchive.st`).

### Performance and User Experience

-   **HTMX & SPA Navigation Safety:** Robust UI injection and cleanup logic ensures the script works flawlessly on modern Single-Page Applications and sites utilizing `hx-boost` (like Pawchive). 
-   **Lazy-Load Bypass:** Automatically resolves `data-src` placeholder attributes to extract the true image path without requiring you to scroll down the page.
-   **True LRU Caching:** Dexie.js (IndexedDB) integration stores fetched image blobs persistently. Implements a true Least Recently Used (LRU) algorithm, updating cache timestamps on access to ensure your favorite media stays cached the longest.
-   **Decoupled High-Frequency State:** Zooming and panning math are decoupled from the reactive Proxy state, caching DOM nodes during animations to eliminate performance drops on large images.
-   **Dynamic Notifications:** A redesigned, non-intrusive notification system provides real-time feedback that resets and updates correctly as you navigate.
-   **Mobile Support:** Touch-friendly interface with pinch-to-zoom, double-tap interactions, and smooth swipe-to-pan.
-   **Auto-Updating:** Integrated `@updateURL` and `@downloadURL` metadata ensures your script manager automatically fetches the latest fixes and features.

## Version History

### Version 3.6.3 (Current)
-   **Performance Overhaul:** Decoupled high-frequency view state (`zoomScale`, `imageOffset`) from the reactive state Proxy to eliminate overhead during `requestAnimationFrame` loops.
-   **Smooth Dragging & Panning:** Cached DOM nodes during pan/zoom operations to prevent layout thrashing, drastically reducing CPU usage and ensuring buttery-smooth 60fps image dragging.
-   **True LRU Cache:** Updated the Dexie/IndexedDB caching logic to refresh the `cachedAt` timestamp upon image access, implementing a proper Least Recently Used eviction strategy.
-   **Memory Leak Fixes:** Hardened Blob URL revocation and Web Worker cleanup during SPA navigation to prevent memory bloating over long browsing sessions.

### Version 3.6.2
-   **Dynamic Date Formatting:** Added support for `{date_published}`, `{date_edited}`, and `{date_imported}` placeholders in file naming settings. Dates are automatically cleaned (e.g., `2023-10-25_14-30-00`) for safe archiving.
-   **Layout Robustness:** Improved DOM container selectors to gracefully handle recent site HTML updates. The script will now fall back to `.post__body` or `.post__files` if standard containers are modified.
-   **Auto-Update Support:** Added SleazyFork `@downloadURL` and `@updateURL` for seamless automatic updates.

### Version 3.6.0
-   **Pawchive.st Support:** Added full compatibility for the new `pawchive.st` platform. 
-   **Lazy-Load Bypass:** Added logic to extract true image URLs from lazy-loaded `data-src` elements.
-   **HTMX Compatibility:** Fortified UI observers and element cleanup protocols to properly handle HTMX/history navigation without duplicating buttons.
-   **CORS Fixes:** Implemented `@connect *` to allow proper zipping and image fetching across varied CDNs.
-   **Bug Fix:** Fixed an issue where the screen would blur inappropriately during automatic background loading of original images. 

### Version 3.5.1
-   **UI Overhaul:** Modernized the gallery view by removing the clunky grid layout, hiding unnecessary numbers, and restoring clean visual notifications.
-   **Auto-Load Toggle:** Added a configuration setting to enable/disable the auto-loading of original images.
-   **Slideshow Integration:** Introduced an automated slideshow feature with adjustable timing settings inside the config menu.
-   **In-Gallery Videos:** Improved media detection so videos now natively display and play within the expanded gallery view.

### Version 3.2.2
-   **Major Reliability Fix:** Reworked the script's initialization logic to be fully compatible with single-page application (SPA) navigation. 
-   **Performance Optimization:** Refactored image loading to use more efficient data structures (Map lookups), significantly improving performance on massive galleries.
-   **Bug Fixes:** Corrected layout issues in the notification pop-up and eliminated race conditions that caused instability during page navigation.

### Version 3.1.3
-   **Persistent Image Caching:** Added Dexie.js for IndexedDB caching to drastically improve load speeds on revisited posts.

## Known Bugs

-   Certain UI elements or functionalities may occasionally experience minor formatting quirks on older `nekohouse.su` layouts.

## Usage

After installation, navigate to a post on `kemono.su`, `coomer.su`, `nekohouse.su`, or `pawchive.st`. You'll see new buttons injected into the post actions area for resizing and downloading images. 

- Use the **`DL ALL`** button to initiate a background batch download of all media in the post. 
- The **`GALLERY`** button opens the immersive gallery view. Alternatively, press the configured gallery hotkey (default **`g`**) to quickly open it.
- **`⚙️ (Settings)`** opens the configuration menu where you can toggle caching, modify slideshow speed, change the download naming schema (including the new date variables), and manage UI button visibility.

**Within the gallery view:** 
Click any thumbnail in the bottom strip to view it. Navigate using the **`k`** (previous) and **`l`** (next) keys, the arrow keys, or the on-screen navigation buttons. 

To zoom in on an image, use the mouse wheel, the zoom buttons in the toolbar, or double-click on the image. When zoomed in, click and drag to pan around the image smoothly. On mobile devices, use pinch gestures to zoom and swipe to pan.

## Dependencies

-   [jQuery](https://jquery.com/) (v3.7.1)
-   [JSZip](https://stuk.github.io/jszip/) (v3.10.1)
-   [FileSaver.js](https://github.com/eligrey/FileSaver.js/) (v2.0.5)
-   [SweetAlert2](https://sweetalert2.github.io/) (v11)
-   [Dexie.js](https://dexie.org/) (v4.0.8)

## Acknowledgments

-   Original concept based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries).
-   Utilizes standard web libraries (jQuery, JSZip, FileSaver, SweetAlert2, and Dexie.js) for robust file management and UI interaction.

## Version

Current version: **3.6.3**
