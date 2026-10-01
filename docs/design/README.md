# Handoff: Grimoire UI (design system + key screens)

## Overview
Grimoire is a private, single-user media tracker covering movies, TV, anime and books, plus four regional categories: Turkish Dizi, Pakistani Dramas, K-Drama and European. This bundle defines:
- the visual system: tokens, type and components
- the four key screens, each at **390 px** (phone) and **1440 px** (desktop):
  1. Home
  2. Category (Anime)
  3. Detail (ONE PIECE)
  4. Log / finish sheet (Your Name.)

The full product scope, including the screens not designed yet, is in `DESIGN_BRIEF.md`.

## About the Design Files
The `.dc.html` files are **design references built in HTML**. They show the intended look and behaviour; they are not production code. Recreate them in the target codebase's own stack, following its existing patterns. If there is no codebase yet, React + TypeScript + a PWA setup is recommended (the brief requires installability).

To view a file, open it in a browser with `support.js` alongside it. Each file is a pan/zoom canvas of artboards.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and copy are final. Reproduce layout, labels and chart types literally.

Two exceptions are placeholders:
- **Images:** striped blocks stand in for TMDB/AniList poster and backdrop images.
- **Online scores:** the numbers are invented. Pull real values from the providers.

---

## Core visual rules (do not break)
1. **The chrome recedes.** Surfaces are near-black (dark) or near-white (light). Posters supply the colour. No glassmorphism, no 3D tilt, and no blur except the spoiler shield.
2. **Lavender (`--acc`) means action.** Use it for links, focus rings, progress fills, selected filters and the airing badge.
3. **Pink (`--you`) and the ✦ sigil mean "you".** Reserve them for your rating, favourites and history ratings. Never use pink for online or crowd scores.
4. **Online scores** are neutral text (`--tx`) with vote counts in `--tx3`, grouped under the overlines `ONLINE · AUDIENCE` and `ONLINE · CRITICS`. When a score has too few votes, show the text "Not enough ratings" instead of a number.
5. **Depth comes from surface steps** (`bg → s1 → s2 → s3`), not shadows. Shadows are only for posters, dialogs and toasts.
6. **Badges on posters are solid**, never translucent, so they stay readable on any image.

## Design Tokens

### Colour (CSS custom properties; theme class on root)
| token | dark | light | use |
|---|---|---|---|
| `--bg` | `#0b0b10` | `#f6f4fb` | page |
| `--s1` | `#14121c` | `#ffffff` | cards, sidebar, sheets, inputs |
| `--s2` | `#1f1a33` | `#ece8f8` | callouts, active nav, tag chips, selected flag chip |
| `--s3` | `#2a2445` | `#ddd7f1` | dialogs, selected segment |
| `--line` | `rgba(227,222,254,.11)` | `rgba(28,23,48,.12)` | dividers, card borders |
| `--line2` | `rgba(227,222,254,.22)` | `rgba(28,23,48,.24)` | control borders, empty progress track |
| `--tx` | `#f4f1ff` | `#0b0b10` | primary text |
| `--tx2` | `#c3bde0` | `#433d5e` | secondary text |
| `--tx3` | `#9d96c2` | `#5e5880` | meta / captions (≥ 6.4:1) |
| `--acc` | `#ab9ef2` | `#4d4189` | links, focus, progress, airing |
| `--accbg` | `#5a4ca0` | `#453a7a` | primary button fill (text `#ffffff`) |
| `--you` | `#f0a8dd` | `#a3327b` | your rating, ✦ |
| `--youbg` | `rgba(240,168,221,.13)` | `#fbe6f3` | "You" rating panel |
| `--ok` | `#86dbb0` | `#1d7349` | Watching dot |
| `--warn` | `#f2c46d` | `#875700` | "Contains spoilers", offline icon |
| `--err` | `#ff9a9a` | `#b3261e` | errors, destructive outline |
| `--scrim` | `rgba(5,4,10,.72)` | `rgba(11,11,16,.5)` | sheet/dialog backdrop |

Fixed colours (the same in both themes):
- **Badges:** NEW is `#f4f1ff` with `#0b0b10` text. Airing is `#8b7ae0` with `#0b0b10` text. Ended, Caught up, Dub and the rating badge use `rgba(11,11,16,.86)` with `#f4f1ff` text (pink `#f0a8dd` for the rating). 18+ is `#ffb4b4` with `#0b0b10` text.
- **Toast:** `#f4f1ff` background, `#0b0b10` text, Undo in `#453a7a` at weight 700.
- **Destructive confirm button:** `#c9433a` with white text.
- **Heatmap ramp:** `--s2`, `#453a7a`, `#6f5fc4`, `#ab9ef2`.
- **Tier colours:** S `#f0a8dd`, A `#ab9ef2`, B `#86dbb0`, C `#f2c46d`, D `#9d96c2`.
- **Logo palette, for reference:** ink `#0b0b10`, deep violet `#1c1730`, violet `#453a7a`, lavender `#8b7ae0`, mist `#e3defe`, petal `#f0a8dd`, paper `#f4f1ff`.

Theme setting: System / Light / Dark. "System" follows `prefers-color-scheme`.

### Typography
- **Newsreader** (Google Fonts, opsz 6–72, weights 400–600, plus italic): wordmark, page titles, item titles, section-scale scores, dialog titles, empty-state headings.
- **Hanken Grotesk** (400/500/600/700): all other interface text.
- **Script fonts:**
  - Japanese: Noto Sans JP
  - Korean: Noto Sans KR
  - Simplified Chinese: Noto Sans SC
  - Urdu: Noto Nastaliq Urdu, always with `dir="rtl"`
- **Icons:** Material Symbols Rounded (outlined; `FILL 1` for the active tab).
- **Numbers:** use `font-variant-numeric: tabular-nums` for all counts and progress.

| role | spec |
|---|---|
| Display (page H1) | Newsreader 500, 44/1.0, −0.015em (phone: 32) |
| Title XL (detail hero) | Newsreader 600, 60/1.0 (phone: 30) |
| Heading | Newsreader 500, 30/1.1 |
| Section | Grotesk 600, 17–18/1.2 |
| Body | Grotesk 400, 15/1.55 (desktop synopsis 16/1.6) |
| Meta | Grotesk 500, 13/1.35 |
| Overline | Grotesk 700, 11/1.0, +0.1em, uppercase |
| Score | Newsreader 600, 40–44/1.0 |
| Badge | Grotesk 700, 10–11/1.0, +0.03–0.05em |

**Bilingual title block:**
- English title first.
- Original title directly below in its script font at about 0.55× the title size, colour `--tx2`, with a `lang` attribute (`tr`, `ja`, `ko`, `zh-Hans`, `ur`).
- Urdu goes in its own right-aligned `dir="rtl"` box at 18px with line-height 2.1, because Nastaliq needs the extra height.
- In cards, the original title is 11–13px in `--tx3`.

**Text-size setting:** scale the root size; don't hard-code px in the implementation (use rem).

### Spacing, radius, elevation
- **Spacing:** 4-pt base: 4, 8, 12, 16, 24, 32, 48, 64.
- **Gutters:**
  - Phone side padding: 20.
  - Desktop main area: 24 top, 40 sides, 40 bottom.
  - Gap between desktop columns: 36.
- **Radius:**

  | radius | used on |
  |---|---|
  | 5–6 | badges |
  | 8–10 | posters, inputs |
  | 12 | buttons |
  | 14–18 | cards |
  | 20 | panels |
  | 22 | dialogs |
  | 26 | sheet top corners |
  | 999 | chips |
- **Shadows:**
  - Poster on hero: `0 12px 30px rgba(0,0,0,.5)`; desktop `0 20px 50px rgba(0,0,0,.55)`.
  - Dialog: `0 40px 80px rgba(0,0,0,.5)`.
  - Toast: `0 12px 30px rgba(0,0,0,.4)`.
  - Menu: `0 16px 40px rgba(0,0,0,.4)`.
- **Franchise stack effect:** `box-shadow: 6px -6px 0 -2px #2a2445, 12px -12px 0 -5px #1f1a33`, plus `margin-top: 12px` on the poster.

### Motion (every animation has a reduced-motion alternative)
| motion | spec | with `prefers-reduced-motion` |
|---|---|---|
| Tap feedback | 120ms ease-out | colour change only |
| Sheet / dialog | 280ms `cubic-bezier(.2,.8,.2,1)`, slides up / scales from .98 | 150ms fade |
| Progress fill | 320ms ease-out | jumps to the new value |
| Skeleton pulse | opacity .55 → 1 → .55, 1.4s, 0.15s stagger | static |
| Wrapped stories | 400ms crossfade + parallax | crossfade only |

### Accessibility
- **Focus ring:** 2px solid `--acc` with a 2–3px offset on every interactive element. Text inputs use a 2px `--acc` border when focused.
- **Touch targets:** at least 44×44 on phone. Desktop secondary controls may be 40.
- **Rating input:** `role="slider"`, `aria-valuetext="9.5 out of 10"`, arrow keys step by 0.5, Delete/Backspace clears it.
- **Icon-only buttons** need an `aria-label`.
- **Flags** are `<img>` with the country name as `alt`. Inside filter chips, where the code is printed next to the flag, use an empty alt.

---

## Screens

### Shared chrome
**Phone (390)**
- Status bar 44 tall.
- **Bottom tab bar:** a 5-column grid; top border `--line`; padding 4 4 22; each tab 54 tall.
  - Icon 24, label Grotesk 600 11.
  - Active tab: `--tx` with filled icon. Inactive: `--tx3`.
  - Tabs: Home `home` · Library `video_library` · Search `search` · Lists `format_list_bulleted` · You `person`.
- Overlays use bottom sheets.

**Desktop (1440)**
- Grid `256px | 1fr`.
- **Sidebar:** `--s1` background, right border `--line`, padding 22 12.
  - Wordmark: lavender ✦ plus "Grimoire" in Newsreader 600 23.
  - Nav items: 44 tall, radius 10, padding 0 12, icon 21, label Grotesk 500 15.
  - Active item: `--s2` background, `--tx` text, weight 600, icon in `--acc`.
  - Library sub-items: 36 tall, 45px left indent, 14px label, count in `--tx3` 12 (right-aligned), and an "N new" pill (`--acc` background, `#0b0b10` text, 700 10).
  - Footer: "Lock now" with the `lock` icon.
- **Top bar:**
  - Search field: max-width 560, 44 tall, `--s1` background, `--line2` border, radius 12; placeholder "Search films, shows, anime, books…"; `/` shortcut chip.
  - Right side: secondary "Watch tonight" button and primary "Log" button (both 44 tall).

Sidebar categories and counts used in the mocks:

| category | count | new |
|---|---|---|
| Movies | 412 | |
| TV | 168 | 2 new |
| Anime | 214 | 3 new |
| Books | 96 | |
| Turkish Dizi | 14 | 1 new |
| Pakistani Dramas | 9 | |
| K-Drama | 31 | |
| European | 27 | 1 new |

### 1. Home (artboards 1a dark, 1b light, 1c desktop)
**Header**
- Date line "Thursday, 1 October" (meta, `--tx3`).
- H1 "Up next".
- Phone header row: wordmark plus a 44px `auto_awesome` icon button that opens What to watch tonight.

**Ready to watch · N** (new content you haven't seen)
- Card layout:
  - Card: `--s1` background, `--line` border, radius 18.
  - Backdrop is 16:9 (phone: 292×146). Badge sits top-left at 10–12px.
  - Body padding 12–14 / 14–16, containing:
    - flag (18×12, radius 2) + title (600 16–17) + original title (`--tx3`)
    - line (500 14)
    - sub (400 13, `--tx3`)
    - actions: primary button with a contextual label, plus a 44px `snooze` button
- Example cards:

  | title | badge | line | sub | primary action |
  |---|---|---|---|---|
  | Reacher | NEW S4 | "Season 4 is out · 8 episodes" | "You finished S3 in Mar 2025" | ▶ "Start S4 E1" |
  | ONE PIECE ワンピース | 12 NEW EPS | "12 new episodes · 1170–1181" | "You're on Ep 1169" | ✓ "Log Ep 1170" |
  | John Wick: Chapter 5 | NEW FILM | "Out now · next in your collection" | "You rated Chapter 4 ✦ 8.0" | "Mark watched" |
- Layout: horizontal scroll on phone; 3-column grid on desktop.
- The snooze button opens a menu: Snooze 1 day / 1 week / until next episode / Dismiss.

**Coming soon**
- One card holding rows, divided by `--line`.
- Each row: date block (46 wide, `--s2`, radius 10; weekday in Grotesk 700 10 with +.08em tracking in `--acc`; day number in Newsreader 600 18), then title + original title, then what's coming, then a "when" pill (`--line2` border, 600 12).
- Rows:
  - ONE PIECE · Ep 1182 · SUN 4 · "in 3 days"
  - Lord of Mysteries 诡秘之主 · Season 2 · Ep 1 · SAT 17 · "in 16 days"
  - Reacher · Season 5 · renewed · TBA · "date TBA"

**Continue**
- Row layout: poster 44×66 (desktop 52×78), then flag + title, then position text, then a 4px progress bar (`--line2` track, `--acc` fill), then a quick-increment button ("+1" for episodes, "+10" for pages).
- Rows:
  - Diriliş: Ertuğrul · S3 · Ep 41 of 76 · 54%
  - The Kite Runner · p. 212 of 371 · 57%
  - Dark · S2 · Ep 3 of 8 · 38%
  - Meray Paas Tum Ho · Ep 18 of 23 · 78%
- Layout: list on phone; 2-column grid of cards on desktop.

**Tonight card**
- `--s2` background, radius 18.
- Title: Newsreader italic 500 22 "What should I watch tonight?".
- Desktop shows preset chips: "~2 hours" (selected, `--bg` fill), "Light", "Any country".
- Button: "Find something" on phone, "Show 3 picks" on desktop.

**2026 goals**
- Each goal: label, value, and a 6px bar.
- Goals: 50 films 34/50 · 12 books 9/12 · Finish 5 backlog anime 2/5.

**Rewatch nudge**
- Bordered card containing a poster and the text "Three years ago you rated **Your Name.** ✦ 10. Time for a rewatch?"
- Buttons: "Add to tonight" (secondary) and "Not now" (text).

**Favourites ✦**
- Shelf of posters: 92px wide on phone; an 8-column grid on desktop.

**Desktop layout:** `1fr | 360px`. The left column has Ready, Continue and Favourites. The right rail has Coming soon, Tonight, Goals and Nudge.

### 2. Category: Anime (2a phone, 2b desktop)
**Header**
- Phone: "‹ Library" back button and a sort button.
- H1 "Anime" with "214 titles" (desktop: "214 titles · 3 new").
- Desktop also shows "Sort Recently updated ▾" and a grid/list toggle.

**Sub-tabs** (underline style, 44 tall, active tab has a 2px `--tx` underline)
- Series 186 · Movies 28 · 18+ (hidden, `visibility_off` icon in `--tx3`).
- Regional categories get Series / Movies only.

**Filters**
- Search field "Search anime" plus a filter button with a count badge.
- **Status chips** (36 tall, pill shape): All 186 (selected: `--tx` fill, `--bg` text) · Watching 6 · Completed 112 · Planned 51 · Paused 4 · Dropped 11.
- **Country flag chips:** JP and CN selected (`--s2` fill, `--acc` border); KR unselected.
- Desktop also has Genre ▾, Tags ▾ and "Clear", with 1px dividers between groups.

**Grid**
- Phone: 3 columns, gaps 18/12. Desktop: 6 columns, gaps 28/20.
- Poster card:
  - 2:3 poster, radius 8–10.
  - Badge top-left, flag top-right (with a 1px dark outline), rating badge bottom-left (`✦ 9.5`), DUB bottom-right.
  - Text below: title (600 13–14), original title (12, `--tx3`), and one meta line (12, `--tx2`): franchise counts, status or season info.
- Titles and badges in the mock:

  | title | badge | your rating | meta / extras |
  |---|---|---|---|
  | ONE PIECE | Ep 1182 · Sun (airing) | 9.5 | **franchise**, "3 films · 1 special" |
  | Demon Slayer | Caught up | 8.5 | **franchise**, "4 seasons · 1 film" |
  | Lord of Mysteries | S2 · 17 Oct | 9.0 | CN, ONA |
  | Frieren | NEW S2 | 10 | |
  | Jujutsu Kaisen | | 8.0 | **franchise**, DUB |
  | Link Click | Ended | 9.0 | CN |
  | Vinland Saga | Ended | 9.5 | |
  | Attack on Titan | Ended | 9.0 | |
  | The Apothecary Diaries | NEW S3 | not rated | |
  | Dandadan | | 8.5 | DUB |
  | Solo Leveling | Caught up | 7.5 | DUB |
  | Spy×Family | | | Planned |
- **Franchise tiles** use the stack effect and open the Franchise page.
- **Collection tiles** (movies) show a 2×2 poster mosaic; see the design system page.

### 3. Detail: ONE PIECE (3a phone, 3b desktop)
**Hero**
- Backdrop: 300 tall on phone, 420 on desktop.
- Gradient overlay: `linear-gradient(180deg, rgba(11,11,16,.35) 0%, transparent 30%, rgba(11,11,16,.2) 60%, #0b0b10 100%)`.
- Optional poster-accent tint: `linear-gradient(90deg, <poster dominant colour> @55% opacity, transparent 70%)`. Sample the colour from the poster and keep it dark (around L 0.35 in oklch). This is the `posterAccent` tweak.
- Poster: 108×162 on phone (overlapping the backdrop by 92px); 184×276 on desktop.
- Breadcrumb "ONE PIECE franchise ›" in `--acc` (desktop: "Anime › ONE PIECE franchise ›").
- Title "ONE PIECE" with "ワンピース" beside it.
- Meta line: 🇯🇵 Japan · 1999– · Anime · TV · 24 min · 1,181 eps · Toei Animation, plus an AIRING badge on desktop.
- Desktop hero actions: "Add to list" and a `more_horiz` menu containing **Move to…** and **Delete** (confirm dialog, then a toast with Undo).
- Phone: floating 44px round back and more buttons with a `rgba(11,11,16,.6)` background.

**Airing banner**
- `--s2` background, radius 14, `event_upcoming` icon in `--acc`.
- Text: "Ep 1182 airs Sun 4 Oct", then "09:30 JST · in 3 days · 12 aired since your last".
- Desktop adds a "Remind me" button.

**Status and log**
- Two equal 48px buttons.
- Status selector: dot + "Watching" + ▾ (`--s1` background, `--line2` border).
- Primary button: ✓ "Log Ep 1170".
- Status menu wording: Watching/Reading · Completed/Read · Planned/Want to read · Paused · Dropped. Dot colours: ok, acc, tx3, warn, err.

**Progress card**
- Header "Progress" with "Ep 1,169 / 1,181 · 99%".
- 6px bar.
- Stepper: −, value, + (44px buttons).
- "Edit total episodes" link for overriding the total.

**Ratings, two separate blocks**
- **You:** `--youbg` panel, radius 16.
  - Overline "✦ YOU" in `--you`, with "Rated 2 Mar 2026 · Clear" on the right.
  - Score "9.5" in Newsreader 600 40–44 `--you`, followed by "/ 10".
  - **10-cell input:** each cell is 24–28 tall (44 in the log sheet), with a 4px gap and radius 5. A filled cell is `--you`; a half step fills half the cell (`linear-gradient(90deg, var(--you) 50%, var(--line2) 50%)`); an empty cell is `--line2`.
- **Online:** bordered panel.
  - "ONLINE · AUDIENCE": AniList 87% (412k) · MyAnimeList 8.73 (2.5M) · TMDB 8.7 (5.1k) · IMDb 9.0 (276k). Phone uses a 2-column grid; desktop uses rows.
  - "ONLINE · CRITICS": Rotten Tomatoes and Metacritic both show "Not enough ratings".
- Desktop right rail: these sit in a 380px column, in this order: status/log, progress, you, online, where to watch, tags.

**Tabs**
- Phone: Episodes · History · Review · About.
- Desktop: Episodes · History · 2 · Review & notes · Cast & crew · Franchise · 6.

**Episodes tab**
- Arc picker: "Elbaf arc · 1156– ▾" on phone; arc chips on desktop.
- Each row: number, title, date and a status icon.
  - Watched: `check_circle`, filled, `--acc`.
  - Unwatched: `radio_button_unchecked`, `--tx3`.
- **Spoiler shield:** titles and synopses beyond the user's progress get `filter: blur(5px)`, with the label "Spoiler shield on" (`shield` icon). Tapping reveals one item. A global toggle lives in settings and in the `spoilerShield` tweak.

**History**
- Cards with an icon (`play_circle` for a watch, `replay` for a rewatch), a label and a pink rating.
  - "First watch · ongoing" · Mar 2019 – now · Ep 1 → 1169 · Crunchyroll · Sub · ✦ 9.5
  - "Rewatch · Wano arc" · Jan – Apr 2024 · Ep 890 → 1085 · with Sara · ✦ 10 then

**Review and notes**
- Review heading with a "Contains spoilers" pill (`--warn` text on `--s2`). The text is blurred and `aria-hidden` until the user taps "Show review".
- **Private notes** are a separate dashed-border box with a `lock` icon.

**Tags**
- Chips on `--s2`: #comfort · #long-haul · Mood: hype · "+ Tag" (dashed).
- Desktop shows "In 2 lists".

**Where to watch:** Crunchyroll (Sub · Dub) · Netflix (Ep 1–1100).

### 4. Log / finish sheet: Your Name. (4a phone sheet, 4b desktop dialog)
**Container**
- Phone: bottom sheet over `--scrim`, top 84px from the screen top, `--s1` background, top radius 26, 40×5 drag handle.
- Desktop: centred dialog 720 wide, radius 22, `--line2` border, two-column field grid (gap 22/24).

**Header**
- 40×60 poster, "Your Name." in Newsreader 600 20, "君の名は。 · 2016 · Film".
- Close button (44, round, `--s2`).
- Desktop title reads "Log Your Name." and adds the director.

**Fields, in order**
1. **Finished:** "Today" (selected: `--tx` fill) · "Yesterday" · date field "1 Oct 2026" with a `calendar_today` icon. Defaults to today.
2. **Your rating:** 10-cell input with 44-tall cells. Shows "10 / 10" in pink and a "Clear" link. Hint: "Last time: ✦ 10 on 12 Sep 2023 · tap a cell twice for a half point".
3. **Review:** textarea (min height 84–96, `--bg` background; 2px `--acc` border when focused) with a "Spoilers" switch (44×26).
4. **Where:** chips Cinema · Netflix · Crunchyroll · YouTube · Other (single select).
5. **How:** segmented control Sub / Dub / Original.
6. **With whom:** free text with a `group` icon.
7. **Rewatch** switch, shown in the `--s2` pill. When on, the label shows the ordinal: "Rewatch · 3rd".

**Footer**
- Phone: full-width "Save to diary" (52 tall).
- Desktop: hint "Esc to close · ⌘↵ to save", plus Cancel and Save to diary.

**After saving**
- Show a toast "Logged Your Name. · ✦ 10" with **Undo** for 6 seconds.

---

## Components (see `Grimoire Design System.dc.html`)
- **Buttons**
  - Primary: `--accbg`.
  - Secondary: `--line2` border.
  - Ghost: `--acc` text.
  - Destructive: `--err` outline (confirm button `#c9433a`).
  - Icon button: 44, round.
- **Badges, flag chip, filter chips, status chips** (see the screens above).
- **Rating pair:** the full version is above.
  - Compact chips: ✦ 8.5 (`--youbg`/`--you`), IMDb 8.4 and RT 98% (`--line2` border, `--tx2`), "Not rated" (dashed border).
- **Status menu:** `--s1` background, radius 14, 44px rows, check mark on the selected row.
- **Progress stepper + season → episode picker**
  - Season segments S1–S5.
  - 10-column episode grid of 28px cells: watched `#453a7a`, current `--acc` with an outline, future `--s1`.
- **Poster card sizes**
  - Grid: about 110–175 wide.
  - Shelf: 76–92.
  - Compact row: 36×54 thumbnail with title, meta and compact rating.
- **Franchise tile** (stacked) and **collection tile** (2×2 mosaic, "4 of 5 watched · Ch. 5 new").
- **Tabs** (underline) and **segmented control** (track `--bg` with `--line` border; selected segment `--s3`).
- **Toast with undo** and **confirm dialog** ("Delete “Lupin”?" / "This deletes 2 watches, your rating and your review. You can undo for 10 seconds." / Keep · Delete).
- **Charts**
  - Diary heatmap: 26 weeks × 7 days, 14px rows, 3px gap, 4-step ramp.
  - Horizontal bars: 12px tall, `--acc` fill.
  - Rating distribution: 10 columns in `--you`, with "Average ✦ 7.6 vs the crowd's 7.3".
  - Donut by country: conic gradient, 112 outer / 70 inner, total in the centre.
- **Tier row:** 44px letter block in the tier colour, `--s1` drop zone, 36px poster chips, `drag_indicator` handle.
- **States**
  - Empty: spellbook illustration slot, "This chapter is unwritten", and a CTA.
  - Loading: skeleton.
  - Error: "Couldn't reach AniList", reassuring copy, "Try again".
  - Offline banner: `cloud_off` icon, "You're offline · 3 logs are saved on this device…".
  - 404: "This page was torn out".

## Interactions & behaviour
- **Snooze / dismiss** on Up Next cards. Dismissing shows a toast with Undo.
- **Quick increments** (+1 episode, +10 pages) update the progress bar (320ms) and re-sort Continue.
- **Logging the final episode** opens the Log sheet prefilled with a "Completed" status.
- **Franchise and collection tiles** open the franchise page. Tapping a breadcrumb navigates up.
- **Filter chips:** status chips are single-select; country chips are multi-select; the counts update.
- **18+ sub-tab:** hidden by default and controlled in Settings.
- **Delete:** confirm dialog, then a toast with Undo (10s).
- **Keyboard:**
  - `/` focuses search.
  - Esc closes sheets and dialogs.
  - ⌘↵ saves the log.
  - Arrow keys adjust the rating.
  - Tab order follows the visual order.
- **Sheets:** drag down to dismiss on phone.

## State (suggested)
- `theme: 'system'|'light'|'dark'`, `textScale`, `reducedMotion` (OS setting + override), `show18plus`, `spoilerShield`.
- Library item: `{id, category, kind: series|film|book|ona|ova|special, title, originalTitle, originalLang, country, franchiseId?, status, progress {season, episode, page, totalOverride}, userRating (0.5 steps | null), tags[], mood, lists[], notes}`.
- Watch / history entry: `{itemId, startedAt, finishedAt, ratingAtTime, isRewatch, rewatchIndex, review, reviewHasSpoilers, where, how: sub|dub|original, withWhom}`.
- Up Next feed: derived from provider airing data plus your progress. Snoozes stored as `{itemId, until}`.
- Online scores: per provider `{source, value, votes}`. Show "Not enough ratings" below the vote threshold.

## Assets
- **Posters and backdrops:** the striped blocks are placeholders. Use TMDB / AniList artwork.
- **Flags:** `https://flagcdn.com/w40/{iso}.png` in the mock. Bundle SVG flags in production.
- **Icons:** Material Symbols Rounded (Google Fonts).
- **Fonts:** all from Google Fonts. Self-host them for the PWA.
- **Logo:** use the existing Grimoire spellbook-with-sigil logo. The mock wordmark is the ✦ character plus "Grimoire" in Newsreader 600.
- **Empty-state spellbook illustration:** still to be supplied.

## Files
- `Grimoire Key Screens.dc.html`: Home (1a dark / 1b light / 1c desktop), Category (2a/2b), Detail (3a/3b), Log sheet (4a/4b). The data is in the `renderVals()` script at the bottom of the file.
- `Grimoire Design System.dc.html`: tokens, type, spacing/radius/elevation/motion, components, states.
- `support.js`: the runtime needed to open the `.dc.html` files in a browser.
- `DESIGN_BRIEF.md`: the full product brief and the remaining screen list (Search & add → Franchise → Lists / Tier list → Diary → Stats / Wrapped → Tonight → Settings → Shared list → Unlock).
