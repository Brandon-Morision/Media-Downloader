# Building the Windows app

This produces a standalone Windows desktop build of Media Downloader with
gallery-dl and yt-dlp bundled — the end user doesn't need Python, pip, or
either tool installed separately.

## Version Management

The project uses centralized version management via `version.py`. All version
information is maintained in a single location and synchronized across:

- Desktop application (`version.py`)
- Browser extension (`browser_extension/manifest.json`)
- Windows installer (`installer.iss`)

To update the version across all files:

```bash
python update_version.py <new_version>
```

Example:
```bash
python update_version.py 0.3.0
```

This ensures consistent versioning across all components.

## Prerequisites (on a Windows machine)

PyInstaller does not cross-compile. You must run this build **on
Windows** — building from macOS/Linux produces a Mac/Linux binary, not a
`.exe`, regardless of what target OS you tell it. If you're on a
different OS day-to-day, use a Windows VM or a Windows CI runner (GitHub
Actions' `windows-latest` works well for this).

1. Python 3.10+ installed on Windows
2. `pip install -r requirements.txt` (installs pywebview, psutil, pyinstaller, Pillow)
3. The WebView2 Runtime — pywebview's default Windows renderer is Microsoft
   Edge WebView2. It ships built-in on Windows 11 and on updated Windows
   10, but isn't guaranteed on older/locked-down machines. If you need to
   support those, either:
   - bundle the
     [Evergreen Bootstrapper](https://developer.microsoft.com/microsoft-edge/webview2/)
     and run it silently from a first-run check, or
   - have your installer depend on it (Inno Setup has a WebView2
     dependency snippet in its examples).
   pywebview falls back to the older MSHTML/IE11 renderer if WebView2
   isn't present, but the UI in `index.html` uses modern CSS/JS that
   won't render correctly there — don't rely on that fallback.

## Step 1 — Get the tool binaries

Download the **standalone Windows executables** (not the pip packages —
those need a Python interpreter, which defeats the point of bundling) and
place them here:

```
build_assets/tools/gallery-dl.exe
build_assets/tools/yt-dlp.exe
```

**yt-dlp** is still straightforward — GitHub remains its canonical release
location:
- https://github.com/yt-dlp/yt-dlp/releases/latest
- → grab `yt-dlp.exe` from the assets (not `yt-dlp_x86.exe`/`yt-dlp_macos`/etc
  unless you specifically need those variants)

**gallery-dl is different, and this is worth knowing about explicitly.**
The project moved active development and releases over to Codeberg, so
https://github.com/mikf/gallery-dl/releases/latest now only has **source
code archives** (`.zip` / `.tar.gz`) — no `.exe` at all. That's exactly
the zip you ran into. The actual Windows binary now lives in one of two
places instead:

- **Stable releases (recommended):**
  https://codeberg.org/mikf/gallery-dl/releases
  → look for `gallery-dl_x86.exe` (despite the name, this is the regular
  64-bit-compatible Windows build — gallery-dl ships one universal x86
  build rather than separate x86/x64 binaries) in the assets for the
  version you want.
- **Nightly builds** (built from the latest commit, daily): a separate
  repo, https://github.com/gdl-org/builds/releases — useful if you need
  a fix that hasn't reached a stable tag yet, but less predictable since
  it changes daily. Prefer the Codeberg stable release unless you have a
  specific reason not to.

Either way, rename whatever you download to plain `gallery-dl.exe` before
placing it in `build_assets/tools/` — `resolve_tool_path()` in
`media_downloader.py` looks for that exact filename.

**Pin versions deliberately.** Don't script this download step to always
grab "latest" — both projects ship frequent updates (sites change their
HTML/APIs constantly, which is what most gallery-dl/yt-dlp releases are
fixing). Pick a version, test it, record the version number somewhere
(e.g. in your release notes), and only bump it intentionally. Grabbing
"latest" automatically at build time means your build is silently
different every time you run it, which makes bugs hard to reproduce.

`build_windows.py` checks for the files but never downloads them for you,
on purpose — see the comment in `check_bundled_tools()`.

## Step 2 — (Optional) Add an icon

Drop a `.ico` file at `build_assets/icon.ico`. If absent, the build just
uses PyInstaller's default icon — the spec checks for the file and skips
`icon=` entirely if it's missing, so this step is optional, not required.

**Important**: The icon file must use BMP-only format (no PNG compression)
for PyInstaller to embed it correctly. If you have a PNG or other image format,
convert it using the provided icon manager:

```bash
python icon_manager.py create --source your_image.png --output build_assets/icon.ico
```

This creates a Windows-compatible .ico file with all standard sizes (16, 32, 48, 64, 128, 256)
in BMP format, which PyInstaller can embed properly.

To verify the icon is embedded correctly after building:

```bash
python icon_manager.py verify
```

If PyInstaller fails to embed the icon (known issue with some versions), you can
manually embed it using:

```bash
python icon_manager.py embed
```

This will try available tools (rcedit, Resource Hacker) to embed the icon into
the built executable.

## Step 3 — Build

```
python build_windows.py
```

This runs `pyinstaller MediaDownloader.spec` after checking that the
tool binaries and required Python packages are present. Output lands in:

```
dist/MediaDownloader/
├── MediaDownloader.exe
├── index.html
├── tools/
│   ├── gallery-dl.exe
│   └── yt-dlp.exe
└── _internal/              <- PyInstaller's runtime support files
```

Hand the whole `MediaDownloader` folder to users, or wrap it with an
installer (see below). Don't ship just the `.exe` on its own — it needs
`index.html`, `tools/`, and `_internal/` sitting next to it.

## Why `--onedir`, not `--onefile`

The spec builds in `--onedir` mode (PyInstaller's default), not
`--onefile`. Three reasons:

1. `--onefile` self-extracts to a temp directory on *every launch*,
   which is slower to start and means there's no stable "next to the
   exe" location for `tools/` to live — `resolve_tool_path()` in
   `media_downloader.py` expects a `tools/` folder beside the running
   exe, which only holds still in onedir mode.
2. Self-extracting executables trip antivirus/SmartScreen heuristics
   more often than a plain folder of files, since "drops files to a temp
   dir and executes them" is also what a lot of malware does.
3. Older PyInstaller `--onefile` builds had a real local-privilege-
   escalation CVE tied to insecure temp-directory permissions on
   Windows (CVE-2019-16784) — fixed in modern PyInstaller, but it's
   another reason onedir is the simpler, lower-risk default.

## Code signing & SmartScreen

An unsigned `.exe` will trigger a Windows SmartScreen warning
("Windows protected your PC") the first time anyone runs it. This isn't
a bug in the build — it's how Windows treats any executable without a
trusted code-signing certificate, regardless of what tool produced it.
Options, in order of effort:

- Do nothing — users click "More info" → "Run anyway". Fine for personal
  use or a small trusted audience; not fine for wide distribution.
- Get an Authenticode code-signing certificate (DigiCert, Sectigo, etc.,
  roughly $100–400/year) and sign the exe with `signtool.exe` (ships with
  the Windows SDK) as a post-build step.
- Build up SmartScreen reputation over time by distributing signed builds
  consistently — Microsoft's reputation system reduces warnings for
  certificates/binaries it's seen distributed widely without complaints.

## Packaging as an installer (optional but recommended)

A raw `dist/MediaDownloader/` folder works (zip it, users unzip and run
the exe), but a proper installer is friendlier: Start Menu shortcut,
uninstaller entry in "Apps & Features", and a clean install location.

[Inno Setup](https://jrsoftware.org/isinfo.php) is the common free choice
for PyInstaller apps on Windows. A minimal `.iss` script just needs to:

```iss
[Files]
Source: "dist\MediaDownloader\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\Media Downloader"; Filename: "{app}\MediaDownloader.exe"
```

Not included here since it's a separate build step with its own tool
dependency (Inno Setup itself) — add this once the raw onedir build is
confirmed working.

## Testing the build

After building, **don't just run it from the `dist/` folder in place** —
copy `dist/MediaDownloader/` to a completely different path (e.g.
Desktop, or a different drive) first, then run `MediaDownloader.exe` from
there. This catches accidental absolute-path assumptions that work by
coincidence when run next to the build tree but break once installed
somewhere else on a user's machine.

Checklist:
- [ ] App launches, window shows the UI
- [ ] Paste a URL, generate a command — preview renders correctly
- [ ] Start a real download — confirm it actually uses the bundled
      `tools\gallery-dl.exe` / `tools\yt-dlp.exe` (check Task Manager for
      the process, or temporarily rename your system PATH copies if you
      have any, to make sure it's not silently falling back to those)
- [ ] Pause / Resume / Cancel work on a real in-progress download
- [ ] Folder picker opens and sets the output directory
- [ ] Closing the window mid-download doesn't leave an orphaned process
      running in Task Manager
