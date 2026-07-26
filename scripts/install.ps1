$ErrorActionPreference = 'Stop'

$Repo = 'involvex/youtube-music-cli'
$BinDir = Join-Path $env:USERPROFILE '.local\bin'
$FromNpm = $args -contains '--from-npm'

function Install-FromPackageManager {
	$package = '@involvex/youtube-music-cli'
	if (Get-Command bun -ErrorAction SilentlyContinue) {
		bun install -g $package
		Write-Host 'youtube-music-cli installed via bun. Run: youtube-music-cli'
		exit 0
	}
	if (Get-Command npm -ErrorAction SilentlyContinue) {
		npm install -g $package
		Write-Host 'youtube-music-cli installed via npm. Run: youtube-music-cli'
		exit 0
	}
	Write-Host "Error: could not download a release binary, and bun/npm are not available." -ForegroundColor Red
	Write-Host 'Install bun from https://bun.sh or node.js from https://nodejs.org' -ForegroundColor Red
	exit 1
}

if ($FromNpm) {
	Install-FromPackageManager
}

# Prefer platform-specific asset; fall back to legacy name.
$AssetCandidates = @(
	'youtube-music-cli-windows-x64.exe',
	'youtube-music-cli.exe'
)
$DestExe = Join-Path $BinDir 'youtube-music-cli.exe'
$DestYmc = Join-Path $BinDir 'ymc.exe'

try {
	Write-Host "Fetching latest release from GitHub ($Repo)..."
	$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{
		'User-Agent' = 'youtube-music-cli-install'
		'Accept'     = 'application/vnd.github+json'
	}

	$asset = $null
	foreach ($name in $AssetCandidates) {
		$asset = $release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
		if ($asset) { break }
	}
	if (-not $asset) {
		throw "No Windows release binary found (tried: $($AssetCandidates -join ', '))."
	}

	if (-not (Test-Path $BinDir)) {
		New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
	}

	Write-Host "Downloading $($asset.name) → $DestExe"
	Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $DestExe -UseBasicParsing
	Copy-Item -Path $DestExe -Destination $DestYmc -Force

	$pathEntries = $env:PATH -split ';' | ForEach-Object { $_.TrimEnd('\') }
	$binNormalized = $BinDir.TrimEnd('\')
	$onPath = $pathEntries | Where-Object { $_.ToLowerInvariant() -eq $binNormalized.ToLowerInvariant() }
	if (-not $onPath) {
		Write-Host ''
		Write-Host "Installed to $BinDir" -ForegroundColor Green
		Write-Host "Add this folder to your PATH, then restart the terminal:" -ForegroundColor Yellow
		Write-Host "  $BinDir"
		Write-Host ''
		Write-Host 'PowerShell (current user, persistent):'
		Write-Host "  [Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$BinDir', 'User')"
	} else {
		Write-Host "Installed to $BinDir (already on PATH)." -ForegroundColor Green
	}
	Write-Host 'Run: youtube-music-cli   (or ymc)'
	exit 0
} catch {
	Write-Host "Binary install failed: $($_.Exception.Message)" -ForegroundColor Yellow
	Write-Host 'Falling back to bun/npm package install...'
	Install-FromPackageManager
}
