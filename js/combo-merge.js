// Gabung sinergi duo/trio: data repo (companion app) + HoK Camp (Compatibility %).
// Dimuat setelah data/banpick.js + data/hokcamp-combos.js, sebelum banpick*.js.
// Hasilnya menimpa H[slug].duo / H[slug].trio di memori, jadi rumus skor di banpick*.js tidak berubah.
(function () {
  "use strict";
  // ===== CONFIG: semua angka yang bisa disetel ada di sini =====
  var CONFIG = {
    repoWeight: 0.6,          // bobot data repo kalau combo ada di dua sumber
    campWeight: 0.4,          // bobot HoK Camp kalau combo ada di dua sumber
    singleSourcePenalty: 0.7, // pengali kalau combo cuma ada di satu sumber
    trioCapPercentile: 90,    // nilai trio gabungan (0-100) dipotong di persentil ini
    // Skala akhir: 0-100 dikembalikan ke skala index repo (nilai repo tertinggi) supaya
    // sebanding dengan counter_index. null = pakai maksimum data repo.
    duoScale: null,
    trioScale: null
  };
  window.COMBO_CONFIG = CONFIG;
  var D = window.BANPICK_DATA, C = window.HOKCAMP_COMBOS;
  if (!D || !C) return;
  var H = D.heroes;
  function key(arr) { return arr.slice().sort().join("+"); }
  function repoMap(field) {
    var m = {};
    Object.keys(H).forEach(function (s) {
      (H[s][field] || []).forEach(function (x) {
        var k = field === "duo" ? key([s, x.slug]) : key(x.h);
        if (!(k in m) || x.v > m[k]) m[k] = x.v;
      });
    });
    return m;
  }
  function campMap(list) { var m = {}; list.forEach(function (x) { var k = key(x.h); if (!(k in m) || x.v > m[k]) m[k] = x.v; }); return m; }
  function maxOf(m) { var b = 0; Object.keys(m).forEach(function (k) { if (m[k] > b) b = m[k]; }); return b; }
  function merge(r, c) {
    var rm = maxOf(r) || 1, cm = maxOf(c) || 1, out = {};
    Object.keys(r).concat(Object.keys(c)).forEach(function (k) {
      if (k in out) return;
      var inR = k in r, inC = k in c, nr = inR ? r[k] / rm * 100 : 0, nc = inC ? c[k] / cm * 100 : 0;
      out[k] = inR && inC ? CONFIG.repoWeight * nr + CONFIG.campWeight * nc
        : (inR ? nr : nc) * CONFIG.singleSourcePenalty;
    });
    return { m: out, repoMax: rm };
  }
  function percentile(vals, p) {
    var a = vals.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return 0;
    var i = (a.length - 1) * p / 100, lo = Math.floor(i), hi = Math.ceil(i);
    return a[lo] + (a[hi] - a[lo]) * (i - lo);
  }
  var duo = merge(repoMap("duo"), campMap(C.duo || []));
  var trio = merge(repoMap("trio"), campMap(C.trio || []));
  var cap = percentile(Object.keys(trio.m).map(function (k) { return trio.m[k]; }), CONFIG.trioCapPercentile);
  var dScale = (CONFIG.duoScale || duo.repoMax) / 100, tScale = (CONFIG.trioScale || trio.repoMax) / 100;
  function r2(n) { return Math.round(n * 100) / 100; }
  Object.keys(H).forEach(function (s) { H[s].duo = []; H[s].trio = []; });
  Object.keys(duo.m).forEach(function (k) {
    var p = k.split("+"), v = r2(duo.m[k] * dScale);
    if (H[p[0]]) H[p[0]].duo.push({ slug: p[1], v: v });
    else if (H[p[1]]) H[p[1]].duo.push({ slug: p[0], v: v });
  });
  Object.keys(trio.m).forEach(function (k) {
    var p = k.split("+"), v = r2(Math.min(trio.m[k], cap) * tScale), owner = p.filter(function (x) { return H[x]; })[0];
    if (owner) H[owner].trio.push({ h: p, v: v });
  });
  window.COMBO_MERGE_INFO = { trioCap: cap, duoScale: dScale * 100, trioScale: tScale * 100 };
})();
