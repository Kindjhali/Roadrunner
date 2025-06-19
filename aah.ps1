# =====================================================================================================
# migrate-roadrunner.ps1  —  ONE-SHOT MONOREPO MOVER
# =====================================================================================================
$ErrorActionPreference = 'Stop'          # fail fast
$root = 'D:\Storage A (Projects)\Roadrunner\app\Roadrunner'   # adjust if needed
Set-Location $root

# ---------------- helpers ---------------------------------------------------------------------------
function New-Dir    ($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
function Safe-Move  ($s,$d){
    if (Test-Path $s) { New-Dir (Split-Path $d); Move-Item $s $d -Force; Write-Host "✓ moved $s → $d" }
    else              { Write-Host "⚠ $s not found (skipped)" }
}
function Write-File ($p,$c){ New-Dir (Split-Path $p); $c | Set-Content -LiteralPath $p; Write-Host "✓ wrote $p" }

# ---------------- scaffold top level ----------------------------------------------------------------
New-Dir 'apps'; New-Dir 'services'; New-Dir 'packages'

# ---------------- move legacy trees -----------------------------------------------------------------
Safe-Move 'src'      'apps\renderer'
Safe-Move 'backend'  'services\api'
Safe-Move 'frontend' 'legacy-frontend'

# remove stale bundle
if (Test-Path 'legacy-frontend\dist') {
    Remove-Item 'legacy-frontend\dist' -Recurse -Force
    Write-Host "✓ removed legacy-frontend/dist"
}

# ---------------- stub new modules ------------------------------------------------------------------
New-Dir 'services\autocoder\src'
New-Dir 'packages\common'

# hot-fix wrapper
$hotfix = @'
import { initializeAgentExecutorWithOptions, BufferWindowMemory } from "langchain";

export async function createExecutor(tools, model) {
  const memory = new BufferWindowMemory({
    k: 8,
    memoryKey: "chat_history",
    outputKey: "output"
  });

  return initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
    outputKey: "output",
    memory,
    returnIntermediateSteps: false
  });
}
'@
Write-File 'services\autocoder\src\hotfix-outputKey.ts' $hotfix

# pnpm-workspace
$workspace = @'
packages:
  - apps/*
  - services/*
  - packages/*
'@
Write-File 'pnpm-workspace.yaml' $workspace

# root package.json
$packageJson = @'
{
  "name": "roadrunner-root",
  "private": true,
  "packageManager": "pnpm@9",
  "workspaces": ["apps/*","services/*","packages/*"],
  "scripts": {
    "dev": "concurrently --raw -n desktop,renderer,api \"pnpm --filter apps/desktop dev\" \"pnpm --filter apps/renderer dev\" \"pnpm --filter services/api dev\"",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "typescript": "^5.5.0"
  }
}
'@
Write-File 'package.json' $packageJson

Write-Host ''
Write-Host '🎉  Monorepo scaffold complete.'
Write-Host 'Next:  pnpm install   &&   pnpm dev'
