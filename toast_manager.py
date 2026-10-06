"""
toast_manager.py
----------------
Native Windows 10/11 Interactive Rich Toast Notifications.
Provides high-fidelity notifications with app branding, thumbnail artwork,
and native action buttons (e.g. 'Open File', 'Open Folder') via WinRT.
"""

import os
import sys
import threading
import subprocess
import html
from logger import get_logger

logger = get_logger(__name__)

# NovaDrop default icon path
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_ICON_256 = os.path.join(_BASE_DIR, "icons", "icon_256.png")
_ICON_ICO = os.path.join(_BASE_DIR, "icon.ico")


class ToastManager:
    def __init__(self):
        self._enabled = True
        self._app_id = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe"

    def set_enabled(self, enabled: bool):
        self._enabled = bool(enabled)

    def is_enabled(self) -> bool:
        return self._enabled

    def _to_file_uri(self, path: str) -> str:
        """Convert a local file or folder path to a file:/// URI."""
        if not path:
            return ""
        norm = os.path.abspath(path).replace("\\", "/")
        if not norm.startswith("/"):
            norm = "/" + norm
        return f"file://{norm}"

    def _escape_xml(self, text: str) -> str:
        if text is None:
            return ""
        return html.escape(str(text))

    def _send_toast_worker(self, xml_content: str):
        """Execute WinRT Toast via background PowerShell process."""
        if os.name != "nt":
            return

        ps_script = f"""
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$template = @"
{xml_content}
"@
try {{
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{self._app_id}')
    $notifier.Show($toast)
}} catch {{
    # Silently ignore if Windows notification service is disabled
}}
"""
        try:
            startupinfo = None
            if hasattr(subprocess, "STARTUPINFO"):
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = 0  # SW_HIDE

            subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
                startupinfo=startupinfo,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                capture_output=True,
                timeout=8,
            )
        except Exception as e:
            logger.debug(f"Failed to display toast notification: {e}")

    def show_toast(self, title: str, message: str, image_path: str = None, actions: list = None):
        """
        Send a generic rich toast notification asynchronously.
        actions: list of dicts [{'content': 'Label', 'arguments': 'uri', 'type': 'protocol'}]
        """
        if not self._enabled or os.name != "nt":
            return

        clean_title = self._escape_xml(title or "NovaDrop")
        clean_msg = self._escape_xml(message or "")

        # Determine icon or artwork
        icon_uri = ""
        if image_path and os.path.isfile(image_path):
            icon_uri = self._to_file_uri(image_path)
        elif os.path.isfile(_ICON_256):
            icon_uri = self._to_file_uri(_ICON_256)
        elif os.path.isfile(_ICON_ICO):
            icon_uri = self._to_file_uri(_ICON_ICO)

        img_element = f'<image placement="appLogoOverride" hint-crop="circle" src="{icon_uri}"/>' if icon_uri else ""

        actions_xml = ""
        if actions:
            action_tags = []
            for act in actions:
                c = self._escape_xml(act.get("content", ""))
                arg = self._escape_xml(act.get("arguments", ""))
                act_type = act.get("type", "protocol")
                if c and arg:
                    action_tags.append(f'<action content="{c}" arguments="{arg}" activationType="{act_type}"/>')
            if action_tags:
                actions_xml = f"<actions>\n    " + "\n    ".join(action_tags) + "\n  </actions>"

        xml = f"""<toast duration="short">
  <visual>
    <binding template="ToastGeneric">
      <text>{clean_title}</text>
      <text>{clean_msg}</text>
      {img_element}
    </binding>
  </visual>
  {actions_xml}
</toast>"""

        threading.Thread(target=self._send_toast_worker, args=(xml,), daemon=True).start()

    def show_download_complete(self, title: str, files: list = None, output_dir: str = None, thumbnail: str = None):
        """Display notification when download completes successfully with quick action buttons."""
        if not self._enabled:
            return

        actions = []
        primary_file = None
        if files and len(files) == 1:
            f = files[0]
            fpath = f.get("path") if isinstance(f, dict) else str(f)
            if fpath and os.path.isfile(fpath):
                primary_file = fpath
                actions.append({
                    "content": "Open File",
                    "arguments": self._to_file_uri(primary_file),
                    "type": "protocol"
                })

        if output_dir and os.path.isdir(output_dir):
            actions.append({
                "content": "Open Folder",
                "arguments": self._to_file_uri(output_dir),
                "type": "protocol"
            })
        elif primary_file:
            folder = os.path.dirname(primary_file)
            if os.path.isdir(folder):
                actions.append({
                    "content": "Open Folder",
                    "arguments": self._to_file_uri(folder),
                    "type": "protocol"
                })

        # Prefer local thumbnail if available
        local_thumb = None
        if thumbnail and os.path.isfile(thumbnail):
            local_thumb = thumbnail

        file_count_str = f"({len(files)} files)" if (files and len(files) > 1) else ""
        msg = f"Ready to play {file_count_str}".strip()

        self.show_toast(
            title=f"NovaDrop • Download Complete",
            message=f"{title}\n{msg}",
            image_path=local_thumb,
            actions=actions
        )

    def show_download_failed(self, title: str, error: str = None):
        """Display notification when download fails."""
        if not self._enabled:
            return

        err_preview = (error or "An unknown error occurred.")[:120]
        self.show_toast(
            title="NovaDrop • Download Failed",
            message=f"{title}\n{err_preview}",
            image_path=_ICON_256 if os.path.isfile(_ICON_256) else None,
            actions=[]
        )


toast = ToastManager()
