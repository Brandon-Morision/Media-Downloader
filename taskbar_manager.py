"""
taskbar_manager.py
------------------
Manages Windows 7/10/11 Taskbar Progress and state (ITaskbarList3) via COM.
Provides live green, yellow, red, and marquee progress bars directly on
the NovaDrop taskbar icon.
"""

import os
import sys
import ctypes
from ctypes import wintypes, c_ulonglong, c_int, c_void_p, POINTER, byref
from logger import get_logger

logger = get_logger(__name__)

# Windows TBPFLAG constants
TBPF_NOPROGRESS    = 0x0  # Clears progress bar
TBPF_INDETERMINATE = 0x1  # Pulsing marquee (analyzing/preparing)
TBPF_NORMAL        = 0x2  # Standard green progress
TBPF_ERROR         = 0x4  # Red bar (download failed)
TBPF_PAUSED        = 0x8  # Yellow bar (download paused)


class TaskbarManager:
    def __init__(self):
        self._taskbar = None
        self._hwnd = None
        self._initialized = False
        self._current_state = TBPF_NOPROGRESS
        self._current_percent = 0
        if os.name == "nt":
            self._init_com()

    def _init_com(self):
        try:
            ctypes.windll.ole32.CoInitialize(None)

            CLSID_TaskbarList = (ctypes.c_byte * 16)(
                0x44, 0xf3, 0xfd, 0x56, 0x6d, 0xfd, 0xd0, 0x11,
                0x95, 0x8a, 0x00, 0x60, 0x97, 0xc9, 0xa0, 0x90
            )
            IID_ITaskbarList3 = (ctypes.c_byte * 16)(
                0x91, 0xfb, 0x1a, 0xea, 0x28, 0x9e, 0x86, 0x4b,
                0x90, 0xe9, 0x9e, 0x9f, 0x8a, 0x5e, 0xef, 0xaf
            )

            taskbar_ptr = c_void_p()
            hr = ctypes.windll.ole32.CoCreateInstance(
                ctypes.cast(CLSID_TaskbarList, c_void_p),
                None,
                1,  # CLSCTX_INPROC_SERVER
                ctypes.cast(IID_ITaskbarList3, c_void_p),
                byref(taskbar_ptr)
            )
            if hr == 0 and taskbar_ptr.value:
                self._taskbar = taskbar_ptr.value
                self._initialized = True
                logger.info("ITaskbarList3 COM interface initialized successfully")
        except Exception as e:
            logger.debug(f"Failed to initialize TaskbarManager: {e}")

    def set_hwnd(self, hwnd):
        if hwnd:
            self._hwnd = hwnd
            logger.debug(f"TaskbarManager bound to HWND: {hwnd}")

    def _find_hwnd(self):
        if self._hwnd:
            return self._hwnd
        try:
            user32 = ctypes.windll.user32
            user32.FindWindowW.restype = c_void_p
            hwnd = user32.FindWindowW(None, "NovaDrop")
            if not hwnd:
                hwnd = user32.FindWindowW(None, "Media Downloader")
            if hwnd:
                self._hwnd = hwnd
            return hwnd
        except Exception:
            return None

    def set_progress(self, completed: float, total: float = 100, state: str = "normal"):
        """
        Update the taskbar progress bar.
        completed: 0 to total (percentage or byte count)
        total: default 100
        state: 'normal' (green), 'paused' (yellow), 'error' (red),
               'indeterminate' (marquee), 'none' (clear)
        """
        if not self._initialized or not self._taskbar:
            return

        hwnd = self._find_hwnd()
        if not hwnd:
            return

        state_map = {
            "normal": TBPF_NORMAL,
            "paused": TBPF_PAUSED,
            "error": TBPF_ERROR,
            "indeterminate": TBPF_INDETERMINATE,
            "none": TBPF_NOPROGRESS,
        }
        flag = state_map.get(str(state).lower(), TBPF_NORMAL)

        try:
            vtable = ctypes.cast(self._taskbar, POINTER(c_void_p))[0]
            vtbl_funcs = ctypes.cast(vtable, POINTER(c_void_p))

            SetProgressValue = ctypes.WINFUNCTYPE(c_int, c_void_p, c_void_p, c_ulonglong, c_ulonglong)(vtbl_funcs[9])
            SetProgressState = ctypes.WINFUNCTYPE(c_int, c_void_p, c_void_p, c_int)(vtbl_funcs[10])

            SetProgressState(self._taskbar, hwnd, flag)
            if flag not in (TBPF_NOPROGRESS, TBPF_INDETERMINATE):
                safe_completed = max(0, min(int(completed), int(total)))
                SetProgressValue(self._taskbar, hwnd, safe_completed, int(total))

            self._current_state = flag
            self._current_percent = completed
        except Exception as e:
            logger.debug(f"Error updating taskbar progress: {e}")

    def clear(self):
        """Clear taskbar progress bar."""
        self.set_progress(0, 100, state="none")


taskbar = TaskbarManager()
