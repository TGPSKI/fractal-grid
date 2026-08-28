# Security Policy

## Reporting

Report a suspected vulnerability via a GitHub Security Advisory on this
repository (Security > Advisories > Report a vulnerability). If the report
itself would disclose sensitive data, open an issue that says only that you
have a report and wait to be contacted.

Expect acknowledgement within 7 days and an assessment within 14.

## Scope

fractal-grid is a local KWin script that repositions and resizes windows on the
machine it runs on. It has no network access, reads no files, and handles no
credentials. Security issues are:

- **Moving the wrong window** — repositioning or resizing a window the operator
  did not intend to move, or one the collision detector should have excluded
  (minimized, hidden, other-desktop, other-activity, the desktop background).
- **Leaking geometry or window state.** The script writes debug logs only when
  `debug` is `true`, and `debug` ships as `false`. Shipping it `true` by
  default is a vulnerability.

Out of scope: the security of KWin and KDE Plasma themselves, and the contents
of windows (the script reads only frame geometry and desktop/activity
membership, never window contents).

## Supported versions

Only the tip of `main` is supported. No stable releases yet.

## Known limitations

- The script trusts KWin's reported frame geometry and desktop/activity
  membership; it performs no independent validation of those values.