<?php

declare(strict_types=1);

const APP_NAME = 'PlotPickle';

$packageRoot = dirname(__DIR__);
$webRoot = $packageRoot . DIRECTORY_SEPARATOR . 'web';
$dataRoot = $packageRoot . DIRECTORY_SEPARATOR . 'data';
$projectsRoot = $dataRoot . DIRECTORY_SEPARATOR . 'projects';
$backupsRoot = $dataRoot . DIRECTORY_SEPARATOR . 'backups';

foreach ([$dataRoot, $projectsRoot, $backupsRoot] as $directory) {
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        respondJson(['error' => 'Unable to create local data directory.'], 500);
    }
}

$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

if (str_starts_with($path, '/__plotpickle/')) {
    handleLocalApi($path, $projectsRoot, $backupsRoot);
    exit;
}

$requested = $path === '/' ? '/index.html' : $path;
$file = realpath($webRoot . DIRECTORY_SEPARATOR . ltrim($requested, '/'));
$realWebRoot = realpath($webRoot);

if ($file !== false && $realWebRoot !== false && str_starts_with($file, $realWebRoot) && is_file($file)) {
    serveFile($file);
    exit;
}

$index = $webRoot . DIRECTORY_SEPARATOR . 'index.html';
if (is_file($index)) {
    serveFile($index);
    exit;
}

http_response_code(503);
header('Content-Type: text/plain; charset=utf-8');
echo "PlotPickle's local web bundle is missing. Rebuild the local package and try again.\n";

function handleLocalApi(string $path, string $projectsRoot, string $backupsRoot): void
{
    header('Cache-Control: no-store');

    if ($path === '/__plotpickle/health' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        respondJson([
            'ok' => true,
            'app' => APP_NAME,
            'localRuntime' => true,
            'php' => PHP_VERSION,
        ]);
    }

    if ($path === '/__plotpickle/projects' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $projects = [];
        foreach (glob($projectsRoot . DIRECTORY_SEPARATOR . '*.plotpickle.json') ?: [] as $file) {
            $projects[] = [
                'name' => basename($file),
                'modifiedAt' => gmdate(DATE_ATOM, (int) filemtime($file)),
                'bytes' => (int) filesize($file),
            ];
        }
        usort($projects, static fn(array $a, array $b): int => strcmp($b['modifiedAt'], $a['modifiedAt']));
        respondJson(['projects' => $projects]);
    }

    if ($path === '/__plotpickle/project' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $name = safeProjectName((string) ($_GET['name'] ?? 'active.plotpickle.json'));
        $file = $projectsRoot . DIRECTORY_SEPARATOR . $name;
        if (!is_file($file)) {
            respondJson(['error' => 'Project not found.'], 404);
        }
        header('Content-Type: application/json; charset=utf-8');
        readfile($file);
        exit;
    }

    if ($path === '/__plotpickle/project' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
        $name = safeProjectName((string) ($_GET['name'] ?? 'active.plotpickle.json'));
        $payload = file_get_contents('php://input');
        if ($payload === false || $payload === '') {
            respondJson(['error' => 'Project data is empty.'], 400);
        }

        json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $target = $projectsRoot . DIRECTORY_SEPARATOR . $name;

        if (is_file($target)) {
            $backup = $backupsRoot . DIRECTORY_SEPARATOR . pathinfo($name, PATHINFO_FILENAME) . '-' . gmdate('Ymd-His') . '.json';
            copy($target, $backup);
            pruneBackups($backupsRoot, pathinfo($name, PATHINFO_FILENAME), 20);
        }

        $temporary = $target . '.tmp';
        if (file_put_contents($temporary, $payload, LOCK_EX) === false || !rename($temporary, $target)) {
            @unlink($temporary);
            respondJson(['error' => 'Unable to save the project.'], 500);
        }

        respondJson([
            'ok' => true,
            'name' => $name,
            'savedAt' => gmdate(DATE_ATOM),
            'bytes' => strlen($payload),
        ]);
    }

    respondJson(['error' => 'Unknown local PlotPickle endpoint.'], 404);
}

function safeProjectName(string $name): string
{
    $name = basename(trim($name));
    $name = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $name) ?: 'active.plotpickle.json';
    if (!str_ends_with($name, '.plotpickle.json')) {
        $name .= '.plotpickle.json';
    }
    return $name;
}

function pruneBackups(string $directory, string $prefix, int $keep): void
{
    $files = glob($directory . DIRECTORY_SEPARATOR . $prefix . '-*.json') ?: [];
    usort($files, static fn(string $a, string $b): int => filemtime($b) <=> filemtime($a));
    foreach (array_slice($files, $keep) as $file) {
        @unlink($file);
    }
}

function respondJson(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function serveFile(string $file): void
{
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $types = [
        'css' => 'text/css; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'ico' => 'image/x-icon',
        'jpeg' => 'image/jpeg',
        'jpg' => 'image/jpeg',
        'js' => 'text/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'png' => 'image/png',
        'svg' => 'image/svg+xml',
        'webp' => 'image/webp',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
    ];
    header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
    header('Content-Length: ' . filesize($file));
    readfile($file);
}
