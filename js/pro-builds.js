// Render 5 build pro (KPL) terbaru di halaman hero. Data: data/pro-builds.js (window.PRO_BUILDS).
(function () {
  var box = document.getElementById("pro-builds");
  if (!box || !window.PRO_BUILDS) return;
  var list = (window.PRO_BUILDS.heroes || {})[box.getAttribute("data-slug")] || [];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var h = '<h2 class="section-title">Build Pro KPL (5 terbaru)</h2>' +
    '<p class="source-hint">Sumber: data pertandingan KPL pvp.qq.com &middot; diambil ' + esc(window.PRO_BUILDS.meta.diambil) + ' &middot; 6 item jadi per build (komponen dilengkapi, tanda *)</p>';
  if (!list.length) h += '<p class="meta-line">Belum ada build pro untuk hero ini di liga terbaru.</p>';
  list.forEach(function (b, i) {
    h += '<div class="pro-card">' +
      '<div class="pro-head"><span class="pro-no">' + (i + 1) + '</span>' +
      (b.teamIcon ? '<img class="pro-logo" src="' + esc(b.teamIcon) + '" alt="' + esc(b.team) + '" loading="lazy"/>' : '') +
      '<div class="pro-who"><strong>' + esc(b.player) + '</strong> <span class="pro-team">' + esc(b.teamName || b.team) + '</span>' +
      '<div class="pro-sub">vs ' + (b.vsIcon ? '<img class="pro-logo-sm" src="' + esc(b.vsIcon) + '" alt=""/>' : '') + esc(b.vs) + '</div>' +
      '<div class="pro-sub">' + esc(b.date) + ' &middot; ' + esc(b.league) + (b.stage ? ' ' + esc(b.stage) : '') + ' &middot; Game ' + esc(b.game) + (b.mins ? ' &middot; ' + b.mins + ' mnt' : '') + '</div></div>' +
      '<span class="pro-res ' + (b.win ? 'win' : 'lose') + '">' + (b.win ? 'Menang' : 'Kalah') + '</span></div>' +
      '<div class="pro-kda">KDA <strong>' + b.k + '/' + b.d + '/' + b.a + '</strong>' + (b.pos ? ' &middot; ' + esc(b.pos) : '') + (b.spell ? ' &middot; Spell ' + esc(b.spell) : '') + '</div>' +
      '<div class="pro-items">' + b.items.map(function (it) { return '<div class="pro-item' + (it.predicted ? ' predicted' : '') + '"' + (it.predicted ? ' title="Diperkirakan: komponen ' + esc(it.from) + ' dilengkapi"' : '') + '><img src="' + esc(it.i) + '" alt="' + esc(it.n) + '" loading="lazy"/><div class="iname">' + esc(it.n) + (it.predicted ? ' *' : '') + '</div></div>'; }).join("") + '</div>' +
      '<div class="pro-arcana">' + b.arcana.map(function (a) { return '<div class="pro-arc"><img src="' + esc(a.i) + '" alt="' + esc(a.n) + '" loading="lazy"/><span>' + esc(a.n) + ' x' + a.c + '</span></div>'; }).join("") + '</div>' +
      '</div>';
  });
  if (list.some(function (b) { return b.items.some(function (it) { return it.predicted; }); })) h += '<p class="source-hint pro-note">* item diperkirakan: snapshot masih komponen, dilengkapi ke item jadi yang paling sering dipakai pro untuk hero ini.</p>';
  box.innerHTML = h;
})();
