#!/usr/bin/env node
// Browser smoke check (KNOWN_ISSUES #129): visits every authenticated route at desktop and
// phone viewports, collects console errors/warnings, page errors and failed requests, and
// detects horizontal overflow at 320-430 px. Exits 1 on any finding, 2 on setup problems.
//
// Usage (app already running, e.g. `npm start` in backend/ serving frontend/dist):
//   GRIMOIRE_SMOKE_URL=http://127.0.0.1:5050 node scripts/smoke-routes.mjs --seed
//   GRIMOIRE_SMOKE_URL=... GRIMOIRE_SMOKE_SESSION=<gr_session> GRIMOIRE_SMOKE_DEVICE=<gr_device> node scripts/smoke-routes.mjs
//
// Auth: --seed inserts a TrustedDevice + Session through backend/'s Prisma client (the database
//   in backend/.env) and deletes them afterwards. Alternatively pass existing cookie values.
// Playwright: resolved from the cwd, frontend/, backend/, or GRIMOIRE_PLAYWRIGHT_PATH
//   (directory containing node_modules/playwright, or the package directory itself).
// Options: --url <base>, --seed, --headed; env GRIMOIRE_SMOKE_IGNORE = regex of messages to ignore.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const baseUrl = (opt("url") ?? process.env.GRIMOIRE_SMOKE_URL ?? "http://127.0.0.1:5050").replace(/\/+$/, "");
const ignore = process.env.GRIMOIRE_SMOKE_IGNORE ? new RegExp(process.env.GRIMOIRE_SMOKE_IGNORE) : null;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800, mobile: false },
  { name: "mobile-320", width: 320, height: 640, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-430", width: 430, height: 932, mobile: true },
];

// Static authenticated routes from frontend/src/router.tsx; dynamic ones are filled from the API.
const STATIC_ROUTES = [
  "/", "/library", "/discover", "/you", "/stats", "/lists", "/diary", "/settings",
  "/category/MOVIE", "/category/TV", "/category/ANIME", "/category/BOOK",
  "/region/TR", "/region/PK", "/region/KR", "/region/EU",
];

function die(msg) {
  const error = new Error(`SETUP ERROR: ${msg}`);
  error.exitCode = 2;
  throw error;
}

function loadPlaywright() {
  const bases = [process.cwd(), path.join(root, "frontend"), path.join(root, "backend"), root];
  const extra = process.env.GRIMOIRE_PLAYWRIGHT_PATH;
  const tried = [];
  for (const b of bases) {
    try { return createRequire(path.join(b, "noop.js"))("playwright"); } catch { tried.push(b); }
  }
  if (extra) {
    const candidates = [path.join(extra, "node_modules", "playwright"), extra];
    for (const c of candidates) {
      try { return createRequire(path.join(root, "noop.js"))(c); } catch { /* next */ }
    }
  }
  die(`Playwright not found (looked in ${tried.join(", ")}). Install it somewhere (e.g. \`npm i --no-save playwright\` ` +
    `in a scratch dir plus \`npx playwright install chromium\`) and set GRIMOIRE_PLAYWRIGHT_PATH to that directory.`);
}

async function seedAuth() {
  const backend = path.join(root, "backend");
  let PrismaClient;
  try {
    ({ PrismaClient } = createRequire(path.join(backend, "noop.js"))("@prisma/client"));
  } catch (e) { die(`--seed needs backend dependencies and \`prisma generate\`: ${e.message}`); }
  process.chdir(backend); // so backend/.env (DATABASE_URL) is picked up
  const prisma = new PrismaClient();
  const existingAccount = await prisma.accountConfig.findUnique({ where: { id: 1 } });
  const seededAccount = !existingAccount;
  if (seededAccount) {
    await prisma.accountConfig.create({
      data: {
        email: "smoke-test@invalid.example",
        pinSaltHex: crypto.randomBytes(16).toString("hex"),
        pinHashHex: crypto.randomBytes(32).toString("hex"),
      },
    });
  }
  const device = await prisma.trustedDevice.create({ data: { label: "smoke-check", userAgent: "grimoire-smoke" } });
  const session = await prisma.session.create({
    data: { deviceId: device.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return {
    device: device.id,
    session: session.id,
    async cleanup() {
      await prisma.session.deleteMany({ where: { id: session.id } });
      await prisma.trustedDevice.deleteMany({ where: { id: device.id } });
      if (seededAccount) await prisma.accountConfig.deleteMany({ where: { id: 1 } });
      await prisma.$disconnect();
    },
  };
}

async function api(cookie, p) {
  try {
    const r = await fetch(`${baseUrl}/api${p}`, { headers: { cookie } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function discoverRoutes(cookie) {
  const routes = [...STATIC_ROUTES];
  const skipped = [];
  const add = (label, p) => (p ? routes.push(p) : skipped.push(label));

  const library = await api(cookie, "/library");
  const items = Array.isArray(library) ? library : library?.items ?? [];
  add("/media/:id", items[0] && `/media/${items[0].id}`);
  const withFranchise = items.find((i) => i.franchiseId);
  add("/franchise/:id", withFranchise && `/franchise/${withFranchise.franchiseId}`);
  const withCollection = items.find((i) => i.collectionId);
  add("/collection/:id", withCollection && `/collection/${withCollection.collectionId}`);
  if (items[0]) {
    const detail = await api(cookie, `/library/${items[0].id}`);
    const contrib = detail?.contributors?.[0]?.contributor?.id;
    add("/people/:id", contrib && `/people/${encodeURIComponent(contrib)}`);
  } else skipped.push("/people/:id");

  const lists = await api(cookie, "/lists");
  const listArr = Array.isArray(lists) ? lists : lists?.lists ?? [];
  add("/lists/:id", listArr[0] && `/lists/${listArr[0].id}`);
  const tiers = await api(cookie, "/tier-lists");
  const tierArr = Array.isArray(tiers) ? tiers : tiers?.tierLists ?? [];
  add("/tier-lists/:id", tierArr[0] && `/tier-lists/${tierArr[0].id}`);
  return { routes, skipped };
}

async function checkRoute(browser, vp, route, cookies) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
  });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const findings = [];
  const note = (kind, detail) => { if (!ignore || !ignore.test(detail)) findings.push({ kind, detail }); };

  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      const loc = m.location();
      note(`console.${m.type()}`, `${m.text()}${loc?.url ? ` (${loc.url}:${loc.lineNumber})` : ""}`);
    }
  });
  page.on("pageerror", (e) => note("pageerror", e.message));
  page.on("requestfailed", (r) => {
    const err = r.failure()?.errorText ?? "failed";
    if (err !== "net::ERR_ABORTED") note("request-failed", `${r.method()} ${r.url()} - ${err}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) note("http-error", `${r.status()} ${r.request().method()} ${r.url()}`);
  });

  try {
    await page.goto(baseUrl + route, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(750);
    const gate = await page.evaluate(() => /enter your pin|unlock|verification code|sign in/i.test(document.body?.innerText ?? "")
      && !document.querySelector("nav, main, [role=navigation]"));
    if (gate) note("auth", "app shows the sign-in/unlock gate; cookies were not accepted");
    if (vp.mobile) {
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        const vw = de.clientWidth;
        const doc = Math.max(de.scrollWidth, document.body.scrollWidth);
        const offenders = [];
        if (doc > vw + 1) {
          for (const el of document.body.querySelectorAll("*")) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
              const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
              offenders.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} [${Math.round(r.left)}..${Math.round(r.right)}]`);
              if (offenders.length >= 5) break;
            }
          }
        }
        return doc > vw + 1 ? { doc, vw, offenders } : null;
      });
      if (overflow) note("overflow-x", `document ${overflow.doc}px wide in ${overflow.vw}px viewport; e.g. ${overflow.offenders.join("; ") || "n/a"}`);
    }
  } catch (e) {
    note("navigation", e.message.split("\n")[0]);
  } finally {
    await context.close();
  }
  return findings;
}

async function main() {
  if (typeof fetch !== "function") die("Node 18+ is required.");
  const { chromium } = loadPlaywright();

  let auth;
  let seeded;
  if (flag("seed")) {
    seeded = await seedAuth();
    auth = { session: seeded.session, device: seeded.device };
  } else {
    auth = { session: process.env.GRIMOIRE_SMOKE_SESSION, device: process.env.GRIMOIRE_SMOKE_DEVICE };
    if (!auth.session || !auth.device) die("Provide --seed, or GRIMOIRE_SMOKE_SESSION and GRIMOIRE_SMOKE_DEVICE (gr_session / gr_device cookie values).");
  }

  let failures = 0;
  try {
    const cookieHeader = `gr_session=${auth.session}; gr_device=${auth.device}`;
    const status = await api(cookieHeader, "/auth/status");
    if (status === null) die(`cannot reach ${baseUrl}/api/auth/status; is the app running (GRIMOIRE_SMOKE_URL)?`);
    if (!status.unlocked) die("server did not accept the seeded cookies (auth/status unlocked=false).");

    const { routes, skipped } = await discoverRoutes(cookieHeader);
    const url = new URL(baseUrl);
    const cookies = [["gr_session", auth.session], ["gr_device", auth.device]].map(([name, value]) => ({
      name, value, domain: url.hostname, path: "/", httpOnly: true, sameSite: "Lax", secure: url.protocol === "https:",
    }));

    const browser = await chromium.launch({ headless: !flag("headed") });
    console.log(`Smoke check ${baseUrl}: ${routes.length} routes x ${VIEWPORTS.length} viewports`);
    if (skipped.length) console.log(`Skipped (no data to build a URL): ${skipped.join(", ")}`);
    try {
      for (const route of routes) {
        for (const vp of VIEWPORTS) {
          const findings = await checkRoute(browser, vp, route, cookies);
          if (findings.length === 0) console.log(`  ok    ${vp.name.padEnd(12)} ${route}`);
          else {
            failures += findings.length;
            console.log(`  FAIL  ${vp.name.padEnd(12)} ${route}`);
            for (const f of findings) console.log(`          [${f.kind}] ${f.detail}`);
          }
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (seeded) await seeded.cleanup().catch((e) => console.error(`cleanup failed: ${e.message}`));
  }

  if (failures > 0) {
    console.error(`\nSMOKE CHECK FAILED: ${failures} finding(s).`);
    process.exit(1);
  }
  console.log("\nSmoke check passed: zero findings.");
}

main().catch((e) => { console.error(e.message ?? e); process.exitCode = e.exitCode ?? 2; });
