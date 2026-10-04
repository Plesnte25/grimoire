# Grimoire design system

This is the source of truth for the daily-use redesign. It supersedes the older
"Nocturne" handoff in `docs/design/README.md`; those screens remain reference
material only.

## Product character

- A private story ledger with the warmth of a well-used spellbook.
- Editorial and intimate: large serif headlines, short kicker labels, direct
  actions, and clear status.
- Posters are the primary visual units: large images, compact captions, and
  enough negative space to make shelves readable.
- Home is a short return point, Library is a filtered index, Discover is for
  quick additions, and You is the library/stats profile.

## Theme

The app is dark-only. Values are drawn from the leather, gold, parchment, and
ribbon-red colors of the Grimoire mark.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#17110d` | Warm near-black page |
| `--s1` | `#2b1f17` | Leather surface |
| `--s2` | `#3d2c20` | Raised leather surface |
| `--s3` | `#513a29` | Hover and selected surface |
| `--tx` | `#efe0bf` | Parchment text |
| `--tx2` | `#d7c3a0` | Secondary parchment |
| `--tx3` | `#b29a74` | Metadata |
| `--acc` | `#f6b73c` | Gold links, focus, progress |
| `--you` | `#c4492c` | Ribbon-red emphasis |
| `--ok` | `#9dc987` | Positive status |
| `--warn` | `#f0c56d` | Warnings |
| `--err` | `#e5795a` | Errors |

## Typography

- Display: Newsreader, weight 500–600, upright.
- Interface: Hanken Grotesk, weights 400–700.
- Script fallbacks: Noto Sans JP, KR and SC; Noto Nastaliq Urdu, loaded only on
  screens which need them. Original titles carry their language; Urdu is
  right-to-left.
- Icons: Material Symbols Rounded.
- Counts and progress use tabular numerals. Body text scales with the user's
  text-size preference.

## Spacing and shape

- 4-point spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Phone page gutter: 20 px. Desktop content gutter: 40 px.
- Inputs and posters: 8–10 px radius; buttons: 12 px; cards: 14–18 px; panels:
  20 px; chips: pill radius.
- Poster grids show about three columns on phones, six on desktop, and up to
  eight on wide screens.

## Motion and interaction

- Short feedback uses a 120 ms ease-out. Dialogs may use a 280 ms ease-out.
- A slow gold/red radial aura breathes behind the app and drifts subtly. It
  pauses while the document is hidden and becomes static with reduced motion.
- Cards lift subtly on hover, page sections reveal in sequence, and small
  feedback animations reinforce progress updates. Motion is never needed to
  understand or use a control.
- Focus is a visible 2 px accent ring with offset; controls have 44 px minimum
  touch targets. Destructive actions retain confirm/undo behavior.
- Avoid heavy blur and 3D tilt; reserve shadows and glow for focus, posters,
  dialogs, and the floating dock.

## Application structure

- Every viewport uses a floating bottom dock for Home, Library, Discover,
  Lists, and You. Search sits at the top right; the gold add button floats
  above the dock.
- Home contains Continue, new releases for followed titles, and Recently added.
  Library type and region filters stay in the URL.
- Detail and franchise pages are content-first records with tracking controls
  in the hero, not tabbed management forms.
- Public share pages remain outside the signed-in shell.

## Exports

`frontend/src/styles/tokens.css` contains the CSS custom properties consumed by
the frontend. Tailwind v3 utilities remain supported during gradual migration.
