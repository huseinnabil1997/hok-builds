// Latar Ban & Pick: gradien lembut dari warna ikon hero rekomendasi pick #1.
// Hanya membaca DOM hasil render (#out-pick); logika rekomendasi tidak disentuh.
(function () {
  "use strict";
  var out = document.getElementById("out-pick");
  if (!out || !window.MutationObserver) return;
  var root = document.documentElement, current = null, cache = {};
  document.body.classList.add("hero-bg");

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
  function update() {
    var img = out.querySelector(".bp-card .hero-ico img");
    var src = img ? img.getAttribute("src") : null;
    if (src === current) return;
    current = src;
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
