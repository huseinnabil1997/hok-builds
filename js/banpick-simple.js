(function () {
  "use strict";
  var D = window.BANPICK_DATA;
  if (!D) return;
  var H = D.heroes, SEL = D.selectable;
  var NAME = { "flowborn-generic": "Flowborn (varian apa pun)" }; SEL.forEach(function (s) { NAME[s.slug] = s.name; });
  var state = { ban: [], ally: [], enemy: [] };
  var LABEL = { ban: "di-ban", ally: "tim kita", enemy: "musuh" };
  var ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
  var roleOn = {}; ROLES.forEach(function (r) { roleOn[r] = true; });
  var LANES = ["Farm Lane", "Mid Lane", "Jungle", "Roam", "Clash Lane"];
  var laneOn = {}; LANES.forEach(function (l) { laneOn[l] = true; });
  var TOP = 10;

  function isFlow(s) { return s === "flowborn" || (s.indexOf("flowborn-") === 0 && s !== "flowborn-generic"); }
  function same(listSlug, slug) { return listSlug === slug || (listSlug === "flowborn-generic" && isFlow(slug)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nm(s) { return NAME[s] || (H[s] && H[s].name) || s; }

  // Ada hubungan atau tidak. Angka index (v) tidak dipakai.
  function counterHit(a, b) {
    var ha = H[a], hb = H[b], hit = false;
    if (ha) ha.counters.forEach(function (x) { if (same(x.slug, b)) hit = true; });
    if (hb) hb.countered_by.forEach(function (x) { if (same(x.slug, a)) hit = true; });
    return hit;
  }
  function duoHit(a, b) {
    var ha = H[a], hb = H[b], hit = false;
    if (ha) ha.duo.forEach(function (x) { if (same(x.slug, b)) hit = true; });
    if (hb) hb.duo.forEach(function (x) { if (same(x.slug, a)) hit = true; });
    return hit;
  }
  function trioParts(k, team) {
    var seen = {};
    [k].concat(team).forEach(function (src) {
      var h = H[src]; if (!h) return;
      h.trio.forEach(function (t) {
        var ki = -1;
        for (var i = 0; i < 3; i++) if (same(t.h[i], k)) { ki = i; break; }
        if (ki < 0) return;
        var others = t.h.filter(function (_, i) { return i !== ki; });
        var hit = others.filter(function (o) { return team.some(function (m) { return same(o, m); }); });
        if (!hit.length) return;
        var key = others.slice().sort().join("+");
        var full = hit.length >= 2;
        if (!seen[key] || (full && !seen[key].full)) seen[key] = { full: full, members: others };
      });
    });
    return Object.keys(seen).map(function (key) { return seen[key]; });
  }

  function scorePick(k) {
    var parts = [], total = 0;
    state.enemy.forEach(function (e) {
      if (counterHit(k, e)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(e) }); }
      if (counterHit(e, k)) { total -= 1; parts.push({ cls: "minus", t: "Di-counter " + nm(e) }); }
    });
    state.ally.forEach(function (a) {
      if (duoHit(k, a)) { total += 1; parts.push({ cls: "plus", t: "Duo dengan " + nm(a) }); }
    });
    trioParts(k, state.ally).forEach(function (t) {
      total += 1;
      parts.push({ cls: "plus", t: "Trio dengan " + t.members.map(nm).join(" + ") + (t.full ? "" : " (baru 1 rekan)") });
    });
    return { total: total, parts: parts };
  }
  function scoreBan(k) {
    var parts = [], total = 0;
    state.ally.forEach(function (a) {
      if (counterHit(k, a)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(a) + " (tim kita)" }); }
    });
    state.enemy.forEach(function (e) {
      if (duoHit(k, e)) { total += 1; parts.push({ cls: "plus", t: "Duo dengan " + nm(e) + " (musuh)" }); }
    });
    trioParts(k, state.enemy).forEach(function (t) {
      total += 1;
      parts.push({ cls: "plus", t: "Trio dengan " + t.members.map(nm).join(" + ") + " (musuh)" + (t.full ? "" : " (baru 1 rekan)") });
    });
    return { total: total, parts: parts };
  }

  function taken() { return state.ban.concat(state.ally, state.enemy); }

  function card(k, sc, rank) {
    var h = H[k];
    var parts = sc.parts.map(function (p) { return '<li class="' + p.cls + '"><span>' + esc(p.t) + "</span></li>"; }).join("");
    var foot = h.page ? '<a class="bp-link" href="heroes/' + k + '.html">Lihat halaman build &rarr;</a>'
      : (h.nobuild === "clash" ? '<div class="bp-clash">Lane utama Clash, build lengkap tidak dibuat</div>' : '<div class="bp-pending">Build belum tersedia</div>');
    var title = h.page ? '<a href="heroes/' + k + '.html">' + esc(h.name) + "</a>" : esc(h.name);
    var label = sc.total + " hubungan";
    return '<article class="bp-card"><div class="bp-head"><span class="bp-rank">' + rank + '</span><div class="bp-title"><h3>' + title + '</h3><span class="bp-role">' + esc(h.role) + " | " + esc(h.lane) + "</span>" + (h.clash ? '<span class="badge clash">Clash</span>' : "") + '</div><span class="bp-score">' + label + '</span></div><ul class="bp-why">' + parts + "</ul>" + foot + "</article>";
  }

  function render() {
    var t = taken();
    var cands = Object.keys(H).filter(function (k) { return t.indexOf(k) < 0; });
    var pickEl = document.getElementById("out-pick"), banEl = document.getElementById("out-ban");
    if (!state.enemy.length && !state.ally.length) {
      pickEl.innerHTML = banEl.innerHTML = '<p class="bp-empty">Pilih hero tim kita dan/atau hero musuh untuk melihat rekomendasi.</p>';
      return;
    }
    function roleOk(k) {
      var parts = String(H[k].role || "").split("/");
      return parts.some(function (p) { return roleOn[p.trim()]; });
    }
    function laneOk(k) {
      var parts = String(H[k].lane || "").split("/");
      return parts.some(function (p) { return laneOn[p.trim()]; });
    }
    function list(fn, el, emptyMsg, opts) {
      var rows = cands.map(function (k) { return { k: k, s: fn(k) }; }).filter(function (r) { return r.s.total > 0; });
      if (opts.clash) rows = rows.filter(function (r) { return !H[r.k].clash; });
      if (opts.role) rows = rows.filter(function (r) { return roleOk(r.k); });
      if (opts.lane) rows = rows.filter(function (r) { return laneOk(r.k); });
      rows.sort(function (a, b) { return b.s.total - a.s.total || nm(a.k).localeCompare(nm(b.k)); });
      el.innerHTML = rows.length ? rows.slice(0, TOP).map(function (r, i) { return card(r.k, r.s, i + 1); }).join("") : '<p class="bp-empty">' + emptyMsg + "</p>";
    }
    var hideClash = document.getElementById("hide-clash"); var hc = hideClash ? hideClash.checked : true;
    var anyRole = ROLES.some(function (r) { return roleOn[r]; });
    var anyLane = LANES.some(function (l) { return laneOn[l]; });
    if (!anyRole) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu role.</p>';
    else if (!anyLane) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu lane.</p>';
    else list(scorePick, pickEl, "Belum ada hero role dan lane ini yang cocok untuk pilihan ini.", { clash: hc, role: true, lane: true });
    list(scoreBan, banEl, "Belum ada data counter / sinergi yang cocok untuk pilihan ini.", {});
  }

  function setMsg(m) { var el = document.getElementById("bp-msg"); el.textContent = m || ""; }
  function renderChips(key) {
    var box = document.getElementById("chips-" + key);
    box.innerHTML = state[key].map(function (s) { return '<span class="chip chip-' + key + '">' + esc(nm(s)) + '<button type="button" data-k="' + key + '" data-s="' + s + '" aria-label="Hapus ' + esc(nm(s)) + '">&times;</button></span>'; }).join("");
  }
  function add(key, slug) {
    for (var k in state) if (state[k].indexOf(slug) >= 0) { setMsg(nm(slug) + " sudah ada di daftar " + LABEL[k] + "."); return false; }
    state[key].push(slug); setMsg(""); renderChips(key); render(); return true;
  }
  function remove(key, slug) { state[key] = state[key].filter(function (s) { return s !== slug; }); renderChips(key); render(); }

  ["ban", "ally", "enemy"].forEach(function (key) {
    var input = document.getElementById("in-" + key), ac = document.getElementById("ac-" + key), active = -1, opts = [], skipFocus = false;
    function close() { ac.classList.add("hidden"); active = -1; }
    function show() {
      var q = input.value.trim().toLowerCase(), t = taken();
      opts = SEL.filter(function (s) { return t.indexOf(s.slug) < 0 && (!q || s.name.toLowerCase().indexOf(q) >= 0 || s.slug.indexOf(q) >= 0); }).sort(function (a, b) { function r(s) { var n = s.name.toLowerCase(); return !q ? 0 : n === q ? 0 : n.indexOf(q) === 0 ? 1 : 2; } return r(a) - r(b); }).slice(0, 12);
      if (!opts.length) { ac.innerHTML = '<li class="ac-none">Tidak ada hero yang cocok</li>'; ac.classList.remove("hidden"); return; }
      ac.innerHTML = opts.map(function (s, i) { return '<li data-i="' + i + '"' + (i === active ? ' class="on"' : "") + ">" + esc(s.name) + (s.data ? "" : ' <small>(tanpa data sendiri)</small>') + "</li>"; }).join("");
      ac.classList.remove("hidden");
    }
    function choose(i) { if (opts[i] && add(key, opts[i].slug)) { input.value = ""; } skipFocus = true; close(); input.focus(); }
    input.addEventListener("input", function () { active = -1; show(); });
    input.addEventListener("focus", function () { if (skipFocus) { skipFocus = false; return; } show(); });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { active = Math.min(active + 1, opts.length - 1); show(); ev.preventDefault(); }
      else if (ev.key === "ArrowUp") { active = Math.max(active - 1, 0); show(); ev.preventDefault(); }
      else if (ev.key === "Enter") { choose(active >= 0 ? active : 0); ev.preventDefault(); }
      else if (ev.key === "Escape") close();
      else if (ev.key === "Backspace" && !input.value && state[key].length) remove(key, state[key][state[key].length - 1]);
    });
    ac.addEventListener("mousedown", function (ev) { var li = ev.target.closest("li[data-i]"); if (li) { ev.preventDefault(); choose(+li.dataset.i); } });
  });
  document.addEventListener("click", function (ev) { var b = ev.target.closest(".chip button"); if (b) remove(b.dataset.k, b.dataset.s); });
  document.getElementById("bp-reset").addEventListener("click", function () { state = { ban: [], ally: [], enemy: [] }; ["ban", "ally", "enemy"].forEach(renderChips); setMsg(""); render(); });
  var hcEl = document.getElementById("hide-clash"); if (hcEl) hcEl.addEventListener("change", render);
  function bindChips(boxId, attr, stateMap) {
    var box = document.getElementById(boxId);
    if (!box) return;
    box.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".role-chip"); if (!btn) return;
      var key = btn.getAttribute(attr);
      stateMap[key] = !stateMap[key];
      btn.classList.toggle("on", stateMap[key]);
      btn.setAttribute("aria-pressed", stateMap[key] ? "true" : "false");
      render();
    });
  }
  bindChips("role-filter", "data-role", roleOn);
  bindChips("lane-filter", "data-lane", laneOn);
  render();
})();
