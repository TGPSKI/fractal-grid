# fractal-grid

[changelog](CHANGELOG.md) | [lineage](LINEAGE.md) | [contributing](CONTRIBUTING.md) | [pate.sh](https://pate.sh)

**A dynamic, ultrawide-optimized tiling engine for KWin.**

fractal-grid turns KDE Plasma into a composable, keyboard-driven window layout
manager. It sits between KDE's default floating-window behavior and a full
tiling window manager: shortcuts snap the active window into a
percentage-based column grid, with smart stacking, takeover (spanning adjacent
columns), and frame margins.

It is a KWin Scripting API plugin whose geometry engine is a single configurable
layout generator. A layout is a few lines of percentage-based configuration, so
a new monitor setup is added as data, not code.

## Features

- **Percentage-based layouts** — column widths, margins, padding and spacing are
  all percentages of the screen, so layouts survive resolution and DPI changes.
- **Smart stacking** — a column with rows enabled fills, splits, or appends
  windows automatically, respecting a minimum window height.
- **Takeover mode** — expand a window across adjacent columns.
- **Frame margins and per-column padding** — layouts that don't maximize the
  full screen.
- **Multi-desktop / multi-activity aware** — collision detection filters out
  minimized, hidden, and other-desktop/activity windows.
- **Live reflow** — geometry recalculates when the screen size changes
  (dock/undock, monitor hotplug).

## Requirements

- KDE Plasma 6 (KWin Scripting API)
- `kpackagetool6`, `kwriteconfig6`, `qdbus6`

## Agent-driven setup and configuration

fractal-grid ships three agent skills, so an AI coding agent can take a fresh
clone to a configured install — and change layouts and shortcuts — without
editing files by hand:

| skill | what it does |
|---|---|
| [`fractal-grid-install`](.agents/skills/fractal-grid-install/SKILL.md) | guided install, upgrade, or removal |
| [`fractal-grid-layout`](.agents/skills/fractal-grid-layout/SKILL.md) | create or tune a column layout |
| [`fractal-grid-shortcuts`](.agents/skills/fractal-grid-shortcuts/SKILL.md) | add or rebind keyboard shortcuts |

Each skill reads the constraints in `AGENTS.md` and ends by running `make
check`.

## Install

```sh
git clone git@github.com:TGPSKI/fractal-grid.git
cd fractal-grid
./scripts/install.sh
```

## Update

```sh
cd fractal-grid
./scripts/update.sh
```

## Remove

```sh
cd fractal-grid
./scripts/uninstall.sh
```

## Shortcuts

| Binding | Action |
|---|---|
| `Ctrl+Alt+Meta+E` / `C` / `T` | three-column layout — left / center / right |
| `Ctrl+Alt+Meta+J` | three-column center, takeover (span left + center) |
| `Ctrl+Alt+Meta+D` / `B` / `H` | framed three-column — left / center / right |
| `Ctrl+Alt+Meta+M` / `K` | framed two-column — left / right |
| `Ctrl+Alt+Meta+U` / `I` | two-column stack — left / right |
| `Ctrl+Alt+Meta+,` / `L` | two-column healthy margins — left / right |

Every shortcut is `fractal-grid:`-prefixed and editable in System Settings >
Shortcuts > KWin.

## Layouts

Layouts are defined by `gridLayoutGenerator(columns, style)` at the bottom of
`contents/code/main.js`. `style` is entirely percentage-based. See that file
for the five shipped layouts and their configuration.

## Repository layout

```text
contents/code/main.js   the KWin script: geometry engine + layouts + shortcuts
metadata.json           KWin package metadata (KPackageStructure: KWin/Script)
scripts/                install / update / uninstall / release / debug helpers
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This project is a fork of
[lucmos/UltrawideWindows](https://github.com/lucmos/UltrawideWindows); the full
history is in [LINEAGE.md](LINEAGE.md).

## License

[GPL-2.0-or-later](LICENSE)