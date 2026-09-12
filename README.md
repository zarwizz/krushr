# Krushr

A lightweight, privacy-first desktop application designed for fast, high-quality image compression, batch format conversion, and smart resizing. Built with Tauri v2, a native multithreaded Rust processing engine, and an ultra-dense TypeScript/Tailwind CSS interface.

---

## Highlights

* **100% Local & Private:** All processing happens entirely in-memory on your machine. Zero telemetry, no cloud uploads, no subscriptions, and zero data collection.
* **Blazing Fast Native Engine:** Multithreaded Rust pipeline leveraging SIMD and NASM-optimized routines for high-throughput batch processing.
* **Broad Ingestion Support:** Import and decode virtually any raster format (JPG, PNG, WebP, AVIF, HEIC, BMP, TIFF, GIF, ICO) and clean vector assets (SVG).
* **Modern Web Export Matrix:** Convert batches directly into ultra-optimized modern distribution formats (**WebP**, **AVIF**, **PNG**, **JPG**).
* **Precision Constraints:** Target specific file sizes via iterative binary search convergence, fine-tune lossy/lossless quality ratios, and preserve optical fidelity.
* **Smart Resizing Engine:** Aspect-ratio-locked scaling modes (*Fit*, *Fill*, *Stretch*) with Lanczos3 resampling and strict no-upscale safeguards.
* **Privacy & Metadata Stripping:** Automatically purge EXIF, GPS location tags, and device fingerprints during compression.
* **Workflow Presets:** Built-in industry-standard profiles alongside persistent custom user configurations.
* **Refined Studio UX:** Dense, keyboard-friendly dark layout with native drag-and-drop, live queue status, and bilingual support (English / French).

---

## Roadmap

### Phase 1: Core Polish & Extended Formats (In Progress)
- [x] High-performance Tauri v2 + Rust compression pipeline
- [x] Studio two-column UI with native Windows tray & taskbar integration
- [x] EXIF stripping and dichotomous target-size search
- [ ] Direct export options for legacy/utility targets (`BMP`, `TIFF`, `ICO`, `GIF`)
- [ ] Native raster-to-vector tracing pipeline (Bitmap to `SVG`)

### Phase 2: Cross-Platform Expansion
- [ ] **macOS Support:** Universal binaries (`Apple Silicon` / `Intel x64`) with `.dmg` installer and notarization pipeline
- [ ] **Linux Support:** Distribution packages (`.deb`, `.AppImage`, and `Flatpak`) with system tray integration

### Phase 3: Power-User & Automation Capabilities
- [ ] **CLI Mode:** Headless execution (`krushr --input ./raw --format webp --quality 82`) for automated scripts and CI/CD pipelines
- [ ] **Folder Watcher:** Background daemon watching dedicated folders for automatic drop-and-compress execution
- [ ] **Visual Diff Inspector:** Split-screen slider comparing original vs compressed pixels with zoom synchronization