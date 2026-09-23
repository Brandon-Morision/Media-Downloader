# Media Downloader

A powerful Windows desktop application for downloading media from various websites using gallery-dl and yt-dlp, with a modern web-based UI and browser extension integration.

## Features

- **Multi-site Support**: Download from YouTube, Reddit, Twitter, Instagram, Pixiv, and many more
- **Browser Integration**: Chrome/Edge extension for one-click downloads
- **Modern UI**: Clean web-based interface built with PyWebView
- **Download Management**: Pause, resume, and cancel downloads
- **Built-in Media Player**: Preview downloaded content without external apps
- **Download History**: Track all your downloads with search and filtering
- **Batch Downloads**: Handle galleries and playlists efficiently

## Quick Start

### Prerequisites

- Windows 10 or later
- Python 3.10+ (for development)
- Microsoft Edge WebView2 Runtime (usually pre-installed on Windows 11/10)

### Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Download required tools:**
   Place these executables in `build_assets/tools/`:
   - `yt-dlp.exe` from [GitHub releases](https://github.com/yt-dlp/yt-dlp/releases/latest)
   - `gallery-dl.exe` from [Codeberg releases](https://codeberg.org/mikf/gallery-dl/releases)
   - `ffmpeg.exe` and `ffprobe.exe` from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)

4. **Run the application:**
   ```bash
   python app.py
   ```

### Building for Distribution

See [README_BUILD.md](README_BUILD.md) for detailed build instructions.

```bash
# Build the Windows executable
python build_windows.py

# Create the Windows installer (requires Inno Setup)
iscc installer.iss
```

The installer will be created in the `installer/` folder as `MediaDownloader Setup.exe`.

## Project Structure

```
MediaDownloader/
├── app.py                    # Main application entry point
├── media_downloader.py       # Core download logic
├── logger.py                 # Centralized logging
├── validators.py             # Input validation
├── version.py                # Version management
├── icon_manager.py           # Icon management
├── requirements.txt          # Python dependencies
├── build_windows.py          # Build script
├── browser_extension/        # Chrome/Edge extension
├── build_assets/             # Build resources (tools, icons)
└── installer.iss             # Inno Setup installer script
```

## Key Features

### Version Management
Version information is centralized in `version.py` and synchronized across all components:

```bash
# Update version across all files
python update_version.py 0.3.0
```

### Icon Management
Unified icon handling through `icon_manager.py`:

```bash
# Create Windows-compatible icon
python icon_manager.py create --source logo.png

# Verify icon embedding
python icon_manager.py verify

# Embed icon into executable
python icon_manager.py embed
```

### Logging
Comprehensive logging to `~/.media_downloader/logs/media_downloader.log` with automatic rotation.

### Input Validation
All API endpoints use robust input validation for security and reliability.

## Browser Extension

The browser extension automatically integrates with the desktop app:

1. Install the extension from the `browser_extension/` folder
2. Start the desktop app
3. Click the extension icon on any supported page
4. The URL is automatically sent to the desktop app

## Configuration

Download options include:
- Output directory selection
- Format selection (MP4, MP3, M4A, Best)
- Download limits
- Authentication support
- Custom filename templates
- Rate limiting

## Troubleshooting

### Icon Issues
If icons don't appear correctly:
```bash
python icon_manager.py verify
python icon_manager.py embed
```

### Build Issues
Ensure all dependencies are installed:
```bash
pip install -r requirements.txt
```

Check logs for detailed error information:
```bash
# View log file location
python -c "from logger import get_log_file_path; print(get_log_file_path())"
```

## Development

### Running Tests
```bash
# Test validators
python validators.py

# Test icon manager
python icon_manager.py --help

# Test version module
python version.py
```

### Code Quality
The project includes:
- Centralized logging via `logger.py`
- Input validation via `validators.py`
- Version management via `version.py`
- Comprehensive error handling

## Recent Improvements

See [CHANGES.md](CHANGES.md) for details on recent high-priority improvements:
- ✅ Centralized dependency management
- ✅ Unified icon handling
- ✅ Comprehensive logging framework
- ✅ Robust input validation
- ✅ Automated version synchronization

## License

This project is provided as-is for personal and educational use.

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Input validation is used for all user inputs
- Logging is added for significant operations
- Version updates use `update_version.py`

## Support

For issues and questions:
1. Check the logs in `~/.media_downloader/logs/`
2. Review [README_BUILD.md](README_BUILD.md) for build issues
3. See [CHANGES.md](CHANGES.md) for recent improvements

---

**Version:** 0.2.6
**Last Updated:** 2026-08-30
