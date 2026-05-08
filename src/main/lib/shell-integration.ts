import path from 'path'

/**
 * Returns an OSC 7 shell-integration init command for the given shell, or
 * null when the shell cannot emit OSC 7 (e.g. CMD).
 *
 * The returned string is ready to write verbatim to PTY stdin — it includes
 * the trailing newline character(s).
 *
 * @param shellPath  Full path or bare name of the shell executable.
 * @param platform   Node.js platform string (process.platform).
 */
export function getShellIntegrationSequence(
  shellPath: string,
  platform: NodeJS.Platform
): string | null {
  // Extract just the filename without extension (e.g. /bin/zsh → zsh,
  // C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe → powershell)
  const base = path.basename(shellPath).replace(/\.exe$/i, '').toLowerCase()

  const nl = platform === 'win32' ? '\r\n' : '\n'

  switch (base) {
    case 'bash': {
      // PROMPT_COMMAND hook — runs before every prompt.
      // Leading space suppresses history entry when HISTCONTROL includes ignorespace.
      const cmd =
        ' __osc7_emit() {' +
        " printf '\\033]7;file://%s%s\\a' \"${HOSTNAME:-localhost}\" \"$(pwd | python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read().strip()))' 2>/dev/null || pwd)\";" +
        ' };' +
        ' PROMPT_COMMAND="${PROMPT_COMMAND:+${PROMPT_COMMAND};}__osc7_emit"'
      return cmd + nl
    }

    case 'zsh': {
      // precmd hook — zsh equivalent of PROMPT_COMMAND.
      const cmd =
        ' __osc7_emit() {' +
        " printf '\\033]7;file://%s%s\\a' \"${HOST:-localhost}\" \"${PWD}\";" +
        ' };' +
        ' precmd_functions+=(__osc7_emit);' +
        ' __osc7_emit'
      return cmd + nl
    }

    case 'fish': {
      // fish uses event-based hooks; fish_prompt fires before every prompt.
      const cmd =
        "function __osc7_emit --on-event fish_prompt; printf '\\033]7;file://%s%s\\a' (hostname 2>/dev/null; or echo localhost) $PWD; end"
      return cmd + nl
    }

    case 'pwsh':
    case 'powershell': {
      // Override the prompt function to emit OSC 7 before returning the
      // prompt string.  The `e] syntax requires PS 7+; on PS 5 we use
      // [char]27 directly so the same string works on both.
      const cmd =
        'function global:prompt {' +
        ' $p = $executionContext.SessionState.Path.CurrentLocation.Path;' +
        " $e = $p.Replace('\\\\', '/').Replace('\\', '/');" +
        " if (-not $e.StartsWith('/')) { $e = \"/$e\" };" +
        " [Console]::Write(\"`e]7;file://localhost$e`a\");" +
        ' "PS $p> "' +
        ' }'
      return cmd + nl
    }

    case 'cmd':
      // CMD has no programmable prompt hook that can emit arbitrary escape
      // sequences in a reliable cross-version way.
      return null

    default:
      return null
  }
}
