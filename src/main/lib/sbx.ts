import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

// Known install locations per platform, checked when sbx isn't in PATH.
// Electron main process on Windows often doesn't inherit user-level PATH entries.
function knownSbxPaths(): string[] {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
      ?? join(process.env.USERPROFILE ?? 'C:/Users/Default', 'AppData', 'Local')
    return [join(localAppData, 'DockerSandboxes', 'bin', 'sbx.exe')]
  }
  if (process.platform === 'darwin') {
    return ['/opt/homebrew/bin/sbx', '/usr/local/bin/sbx']
  }
  return ['/usr/local/bin/sbx', '/usr/bin/sbx']
}

function resolveSbxPath(): string | null {
  const fromPath = spawnSync('sbx', [], { timeout: 2000, stdio: 'ignore' })
  if (!fromPath.error) return 'sbx'
  const known = knownSbxPaths().find(existsSync)
  return known ?? null
}

export function getSbxExecutable(): string | null {
  return resolveSbxPath()
}

export function isSbxAvailable(): boolean {
  return resolveSbxPath() !== null
}
