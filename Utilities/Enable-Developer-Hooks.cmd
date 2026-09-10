@echo off
setlocal
title PlotPickle - Enable Developer Hooks

set "REPOSITORY=%~1"
if not defined REPOSITORY set "REPOSITORY=%~dp0.."

pushd "%REPOSITORY%" >nul 2>&1
if errorlevel 1 goto :invalid_repository

if not exist "AGENTS.md" goto :invalid_repository_popd
if not exist ".git" goto :invalid_repository_popd
if not exist ".githooks\pre-commit" goto :missing_hook

git config --local core.hooksPath .githooks
if errorlevel 1 goto :configuration_failed

for /f "delims=" %%H in ('git config --local --get core.hooksPath') do set "HOOK_PATH=%%H"
if /i not "%HOOK_PATH%"==".githooks" goto :configuration_failed

echo PlotPickle repository-local developer hooks are enabled.
echo Repository: %CD%
echo Hook path: .githooks
echo This did not change your global Git configuration.
popd
exit /b 0

:missing_hook
echo PlotPickle pre-commit hook was not found at .githooks\pre-commit.
popd
exit /b 1

:configuration_failed
echo Git could not configure the repository-local PlotPickle hook path.
popd
exit /b 1

:invalid_repository_popd
popd
:invalid_repository
echo PlotPickle repository not found. Pass the repository path as the first argument.
exit /b 1
