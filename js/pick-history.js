(function () {
  "use strict";

  // Riwayat pick (Supabase, tabel pick_history). Bagian murni (create) bisa dites tanpa DOM / jaringan.
  // Satu baris = satu kali hero dipakai di tim kita. Sumber: 'rekomendasi' (pencet kartu) atau 'manual' (ketik).
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

    // Hero masuk tim kita. Satu slot per hero per draft.
    function record(slug, source) {
      if (!enabled || draft[slug]) return Promise.resolve(null);
      var slot = { cancelled: false };
      slot.p = client.from(table).insert({ hero_slug: slug, source: source === "rekomendasi" ? "rekomendasi" : "manual" }).select("id,hero_slug,source,created_at").single()
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
    // Hapus satu entri (-1) dari daftar Riwayat: baris terbaru hero itu.
    function removeOne(slug) {
      var row = null;
      for (var i = 0; i < rows.length; i++) if (rows[i].hero_slug === slug) { row = rows[i]; break; }
      if (!row) return Promise.resolve(false);
      var slot = draft[slug];
      if (slot) slot.p.then(function (id) { if (id === row.id && draft[slug] === slot) delete draft[slug]; });
      return del(row.id).catch(function (e) { if (opts.onError) opts.onError(e); return false; });
    }

    var api = {
      load: load, clear: clear, record: record, undo: undo, newDraft: newDraft, removeOne: removeOne,
      counts: counts, count: count, total: function () { return rows.length; },
      baseline: baseline, used: used, baselineInfo: function () { return baseInfo; },
      enabled: function () { return enabled; }, pending: function () { return Object.keys(draft); },
    };
    return api;
  }
  if (typeof window !== "undefined") window.__pickHistory = { create: create };

  // --- UI (banpick.html). Tanpa login / CDN gagal / Supabase gagal -> riwayat nonaktif, hitungan 0.
  if (typeof document === "undefined") return;
  var panel = document.getElementById("ph-auth"), box = document.getElementById("ph-list");
  if (!panel || !box) return;
  var BP = window.__banpick || {}, H = (window.BANPICK_DATA && window.BANPICK_DATA.heroes) || {};
  var $ = function (id) { return document.getElementById(id); };
  var msgEl = $("ph-msg"), whoEl = $("ph-who"), formEl = $("ph-form"), outBtn = $("ph-out");
  function msg(t) { msgEl.textContent = t || ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nm(s) { return (H[s] && H[s].name) || s; }
  function rerender() { if (BP.render) BP.render(); }
  function disabled(t) { formEl.hidden = true; outBtn.hidden = true; whoEl.textContent = ""; msg(t); box.innerHTML = '<p class="bp-empty">Riwayat pick tidak tersedia.</p>'; }

  var cfg = window.SUPABASE_CONFIG, lib = window.supabase;
  if (!cfg || !lib || typeof lib.createClient !== "function") { disabled("Riwayat pick tidak tersedia (Supabase gagal dimuat). Ban & Pick tetap jalan."); return; }
  var client;
  try { client = lib.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
  catch (e) { disabled("Riwayat pick tidak tersedia. Ban & Pick tetap jalan."); return; }

  var BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  function tgl(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear(); }
  function baseLine(h) {
    var b = h.baselineInfo(); if (!b) return "";
    var t = b.updated ? tgl(b.updated) : "";
    return '<p class="ph-base">Data HoK Camp: ' + b.heroes + " hero, " + b.matches.toLocaleString("id-ID") + " match" + (t ? ", diperbarui " + t : "") + ". Dijumlahkan dengan riwayat pick untuk urutan jarang dipakai.</p>";
  }
  function renderList(h) {
    var c = h.counts(), keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a] || nm(a).localeCompare(nm(b)); });
    if (!h.enabled()) { box.innerHTML = '<p class="bp-empty">Masuk dulu untuk menyimpan dan melihat riwayat pick.</p>'; return; }
    if (!keys.length) { box.innerHTML = baseLine(h) + '<p class="bp-empty">Belum ada riwayat. Pencet kartu rekomendasi pick atau tambah hero ke tim kita.</p>'; return; }
    box.innerHTML = baseLine(h) + '<p class="ph-total">Total ' + h.total() + " pick, " + keys.length + " hero</p>" + '<ul class="ph-rows">' + keys.map(function (k) {
      return '<li><span class="ph-name">' + esc(nm(k)) + '</span><span class="ph-n">' + c[k] + 'x</span><button type="button" class="ph-del" data-s="' + esc(k) + '" aria-label="Kurangi satu riwayat ' + esc(nm(k)) + '">&minus;1</button></li>';
    }).join("") + "</ul>";
  }
  var hist = create(client, {
    table: cfg.table,
    onChange: function (h) { renderList(h); rerender(); },
    onError: function (e) { msg("Gagal menyimpan riwayat: " + ((e && e.message) || e)); },
  });
  // Jumlah dipakai = match HoK Camp (data awal) + riwayat pick di situs. Dipakai di kartu ("dipakai Nx") dan tiebreak.
  window.getHeroPickCount = function (slug) { return hist.enabled() ? hist.used(slug) : 0; };
  window.__pickHistory.instance = hist;
  if (BP.hooks) {
    BP.hooks.onAllyAdd = function (slug, source) { hist.record(slug, source); };
    BP.hooks.onAllyRemove = function (slug) { hist.undo(slug); };
    BP.hooks.onReset = function () { hist.newDraft(); };
  }
  box.addEventListener("click", function (ev) {
    var b = ev.target.closest(".ph-del"); if (!b) return;
    b.disabled = true; hist.removeOne(b.getAttribute("data-s"));
  });

  function showUser(user) {
    if (user) {
      formEl.hidden = true; outBtn.hidden = false; whoEl.textContent = "Masuk sebagai " + (user.email || "user");
      hist.load().then(function () { msg(""); }, function (e) { msg("Gagal memuat riwayat: " + ((e && e.message) || e)); });
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
