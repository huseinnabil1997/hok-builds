(function () {
  "use strict";
  var D = window.BANPICK_DATA;
  if (!D) return;
  var H = D.heroes, SEL = D.selectable;
  var NAME = { "flowborn-generic": "Flowborn (varian apa pun)" }; SEL.forEach(function (s) { NAME[s.slug] = s.name; });
  var state = { ban: [], ally: [], enemy: [] };
  var LABEL = { ban: "di-ban", ally: "tim kita", enemy: "musuh" };
  var TOP = 10;

  function isFlow(s) { return s === "flowborn" || (s.indexOf("flowborn-") === 0 && s !== "flowborn-generic"); }
  function same(listSlug, slug) { return listSlug === slug || (listSlug === "flowborn-generic" && isFlow(slug)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 }); }
  function nm(s) { return NAME[s] || (H[s] && H[s].name) || s; }

  // Counter(a -> b): a counters b
  function counterVal(a, b) {
    var best = 0, ha = H[a], hb = H[b];
    if (ha) ha.counters.forEach(function (x) { if (same(x.slug, b) && x.v > best) best = x.v; });
    if (hb) hb.countered_by.forEach(function (x) { if (same(x.slug, a) && x.v > best) best = x.v; });
    return best;
  }
  function duoVal(a, b) {
    var best = 0, ha = H[a], hb = H[b];
    if (ha) ha.duo.forEach(function (x) { if (same(x.slug, b) && x.v > best) best = x.v; });
    if (hb) hb.duo.forEach(function (x) { if (same(x.slug, a) && x.v > best) best = x.v; });
    return best;
  }
  // trios that contain candidate k, from k's list and from team members' lists (deduped)
  function trioParts(k, team) {
    var best = {};
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
        if (!best[key] || t.v > best[key].raw) best[key] = { raw: t.v, w: hit.length >= 2 ? 1 : 0.5, members: others };
      });
    });
    return Object.keys(best).map(function (key) { var b = best[key]; return { v: b.raw * b.w, raw: b.raw, w: b.w, members: b.members }; });
  }

  function scorePick(k) {
    var parts = [], total = 0;
    state.enemy.forEach(function (e) {
      var c = counterVal(k, e); if (c) { total += c; parts.push({ cls: "plus", t: "Counter " + nm(e), v: c }); }
      var d = counterVal(e, k); if (d) { total -= d; parts.push({ cls: "minus", t: "Di-counter " + nm(e), v: -d }); }
    });
    state.ally.forEach(function (a) { var s = duoVal(k, a); if (s) { total += s; parts.push({ cls: "plus", t: "Duo dengan " + nm(a), v: s }); } });
    trioParts(k, state.ally).forEach(function (t) { total += t.v; parts.push({ cls: "plus", t: "Trio dengan " + t.members.map(nm).join(" + ") + (t.w < 1 ? " (×0,5)" : ""), v: t.v }); });
    return { total: total, parts: parts };
  }
  function scoreBan(k) {
    var parts = [], total = 0;
    state.ally.forEach(function (a) { var c = counterVal(k, a); if (c) { total += c; parts.push({ cls: "plus", t: "Counter " + nm(a) + " (tim kita)", v: c }); } });
    state.enemy.forEach(function (e) { var s = duoVal(k, e); if (s) { total += s; parts.push({ cls: "plus", t: "Duo dengan " + nm(e) + " (musuh)", v: s }); } });
    trioParts(k, state.enemy).forEach(function (t) { total += t.v; parts.push({ cls: "plus", t: "Trio dengan " + t.members.map(nm).join(" + ") + " (musuh)" + (t.w < 1 ? " (×0,5)" : ""), v: t.v }); });
    return { total: total, parts: parts };
  }

  function taken() { return state.ban.concat(state.ally, state.enemy); }

  function card(k, sc, rank) {
    var h = H[k];
    var parts = sc.parts.map(function (p) { return '<li class="' + p.cls + '"><span>' + esc(p.t) + '</span><b>' + (p.v > 0 ? "+" : "") + fmt(p.v) + "</b></li>"; }).join("");
    var build;
    if (h.page && h.build && h.build.items.length) {
      build = '<div class="bp-build"><div class="bp-build-label">Build utama (Kondisi ' + esc(h.build.kondisi) + ": " + esc(h.build.label) + ')</div><div class="bp-items">' +
        h.build.items.map(function (it) { return '<div class="bp-item" title="' + esc(it.name) + '"><img src="assets/items/' + encodeURI(it.file) + '" alt="' + esc(it.name) + '" loading="lazy"/><span>' + esc(it.name) + "</span></div>"; }).join("") + "</div></div>";
    } else {
      build = '<div class="bp-build bp-nobuild">Build belum tersedia</div>';
    }
    var title = h.page ? '<a href="heroes/' + k + '.html">' + esc(h.name) + "</a>" : esc(h.name);
    return '<article class="bp-card"><div class="bp-head"><span class="bp-rank">' + rank + '</span><div class="bp-title"><h3>' + title + '</h3><span class="bp-role">' + esc(h.role) + " | " + esc(h.lane) + '</span></div><span class="bp-score">' + fmt(sc.total) + '</span></div><ul class="bp-why">' + parts + "</ul>" + build + (h.page ? '<a class="bp-link" href="heroes/' + k + '.html">Lihat halaman build &rarr;</a>' : "") + "</article>";
  }

  function render() {
    var t = taken();
    var cands = Object.keys(H).filter(function (k) { return t.indexOf(k) < 0; });
    var pickEl = document.getElementById("out-pick"), banEl = document.getElementById("out-ban");
    if (!state.enemy.length && !state.ally.length) {
      pickEl.innerHTML = banEl.innerHTML = '<p class="bp-empty">Pilih hero tim kita dan/atau hero musuh untuk melihat rekomendasi.</p>';
      return;
    }
    function list(fn, el, emptyMsg) {
      var rows = cands.map(function (k) { return { k: k, s: fn(k) }; }).filter(function (r) { return r.s.total > 0; });
      rows.sort(function (a, b) { return b.s.total - a.s.total || nm(a.k).localeCompare(nm(b.k)); });
      el.innerHTML = rows.length ? rows.slice(0, TOP).map(function (r, i) { return card(r.k, r.s, i + 1); }).join("") : '<p class="bp-empty">' + emptyMsg + "</p>";
    }
    list(scorePick, pickEl, "Belum ada data counter / sinergi yang cocok untuk pilihan ini.");
    list(scoreBan, banEl, "Belum ada data counter / sinergi yang cocok untuk pilihan ini.");
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
    var input = document.getElementById("in-" + key), ac = document.getElementById("ac-" + key), active = -1, opts = [];
    function close() { ac.classList.add("hidden"); active = -1; }
    function show() {
      var q = input.value.trim().toLowerCase(), t = taken();
      opts = SEL.filter(function (s) { return t.indexOf(s.slug) < 0 && (!q || s.name.toLowerCase().indexOf(q) >= 0 || s.slug.indexOf(q) >= 0); }).slice(0, 12);
      if (!opts.length) { ac.innerHTML = '<li class="ac-none">Tidak ada hero yang cocok</li>'; ac.classList.remove("hidden"); return; }
      ac.innerHTML = opts.map(function (s, i) { return '<li data-i="' + i + '"' + (i === active ? ' class="on"' : "") + ">" + esc(s.name) + (s.data ? "" : ' <small>(tanpa data sendiri)</small>') + "</li>"; }).join("");
      ac.classList.remove("hidden");
    }
    function choose(i) { if (opts[i] && add(key, opts[i].slug)) { input.value = ""; } close(); input.focus(); }
    input.addEventListener("input", function () { active = -1; show(); });
    input.addEventListener("focus", show);
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
  render();
})();
