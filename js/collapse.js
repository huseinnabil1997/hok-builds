(function () {
  function allDetails() {
    return Array.prototype.slice.call(document.querySelectorAll("details.cond"));
  }
  function openAll() {
    allDetails().forEach(function (d) { d.open = true; });
  }
  function closeAll() {
    allDetails().forEach(function (d) { d.open = false; });
  }
  var openBtn = document.getElementById("buka-semua");
  var closeBtn = document.getElementById("tutup-semua");
  if (openBtn) openBtn.addEventListener("click", openAll);
  if (closeBtn) closeBtn.addEventListener("click", closeAll);

  // TOC / hash: open target condition
  function openFromHash() {
    var id = (location.hash || "").replace(/^#/, "");
    if (!id) return;
    var el = document.getElementById(id);
    if (el && el.tagName === "DETAILS") {
      el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  document.querySelectorAll('a[href^="#kondisi-"]').forEach(function (a) {
    a.addEventListener("click", function () {
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el && el.tagName === "DETAILS") el.open = true;
    });
  });
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();