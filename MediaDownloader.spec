# -*- mode: python ; coding: utf-8 -*-
"""
MediaDownloader.spec
---------------------
PyInstaller build spec for the Windows desktop build of Media Downloader.

Build with:
    pyinstaller MediaDownloader.spec

Output:
    dist/NovaDrop/NovaDrop.exe
    dist/NovaDrop/tools/gallery-dl.exe
    dist/NovaDrop/tools/yt-dlp.exe
    dist/NovaDrop/tools/ffmpeg.exe
    dist/NovaDrop/tools/ffprobe.exe
    dist/NovaDrop/...
"""

import os

block_cipher = None

# Directory this spec file lives in — used to build absolute paths so the
# spec works regardless of the cwd `pyinstaller` is invoked from.
SPEC_DIR = os.path.dirname(os.path.abspath(SPEC))

a = Analysis(
    ["app.py"],
    pathex=[SPEC_DIR],
    binaries=[],
    datas=[
        # (source, dest_dir_relative_to_bundle_root)
        # Modern React UI build bundle if present
        *([(os.path.join(SPEC_DIR, "frontend", "dist"), os.path.join("frontend", "dist"))] if os.path.isdir(os.path.join(SPEC_DIR, "frontend", "dist")) else []),
        # Brand icons and notification assets
        *([(os.path.join(SPEC_DIR, "icons"), "icons")] if os.path.isdir(os.path.join(SPEC_DIR, "icons")) else []),
        *([(os.path.join(SPEC_DIR, "build_assets", "icon.ico"), ".")] if os.path.isfile(os.path.join(SPEC_DIR, "build_assets", "icon.ico")) else []),
        # Bundled tool binaries. dest_dir "tools" matches what
        # media_downloader.resolve_tool_path() looks for next to the exe.
        (os.path.join(SPEC_DIR, "build_assets", "tools", "gallery-dl.exe"), "tools"),
        (os.path.join(SPEC_DIR, "build_assets", "tools", "yt-dlp.exe"),     "tools"),
        # ffmpeg and ffprobe are required for --embed-thumbnail to work in
        # m4a and mp3 downloads. resolve_ffmpeg_dir() in media_downloader.py
        # points yt-dlp at this folder via --ffmpeg-location automatically.
        (os.path.join(SPEC_DIR, "build_assets", "tools", "ffmpeg.exe"),     "tools"),
        (os.path.join(SPEC_DIR, "build_assets", "tools", "ffprobe.exe"),    "tools"),
    ],
    hiddenimports=[
        # pywebview picks its Windows renderer (WebView2/EdgeChromium by
        # default, falling back to MSHTML) at runtime via importlib;
        # PyInstaller's static analysis can miss that indirection on some
        # pywebview versions, so these are listed explicitly as a
        # belt-and-suspenders measure. Harmless no-ops if already found.
        "webview.platforms.edgechromium",
        "webview.platforms.mshtml",
        "webview.platforms.winforms",
        "clr_loader",
        "pythonnet",
        # psutil's Windows backend module name.
        "psutil._psutil_windows",
        # PIL/Pillow for dynamic icon and image operations in icon_manager.py
        "PIL",
        "PIL.Image",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # pywebview's freezing guide notes it pulls in every renderer
        # backend it can import, even unused ones (e.g. PyQt/PySide if
        # installed in the build env). Excluding these keeps the bundle
        # from ballooning if they happen to be present in the venv used
        # to build — harmless if they were never installed at all.
        "PyQt5", "PyQt6", "PySide2", "PySide6",
        "tkinter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

_icon_path = os.path.join(SPEC_DIR, "build_assets", "icon.ico")
icon_path = None
if not os.path.isfile(_icon_path):
    print(f"\n[WARNING] No icon found at {_icon_path}")
    print("          Building WITHOUT a custom icon — the exe will show")
    print("          Windows' generic program icon. See README_BUILD.md.\n")
else:
    with open(_icon_path, "rb") as _f:
        _header = _f.read(4)
    if _header[:2] != b"\x00\x00" or _header[2:4] != b"\x01\x00":
        print(f"\n[WARNING] {_icon_path} doesn't look like a valid .ico file")
        print("          (real .ico files start with bytes 00 00 01 00 — this")
        print("          one doesn't, which usually means a PNG/JPG got renamed")
        print("          to .ico instead of actually being converted).")
        print("          Building WITHOUT a custom icon as a result.\n")
    else:
        icon_path = _icon_path

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="NovaDrop",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX-compressed exes get flagged by some AV heuristics
    console=False,  # --noconsole / --windowed: this is a GUI app
    icon=icon_path,
    # PyInstaller 6.0+ defaults to a "contents directory" layout, moving
    # everything except the exe itself into NovaDrop/_internal/.
    # That breaks the "tools/ sits next to the exe" assumption baked into
    # media_downloader.resolve_tool_path(). '.' restores the pre-6.0
    # flat layout: everything lands directly beside NovaDrop.exe.
    contents_directory=".",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="NovaDrop",
)
