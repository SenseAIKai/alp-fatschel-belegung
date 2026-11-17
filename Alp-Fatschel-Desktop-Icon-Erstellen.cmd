@echo off
title Alp Fatschel - Windows Desktop-Symbol einrichten
set "TARGET_DIR=%LOCALAPPDATA%\AlpFatschelPMS"
set "ICO_FILE=%TARGET_DIR%\Alp-Fatschel.ico"
set "HTML_FILE=%TARGET_DIR%\index.html"
set "VBS_FILE=%TEMP%\make_alp_shortcut.vbs"

echo ============================================================================
echo   ALP FATSCHEL - WINDOWS DESKTOP-APP INSTALLATION
echo ============================================================================
echo.
echo [1/3] Richte Programmordner %TARGET_DIR% ein ...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

if exist "%~dp0app\Alp-Fatschel.ico" copy /Y "%~dp0app\Alp-Fatschel.ico" "%ICO_FILE%" >nul
if exist "%~dp0app\index.html" copy /Y "%~dp0app\index.html" "%HTML_FILE%" >nul

if not exist "%ICO_FILE%" (
    echo Lade offizielles Alp-Fatschel Programmsymbol herunter ...
    curl.exe -fsSL "https://senseaikai.github.io/alp-fatschel-belegung/Alp-Fatschel.ico" -o "%ICO_FILE%"
)
if not exist "%HTML_FILE%" (
    echo Lade aktuelle Programmversion herunter ...
    curl.exe -fsSL "https://senseaikai.github.io/alp-fatschel-belegung/index.html" -o "%HTML_FILE%"
)

set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE_EXE%" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

echo [2/3] Erstelle Symbol "Alp Fatschel" auf deinem Windows-Desktop ...
> "%VBS_FILE%" echo Set ws = CreateObject("WScript.Shell")
>> "%VBS_FILE%" echo desk = ws.SpecialFolders("Desktop")
>> "%VBS_FILE%" echo Set lnk = ws.CreateShortcut(desk ^& "\Alp Fatschel.lnk")
if exist "%EDGE_EXE%" (
    >> "%VBS_FILE%" echo lnk.TargetPath = "%EDGE_EXE%"
    >> "%VBS_FILE%" echo lnk.Arguments = "--app=""https://senseaikai.github.io/alp-fatschel-belegung/"" --window-size=1520,940"
) else (
    >> "%VBS_FILE%" echo lnk.TargetPath = "https://senseaikai.github.io/alp-fatschel-belegung/"
)
>> "%VBS_FILE%" echo lnk.WorkingDirectory = "%TARGET_DIR%"
>> "%VBS_FILE%" echo lnk.IconLocation = "%ICO_FILE%,0"
>> "%VBS_FILE%" echo lnk.Description = "Alp Fatschel Hotel-PMS & Belegungsplan"
>> "%VBS_FILE%" echo lnk.Save
>> "%VBS_FILE%" echo sm = ws.SpecialFolders("Programs")
>> "%VBS_FILE%" echo Set lnk2 = ws.CreateShortcut(sm ^& "\Alp Fatschel.lnk")
if exist "%EDGE_EXE%" (
    >> "%VBS_FILE%" echo lnk2.TargetPath = "%EDGE_EXE%"
    >> "%VBS_FILE%" echo lnk2.Arguments = "--app=""https://senseaikai.github.io/alp-fatschel-belegung/"" --window-size=1520,940"
) else (
    >> "%VBS_FILE%" echo lnk2.TargetPath = "https://senseaikai.github.io/alp-fatschel-belegung/"
)
>> "%VBS_FILE%" echo lnk2.WorkingDirectory = "%TARGET_DIR%"
>> "%VBS_FILE%" echo lnk2.IconLocation = "%ICO_FILE%,0"
>> "%VBS_FILE%" echo lnk2.Save

cscript //nologo "%VBS_FILE%"
del /Q "%VBS_FILE%" >nul 2>nul

echo [3/3] Starte Alp Fatschel Desktop-App ...
if exist "%EDGE_EXE%" (
    start "" "%EDGE_EXE%" --app="https://senseaikai.github.io/alp-fatschel-belegung/" --window-size=1520,940
) else (
    start "" "https://senseaikai.github.io/alp-fatschel-belegung/"
)
echo.
echo ERFOLGREICH! Das Symbol "Alp Fatschel" mit dem Berg-Logo liegt jetzt auf deinem Desktop!
timeout /t 4 >nul
exit /b 0
