/* app — the Semaphore page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Wiring only: the catch-up, the bulletin and the low-power rule live in semaphore-core.js.
 * The LAN transport is NOT built; the page keeps two copies and syncs them. */
(function () {
  "use strict";
  var S = window.SemaphoreCore;
  var $ = function (id) { return document.getElementById(id); };
  var K = "semaphore:group";
  var state = { group: null, other: null, unreadable: null };

  var els = {
    status: $("status"), gName: $("gName"), gHost: $("gHost"), openBtn: $("openBtn"),
    bulletin: $("bulletin"), bText: $("bText"), bBy: $("bBy"), pinBtn: $("pinBtn"),
    mFrom: $("mFrom"), mText: $("mText"), mAttach: $("mAttach"), postBtn: $("postBtn"),
    lpBtn: $("lpBtn"), lpSays: $("lpSays"), msgList: $("msgList"),
    syncBtn: $("syncBtn"), syncSays: $("syncSays"), otherList: $("otherList"),
    exportBtn: $("exportBtn"), ioNote: $("ioNote")
  };

  function today() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function setStatus(k, m) { els.status.className = "status show " + k; els.status.textContent = m; }
  function node(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  function persist() {
    if (!state.group) return true;
    try { window.localStorage.setItem(K, S.serialize(state.group)); return true; }
    catch (e) { setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") + ". The group on screen is unchanged."); return false; }
  }

  function renderList(el, group) {
    el.textContent = "";
    if (!group || !group.messages.length) { el.appendChild(node("li", null, "Nothing said yet.")); return; }
    group.messages.forEach(function (m) {
      var li = node("li", m.pinned ? "pinned" : "");
      li.appendChild(node("div", null, m.text));
      li.appendChild(node("span", "meta", "#" + m.seq + " \u00b7 " + m.from + " \u00b7 " + m.clock + (m.attachment ? " \u00b7 " + m.attachment : "")));
      el.appendChild(li);
    });
  }

  function render() {
    var g = state.group;
    els.bulletin.textContent = g && g.bulletin ? "\uD83D\uDCCC " + g.bulletin.text + "  (pinned by " + g.bulletin.by + " at " + g.bulletin.clock + ")" : "No bulletin pinned.";
    els.lpSays.textContent = g ? (g.lowPower ? "Low-power mode is on: words only." : "Low-power mode is off.") : "";
    els.lpBtn.textContent = g && g.lowPower ? "Turn low-power mode off" : "Turn low-power mode on";
    renderList(els.msgList, g);
    renderList(els.otherList, state.other);
  }

  function open() {
    var out = S.newGroup({ name: els.gName.value, host: els.gHost.value }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.group = out.group;
    state.other = S.newGroup({ name: els.gName.value, host: els.gHost.value }, Date.now()).group;
    state.other.id = state.group.id;
    var saved = persist();
    render();
    if (saved) setStatus("ok", out.says);
  }

  function post() {
    if (!state.group) { setStatus("bad", "Open a group first."); return; }
    var out = S.post(state.group, { from: els.mFrom.value, text: els.mText.value, attachment: els.mAttach.value }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.group = out.group;
    var saved = persist();
    els.mText.value = ""; els.mAttach.value = "";
    render();
    if (saved) setStatus("ok", out.says);
  }

  function pin() {
    if (!state.group) { setStatus("bad", "Open a group first."); return; }
    var out = S.pin(state.group, { by: els.bBy.value, text: els.bText.value }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.group = out.group;
    var saved = persist();
    els.bText.value = "";
    render();
    if (saved) setStatus("ok", out.says);
  }

  function lowPower() {
    if (!state.group) { setStatus("bad", "Open a group first."); return; }
    var out = S.setLowPower(state.group, !state.group.lowPower);
    state.group = out.group;
    var saved = persist();
    render();
    if (saved) setStatus("ok", out.says);
  }

  function sync() {
    if (!state.group || !state.other) { setStatus("bad", "Open a group first."); return; }
    var out = S.sync(state.group, state.other);
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.group = out.mine;
    state.other = out.theirs;
    var saved = persist();
    render();
    els.syncSays.textContent = out.says;
    if (saved) setStatus("ok", out.says);
  }

  function doExport() {
    if (!state.group) { setStatus("bad", "There is no group to export."); return; }
    var out = S.exportFile("group", { group: state.group }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime); return true;
    });
    if (out.ok) { els.ioNote.textContent = "Wrote " + out.filename + "."; setStatus("ok", "Exported."); }
    else setStatus("bad", out.reason + ".");
  }

  els.openBtn.addEventListener("click", open);
  els.postBtn.addEventListener("click", post);
  els.pinBtn.addEventListener("click", pin);
  els.lpBtn.addEventListener("click", lowPower);
  els.syncBtn.addEventListener("click", sync);
  els.exportBtn.addEventListener("click", doExport);

  var raw = null;
  try { raw = window.localStorage.getItem(K); } catch (e) { raw = null; }
  if (raw) {
    var parsed = S.parseState(raw);
    if (parsed.ok) {
      state.group = parsed.group;
      state.other = S.parseState(raw).group;
      state.other.messages = [];
      state.other.seq = 0;
    } else {
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable group");
      keep.addEventListener("click", function () {
        var out = S.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime); return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.ioNote.parentNode.insertBefore(keep, els.ioNote);
    }
  }

  render();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
