# Ultra Kemono Galleries

Ultra Kemono Galleries is an enhanced version of [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries) with improved image downloading features and additional functionality.

## Overview

This userscript enhances the browsing and downloading experience on kemono.su and coomer.su by adding various features for image manipulation, viewing, and batch downloading.

## Features

### Image Viewing and Manipulation

- **Original Resolution Loading:** Directly loads images in their original resolution.
- **Resize Options:**
  - Toggle to resize individual or all images in a gallery to fit:
    - Vertical height (`FILL HEIGHT`)
    - Horizontal width (`FILL WIDTH`)
    - Full resolution (`FULL`)
- **Image Removal:** Option to remove individual images from the gallery view.

### Downloading

- **Individual Image Download:** Download single images with a click.
- **Batch Downloading:** Download all images and videos from a post, packaged in a zip file.
- **Custom Naming:** Downloaded files are named using the artist's name, post title, and original filename.

### Performance and User Experience

- **Improved Image Loading:** Modified image loading mechanism to prevent rate-limiting issues.
- **Retry Mechanism:** Implements exponential backoff for failed image loads.
- **Status Updates:** Provides real-time status updates for image loading and download progress.

### Video Handling

- Includes video files in batch downloads.
- Preserves original video filenames.

## Usage

After installation, navigate to a post on kemono.su or coomer.su. You'll see new buttons for resizing, downloading, and removing images. Use the `DL ALL` button to initiate a batch download of all media in the post.

## Dependencies

- [jQuery](https://jquery.com/) (v2.2.4)
- [JSZip](https://stuk.github.io/jszip/) (v3.1.4)
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) (v1.3.2)

## Installation

1. Ensure you have a userscript manager installed (e.g., Tampermonkey, Greasemonkey).
2. Visit the script's page on Sleazyfork (link to be provided).
3. Click on the installation button.

## Acknowledgments

- Original concept based on [Better Kemono Galleries](https://sleazyfork.org/en/scripts/460064-better-kemono-galleries)
- Uses [jQuery](https://jquery.com/), [JSZip](https://stuk.github.io/jszip/), and [FileSaver.js](https://github.com/eligrey/FileSaver.js/)

## Version

Current version: 2.0.2
