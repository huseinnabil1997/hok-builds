// Pencocokan nama hero: dipakai autocomplete, grid, dan hasil suara (STT).
// Tanpa library luar: Levenshtein + kamus alias (data/hero-aliases.js).
(function (root) {
  "use strict";
  var NUM = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", tujuh: "7" };

  function words(value) {
    return String(value).toLowerCase().replace(/&/g, " ").replace(/['’.()]/g, " ").split(/[^a-z0-9]+/).filter(Boolean)
      .map(function (w) { return NUM[w] || (w === "number" || w === "nomor" ? "no" : w); });
  }
  function fold(value) { return words(value).join(""); }

  function editDistance(left, right) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    var prev = [], i, j;
    for (j = 0; j <= right.length; j++) prev[j] = j;
    for (i = 1; i <= left.length; i++) {
      var cur = [i];
      for (j = 1; j <= right.length; j++) {
        var cost = left.charAt(i - 1) === right.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[right.length];
  }

  // heroes: [{ slug, name, role? }]. aliases: { slug: [alias, ...] }.
  function create(heroes, aliases) {
    aliases = aliases || root.HERO_ALIASES || {};
    var keys = [];
    heroes.forEach(function (h) {
      var seen = {};
      function push(text, isAlias) {
        var k = fold(text);
        if (!k || seen[k]) return;
        seen[k] = true;
        keys.push({ key: k, hero: h, alias: isAlias });
      }
      push(h.name, false);
      push(String(h.slug).replace(/-/g, " "), false);
      (aliases[h.slug] || []).forEach(function (a) { push(a, true); });
    });

    // Autocomplete: minimal 2 huruf. Urutan: sama persis, awalan, ada di tengah, lalu typo ringan.
    function search(query, opts) {
      opts = opts || {};
      var q = fold(query);
      var min = opts.minChars == null ? 2 : opts.minChars;
      if (q.length < min) return [];
      var best = {};
      keys.forEach(function (e) {
        var rank;
        if (e.key === q) rank = 0;
        else if (e.key.indexOf(q) === 0) rank = 1;
        else if (e.key.indexOf(q) > 0) rank = 2;
        else if (q.length >= 4) {
          var d = editDistance(q, e.key.slice(0, q.length + 1));
          rank = d <= Math.floor(q.length / 4) ? 3 + d : null;
        }
        if (rank == null) return;
        if (e.alias) rank += 0.5;
        var s = e.hero.slug;
        if (!best[s] || rank < best[s].rank) best[s] = { rank: rank, hero: e.hero };
      });
      return Object.keys(best).map(function (s) { return best[s]; })
        .sort(function (a, b) { return a.rank - b.rank || a.hero.name.localeCompare(b.hero.name); })
        .map(function (r) { return r.hero; });
    }

    // STT: satu frasa -> { hero, gap }, atau null kalau tidak yakin.
    // Ambang: jarak edit <= 35% panjang (min 1); frasa < 3 huruf harus persis.
    function best(text) {
      var q = fold(text);
      if (!q) return null;
      var bestHero = null, bestGap = 99, tie = false;
      keys.forEach(function (e) {
        var gap;
        if (e.key === q) gap = 0;
        else if (q.length < 3 || Math.abs(q.length - e.key.length) > 3) return;
        else gap = editDistance(q, e.key);
        if (gap < bestGap) { bestGap = gap; bestHero = e.hero; tie = false; }
        else if (gap === bestGap && bestHero && e.hero.slug !== bestHero.slug) tie = true;
      });
      var limit = Math.max(1, Math.floor(q.length * 0.35));
      if (!bestHero || bestGap > limit || (tie && bestGap > 0)) return null;
      return { hero: bestHero, gap: bestGap };
    }
    function match(text) { var r = best(text); return r ? r.hero : null; }

    // STT kalimat: potong jadi jendela 1..4 kata. Biaya: kata dilewati = 1,
    // jendela yang cocok = jarak edit. Ambil potongan dengan biaya terkecil.
    function matchMany(text) {
      var w = words(text), n = w.length, cost = [0], prev = [], hit = [];
      for (var i = 1; i <= n; i++) {
        cost[i] = cost[i - 1] + 1; prev[i] = i - 1; hit[i] = null;
        for (var k = 1; k <= Math.min(4, i); k++) {
          var r = best(w.slice(i - k, i).join(" "));
          if (r && cost[i - k] + r.gap < cost[i]) { cost[i] = cost[i - k] + r.gap; prev[i] = i - k; hit[i] = r.hero; }
        }
      }
      var found = [];
      for (var j = n; j > 0; j = prev[j]) if (hit[j]) found.unshift(hit[j]);
      return found;
    }

    return { search: search, match: match, matchMany: matchMany };
  }

  var api = { fold: fold, editDistance: editDistance, create: create };
  root.HeroMatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
