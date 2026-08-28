---
name: fractal-grid-layout
description: "Create or tune a fractal-grid window layout. Edits the percentage-based gridLayoutGenerator config in contents/code/main.js and registers it so it reflows on screen changes. Use when someone wants a new column layout, different margins, or per-column stacking behavior."
metadata:
  author: fractal-grid
  version: "1.0"
compatibility: "KDE Plasma 6 (KWin Scripting), node + python3 for make check"
---

# fractal-grid layout

Add a layout or change an existing one. A layout is exactly one
`gridLayoutGenerator(columns, style)` object in `contents/code/main.js` —
no other geometry code exists, and none should.

## The rule: three touch points

A layout is not done until it appears in **three places** in
`contents/code/main.js`:

1. one `gridLayoutGenerator(columns, { ... })` config in the
   **LAYOUT CONFIGURATIONS** section,
2. at least one `registerShortcut(...)` whose callback calls its
   `place(columnIndex)` (see the `fractal-grid-shortcuts` skill), and
3. its name in the `allLayouts` array.

Missing 1 = nothing to call. Missing 2 = the layout is unreachable.
Missing 3 = it places windows until the first dock/undock, then goes stale.

## Prerequisites

- A clone of the repo (or edit `contents/code/main.js` in place).
- `make check` runs (`node` + `python3` are present).
- Know roughly how many columns you want and how wide each should be.

## Step 1 — Inspect

Read the bottom of `contents/code/main.js`:

- The `gridLayoutGenerator` JSDoc (immediately above the function) is the
  field reference: every `style` key is defined there with its default and
  unit. Treat it as the source of truth; do not re-type a field list from
  memory.
- The **LAYOUT CONFIGURATIONS** section holds the existing layouts
  (`threeCol`, `twoColHealthyMargins`, `twoColWithRows`,
  `twoColWithRowsFramed`, `framedThreeCol`). Copy the closest one as the
  starting point instead of writing from scratch.
- The `allLayouts` array closes the section.

| Status | Action |
|---|---|
| Adjusting an existing layout | Edit that config in place |
| Adding a new layout | Copy the closest existing config and rename it |
| Chosen name already exists | Stop — pick a distinct name before continuing |

## Step 2 — Decide

Ask only what you cannot read off the screen. Every value is a percentage:
horizontal keys are % of screen width, vertical keys % of screen height.

| Question | Default |
|---|---|
| Number of columns? | 3 |
| Column widths (must sum to ~100%)? | `[29, 57, 12]` |
| Smart stacking per column (`enableRows`)? | `[0, 0, 0]` — disabled |
| Takeover per column (`enableTakeover`)? | `[0, 0, 0]` — disabled |
| Margins, spacing, frame, padding? | copy the nearest existing layout |

Do not invent a percentage to hit a guessed pixel size — the existing
layouts' comments already translate percentages to pixels per screen size
(e.g. `~50px on 3840px width`). Convert that way, then keep the value as a
percentage.

## Step 3 — Generate

Write the config into the **LAYOUT CONFIGURATIONS** section and add its
name to `allLayouts`. Match the key order of the existing layouts:

```javascript
const myLayout = gridLayoutGenerator(3, {
    horizMarginPct: 1.3,
    vertMarginPct: 2.6,
    columnWidthPercentages: [29, 57, 12],
    enableTakeover: [1, 1, 0],
    enableRows: [0, 0, 1],
    rowVertMarginPct: 1.0,
    minWindowHeightPct: 5.2,
    frameHorizMarginPct: 0,
    frameVertMarginPct: 0,
    columnPaddingPct: false
});
```

If the user wants it bound to keys, hand off to the
`fractal-grid-shortcuts` skill before finishing this change.

## Validate

```bash
make check    # node --check main.js, JSON valid, shell scripts parse
```

## PR Checkpoint

**Title**: `Add <name> layout` (or `Tune <name> layout`)

**Files to include**:
- `contents/code/main.js`

## What not to do

- No pixel layout values. If a number is not a percentage of screen width
  or height, it does not belong in a `style` object.
- Do not forget `allLayouts`.
- Do not write new positioning code. New geometry is new configuration,
  never a new function.