# Consolidated screen styles

These files control every non-gameplay screen.

- `screens.desktop.css`: desktop layouts.
- `screens.mobile.css`: mobile and landscape layouts.
- `screens.portrait.css`: portrait-only overrides.
- `screens.shared.css`: shared screen states and responsive behavior.
- `screens.controls.css`: new global controls and safe-area variables.

The original CSS files are retained as inactive references and are no longer imported by `main.jsx`.
Do not add new `*-fix.css` or `*-patch.css` files. Put permanent changes in the appropriate consolidated file.
