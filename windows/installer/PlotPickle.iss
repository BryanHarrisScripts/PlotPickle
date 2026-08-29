#ifndef StageDir
  #error StageDir must be supplied by the release build.
#endif
#ifndef OutputDir
  #error OutputDir must be supplied by the release build.
#endif
#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#ifndef WindowsProductVersion
  #define WindowsProductVersion "0.0.0.0"
#endif

#define AppName "PlotPickle"
#define Publisher "PlotPickle"
#define AppExeName "PlotPickle.exe"

[Setup]
AppId={{A0EC3454-DF7A-4E88-9DA5-55B865D52A96}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#Publisher}
DefaultDirName={localappdata}\Programs\PlotPickle
DefaultGroupName=PlotPickle
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=PlotPickleSetup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=PlotPickle
UninstallDisplayIcon={app}\{#AppExeName}
CloseApplications=yes
RestartApplications=no
ChangesAssociations=no
SetupLogging=yes
VersionInfoCompany=PlotPickle
VersionInfoDescription=PlotPickle Windows Installer
VersionInfoProductName=PlotPickle
VersionInfoProductVersion={#WindowsProductVersion}

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; PrepareToInstall removes any node_modules junction before install cleanup begins.
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\.agents"
Type: filesandordirs; Name: "{app}\.openai"
Type: filesandordirs; Name: "{app}\adapters"
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\build"
Type: filesandordirs; Name: "{app}\config"
Type: filesandordirs; Name: "{app}\core"
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\db"
Type: filesandordirs; Name: "{app}\docs"
Type: filesandordirs; Name: "{app}\learn"
Type: filesandordirs; Name: "{app}\lib"
Type: filesandordirs; Name: "{app}\modules"
Type: filesandordirs; Name: "{app}\public"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\schema"
Type: filesandordirs; Name: "{app}\scripts"
Type: filesandordirs; Name: "{app}\tests"
Type: filesandordirs; Name: "{app}\Utilities"
Type: filesandordirs; Name: "{app}\worker"

[Icons]
Name: "{autoprograms}\PlotPickle"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\PlotPickle"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch PlotPickle"; Flags: nowait postinstall skipifsilent

[Code]
const
  FileAttributeReparsePoint = $400;
  InvalidFileAttributes = $FFFFFFFF;

function GetFileAttributes(FileName: String): DWORD;
  external 'GetFileAttributesW@kernel32.dll stdcall';

function IsDirectoryReparsePoint(Path: String): Boolean;
var
  Attributes: DWORD;
begin
  Attributes := GetFileAttributes(Path);
  Result := (Attributes <> InvalidFileAttributes) and
    ((Attributes and FileAttributeReparsePoint) <> 0);
end;

procedure StopPlotPickleProcessTree();
var
  ResultCode: Integer;
begin
  { The native launcher waits for cmd, which waits for Vite. Stopping the full
    tree prevents an upgrade from writing into files held by that child tree. }
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM PlotPickle.exe /T /F', '',
    SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function DetachPersistentRuntime(): Boolean;
var
  ModulesPath: String;
  ResultCode: Integer;
begin
  Result := True;
  ModulesPath := ExpandConstant('{app}\node_modules');
  if not IsDirectoryReparsePoint(ModulesPath) then
    exit;

  { rmdir without /S removes a junction itself without traversing its target. }
  if (not Exec(ExpandConstant('{cmd}'), '/D /C rmdir "' + ModulesPath + '"', '',
      SW_HIDE, ewWaitUntilTerminated, ResultCode)) or (ResultCode <> 0) or
      IsDirectoryReparsePoint(ModulesPath) then
    Result := False;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopPlotPickleProcessTree();
  if DetachPersistentRuntime() then
    Result := ''
  else
    Result := 'PlotPickle could not safely detach its persistent runtime. Close PlotPickle and try the update again.';
end;

function InitializeUninstall(): Boolean;
begin
  { User stories, profiles, settings and persistent runtimes live under
    the current user's LocalAppData PlotPickle folder, outside the installed
    application directory. The uninstaller intentionally removes only
    application binaries and shortcuts. }
  StopPlotPickleProcessTree();
  Result := DetachPersistentRuntime();
  if not Result then
    MsgBox('PlotPickle could not safely detach its persistent runtime. Close PlotPickle and run uninstall again.',
      mbError, MB_OK);
end;
