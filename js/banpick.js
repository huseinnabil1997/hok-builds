(function () {
  "use strict";

  // Ban & Pick (satu-satunya halaman). Data: data/banpick-merged.js (scripts/build-banpick-merged.mjs),
  // gabungan HoK CN (王者营地), HoK Camp, dan hokstats.gg. Hubungan dihitung ya/tidak, satu kali per pasangan
  // walaupun dicatat lebih dari satu sumber. Skor hanya dipakai untuk mengurutkan; tidak ditampilkan.
  //   counter(A, B): A meng-counter B (H[A].counters[B]).
  //   partner(A, B): duo / partner (H[A].partners[B], simetris).
  //   trio {K, X, Y}: dihitung kalau dua anggota lain sudah ada di tim yang dimaksud.
  function counterHit(H, a, b) { return !!(H[a] && H[a].counters && H[a].counters[b]); }
  function partnerHit(H, a, b) { return !!((H[a] && H[a].partners && H[a].partners[b]) || (H[b] && H[b].partners && H[b].partners[a])); }
  function triosOf(T, k, team) {
    var out = [];
    (T || []).forEach(function (t) {
      if (t.h.indexOf(k) < 0) return;
      var others = t.h.filter(function (s) { return s !== k; });
      if (others.every(function (o) { return team.indexOf(o) >= 0; })) out.push(others);
    });
    return out;
  }
  // Pick K: +1 tiap musuh yang di-counter K, -1 tiap musuh yang meng-counter K, +1 tiap partner K di tim kita,
  // +1 tiap trio lengkap dengan tim kita.
  function pickScore(D, k, ally, enemy, nm) {
    var H = D.heroes, parts = [], total = 0;
    enemy.forEach(function (e) {
      if (counterHit(H, k, e)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(e) }); }
      if (counterHit(H, e, k)) { total -= 1; parts.push({ cls: "minus", t: "Di-counter " + nm(e) }); }
    });
    ally.forEach(function (a) { if (partnerHit(H, k, a)) { total += 1; parts.push({ cls: "plus", t: "Partner " + nm(a) }); } });
    triosOf(D.trios, k, ally).forEach(function (m) { total += 1; parts.push({ cls: "plus", t: "Trio dengan " + m.map(nm).join(" + ") }); });
    return { total: total, parts: parts };
  }
  // Ban K: +1 tiap hero tim kita yang di-counter K, +1 tiap partner K di musuh, +1 tiap trio lengkap dengan musuh.
  function banScore(D, k, ally, enemy, nm) {
    var H = D.heroes, parts = [], total = 0;
    ally.forEach(function (a) { if (counterHit(H, k, a)) { total += 1; parts.push({ cls: "plus", t: "Counter " + nm(a) + " (tim kita)" }); } });
    enemy.forEach(function (e) { if (partnerHit(H, k, e)) { total += 1; parts.push({ cls: "plus", t: "Partner " + nm(e) + " (musuh)" }); } });
    triosOf(D.trios, k, enemy).forEach(function (m) { total += 1; parts.push({ cls: "plus", t: "Trio dengan " + m.map(nm).join(" + ") + " (musuh)" }); });
    return { total: total, parts: parts };
  }

  // Jumlah hero dipakai user. Diisi js/pick-history.js lewat window.getHeroPickCount (match HoK Camp + riwayat pick
  // Supabase); tanpa login 0 untuk semua hero.
  function getPickCount(slug) {
    var f = typeof window !== "undefined" && window.getHeroPickCount;
    var n = typeof f === "function" ? Number(f(slug)) : 0;
    return isFinite(n) && n > 0 ? n : 0;
  }
  // Urutan: skor (tidak ditampilkan), lalu paling jarang di-pick user, lalu tier hokstats (S+ > S > A > B > C > D,
  // tanpa tier paling belakang), lalu WR (pick) / BR (ban), lalu nama.
  var TIERS = ["S+", "S", "A", "B", "C", "D"];
  function tierRank(t) { var i = TIERS.indexOf(String(t || "").toUpperCase()); return i < 0 ? TIERS.length : i; }
  function rank(rows, H, key, nm, pickCount) {
    var pc = pickCount || getPickCount;
    return rows.sort(function (a, b) {
      return b.s.total - a.s.total || pc(a.k) - pc(b.k) || tierRank(H[a.k].tier) - tierRank(H[b.k].tier) ||
        (H[b.k][key] || 0) - (H[a.k][key] || 0) || nm(a.k).localeCompare(nm(b.k));
    });
  }
  // Batas isi daftar: tim kita dan musuh masing-masing 5 hero (5v5); ban tidak dibatasi.
  var MAX = { ally: 5, enemy: 5 };
  function canAdd(state, key) { return !MAX[key] || state[key].length < MAX[key]; }
  // hooks diisi js/pick-history.js: onAllyAdd(slug, 'rekomendasi') hanya dari pencet kartu,
  // onAllyRemove(slug), onReset(). Tambah lewat ketikan tidak memanggil onAllyAdd.
  var hooks = {};
  if (typeof window !== "undefined") window.__banpick = { counterHit: counterHit, partnerHit: partnerHit, triosOf: triosOf, pickScore: pickScore, banScore: banScore, rank: rank, tierRank: tierRank, getPickCount: getPickCount, canAdd: canAdd, MAX: MAX, hooks: hooks };

  var D = typeof window !== "undefined" && window.BANPICK_DATA;
  if (!D || typeof document === "undefined") return;
  var H = D.heroes, SEL = D.selectable;
  var state = { ban: [], ally: [], enemy: [] };
  var LABEL = { ban: "di-ban", ally: "tim kita", enemy: "musuh" };
  var ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
  var roleOn = {}; ROLES.forEach(function (r) { roleOn[r] = true; });
  var LANES = ["Farm Lane", "Mid Lane", "Jungle", "Roam", "Clash Lane"];
  var laneOn = {}; LANES.forEach(function (l) { laneOn[l] = true; });
  var TOP = 10;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nm(s) { return (H[s] && H[s].name) || s; }
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
  function isClashOnly(h) { return String(h.lane || "").split("/").map(function (p) { return p.trim(); }).join("/") === "Clash Lane"; }

  function taken() { return state.ban.concat(state.ally, state.enemy); }

  function card(k, sc, rk, pickable) {
    var h = H[k], used = getPickCount(k);
    var parts = sc.parts.map(function (p) { return '<li class="' + p.cls + '"><span>' + esc(p.t) + "</span></li>"; }).join("");
    var foot = h.page ? '<a class="bp-link" href="heroes/' + k + '.html">Lihat halaman build &rarr;</a>'
      : (h.nobuild === "clash" ? '<div class="bp-clash">Lane utama Clash, build lengkap tidak dibuat</div>' : '<div class="bp-pending">Build belum tersedia</div>');
    var title = h.page ? '<a href="heroes/' + k + '.html">' + esc(h.name) + "</a>" : esc(h.name);
    var attrs = pickable ? ' bp-card-pick" data-pick="' + esc(k) + '" tabindex="0" role="button" aria-label="Pakai ' + esc(h.name) + ' di tim kita' : "";
    return '<article class="bp-card' + attrs + '"><div class="bp-head"><span class="bp-rank">' + rk + '</span><div class="bp-title"><h3>' + icon(k) + title + '</h3><span class="bp-role">' + esc(h.role) + " | " + esc(h.lane) + "</span>" + (isClashOnly(h) ? '<span class="badge clash">Clash</span>' : "") + (used ? '<span class="bp-used">dipakai ' + used + "x</span>" : "") + '</div></div><ul class="bp-why">' + parts + "</ul>" + foot + "</article>";
  }

  function render() {
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
    function list(fn, el, emptyMsg, key, filter, pickable) {
      var rows = cands.map(function (k) { return { k: k, s: fn(k) }; }).filter(function (r) { return r.s.total > 0; });
      if (filter) rows = rows.filter(function (r) { return roleOk(r.k) && laneOk(r.k); });
      rank(rows, H, key, nm);
      el.innerHTML = rows.length ? rows.slice(0, TOP).map(function (r, i) { return card(r.k, r.s, i + 1, pickable); }).join("") : '<p class="bp-empty">' + emptyMsg + "</p>";
    }
    var anyRole = ROLES.some(function (r) { return roleOn[r]; });
    var anyLane = LANES.some(function (l) { return laneOn[l]; });
    if (!anyRole) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu role.</p>';
    else if (!anyLane) pickEl.innerHTML = '<p class="bp-empty">Pilih minimal satu lane.</p>';
    else list(function (k) { return pickScore(D, k, state.ally, state.enemy, nm); }, pickEl, "Belum ada hero role dan lane ini yang cocok untuk pilihan ini.", "wr", true, true);
    list(function (k) { return banScore(D, k, state.ally, state.enemy, nm); }, banEl, "Belum ada data counter / partner yang cocok untuk pilihan ini.", "br", false);
  }
  // Untuk riwayat pick nanti: panggil setelah window.getHeroPickCount siap.
  window.__banpick.render = render;

  function setMsg(m) { var el = document.getElementById("bp-msg"); el.textContent = m || ""; }
  function renderChips(key) {
    var box = document.getElementById("chips-" + key);
    box.innerHTML = state[key].map(function (s) { return '<span class="chip chip-' + key + '">' + (key === "ban" ? icon(s) : "") + esc(nm(s)) + '<button type="button" data-k="' + key + '" data-s="' + s + '" aria-label="Hapus ' + esc(nm(s)) + '">&times;</button></span>'; }).join("");
  }
  function add(key, slug, source) {
    for (var k in state) if (state[k].indexOf(slug) >= 0) { setMsg(nm(slug) + " sudah ada di daftar " + LABEL[k] + "."); return false; }
    if (!canAdd(state, key)) { setMsg("Daftar " + LABEL[key] + " sudah penuh (" + MAX[key] + " hero)."); return false; }
    state[key].push(slug); setMsg(""); renderChips(key);
    if (key === "ally" && source === "rekomendasi" && hooks.onAllyAdd) hooks.onAllyAdd(slug, "rekomendasi");
    render(); return true;
  }
  function remove(key, slug) {
    var had = state[key].indexOf(slug) >= 0;
    state[key] = state[key].filter(function (s) { return s !== slug; }); renderChips(key);
    if (had && key === "ally" && hooks.onAllyRemove) hooks.onAllyRemove(slug);
    render();
  }
  // Pencet kartu rekomendasi pick -> hero masuk tim kita (riwayat: 'rekomendasi'). Link di kartu tetap jalan biasa.
  (function () {
    var out = document.getElementById("out-pick");
    function pick(ev) {
      if (ev.target.closest("a")) return;
      var c = ev.target.closest(".bp-card-pick"); if (!c) return;
      if (ev.type === "keydown") { if (ev.key !== "Enter" && ev.key !== " ") return; ev.preventDefault(); }
      add("ally", c.getAttribute("data-pick"), "rekomendasi");
    }
    out.addEventListener("click", pick);
    out.addEventListener("keydown", pick);
  })();

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
  document.getElementById("bp-reset").addEventListener("click", function () { state = { ban: [], ally: [], enemy: [] }; if (hooks.onReset) hooks.onReset(); ["ban", "ally", "enemy"].forEach(renderChips); setMsg(""); render(); });
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
