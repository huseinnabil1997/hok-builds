// Ubah CSV hero hot list HoK Camp jadi data/hokcamp-tier.js (window.HOKCAMP_TIER).
// Sumber: https://camp.honorofkings.com/h5/app/index.html#/hero-hot-list
// Filter yang dipakai: All Tiers + All roles (kolom lane = All).
//
// Pakai:
//   node scripts/build-camp-tier.mjs <file.csv> [tanggal-update]
//
// tanggal-update: teks tanggal di halaman ("Update: 11/6/2026" = 6 Nov 2026).
//   Disimpan apa adanya di meta.diperbarui dan ditampilkan di Ban & Pick.
//
// Update mingguan (tiap Senin, setelah halaman hot list diperbarui):
//   1. Buka https://camp.honorofkings.com/h5/app/index.html#/hero-hot-list
//      Pastikan filter default All Tiers + All. Catat tanggal Update di halaman
//      (format M/D/YYYY = D Mon YYYY, contoh 11/6/2026 = 6 Nov 2026).
//   2. Simpan tabel jadi CSV dengan kolom lane,hero,tier,wr,pr,br.
//      Jangan commit CSV mentah ke repo.
//   3. Dari root repo, satu perintah:
//        node scripts/build-camp-tier.mjs path/ke/hotlist.csv "6 Nov 2026" && \
//        node scripts/build-banpick-merged.mjs && \
//        node scripts/test-banpick.mjs
//   4. Kalau tes lulus: bump ?v= data/banpick-merged.js di index.html dan
//      banpick.html, lalu commit data/hokcamp-tier.js, data/banpick-merged.js,
//      dan HTML yang berubah.
//
// Nama hero dicocokkan ke slug repo (data/banpick-merged.js, data/banpick.json,
// data/hokstats-banpick.js, data/hero-icons.js, scripts/hero-ids.csv) plus alias
// yang sudah dipakai di repo. Nama yang tidak ketemu tidak ditebak: dicatat di
// meta.tidak_cocok dan skrip keluar dengan kode 1.
import fs from "fs";

const csvPath = process.argv[2];
const tanggal = (process.argv[3] || "").trim();
if (!csvPath || csvPath.startsWith("-")) {
  console.error("Pakai: node scripts/build-camp-tier.mjs <file.csv> [tanggal-update]");
  process.exit(2);
}

// Nama lama / nama lain -> slug repo (sama dengan import-camp-baseline.mjs dan
// build-banpick-merged.mjs). Flowborn (Mage) juga diarahkan ke slug `flowborn`.
const ALIAS = {
  annette: "anette",
  "zhu bajie": "ata",
  "zhu-bajie": "ata",
  shieldun: "dunshan",
  "ying zheng": "garuda",
  "niu mo": "lapulapu",
  "hai yue": "haya",
  "sikong zhen": "devara",
  "flowborn (mage)": "flowborn",
  "flowborn-mage": "flowborn",
};

const key = (s) => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const slugify = (s) => key(s).replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const slugs = new Set();
const byName = {};
const addSlug = (s) => { if (s) slugs.add(s); };
const addName = (name, slug) => {
  if (!name || !slug) return;
  addSlug(slug);
  const k = key(name);
  if (!byName[k]) byName[k] = slug;
};

function loadWindow(file, k) {
  if (!fs.existsSync(file)) return null;
  const w = {};
  new Function("window", fs.readFileSync(file, "utf8"))(w);
  return k ? w[k] : w;
}

const merged = loadWindow("data/banpick-merged.js", "BANPICK_DATA");
if (merged && merged.heroes) {
  for (const [slug, h] of Object.entries(merged.heroes)) addName(h.name, slug);
}
const icons = loadWindow("data/hero-icons.js", "HERO_ICONS");
if (icons) Object.keys(icons).forEach(addSlug);
if (fs.existsSync("scripts/hero-ids.csv")) {
  for (const line of fs.readFileSync("scripts/hero-ids.csv", "utf8").trim().split(/\n/).slice(1)) {
    const slug = line.split(",")[1];
    addSlug((slug || "").trim());
  }
}
if (fs.existsSync("data/banpick.json")) {
  const CN = JSON.parse(fs.readFileSync("data/banpick.json", "utf8"));
  for (const [slug, h] of Object.entries(CN.heroes || {})) addName(h.name, slug);
  (CN.selectable || []).forEach((s) => addName(s.name, s.slug));
}
const hs = loadWindow("data/hokstats-banpick.js", "HOKSTATS");
if (hs && hs.heroes) {
  for (const [slug, h] of Object.entries(hs.heroes)) addName(h.name, slug);
}

function mapName(name) {
  const k = key(name);
  if (byName[k] && slugs.has(byName[k])) return byName[k];
  if (ALIAS[k] && slugs.has(ALIAS[k])) return ALIAS[k];
  const sl = slugify(name);
  if (slugs.has(sl)) return sl;
  return null;
}

function parseCsv(text) {
  const rows = [];
  text = text.replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

function pct(s) {
  if (s == null || s === "") return null;
  const n = Number(String(s).replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

if (!fs.existsSync(csvPath)) {
  console.error("File CSV tidak ada: " + csvPath);
  process.exit(2);
}

let rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
if (!rows.length) {
  console.error("CSV kosong atau tanpa baris data.");
  process.exit(1);
}
if (!("hero" in rows[0]) || !("tier" in rows[0])) {
  console.error("CSV harus punya kolom hero dan tier (lane,hero,tier,wr,pr,br).");
  process.exit(1);
}

// Filter default halaman: All Tiers + All roles (kolom lane = All).
if ("lane" in rows[0]) {
  const all = rows.filter((r) => !r.lane || /^all$/i.test(r.lane));
  if (!all.length) {
    console.error("Tidak ada baris lane=All. Pakai filter default All Tiers + All di halaman hot list.");
    process.exit(1);
  }
  rows = all;
}

const TIERS = new Set(["S", "A", "B", "C"]);
const tier = {};
const tidak_cocok = [];
const bad = [];
const seen = {};

for (const r of rows) {
  const name = r.hero;
  if (!name) { bad.push("(tanpa nama)"); continue; }
  const slug = mapName(name);
  if (!slug) { tidak_cocok.push(name); continue; }
  const t = String(r.tier || "").toUpperCase();
  if (!TIERS.has(t)) { bad.push(name + " tier=" + r.tier); continue; }
  const wr = pct(r.wr), pr = pct(r.pr), br = pct(r.br);
  if (r.wr && wr == null) { bad.push(name + " wr=" + r.wr); continue; }
  if (r.pr && pr == null) { bad.push(name + " pr=" + r.pr); continue; }
  if (r.br && br == null) { bad.push(name + " br=" + r.br); continue; }
  if (seen[slug]) { bad.push(name + " (slug " + slug + " dobel dengan " + seen[slug] + ")"); continue; }
  seen[slug] = name;
  tier[slug] = { tier: t, wr, pr, br };
}

const meta = {
  sumber: "HoK Camp hero hot list (camp.honorofkings.com/#/hero-hot-list)",
  filter: "All Tiers + All roles",
  diperbarui: tanggal || null,
  jumlah: Object.keys(tier).length,
  tidak_cocok,
};
if (bad.length) meta.baris_bermasalah = bad;

const payload = { meta, tier: Object.fromEntries(Object.keys(tier).sort().map((k) => [k, tier[k]])) };
fs.writeFileSync(
  "data/hokcamp-tier.js",
  "// Dibuat oleh scripts/build-camp-tier.mjs dari CSV hero hot list HoK Camp. Jangan edit manual.\n" +
    "window.HOKCAMP_TIER = " + JSON.stringify(payload, null, 1) + ";\n"
);

console.log(JSON.stringify(meta, null, 1));
if (tidak_cocok.length) console.error("Tidak ketemu (tidak ditebak): " + tidak_cocok.join(", "));
if (bad.length) console.error("Baris bermasalah: " + bad.join(", "));
if (!tanggal) console.error("Peringatan: tanggal-update tidak diisi; meta.diperbarui = null.");
if (tidak_cocok.length || bad.length) process.exit(1);
