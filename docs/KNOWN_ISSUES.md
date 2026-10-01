# Known issues

The project's backlog: bugs, rough edges and polish work, logged here instead of fixed mid-task so the work in
progress doesn't stall. Each entry says where it came from, its severity, how we plan to fix it, and gets ✅ with the
commit once done. Issues are discussed and fixed one at a time.

## Open — needs a fix

### Found by the status check (2026-10-01)

1. **Site takes ~16 s to load from the home network** (medium — local only, not an app bug). Every request to
   `grimoire-app.duckdns.org` spent ~15 s in DNS (`curl -w`: `dns 15.0  tcp 15.3  tls 15.6  ttfb 16.5`). The home
   router (`192.168.1.1`, the laptop's only DNS server) never answers the AAAA (IPv6) query for the name, so the
   resolver waits out its timeout before connecting over IPv4. Cloudflare (`1.1.1.1`) answers the same AAAA query
   in ~0.3 s (NOERROR, no record), and `curl -4` loads `/health` in 1.4 s. The VM and app are healthy; other
   networks are unaffected.
   **Fix:** point the laptop (NetworkManager connection) or the router at a public resolver such as `1.1.1.1` /
   `9.9.9.9`, then confirm `dig grimoire-app.duckdns.org AAAA` returns instantly and a plain `curl` is ~1 s.

2. ✅ **Fixed** (`5696301`) — **Account bootstrap can be hijacked with an unverified email** (high, security). `POST /auth/bootstrap` only
   checks that *some* OTP was verified, not for which address: verify an OTP for any inbox, then create the account
   under a different email.
   **Fix (written 2026-09-24, uncommitted):** `OtpCode.email` stores the address the code was sent to;
   `/otp/verify` copies it onto `TrustedDevice.verifiedEmail`; `/bootstrap` requires a match
   (`backend/src/routes/auth.ts`, `backend/prisma/schema.prisma`, migration
   `20260924070308_add_otp_email_and_device_verified_email`). Deploy note: the migration adds a NOT NULL `email` to
   `OtpCode`, so delete stale OTP rows on the VM before `prisma migrate deploy`.

3. ✅ **Fixed** (`3cc751c`) — **Saving an item without editing wipes notes/progress** (medium). `MediaDetail.tsx` keeps local state starting
   at `""` while the inputs use `defaultValue`, so Save sends empty strings over the real values.
   **Fix (written 2026-09-24, uncommitted):** sync local state from the loaded item in a `useEffect`
   (`frontend/src/pages/MediaDetail.tsx`).

4. ✅ **Fixed** (`3cc751c`) — **`/providers/details` errors escape the error handler** (low). The route isn't wrapped in `asyncHandler`, so a
   zod validation error becomes an unhandled rejection instead of a 400.
   **Fix (written 2026-09-24, uncommitted):** wrap it in `asyncHandler` (`backend/src/routes/providers.ts`).

5. ✅ **Removed** (never committed, reverted before `5696301`) — **Temporary auth bypass in the working tree** (high if shipped). `BYPASS_AUTH_TOKEN`, sent as the
   `x-bypass-token` header or `?bypassToken=`, skips the session check (`backend/src/middleware/requireSession.ts`,
   `frontend/src/app/api.ts`, `frontend/src/components/PasscodeGate.tsx`). Added for an external analysis tool. A
   token in the URL leaks into server logs and browser history.
   **Fix:** remove all three pieces before committing #2–4; confirm `BYPASS_AUTH_TOKEN` isn't set on the VM.

### Found while locking the app to a private Tailscale network (2026-10-01)

6. ✅ **Fixed** (`b6cc66b`) — **Helmet's `upgrade-insecure-requests` CSP directive broke plain-HTTP-only access** (medium). The VM was
   joined to a private Tailscale network so the app could be reached without a public DNS record, serving plain HTTP
   on an internal address/port (no TLS cert there). Helmet's default CSP sends `upgrade-insecure-requests`, so the
   browser's first request succeeded (200) but every following request was silently retried over HTTPS on the same
   port, which isn't TLS and answered `400 Bad Request` — making the whole site look unreachable. Confirmed via
   `tcpdump` on the VM: the TCP handshake and first HTTP exchange were fine; only the auto-upgraded requests failed.
   **Fix:** set `"upgrade-insecure-requests": null` in the CSP directives (`backend/src/index.ts`). Harmless on the
   public domain, which is already HTTPS end-to-end via Caddy.

7. ✅ **Fixed** (`2c63309`) — **Helmet's HSTS header would have permanently broken the same private address** (medium-high — not yet
   triggered, caught before a device loaded the page over the bad config). Same setup as #6: Helmet sends
   `Strict-Transport-Security` unconditionally. Unlike CSP's `upgrade-insecure-requests` (a per-request, server-side
   behavior), HSTS is cached by the browser for the full `max-age` (180 days) per hostname — so the first plain-HTTP
   load of the Tailscale MagicDNS hostname would have made the browser force HTTPS on that hostname for months,
   immune to any later server-side fix.
   **Fix:** `hsts: false` in the Helmet config, then a small middleware that sets `Strict-Transport-Security`
   manually, only when `req.secure` is true (`backend/src/index.ts`). Relies on `trust proxy` + Caddy's
   `X-Forwarded-Proto` already being correct for the public HTTPS path.

### Found while shipping Phase 0 (2026-10-01)

75. ✅ **Done** (`daa95b0`, `4be2080`) — **Notes and progress can't be cleared** (low). `PATCH /library/:id` validates `yourNotes`/`progressText` with
    `nonEmptyString` (`routes/library.ts`), which turns `""` into `undefined`, so emptying the field and saving
    leaves the old text. **Fix:** accept `""`/`null` on PATCH to clear (keep `nonEmptyString` for POST). Folded into
    Phase 2 with typed progress (#17) and reviews/notes (#51).

76. ✅ **Fixed** (`96b07a0`) — **Home's TV tile is labelled "Dramas"** (low). `typeLabel.TV` in `BigCategoryCard.tsx` is "Dramas", which
    will clash with the regional categories (#37: Turkish Dizi, Pakistani Dramas, K-Drama). **Fix:** rename to "TV"
    when the regional categories land (or as part of the redesign).

77. ✅ **Fixed** (`de565e8`) — **One failed AniList request broke every later one** (high). `postAniList` queued
    calls with `chain = chain.then(task)`; after a rejection the chain stayed rejected, so all following AniList
    requests failed until the server restarted. Now each task runs regardless of the previous result, with a
    700 ms gap between requests.
78. **Berserk 2 sits under "Berserk: The Golden Age Arc – Memorial Edition"** (low). AniList links the 2016 series'
    prequel chain to the 2022 Memorial Edition TV rather than the 1997 series (an ALTERNATIVE). Correct per the
    "follow AniList links" decision; a manual franchise override (detail page, like region "Move to…") would let
    the user regroup it.
79. ✅ **Covered** (`96b07a0`: "Show this under") — **Co-productions can land in the wrong region** (low). *The Transporter* (English-language, French production
    company) gets `origin_country: FR` → European. Covered by `regionOverride` ("Move to…", #37).

80. ✅ **Fixed** (`daa95b0`, `4be2080`) — **AniList descriptions show raw `<br>` tags** (medium). AniList's
    `description(asHtml: false)` still returns `<br>`, `<i>` and entities; every anime description showed them.
    Stripped at display (`lib/text.ts`) and at enrichment (stored text cleaned on the next enrich).
81. ✅ **Fixed** (`4be2080`) — **Genre chips never showed on the detail page** (low). The page ran `JSON.parse` on
    `genres`, which the API already returns as an array, so it always fell back to none.

82. **Jikan (MyAnimeList) is intermittently down** (low). Jikan often answers 504 "failed to connect to
    MyAnimeList"; scores for those anime stay unset (`scoresCheckedAt` null). Retries are in place; the Phase 4
    daily job should also retry items with a MAL id but no score.

### Anime pipeline review (2026-10-01)

Goal agreed with the user: one tile per franchise ("ONE PIECE") in Anime → Series, opening a franchise page that
lists its seasons, movies, OVAs/ONAs and specials; each entry keeps its own detail page with the OG series as parent.
Findings below are from the local DB (78 anime) and live AniList queries. Decisions: franchise movies appear in
**both** the Movies tab and the franchise page; the franchise page shows **unadded** entries with "+ Add"; grouping
**follows AniList links** (Boruto joins Naruto via its SEQUEL link).

9. ✅ **Fixed** (`de565e8`) — **Movies/OVAs/specials never join their series** (high). `findMainlinePrequel` (`services/providers/anilist.ts`)
   only follows `PREQUEL` edges between TV/TV_SHORT entries, but side entries hang off the series via `PARENT` (and
   sometimes `SIDE_STORY`/`PREQUEL` from a MOVIE). E.g. *One Piece: Heart of Gold* → `PARENT: ONE PIECE`; both Naruto
   movies → `PARENT: NARUTO`. All ungrouped.
10. ✅ **Fixed** (`de565e8`) — **Series with no sequel never get a collectionId** (high). Root self-reference only happens when a mainline
    `SEQUEL` exists, so ONE PIECE (no sequel) has no id and nothing can attach to it.
11. ✅ **Fixed** (`de565e8`) — **3-hop cap splits franchises** (medium). Demon Slayer is spread over 3 ids (101922 / 129874 / 142329); MHA S5
    sits under 21856 instead of 21459.
12. ✅ **Fixed** (`de565e8`) — **Grouping data dropped on add** (high). `SearchModal.add` copies genres/poster/etc. from `providerDetails` but
    not `collectionId`/`collectionName`; the suggestions add doesn't fetch details at all. Only the one-off
    backfill script ever set anime collections. `GET /library` enriches anime on the fly but never persists it.
13. ✅ **Fixed** (`de565e8`) — **~50 of 78 anime have no `format` stored** (medium) → wrong tab: *Mugen Train* (MOVIE) shows under Series.
14. **Ongoing series have no episode total** (medium). ONE PIECE has `episodes: null` (1181 aired), so progress
    initialises as `0/null`. AniList's `nextAiringEpisode` gives the aired count.
15. ✅ **Fixed** (`de565e8`) — **Donghua / Korean anime are mostly ONA** (medium). Grouping accepts only TV/TV_SHORT as mainline, so CN/KR
    series (e.g. *Lord of Mysteries*, CN ONA) can't chain their seasons.
16. ✅ **Fixed** (`4be2080`) — **Dead `pages/Anime.tsx` + `/anime` route** (low). Nothing links to it; it never renders library items. The
    real anime page is `pages/Category.tsx`.

**Fix plan (in order, one commit each, verified against the real library):**
- **A. Schema:** new `Franchise` table (`id` = AniList id of the OG series, title, posterUrl, bannerUrl,
  countryOfOrigin, status, airedEpisodes). `MediaItem` gains `franchiseId`, `franchiseRole`
  (`MAIN` | `MOVIE` | `OVA` | `ONA` | `SPECIAL`), `franchiseOrder`, `countryOfOrigin`.
- **B. Root resolver** (replaces `findFranchiseRoot`): side entries step to the main line via
  `PARENT` → `PREQUEL`/`SEQUEL` → `SIDE_STORY`; then walk `PREQUEL` back over mainline formats (TV, TV_SHORT, and
  ONA when the entry is ONA-led, for donghua) with a visited set, ~40-hop safety cap. Never follow `ALTERNATIVE` /
  `SPIN_OFF` (keeps FMA vs Brotherhood, HxH 1999 vs 2011 apart). Results persisted, not recomputed per request.
- **C. Write path:** `POST /library` resolves franchise + format server-side for `anilist` items, so every add path
  (search, suggestions) is covered; `GET` stops doing per-request enrichment.
- **D. Backfill:** rewrite `scripts/backfillCollections.ts` for anime — all 78 rows, ~1 req/s for AniList limits.
- ✅ (`109c6dd`) **E. Series tab:** one tile per franchise (OG poster even if only a movie is tracked), badge like
  "3 movies · 1 special"; replaces `CardStack` for anime. Movies tab keeps listing every anime movie.
- ✅ (`109c6dd`) **F. Franchise page** `/franchise/:id`: banner, then Seasons (in order), Movies, OVAs & ONAs, Specials; tracked
  entries highlighted, untracked ones greyed with "+ Add" (from AniList). Detail pages get a "ONE PIECE ›" breadcrumb.
- **G. Ongoing progress:** "Ep 1100 / 1181 aired" via `nextAiringEpisode`, refreshed with the franchise record.
- **H. Origin filter:** JP / CN / KR chips from `countryOfOrigin`.
- ✅ (`4be2080`) **I.** Delete `pages/Anime.tsx` and the `/anime` route.

### Other pipelines review (2026-10-01)

Same method: code read + local DB (100 movies, 9 TV, 3 books, 2 songs).

**Shared by all pipelines**

17. ✅ **Done** (`daa95b0`, `4be2080`) — **Progress is free text and never initialised correctly** (medium). `SearchModal.add` seeds progress from
    `details.totalEpisodes ?? details.runtime`, but no provider returns `totalEpisodes` (TMDB returns `episodes`,
    AniList `episodes`), so TV/anime never get a total and movies would get runtime minutes as a "total". Progress
    also doesn't follow status: *Friends* is COMPLETED with progress `0/228`.
    **Fix:** typed progress per type: episode counter (anime, TV with season/episode), pages (books), rewatch count
    (movies). Marking COMPLETED fills progress to the total.
18. **No creator field** (medium). Books store no author, music packs the artist into the title/description, movies
    have no director. **Fix:** one `creator` column (author / artist / director) filled by every provider, shown on
    cards and searchable.
19. ✅ **Fixed** (`de565e8`) — **Library loads call providers per request** (medium, perf). `GET /library` re-fetches AniList details for
    anime missing `format`, and TMDB details for every movie without a collection. The 39 movies that genuinely have
    no collection are re-fetched on **every** Movies page load because "no collection" is never stored.
    **Fix:** persist results plus a `metaCheckedAt` timestamp; enrichment moves to the add path + backfill
    (same as anime step C).
    Measured 2026-10-01 against a copy of the local DB: `GET /library?mediaType=MOVIE` 2.8 s warm (minutes on a
    flaky connection), `mediaType=ANIME` over 2 minutes (≈50 serial AniList calls), `mediaType=TV` 3 ms. The Home
    Anime tile stays blank until that request finishes.

**Movies**

20. ✅ **Fixed** (`de565e8`) — **31 of 100 movies have no genres** (low) (*Interstellar*, *Se7en*, *Fast X*…), so they're missing from genre
    chips and suggestion seeding. **Fix:** covered by the shared backfill.
21. ✅ **Done** (`109c6dd`) — **Collection stack has no "full collection" view** (polish). TMDB `/collection/{id}` lists every film. Reuse the
    anime franchise page (step F) for movie collections: owned films highlighted, the rest "+ Add", in release
    order (*John Wick* 2–4 owned → 1 shown as missing).

**TV**

22. ✅ **Done** (`de565e8` data, `4be2080` season → episode picker) — **No seasons/episodes stored** (medium). `tmdbDetails` returns `seasons`/`episodes` but nothing saves them
    (`episodes` is null for all 9 shows). **Fix:** store them on add/backfill; a season → episode progress picker from
    TMDB `/tv/{id}/season/{n}`; for airing shows, show `next_episode_to_air` ("S3E5 airs Fri").
23. TV spinoff grouping (*Young Sheldon* ↔ *Big Bang Theory*): **not planned.** TMDB has no relation data for TV;
    only manual linking would work.

**Books**

24. ✅ **Fixed** (`de565e8`, `5d93428`; live 2026-10-01: Canterville Ghost 1887, Alchemist 1988, Kite Runner 2003) — **Edition data instead of the book** (medium). Google Books returns editions: *The Alchemist* shows 2015,
    *The Kite Runner* 2020. No author or page count is stored. **Fix:** store `authors`, `pageCount`, ISBN; take the
    original year from Open Library (`/search.json?isbn=` → `first_publish_year`, free, no key).
25. **Low-res `http://` covers** (low). All 3 covers are `http://books.google.com/...&zoom=1` thumbnails. **Fix:**
    rewrite to `https://`, request `zoom=0`/larger, fall back to Open Library covers by ISBN.
26. ✅ **Fixed** (key "API key 1" from the azubiweg GCP project in the VM `.env`; 429 backoff in `de565e8`) — **No API key** (low). Requests share Google's anonymous quota and can 429. **Fix:** add `GOOGLE_BOOKS_API_KEY`
    (free) to `.env`.

**Music**: ⛔ **Obsolete, superseded by #45 (Music category removed).** Kept for reference.

27. **Artist shows as "Album: 21"** (medium). Both stored songs use `title: "Set Fire to the Rain — Adele"`,
    `description: "Album: 21"`, but `parseArtist` (`MusicCategory.tsx`) expects `description: "By <artist>"`, so the
    album is shown in the artist slot. **Fix:** `creator` (#18) + `collectionName` as album; clean title back to the
    song name in the backfill.
28. **Lyrics are stored in `yourNotes`** (medium). They share the field with notes, and #3 (Save wipes notes) would
    wipe lyrics too. **Fix:** a separate `lyrics` column, migrated from `yourNotes` for MUSIC rows.
29. **100 px artwork** (low). `artworkUrl100` is blurry on cards. **Fix:** rewrite `100x100bb` → `600x600bb` (iTunes
    serves any size from the same path).

### International shows review (2026-10-01)

The user watches Turkish dizi, Pakistani dramas, European and other non-US shows. All of them go through the TV
pipeline (TMDB). Checked with live TMDB + TVmaze queries.

**Coverage is fine. TMDB is the right provider.** Found: *Diriliş: Ertuğrul* (also by its Turkish title with
diacritics, 5 seasons / 150 eps, TRT 1), *Kuruluş Osman*, *Humsafar*, *Tere Bin*, *Kabhi Main Kabhi Tum* (34 eps, ARY
Digital), *Meray Paas Tum Ho*, *Dark* (DE), *Lupin* (FR), *La casa de papel* (ES). TVmaze covers less (it misses
*Meray Paas Tum Ho*), so it isn't worth adding as a second provider. What's missing is everything the app does
*after* the search:

31. ✅ **Done** (`de565e8`, `96b07a0`) — **Origin/language is thrown away** (medium). TMDB returns `origin_country` and `original_language` for every
    show; `tmdbSearch`/`tmdbDetails` drop both, so there's no way to filter Turkish vs Pakistani vs European.
    **Fix:** store `countryOfOrigin` (same column as anime #15/H) + `originalLanguage`; prefer country over
    language (the Urdu dub of Ertuğrul is `lang: ur` but `country: TR`).
32. ✅ **Done** (`de565e8`, `96b07a0`) — **Original title is thrown away** (low). `original_name` ("Diriliş: Ertuğrul", "La casa de papel") isn't mapped
    to `nativeTitle`, and `withNativeTitle` in `Category.tsx` only runs for anime. **Fix:** map it for TMDB TV +
    movies; show "Resurrection: Ertugrul · Diriliş: Ertuğrul"; library search matches both.
33. ✅ **Done** (`109c6dd`) — **Urdu romanization misses** (medium). TMDB search is spelling-exact: "Mere Paas Tum Ho" → **0 results**,
    "Meray Paas Tum Ho" → found. Pakistani titles have no fixed romanization (mere/meray, tere/teray, hai/hay,
    ki/kee). **Fix:** when a TV/movie search returns < 3 results, retry server-side with generated variants and merge
    (small rule table in `tmdb.ts`), and also try `/search/multi`. Free-text title entry stays as a last resort.
34. ✅ **Done** (`96b07a0`) — **Ratings from a handful of votes** (low). Pakistani dramas have 2–8 TMDB votes (*Meray Paas Tum Ho*: 2), so
    `globalRating` can be a misleading 10.0 or 4.0. **Fix:** show the TMDB rating only at ≥ 20 votes; otherwise
    "Not enough ratings".
35. ✅ **Done** (`4be2080` override, `109c6dd`/`96b07a0` dub badges) — **Dubs are separate entries with different episode counts** (low). "Ertugrul Ghazi Urdu" (TMDB 207645) is
    separate from the Turkish original (66017), and the Urdu dub's episode split doesn't match 150. **Fix:** mark
    dub entries in search results ("Urdu dub" badge when `original_language` ≠ the country's language or the
    title says "Urdu/Dubbed"), and let the progress total be overridden per item (#17).
36. **Suggestions are US-centric** (medium). `tmdbDiscoverByGenres` seeds by genre only with
    `sort_by=popularity.desc`, so it never suggests Turkish/Pakistani shows even if half the library is. **Fix:**
    weight suggestions by the library's top origin countries (`with_origin_country=TR|PK…`), mixed with the
    genre seed.
37. ✅ **Done** (`109c6dd`, `96b07a0`) — **Regional categories** (feature, decided 2026-10-01). Home gets four new tiles next to TV:
    **Turkish Dizi** (TR) · **Pakistani Dramas** (PK) · **K-Drama** (KR) · **European** (NO, DE, FR, ES, IT, SE, DK,
    NL, BE, PL, PT, IS, FI, AT, CH…; UK/IE stay in TV as English-language). Everything else stays in **TV**.
    Decisions: covers **shows and movies** (each regional page has Series / Movies tabs; regional films also stay in
    Movies, while regional shows leave TV); **auto-assigned + override**.
    **Design:** categories are views, not new `mediaType`s, so search, suggestions and library routes stay unchanged.
    `MediaItem` gets `region` (`TR` | `PK` | `KR` | `EU` | null), derived from `countryOfOrigin` (#31) on add/backfill,
    plus `regionOverride` set by a "Move to…" action on the detail page (for co-productions and dubs). New route
    `/region/:key` reuses `Category.tsx` filtered to TV+MOVIE ∩ region; `/category/TV` excludes regional shows. On
    a regional page, "+ Add" searches TMDB TV+movies with that country boosted; suggestions use
    `with_origin_country`. A flag on each card everywhere. The country → region map lives in one shared file so
    adding a region later (e.g. 🇮🇳, 🇨🇳 C-Drama) is one line.
38. ✅ **Done** (`109c6dd`, `96b07a0`) — **No manual add** (medium). If TMDB doesn't have a show (obscure Pakistani/regional dramas), there's no way to
    track it: `SearchModal` only adds provider results. **Fix:** "Add manually" in the search modal: title, type
    (show/movie), country (→ region), episode total, optional poster URL; stored with `provider: "manual"` and a
    generated `providerId`. Detail page allows editing those fields for manual items only.

Not planned: "where to watch" (TMDB/JustWatch has no Pakistan data: Humsafar's providers list is empty).

### Airing & release updates (feature, 2026-10-01)

Goal: tell the user when something they track has new content waiting ("overdue") or a date for what's next.
Example checked live: **Reacher**: TMDB `status: Returning Series`, `in_production: true`, S4 (8 eps) aired
2026-08-12 → 09-16, `next_episode_to_air: null`. If the user last finished S3 → "Season 4 is out · 8 episodes";
once caught up → "Renewed · date TBA". Today the app stores none of this and has no background refresh.

**Data the providers give us (free):**
- TV (TMDB `/tv/{id}`): `status` (Returning Series / Ended / Canceled / In Production), `last_episode_to_air`,
  `next_episode_to_air` (season, episode, air_date), `seasons[]` (episode_count, air_date; announced seasons
  appear with a future date). *Kuruluş Osman* → Ended S6E30; *Peaky Blinders* → Ended; works for all regions,
  though Pakistani weekly schedules are often sparse on TMDB.
- Anime (AniList): `status` RELEASING / NOT_YET_RELEASED, `nextAiringEpisode {episode, airingAt}`, and `SEQUEL`
  relations with `status: NOT_YET_RELEASED` + `startDate` (announced next season or movie). Batchable: one
  `Page(media(id_in: [...]))` query refreshes ~50 titles.
- Movies (TMDB): collection `parts[]` with `release_date` (*John Wick Collection* lists 1–4; a 5th appears once
  announced); `/movie/{id}/release_dates` gives the digital release (type 4) for films still in cinemas.

39. **Airing snapshot per item.** New `AiringInfo` (or columns): `airStatus`, `lastAired{Season,Episode,Date}`,
    `nextAir{Season,Episode,Date}`, `airedEpisodeCount`, `announcedNext` (season/sequel title + date or "TBA"),
    `airCheckedAt`. Movies: `releaseDate`, `digitalReleaseDate`, next collection part.
40. **"Where you are" baseline** (needs typed progress #17). Shows track watched season/episode; anime watched
    episode. Existing COMPLETED items get a backfill baseline = everything aired **before the item's last update**,
    so the first run doesn't flag the whole library. Marking a show COMPLETED records the season count it was
    completed at.
41. **Daily refresh job.** In-process scheduler (03:30, after the backup cron). Skips DROPPED items; Ended/Canceled
    shows are checked monthly, airing ones daily, anime batched in one AniList query per 50. Network calls are
    retried (connections to TMDB from this network were flaky during the review).
42. **Computed states** (shared by every card, page and banner):
    - **Overdue / ready to watch**: aired > watched. "Reacher · Season 4 is out (8 eps) · you finished S3";
      "One Piece · 12 new episodes"; "John Wick: Chapter 5 is out" (released collection part not in library).
    - **Airing now**: "Ep 1182 · Sun 03:30"; "S2E5 airs Fri".
    - **Upcoming**: "Season 5 · 14 Mar 2027", "Season 2 announced · date TBA", sequel movie "In cinemas Jun 2027 ·
      digital Aug 2027"; a PLANNED movie not out yet shows its release date.
    - **Caught up / Ended**: no banner; card shows "Ended" or "Caught up".
43. **UI.** Home gets an **Up Next** section at the top with two rows: *Ready to watch* (overdue, newest first) and
    *Coming soon* (by date, with countdown). Category tiles show a "3 new" badge; cards get a corner badge
    ("NEW S4", "Ep 1182 · Sun"); the detail page shows a banner with the airing info. Each banner can be snoozed
    or dismissed (until the next new item); DROPPED items never appear. Covers TV, regional categories (#37),
    anime (works with franchises: a new season or movie announced in the franchise shows on the franchise tile)
    and movies.
44. ⛔ **Declined (2026-10-01)**: no email digest. Updates stay in-app (web push could be revisited with a PWA).

Depends on #17 (typed progress), #22 (TV seasons stored), anime franchise A–D. Fits after step 4 below.

### Music revamp → removal (decided 2026-10-01)

The user wanted Music rebuilt as a full player of its own (songs, artists, trending, playlists, history, genres)
without relying on YouTube Music / Spotify / Apple Music, **and** decided: if full-length audio isn't available
through an API without keeping downloaded copies, remove the Music category entirely. That condition holds:
catalogue APIs (iTunes, used today) give 30-second previews only; full playback SDKs need a platform subscription
(Spotify Premium); the only legal full-length APIs are independent Creative Commons catalogues (rejected 2026-09-14).
Own-file streaming was offered (upload owned files, stream from the server; needs the Oracle VM for bandwidth since
GCP's free tier is ~1 GB egress/month) and declined under that rule. Playback through the user's YouTube
Premium Family via the official IFrame Player + Data API v3 was also considered (full-length, but the player must
stay visible, there's no background play on phones, and it depends on YouTube) and declined: Music is dropped.

45. ✅ **Fixed** (`8be2453`) — **Remove the Music category** (decided). Scope:
    - Frontend: delete `pages/MusicCategory.tsx`; drop `MUSIC` from `TYPES` (`pages/Home.tsx`), `MediaType`
      (`types.ts`), `BigCategoryCard.tsx`, `SearchModal.tsx`, `Category.tsx`.
    - Backend: delete `services/providers/itunes.ts` and the `/providers/track-meta` route; drop `MUSIC` from the
      zod enums in `routes/library.ts`, `providers.ts`, `suggestions.ts`; remove the iTunes branch from
      `scripts/backfillCollections.ts`; update the `collectionSource` comment in `schema.prisma`.
    - Data: on the VM, **export MUSIC rows (and any list items pointing at them) to
      `/opt/grimoire/backups/music-export-<date>.json` before deleting**. Locally there are 2 songs (both
      PLANNED, in no list). Lists that end up empty and were created as "Music playlist" get removed too.
    - README: remove Music from features/screenshots.
    - Makes #27–29 obsolete; #18 `creator` now covers author + director only.
    - Reversible: if own-file streaming is wanted later, it's a new module (not this code back).

### Product review: a media critic's view (2026-10-01)

Whole app reviewed (Movies, TV, Anime, Books, Lists, Home, Settings; Music excluded per #45) against what a
serious tracker (Letterboxd / AniList / Trakt / Goodreads) treats as table stakes.

**Must-haves that are broken or missing**

46. ✅ **Fixed** (`53f1e99`) — **Personal and online ratings are blended** (high). `MediaDetail.tsx` renders `⭐ {yourRating ?? globalRating}`:
    an unrated item shows the *online* score in the *personal* slot. `MediaCard` shows a single number that is yours
    if set, otherwise global, labelled "TMDB" even for AniList/Google items. **Fix:** always two separate, labelled
    values ("You 8.5" / "TMDB 7.9 · 12k votes"); "Not rated" when you haven't rated it.
47. ✅ **Fixed** (`53f1e99`) — **"Unrated" and "0" are the same; the slider spams saves** (medium). The 0–10 range input starts at 0 when unrated
    and fires a PATCH on every drag step. **Fix:** a 10-point (half-step) star control with "Clear", saving on release.
48. ✅ **Fixed** (`53f1e99`) — **Online scores use different scales** (medium). TMDB 0–10, AniList stored /10, Google Books raw 0–5, all shown
    side by side. **Fix:** normalise to /10 for display, always show source + vote count, hide below a vote
    threshold (#34).
49. ✅ **Done** (`0515907`; OMDb key live, MAL limited by #82) — **No critic vs audience split** (medium). Only one source per medium. **Fix:** OMDb (free key, 1,000/day,
    joined via TMDB `external_ids` → IMDb id) adds **IMDb** (audience), **Rotten Tomatoes** and **Metacritic**
    (critics) for movies/TV; Jikan (free, no key) adds the **MyAnimeList** score next to AniList for anime.
50. ✅ **Done** (`daa95b0`, `4be2080`) — **No dates, no rewatches** (high). The schema has only `createdAt`/`updatedAt`, so there's no "started",
    "finished", or rewatch count. **Fix:** a `WatchLog` table (one row per watch/read: started, finished, rating at
    the time, rewatch flag). The detail page shows the history; a status change to COMPLETED prompts for the finish
    date (defaults to today).
51. ✅ **Done** (`daa95b0`, `4be2080`) — **Review and notes are the same field** (medium). **Fix:** a written **review** (with spoiler flag) per watch,
    kept apart from private **notes**.
52. ✅ **Done** (`de565e8` data, `109c6dd` person/studio pages) — **No cast/crew/studio** (medium). You can't see or browse "everything by Denis Villeneuve" or "all MAPPA
    anime". **Fix:** store director/creator + top cast (TMDB credits), studio (AniList `studios`), author (#18);
    each is a link to a person/studio page listing what you've logged plus their other work.
53. ✅ **Fixed** (`53f1e99`) — **Status wording is inconsistent and medium-blind** (low). Raw enums on the detail page ("IN_PROGRESS"),
    "Ongoing" on cards, "Watching" on Category; `MediaCard.prettyStatus` checks `"PLANNING"`, which never exists.
    Books should say Reading / Want to read. **Fix:** one label map per media type.
54. ✅ **Done** (`daa95b0`, `4be2080`) — **Lists are create-only** (medium). No rename, delete, reorder, remove item, or "already in this list"
    state; "+ Add to …" gives no feedback. **Fix:** full list management, ranked lists with per-item notes.
55. ✅ **Fixed** (`53f1e99`) — **Delete has no confirmation or undo and is hover-only** (high). The card's delete button is `opacity-0`
    until hover: invisible on phones and to the keyboard, and one click removes the item with its rating/notes.
    **Fix:** move delete into the detail page / a menu, confirm, 10-second undo toast.
56. **No export or import** (high). Everything lives in one SQLite file on a free VM; there's no way to get your
    data out or bring history in. **Fix:** export to JSON/CSV; import from **AniList/MAL** (anime), **Letterboxd /
    IMDb ratings CSV** (movies), **Trakt** (TV), **Goodreads CSV** (books).
57. **Suggestions ignore your taste** (medium). `pickTopGenres` counts genres across the whole library, including
    DROPPED and unrated items, so a genre you keep dropping still drives suggestions. **Fix:** weight by your rating
    and status (rated ≥ 8 counts most, dropped counts against).

**Accessibility**

58. ➡️ **Folded into #83** (design foundation, Phase 4) — **Low-contrast text** (medium). 33 uses of `opacity-60` (plus `opacity-40/50`) on small text over dark glass,
    likely below WCAG AA 4.5:1. **Fix:** contrast tokens checked against AA; minimum 12 px for body text.
59. ➡️ **Folded into #87** (design foundation, Phase 4) — **No visible keyboard focus** (medium). 18 inputs use `outline-none` and there are no `focus-visible` styles,
    so keyboard users can't see where they are. **Fix:** a global `focus-visible` ring; full keyboard path
    through search → add → rate.
60. ➡️ **Folded into #87** (design foundation, Phase 4) — **Motion can't be turned off** (medium). Framer Motion in 5 components (Home, BigCategoryCard, CardStack,
    SearchModal, PasscodeGate) with no `prefers-reduced-motion` handling. **Fix:** `useReducedMotion` → fades
    instead of scale/tilt.
61. ➡️ **Folded into #84, #87** (design foundation, Phase 4) — **Screen-reader gaps** (low). Ratings are emoji (⭐ 🌍 read as "star", "globe"), the rating slider has no
    label, status buttons read raw enums, and only 12 `aria-` attributes exist app-wide. Native titles
    (日本語 / 한국어 / Türkçe / اردو) need `lang`, and Urdu needs `dir="rtl"`.
62. ➡️ **Folded into #83, #84, #87** (design foundation, Phase 4) — **Touch targets and theme** (low). `text-xs px-2 py-1` chips are well under 44 px; dark only, no text-size
    option. **Fix:** 44 px targets on touch, Settings → Appearance (System / Light / Dark, text size).

**New features (personalisation)**, in suggested priority:

63. **Stats & Year in review**: hours watched (runtime × episodes), counts per medium/country/genre/decade, your
    rating distribution, **"you vs the crowd"** (your rating minus the online one: your most contrarian takes),
    favourite directors/studios/countries; a yearly "Grimoire Wrapped" page.
64. ✅ **Done** (`daa95b0`, `4be2080`) — **Diary**: a calendar/heatmap of what you finished each day (from #50), Letterboxd-style.
65. **"What should I watch tonight?"**: picks from your Planned list by time available (runtime / episodes
    left), mood tag, medium, region, language; one tap to start.
66. ✅ **Done** (`daa95b0`, `4be2080`) — **Personal tags & moods**: free tags ("comfort watch", "with family", "rewatchable") + optional mood; usable
    as filters everywhere.
67. ✅ **Done** (`daa95b0`, `4be2080`) — **Favourites & tier lists**: an all-time Top 10 per medium and drag-and-drop S/A/B/C tiers for a franchise or
    genre; shown on Home.
68. **Taste-based suggestions**: "Because you rated *Dark* 9.5" built from your highest-rated items, their
    creators/studios and countries, not only genres (builds on #36, #57).
69. **Goals**: yearly targets ("50 films", "12 books", "finish 5 backlog anime") with progress on Home.
70. ✅ **Done** (`daa95b0`, `4be2080`) — **Watch details per log**: where (cinema / Netflix / YouTube), how (sub / dub / original language), with whom.
71. **Spoiler shield**: blur synopses/episode titles of shows you're mid-way through (pairs with airing updates).
72. **Rewatch / re-read nudges**: "You rated *Your Name.* 10 three years ago": occasional resurfacing on Home.
73. **Trailers & where to watch**: TMDB videos (trailer button) and watch providers (where data exists; none for
    PK, see #37 note).
74. **Share a list**: a read-only public link to a single list or Top 10 (the rest of the app stays private).

### Design handoff review (2026-10-01)

Claude Design delivered the design system and four key screens (Home, Category, Detail, Log sheet) at 390 and
1440 px. The files are in `docs/design/` (open the `.dc.html` files in a browser with `support.js` next to them);
`docs/design/README.md` is the spec. **Fidelity is literal** (layout, labels, chart types), except posters/backdrops
(placeholders) and the score numbers (invented). Not designed yet: Search & add, Franchise, Lists / Tier list,
Diary, Stats / Wrapped, Tonight, Settings, Shared list, Unlock. These are built from the system's components.

**What the design changes about decisions already made**
- Home stops being category tiles. It becomes **"Up next"**: Ready to watch, Coming soon, Continue, Tonight,
  Goals, Rewatch nudge, Favourites. The eight categories (incl. the four regional ones, #37) move to a
  **Library** hub, the desktop sidebar (with counts and "N new" pills) and the phone tab bar.
- Navigation: phone **bottom tab bar** (Home · Library · Search · Lists · You); desktop **sidebar + top bar** (global
  search with a `/` shortcut, "Watch tonight", "Log").
- Your rating input becomes **10 cells** (tap twice for a half point), not 10 stars. "You" is always pink with
  the ✦ sigil; online scores are neutral text under "ONLINE · AUDIENCE" / "ONLINE · CRITICS".
- Diary heatmap: **26 weeks**, ramp `--s2 → #453a7a → #6f5fc4 → #ab9ef2` (replaces the year view and the ramp in
  `Diary.tsx`). Tier colours: S pink, A lavender, B green, C amber, D grey (replaces `TierListPage.tsx`'s).
- Flags are **images** with the country name as `alt` (bundled SVGs), not emoji.
- No glassmorphism, no 3D tilt, no blur except the spoiler shield: the current Aceternity-style effects
  (`BigCategoryCard` accordion/tilt, `.glass`) go.
- Goals (#69), Tonight (#65) and the rewatch nudge (#72) are on Home, so they move earlier in the order.

**Design foundation**

83. **Tokens + themes.** CSS custom properties from the spec (`--bg`, `--s1…s3`, `--line`, `--tx…tx3`, `--acc`,
    `--accbg`, `--you`, `--youbg`, `--ok/warn/err`, `--scrim`), dark + light, **System / Light / Dark** setting.
    Surfaces step in lightness; shadows only on posters, dialogs, toasts. Replaces #58 (contrast) and the
    theme part of #62.
84. **Type + icons + fonts.** Newsreader (titles, scores), Hanken Grotesk (UI), Noto Sans JP / KR / SC, Noto
    Nastaliq Urdu (`dir="rtl"`, its own 18px/2.1 box), Material Symbols Rounded. Sizes in `rem` so the **text-size
    setting** scales the root. Self-hosted for the PWA; CJK/Urdu fonts loaded by `unicode-range` so they don't
    weigh down Latin-only pages. Bilingual title block per spec (#32).
85. **App shell.** Phone tab bar (54px tabs, filled icon when active); desktop 256px sidebar (wordmark ✦ Grimoire,
    nav, Library sub-items with counts + "N new", "Lock now") and top bar. New **Library hub** and **You** pages.
86. **Component kit** (`docs/design/Grimoire Design System.dc.html`): buttons (primary/secondary/ghost/destructive,
    44px icon button), solid poster badges (NEW, airing, Ended, Caught up, DUB, 18+, rating), flag chip + filter
    chips + status chips, status menu with dots, segmented control, underline tabs, toast with Undo, confirm dialog
    ("Keep · Delete"), bottom sheet (drag to dismiss) / dialog, skeletons, empty ("This chapter is unwritten"),
    error ("Couldn't reach AniList · Try again"), offline banner, 404 ("This page was torn out").
87. **Accessibility built in.** 2px `--acc` focus ring on every control, 44px touch targets (40 on desktop
    secondary), reduced-motion alternative for every animation, `aria-label` on icon buttons, `lang`/`dir` on
    original titles. Replaces the separate sweep #59–62.
88. **Rating input v2:** 10 cells, `role="slider"`, half points by tapping a cell twice, arrows ±0.5,
    Delete clears. Replaces the star `RatingInput` (#47).
89. **Poster-accent hero tint** on the detail page: sample the poster's dominant colour (canvas; TMDB/AniList
    images allow CORS), keep it dark (oklch L ≈ 0.35), 55% → transparent gradient. Toggleable.
90. **Missing asset:** the empty-state **spellbook illustration** is "still to be supplied" (by the user / Claude
    Design). Until then the empty state uses the ✦ sigil.

**Screen changes against what's built**

91. **Home → "Up next"** (design 1a/1b/1c): Ready to watch cards (16:9 backdrop, badge, flag + title + original,
    line, sub, contextual primary action "Start S4 E1" / "Log Ep 1170" / "Mark watched", snooze menu: 1 day /
    1 week / until next episode / Dismiss with Undo); Coming soon rows (date block, "in 3 days" pill); Continue
    (progress bar + "+1" / "+10" quick increment that re-sorts); Tonight card; 2026 goals; rewatch nudge;
    Favourites ✦ shelf. Desktop `1fr | 360px`. Needs the airing data (#39–43).
92. **Category** (2a/2b): underline sub-tabs (Series · Movies · 18+ hidden), search + filter button with count,
    status chips with counts (single select), **country flag chips (multi-select)**, Genre ▾ / Tags ▾ dropdowns,
    "Clear", **Sort** (Recently updated ▾) and **grid/list toggle**. Poster card: badge top-left, flag top-right,
    your ✦ rating bottom-left, DUB bottom-right (DUB = you watch it dubbed: latest log's `watchMode`), then title,
    original title, one meta line. Franchise tile = stacked-volume effect; collection tile = 2×2 mosaic with
    "4 of 5 watched · Ch. 5 new". 6 columns desktop, 3 phone.
93. **Detail** (3a/3b): hero with poster-accent (#89), breadcrumb, title + original, meta line with studio and
    AIRING badge, "Add to list", ⋯ menu (Move to…, Delete). Airing banner ("Ep 1182 airs Sun 4 Oct · 09:30 JST ·
    in 3 days · 12 aired since your last" + "Remind me"). Status dropdown + primary "Log Ep N". Progress card with
    stepper and "Edit total episodes". **You** panel (pink, "Rated 2 Mar 2026 · Clear") + **Online** panel
    (audience/critics). Tabs: **Episodes** (arc picker, per-episode rows, spoiler shield) · History · Review & notes
    · Cast & crew · Franchise. Where to watch. Tags with "+ Tag" and "In 2 lists". Desktop right rail 380px.
94. **Log sheet** (4a/4b): Finished = Today / Yesterday / date; 10-cell rating with "Last time: ✦ 10 on 12 Sep
    2023"; review + Spoilers switch; Where = chips (Cinema · Netflix · Crunchyroll · YouTube · Other); How =
    segmented Sub / Dub / Original; With whom; **Rewatch switch with ordinal** ("Rewatch · 3rd"); "Save to diary";
    toast "Logged Your Name. · ✦ 10" with Undo (6 s). Esc closes, ⌘↵ saves. The design has no "Started" field:
    the start date comes from marking it Watching. **Logging the final episode opens this sheet prefilled
    Completed.** Replaces `LogDialog.tsx`.
95. **Undesigned screens** (Search & add, Franchise, Lists / Tier list, Diary, Stats / Wrapped, Tonight, Settings,
    Shared list, Unlock) get restyled from the kit; Franchise / Lists / Tier list / Diary already exist and only
    change look. Settings gains: theme, text size, reduced motion, **show 18+** (hidden by default), **spoiler
    shield**, where-to-watch country.

**Data the design needs that the app doesn't store yet**

96. **When you rated it:** `yourRatingAt` ("Rated 2 Mar 2026"), and the previous log's rating/date for "Last time".
97. **Watch log episode range + label:** `fromEpisode`, `toEpisode`, `label` ("Rewatch · Wano arc · Ep 890 → 1085")
    and the rewatch ordinal (computed: "3rd").
98. **Episode list:** per-episode titles, air dates and arcs for the Episodes tab and the spoiler shield. TV:
    TMDB `/tv/{id}/season/{n}`. Anime: via #99 (TMDB groups long anime into arc-named seasons), Jikan
    `/anime/{id}/episodes` as fallback. Cached, fetched when the tab opens.
99. **Link anime to TMDB / IMDb.** The design shows TMDB, IMDb and where-to-watch on ONE PIECE. AniList items have
    no TMDB id: match by original title + year + Japan/China/Korea + Animation, store `tmdbId`/`imdbId` on the
    anime item, then reuse the movie/TV score and provider code.
100. **AniList score as %, with a count:** the design shows "AniList 87% (412k)". AniList has no vote count; use
     its `stats.scoreDistribution` total (or `popularity`) as the count.
101. **Snoozes / dismissals** stored server-side (`{itemId, eventKey, until}`) so they hold across devices, not in
     localStorage.
102. **Settings record:** theme and text size per device (localStorage); show 18+, spoiler shield and
     where-to-watch country account-wide (DB).
103. **"N new" per category** for the sidebar/Library, from the Up Next computation.
104. **Offline logging** (offline banner: "3 logs are saved on this device"): queue log/progress writes in the
     PWA when offline and sync on reconnect. Part of the PWA work.
105. **Global "Log" button:** pick an item from the library (search), then the log sheet.

**Open questions for the user**

106. ✅ **Decided:** pin it to the top of Coming soon (no push, no email) — **"Remind me"** on the airing banner: email is declined (#44). Options: a web-push notification (needs the
     PWA + permission), or just pin it to the top of Coming soon.
107. ✅ **Decided:** changeable in Settings; no default assumed, Settings asks once (pre-selected from the browser region) — **Where to watch** is per country in TMDB. Which country's streaming catalogue should it show?
108. ✅ **Decided:** build them from the design kit; the user reviews screenshots — The **undesigned screens** (#95): build them from the kit, or run a second Claude Design round first
     (Search & add, Stats / Wrapped and Tonight are the most visual)?

### Build order (agreed 2026-10-01)

Each step: one commit per item, verified against the real library, then deployed. Personalisation features
#63–74 are all kept (decided 2026-10-01).

**Phase 0: ship blockers + quick wins** ✅ deployed 2026-10-01 (`43943b6`; music export at
`/opt/grimoire/backups/music-export-2026-10-01.json`, pre-deploy DB at `backups/pre-deploy-phase0-*.db`)
0. Remove the auth bypass (#5); commit + deploy the bootstrap fix (#2), MediaDetail save fix (#3),
   providers/details handler (#4).
1. Remove Music (#45), so later migrations and backfills don't carry MUSIC paths.
2. Rating quick wins: separate personal vs online (#46), star control with Clear (#47), normalised scales (#48).
   Safe delete with confirm + undo (#55). Status labels per medium (#53).

**Phase 1: data foundation (one migration, one backfill)** ✅ built + verified on a copy of the local data
(`9252d3c`, `de565e8`), ✅ deployed 2026-10-01 (`5d93428`): backfill 192/192, 47 franchises, 1,085 credits
3. **One schema migration** for the shared data: Franchise table + anime fields (A); `creator` (#18);
   `metaCheckedAt` (#19); TV `seasons`/`episodes` (#22); `countryOfOrigin`/`originalLanguage`/`nativeTitle`
   (#31–32); `region`/`regionOverride` (#37); airing snapshot (#39); **WatchLog** with started/finished dates,
   rewatch flag, rating-at-the-time, review + spoiler flag, and watch details: where / sub-dub-original / with
   whom (#50, #51, #70); credits + studio (#52); personal **tags** + mood (#66). One migration is less risky on
   the VM than many.
4. **Server-side enrichment on add** for every provider (C, #19) + **one backfill script** for all types
   (D, #20, #22, #24, credits #52, countries #31).

**Phase 2: tracking core** ✅ deployed 2026-10-01 (`5bf7f33`; backup `backups/pre-deploy-phase2-*.db`)
5. Typed progress (#17) + TV season picker (#22) + progress-total override (#35).
6. Diary and logging UI: watch history on the detail page, finish-date prompt, reviews (#50, #51, #70);
   **Diary heatmap (#64)**.
7. Lists: rename / delete / reorder / remove, ranked lists (#54); **Favourites & tier lists (#67)** (small
   migration for tiers).
8. Personal tags & moods: filters everywhere (#66).

**Phase 3: catalogue structure** ✅ deployed 2026-10-01 (`f1c5209`; OMDb key on the VM; re-enrichment run
for scores: 193/193 ok; IMDb 112, RT 98, Metacritic 100, MAL ids 77 but MAL scores only 3 because
Jikan was down, see #82)
9. Anime franchise tile + page (E–I), then reuse for movie collections (#21); cast/crew/studio pages (#52).
10. International: regional categories + flags (#37), manual add (#38), romanization retry (#33), vote
    threshold (#34), dub badges (#35).
11. Critic vs audience scores: OMDb (IMDb / Rotten Tomatoes / Metacritic) + Jikan (MAL) (#49).

**Phase 4: design foundation** (from the handoff; everything after builds on it)
12. Tokens, light/dark/system themes, fonts, icons, bundled SVG flags (#83, #84).
13. App shell: phone tab bar, desktop sidebar + top bar, Library hub, You page (#85).
14. Component kit + states + accessibility rules (#86, #87), rating cells (#88), poster-accent (#89).
15. Remove the old visual layer: glass, tilt, the Home accordion (`BigCategoryCard`), framer-motion where the spec
    doesn't call for motion.

**Phase 5: built screens in the new design + the data they need**
16. Data: `yourRatingAt` (#96), log episode range/label (#97), settings record (#102), AniList % + count (#100),
    anime ↔ TMDB/IMDb link (#99).
17. Category (#92), Detail (#93, without the Episodes tab), Log sheet (#94).
18. Restyle Franchise, Collection, Person, Lists, Tier list, Diary, Search & add, Settings, Unlock from the kit
    (#95, #108); screenshots for review.
19. Episodes tab + spoiler shield (#98, #71).

**Phase 6: Up next**
20. Airing & release updates: daily job (also retries missing MAL scores, #82), snoozes (#101), badges/banners,
    "N new" counts (#103) (#39–43).
21. Home "Up next" (#91): Ready to watch, Coming soon, Continue, Favourites shelf.
22. Goals (#69), "What should I watch tonight?" (#65), rewatch nudges (#72): all three sit on Home.
23. Where to watch + trailers (#73; country from Settings, #107), "Remind me" = pin to Coming soon (#106).

**Phase 7: reflection, sharing, app**
24. Taste-based suggestions (#68), rating-weighted (#57), region-aware (#36); suggestion caching (#30).
25. Stats & Year in review / "Grimoire Wrapped" (#63) with the design's charts: bars, rating distribution in pink
    ("Average ✦ 7.6 vs the crowd's 7.3"), donut by country.
26. Export / import (#56).
27. Share a list (#74).
28. PWA: installable, self-hosted fonts, offline log queue (#104).
29. Polish: cover images (#25), deploy script (#6), uptime check (#7).

## Polish / optimization

6. **Deploy is manual and fiddly**: a fresh `gh auth token` per pull, rebuilding both apps, `npm approve-scripts`
   after installs, restarting the service. A `scripts/deploy.sh` run over SSH would make it one command.
7. **No uptime monitoring**: `/health` exists (`backend/src/index.ts:54`) but nothing watches it. A free external
   check (e.g. UptimeRobot) would flag outages on the 1 GB VM.
8. ✅ **Fixed** (`9252d3c`) — **Stale `mv_*` names in comments**: `backend/prisma/schema.prisma` still says `mv_device`, `mv_session` and
   `mv_pending_device` after the cookie rename to `gr_*`.
30. **Suggestions cache never short-circuits**: `routes/suggestions.ts` writes `SUG_CACHE` but only reads it as a
    fallback when a provider call fails, so every page load still hits TMDB/AniList/Google/iTunes. Return the cached
    block when present (non-refresh), as the comments intend.
