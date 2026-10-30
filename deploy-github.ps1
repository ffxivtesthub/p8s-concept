# Publish the current P8S Concept Lab source to the user's existing GitHub repository.
# Run in PowerShell: powershell -ExecutionPolicy Bypass -File "D:\test2\p8s-concept\deploy-github.ps1"
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$repository = 'https://github.com/m22584897-hub/p8s-concept.git'

function RunGit {
    & git @args
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed (exit $LASTEXITCODE): git $($args -join ' ')"
    }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is not installed or not on PATH.'
}

# Never silently replace a remote configured for a different repository.
$remotes = @(& git remote)
if ($remotes -contains 'origin') {
    $existing = (& git remote get-url origin).Trim()
    if ($existing -ne $repository -and $existing -ne 'https://github.com/m22584897-hub/p8s-concept' -and $existing -ne 'git@github.com:m22584897-hub/p8s-concept.git') {
        throw "origin points to a different repository: $existing"
    }
} else {
    RunGit remote add origin $repository
}

Write-Host 'Checking the current website...' -ForegroundColor Cyan
RunGit status --short
Write-Host 'Staging the updated static website and deployment settings...' -ForegroundColor Cyan
RunGit add -- README.md dist tests .github deploy-github.ps1
& git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    RunGit commit -m 'Update P8S concepts and configure GitHub Pages'
} elseif ($LASTEXITCODE -ne 0) {
    throw 'Unable to inspect staged changes.'
} else {
    Write-Host 'No new local changes to commit.'
}

Write-Host 'Getting the latest remote main branch...' -ForegroundColor Cyan
RunGit fetch origin main
& git show-ref --verify --quiet refs/remotes/origin/main
if ($LASTEXITCODE -eq 0) {
    & git merge-base --is-ancestor origin/main HEAD
    if ($LASTEXITCODE -eq 1) {
        # Keeps remote history and non-conflicting remote files. For overlapping
        # changes, prefer the locally tested site instead of force-pushing.
        Write-Host 'Merging existing GitHub history (preferring tested local files on conflicts)...'
        RunGit merge --no-edit --allow-unrelated-histories -X ours origin/main
    } elseif ($LASTEXITCODE -ne 0) {
        throw 'Unable to compare local and remote history.'
    }
} elseif ($LASTEXITCODE -ne 1) {
    throw 'Unable to inspect remote main branch.'
}

Write-Host 'Pushing website to GitHub...' -ForegroundColor Cyan
RunGit push -u origin main
Write-Host ''
Write-Host 'Source uploaded successfully.' -ForegroundColor Green
Write-Host 'If not already configured, set Repository > Settings > Pages > Source to GitHub Actions.'
Write-Host 'Then visit: https://m22584897-hub.github.io/p8s-concept/'
