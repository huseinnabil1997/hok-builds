(function () {
  "use strict";

  // Riwayat pick (Supabase, tabel pick_history). Bagian murni (create) bisa dites tanpa DOM / jaringan.
  // Satu baris = satu kali catatan di situs. Sumber: 'rekomendasi' (pencet kartu rekomendasi pick)
  // atau 'manual' (tombol +1 / Tambah di daftar hero yang sudah dipakai).
  // Tambah hero ke tim kita lewat ketikan tidak tercatat.
  // Undo: kalau hero dilepas lagi dari tim kita di draft yang sama, baris yang baru dibuat ikut dihapus.
  // Data awal HoK Camp (tabel hero_usage_baseline: jumlah match per hero) ikut dimuat dan dijumlahkan di used().
  // Kalau tabel itu gagal dimuat, riwayat pick tetap jalan tanpa data awal.
  function create(client, opts) {
    opts = opts || {};
    var table = opts.table || "pick_history";
    var baseTable = opts.baselineTable || "hero_usage_baseline";
    var onChange = opts.onChange || function () {};
    var rows = [];      // { id, hero_slug, source, created_at }, terbaru dulu
    var draft = {};     // slug -> { p: Promise<id|null>, cancelled: bool }
    var enabled = false;
    var base = {};      // slug -> matches (HoK Camp)
    var baseInfo = null; // { heroes, matches, updated } kalau ada baris

    function counts() {
      var c = {};
      rows.forEach(function (r) { c[r.hero_slug] = (c[r.hero_slug] || 0) + 1; });
      return c;
    }
    function count(slug) { var n = 0; rows.forEach(function (r) { if (r.hero_slug === slug) n++; }); return n; }
    function baseline(slug) { return base[slug] || 0; }
    function used(slug) { return baseline(slug) + count(slug); }
    // Hero yang sudah dipakai: baseline Camp + catatan situs > 0, urut jumlah desc lalu slug.
    function usedList() {
      var seen = {}, keys = [];
      function add(s) { if (!s || seen[s] || used(s) <= 0) return; seen[s] = 1; keys.push(s); }
      Object.keys(base).forEach(add);
      rows.forEach(function (r) { add(r.hero_slug); });
      keys.sort(function (a, b) { return used(b) - used(a) || a.localeCompare(b); });
      return keys;
    }
    function changed() { try { onChange(api); } catch (e) { /* UI saja */ } }

    function load() {
      var all = [], PAGE = 1000;
      function page(from) {
        return client.from(table).select("id,hero_slug,source,created_at").order("created_at", { ascending: false }).range(from, from + PAGE - 1)
          .then(function (res) {
            if (res.error) throw res.error;
            all = all.concat(res.data || []);
            return (res.data || []).length === PAGE ? page(from + PAGE) : all;
          });
      }
      return Promise.all([page(0), loadBaseline()]).then(function (r) { rows = r[0]; enabled = true; draft = {}; changed(); return rows; });
    }
    function setBaseline(data) {
      base = {}; baseInfo = null;
      (data || []).forEach(function (r) {
        var n = Number(r.matches);
        if (!r.hero_slug || !isFinite(n) || n < 0) return;
        base[r.hero_slug] = n;
        if (!baseInfo) baseInfo = { heroes: 0, matches: 0, updated: null };
        baseInfo.heroes++; baseInfo.matches += n;
        if (r.updated_at && (!baseInfo.updated || r.updated_at > baseInfo.updated)) baseInfo.updated = r.updated_at;
      });
    }
    function loadBaseline() {
      return Promise.resolve().then(function () { return client.from(baseTable).select("hero_slug,matches,updated_at").range(0, 999); })
        .then(function (res) { if (res.error) throw res.error; setBaseline(res.data); })
        .catch(function (e) { setBaseline([]); if (opts.onBaselineError) opts.onBaselineError(e); });
    }
    function clear() { rows = []; draft = {}; enabled = false; setBaseline([]); changed(); }

    function del(id) {
      return client.from(table).delete().eq("id", id).then(function (res) {
        if (res.error) throw res.error;
        rows = rows.filter(function (r) { return r.id !== id; });
        changed();
        return true;
      });
    }

    // Pencet kartu rekomendasi pick. Satu slot per hero per draft, bisa di-undo.
    // source harus 'rekomendasi'; selain itu tidak ditulis (tambah lewat ketikan tidak lewat sini).
    function record(slug, source) {
      if (!enabled || draft[slug] || source !== "rekomendasi") return Promise.resolve(null);
      var slot = { cancelled: false };
      slot.p = client.from(table).insert({ hero_slug: slug, source: "rekomendasi" }).select("id,hero_slug,source,created_at").single()
        .then(function (res) {
          if (res.error) throw res.error;
          var row = res.data;
          if (slot.cancelled) return del(row.id).then(function () { return null; }, function () { return null; });
          rows.unshift(row); changed();
          return row.id;
        })
        .catch(function (e) { if (draft[slug] === slot) delete draft[slug]; if (opts.onError) opts.onError(e); return null; });
      draft[slug] = slot;
      return slot.p;
    }
    // Tombol +1 / Tambah: satu baris source 'manual', tanpa slot draft, bisa berulang.
    function addOne(slug) {
      if (!enabled || !slug) return Promise.resolve(null);
      return client.from(table).insert({ hero_slug: slug, source: "manual" }).select("id,hero_slug,source,created_at").single()
        .then(function (res) {
          if (res.error) throw res.error;
          var row = res.data;
          rows.unshift(row); changed();
          return row.id;
        })
        .catch(function (e) { if (opts.onError) opts.onError(e); return null; });
    }
    // Hero dilepas dari tim kita di draft yang sama -> hapus baris yang dibuat untuk slot itu.
    function undo(slug) {
      var slot = draft[slug];
      if (!slot) return Promise.resolve(false);
      delete draft[slug];
      slot.cancelled = true;
      return slot.p.then(function (id) {
        if (id == null) return false;
        return del(id).catch(function (e) { if (opts.onError) opts.onError(e); return false; });
      });
    }
    // Draft baru (Reset semua): riwayat tetap, slot undo dilupakan.
    function newDraft() { draft = {}; }
    // Tombol -1: hapus baris pick_history terbaru hero itu. Data Camp tidak diubah.
    function removeOne(slug) {
      var row = null;
      for (var i = 0; i < rows.length; i++) if (rows[i].hero_slug === slug) { row = rows[i]; break; }
      if (!row) return Promise.resolve(false);
      var slot = draft[slug];
      if (slot) slot.p.then(function (id) { if (id === row.id && draft[slug] === slot) delete draft[slug]; });
      return del(row.id).catch(function (e) { if (opts.onError) opts.onError(e); return false; });
    }

    var api = {
      load: load, clear: clear, record: record, addOne: addOne, undo: undo, newDraft: newDraft, removeOne: removeOne,
      counts: counts, count: count, total: function () { return rows.length; },
      baseline: baseline, used: used, usedList: usedList, baselineInfo: function () { return baseInfo; },
      enabled: function () { return enabled; }, pending: function () { return Object.keys(draft); },
    };
    return api;
  }
  if (typeof window !== "undefined") window.__pickHistory = { create: create };

  // --- UI. Tanpa login / CDN gagal / Supabase gagal -> riwayat nonaktif, hitungan 0.
  // index.html (Daftar hero): #ph-list = daftar utama hero yang sudah dipakai + #ph-add (cari + Tambah).
  // banpick.html: hanya panel akun; pencatatan dari kartu rekomendasi, "dipakai Nx", tiebreak. Tanpa daftar.
  if (typeof document === "undefined") return;
  var panel = document.getElementById("ph-auth"), box = document.getElementById("ph-list");
  if (!panel) return;
  var BP = window.__banpick || {}, H = (window.BANPICK_DATA && window.BANPICK_DATA.heroes) || {};
  var $ = function (id) { return document.getElementById(id); };
  var msgEl = $("ph-msg"), whoEl = $("ph-who"), formEl = $("ph-form"), outBtn = $("ph-out");
  function msg(t) { msgEl.textContent = t || ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nm(s) { return (H[s] && H[s].name) || s; }
  function initials(name) {
    var w = String(name).replace(/\(.*\)/, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : String(name).slice(0, 2)).toUpperCase();
  }
  function icon(s) {
    var ICONS = window.HERO_ICONS || {};
    var img = ICONS[s] ? '<img src="' + esc(ICONS[s]) + '" alt="" loading="lazy" onerror="this.remove()"/>' : "";
    return '<span class="hero-ico" aria-hidden="true">' + esc(initials(nm(s))) + img + "</span>";
  }
  function rerender() { if (BP.render) BP.render(); }
  function hideAdd() { var el = $("ph-add"); if (el) el.hidden = true; }
  function showAdd(on) { var el = $("ph-add"); if (el) el.hidden = !on; }
  function disabled(t) {
    formEl.hidden = true; outBtn.hidden = true; whoEl.textContent = ""; msg(t); hideAdd();
    var html = '<p class="bp-empty">Daftar hero yang sudah dipakai tidak tersedia.</p>';
    if (box) box.innerHTML = html;
  }
  var FAIL = box ? "Daftar hero yang sudah dipakai tidak tersedia" : "Akun dan catatan pick tidak tersedia";
  var KEEP = box ? "" : " Ban & Pick tetap jalan.";

  var cfg = window.SUPABASE_CONFIG, lib = window.supabase;
  if (!cfg || !lib || typeof lib.createClient !== "function") { disabled(FAIL + " (Supabase gagal dimuat)." + KEEP); return; }
  var client;
  try { client = lib.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
  catch (e) { disabled(FAIL + "." + KEEP); return; }

  var BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  function tgl(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear(); }
  function baseLine(h) {
    var b = h.baselineInfo(); if (!b) return "";
    var t = b.updated ? tgl(b.updated) : "";
    return '<p class="ph-base">Data HoK Camp: ' + b.heroes + " hero, " + b.matches.toLocaleString("id-ID") + " match" + (t ? ", diperbarui " + t : "") + ". Dijumlahkan dengan catatan di situs.</p>";
  }
  function renderList(h) {
    if (!box) return;
    showAdd(h.enabled());
    if (!h.enabled()) { box.innerHTML = '<p class="bp-empty">Masuk dulu untuk menyimpan dan melihat hero yang sudah kamu pakai.</p>'; return; }
    var keys = h.usedList().slice().sort(function (a, b) { return h.used(b) - h.used(a) || nm(a).localeCompare(nm(b)); });
    var sum = 0; keys.forEach(function (k) { sum += h.used(k); });
    var empty = keys.length ? "" : '<p class="bp-empty">Belum ada hero yang tercatat. Cari hero di bawah lalu pencet Tambah, atau pencet kartu rekomendasi pick di Ban &amp; Pick.</p>';
    var total = keys.length ? '<p class="ph-total">Total ' + sum.toLocaleString("id-ID") + " match, " + keys.length + " hero</p>" : "";
    var list = keys.length ? '<ul class="ph-rows">' + keys.map(function (k) {
      var histN = h.count(k);
      return '<li>' + icon(k) + '<span class="ph-name">' + esc(nm(k)) + '</span><span class="ph-n">' + h.used(k).toLocaleString("id-ID") + ' match' +
        (histN > 0 && h.baseline(k) > 0 ? ' <small class="ph-src">(Camp ' + h.baseline(k).toLocaleString("id-ID") + " + situs " + histN + ")</small>" : "") + '</span>' +
        '<button type="button" class="ph-btn" data-act="plus" data-s="' + esc(k) + '" aria-label="Tambah satu match ' + esc(nm(k)) + '">+1</button>' +
        '<button type="button" class="ph-btn" data-act="minus" data-s="' + esc(k) + '" aria-label="Kurangi satu catatan ' + esc(nm(k)) + '"' + (histN < 1 ? " disabled" : "") + '>&minus;1</button></li>';
    }).join("") + "</ul>" : "";
    box.innerHTML = baseLine(h) + total + empty + list;
  }
  var hist = create(client, {
    table: cfg.table,
    onChange: function (h) { renderList(h); rerender(); },
    onError: function (e) { msg("Gagal menyimpan catatan: " + ((e && e.message) || e)); },
  });
  // Jumlah dipakai = match HoK Camp (data awal) + riwayat pick di situs. Dipakai di kartu ("dipakai Nx") dan tiebreak.
  window.getHeroPickCount = function (slug) { return hist.enabled() ? hist.used(slug) : 0; };
  window.__pickHistory.instance = hist;
  if (BP.hooks) {
    BP.hooks.onAllyAdd = function (slug, source) { hist.record(slug, source); };
    BP.hooks.onAllyRemove = function (slug) { hist.undo(slug); };
    BP.hooks.onReset = function () { hist.newDraft(); };
  }
  if (box) box.addEventListener("click", function (ev) {
    var b = ev.target.closest(".ph-btn"); if (!b || b.disabled) return;
    var act = b.getAttribute("data-act"), s = b.getAttribute("data-s");
    b.disabled = true;
    if (act === "plus") hist.addOne(s); else hist.removeOne(s);
  });

  (function bindAdd() {
    var input = $("in-ph-add"), ac = $("ac-ph-add"), btn = $("ph-add-btn");
    if (!input || !ac || !btn) return;
    var SEL = (window.BANPICK_DATA && window.BANPICK_DATA.selectable) || [];
    var active = -1, opts = [], chosen = null;
    function close() { ac.classList.add("hidden"); active = -1; }
    function show() {
      var q = input.value.trim().toLowerCase();
      opts = SEL.filter(function (s) { return !q || s.name.toLowerCase().indexOf(q) >= 0 || s.slug.indexOf(q) >= 0; })
        .sort(function (a, b) {
          function r(s) { var n = s.name.toLowerCase(); return !q ? 0 : n === q ? 0 : n.indexOf(q) === 0 ? 1 : 2; }
          return r(a) - r(b) || a.name.localeCompare(b.name);
        }).slice(0, 12);
      if (!opts.length) { ac.innerHTML = '<li class="ac-none">Tidak ada hero yang cocok</li>'; ac.classList.remove("hidden"); return; }
      ac.innerHTML = opts.map(function (s, i) { return '<li data-i="' + i + '"' + (i === active ? ' class="on"' : "") + ">" + esc(s.name) + "</li>"; }).join("");
      ac.classList.remove("hidden");
    }
    function pick(i) {
      if (!opts[i]) return;
      chosen = opts[i];
      input.value = chosen.name;
      close();
    }
    function resolveSlug() {
      if (chosen && (chosen.name === input.value.trim() || chosen.slug === input.value.trim().toLowerCase())) return chosen.slug;
      var q = input.value.trim().toLowerCase();
      if (!q) return null;
      var exact = SEL.filter(function (s) { return s.name.toLowerCase() === q || s.slug === q; });
      if (exact.length === 1) return exact[0].slug;
      return opts.length === 1 ? opts[0].slug : null;
    }
    function submit() {
      var slug = resolveSlug();
      if (!slug) { msg("Pilih hero dari daftar dulu."); return; }
      if (!hist.enabled()) { msg("Masuk dulu untuk menambah match."); return; }
      btn.disabled = true;
      hist.addOne(slug).then(function (id) {
        btn.disabled = false;
        if (id) { input.value = ""; chosen = null; msg(""); }
      });
    }
    input.addEventListener("input", function () { chosen = null; active = -1; show(); });
    input.addEventListener("focus", function () { show(); });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { active = Math.min(active + 1, opts.length - 1); show(); ev.preventDefault(); }
      else if (ev.key === "ArrowUp") { active = Math.max(active - 1, 0); show(); ev.preventDefault(); }
      else if (ev.key === "Enter") {
        ev.preventDefault();
        if (active >= 0) pick(active);
        else if (!chosen && opts.length) pick(0);
        submit();
      } else if (ev.key === "Escape") close();
    });
    ac.addEventListener("mousedown", function (ev) { var li = ev.target.closest("li[data-i]"); if (li) { ev.preventDefault(); pick(+li.dataset.i); } });
    btn.addEventListener("click", submit);
  })();

  function showUser(user) {
    if (user) {
      formEl.hidden = true; outBtn.hidden = false; whoEl.textContent = "Masuk sebagai " + (user.email || "user");
      hist.load().then(function () { msg(""); }, function (e) { msg("Gagal memuat daftar: " + ((e && e.message) || e)); });
    } else {
      formEl.hidden = false; outBtn.hidden = true; whoEl.textContent = ""; msg(""); hist.clear();
    }
  }
  var lastUid = undefined;
  client.auth.onAuthStateChange(function (_ev, session) {
    var uid = session && session.user ? session.user.id : null;
    if (uid === lastUid) return; lastUid = uid;
    // Jangan panggil API Supabase langsung di dalam callback (anjuran supabase-js).
    setTimeout(function () { showUser(session && session.user); }, 0);
  });
  client.auth.getSession().then(function (r) {
    var s = r && r.data && r.data.session, uid = s && s.user ? s.user.id : null;
    if (uid !== lastUid) { lastUid = uid; showUser(s && s.user); }
  }, function () { showUser(null); });

  function creds() { return { email: $("ph-email").value.trim(), password: $("ph-pass").value }; }
  function busy(on) { Array.prototype.forEach.call(panel.querySelectorAll("button,input"), function (el) { el.disabled = on; }); }
  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var c = creds(); if (!c.email || !c.password) { msg("Isi email dan password."); return; }
    busy(true); msg("Masuk...");
    client.auth.signInWithPassword(c).then(function (r) {
      busy(false);
      if (r.error) msg("Gagal masuk: " + r.error.message); else { msg(""); $("ph-pass").value = ""; }
    }, function (e) { busy(false); msg("Gagal masuk: " + ((e && e.message) || e)); });
  });
  $("ph-signup").addEventListener("click", function () {
    var c = creds(); if (!c.email || !c.password) { msg("Isi email dan password untuk daftar."); return; }
    busy(true); msg("Mendaftar...");
    var redirect = location.href.split("#")[0].split("?")[0];
    client.auth.signUp({ email: c.email, password: c.password, options: { emailRedirectTo: redirect } }).then(function (r) {
      busy(false);
      if (r.error) msg("Gagal daftar: " + r.error.message);
      else if (!r.data || !r.data.session) msg("Cek email untuk konfirmasi, lalu masuk.");
      else { msg(""); $("ph-pass").value = ""; }
    }, function (e) { busy(false); msg("Gagal daftar: " + ((e && e.message) || e)); });
  });
  outBtn.addEventListener("click", function () {
    busy(true);
    client.auth.signOut().then(function () { busy(false); msg(""); }, function () { busy(false); });
  });
  renderList(hist);
})();
