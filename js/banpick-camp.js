(function () {
  "use strict";

  // Skor duo/trio (aturan 2): trio lengkap dihitung penuh dan menutup pasangannya; pasangan K-X yang belum tertutup
  // dihitung sekali = max(duo asli, trio{K,X,Z} x 0,5). Seri dimenangkan duo asli. Tidak ada pasangan dihitung dua kali.
  // trios: semua trio yang memuat k, bentuk { v, others: [a, b] }.
  function comboScore(k, team, duoFn, trios, same, nm, sfx) {
    var parts = [], total = 0, covered = {};
    function member(o) { for (var i = 0; i < team.length; i++) if (same(o, team[i])) return team[i]; return null; }
    trios.forEach(function (t) {
      var a = member(t.others[0]), b = member(t.others[1]);
      if (!a || !b || a === b) return;
      total += t.v; covered[a] = covered[b] = true;
      parts.push({ cls: "plus", t: "Trio dengan " + nm(a) + " dan " + nm(b) + sfx, v: t.v });
    });
    team.forEach(function (m) {
      if (covered[m]) return;
      var d = duoFn(k, m) || 0, h = 0, z = null;
      trios.forEach(function (t) {
        for (var i = 0; i < 2; i++) if (same(t.others[i], m) && t.v * 0.5 > h) { h = t.v * 0.5; z = t.others[1 - i]; }
      });
      if (d > 0 && d >= h) { total += d; parts.push({ cls: "plus", t: "Duo dengan " + nm(m) + sfx, v: d }); }
      else if (h > 0) { total += h; parts.push({ cls: "plus", t: "Bagian dari trio " + nm(k) + "-" + nm(m) + "-" + nm(z) + " (x0,5)" + sfx, v: h }); }
    });
    return { total: total, parts: parts };
  }
  if (typeof window !== "undefined") window.__comboScore = comboScore;
  var D = window.BANPICK_DATA;
  if (!D) return;
  var H = D.heroes, SEL = D.selectable;
  // Lane ganda: hero tetap lolos filter kalau salah satu lane-nya nyala.
  // Chicha main Clash dan Farm; data sumber cuma menulis Clash Lane.
  (function () {
    var h = H.chicha;
    if (!h) return;
    var parts = String(h.lane || "").split("/").map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.indexOf("Farm Lane") < 0) parts.unshift("Farm Lane");
    h.lane = parts.join("/");
    h.clash = parts.length === 1 && parts[0] === "Clash Lane";
  })();
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
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 }); }
  function nm(s) { return NAME[s] || (H[s] && H[s].name) || s; }
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

  // Data murni HoK Camp (data/hokcamp-combos.js): Compatibility %, tanpa normalisasi, tanpa counter.
  var C = window.HOKCAMP_COMBOS || { duo: [], trio: [] };
  function pct(n) { return fmt(n) + "%"; }
  function campDuo(a, b) {
    var best = 0;
    C.duo.forEach(function (x) { if (((same(x.h[0], a) && same(x.h[1], b)) || (same(x.h[1], a) && same(x.h[0], b))) && x.v > best) best = x.v; });
    return best;
  }
  // Semua trio HoK Camp yang memuat k (dedup per pasangan, nilai terbesar).
  function campTrios(k) {
    var best = {};
    C.trio.forEach(function (t) {
      var ki = -1;
      for (var i = 0; i < 3; i++) if (same(t.h[i], k)) { ki = i; break; }
      if (ki < 0) return;
      var others = t.h.filter(function (_, i) { return i !== ki; }), key = others.slice().sort().join("+");
      if (!best[key] || t.v > best[key].v) best[key] = { v: t.v, others: others };
    });
    return Object.keys(best).map(function (key) { return best[key]; });
  }
  function score(k, team, suffix) { return comboScore(k, team, campDuo, campTrios(k), same, nm, suffix); }
  function scorePick(k) { return score(k, state.ally, ""); }
  function scoreBan(k) { return score(k, state.enemy, " (musuh)"); }

  function taken() { return state.ban.concat(state.ally, state.enemy); }

  function card(k, sc, rank) {
    var h = H[k];
    var parts = sc.parts.map(function (p) { return '<li class="' + p.cls + '"><span>' + esc(p.t) + '</span><b>+' + pct(p.v) + "</b></li>"; }).join("");
    var foot = h.page ? '<a class="bp-link" href="heroes/' + k + '.html">Lihat halaman build &rarr;</a>'
      : (h.nobuild === "clash" ? '<div class="bp-clash">Lane utama Clash, build lengkap tidak dibuat</div>' : '<div class="bp-pending">Build belum tersedia</div>');
    var title = h.page ? '<a href="heroes/' + k + '.html">' + esc(h.name) + "</a>" : esc(h.name);
    return '<article class="bp-card"><div class="bp-head"><span class="bp-rank">' + rank + '</span><div class="bp-title"><h3>' + icon(k) + title + '</h3><span class="bp-role">' + esc(h.role) + " | " + esc(h.lane) + "</span>" + (h.clash ? '<span class="badge clash">Clash</span>' : "") + '</div><span class="bp-score">' + pct(sc.total) + '</span></div><ul class="bp-why">' + parts + "</ul>" + foot + "</article>";
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
      if (opts.role) rows = rows.filter(function (r) { return roleOk(r.k); });
      if (opts.lane) rows = rows.filter(function (r) { return laneOk(r.k); });
      rows.sort(function (a, b) { return b.s.total - a.s.total || nm(a.k).localeCompare(nm(b.k)); });
      el.innerHTML = rows.length ? rows.slice(0, TOP).map(function (r, i) { return card(r.k, r.s, i + 1); }).join("") : '<p class="bp-empty">' + emptyMsg + "</p>";
    }
    var anyRole = ROLES.some(function (r) { return roleOn[r]; });
    var anyLane = LANES.some(function (l) { return laneOn[l]; });
    if (!anyRole) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu role.</p>';
    else if (!anyLane) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu lane.</p>';
    else list(scorePick, pickEl, "Belum ada duo/trio HoK Camp dengan tim kita untuk role dan lane ini.", { role: true, lane: true });
    list(scoreBan, banEl, "Belum ada duo/trio musuh di data HoK Camp untuk pilihan ini.", {});
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
