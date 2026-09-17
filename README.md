# Ultra Galleries

Ultra Galleries is a powerful userscript that enhances the browsing and downloading experience on `kemono.su`, `coomer.su`, `nekohouse.su`, `pawchive.st`, and their associated domain mirrors (`kemono.cr`, `coomer.cr`, `coomer.st`, `pawchive.pw`) by adding features for image manipulation, viewing, and batch downloading. It was originally based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) but has been significantly expanded, modernized, and improved.

## Overview

This userscript provides a seamless and efficient way to interact with image, video, and file-attachment content on supported websites, making it easier to view, resize, download, and manage your favorite media. It is built entirely on native browser APIs — no jQuery, no SweetAlert2, no external UI libraries — for maximum speed and minimal footprint.

## Features

### Image Viewing and Manipulation

- **Original Resolution Loading:** Directly loads images in their original resolution.
- **Auto-Load Originals:** Toggleable feature to automatically fetch and display high-res media in the background without interrupting your browsing with loading screens.
- **Resize Options:**
  - Toggle to resize individual or all images in a gallery to fit:
    - Vertical height (`FILL HEIGHT`)
    - Horizontal width (`FILL WIDTH`)
    - Full resolution (`FULL`)
  - Each scope (post action bar vs. per-thumbnail) has independent visibility toggles in Settings.
- **Gallery View:** A modern, feature-rich gallery view for easier browsing of images within a post. Grid view has been removed for a cleaner, unified presentation.
- **Slideshow Mode:** Automatically cycle through gallery media with customizable delays and pause-on-hover capabilities.
- **Unified Pointer Gestures & Pan/Zoom:** Advanced zooming with mouse wheel, toolbar buttons, and double-tap/double-click support, plus smooth inertia-based panning and touch pinch-to-zoom powered by unified Pointer Events.
- **Interactive Thumbnail Strip:** Thumbnail strip with drag-to-scroll, keyboard navigation, hover zoom previews, right-click context menus, and individual item management.
- **Native Fullscreen:** Toggle true browser fullscreen via the toolbar button or the `f` key. Choose between **Native** (real fullscreen, hides browser chrome), **CSS** (styled in-page expansion), or **Ask each time** in Settings → General.

### Video Handling

- **In-Gallery Playback:** Videos are fully playable directly inside the expanded gallery view with native controls, play overlays, and looping.
- **Paced Video Fetching on Pawchive:** Video sources are fetched through the same rate-limited pipeline as images, ensuring Pawchive's per-host request limit is respected even during playback.
- **Batch Inclusion:** Includes video files in batch downloads alongside images.
- **Preserves Filenames:** Retains original video filenames upon downloading.

### File Attachments

- **Non-Media Files Supported:** Recognizes and downloads arbitrary attachments (`.clip`, `.psd`, `.zip`, `.pdf`, and any other `download`-attributed file) in addition to images and videos.
- **Attachment Preview:** Non-previewable files display a stylized file-type placeholder and an inline download button in the gallery view.
- **Thumbnail Fallback:** Attachments show a file icon in the thumbnail strip instead of a broken image.

### Downloading

- **Individual Media Download:** Download single images or videos with a click.
- **Split Batch Download Buttons:**
  - **DL ALL** — one ZIP containing every item in the post (images, videos, and attachments), with the post's published date preserved on each entry.
  - **DL IMAGES** — a ZIP of just the images, in sorted reading order.
  - **DL FILES** — a ZIP of just the videos and non-media attachments.
  - Each variant produces a distinct archive (`…-images.zip`, `…-files.zip`, or the base name for `DL ALL`) so downloads never collide.
- **Web Worker Batch Downloading:** Offloads JSZip bundling to a dedicated background Web Worker for non-blocking, stutter-free zip creation.
- **Timestamp Preservation:** ZIP entries are stamped with the post's published date, so extraction tools (7-Zip, WinRAR, Windows Explorer, Keka) restore the original file mtime — torrent-style archiving.
- **Custom Naming & Date Archiving:** Configurable naming patterns for ZIP archives and individual files. Supports dynamic date placeholders (`{date_published}`, `{date_edited}`, `{date_imported}`) plus `{title}`, `{artistName}`, `{fileName}`, and `{index}`.
- **CORS Bypass:** Universal `@connect` permissions to effortlessly download assets hosted on external CDNs or dynamic subdomains, such as `file.pawchive.pw`.

### Performance and User Experience

- **Zero External UI Dependencies:** Built entirely with native DOM methods, custom modal dialogs, and native IndexedDB caching — no jQuery, SweetAlert2, or Dexie.
- **HTMX & SPA Navigation Safety:** Robust UI injection and cleanup logic utilizing the modern Navigation API (with history fallbacks) to ensure the script works flawlessly across Single-Page Applications and sites using `hx-boost` (such as Pawchive).
- **Pawchive CSS Persistence:** The injected stylesheet is marked with `data-keep`, preventing Pawchive's HTMX head-cleanup logic from removing Ultra Galleries styles during page transitions.
- **Pawchive Rate-Limit Compliance:** All requests to Pawchive hosts are serialized through a `≤ 1 req/sec` pacer with a custom User-Agent header. The pacer is rejection-safe and cannot be silently bypassed by a failed request.
- **Request Deduplication:** Concurrent requests for the same URL within a session are coalesced into a single network fetch. Reduces load on the origin server and speeds up gallery loads.
- **True LRU IndexedDB Caching:** Native IndexedDB integration stores fetched image blobs persistently with an automatic Least Recently Used eviction policy when quotas are reached.
- **Session-Aware Cancellation:** In-flight requests are tracked per navigation session and aborted when the user leaves a post, preventing wasted bandwidth and stale writes.
- **Decoupled High-Frequency State:** Zooming and panning math are decoupled from the reactive state proxy, caching DOM elements during animations to eliminate layout thrashing.
- **Sliding-Window Preloader:** Intelligent sliding-window memory preloader fetches adjacent images and automatically revokes unused blobs to keep memory consumption low.
- **Dynamic Notifications:** A redesigned, non-intrusive notification system provides real-time progress feedback with per-type styling and slide-in/out animations.
- **Mobile Support:** Touch-friendly interface with pinch-to-zoom, double-tap interactions, and smooth swipe-to-pan.
- **Accessible by Default:** Focus-trapped modals, ARIA live announcements, `:focus-visible` rings, `prefers-reduced-motion` support, and screen-reader-friendly labels throughout.
- **Customizable Interface:** Reorganized 9-tab settings panel (General, Gallery Viewer, Downloads, Post Actions, Thumbnails, Button Labels, Keyboard, Advanced) with sub-headers, inline descriptions, and JSON settings import/export.
- **Auto-Updating:** Integrated `@updateURL` and `@downloadURL` metadata ensures your script manager automatically fetches the latest fixes and features.

## Version History

### Version 4.3.1 — Current

- **Button visibility fix:** Hide toggles in Settings → Post Actions and Settings → Thumbnails now apply correctly. Previously, the `.ug-button { display: inline-flex !important }` rule in the main stylesheet overrode the inline `display: none` set by the visibility function, so buttons remained visible despite the toggle. Switched to the `.ug-hidden` utility class (`display: none !important`) which wins the cascade.
- **Initial visibility application:** Hide settings are now applied immediately after the post action bar is created, so saved preferences take effect on the first render rather than requiring a settings change to trigger the update.

### Version 4.3.0

- **Split Button Visibility:** Button hiding is now scoped — **Post Actions** controls the global top bar (GALLERY, HEIGHT, WIDTH, FULL, DL ALL, DL IMAGES, DL FILES) and **Thumbnails** controls the per-image button row independently. Previously, hiding a button in one location hid it everywhere.
- **Reorganized Settings Panel:** The settings menu is now split into nine focused tabs — General, Gallery Viewer, Downloads, Post Actions, Thumbnails, Button Labels, Keyboard, and Advanced — with sub-headers, inline descriptions, and horizontal dividers between groups.
- **Settings UI primitives:** Added support for sub-headers, description text, and dividers inside settings sections.
- **Legacy migration:** Existing single-scope hide toggles from earlier versions are transparently migrated to the new thumbnail-scoped toggles on first load.

### Version 4.2.1

- **Safer timestamp fallback:** If no published date can be parsed from the post, `getPostDateObject` now returns `null` instead of `new Date()`, letting JSZip fall back to its default instead of silently stamping every file with the download time.
- **Robust worker date handling:** The ZIP worker now validates the incoming timestamp — accepting either an epoch number or an ISO string — and falls back gracefully if the value is unparseable.

### Version 4.2.0

- **Post Date Preservation on ZIP Entries:** Batch downloads now stamp each ZIP entry with the post's published timestamp. Extraction tools (7-Zip, WinRAR, Windows Explorer, Keka) restore this as the file's modification time, so comics and archives extract in reading order with correct dates.
- **Attachment Support:** Non-image, non-video files (`.clip`, `.psd`, `.zip`, `.pdf`, etc.) linked via `.post__attachment-link` are now collected, listed in the gallery with a file-type placeholder, and included in batch downloads.
- **Split Download Buttons:** `DL ALL` was split into three distinct buttons:
  - **DL ALL** — images (ZIP) plus videos and attachments (individual downloads).
  - **DL IMAGES** — images only, packaged as a ZIP.
  - **DL FILES** — videos and non-media attachments only, downloaded individually.
- **Filtered ZIP suffixes:** Batch downloads via `DL IMAGES` or `DL FILES` append `-images` / `-files` to the ZIP filename to prevent collisions when both are saved to the same folder.

### Version 4.1.1

- **Request Deduplication:** Concurrent fetches for the same URL within a session are now coalesced into a single network request.
- **Pawchive pacer hardening:** The request queue can no longer be silently bypassed by a rejected promise.
- **In-flight request cleanup:** Added a per-session request tracker that aborts outstanding `GM.xmlHttpRequest` handles when a navigation session is superseded.

### Version 4.1.0

- **Native Fullscreen Support:** Three fullscreen modes — **Native**, **CSS**, and **Ask each time** — configurable under Settings → General.
- **`f` keyboard shortcut** to toggle fullscreen.
- **Fullscreen state sync:** Toolbar button highlights during fullscreen; exiting via `Escape` or the browser UI cleanly restores gallery state.
- **Multi-option modal primitive:** `UGModal.choose()` for prompts requiring more than a binary decision.

### Version 4.0.1

- **Zero External UI Dependencies:** Removed jQuery, SweetAlert2, Dexie.js, and FileSaver.js in favor of native DOM, a built-in lightweight SVG modal system, and native IndexedDB.
- **Unified Pointer & Gesture Engine:** Replaced legacy mouse and touch listeners with Pointer Events — smooth multi-touch pinch zoom, double-tap zoom, and inertia panning.
- **Web Worker ZIP Archiving:** Offloaded JSZip compression and bundling to a dedicated background Worker.
- **Domain Expansion:** Added `.cr`, `.st`, and `.pw` mirrors across all supported sites.
- **Modern Navigation API Support:** Upgraded SPA routing handlers to use `window.navigation` alongside `popstate` and `pushState` fallbacks.
- **Sliding-Window Cache & Memory Management:** Automatic blob URL cleanup for adjacent preload windows.
- **Enhanced Settings Customization:** Custom button labels, individual button visibility toggles, and JSON settings import/export.

## Known Bugs

- If styles ever fail to appear after an update, force-refresh the page once so your script manager re-injects the latest resource bundle.
- When updating the CSS on a `@resource` tag, jsDelivr's CDN and your userscript manager's local cache may both hold stale copies. Use a **tagged release** (e.g. `@v4.3.1`) rather than a branch ref to avoid this entirely; branches are cached for 12 hours at every edge node, tags are immutable.

## Usage

After installation, navigate to a post on `kemono.su`, `coomer.su`, `nekohouse.su`, `pawchive.st`, or any supported mirror. You'll see new buttons injected into the post actions area for resizing and downloading media.

- Use **DL ALL** to download everything as a single ZIP. Use **DL IMAGES** or **DL FILES** if you only want a subset.
- The **GALLERY** button opens the immersive gallery view. Alternatively, press the configured gallery hotkey (default `g`) to open it quickly.
- **⚙️ Settings** opens the configuration menu. Tabs include:
  - **General** — animations, thumbnail strip, notifications, fullscreen mode, image loading.
  - **Gallery Viewer** — navigation, zoom & pan, slideshow.
  - **Downloads** — timestamp preservation, persistent caching, file naming patterns.
  - **Post Actions** — show/hide the global action-bar buttons.
  - **Thumbnails** — show/hide per-image buttons.
  - **Button Labels** — customize every button's text.
  - **Keyboard** — rebind shortcut keys.
  - **Advanced** — export, import, or reset all settings.

Within the gallery view:

- Click any thumbnail in the bottom strip to view it.
- Navigate using the `k` (previous) and `l` (next) keys, the arrow keys, or the on-screen navigation buttons.
- To zoom in, use the mouse wheel, toolbar buttons, or double-click / double-tap the image.
- When zoomed in, click and drag (or drag on touchscreens) to pan with momentum inertia.
- On mobile devices, use pinch gestures to zoom and swipe to pan.
- Press `Space` to start or pause the slideshow.
- Press `f` to toggle fullscreen.
- Press `Escape` to exit fullscreen (if active) or close the gallery.
- Right-click thumbnails to open context options (open, download, copy URL, remove).

### Keyboard Shortcuts

| Key         | Action                               |
| ----------- | ------------------------------------ |
| `g`         | Open / close the gallery view        |
| `k` / `←`   | Previous image                       |
| `l` / `→`   | Next image                           |
| `Home`      | Jump to first image                  |
| `End`       | Jump to last image                   |
| `Space`     | Start / pause slideshow              |
| `+` / `=`   | Zoom in                              |
| `-`         | Zoom out                             |
| `0`         | Reset zoom & pan                     |
| `f`         | Toggle fullscreen                    |
| `Escape`    | Exit fullscreen, or close gallery    |

All shortcut keys (except the fixed ones like `Escape`, `+`, `-`, `0`, and `f`) are rebindable in Settings → Keyboard.

## Dependencies

- [JSZip](https://stuk.github.io/jszip/) — v3.10.2

## Acknowledgments

- Original concept based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) by ntf.
- Maintained and modernized by [Meri/TearTyr](https://github.com/TearTyr).

## Version

Current version: **4.3.1**
