// Latar Ban & Pick: art hero rekomendasi pick #1 di atas, memudar ke gradien warnanya.
// Art: data/hero-bgs.js (img/heroes-bg). Tanpa art: gradien dari warna ikon saja.
// Hanya membaca DOM hasil render (#out-pick); logika rekomendasi tidak disentuh.
(function () {
  "use strict";
  var out = document.getElementById("out-pick");
  if (!out || !window.MutationObserver) return;
  var root = document.documentElement, current = null, cache = {};
  document.body.classList.add("hero-bg");
  var BGS = window.HERO_BGS || {};
  // Dua lapis art untuk crossfade.
  var art = document.createElement("div");
  art.className = "hero-art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = '<div class="hero-art-layer"></div><div class="hero-art-layer"></div><div class="hero-art-fade"></div>';
  document.body.insertBefore(art, document.body.firstChild);
  var layers = art.querySelectorAll(".hero-art-layer"), front = 0;
  function showArt(url) {
    if (!url) { layers[0].classList.remove("on"); layers[1].classList.remove("on"); return; }
    var next = 1 - front;
    layers[next].style.backgroundImage = 'url("' + url + '")';
    layers[next].classList.add("on");
    layers[front].classList.remove("on");
    front = next;
  }

  // Campur warna ke putih supaya tetap terang dan teks/kartu terbaca.
  function soft(c, keep) {
    return "rgb(" + c.map(function (v) { return Math.round(255 - (255 - v) * keep); }).join(",") + ")";
  }
  function colorsOf(img) {
    var size = 24, cv = document.createElement("canvas");
    cv.width = cv.height = size;
    var ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    var px = ctx.getImageData(0, 0, size, size).data, buckets = {};
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max < 30 || min > 235) continue; // abaikan hitam/putih
      var key = (r >> 5) + "," + (g >> 5) + "," + (b >> 5);
      var bk = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0, sat: 0 });
      bk.n++; bk.r += r; bk.g += g; bk.b += b; bk.sat += max - min;
    }
    var list = Object.keys(buckets).map(function (k) {
      var bk = buckets[k];
      return { c: [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n], w: bk.n * (1 + bk.sat / bk.n / 128) };
    }).sort(function (a, b) { return b.w - a.w; });
    if (!list.length) return null;
    var first = list[0].c, second = first;
    for (var j = 1; j < list.length; j++) {
      var c = list[j].c, d = Math.abs(c[0] - first[0]) + Math.abs(c[1] - first[1]) + Math.abs(c[2] - first[2]);
      if (d > 90) { second = c; break; }
    }
    return [soft(first, 0.28), soft(second, 0.2)];
  }
  function apply(cols) {
    if (cols) {
      root.style.setProperty("--hero-bg-1", cols[0]);
      root.style.setProperty("--hero-bg-2", cols[1]);
    } else {
      root.style.removeProperty("--hero-bg-1");
      root.style.removeProperty("--hero-bg-2");
    }
  }
  function slugOf(card) {
    var a = card && card.querySelector(".bp-title h3 a");
    var m = a && /heroes\/([^\/]+)\.html/.exec(a.getAttribute("href"));
    if (m) return m[1];
    var img = card && card.querySelector(".hero-ico img");
    var n = img && /([^\/]+)\.(png|jpe?g|webp)$/.exec(img.getAttribute("src"));
    return n ? n[1] : null;
  }
  function update() {
    var card = out.querySelector(".bp-card");
    var icon = card && card.querySelector(".hero-ico img");
    var slug = slugOf(card);
    var artUrl = slug && BGS[slug] ? BGS[slug] : null;
    var src = artUrl || (icon ? icon.getAttribute("src") : null);
    if (src === current) return;
    current = src;
    showArt(artUrl);
    if (!src) { apply(null); return; }
    if (cache[src] !== undefined) { apply(cache[src]); return; }
    var probe = new Image();
    probe.onload = function () {
      var cols = null;
      try { cols = colorsOf(probe); } catch (err) { cols = null; }
      cache[src] = cols;
      if (current === src) apply(cols);
    };
    probe.onerror = function () { cache[src] = null; if (current === src) apply(null); };
    probe.src = src;
  }
  new MutationObserver(update).observe(out, { childList: true, subtree: true });
  update();
})();
