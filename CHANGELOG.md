# Change Log

All notable changes to the "ahhong-markdown-style" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

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
