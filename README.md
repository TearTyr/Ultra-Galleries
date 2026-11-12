# Ultra Galleries

A userscript that adds a full-screen gallery, resizing tools, and batch ZIP downloads to `kemono.su`, `coomer.su`, `nekohouse.su`, `pawchive.st` and their mirrors (`kemono.cr`, `coomer.cr`, `coomer.st`, `pawchive.pw`).

Originally based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries), since rewritten. It uses only native browser APIs: no jQuery, no SweetAlert2, no UI libraries.

## Installation

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Install the script from [Sleazy Fork](https://sleazyfork.org/en/scripts/537986-ultra-galleries), or directly from [GitHub](https://github.com/TearTyr/Ultra-Galleries/raw/main/Ultra-Galleries.js).
3. Open a post on any supported site.

Your script manager checks for updates automatically.

## Features

### Gallery

- **Original resolution:** Loads full-size images. Originals load only near the viewport and are freed when you scroll away, so memory stays flat on very large posts. Toggle **Auto-load Original Images** in Settings → General.
- **Immersive viewer:** Thumbnail strip with drag-to-scroll, hover previews and a right-click menu (open, download, copy URL, remove from gallery).
- **Thumbnail strip modes:** *Floating* layers the strip above the image and hides it with the controls, so fullscreen is truly fullscreen. *Docked* pins it to the bottom.
- **Zoom and pan:** Mouse wheel, toolbar buttons, double-click / double-tap, drag with inertia, and touch pinch.
- **Slideshow:** Adjustable delay, pause on hover. Waits for a playing video to finish.
- **Fullscreen:** Native browser fullscreen, in-page (CSS) expansion, or ask each time. Toggle with `f`.
- **Resize buttons:** `HEIGHT` (fit height), `WIDTH` (fit width) and `FULL` (original size), for the whole post or per image.
- **Sort order:** Site order or natural filename sort (A→Z / Z→A), so `page_10` comes after `page_9`. Useful for comic posts.

### Video and attachments

- **Video:** Plays inside the gallery with native controls, and is included in batch downloads. Original filenames are kept.
- **Attachments:** `.clip`, `.psd`, `.zip`, `.pdf` and any other downloadable file is collected, shown with a file-type placeholder, and downloadable from the gallery.

### Downloads

- **Individual download:** One click per image, video or file.
- **Batch buttons:**
  - **DL ALL:** one ZIP with every item in the post.
  - **DL IMAGES:** a ZIP of images only, in reading order (`…-images.zip`).
  - **DL FILES:** a ZIP of videos and attachments only (`…-files.zip`).
- **Streaming ZIP:** Files are zipped with [fflate](https://github.com/101arrowz/fflate) in STORE mode as they download. On Chromium browsers the ZIP streams straight to a file you choose, so large posts use little memory. There is no ZIP64: archives are capped just under 4 GiB, and larger ones stop with a clear error.
- **Date preservation:** Each ZIP entry carries the post's published date, so 7-Zip, WinRAR, Explorer and Keka restore the original modification time.
- **Custom naming:** Patterns for ZIP and image names using `{title}`, `{artistName}`, `{fileName}`, `{index}`, `{date_published}`, `{date_edited}`, `{date_imported}` and `{date}`.
- **Cancel:** Stops queued and retrying requests immediately. Navigating to another post does not abort a running download.

### Performance and reliability

- **Persistent cache:** Fetched images are stored in IndexedDB with LRU eviction. Downloads reuse images already in memory, then the cache, before using the network.
- **Request deduplication:** Concurrent requests for the same URL share one fetch.
- **Pawchive rate limits:** Requests to Pawchive hosts go through a 1 request/second pacer with a custom User-Agent. This includes video. Signed temporary links (`?e=…&s=…`) keep their signature.
- **SPA and HTMX safe:** Uses the Navigation API with history fallbacks and survives `hx-boost` page swaps. Pawchive's head cleanup does not remove the injected styles.
- **Safe fetching:** Media is only requested from the supported sites. Links in post text that point elsewhere are ignored.
- **Mobile and accessibility:** Touch gestures, focus-trapped dialogs, ARIA announcements, `:focus-visible` rings and `prefers-reduced-motion` support.

## Usage

On a post you will see a button bar with **GALLERY**, **HEIGHT**, **WIDTH**, **FULL**, **DL ALL**, **DL IMAGES**, **DL FILES** and **⚙️ Settings**. Open the gallery with the button or the `g` key. Click a thumbnail to view it.

### Keyboard shortcuts

| Key         | Action                            |
| ----------- | --------------------------------- |
| `g`         | Open / close the gallery          |
| `k` / `←`   | Previous image                    |
| `l` / `→`   | Next image                        |
| `Home`      | First image                       |
| `End`       | Last image                        |
| `Space`     | Start / pause slideshow           |
| `+` / `=`   | Zoom in                           |
| `-`         | Zoom out                          |
| `0`         | Reset zoom and pan                |
| `f`         | Toggle fullscreen                 |
| `?`         | Show help                         |
| `Escape`    | Exit fullscreen, or close gallery |

`g`, `k` and `l` can be rebound in Settings → Keyboard. The rest are fixed. Shortcuts are disabled while typing in an input.

### Settings

| Tab            | Contents                                                                       |
| -------------- | ------------------------------------------------------------------------------ |
| General        | Animations, thumbnail strip and mode, notifications, fullscreen, image loading |
| Gallery Viewer | Navigation arrows, zoom and pan, slideshow                                     |
| Downloads      | Date preservation, persistent cache, file naming                               |
| Sorting        | Media order                                                                    |
| Post Actions   | Show or hide the top action-bar buttons                                        |
| Thumbnails     | Show or hide the per-image buttons                                             |
| Button Labels  | Custom text for every button                                                   |
| Keyboard       | Rebind shortcuts                                                               |
| Advanced       | Export, import, or reset settings (JSON)                                       |

## Troubleshooting

- **No styles after an update:** Force-refresh the page once so your script manager re-fetches the stylesheet.
- **Save dialog appears before a ZIP:** Expected on Chromium. The ZIP streams directly to the file you pick.

## Changelog

### 4.5.2

- Pawchive signed temporary links keep their `?e=&s=` query. Stripping it caused 403 errors.
- Clicking a post image opens the gallery even though the site now binds its own click-to-expand.
- Restyled UI: amber accent on graphite, no glows, blur or hover lifts, sentence-case labels, lighter font weights.

### 4.5.1

- Only fetches media from supported sites.
- Navigating to another post no longer aborts a running ZIP. Cancel is immediate. Large files download one at a time. Archives over 4 GiB stop with an error instead of being written corrupt. Dismissing Save As no longer triggers a second download. Out-of-range post dates no longer break ZIP creation.
- "Remove from Gallery" is no longer undone by lazy loading. Arrow keys and Space work after clicking a thumbnail or button. The slideshow waits for videos.
- `#anchor` links no longer reload the post UI. "Auto-load Original Images" applies immediately.

### 4.5.0

- Lazy original loading near the viewport, freed when scrolled away.
- Downloads reuse in-memory and cached images before using the network.
- Turning animations off no longer affects the host site.
- Fixes: skipped images stop downloading, pinch-zoom state sync, settings focus.

### 4.3.x

- Post Actions and Thumbnails hide toggles are scoped separately, and now apply correctly on first render.
- Settings split into focused tabs with descriptions and dividers.
- Date fallback no longer stamps ZIP entries with the download time.

### 4.2.x

- ZIP entries carry the post's published date.
- Attachment support (`.clip`, `.psd`, `.zip`, `.pdf`, …).
- DL ALL split into DL ALL, DL IMAGES and DL FILES with distinct archive names.

### 4.1.x

- Native fullscreen (Native / CSS / Ask) and the `f` shortcut.
- Request deduplication, hardened Pawchive pacer, per-navigation request cancellation.

### 4.0.1

- Removed jQuery, SweetAlert2, Dexie and FileSaver in favor of native DOM and IndexedDB.
- Unified Pointer Events gesture engine.
- Added `.cr`, `.st` and `.pw` mirrors and Navigation API routing.
- Settings customization with JSON import/export.

## Dependencies

- [fflate](https://github.com/101arrowz/fflate) 0.8.2 (loaded via `@require`)

## Acknowledgments

- Original concept: [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) by ntf.
- Maintained and modernized by [Meri/TearTyr](https://github.com/TearTyr).
