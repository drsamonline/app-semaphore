#!/usr/bin/env node
/* ui-tests — the Semaphore page in a real DOM (jsdom). SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin */
"use strict";
var fs = require("fs"), path = require("path"), { JSDOM } = require("jsdom");
var ROOT = path.join(__dirname, ".."), PLAY = path.join(ROOT, "docs", "play");
var passed = 0, failed = [];
function ok(n, c, d) { if (c) { passed++; return; } failed.push(n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function build(seed) {
  var dom = new JSDOM(fs.readFileSync(path.join(PLAY, "index.html"), "utf8"), { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; }; w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "semaphore-core.js", "app.js"].forEach(function (f) { w.eval(fs.readFileSync(path.join(PLAY, f), "utf8")); });
  return dom;
}
var dom = build(null), w = dom.window, d = w.document, $ = function (id) { return d.getElementById(id); };
ok("the engine loaded", !!w.SemaphoreCore);
ok("the transport gap is on the page", /The LAN transport is not built/.test(d.body.textContent));

$("openBtn").click();
ok("a group opens", /opened, hosted by Sohil/.test($("status").textContent), $("status").textContent);

$("mFrom").value = "Sohil"; $("mText").value = "at the gate"; $("postBtn").click();
ok("a message is sent", /Sohil: at the gate/.test($("status").textContent), $("status").textContent);
eq("one message on the list", d.querySelectorAll("#msgList li").length, 1);
eq("the other device has none yet", d.querySelectorAll("#otherList li").length, 1);

$("syncBtn").click();
ok("a sync runs", /Synced/.test($("syncSays").textContent), $("syncSays").textContent);
ok("the other device caught up", /at the gate/.test($("otherList").textContent), $("otherList").textContent);

$("bBy").value = "Aaji"; $("bText").value = "gate 3"; $("pinBtn").click();
ok("a non-host cannot pin", /belongs to the host/.test($("status").textContent), $("status").textContent);
$("bBy").value = "Sohil"; $("bText").value = "meet at gate 2"; $("pinBtn").click();
ok("the host pins", /Pinned: meet at gate 2/.test($("status").textContent), $("status").textContent);
ok("and the bulletin shows", /meet at gate 2/.test($("bulletin").textContent), $("bulletin").textContent);
ok("and appears in the messages", /pinned/.test(d.querySelector("#msgList li").className) || /meet at gate 2/.test($("msgList").textContent));

$("lpBtn").click();
ok("low-power mode turns on", /words only/.test($("lpSays").textContent), $("lpSays").textContent);
$("mFrom").value = "Aaji"; $("mText").value = ""; $("mAttach").value = "photo.jpg"; $("postBtn").click();
ok("an attachment is refused in low-power mode", /low-power mode is on/.test($("status").textContent), $("status").textContent);

$("exportBtn").click();
ok("the group exports", /Wrote semaphore-\d{4}-\d\d-\d\d\.json/.test($("ioNote").textContent), $("ioNote").textContent);
var saved = w.localStorage.getItem("semaphore:group");
var dom2 = build({ "semaphore:group": saved });
var d2 = dom2.window.document;
ok("the reload keeps the messages", d2.querySelectorAll("#msgList li").length >= 2);
ok("and the bulletin", /meet at gate 2/.test(d2.getElementById("bulletin").textContent));

var dom3 = build({ "semaphore:group": "{ broken group" });
var d3 = dom3.window.document;
ok("a broken group is reported", /cannot be read/.test(d3.getElementById("status").textContent));
ok("and not replaced with an empty one", /NOT replaced with an empty one/.test(d3.getElementById("status").textContent));

var dom4 = build(null), w4 = dom4.window, d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", { configurable: true, get: function () {
  return { getItem: function () { return null; }, setItem: function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; }, removeItem: function () {}, clear: function () {} }; } });
d4.getElementById("openBtn").click();
ok("a failed save says NOT SAVED", /NOT SAVED:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
