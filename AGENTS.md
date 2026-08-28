# AGENTS.md

Guidance for AI agents working on `fractal-grid`, a KWin scripting plugin for
KDE Plasma 6.

## What this is

A dynamic, ultrawide-optimized window tiling engine written as a KWin Scripting
API plugin (plain JavaScript, no build step). It sits between KDE's floating
windows and a full tiling WM: shortcuts snap the active window into a
percentage-based column grid.

## Repository layout

```text
contents/code/main.js   the whole program: geometry engine + 5 layouts + shortcuts
metadata.json           KWin package metadata (KPackageStructure: KWin/Script)
scripts/*.sh            install / update / uninstall / release / debug
```

`main.js` is a single file. The package is a zip of `contents/`, `LICENSE` and
`metadata.json`, produced by `scripts/release.sh`.

## Design principles

- **One geometry engine.** `gridLayoutGenerator(columns, style)` is the only
  code that computes geometry. A new layout is a new call to it plus a
  `registerShortcut` binding — never new positioning code.
- **Percentages, not pixels.** Every layout value (`horizMarginPct`,
  `columnWidthPercentages`, `minWindowHeightPct`, …) is a percentage of screen
  width or height. Pixels are derived once in `recalculateGeometry()`. Do not
  add a pixel-based layout value.
- **Snap-to-grid, nothing else.** The engine only sets `frameGeometry` on the
  active window (or reorganizes existing windows when stacking). It never
  maximizes, minimizes, focuses, or switches desktops.

## Working principles (things you'll break if you guess)

- `workspace`, `KWin`, `registerShortcut` and `options` are globals supplied by
  KWin. There are no imports and no module system.
- Enumerate windows with `workspace.windowList()`. `workspace.clientList()`
  does not exist. Always filter out `desktopWindow`, `minimized`, `hidden`, and
  windows on other desktops/activities (see `isWindowOnCurrentDesktop` and
  `collectWindowsInColumn`).
- `window.desktops` is an array of `VirtualDesktop` objects (KWin 6), not a
  list of integers. Compare `vd.x11DesktopNumber`.
- Cached screen geometry (`globalMaxArea`) must be refreshed via
  `updateGlobalMaxArea()` when `virtualScreenSizeChanged` fires. Every layout
  you add must be listed in `allLayouts`, or its geometry goes stale on
  dock/undock.
- `registerShortcut(id, description, keys, fn)`: the `description` must start
  with `fractal-grid: ` (so shortcuts are discoverable in System Settings) and
  the `id` must be unique.

## Commands

```text
make build      package fractal-grid.kwinscript
make check      node --check main.js + JSON + shell syntax (needs node)
make install    uninstall + package + install + reload config
make update     same as install
make uninstall  remove the package + its shortcuts
```

There are no unit tests; KWin scripts are exercised interactively. Verify a
change is sane with `make check` (syntax) and by installing it and triggering
the affected shortcut.