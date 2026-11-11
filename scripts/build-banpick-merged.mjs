// Bangun data/banpick-merged.js (window.BANPICK_DATA) untuk banpick.html: gabungan sumber yang sudah ada di repo.
//   cn  = data/banpick.json          -> HoK CN, 王者营地 (counters, countered_by, duo, trio; role, lane, status build)
//   camp = data/hokcamp-combos.js    -> HoK Camp global, camp.honorofkings.com Pairings (duo, trio; tanpa counter)
//   hs  = data/hokstats-banpick.js   -> hokstats.gg (Strong against / Countered by, Partners)
//   tier = data/hokcamp-tier.js      -> HoK Camp hero hot list (tier S/A/B/C, WR/PR/BR). Jalankan dulu
//                                      scripts/build-camp-tier.mjs. Hero yang tidak ada di hot list = tanpa tier.
//                                      WR/BR untuk tiebreak: angka Camp kalau ada, kalau tidak fallback ke hokstats.
// Tidak ada data baru selain file sumber di atas. Angka index / compatibility dibuang (ya/tidak saja).
// Pakai: node scripts/build-camp-tier.mjs <csv> [tanggal] && node scripts/build-banpick-merged.mjs
import fs from "fs";

const load = (file, key) => { const w = {}; new Function("window", fs.readFileSync(file, "utf8"))(w); return w[key]; };
const CN = JSON.parse(fs.readFileSync("data/banpick.json", "utf8"));
const CAMP = load("data/hokcamp-combos.js", "HOKCAMP_COMBOS");
const HS = load("data/hokstats-banpick.js", "HOKSTATS");
if (!fs.existsSync("data/hokcamp-tier.js")) {
  console.error("Tidak ada data/hokcamp-tier.js. Jalankan dulu: node scripts/build-camp-tier.mjs <csv> [tanggal-update]");
  process.exit(1);
}
const CAMP_TIER = load("data/hokcamp-tier.js", "HOKCAMP_TIER");

// Slug sumber -> slug repo (sama dengan aturan yang sudah dipakai): annette -> anette, zhu-bajie -> ata, shieldun -> dunshan, flowborn-mage -> flowborn.
const ALIAS = { annette: "anette", "zhu-bajie": "ata", shieldun: "dunshan", "flowborn-mage": "flowborn" };
const S = (s) => ALIAS[s] || s;

const heroes = {};
const ensure = (slug) => heroes[slug] || (heroes[slug] = { name: null, role: "", lane: "", src: [] });
const markSrc = (slug, src) => { const h = ensure(slug); if (h.src.indexOf(src) < 0) h.src.push(src); };

// --- info hero: CN dulu (role/lane sudah dirapikan di repo), hokstats sebagai cadangan.
const sel = new Map(CN.selectable.map((s) => [S(s.slug), s]));
for (const [raw, h] of Object.entries(CN.heroes)) {
  const k = S(raw), o = ensure(k);
  Object.assign(o, { name: h.name, role: h.role || "", lane: h.lane || "" });
  if (h.nobuild) o.nobuild = h.nobuild;
  markSrc(k, "cn");
}
for (const [k, s] of sel) { const o = ensure(k); if (!o.name) o.name = s.name; }
for (const [raw, h] of Object.entries(HS.heroes)) {
  const k = S(raw), o = ensure(k);
  if (!o.name) o.name = h.name;
  if (!o.role) o.role = h.role || "";
  if (!o.lane) o.lane = h.lane || "";
  // WR/BR cadangan dari hokstats; tier tidak diambil dari sini (lihat overlay Camp di bawah).
  Object.assign(o, { wr: h.wr ?? null, pr: h.pr ?? null, br: h.br ?? null });
  markSrc(k, "hs");
}
// Tier hanya dari HoK Camp hero hot list. Hero yang tidak ada di list = tanpa tier
// (urut paling belakang saat tiebreak). WR/BR Camp menimpa cadangan hokstats kalau ada.
for (const [raw, t] of Object.entries(CAMP_TIER.tier || {})) {
  const k = S(raw), o = ensure(k);
  o.tier = t.tier || null;
  if (t.wr != null) o.wr = t.wr;
  if (t.pr != null) o.pr = t.pr;
  if (t.br != null) o.br = t.br;
}
// Chicha main Clash dan Farm; data CN cuma menulis Clash Lane (override yang sudah ada di js/banpick*.js lama).
if (heroes.chicha) {
  const p = heroes.chicha.lane.split("/").map((x) => x.trim()).filter(Boolean);
  if (p.indexOf("Farm Lane") < 0) p.unshift("Farm Lane");
  heroes.chicha.lane = p.join("/");
}

// --- relasi. counter: "a>b" (a meng-counter b). partner: "a+b" urut. trio: "a+b+c" urut.
const counters = new Map(), partners = new Map(), trios = new Map();
const add = (map, key, src) => { const v = map.get(key) || []; if (v.indexOf(src) < 0) v.push(src); map.set(key, v); };
const addCounter = (a, b, src) => { a = S(a); b = S(b); if (a !== b) { ensure(a); ensure(b); add(counters, a + ">" + b, src); } };
const addPartner = (a, b, src) => { a = S(a); b = S(b); if (a !== b) { ensure(a); ensure(b); add(partners, [a, b].sort().join("+"), src); } };
const addTrio = (h, src) => { const m = [...new Set(h.map(S))]; if (m.length === 3) { m.forEach(ensure); add(trios, m.sort().join("+"), src); } };

for (const [raw, h] of Object.entries(CN.heroes)) {
  (h.counters || []).forEach((x) => addCounter(raw, x.slug, "cn"));
  (h.countered_by || []).forEach((x) => addCounter(x.slug, raw, "cn"));
  (h.duo || []).forEach((x) => addPartner(raw, x.slug, "cn"));
  (h.trio || []).forEach((t) => addTrio(t.h, "cn"));
}
CAMP.duo.forEach((d) => addPartner(d.h[0], d.h[1], "camp"));
CAMP.trio.forEach((t) => addTrio(t.h, "camp"));
for (const [raw, h] of Object.entries(HS.heroes)) {
  (h.strong || []).forEach((x) => addCounter(raw, x, "hs"));
  (h.weak || []).forEach((x) => addCounter(x, raw, "hs"));
  (h.partners || []).forEach((x) => addPartner(raw, x, "hs"));
}
// sumber relasi juga menandai hero (hero yang cuma muncul di HoK Camp tetap tercatat)
for (const [k, src] of partners) k.split("+").forEach((s) => src.forEach((x) => markSrc(s, x)));
for (const [k, src] of trios) k.split("+").forEach((s) => src.forEach((x) => markSrc(s, x)));

const out = {};
for (const k of Object.keys(heroes).sort()) {
  const h = heroes[k];
  out[k] = {
    name: h.name || k, role: h.role, lane: h.lane, page: fs.existsSync("heroes/" + k + ".html"),
    ...(h.nobuild ? { nobuild: h.nobuild } : {}),
    tier: h.tier ?? null, wr: h.wr ?? null, br: h.br ?? null, src: h.src.sort(),
    counters: {}, partners: {},
  };
}
for (const [key, src] of counters) { const [a, b] = key.split(">"); out[a].counters[b] = src.sort(); }
for (const [key, src] of partners) { const [a, b] = key.split("+"); out[a].partners[b] = src.sort(); out[b].partners[a] = src.sort(); }
const trioList = [...trios].map(([key, src]) => ({ h: key.split("+"), src: src.sort() })).sort((x, y) => x.h.join().localeCompare(y.h.join()));
const selectable = Object.keys(out).map((k) => ({ slug: k, name: out[k].name })).sort((a, b) => a.name.localeCompare(b.name));

// --- hitung per sumber dan tumpang tindih
function tally(map) {
  const r = { total: map.size, per_sumber: {}, kombinasi: {} };
  for (const src of map.values()) {
    src.forEach((s) => (r.per_sumber[s] = (r.per_sumber[s] || 0) + 1));
    const c = src.slice().sort().join("+"); r.kombinasi[c] = (r.kombinasi[c] || 0) + 1;
  }
  return r;
}
const meta = {
  dibuat_oleh: "scripts/build-banpick-merged.mjs",
  sumber: {
    cn: "HoK CN (王者营地): data/banpick.json, " + (CN.meta && CN.meta.catatan ? CN.meta.catatan : ""),
    camp: "HoK Camp global: data/hokcamp-combos.js, " + CAMP.meta.sumber + ", diambil " + CAMP.meta.diambil,
    hs: "hokstats.gg: data/hokstats-banpick.js, diambil " + String(HS.meta.diambil).slice(0, 10) + " (relasi; WR/BR cadangan kalau hero tidak ada di hot list)",
    camp_tier: "HoK Camp hero hot list: data/hokcamp-tier.js, " + (CAMP_TIER.meta && CAMP_TIER.meta.sumber ? CAMP_TIER.meta.sumber : "") + ", filter " + (CAMP_TIER.meta && CAMP_TIER.meta.filter ? CAMP_TIER.meta.filter : "") + ", diperbarui " + (CAMP_TIER.meta && CAMP_TIER.meta.diperbarui ? CAMP_TIER.meta.diperbarui : "(tidak diisi)"),
  },
  alias: ALIAS,
  camp_tier: CAMP_TIER.meta || {},
  hero: Object.keys(out).length,
  hero_per_sumber: ["cn", "camp", "hs"].reduce((o, s) => ((o[s] = Object.values(out).filter((h) => h.src.indexOf(s) >= 0).length), o), {}),
  counter: tally(counters), partner: tally(partners), trio: tally(trios),
};
const payload = { meta, selectable, heroes: out, trios: trioList };
fs.writeFileSync("data/banpick-merged.js", "// Dibuat oleh scripts/build-banpick-merged.mjs. Jangan edit manual.\nwindow.BANPICK_DATA = " + JSON.stringify(payload) + ";\n");
console.log(JSON.stringify(meta, null, 1));
