---
name: fractal-grid-install
description: "Install, upgrade, or remove the fractal-grid KWin package on a machine. Runs the make targets that drive kpackagetool6, kwriteconfig6 and qdbus6, and verifies the script actually loads. Use on a fresh machine, after pulling an update, or when removing it."
metadata:
  author: fractal-grid
  version: "1.0"
compatibility: "KDE Plasma 6 — kpackagetool6, kwriteconfig6, qdbus6"
---

# fractal-grid install

Make the package present and loaded on this machine, or gone.

**You are changing a machine, not a repository.** Progress is measured by
what `kpackagetool6` and `qdbus6` report, not by what you remember running.

## Prerequisites

- A clone (`make install` builds from `contents/`) or a released
  `fractal-grid.kwinscript`.
- KDE Plasma 6 with `kpackagetool6`, `kwriteconfig6`, `qdbus6` on `PATH`.
- A running KWin session — this is not headless.

## Step 1 — Inspect

```bash
command -v kpackagetool6 kwriteconfig6 qdbus6
kpackagetool6 --type KWin/Script --list | grep fractal-grid
```

| Status | Action |
|---|---|
| `kpackagetool6` (or the others) missing | Stop — install the KDE packaging tools first |
| `fractal-grid` already listed | This is an upgrade or a reinstall, not a first install |
| `fractal-grid` not listed | Fresh install |

## Step 2 — Decide

| Operator wants | Run | Notes |
|---|---|---|
| First install | `make install` | uninstalls first, so it is also the reinstall path |
| Upgrade (pull, then reload) | `make update` | identical to `make install` in this repo |
| Remove | `make uninstall` | unloads, removes the package, deletes the plugin key, cleans shortcuts |

The scripts take no arguments. `make install` and `make update` both build
the `.kwinscript` from `contents/` and then reload KWin.

## Step 3 — Run and verify

```bash
make install   # or make update / make uninstall
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.isScriptLoaded fractal-grid
```

| Verification | Meaning |
|---|---|
| `isScriptLoaded` returns `true` | Working |
| `install.sh` printed `Failed to load fractal-grid` and exited 1 | Config reloaded, script did not load — see below |
| Loaded, but shortcuts missing | kglobalaccel cleanup did not take — see below |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `loadScript` returned 0 (install failed) | Run `make update` again — it is a reload race; if it persists, log out and back in |
| Shortcuts absent from System Settings | `qdbus6 org.kde.kglobalaccel /component/kwin org.kde.kglobalaccel.Component.cleanUp`, then reopen Shortcuts |
| `make uninstall` prints "Already uninstalled" | Already gone — nothing to do |

## Done

Tell the user what is now true — package installed/uninstalled, script
loaded or not — and that behavior changes come from the
`fractal-grid-layout` / `fractal-grid-shortcuts` skills, while this one only
puts the current `main.js` into KWin.