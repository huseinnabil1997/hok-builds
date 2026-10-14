// Input hero utama untuk Ban & Pick: grid ikon + cari (min 2 huruf) + filter role.
// Butuh window.BANPICK (dari banpick.js / banpick-simple.js) dan window.HeroMatch.
(function () {
  "use strict";
  var D = window.BANPICK_DATA, BP = window.BANPICK, box = document.getElementById("hero-picker");
  if (!D || !BP || !box || !window.HeroMatch) return;
  var SEL = D.selectable, H = D.heroes, ICONS = window.HERO_ICONS || {};
  var matcher = window.HeroMatch.create(SEL, window.HERO_ALIASES);
  var ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
  var TARGETS = [["ban", "Ban"], ["ally", "Tim kita"], ["enemy", "Musuh"]];
  var target = "enemy", role = "", query = "";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function roleOf(s) { return (H[s.slug] && H[s.slug].role) || ""; }
  function initials(name) {
    var w = name.replace(/\(.*\)/, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
  }
  function hue(slug) { var h = 0; for (var i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360; return h; }

  box.innerHTML =
    '<div class="hp-head"><h2 class="section-title">Pilih hero</h2>' +
    '<div class="hp-targets" role="group" aria-label="Masukkan ke daftar">' +
    TARGETS.map(function (t) { return '<button type="button" class="role-chip' + (t[0] === target ? " on" : "") + '" data-target="' + t[0] + '" aria-pressed="' + (t[0] === target) + '">' + t[1] + "</button>"; }).join("") +
    "</div></div>" +
    '<input type="search" id="hp-search" class="hp-search" placeholder="Cari hero (min. 2 huruf, alias juga bisa)..." autocomplete="off"/>' +
    '<div class="hp-roles" role="group" aria-label="Filter role">' +
    '<button type="button" class="role-chip on" data-hp-role="" aria-pressed="true">Semua</button>' +
    ROLES.map(function (r) { return '<button type="button" class="role-chip" data-hp-role="' + r + '" aria-pressed="false">' + r + "</button>"; }).join("") +
    "</div>" +
    '<div class="hp-grid" id="hp-grid"></div><p class="hp-empty hidden" id="hp-empty">Tidak ada hero yang cocok</p>';

  var grid = document.getElementById("hp-grid"), empty = document.getElementById("hp-empty"), search = document.getElementById("hp-search");

  function render() {
    var list = query.trim().length >= 2 ? matcher.search(query) : SEL.slice();
    if (role) list = list.filter(function (s) { return roleOf(s).split("/").map(function (p) { return p.trim(); }).indexOf(role) >= 0; });
    var taken = BP.taken();
    grid.innerHTML = list.map(function (s) {
      var used = taken.indexOf(s.slug) >= 0;
      return '<button type="button" class="hp-tile' + (used ? " used" : "") + '" data-slug="' + esc(s.slug) + '"' + (used ? " disabled" : "") + ' title="' + esc(s.name) + (roleOf(s) ? " | " + esc(roleOf(s)) : "") + '">' +
        '<span class="hp-icon" style="background:hsl(' + hue(s.slug) + ',45%,32%)" aria-hidden="true">' + esc(initials(s.name)) +
        (ICONS[s.slug] ? '<img src="' + esc(ICONS[s.slug]) + '" alt="" loading="lazy" onerror="this.remove()"/>' : "") + "</span>" +
        '<span class="hp-name">' + esc(s.name) + "</span></button>";
    }).join("");
    empty.classList.toggle("hidden", list.length > 0);
  }

  search.addEventListener("input", function () { query = search.value; render(); });
  search.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    var first = grid.querySelector(".hp-tile:not(.used)");
    if (first) first.click();
  });
  box.addEventListener("click", function (ev) {
    var tile = ev.target.closest(".hp-tile");
    if (tile) { if (BP.add(target, tile.getAttribute("data-slug"))) { search.value = ""; query = ""; } render(); return; }
    var t = ev.target.closest("[data-target]");
    if (t) {
      target = t.getAttribute("data-target");
      box.querySelectorAll("[data-target]").forEach(function (b) { var on = b === t; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      return;
    }
    var r = ev.target.closest("[data-hp-role]");
    if (r) {
      role = r.getAttribute("data-hp-role");
      box.querySelectorAll("[data-hp-role]").forEach(function (b) { var on = b === r; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      render();
    }
  });
  document.addEventListener("banpick:change", render);
  render();
})();
