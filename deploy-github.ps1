# Publish the P8S Concept Lab to the ffxivtesthub GitHub repository.
# Run from PowerShell in this folder: .\deploy-github.ps1
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$repository = 'https://github.com/ffxivtesthub/p8s-concept.git'

# Git for Windows is installed, but some PowerShell sessions do not inherit its PATH.
# Add only for this PowerShell process, without changing Windows system settings.
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $gitDirectory = 'C:\Program Files\Git\cmd'
    if (Test-Path -LiteralPath (Join-Path $gitDirectory 'git.exe')) {
        $env:Path = "$gitDirectory;$env:Path"
        Write-Host 'Found Git for Windows; configured PATH for this session.' -ForegroundColor Cyan
    }
}

function RunGit {
    & git @args
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed (exit $LASTEXITCODE): git $($args -join ' ')"
    }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Cannot find git.exe. Expected C:\Program Files\Git\cmd\git.exe or Git on PATH.'
}

# Never silently replace a remote configured for a different repository.
$remotes = @(& git remote)
if ($remotes -contains 'origin') {
    $existing = (& git remote get-url origin).Trim()
    if ($existing -eq 'https://github.com/m22584897-hub/p8s-concept.git' -or
        $existing -eq 'https://github.com/m22584897-hub/p8s-concept' -or
        $existing -eq 'git@github.com:m22584897-hub/p8s-concept.git') {
        Write-Host 'Switching origin from the previous owner to ffxivtesthub...' -ForegroundColor Cyan
        RunGit remote set-url origin $repository
    } elseif ($existing -ne $repository -and $existing -ne 'https://github.com/ffxivtesthub/p8s-concept' -and $existing -ne 'git@github.com:ffxivtesthub/p8s-concept.git') {
        throw "origin points to an unexpected repository: $existing"
    }
} else {
    RunGit remote add origin $repository
}

# Set repository-only commit identity if the machine has never configured Git.
# This uses a GitHub no-reply address so no personal email is required.
if (-not (& git config --get user.name)) {
    RunGit config user.name 'ffxivtesthub'
}
if (-not (& git config --get user.email)) {
    RunGit config user.email 'ffxivtesthub@users.noreply.github.com'
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

Write-Host 'Checking the remote main branch...' -ForegroundColor Cyan
$remoteMain = @(& git ls-remote --heads origin refs/heads/main)
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to check the GitHub repository. Verify its URL and your connection.'
}
if ($remoteMain.Count -gt 0 -and $remoteMain[0]) {
    # Preserve existing remote commits if the repository was initialized with a README.
    RunGit fetch origin main
    & git merge-base --is-ancestor origin/main HEAD
    if ($LASTEXITCODE -eq 1) {
        Write-Host 'Merging existing GitHub history without force-pushing...'
        RunGit merge --no-edit --allow-unrelated-histories -X ours origin/main
    } elseif ($LASTEXITCODE -ne 0) {
        throw 'Unable to compare local and remote history.'
    }
} else {
    Write-Host 'The new repository has no main branch yet; uploading its first commit.' -ForegroundColor Cyan
}

Write-Host 'Pushing website to GitHub...' -ForegroundColor Cyan
RunGit push -u origin main
Write-Host ''
Write-Host 'Source uploaded successfully.' -ForegroundColor Green
Write-Host 'If not already configured, set Repository > Settings > Pages > Source to GitHub Actions.'
Write-Host 'Then visit: https://ffxivtesthub.github.io/p8s-concept/'
