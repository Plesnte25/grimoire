import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// An isolated database with the real migrations applied.
const dir = mkdtempSync(path.join(tmpdir(), "grimoire-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

const { prisma, dbReady } = await import("../db.js");
await dbReady;
const { applySpec, validateSpec } = await import("./franchiseCuration.js");
const { syncWork } = await import("./works.js");
type Spec = Parameters<typeof validateSpec>[0];

after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
});

const resolve = async (ref: string) => (ref.startsWith("missing") ? null : { id: `w-${ref}`, title: ref });
const spec = (entries: Spec["entries"]): Spec => ({ name: "T", franchise: "f1", entries });
const e = (work: string, o: Partial<Spec["entries"][number]> = {}): Spec["entries"][number] => ({
    work, relation: "main", isEssential: true, ...o,
});

test("rejects a prerequisite cycle", async () => {
    const { problems } = await validateSpec(spec([e("a", { prerequisite: "b" }), e("b", { prerequisite: "a" })]), resolve);
    assert.equal(problems.filter((p) => p.includes("prerequisite cycle")).length, 1);
});

test("rejects a self-referencing prerequisite", async () => {
    const { problems } = await validateSpec(spec([e("a", { prerequisite: "a" })]), resolve);
    assert.match(problems.join(), /own prerequisite/);
});

test("rejects a prerequisite that is not an entry of the franchise", async () => {
    const { problems } = await validateSpec(spec([e("a", { prerequisite: "outside" })]), resolve);
    assert.match(problems.join(), /not an entry of this franchise/);
});

test("rejects an unknown work reference", async () => {
    const { problems } = await validateSpec(spec([e("missing-1")]), resolve);
    assert.match(problems.join(), /unknown work "missing-1"/);
});

test("warns, but does not fail, when a non-essential entry is a prerequisite", async () => {
    const { problems, warnings } = await validateSpec(
        spec([e("s2", { prerequisite: "ova" }), e("ova", { relation: "ova", isEssential: false })]),
        resolve
    );
    assert.deepEqual(problems, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /non-essential.*prerequisite of "s2"/);
});

test("a clean spec has no problems or warnings", async () => {
    const r = await validateSpec(spec([e("a"), e("b", { prerequisite: "a" })]), resolve);
    assert.deepEqual([r.problems, r.warnings], [[], []]);
});

const item = (id: string, over: Record<string, unknown> = {}) =>
    prisma.mediaItem.create({
        data: { id, mediaType: "ANIME", provider: "anilist", providerId: id, title: id, ...over } as any,
    });

test("syncWork does not overwrite a curated link", async () => {
    await prisma.franchise.createMany({ data: [{ id: "f1", title: "One" }, { id: "f2", title: "Two" }] });
    await item("m1", { franchiseId: "f1", franchiseRole: "MAIN", franchiseOrder: 1 });
    await prisma.$transaction((tx) => syncWork(tx, "m1"));

    const derived = await prisma.franchiseLink.findUniqueOrThrow({ where: { workId_franchiseId: { workId: "m1", franchiseId: "f1" } } });
    assert.equal(derived.curated, false);

    await prisma.franchiseLink.update({
        where: { id: derived.id },
        data: { curated: true, relation: "sequel", narrativeOrder: 7, isEssential: false },
    });
    // Re-point the item at another franchise and change its role; the curated link must survive.
    await prisma.mediaItem.update({ where: { id: "m1" }, data: { franchiseId: "f2", franchiseRole: "OVA", franchiseOrder: 9 } });
    await prisma.$transaction((tx) => syncWork(tx, "m1"));

    const kept = await prisma.franchiseLink.findUniqueOrThrow({ where: { id: derived.id } });
    assert.deepEqual(
        [kept.curated, kept.relation, kept.narrativeOrder, kept.isEssential],
        [true, "sequel", 7, false]
    );
    // The uncurated link for the new franchise is derived normally.
    const fresh = await prisma.franchiseLink.findUniqueOrThrow({ where: { workId_franchiseId: { workId: "m1", franchiseId: "f2" } } });
    assert.deepEqual([fresh.curated, fresh.relation, fresh.order], [false, "ova", 9]);
});

test("uncurated links still follow MediaItem", async () => {
    await item("m2", { franchiseId: "f1", franchiseRole: "MAIN", franchiseOrder: 1 });
    await prisma.$transaction((tx) => syncWork(tx, "m2"));
    await prisma.mediaItem.update({ where: { id: "m2" }, data: { franchiseId: "f2" } });
    await prisma.$transaction((tx) => syncWork(tx, "m2"));
    const links = await prisma.franchiseLink.findMany({ where: { workId: "m2" } });
    assert.deepEqual(links.map((l) => l.franchiseId), ["f2"]);
});

test("resolves works by any ExternalId, including namespaced TMDB ids", async () => {
    await item("m3", { provider: "tmdb", providerId: "1429", mediaType: "TV", imdbId: "tt2560140" });
    await prisma.$transaction((tx) => syncWork(tx, "m3"));
    const { resolveWorkRef } = await import("./franchiseCuration.js");
    assert.equal((await resolveWorkRef("tmdb:tv:1429"))?.id, "m3");
    assert.equal((await resolveWorkRef("imdb:tt2560140"))?.id, "m3");
    assert.equal((await resolveWorkRef("m3"))?.id, "m3");
    assert.equal(await resolveWorkRef("tmdb:movie:1429"), null);
});

test("applySpec writes curated links with prerequisites", async () => {
    await item("a1");
    await item("a2");
    await prisma.$transaction(async (tx) => { await syncWork(tx, "a1"); await syncWork(tx, "a2"); });
    const { warnings } = await applySpec(
        spec([e("anilist:a1", { narrativeOrder: 1 }), e("anilist:a2", { relation: "sequel", narrativeOrder: 2, prerequisite: "anilist:a1" })])
    );
    assert.deepEqual(warnings, []);
    const links = await prisma.franchiseLink.findMany({ where: { workId: { in: ["a1", "a2"] }, franchiseId: "f1" } });
    const a1 = links.find((l) => l.workId === "a1")!;
    const a2 = links.find((l) => l.workId === "a2")!;
    assert.deepEqual([a1.curated, a2.curated, a2.prerequisiteId], [true, true, a1.id]);
});
