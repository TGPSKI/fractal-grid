# Lineage

fractal-grid is a fork of
[lucmos/UltrawideWindows](https://github.com/lucmos/UltrawideWindows), a
GPL-2.0 KWin script for moving windows on ultrawide monitors. The upstream
kept a large set of hard-coded per-position shortcuts; this project replaced
that with a single composable layout engine.

## What was inherited

- The KWin package shape: `contents/code/main.js`, `metadata.json`, and the
  `install` / `update` / `uninstall` shell-script lifecycle around
  `kpackagetool6`, `kwriteconfig6` and `qdbus6`.
- The shortcut-driven interaction model: position the active window with a key
  binding.
- The GPL-2.0 license.

## What is new

- **`gridLayoutGenerator(columns, style)`** — one engine instead of a
  per-shortcut routine. A layout is a small configuration object.
- **Percentage-based geometry** — column widths, margins, padding, spacing and
  minimum sizes are all percentages of the screen, so layouts survive
  resolution and DPI changes.
- **Smart stacking** — a column with rows enabled fills, splits, or appends
  windows automatically.
- **Takeover mode** — expand a window across adjacent columns.
- **Frame margins and per-column padding** — layouts that don't maximize the
  full screen.
- **Multi-desktop / multi-activity collision detection** — filtering out
  minimized, hidden and other-desktop windows.

## License consequence

Upstream is GPL-2.0, so fractal-grid is distributed under
GPL-2.0-or-later.