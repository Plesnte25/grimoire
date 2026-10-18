import test from "node:test";
import assert from "node:assert/strict";
import { pickNextUp, type NextUpLink } from "./franchiseNextUp.js";

const link = (id: string, o: Partial<NextUpLink> = {}): NextUpLink => ({
    id, workId: `w-${id}`, isEssential: true, narrativeOrder: null, order: null, prerequisiteId: null, status: null, ...o,
});

test("empty franchise has nothing next", () => assert.equal(pickNextUp([]), null));

test("starts with the lowest narrative order", () => {
    const next = pickNextUp([link("b", { narrativeOrder: 2 }), link("a", { narrativeOrder: 1 })]);
    assert.deepEqual([next?.link.id, next?.reason], ["a", "start"]);
});

test("skips completed entries", () => {
    const next = pickNextUp([link("a", { narrativeOrder: 1, status: "completed" }), link("b", { narrativeOrder: 2 })]);
    assert.equal(next?.link.id, "b");
});

test("in-progress entry is continued", () => {
    const next = pickNextUp([link("a", { narrativeOrder: 1, status: "completed" }), link("b", { narrativeOrder: 2, status: "in_progress" })]);
    assert.deepEqual([next?.link.id, next?.reason], ["b", "continue"]);
});

test("optional entries are never suggested", () => {
    assert.equal(pickNextUp([link("a", { isEssential: false })]), null);
});

test("an incomplete prerequisite blocks its dependent", () => {
    const next = pickNextUp([
        link("ova", { narrativeOrder: 1, prerequisiteId: "s1" }),
        link("s1", { narrativeOrder: 2 }),
    ]);
    assert.equal(next?.link.id, "s1");
});

test("a non-essential prerequisite still blocks", () => {
    assert.equal(pickNextUp([link("s2", { prerequisiteId: "ova" }), link("ova", { isEssential: false })]), null);
});

test("dependent unlocks once the prerequisite is completed", () => {
    const next = pickNextUp([link("s2", { narrativeOrder: 2, prerequisiteId: "s1" }), link("s1", { narrativeOrder: 1, status: "completed" })]);
    assert.equal(next?.link.id, "s2");
});

test("falls back to legacy order, curated entries first", () => {
    const next = pickNextUp([link("x", { order: 1 }), link("y", { narrativeOrder: 9 })]);
    assert.equal(next?.link.id, "y");
    assert.equal(pickNextUp([link("p", { order: 2 }), link("q", { order: 1 })])?.link.id, "q");
});

test("everything done means nothing next", () => {
    assert.equal(pickNextUp([link("a", { status: "completed" }), link("b", { status: "completed" })]), null);
});
