# Change Log

All notable changes to the "ahhong-markdown-style" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.5] - 2026-08-20

### Changed

- Replaced the `click` event handler on TOC links with `mousedown` (left-button) and `contextmenu` handlers to prevent VS Code's built-in click handler from interfering with in-page navigation.
- TOC panel now auto-collapses after selecting a heading.
- Removed `history.replaceState` call from the navigation handler to avoid polluting the browser history.

## [0.0.4] - 2026-08-18
### Changed

- Changed inline code text in Markdown previews to red.

## [0.0.3] - 2026-08-15

### Added

- Added a collapsible Floating TOC with persistent position and height.
- Added Pointer Events support for dragging and resizing.
- Added DOM behavior tests for TOC lifecycle, navigation, gestures, and heading indexing.

### Changed

- Reworked the Floating TOC to retain a stable shell while refreshing headings.
- Improved heading ID generation, duplicate handling, and Active Heading selection.
- Updated the H1-H6 heading and TOC color palette.

### Fixed

- Prevented the Floating TOC toggle button from drifting after repeated clicks.
- Prevented event listener duplication during Markdown preview updates.
