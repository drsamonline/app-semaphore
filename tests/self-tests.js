#!/usr/bin/env node
/* self-tests — Semaphore. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Done-means: two devices exchange messages; a THIRD that was absent receives everything it missed after ONE
 * sync, in the original order; a pinned bulletin appears for every member and cannot be edited by a
 * non-host; and with low-power mode on, no image or voice note can be attached. */
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var S = require(path.join(ROOT, "docs", "play", "semaphore-core.js"));
var passed = 0, failed = [], group = "";
function section(n) { group = n; }
function ok(n, c, d) { if (c) { passed++; return; } failed.push(group + " :: " + n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

function base() { return S.newGroup({ name: "Mela", host: "Sohil" }, 1000).group; }

section("done means — two devices exchange messages");
var a = base();
a = S.post(a, { from: "Sohil", text: "at the gate" }, 1001).group;
var b = base();
b = S.post(b, { from: "Aaji", text: "coming" }, 1002).group;
var s1 = S.sync(a, b);
eq("the sync succeeds", s1.ok, true);
eq("both hold two messages", s1.mine.messages.length, 2);
eq("and the same two", s1.theirs.messages.length, 2);
eq("in sequence order", s1.mine.messages.map(function (m) { return m.seq; }).join(","), "1,2");
eq("the first is from Sohil", s1.mine.messages[0].text, "at the gate");

section("done means — a third device that was ABSENT receives everything after ONE sync, in order");
var third = base();
eq("it starts with nothing", third.messages.length, 0);
eq("and knows what it is missing", S.missing(s1.mine, 0).count, 2);
var s2 = S.sync(third, s1.mine);
eq("one sync brings it everything", s2.mine.messages.length, 2);
eq("in the original order", s2.mine.messages.map(function (m) { return m.seq; }).join(","), "1,2");
eq("with the same words", s2.mine.messages.map(function (m) { return m.text; }).join("|"), "at the gate|coming");
ok("and the app says it caught up", /caught up on 2/.test(s2.says), s2.says);
eq("nothing is missing afterwards", S.missing(s2.mine, 0).count, 2);
eq("a device that has everything is missing nothing", S.missing(s2.mine, 2).count, 0);
/* order is TIME, not the alphabet: A posts first and Z second, so a merge that sorted by name would put
 * them the wrong way round */
var early = S.post(base(), { from: "A", text: "first" }, 2000).group;
var late = S.post(base(), { from: "Z", text: "second" }, 2001).group;
var ordered = S.sync(early, late);
eq("the catch-up keeps time order, not name order", ordered.mine.messages.map(function (m) { return m.text; }).join(","), "first,second");
var s3 = S.sync(s2.mine, s1.mine);
eq("a second sync adds nothing", s3.mine.messages.length, 2);

section("done means — a pinned bulletin appears for every member and only the host can edit it");
var pinned = S.pin(s1.mine, { by: "Sohil", text: "meet at gate 2 at 6" }, 1003);
eq("the host can pin", pinned.ok, true);
eq("and it is on the group", pinned.group.bulletin.text, "meet at gate 2 at 6");
var refused = S.pin(pinned.group, { by: "Aaji", text: "no, gate 3" }, 1004);
eq("a non-host cannot edit it", refused.ok, false);
eq("with the field named", refused.field, "by");
ok("and is told whose it is", /belongs to the host \(Sohil\)/.test(refused.reason), refused.reason);
var shared = S.sync(pinned.group, base());
eq("the bulletin reaches the other device", shared.mine.bulletin.text, "meet at gate 2 at 6");
eq("and the third", shared.theirs.bulletin.text, "meet at gate 2 at 6");
/* the bulletin travels from the device that HAS it to the one that does not */
var receives = S.sync(base(), pinned.group);
eq("a device with no bulletin receives it", receives.mine.bulletin.text, "meet at gate 2 at 6");
eq("a bulletin with no words is refused", S.pin(pinned.group, { by: "Sohil", text: "" }, 1).field, "text");

section("done means — with low-power mode on, no image or voice note can be attached");
var lp = S.setLowPower(pinned.group, true).group;
eq("low-power mode is on", lp.lowPower, true);
var blocked = S.post(lp, { from: "Aaji", text: "", attachment: "voice-note.m4a" }, 1005);
eq("an attachment is refused", blocked.ok, false);
eq("and it says why", blocked.lowPower, true);
ok("naming low-power mode", /low-power mode is on/.test(blocked.reason), blocked.reason);
var words = S.post(lp, { from: "Aaji", text: "ok", attachment: "" }, 1006);
eq("words still go through", words.ok, true);
var off = S.setLowPower(lp, false).group;
eq("with it off an attachment is allowed", S.post(off, { from: "Aaji", text: "", attachment: "photo.jpg" }, 1007).ok, true);

section("bad input");
eq("a group with no name is refused", S.newGroup({ host: "S" }, 1).field, "name");
eq("a group with no host is refused", S.newGroup({ name: "x" }, 1).field, "host");
eq("a message with no sender is refused", S.post(base(), { text: "x" }, 1).field, "from");
eq("a message with nothing in it is refused", S.post(base(), { from: "S" }, 1).field, "text");
eq("a sync between different groups is refused", S.sync(base(), S.newGroup({ name: "other", host: "S" }, 2).group).ok, false);

section("must-not — no network, and the transport gap is named");
var core = read("docs/play/semaphore-core.js");
/* scan the CODE: the comment that promises no WebSocket must not fail the check */
var codeOnly = (core + read("docs/play/app.js")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\*.*$/gm, "");
ok("no fetch, XHR, WebSocket or beacon", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(codeOnly));
ok("no URL in the engine", !/https?:\/\//.test(core));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));
ok("the engine says the transport is not built", /TRANSPORT IS NOT BUILT/.test(core));
ok("no tags, folders or second store", !/\b(tags|labels|folders)\s*[:=]/i.test(core));

section("storage");
var bad = S.parseState("{ broken group");
eq("a broken group is reported", bad.ok, false);
eq("it is marked unreadable", bad.unreadable, true);
ok("it was not replaced with an empty one", /NOT replaced with an empty one/.test(bad.reason), bad.reason);
ok("and says why an empty group is worse", /everyone went quiet/.test(bad.reason), bad.reason);
eq("nothing saved yet is distinguished", S.parseState("").empty, true);
var round = S.parseState(S.serialize(s2.mine));
eq("a group round-trips", round.group.messages.length, 2);
eq("with its bulletin", S.parseState(S.serialize(pinned.group)).group.bulletin.text, "meet at gate 2 at 6");
var thrown = S.exportFile("group", { group: s2.mine }, { when: "26/11/2026" }, function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; });
eq("a failed write is reported", thrown.ok, false);

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (x) { ok("script src resolves: " + x, fs.existsSync(path.join(ROOT, "docs", "play", x.replace(/^\.\//, "")))); });
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));
ok("the web manifest exists", fs.existsSync(path.join(ROOT, "docs", "play", "manifest.webmanifest")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("self-tests: " + passed + "/" + total + " assertions passed");
