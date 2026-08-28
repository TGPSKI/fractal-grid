---
name: fractal-grid-shortcuts
description: "Add, remove, or rebind fractal-grid keyboard shortcuts. Edits the registerShortcut block at the bottom of contents/code/main.js. Use when a binding conflicts, a layout has no shortcut, or the default keys don't fit."
metadata:
  author: fractal-grid
  version: "1.0"
compatibility: "KDE Plasma 6 (KWin Scripting), node + python3 for make check"
---

# fractal-grid shortcuts

Bind a layout to keys, change a binding, or remove one.

## The rule

`registerShortcut(id, description, keys, fn)`:

- `id` is unique across the file and stable once shipped — renaming it
  orphans the user's saved binding in `kglobalshortcutsrc`.
- `description` starts with `fractal-grid: ` so the shortcut is
  discoverable in System Settings > Shortcuts.
- `fn` calls a layout's `place(columnIndex)` — never raw positioning.

The `keys` argument is only the **default**. KDE remembers the user's
custom rebinding, so editing the default here does not overwrite what they
already set.

## Prerequisites

- The layout the shortcut targets already exists (see
  `fractal-grid-layout`).
- `make check` runs.

## Step 1 — Inspect

Read the **KEYBOARD SHORTCUTS** section at the bottom of
`contents/code/main.js` — the only place shortcuts are registered.

| Status | Action |
|---|---|
| Key the user wants is already bound by another shortcut | Pick different keys, or fold the user's intent into that shortcut |
| Target layout has no shortcut | Add one |
| Shortcut exists, wants different default keys | Edit its `keys` argument |
| Shortcut no longer wanted | Delete the whole `registerShortcut(...)` block |

## Step 2 — Decide

Ask only what the user must choose; the rest is derived:

| Question | Notes |
|---|---|
| Which layout / `place(...)` call? | Read it off `main.js`; do not guess |
| What keys? | KWin format, e.g. `Ctrl+Alt+Meta+E`, `Ctrl+Alt+Meta+,` — check the Step 1 table first |
| What label? | Keep the `fractal-grid: <layout> <position>` shape |

## Step 3 — Generate

```javascript
registerShortcut("MyLayoutLeft", "fractal-grid: My Layout Place Left", "Ctrl+Alt+Meta+Q", function () {
    myLayout(0);
});
```

Place it with the other shortcuts for that layout. When re-adding a
removed binding, reuse the old `id` so saved bindings survive.

## Validate

```bash
make check
```

`make check` proves the syntax; it does not catch binding conflicts. Those
surface in System Settings > Shortcuts after `make install` (which runs the
kglobalaccel cleanup). A shortcut only appears there once the package is
installed.

## PR Checkpoint

**Title**: `<Add|Change|Remove> shortcut for <layout>`

**Files to include**:
- `contents/code/main.js`

## What not to do

- Do not reuse an existing `id`.
- Do not write an `fn` body that reaches for `workspace` or geometry — call
  `layout(columnIndex)`.
- Do not drop the `fractal-grid: ` prefix.