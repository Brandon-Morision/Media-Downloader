"""
window_effects.py
-----------------
Applies Windows 11 DWM (Desktop Window Manager) attributes:
- Immersive Dark Mode titlebar and frame (DWMWA_USE_IMMERSIVE_DARK_MODE)
- Seamless dark caption background matching NovaDrop (#090a0f)
- Custom text color for caption
- System backdrop material (Mica / Mica Alt / Acrylic)
- Fluent rounded window corners (DWMWA_WINDOW_CORNER_PREFERENCE)
"""

import os
import sys
import ctypes
from ctypes import wintypes, c_int, byref
from logger import get_logger

logger = get_logger(__name__)

# DWM Window Attributes
DWMWA_USE_IMMERSIVE_DARK_MODE   = 20
DWMWA_WINDOW_CORNER_PREFERENCE   = 33
DWMWA_BORDER_COLOR              = 34
DWMWA_CAPTION_COLOR             = 35
DWMWA_TEXT_COLOR                = 36
DWMWA_SYSTEMBACKDROP_TYPE       = 38

# Corner preferences
DWMWCP_DEFAULT    = 0
DWMWCP_DONOTROUND = 1
DWMWCP_ROUND      = 2
DWMWCP_ROUNDSMALL = 3

# Backdrop types
DWMSBT_AUTO       = 0
DWMSBT_NONE       = 1
DWMSBT_MICA       = 2
DWMSBT_ACRYLIC    = 3
DWMSBT_MICA_ALT   = 4


def hex_to_colorref(hex_str: str) -> int:
    """Convert hex string (e.g. '#090a0f') to Win32 COLORREF (0x00BBGGRR)."""
    h = hex_str.lstrip("#")
    if len(h) == 6:
        r = int(h[0:2], 16)
        g = int(h[2:4], 16)
        b = int(h[4:6], 16)
        return (b << 16) | (g << 8) | r
    return 0


class WindowEffects:
    def __init__(self):
        self._dwmapi = None
        self._set_attr = None
        if os.name == "nt":
            try:
                self._dwmapi = ctypes.windll.dwmapi
                self._set_attr = self._dwmapi.DwmSetWindowAttribute
                self._set_attr.argtypes = [wintypes.HWND, wintypes.DWORD, wintypes.LPCVOID, wintypes.DWORD]
                self._set_attr.restype = wintypes.HRESULT
            except Exception as e:
                logger.debug(f"Failed to load dwmapi: {e}")

    def apply_fluent_effects(self, hwnd, caption_hex: str = "#090a0f", backdrop: str = "mica"):
        """
        Apply complete modern Windows 11 styling to the specified window HWND.
        """
        if not self._set_attr or not hwnd:
            return

        try:
            # 1. Immersive Dark Mode (Windows 10 20H1+ and Windows 11)
            dark_mode = c_int(1)
            self._set_attr(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, byref(dark_mode), ctypes.sizeof(dark_mode))

            # 2. Rounded Window Corners (Windows 11)
            round_corners = c_int(DWMWCP_ROUND)
            self._set_attr(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, byref(round_corners), ctypes.sizeof(round_corners))

            # 3. Caption Color matching NovaDrop dark palette (Windows 11 build 22000+)
            caption_color = c_int(hex_to_colorref(caption_hex))
            self._set_attr(hwnd, DWMWA_CAPTION_COLOR, byref(caption_color), ctypes.sizeof(caption_color))

            # 4. Light Caption Text (Windows 11 build 22000+)
            text_color = c_int(0x00FFFFFF)
            self._set_attr(hwnd, DWMWA_TEXT_COLOR, byref(text_color), ctypes.sizeof(text_color))

            # 5. System Backdrop Type (Mica / Mica Alt / Acrylic) (Windows 11 build 22621+)
            backdrop_map = {
                "auto": DWMSBT_AUTO,
                "none": DWMSBT_NONE,
                "mica": DWMSBT_MICA,
                "acrylic": DWMSBT_ACRYLIC,
                "mica_alt": DWMSBT_MICA_ALT,
            }
            sbt_val = backdrop_map.get(backdrop.lower(), DWMSBT_MICA)
            backdrop_attr = c_int(sbt_val)
            self._set_attr(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, byref(backdrop_attr), ctypes.sizeof(backdrop_attr))

            logger.info(f"Applied Windows 11 DWM effects (dark mode, caption {caption_hex}, backdrop {backdrop}) to HWND {hwnd}")
        except Exception as e:
            logger.debug(f"Failed to apply window effects: {e}")


window_effects = WindowEffects()
