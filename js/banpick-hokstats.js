(function () {
  "use strict";

  // Ban & Pick versi hokstats.gg (data/hokstats-banpick.js, dibuat scripts/build-hokstats.mjs).
  // hokstats cuma punya daftar ya/tidak tanpa angka: counter ("Strong against" / "Countered by") dan "Partners" (duo).
  // Tidak ada trio.
  // Counter(A -> B) = B ada di "Strong against" A, atau A ada di "Countered by" B. Dihitung sekali per pasangan.
  function counterHit(H, a, b) {
    var ha = H[a], hb = H[b];
    return !!((ha && ha.strong.indexOf(b) >= 0) || (hb && hb.weak.indexOf(a) >= 0));
  }
  // Partner(A, B) = B ada di "Partners" A atau A ada di "Partners" B. Dihitung sekali per pasangan.
  function partnerHit(H, a, b) {
    var ha = H[a], hb = H[b];
    return !!((ha && (ha.partners || []).indexOf(b) >= 0) || (hb && (hb.partners || []).indexOf(a) >= 0));
  }
  // Skor pick K: +1 tiap musuh yang di-counter K, -1 tiap musuh yang nge-counter K, +1 tiap partner K di tim kita.
  // Skor ban K: +1 tiap hero tim kita yang di-counter K, +1 tiap partner K di tim musuh.
  // Total tim: +1 tiap pasangan (hero tim -> hero lawan) yang di-counter, +1 tiap pasangan partner di dalam tim.
  // Di-counter lawan masuk ke total lawan.
  function pickScore(H, k, ally, enemy, nm) {
    var parts = [], total = 0;
    enemy.forEach(function (e) {
      if (counterHit(H, k, e)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(e), v: 1 }); }
      if (counterHit(H, e, k)) { total -= 1; parts.push({ cls: "minus", t: "Di-counter " + nm(e), v: -1 }); }
    });
    ally.forEach(function (a) { if (partnerHit(H, k, a)) { total += 1; parts.push({ cls: "plus", t: "Partner " + nm(a), v: 1 }); } });
    return { total: total, parts: parts };
  }
  function banScore(H, k, ally, enemy, nm) {
    var parts = [], total = 0;
    ally.forEach(function (a) { if (counterHit(H, k, a)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(a) + " (tim kita)", v: 1 }); } });
    enemy.forEach(function (e) { if (partnerHit(H, k, e)) { total += 1; parts.push({ cls: "plus", t: "Partner " + nm(e) + " (musuh)", v: 1 }); } });
    return { total: total, parts: parts };
  }
  function teamScore(H, team, opp, nm) {
    var parts = [], total = 0;
    team.forEach(function (a) { opp.forEach(function (e) { if (counterHit(H, a, e)) { total += 1; parts.push({ t: nm(a) + " counter " + nm(e), v: 1 }); } }); });
    for (var i = 0; i < team.length; i++) for (var j = i + 1; j < team.length; j++) {
      if (partnerHit(H, team[i], team[j])) { total += 1; parts.push({ t: "Partner " + nm(team[i]) + " + " + nm(team[j]), v: 1 }); }
    }
    return { total: total, parts: parts };
  }
  // Urutan: skor dulu, lalu win rate (pick) / ban rate (ban) resmi HOK Camp, lalu nama.
  function rank(rows, H, key, nm) {
    return rows.sort(function (a, b) { return b.s.total - a.s.total || (H[b.k][key] || 0) - (H[a.k][key] || 0) || nm(a.k).localeCompare(nm(b.k)); });
  }
  if (typeof window !== "undefined") window.__hokstats = { counterHit: counterHit, partnerHit: partnerHit, pickScore: pickScore, banScore: banScore, teamScore: teamScore, rank: rank };

  var D = window.HOKSTATS;
  if (!D) return;
  var H = D.heroes;
  // speech.js mengambil daftar nama dari window.BANPICK_DATA.heroes; halaman ini tidak memuat data/banpick.js.
  if (!window.BANPICK_DATA) window.BANPICK_DATA = { heroes: H };
  var SEL = Object.keys(H).map(function (k) { return { slug: k, name: H[k].name }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  var state = { ban: [], ally: [], enemy: [] };
  var LABEL = { ban: "di-ban", ally: "tim kita", enemy: "musuh" };
  var ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
  var roleOn = {}; ROLES.forEach(function (r) { roleOn[r] = true; });
  var LANES = ["Farm Lane", "Mid Lane", "Jungle", "Roam", "Clash Lane"];
  var laneOn = {}; LANES.forEach(function (l) { laneOn[l] = true; });
  var TOP = 10;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 }); }
  function nm(s) { return (H[s] && H[s].name) || s; }
  function rate(v) { return v == null ? "-" : fmt(v) + "%"; }
  // Ikon hero (data/hero-icons.js). Kalau tidak ada / gagal dimuat, tampil inisial.
  var ICONS = window.HERO_ICONS || {};
  function initials(name) {
    var w = String(name).replace(/\(.*\)/, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : String(name).slice(0, 2)).toUpperCase();
  }
  function icon(s) {
    var img = ICONS[s] ? '<img src="' + esc(ICONS[s]) + '" alt="" loading="lazy" onerror="this.remove()"/>' : "";
    return '<span class="hero-ico" aria-hidden="true">' + esc(initials(nm(s))) + img + "</span>";
  }

  function taken() { return state.ban.concat(state.ally, state.enemy); }

  function card(k, sc, rk) {
    var h = H[k];
    var parts = sc.parts.map(function (p) { return '<li class="' + p.cls + '"><span>' + esc(p.t) + '</span><b>' + (p.v > 0 ? "+" : "") + p.v + "</b></li>"; }).join("");
    var stats = '<li class="bp-stat"><span>WR ' + rate(h.wr) + " | PR " + rate(h.pr) + " | BR " + rate(h.br) + (h.tier ? " | Tier " + esc(h.tier) : "") + "</span></li>";
    var foot = h.page ? '<a class="bp-link" href="heroes/' + k + '.html">Lihat halaman build &rarr;</a>' : '<div class="bp-pending">Build belum tersedia</div>';
    var title = h.page ? '<a href="heroes/' + k + '.html">' + esc(h.name) + "</a>" : esc(h.name);
    return '<article class="bp-card"><div class="bp-head"><span class="bp-rank">' + rk + '</span><div class="bp-title"><h3>' + icon(k) + title + '</h3><span class="bp-role">' + esc(h.role) + " | " + esc(h.lane) + '</span></div><span class="bp-score">' + (sc.total > 0 ? "+" : "") + sc.total + '</span></div><ul class="bp-why">' + parts + stats + "</ul>" + foot + "</article>";
  }

  function renderTotals() {
    [["ally", state.ally, state.enemy], ["enemy", state.enemy, state.ally]].forEach(function (x) {
      var el = document.getElementById("total-" + x[0]); if (!el) return;
      var sc = teamScore(H, x[1], x[2], nm);
      el.textContent = sc.total + " poin";
      el.title = sc.parts.length ? sc.parts.map(function (p) { return p.t + ": +1"; }).join("\n") : "Belum ada poin";
    });
  }

  function render() {
    renderTotals();
    var t = taken();
    var cands = Object.keys(H).filter(function (k) { return t.indexOf(k) < 0; });
    var pickEl = document.getElementById("out-pick"), banEl = document.getElementById("out-ban");
    if (!state.enemy.length && !state.ally.length) {
      pickEl.innerHTML = banEl.innerHTML = '<p class="bp-empty">Pilih hero tim kita dan/atau hero musuh untuk melihat rekomendasi.</p>';
      return;
    }
    // Role/lane kosong (belum ada data) tidak disaring: tetap ikut rekomendasi.
    function roleOk(k) {
      if (!String(H[k].role || "").trim()) return true;
      return String(H[k].role).split("/").some(function (p) { return roleOn[p.trim()]; });
    }
    function laneOk(k) {
      if (!String(H[k].lane || "").trim()) return true;
      return String(H[k].lane).split("/").some(function (p) { return laneOn[p.trim()]; });
    }
    function list(fn, el, emptyMsg, key, filter) {
      var rows = cands.map(function (k) { return { k: k, s: fn(k) }; }).filter(function (r) { return r.s.total > 0; });
      if (filter) rows = rows.filter(function (r) { return roleOk(r.k) && laneOk(r.k); });
      rank(rows, H, key, nm);
      el.innerHTML = rows.length ? rows.slice(0, TOP).map(function (r, i) { return card(r.k, r.s, i + 1); }).join("") : '<p class="bp-empty">' + emptyMsg + "</p>";
    }
    var anyRole = ROLES.some(function (r) { return roleOn[r]; });
    var anyLane = LANES.some(function (l) { return laneOn[l]; });
    if (!anyRole) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu role.</p>';
    else if (!anyLane) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu lane.</p>';
    else list(function (k) { return pickScore(H, k, state.ally, state.enemy, nm); }, pickEl, "Belum ada hero role dan lane ini dengan counter / partner yang cocok (data hokstats).", "wr", true);
    list(function (k) { return banScore(H, k, state.ally, state.enemy, nm); }, banEl, "Belum ada hero yang meng-counter tim kita atau jadi partner musuh (data hokstats).", "br", false);
  }

  function setMsg(m) { var el = document.getElementById("bp-msg"); el.textContent = m || ""; }
  function renderChips(key) {
    var box = document.getElementById("chips-" + key);
    box.innerHTML = state[key].map(function (s) { return '<span class="chip chip-' + key + '">' + (key === "ban" ? icon(s) : "") + esc(nm(s)) + '<button type="button" data-k="' + key + '" data-s="' + s + '" aria-label="Hapus ' + esc(nm(s)) + '">&times;</button></span>'; }).join("");
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
      ac.innerHTML = opts.map(function (s, i) { return '<li data-i="' + i + '"' + (i === active ? ' class="on"' : "") + ">" + esc(s.name) + "</li>"; }).join("");
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
  var metaEl = document.getElementById("hs-meta"), M = D.meta || {};
  if (metaEl && M.diambil) metaEl.insertAdjacentHTML("beforeend", " Diambil " + esc(String(M.diambil).slice(0, 10)) + "; " + esc(M.popularitas_sumber || "") + "; " + (M.hero || 0) + " hero, " + (M.relasi_counter || 0) + " relasi counter, " + (M.pasangan_partner || 0) + " pasangan partner.");
  render();
})();