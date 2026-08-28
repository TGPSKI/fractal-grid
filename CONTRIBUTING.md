# Contributing

## Setup

```sh
git clone git@github.com:TGPSKI/fractal-grid.git
cd fractal-grid
make build          # package fractal-grid.kwinscript
```

KDE Plasma 6 with `kpackagetool6`, `kwriteconfig6` and `qdbus6`. There is no
build system: the package is a zip of `contents/`, `LICENSE` and
`metadata.json`. `make check` additionally needs `node` and `python3`.

## Commands

| command | what it does |
|---|---|
| `make build` | package `fractal-grid.kwinscript` |
| `make check` | JS syntax, JSON validity, shell syntax |
| `make install` | uninstall + package + install + reload config |
| `make update` | same as `make install` |
| `make uninstall` | remove the package + its shortcuts |
| `make clean` | remove the built `.kwinscript` |

## Making a change

A change is one of two kinds:

1. **A new layout or tweak** — add a `gridLayoutGenerator(columns, style)`
   config and bind it with `registerShortcut(...)`. No engine changes.
2. **An engine change** — anything in `gridLayoutGenerator` or its helpers
   affects every layout. State the constraint that motivated it and test it
   against more than one screen size.

All geometry is percentage-based. A new layout keeps every value a percentage
of screen width or height.

## Shelling out

The script runs inside KWin's JS engine: `workspace`, `KWin` and
`registerShortcut` are globals and there are no imports. `node --check` only
parses — it won't catch a missing KWin global. Verify behavior interactively
(`scripts/debug.sh` opens `plasma-interactiveconsole`; see
<https://develop.kde.org/docs/plasma/kwin/>).

## Window and desktop handling

Collision detection must keep filtering out `desktopWindow`, `minimized`,
`hidden`, and windows on other desktops/activities. `workspace.windowList()`
is the enumeration API; `workspace.clientList()` does not exist.

## Pull requests

- `make check` passes.
- Layout values stay percentages.
- Commit subject: one imperative line under 72 columns naming what changed.