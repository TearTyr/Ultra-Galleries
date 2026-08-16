# Ultra Galleries

Ultra Galleries is a powerful userscript that enhances the browsing and downloading experience on `kemono.su`, `coomer.su`, `nekohouse.su`, `pawchive.st`, and their associated domains (`kemono.cr`, `coomer.cr`, `coomer.st`, `pawchive.pw`) by adding features for image manipulation, viewing, and batch downloading. It was originally based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) but has been significantly expanded, modernized, and improved.

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
- **Unified Pointer Gestures & Pan/Zoom:** Advanced zooming with mouse wheel, toolbar buttons, and double-tap/double-click support, plus smooth inertia-based panning and touch pinch-to-zoom powered by unified Pointer Events.
- **Interactive Thumbnail Strip:** Thumbnail strip with drag-to-scroll, keyboard navigation, hover zoom previews, right-click context menus, and individual item management.

### Video Handling

- **In-Gallery Playback:** Videos are fully playable directly inside the expanded gallery view with native controls, play overlays, and looping.
- **Batch Inclusion:** Includes video files in batch downloads alongside images.
- **Preserves Filenames:** Retains original video filenames upon downloading.

### Downloading

- **Individual Media Download:** Download single images or videos with a click.
- **Web Worker Batch Downloading:** Download all images and videos from a post packaged into a single zip archive. Utilizes dedicated Web Workers for non-blocking background zipping with zero UI stutter.
- **Custom Naming & Date Archiving:** Configurable naming patterns for zip archives and individual images. Supports dynamic date placeholders (`{date_published}`, `{date_edited}`, `{date_imported}`) to cleanly sort and archive your downloads.
- **CORS Bypass:** Universal `@connect` permissions to effortlessly download assets hosted on external CDNs or dynamic subdomains, such as `file.pawchive.pw`.

### Performance and User Experience

- **Zero External UI Dependencies:** Built entirely with native DOM methods, custom modal dialogs, and native IndexedDB caching, eliminating external libraries like jQuery, SweetAlert2, and Dexie for maximum speed and lightweight memory usage.
- **HTMX & SPA Navigation Safety:** Robust UI injection and cleanup logic utilizing the modern Navigation API (with history fallbacks) to ensure the script works flawlessly across Single-Page Applications and sites using `hx-boost` (such as Pawchive).
- **Pawchive CSS Persistence:** The injected stylesheet is marked with `data-keep`, preventing Pawchive's HTMX head-cleanup logic from removing Ultra Galleries styles during page transitions.
- **True LRU IndexedDB Caching:** Native IndexedDB integration stores fetched image blobs persistently with an automatic Least Recently Used eviction policy when quotas are reached.
- **Decoupled High-Frequency State:** Zooming and panning math are decoupled from the reactive state proxy, caching DOM elements during animations to eliminate layout thrashing.
- **Sliding-Window Preloader:** Intelligent sliding-window memory preloader fetches adjacent images and automatically revokes unused blobs to keep memory consumption low.
- **Dynamic Notifications:** A redesigned, non-intrusive notification system provides real-time progress feedback.
- **Mobile Support:** Touch-friendly interface with pinch-to-zoom, double-tap interactions, and smooth swipe-to-pan.
- **Customizable Interface:** Settings menu allows full customization of button labels, button visibility toggles, hotkeys, slideshow delays, and JSON settings import/export.
- **Auto-Updating:** Integrated `@updateURL` and `@downloadURL` metadata ensures your script manager automatically fetches the latest fixes and features.

## Version History

### Version 4.0.1 — Current

- **Zero External UI Dependencies:** Removed jQuery, SweetAlert2, Dexie.js, and FileSaver.js in favor of native DOM operations, a built-in lightweight SVG modal system, and native IndexedDB.
- **Unified Pointer & Gesture Engine:** Replaced legacy mouse and touch listeners with unified Pointer Events, providing smooth multi-touch pinch zoom, double-tap zoom, and inertia panning.
- **Web Worker ZIP Archiving:** Offloaded JSZip compression and bundling to a dedicated background Web Worker to eliminate main-thread lag during batch downloads.
- **Domain Expansion:** Added official support for `.cr`, `.st`, and `.pw` domain mirrors across Kemono, Coomer, Nekohouse, and Pawchive.
- **Modern Navigation API Support:** Upgraded SPA routing handlers to integrate with the modern `window.navigation` API alongside `popstate` and `pushState` fallbacks.
- **Sliding-Window Cache & Memory Management:** Implemented automatic blob URL cleanup for adjacent preload windows.
- **Enhanced Settings Customization:** Added options to customize button text labels, toggle individual button visibility, and import/export settings as JSON.

## Known Bugs
- If styles ever fail to appear after an update, force-refresh the page once so your script manager re-injects the latest resource bundle.

## Usage

After installation, navigate to a post on `kemono.su`, `coomer.su`, `nekohouse.su`, `pawchive.st`, or any supported mirror. You'll see new buttons injected into the post actions area for resizing and downloading images.

- Use the `DL ALL` button to initiate a background batch download of all media in the post.
- The `GALLERY` button opens the immersive gallery view. Alternatively, press the configured gallery hotkey (default `g`) to quickly open it.
- `⚙️ Settings` opens the configuration menu where you can toggle caching, modify slideshow speed, change the download naming schema, customize button labels and visibility, manage date variables, and import/export settings.

Within the gallery view:

- Click any thumbnail in the bottom strip to view it.
- Navigate using the `k` (previous) and `l` (next) keys, the arrow keys, or the on-screen navigation buttons.
- To zoom in on an image, use the mouse wheel, the zoom buttons in the toolbar, or double-click / double-tap the image.
- When zoomed in, click and drag (or drag on touchscreens) to pan around the image smoothly with momentum inertia.
- On mobile devices, use pinch gestures to zoom and swipe to pan.
- Press `Space` to start or pause the slideshow.
- Right-click thumbnails in the bottom strip to open context options (open, download, copy URL, remove).

## Dependencies

- [JSZip](https://stuk.github.io/jszip/) — v3.10.1

## Acknowledgments

- Original concept based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) by ntf.
- Maintained and modernized by [Meri/TearTyr](https://github.com/TearTyr).

## Version

Current version: **4.0.1**
