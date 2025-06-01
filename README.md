# Ultra Galleries

**Ultra Galleries** is a powerful userscript that enhances the browsing and downloading experience on `kemono.su`, `coomer.su`, and `nekohouse.su` by adding features for image manipulation, viewing, and batch downloading. It was originally based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) but has been significantly expanded and improved.

## Overview

This userscript provides a seamless and efficient way to interact with image and video content on supported websites, making it easier to view, resize, download, and manage your favorite media.

## Features

### Image Viewing and Manipulation

- **Original Resolution Loading:** Directly loads images in their original resolution.
- **Resize Options:**
        -   Toggle to resize individual or all images in a gallery to fit:
        -   Vertical height (`FILL HEIGHT`)
        -   Horizontal width (`FILL WIDTH`)
        -   Full resolution (`FULL`)
- **Image Removal:** Option to remove individual images from the gallery view.
- **Gallery View:** New gallery view for easier browsing of images within a post.
- **Zoom & Pan:** Advanced zooming with mouse wheel, buttons, and double-click support, plus smooth panning capabilities.

### Video Handling

-   Includes video files in batch downloads.
-   Preserves original video filenames.

### Downloading

- **Individual Image Download:** Download single images with a click.
- **Batch Downloading:** Download all images and videos from a post, packaged in a zip file.
- **Custom Naming:** Configurable naming patterns for zip files and individual images.
- **Multi-Site Support:** Accurately downloads assets from Kemono, Coomer, and Nekohouse by targeting the correct image URLs.

### Performance and User Experience

- **Improved Image Loading:** Modified image loading mechanism to prevent rate-limiting issues.
- **Retry Mechanism:** Implements exponential backoff for failed image loads.
- **Status Updates:** Provides real-time status updates for image loading and download progress.
- **Mobile Support:** Touch-friendly interface with pinch-to-zoom and double-tap interactions.

## Version History

### Version 3.1.3 (Current)

- **Persistent Image Caching:** Option to enable persistent image caching using IndexedDB (Dexie.js) for significantly faster image loading on revisits to previously viewed posts.
- **PNG Optimization:** Optional PNG optimization during ZIP creation (using UPNG.js and Pako) to reduce file sizes for downloaded archives.

### Version 3.0.0

- **Enhanced Zoom Controls:** Improved zoom button visibility with color inversion for better accessibility against different backgrounds.
- **Advanced Zoom & Pan:** Smooth zoom functionality with mouse wheel, dedicated zoom buttons, and double-click support.
- **Touch Support:** Mobile-friendly interface with pinch-to-zoom, double-tap to zoom, and smooth touch panning for images.
- **Inertia Panning:** Momentum-based panning for smooth navigation of zoomed images.
- **Expanded Settings Panel:** New settings section for zoom and pan configuration including maximum zoom level and inertia preferences, as well as toggles for caching and PNG optimization.
- **Performance Improvements:** Optimized image handling for smoother operation and better memory management.

## Known Bugs

- Videos are not directly playable within the gallery's expanded view. Clicking a video thumbnail in the gallery grid may not open it correctly within the gallery, but will likely open in an external player.
- Certain UI elements or functionalities may appear broken or misaligned on `nekohouse.su`.

## Usage

After installation, navigate to a post on `kemono.su`, `coomer.su`, or `nekohouse.su`. You'll see new buttons for resizing, downloading, and removing images. Use the `DL ALL` button to initiate a batch download of all media in the post. The `GALLERY` button opens the new gallery view. Press the configured gallery key (default 'g') to quickly open the gallery.

**Within the gallery view, you can open an image or video in an expanded view by clicking on its thumbnail. Once in expanded view, navigate using the 'k' (previous) and 'l' (next) keys or the on-screen navigation buttons.**

**To zoom in on an image, use the mouse wheel, the zoom buttons in the toolbar, or double-click on the image. When zoomed in, click and drag to pan around the image. On mobile devices, use pinch gestures to zoom and swipe to pan.**

## Dependencies

-   [jQuery](https://jquery.com/) (v3.6.0)
-   [JSZip](https://stuk.github.io/jszip/) (v3.9.1)
-   [FileSaver.js](https://github.com/eligrey/FileSaver.js/) (v1.3.2)
-   [SweetAlert2](https://sweetalert2.github.io/) (v11)
-   [Dexie.js](https://dexie.org/) (v3.2.7)
-   [UPNG.js](https://github.com/photopea/UPNG.js) (v2.1.0)
-   [Pako](https://github.com/nodeca/pako) (v2.1.0)

## Acknowledgments

-   Original concept based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries)
-   Uses [jQuery](https://jquery.com/), [JSZip](https://stuk.github.io/jszip/), [FileSaver.js](https://github.com/eligrey/FileSaver.js/), [SweetAlert2](https://sweetalert2.github.io/), [Dexie.js](https://dexie.org/), [UPNG.js](https://github.com/photopea/UPNG.js), and [Pako](https://github.com/nodeca/pako).

## Version

Current version: 3.1.3