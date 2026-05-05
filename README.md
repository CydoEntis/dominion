<p align="center">
  <img src="logo.png" alt="Shepherd" width="120" />
</p>

<h1 align="center">Shepherd</h1>

<p align="center">
  A multi-session terminal manager built for AI coding agents.
</p>

<p align="center">
  <a href="https://github.com/CydoEntis/shepherd/releases/latest">
    <img src="https://img.shields.io/github/v/release/CydoEntis/shepherd?style=flat-square&color=3fae6b&labelColor=1c2028" alt="Latest Release" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-3fae6b?style=flat-square&labelColor=1c2028" alt="Platform" />
</p>

---

<p align="center">
  <img src="shepherd.png" alt="Shepherd screenshot" width="100%" />
</p>

---

## What is Shepherd?

Shepherd is a desktop terminal manager designed for running multiple AI coding agents — Claude, Codex, Gemini, or any CLI tool — simultaneously in a single window. Instead of juggling a dozen terminal windows, you get one organized workspace with sessions, groups, tabs, a built-in file viewer, and a markdown notepad.

---

## Features

### Multi-Session Terminal
Run as many agent sessions as you need side by side. Each session is a full terminal powered by xterm.js — keyboard shortcuts, scrollback, copy-paste, everything works as expected. Split any tab horizontally or vertically to view multiple sessions at once.

### Session Management
- **Tabs** — each session gets its own tab with a color-coded indicator
- **Activity badges** — spinning indicator when an agent is actively generating, pulsing amber dot when waiting for input
- **Groups** — organize sessions into named, color-coded groups in the sidebar
- **Rename on double-click** — double-click any tab to rename it and change its color
- **Presets** — save your most-used agent configurations (shell, working directory, agent command) and launch them in one click
- **Detachable windows** — pop a session out into its own window; closing it auto-reattaches to the main window

### Agent Support
Launch sessions with any agent command directly:
- `claude` — Claude Code
- `codex` — OpenAI Codex CLI
- `gemini` — Google Gemini CLI
- Plain shell — no agent, just a terminal

### Built-in File Viewer
Open any project directory from the sidebar. Browse the file tree, view files with full syntax highlighting (100+ languages via Shiki), preview Markdown, and inspect git diffs — all without leaving Shepherd.

### Notes Panel
A lightweight markdown notepad accessible from the sidebar. Each note is saved as an individual `.md` file in a configurable directory — point it at iCloud, Dropbox, or OneDrive for automatic sync across machines.

### Command Palette
Hit `Ctrl+P` to open the command palette. Search and jump to any session, open projects, or trigger actions without touching the mouse.

### Customizable
- **Shell picker** — choose which shell to use (cmd, PowerShell, bash, zsh, or any custom path)
- **Notes directory** — configure where your notes live on disk
- **Font size & family** — adjust terminal font from settings
- **Hotkeys** — remap every keyboard shortcut
- **Persistent layout** — your tabs, splits, and session state are restored on next launch

### Auto-Update
Shepherd checks for updates automatically. When a new version is available it downloads in the background — a toast notification with a **Restart** button appears when it's ready to install.

---

## Download

Head to the [Releases](https://github.com/CydoEntis/shepherd/releases/latest) page and grab the installer for your platform.

| Platform | File |
|----------|------|
| Windows | `Shepherd-Setup-x.x.x.exe` |
| macOS (Apple Silicon) | `Shepherd-x.x.x-arm64.dmg` |
| macOS (Intel) | `Shepherd-x.x.x.dmg` |
| Linux (AppImage) | `Shepherd-x.x.x.AppImage` |
| Linux (Debian/Ubuntu) | `shepherd_x.x.x_amd64.deb` |

> **Note:** Windows and macOS installers are currently unsigned. Windows will show a SmartScreen warning — click **More info → Run anyway**. macOS users right-click the app → **Open**.

---

## Development

```bash
# Install dependencies
npm install

# Start in dev mode
npm run dev

# Build for your platform
npm run dist
```

**Requirements:**
- [Node.js 20+](https://nodejs.org)
- Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (for node-pty)
- macOS: Xcode Command Line Tools — `xcode-select --install`
- Linux: `build-essential` — `sudo apt install build-essential`
