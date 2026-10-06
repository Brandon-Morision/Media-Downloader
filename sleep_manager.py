"""
sleep_manager.py
----------------
Prevents Windows from entering sleep or standby during active media downloads
using SetThreadExecutionState (ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED).
Automatically restores normal power policy when downloads finish.
"""

import os
import sys
import ctypes
from ctypes import wintypes
from logger import get_logger

logger = get_logger(__name__)

# Windows Execution State Flags
ES_SYSTEM_REQUIRED  = 0x00000001
ES_DISPLAY_REQUIRED = 0x00000002
ES_AWAYMODE_REQUIRED = 0x00000040
ES_CONTINUOUS       = 0x80000000


class SleepManager:
    def __init__(self):
        self._preventing = False
        self._enabled = True
        self._kernel32 = None

        if os.name == "nt":
            try:
                self._kernel32 = ctypes.windll.kernel32
                self._kernel32.SetThreadExecutionState.argtypes = [wintypes.DWORD]
                self._kernel32.SetThreadExecutionState.restype = wintypes.DWORD
            except Exception as e:
                logger.debug(f"SleepManager init error: {e}")

    def set_enabled(self, enabled: bool):
        self._enabled = bool(enabled)
        if not self._enabled and self._preventing:
            self.restore_sleep()

    def is_preventing(self) -> bool:
        return self._preventing

    def prevent_sleep(self):
        """Prevent Windows from entering sleep while downloads are ongoing."""
        if not self._enabled or not self._kernel32:
            return

        if not self._preventing:
            try:
                flags = ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED
                prev = self._kernel32.SetThreadExecutionState(flags)
                self._preventing = True
                logger.info("System sleep prevention activated (downloads in progress)")
            except Exception as e:
                logger.debug(f"Failed to set execution state: {e}")

    def restore_sleep(self):
        """Restore normal Windows sleep policy when downloads complete."""
        if not self._kernel32 or not self._preventing:
            return

        try:
            self._kernel32.SetThreadExecutionState(ES_CONTINUOUS)
            self._preventing = False
            logger.info("System sleep prevention released (normal power policy restored)")
        except Exception as e:
            logger.debug(f"Failed to restore execution state: {e}")


sleep_manager = SleepManager()
