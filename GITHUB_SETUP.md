# GitHub Setup and Release Guide

This guide will help you set up GitHub for your Media Downloader project and create a release with the executable for distribution.

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Fill in the repository details:
   - **Repository name**: `MediaDownloader`
   - **Description**: `Windows desktop application for downloading media from various websites using gallery-dl and yt-dlp`
   - **Visibility**: Choose Public or Private as you prefer
   - **Don't** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

## Step 2: Push Your Code to GitHub

Once you've created the repository, GitHub will show you instructions. Here are the commands you need to run:

```bash
# Add the remote repository (replace with your repository URL)
git remote add origin https://github.com/Brandon-Morision/MediaDownloader.git

# Rename the default branch to main (optional but recommended)
git branch -M main

# Push your code to GitHub
git push -u origin main
```

**Note**: Replace `Brandon-Morision` with your actual GitHub username in the URL above.

## Step 3: Package the Executable for Release

The executable is already built in `dist/MediaDownloader/`. Let's create a compressed archive for easy distribution:

```bash
# Create a zip file of the distribution
Compress-Archive -Path dist\MediaDownloader -DestinationPath MediaDownloader-v0.2.3.zip
```

This will create `MediaDownloader-v0.2.3.zip` in your project directory.

## Step 4: Create GitHub Release

### Option A: Using GitHub Web Interface (Recommended)

1. Go to your repository on GitHub
2. Click on "Releases" in the right sidebar
3. Click "Create a new release"
4. Fill in the release details:
   - **Tag version**: `v0.2.3`
   - **Release title**: `Media Downloader v0.2.3`
   - **Description**: 
     ```
     ## Media Downloader v0.2.3
     
     Complete Windows desktop application for downloading media from various websites.
     
     ### Features
     - Multi-site support (YouTube, Reddit, Twitter, Instagram, Pixiv, etc.)
     - Browser extension integration for Chrome/Edge
     - Modern web-based UI with PyWebView
     - Download management (pause, resume, cancel)
     - Built-in media player and download history
     - Batch downloads for galleries and playlists
     
     ### Installation
     1. Download `MediaDownloader-v0.2.3.zip`
     2. Extract to a folder on your computer
     3. Run `MediaDownloader.exe`
     
     ### Requirements
     - Windows 10 or later
     - Microsoft Edge WebView2 Runtime (usually pre-installed)
     
     ### Recent Improvements
     - Centralized dependency management
     - Unified icon handling
     - Comprehensive logging framework
     - Robust input validation
     - Automated version synchronization
     ```
5. Attach the zip file:
   - Click "Attach binaries"
   - Select `MediaDownloader-v0.2.3.zip`
6. Click "Publish release"

### Option B: Using GitHub CLI (If Installed)

If you install GitHub CLI (`gh`), you can create releases from the command line:

```bash
# Install GitHub CLI from https://cli.github.com/

# Login to GitHub
gh auth login

# Create the release
gh release create v0.2.3 \
  --title "Media Downloader v0.2.3" \
  --notes "Media Downloader v0.2.3 - Complete Windows desktop application for downloading media" \
  MediaDownloader-v0.2.3.zip
```

## Step 5: Update Browser Extension (Optional)

If you want to distribute the browser extension separately:

1. Create a zip of the extension folder:
   ```bash
   Compress-Archive -Path browser_extension -DestinationPath MediaDownloader-Extension-v0.2.3.zip
   ```

2. Upload this as an additional asset in your GitHub release

## Step 6: Test the Release

1. Download the zip file from your GitHub release
2. Extract it to a test location
3. Run `MediaDownloader.exe`
4. Test the basic functionality:
   - Application launches correctly
   - Can paste a URL and generate a command
   - Browser extension can connect (if installed)

## Step 7: Share Your Release

Once your release is published, you can share the URL with users. The URL will be in the format:
```
https://github.com/Brandon-Morision/MediaDownloader/releases/tag/v0.2.3
```

## Future Updates

When you want to release a new version:

1. Update the version in `version.py`:
   ```bash
   python update_version.py 0.3.0
   ```

2. Rebuild the application:
   ```bash
   python build_windows.py
   ```

3. Create a new zip file:
   ```bash
   Compress-Archive -Path dist\MediaDownloader -DestinationPath MediaDownloader-v0.3.0.zip
   ```

4. Commit and push changes:
   ```bash
   git add .
   git commit -m "Release v0.3.0"
   git push
   ```

5. Create a new GitHub release with the new zip file

## Troubleshooting

### Git Push Issues
If you get authentication errors, you may need to use a personal access token:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` permissions
3. Use the token as your password when pushing

### Large File Issues
If your executable is too large for GitHub (there's a 100MB limit for individual files), consider:
- Using GitHub Releases (which has larger limits)
- Using a separate file hosting service
- Creating an installer using Inno Setup to reduce size

### WebView2 Runtime Issues
Some users may not have WebView2 installed. Consider:
- Adding a link to WebView2 download in your release notes
- Including the WebView2 bootstrapper in your distribution
- Using Inno Setup to check for and install WebView2

## Additional Resources

- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [GitHub CLI Documentation](https://cli.github.com/)
- [Inno Setup Documentation](https://jrsoftware.org/isinfo.php)

---

## Quick Reference Commands

```bash
# Rebuild application
python build_windows.py

# Create distribution zip
Compress-Archive -Path dist\MediaDownloader -DestinationPath MediaDownloader-v0.2.3.zip

# Update version
python update_version.py 0.3.0

# Commit changes
git add .
git commit -m "Release v0.3.0"
git push

# View log file location
python -c "from logger import get_log_file_path; print(get_log_file_path())"
```

Good luck with your release! 🚀