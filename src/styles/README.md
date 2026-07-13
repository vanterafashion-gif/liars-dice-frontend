# Styles architecture

Active CSS is intentionally limited to the files imported by `src/main.jsx`.

- `base/`: reset, app layout, orientation guard, boot screen, and shared primitive components.
- `gameplay/`: all Gameplay UI rules, separated into shared, landscape, portrait, states, variables, and controls.
- `screens/`: all non-Gameplay screens, separated into desktop, mobile, portrait, shared, and controls.

For UI positioning changes:

- Gameplay: edit `gameplay/gameplay.controls.css` first.
- Other screens: edit `screens/screens.controls.css` first.
- Orientation-specific structural rules belong in the relevant portrait/landscape file.

Do not create new `fix`, `patch`, or `final` CSS files. Add rules to the existing centralized file.
