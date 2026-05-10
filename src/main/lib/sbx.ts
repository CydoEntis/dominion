import { spawnSync } from 'child_process'

export function isSbxAvailable(): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const result = spawnSync(cmd, ['sbx'], { timeout: 3000, stdio: 'ignore' })
    return result.status === 0
  } catch {
    return false
  }
}
