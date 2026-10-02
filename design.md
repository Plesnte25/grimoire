# Grimoire design system

The frontend follows the approved Grimoire UI handoff in `docs/design/README.md`.
This file is the source of truth for shared visual decisions; page redesigns
extend it rather than inventing new themes.

## Product character

- Genre: editorial, used for a private media library rather than marketing.
- Voice: considered and quiet; labels are direct, status is explicit, and the
  user's own ratings are visually distinct from provider scores.
- App pages: an index-first workbench. Home is a quick return to the library;
  Library is the navigation hub; You gathers personal activity and settings.
- Catalogue pages: content-first grids and detail records. Existing route and
  component ownership stays intact.

## Theme

The dark and light values are calibrated from the approved handoff palette.
Dark is the default; System follows the operating-system preference.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `oklch(15.21% 0.0107 285.1)` | `oklch(97.07% 0.0095 299.2)` | Page |
| `--s1` | `oklch(18.96% 0.0202 293.5)` | `oklch(100% 0 0)` | Cards, sidebar, inputs |
| `--s2` | `oklch(23.71% 0.0473 291.6)` | `oklch(93.88% 0.0218 297.4)` | Selected surfaces |
| `--s3` | `oklch(28.43% 0.0595 290.5)` | `oklch(89.18% 0.0359 296.2)` | Dialogs, raised controls |
| `--line` | `oklch(96.45% 0.0189 295.9 / 11%)` | `oklch(18.96% 0.0202 293.5 / 12%)` | Dividers |
| `--line2` | `oklch(96.45% 0.0189 295.9 / 22%)` | `oklch(18.96% 0.0202 293.5 / 24%)` | Control borders |
| `--tx` | `oklch(96.45% 0.0189 295.9)` | `oklch(15.21% 0.0107 285.1)` | Primary text |
| `--tx2` | `oklch(81.45% 0.0491 293.1)` | `oklch(34% 0.04 291)` | Secondary text |
| `--tx3` | `oklch(69.46% 0.0643 291.9)` | `oklch(48% 0.05 291)` | Metadata |
| `--acc` | `oklch(74.27% 0.1200 290.3)` | `oklch(39.36% 0.1048 288.5)` | Links, focus, progress |
| `--accbg` | `oklch(39.36% 0.1048 288.5)` | `oklch(39.36% 0.1048 288.5)` | Primary action |
| `--you` | `oklch(81.64% 0.1081 336.6)` | `oklch(50.83% 0.1668 345)` | Personal ratings |
| `--ok` | `oklch(82.55% 0.1035 160.9)` | `oklch(46% 0.11 160.9)` | Positive status |
| `--warn` | `oklch(84.33% 0.1178 81.9)` | `oklch(48% 0.11 81.9)` | Warnings |
| `--err` | `oklch(79.03% 0.1213 20.1)` | `oklch(50% 0.16 25)` | Errors |

## Typography

- Display: Newsreader, weight 500–600, upright.
- Interface: Hanken Grotesk, weights 400–700.
- Script fallbacks: Noto Sans JP, KR and SC; Noto Nastaliq Urdu. Original titles
  carry their language; Urdu is right-to-left.
- Icons: Material Symbols Rounded, outlined by default.
- Counts and progress use tabular numerals.
- Body text is 1rem-based so the appearance text-size control scales with the
  root size.

## Spacing and shape

- 4-point spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Phone page gutter: 20 px. Desktop content gutter: 40 px.
- Inputs and posters: 8–10 px radius; buttons: 12 px; cards: 14–18 px; panels:
  20 px; dialogs: 22 px; chips: pill radius.
- Depth comes from solid surface steps, not blur. Shadows are reserved for
  posters, dialogs and toasts.

## Motion and interaction

- Short feedback uses a 120 ms ease-out. Dialogs may use a 280 ms ease-out.
- Reduced-motion preference disables spatial transitions and non-essential
  animation.
- Focus is a visible 2 px accent ring with offset; controls have 44 px minimum
  touch targets.
- Success is quiet. Destructive actions retain their existing confirm/undo
  behavior.
- No glass, backdrop blur (except a future spoiler shield), or 3D tilt.

## Application structure

- Desktop: fixed 256 px side navigation and a compact top search/action bar.
- Phone: five-item bottom navigation for Home, Library, Search, Lists and You.
- Home, Library and You are app surfaces. Category and record pages keep their
  existing routes and content ownership.
- Existing routes, data fetching and application behavior are preserved.

## Exports

`frontend/src/styles/tokens.css` contains the CSS custom properties consumed by
the frontend. Tailwind v3 utilities remain supported during gradual migration.
