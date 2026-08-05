# Ultra Galleries

Ultra Galleries is a powerful userscript that enhances the browsing and downloading experience on `kemono.su`, `coomer.su`, `nekohouse.su`, and `pawchive.st` by adding features for image manipulation, viewing, and batch downloading. It was originally based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) but has been significantly expanded and improved.

## Overview

This userscript provides a seamless and efficient way to interact with image and video content on supported websites, making it easier to view, resize, download, and manage your favorite media.

## Features

### Image Viewing and Manipulation

- **Original Resolution Loading:** Directly loads images in their original resolution.
- **Auto-Load Originals:** Toggleable feature to automatically fetch and display high-res media in the background without interrupting your browsing with annoying loading screens.
- **Resize Options:**
  - Toggle to resize individual or all images in a gallery to fit:
    - Vertical height (`FILL HEIGHT`)
    - Horizontal width (`FILL WIDTH`)
    - Full resolution (`FULL`)
- **Gallery View:** A modern, feature-rich gallery view for easier browsing of images within a post. Grid view has been removed for a cleaner, unified presentation.
- **Slideshow Mode:** Automatically cycle through gallery media with customizable delays and pause-on-hover capabilities.
- **Zoom & Pan:** Advanced zooming with mouse wheel, buttons, and double-click support, plus smooth, inertia-based panning capabilities. Optimized to prevent layout thrashing and ensure 60fps rendering.

### Video Handling

- **In-Gallery Playback:** Videos are fully playable directly inside the expanded gallery view with native controls and looping.
- **Batch Inclusion:** Includes video files in batch downloads alongside images.
- **Preserves Filenames:** Retains original video filenames upon downloading.

### Downloading

- **Individual Media Download:** Download single images or videos with a click.
- **Batch Downloading:** Download all images and videos from a post, packaged in a single zip archive. Utilizes Web Workers for highly efficient, non-blocking background zipping.
- **Custom Naming & Date Archiving:** Configurable naming patterns for zip archives and individual images. Supports dynamic date placeholders (`{date_published}`, `{date_edited}`, `{date_imported}`) to cleanly sort and archive your downloads.
- **CORS Bypass:** Includes universal `@connect` permissions to effortlessly download assets hosted on external CDNs or dynamic subdomains, such as `file.pawchive.pw`.

### Performance and User Experience

- **HTMX & SPA Navigation Safety:** Robust UI injection and cleanup logic ensures the script works flawlessly on modern Single-Page Applications and sites utilizing `hx-boost`, such as Pawchive.
- **Pawchive CSS Persistence:** The injected stylesheet is now marked with `data-keep`, preventing Pawchive's HTMX head-cleanup logic from removing Ultra Galleries CSS during page transitions.
- **Lazy-Load Bypass:** Automatically resolves `data-src` placeholder attributes to extract the true image path without requiring you to scroll down the page.
- **True LRU Caching:** Dexie.js/IndexedDB integration stores fetched image blobs persistently. Implements a true Least Recently Used cache strategy, updating cache timestamps on access so frequently viewed media remains cached longer.
- **Decoupled High-Frequency State:** Zooming and panning math are decoupled from the reactive Proxy state, caching DOM nodes during animations to eliminate performance drops on large images.
- **Dynamic Notifications:** A redesigned, non-intrusive notification system provides real-time feedback that resets and updates correctly as you navigate.
- **Mobile Support:** Touch-friendly interface with pinch-to-zoom, double-tap interactions, and smooth swipe-to-pan.
- **Auto-Updating:** Integrated `@updateURL` and `@downloadURL` metadata ensures your script manager automatically fetches the latest fixes and features.

## Version History

### Version 3.6.5 — Current

- **Pawchive SPA CSS Fix:** Fixed an issue where Ultra Galleries CSS would disappear after navigating to another Pawchive page without a full refresh.
- **HTMX Head Cleanup Compatibility:** The injected `<style>` element is now marked with `data-keep`, allowing it to survive Pawchive's `htmx:beforeSwap` cleanup logic.
- **Improved Script Manager Compatibility:** Added a fallback for environments where `GM_addStyle` may not directly return the injected stylesheet node.
- **Stable UI Across Page Transitions:** Buttons, notifications, and gallery styles now remain correctly styled when moving between user pages and post pages on Pawchive.
- **Documentation Update:** Updated README version information and feature notes to match the current release.

## Known Bugs

- Certain UI elements or functionalities may occasionally experience minor formatting quirks on older `nekohouse.su` layouts.
- The Pawchive CSS disappearance issue during SPA navigation has been fixed in `3.6.5`. If styles still fail to appear, force-refresh the page once after updating so your script manager loads the latest userscript version.

## Usage

After installation, navigate to a post on `kemono.su`, `coomer.su`, `nekohouse.su`, or `pawchive.st`. You'll see new buttons injected into the post actions area for resizing and downloading images.

- Use the `DL ALL` button to initiate a background batch download of all media in the post.
- The `GALLERY` button opens the immersive gallery view. Alternatively, press the configured gallery hotkey, default `g`, to quickly open it.
- `⚙️ Settings` opens the configuration menu where you can toggle caching, modify slideshow speed, change the download naming schema, manage date variables, and control UI button visibility.

Within the gallery view:

- Click any thumbnail in the bottom strip to view it.
- Navigate using the `k` previous and `l` next keys, the arrow keys, or the on-screen navigation buttons.
- To zoom in on an image, use the mouse wheel, the zoom buttons in the toolbar, or double-click the image.
- When zoomed in, click and drag to pan around the image smoothly.
- On mobile devices, use pinch gestures to zoom and swipe to pan.

## Dependencies

- [jQuery](https://jquery.com/) — v3.7.1
- [JSZip](https://stuk.github.io/jszip/) — v3.10.1
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) — v2.0.5
- [SweetAlert2](https://sweetalert2.github.io/) — v11
- [Dexie.js](https://dexie.org/) — v4.0.8

## Acknowledgments

- Original concept based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries).
- Utilizes standard web libraries such as jQuery, JSZip, FileSaver, SweetAlert2, and Dexie.js for robust file management and UI interaction.

## Version

Current version: **3.6.5**
