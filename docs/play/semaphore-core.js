/* semaphore-core — the engine behind Semaphore.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: messages and a bulletin for a group on a hotspot, with the internet disconnected.
 *
 * TWO THINGS THIS ENGINE ACTUALLY OWNS, and both are testable:
 *   1. CATCH-UP: a device that was away receives everything it missed after ONE sync with any device that
 *      holds it, in the original order. Every message carries a sequence number, so "everything I missed"
 *      is an interval, not a guess.
 *   2. THE BULLETIN: a pinned note that only the host can edit, and that every member ends up holding.
 *
 * LOW-POWER MODE is a real switch with a real refusal: with it on, an image or a voice note cannot be
 * attached, because those are the attachments that cost battery and bandwidth on a hotspot.
 *
 * THE TRANSPORT IS NOT BUILT: there is no WebSocket, no multicast and no Bluetooth here. The engine takes a
 * sync between two copies of the group, which is the operation a hotspot link would carry.
 *
 * Pure functions: no DOM, no network, no storage.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SemaphoreCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function ddmm(ms) { var d = new Date(ms); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); }

  function newGroup(input, now) {
    var name = clean(input && input.name);
    var host = clean(input && input.host);
    if (!name) return { ok: false, field: "name", reason: "a group with no name is refused" };
    if (!host) return { ok: false, field: "host", reason: "a group needs a host: the bulletin is theirs to edit" };
    var at = now || Date.now();
    return {
      ok: true,
      group: { id: "g" + at, name: name, host: host, seq: 0, messages: [], bulletin: null, lowPower: false },
      says: "\u201c" + name + "\u201d opened, hosted by " + host + "."
    };
  }

  /* A message: sequence number, sender, text, and optionally an attachment. */
  function post(group, input, now) {
    var text = clean(input && input.text);
    var from = clean(input && input.from);
    var attach = clean(input && input.attachment);
    if (!from) return { ok: false, field: "from", reason: "a message needs a sender" };
    if (!text && !attach) return { ok: false, field: "text", reason: "a message with no words and no attachment is refused" };
    /* LOW-POWER MODE: the refusal is the feature. */
    if (attach && group.lowPower) {
      return { ok: false, field: "attachment", lowPower: true, reason: "low-power mode is on, so no image or voice note can be attached. Send the words, or turn low-power mode off." };
    }
    var g = clone(group), at = now || Date.now();
    /* the id is unique to this device and this instant; the sequence is assigned when devices merge, so
     * two devices cannot both claim #1 and lose a message */
    var m = { id: from + "@" + at, seq: (g.seq || 0) + 1, from: from, text: text, attachment: attach || "", at: at, clock: hhmm(at), on: ddmm(at) };
    g.seq = m.seq;
    g.messages.push(m);
    return { ok: true, group: g, message: m, says: from + ": " + (text || attach) + " (#" + m.seq + ")." };
  }

  /* The bulletin is the host's. A non-host is refused, and told whose it is. */
  function pin(group, input, now) {
    var by = clean(input && input.by);
    var text = clean(input && input.text);
    if (by !== group.host) {
      return { ok: false, field: "by", reason: "the bulletin belongs to the host (" + group.host + "). " + (by || "Someone") + " cannot edit it." };
    }
    if (!text) return { ok: false, field: "text", reason: "a bulletin with no words is refused" };
    var g = clone(group), at = now || Date.now();
    g.bulletin = { text: text, by: by, at: at, clock: hhmm(at) };
    g.messages.push({ id: by + "@pin@" + at, seq: (g.seq || 0) + 1, from: by, text: "\uD83D\uDCCC " + text, attachment: "", at: at, clock: hhmm(at), on: ddmm(at), pinned: true });
    g.seq = g.seq + 1;
    return { ok: true, group: g, bulletin: g.bulletin, says: "Pinned: " + text + "." };
  }

  function setLowPower(group, on) {
    var g = clone(group);
    g.lowPower = !!on;
    return { ok: true, group: g, says: "Low-power mode is " + (g.lowPower ? "on: words only." : "off: images and voice notes are allowed.") };
  }

  /* THE CATCH-UP: one sync brings an absent device everything it missed, in order. */
  function sync(mine, theirs) {
    if (!mine || !theirs) return { ok: false, reason: "a sync needs two copies of the group" };
    if (mine.id !== theirs.id) return { ok: false, reason: "those are two different groups" };
    var a = clone(mine), b = clone(theirs);
    /* every message from either side, deduplicated by ID, ordered by time then id, then RENUMBERED — the
     * sequence is a property of the merged group, not of the device that posted */
    var byId = {};
    a.messages.concat(b.messages).forEach(function (m) { if (!byId[m.id]) byId[m.id] = m; });
    var all = Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (x, y) { return (x.at - y.at) || String(x.id).localeCompare(String(y.id)); });
    all.forEach(function (m, i) { m.seq = i + 1; });
    var hadA = a.messages.length, hadB = b.messages.length;
    a.messages = all.map(function (m) { return m; });
    b.messages = all.map(function (m) { return m; });
    a.seq = b.seq = all.length ? all[all.length - 1].seq : 0;
    /* the bulletin is the newest one, and only the host could have set it */
    if (b.bulletin && (!a.bulletin || b.bulletin.at > a.bulletin.at)) a.bulletin = b.bulletin;
    else if (a.bulletin) b.bulletin = a.bulletin;
    a.lowPower = b.lowPower = a.lowPower || b.lowPower;
    return {
      ok: true, mine: a, theirs: b, total: all.length,
      caughtUp: a.messages.length - hadA + (b.messages.length - hadB),
      says: "Synced. " + all.length + " message(s) on both devices, in order. " +
        (a.messages.length - hadA > 0 ? "This device caught up on " + (a.messages.length - hadA) + "." : "This device was already up to date.")
    };
  }

  /* What an absent device is missing, as an interval rather than a guess. */
  function missing(group, sinceSeq) {
    var s = Number(sinceSeq) || 0;
    var rows = (group.messages || []).filter(function (m) { return m.seq > s; });
    return {
      ok: true, rows: rows, count: rows.length,
      says: rows.length ? rows.length + " message(s) since #" + s + ", from #" + rows[0].seq + " to #" + rows[rows.length - 1].seq + "." : "Nothing since #" + s + "."
    };
  }

  function clone(g) {
    var x = g || { messages: [] };
    return {
      id: x.id, name: x.name, host: x.host, seq: x.seq || 0, lowPower: !!x.lowPower,
      bulletin: x.bulletin ? { text: x.bulletin.text, by: x.bulletin.by, at: x.bulletin.at || 0, clock: x.bulletin.clock || "" } : null,
      messages: (x.messages || []).map(function (m) {
        return { id: m.id, seq: m.seq, from: m.from, text: m.text, attachment: m.attachment || "", at: m.at || 0, clock: m.clock || "", on: m.on || "", pinned: !!m.pinned };
      })
    };
  }

  function serialize(group) { return JSON.stringify({ version: VERSION, format: "semaphore-1", group: clone(group) }, null, 2); }
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "no group has been opened on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) { return { ok: false, unreadable: true, reason: "The saved group cannot be read. It was NOT replaced with an empty one \u2014 an empty group looks like everyone went quiet. Export it to keep it.", raw: raw }; }
    if (!data || !data.group || !Array.isArray(data.group.messages)) return { ok: false, unreadable: true, reason: "The saved file holds no group. Nothing was started over it; export it to keep it.", raw: raw };
    return { ok: true, group: clone(data.group), raw: raw };
  }
  function stamp(when) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated"; }
  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "application/json";
    if (what === "group") { name = "semaphore-" + stamp(meta.when) + ".json"; body = serialize(payload.group); }
    else if (what === "raw") { name = "semaphore-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return { version: VERSION, newGroup: newGroup, post: post, pin: pin, setLowPower: setLowPower,
    sync: sync, missing: missing, serialize: serialize, parseState: parseState, exportFile: exportFile };
});
