# Ultra Galleries

**Ultra Galleries** is a powerful userscript that enhances the browsing and downloading experience on `kemono.su`, `coomer.su`, and `nekohouse.su` by adding features for image manipulation, viewing, and batch downloading. It was originally based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) but has been significantly expanded and improved.

## Overview

This userscript provides a seamless and efficient way to interact with image and video content on supported websites, making it easier to view, resize, download, and manage your favorite media.

## Features

### Image Viewing and Manipulation

- **Original Resolution Loading:** Directly loads images in their original resolution.
- **Resize Options:**
  - Toggle to resize individual or all images in a gallery to fit:
    - Vertical height (`FILL HEIGHT`)
    - Horizontal width (`FILL WIDTH`)
    - Full resolution (`FULL`)
- **Image Removal:** Option to remove individual images from the gallery view.
- **Gallery View:** New gallery view for easier browsing of images within a post.

### Downloading

- **Individual Image Download:** Download single images with a click.
- **Batch Downloading:** Download all images and videos from a post, packaged in a zip file.
- **Custom Naming:** Configurable naming patterns for zip files and individual images.
- **Multi-Site Support:** Accurately downloads assets from Kemono, Coomer, and Nekohouse by targeting the correct image URLs. 

### Performance and User Experience

- **Improved Image Loading:** Modified image loading mechanism to prevent rate-limiting issues.
- **Retry Mechanism:** Implements exponential backoff for failed image loads.
- **Status Updates:** Provides real-time status updates for image loading and download progress.

### Video Handling

- Includes video files in batch downloads.
- Preserves original video filenames.

### New Features (v2.3.0)

- **Multi-Site Support:** Enhanced support for `nekohouse.su`, including downloading assets and using the gallery view.
- **Improved Code Clarity:** Optimized code for better readability and maintainability.
- **Enhanced Error Handling:** Implemented robust error handling to prevent unexpected script behavior.

## Usage

After installation, navigate to a post on `kemono.su`, `coomer.su`, or `nekohouse.su`. You'll see new buttons for resizing, downloading, and removing images. Use the `DL ALL` button to initiate a batch download of all media in the post. The `GALLERY` button opens the new gallery view.

## Dependencies

- [jQuery](https://jquery.com/) (v3.6.0)
- [JSZip](https://stuk.github.io/jszip/) (v3.10.1)
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) (v2.0.5)
- [SweetAlert2](https://sweetalert2.github.io/) (v11)

## Installation

1. Ensure you have a userscript manager installed (e.g., Tampermonkey, Greasemonkey).
2. Visit the script's page on Sleazyfork (link to be provided).
3. Click on the installation button.

## Acknowledgments

- Original concept based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries)
- Uses [jQuery](https://jquery.com/), [JSZip](https://stuk.github.io/jszip/), [FileSaver.js](https://github.com/eligrey/FileSaver.js/), and [SweetAlert2](https://sweetalert2.github.io/)

## Version

Current version: 2.3.0
