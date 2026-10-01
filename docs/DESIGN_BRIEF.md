# Grimoire: design brief

A brief for designing Grimoire's full UI (design system + screens). Feature scope comes from the agreed build
order in `docs/KNOWN_ISSUES.md` (2026-10-01). The paste-ready prompt is at the end.

## 1. What Grimoire is

A private, single-user media tracker: one person logging everything they watch and read, in one place, with
their own ratings, reviews, history and stats. Think Letterboxd + AniList + Trakt + Goodreads in one app, with no
social feed and no other users.

**The user** watches globally: Japanese, Chinese and Korean anime (including 1,100+ episode ongoing series like
ONE PIECE), Turkish dizi, Pakistani dramas, Korean dramas, European shows (Norwegian, German, Spanish, French),
Hollywood films and series. They also read books. They use it daily on a **phone** and regularly on a
**desktop**. They care about their own opinion vs the crowd's, what's new in shows they follow, and seeing their
taste over time.

**Media types:** Movies · TV · Anime · Books, plus regional categories: **Turkish Dizi · Pakistani Dramas ·
K-Drama · European** (shows and films, auto-assigned by country of origin). Music is **not** part of the app.

## 2. Brand & visual direction

- **Name:** Grimoire, a spellbook. The logo is a spellbook with a sparkle sigil. The metaphor can show up lightly
  (a "tome" of your year, a sigil mark for favourites, chapter-like sections), never as fantasy kitsch.
- **Current palette** (from the logo): ink `#0b0b10`, deep violet `#1c1730`, violet `#453a7a`, lavender
  `#8b7ae0`, mist `#e3defe`, petal pink `#f0a8dd`, paper `#f4f1ff`. Open to refinement.
- **Theme:** dark-first, but a **real light theme** is required, plus "follow system".
- **Content first:** posters and backdrops carry the colour. UI chrome should recede. Optional: a detail page
  accent drawn from the poster.
- **Avoid:** generic AI-dashboard look (glass-on-glass everywhere, low-contrast grey text, gratuitous 3D tilt
  effects). The current app leans that way and has contrast problems.

## 3. Hard requirements

- **Responsive:** designed at **390 px** (phone) and **1440 px** (desktop), working in between. Installable as a
  PWA later, so the phone layout should feel like an app (bottom navigation, sheets).
- **Accessibility, WCAG 2.2 AA:** text contrast ≥ 4.5:1, visible focus ring, full keyboard use, 44 px touch
  targets, `prefers-reduced-motion` alternatives for every animation, ratings readable as text (not emoji only),
  text-size setting.
- **Multi-script typography:** titles are shown in English plus the original title, in Latin with Turkish
  diacritics (Diriliş: Ertuğrul), Japanese (ワンピース), Korean (오징어 게임), Chinese (诡秘之主) and Urdu
  (Nastaliq, **right-to-left**). Pick a type system that covers these (e.g. a Latin face + Noto CJK + Noto
  Nastaliq Urdu) and show how bilingual titles are laid out.
- **Every screen needs:** empty, loading (skeleton), error and offline states.

## 4. Navigation (suggested; open to a better idea)

- **Phone:** bottom tab bar with **Home** (what's next) · **Library** (all categories) · **Search/Add** ·
  **Lists** · **You** (diary, stats, goals, settings).
- **Desktop:** left sidebar with the same sections; Library expands into the 8 categories.
- 8 category tiles on Home would be crowded, so Home focuses on *what to watch next* and Library is the hub for
  the categories.

## 5. Screens

### Access
1. **Unlock / Login / Register**: email + 6-digit PIN; new device verifies via a 6-digit email code; register
   flow (email, PIN, confirm, verify).

### Home
2. **Home** sections:
   - **Up Next: Ready to watch** (new content you haven't seen: "Reacher · Season 4 is out (8 eps) · you
     finished S3", "ONE PIECE · 12 new episodes", "John Wick: Chapter 5 is out").
   - **Up Next: Coming soon** (dated, with countdown: "Ep 1182 · Sun", "Season 5 · renewed · date TBA").
   - **Continue**: items in progress with a progress bar.
   - **"What should I watch tonight?"** entry point.
   - Goals progress, favourites shelf, occasional rewatch nudge ("You rated *Your Name.* 10 three years ago").
   - Each Up Next card can be snoozed/dismissed.

### Library
3. **Library hub**: the 8 categories as tiles with counts and a "3 new" badge.
4. **Category page** (Movies, TV, Anime, Books, Turkish Dizi, Pakistani Dramas, K-Drama, European):
   - Sub-tabs: Anime → Series / Movies / 18+ (hideable); regional → Series / Movies.
   - Filter rows: status (Watching / Completed / Planned / Paused / Dropped, or Reading for books), genre,
     **country flags** (JP / CN / KR; TR / PK / NO / DE…), personal tags, search.
   - Grid of poster cards. **Franchise tiles** (one tile for "ONE PIECE" with "3 movies · 1 special") and movie
     **collection tiles** (John Wick 1–4).
   - Card badges: `NEW S4`, `Ep 1182 · Sun`, `Ended`, `Caught up`, `Dub`, country flag, your rating.
5. **Franchise / Collection page**: banner; sections **Seasons** (in order) · **Movies** · **OVAs & ONAs** ·
   **Specials**; tracked entries highlighted, untracked ones dimmed with "+ Add"; overall progress.

### Item
6. **Detail page** (the most important screen):
   - Hero: backdrop, poster, title + original title, year, country flag, type, runtime / episodes, breadcrumb to
     the parent franchise ("ONE PIECE ›").
   - **Ratings, clearly separated:** **You** (10-point, half steps, or "Not rated") vs **Online**: audience
     (TMDB / IMDb / AniList / MAL, with vote counts) and critics (Rotten Tomatoes, Metacritic). Low-vote scores
     shown as "Not enough ratings".
   - Status selector (wording per medium), **progress** (episode counter / season → episode picker / pages, with
     total override), **airing banner** (next episode / new season).
   - **History**: each watch/read with dates, rating at the time, rewatch marker, review.
   - **Review** (with spoiler toggle) and private **notes**, kept separate.
   - Personal **tags** + mood, lists it's in, cast & crew / studio (linked), trailer, where to watch.
   - Actions: add to list, "Move to…" category, delete (confirmed, with undo).
   - Spoiler shield: blurs synopses/episode titles beyond your progress.
7. **Log / finish sheet** (bottom sheet on phone, dialog on desktop): finished date (default today), rating,
   review + spoiler flag, where (cinema / Netflix / YouTube…), how (sub / dub / original), with whom, rewatch.
8. **Search & add**: one search across all providers; results show flag, English + original title, year,
   network, type, "Dub" badge, "In library" state; spelling-tolerant; **Add manually** form (title, show/film,
   country, episodes, poster) when nothing is found.
9. **Person / Studio page**: e.g. Denis Villeneuve, MAPPA: what you've logged (with your ratings) + the rest of
   their work.

### Lists & favourites
10. **Lists**: index + list detail; ranked or unranked, per-item notes, drag to reorder, rename/delete, **share
    link** toggle.
11. **Top 10 per category** and a **tier list editor** (S / A / B / C / D, drag and drop) for a franchise, genre
    or anything.
12. **Shared list (public)**: read-only page anyone with the link can open; no app chrome or private data.

### You
13. **Diary**: calendar heatmap of finished items; tap a day for what you finished.
14. **Stats**: hours watched, counts by type / country / genre / decade, your rating distribution, **"you vs the
    crowd"** (your most contrarian ratings), favourite directors / studios / countries.
15. **Year in review, "Grimoire Wrapped"**: a swipeable story-style yearly summary, shareable as images.
16. **Goals**: yearly targets ("50 films", "12 books", "finish 5 backlog anime") with progress.
17. **What should I watch tonight?**: inputs: time available, mood, type, country, language; output: 1–3 picks
    from your Planned list with "Start" / "Another".
18. **Settings**: PIN, trusted devices, lock now; Appearance (System / Light / Dark, text size, reduced motion);
    18+ content visibility; import (AniList / MAL, Letterboxd / IMDb CSV, Trakt, Goodreads) and export
    (JSON / CSV).

### System
19. Empty states, skeletons, errors, 404, offline, toasts with **Undo**, confirm dialogs.

## 6. Components to define

Poster card (sizes: grid / shelf / compact row) · franchise and collection tile · wide Up Next card with
progress · **rating pair** (You vs Online) · rating input (half stars, clear) · audience/critic score chips ·
status selector · progress stepper and season/episode picker · country flag chip · badges (new / airing / ended
/ caught up / dub / 18+) · filter chip rows · tabs and segmented controls · bottom sheet · dialog · toast with
undo · heatmap · charts (bars, distribution, donut) · tier row · drag handle · empty state illustration
(spellbook motif) · bilingual title block (LTR + RTL).

## 7. Real content to use in mockups

ONE PIECE (TV, ongoing, 1,181 eps aired, plus films and specials) · Reacher (S4 aired Aug–Sep 2026, renewed) ·
Diriliş: Ertuğrul (TR, 5 seasons / 150 eps) · Meray Paas Tum Ho (PK, Urdu) · Dark (DE) · Lupin (FR) ·
Demon Slayer (franchise with seasons + the Mugen Train film) · Lord of Mysteries (CN, ONA) · Your Name. (film) ·
John Wick collection (1–4) · The Kite Runner (book).

## 8. Out of scope

Music, a social feed / friends / comments, multiple user accounts, in-app playback.

## 9. Deliverables

1. **Design system:** colour tokens (light + dark), type scale incl. CJK + Urdu, spacing, radius, elevation,
   motion (with reduced-motion variants), and the components in §6.
2. **Key screens first**, at 390 px and 1440 px: **Home**, **Category page**, **Detail page**, **Log sheet**.
3. Then the rest of §5 in this order: Search & add → Franchise page → Lists / Tier list → Diary → Stats /
   Wrapped → What to watch tonight → Settings → Shared list → Unlock.

The implementation reproduces the delivered designs literally (layout, chart types, labels), so screens should
show real states, not placeholders.

---

## Paste-ready prompt

> Design the complete UI for **Grimoire**, my private single-user media tracker (movies, TV, anime, books, plus
> regional categories Turkish Dizi, Pakistani Dramas, K-Drama and European). It's Letterboxd + AniList + Trakt +
> Goodreads in one app, with no social features. I use it daily on my phone and often on desktop.
>
> Start with a **design system** (light + dark tokens built from the logo palette ink #0b0b10, violet #453a7a,
> lavender #8b7ae0, petal pink #f0a8dd, paper #f4f1ff; a type system that handles English, Turkish diacritics,
> Japanese, Korean, Chinese and right-to-left Urdu Nastaliq; components), then the **Home**, **Category**,
> **Detail** and **Log sheet** screens at 390 px and 1440 px.
>
> Must-haves: my rating and the online ratings (audience: TMDB/IMDb/AniList/MAL; critics: Rotten Tomatoes,
> Metacritic) are always visually separate; an "Up Next" section for new episodes/seasons ("Reacher · Season 4 is
> out") and dated upcoming ones; one tile per anime franchise (ONE PIECE) that opens a page with its seasons,
> movies, OVAs and specials; country flags and bilingual titles; watch history with dates, rewatches and reviews
> with spoiler toggles. WCAG AA contrast, visible focus, 44 px touch targets, reduced-motion variants. Brand: the
> name means spellbook; use the metaphor lightly, let posters carry the colour, and avoid the generic
> glass-dashboard look.
>
> [attach docs/DESIGN_BRIEF.md for the full screen and component list]
