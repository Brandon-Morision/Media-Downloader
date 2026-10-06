; ─────────────────────────────────────────────────────────────────
; MediaDownloader.iss — Inno Setup 7
; Installs the app AND automatically installs the browser extension
; into Chrome and Edge via Windows registry (no developer mode needed)
; ─────────────────────────────────────────────────────────────────

; Version is managed centrally in version.py - update that file to change versions
#define AppName      "Media Downloader"
#define AppVersion   "0.4.3"
#define AppPublisher "Brandon"
#define AppExeName   "MediaDownloader.exe"
#define SourceDir    "dist\MediaDownloader"
#define ExtDir       "browser_extension"

; Chrome/Edge install the extension by reading this registry path.
; The ID is derived from the public key embedded in manifest.json —
; it will always be the same as long as the key file doesn't change.
#define ExtId        "djaghggdhbcpkfeoogacpkjlojfnajki"

[Setup]
AppId                             = {{A7F3C2D1-8E4B-4F9A-B5C6-D2E1F3A4B5C7}
AppName                           = {#AppName}
AppVersion                        = {#AppVersion}
AppPublisher                      = {#AppPublisher}
DefaultDirName                    = {autopf}\{#AppName}
DefaultGroupName                  = {#AppName}
DisableProgramGroupPage           = yes
OutputDir                         = installer
OutputBaseFilename                = MediaDownloader Setup
SetupIconFile                     = build_assets\icon.ico
; NOTE: SetupIconFile above only sets the icon on Setup.exe itself (the
; installer wizard) — it has no effect on the installed app, its
; shortcuts, or its taskbar entry. Those all come from whatever icon
; resource is embedded in MediaDownloader.exe (set in MediaDownloader.spec
; at build time), or — as a fallback that doesn't depend on that build
; step succeeding — from the .ico file we now bundle and point shortcuts
; at explicitly below.
UninstallDisplayIcon              = {app}\icon.ico
Compression                       = lzma2/ultra64
SolidCompression                  = yes
; Force a real UAC elevation prompt — without this, code 5 / access
; denied can occur when writing to HKLM even with admin specified.
PrivilegesRequired                = admin
PrivilegesRequiredOverridesAllowed = commandline
MinVersion                        = 10.0.17134
WizardStyle                       = modern
WizardImageFile                   = build_assets\wizard.bmp,build_assets\wizard-2x.bmp
WizardSmallImageFile              = build_assets\wizard-small.bmp,build_assets\wizard-small-2x.bmp
ShowLanguageDialog                = no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";   Description: "Create a &desktop shortcut";              GroupDescription: "Additional icons:"
Name: "chromeext";     Description: "Install browser extension for &Chrome";   GroupDescription: "Browser extension (auto-installs, no developer mode needed):"
Name: "edgeext";       Description: "Install browser extension for &Edge";     GroupDescription: "Browser extension (auto-installs, no developer mode needed):"

[Files]
; Main app — full onedir build output
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Bundled explicitly (not just relied on via SetupIconFile above) so the
; Start Menu/desktop shortcuts below have a guaranteed-good icon source,
; independent of whether MediaDownloader.exe itself embeds one correctly.
Source: "build_assets\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

; Browser extension — installed to a subfolder the browser reads from
Source: "{#ExtDir}\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs; Tasks: chromeext or edgeext

[Icons]
Name: "{group}\{#AppName}";       Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

; ─────────────────────────────────────────────────────────────────
; REGISTRY
; App Paths + browser extension force-install keys
;
; Chrome and Edge each have their own registry path for
; ExtensionInstallForcelist. The value format is:
;   "<extension-id>;<path-to-extension-folder>"
; The browser reads this on launch and silently installs/updates
; the extension. No developer mode, no user prompt needed.
; ─────────────────────────────────────────────────────────────────
[Registry]
; App Paths — written to HKCU so it never needs admin rights.
; This lets Windows find MediaDownloader.exe by name without
; requiring elevation for this specific key.
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{#AppExeName}"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExeName}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{#AppExeName}"; ValueType: string; ValueName: "Path"; ValueData: "{app}"; Flags: uninsdeletekey

; Chrome extension force-install — written to HKLM\Policies.
; Requires the admin elevation we already requested above.
; noerror prevents a failure here from aborting the whole install.
Root: HKLM; Subkey: "SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"; ValueType: string; ValueName: "1"; ValueData: "{#ExtId};{app}\extension"; Flags: uninsdeletevalue noerror; Tasks: chromeext

; Edge extension force-install — same approach.
Root: HKLM; Subkey: "SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist"; ValueType: string; ValueName: "1"; ValueData: "{#ExtId};{app}\extension"; Flags: uninsdeletevalue noerror; Tasks: edgeext

[Code]
function WebView2IsInstalled: Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '0.0.0.0') and (Version <> '');
  if not Result then
    Result := RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '0.0.0.0') and (Version <> '');
end;

procedure InitializeWizard;
var
  Msg: String;
begin
  if not WebView2IsInstalled then
  begin
    Msg := 'Media Downloader requires the Microsoft Edge WebView2 Runtime.' + #13#10 + #13#10 + 'It ships with Windows 11 and most updated Windows 10 systems.' + #13#10 + 'If the app does not display correctly after installation, download it from:' + #13#10 + 'https://developer.microsoft.com/microsoft-edge/webview2/' + #13#10 + #13#10 + 'Installation will continue. You can install WebView2 later.';
    MsgBox(Msg, mbInformation, MB_OK);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Msg: String;
begin
  if CurStep = ssDone then
  begin
    Msg := 'The browser extension has been registered.' + #13#10 + #13#10 + 'Restart Chrome or Edge and it will appear in your toolbar automatically.' + #13#10 + #13#10 + 'No developer mode or manual installation needed.';
    if IsTaskSelected('chromeext') or IsTaskSelected('edgeext') then
      MsgBox(Msg, mbInformation, MB_OK);
  end;
end;
