// Bangun data/hokstats-banpick.js dari hokstats.gg (server internasional, region 608) untuk banpick-hokstats.html.
// Sumber (HTML statis + JSON publik, tanpa login; robots.txt hokstats mengizinkan "/" untuk User-agent *):
//   https://hokstats.gg/counters/            -> lane, tier editorial, "Strong against" / "Countered by" (tanpa angka)
//   https://hokstats.gg/official-popularity/ -> role, band popularitas, win/pick/ban rate ranked (HOK Camp)
//   https://hokstats.gg/search-index.json    -> nama CN (alias)
//   https://hokstats.gg/heroes/<slug>/       -> "Partners" di kotak Matchups (daftar ya/tidak, tanpa angka)
// Halaman hero diambil satu per satu dengan jeda (DELAY ms). Pakai: node scripts/build-hokstats.mjs
import fs from "fs";
const BASE = "https://hokstats.gg";
const DELAY = 600;
const UA = { "User-Agent": "Mozilla/5.0 (hok-builds; build-hokstats.mjs)", Accept: "text/html,application/json" };
async function get(path, json) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(BASE + path, { headers: UA }); if (r.ok) return json ? await r.json() : await r.text(); } catch {}
    await new Promise((s) => setTimeout(s, 1000 * (i + 1)));
  }
  throw new Error("gagal: " + path);
}
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (s) => unesc(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// --- slug hokstats -> slug repo. Hanya beda ejaan yang pasti hero yang sama; selain itu slug hokstats dipakai apa adanya.
const ALIAS = { annette: "anette" };
const bp = JSON.parse(fs.readFileSync("data/banpick.json", "utf8"));
const repoSlugs = new Set(Object.keys(bp.heroes).concat(bp.selectable.map((s) => s.slug)));
const toSlug = (s) => ALIAS[s] || s;

const [counters, pop, index] = await Promise.all([get("/counters/"), get("/official-popularity/"), get("/search-index.json", true)]);
const LANE = { "clash lane": "Clash Lane", jungle: "Jungle", mid: "Mid Lane", farm: "Farm Lane", roam: "Roam" };
const heroes = {}, laneUnknown = [];

// counters: <article ... data-counter-hero="slug" data-roles='["Jungle"]'> ... Strong against ... Countered by ...
for (const blk of counters.split(/<article\b[^>]*?data-counter-hero="/).slice(1)) {
  const hs = blk.slice(0, blk.indexOf('"'));
  const body = blk.slice(0, blk.indexOf("</article>"));
  const roles = JSON.parse(unesc((body.match(/data-roles="([^"]*)"/) || [, "[]"])[1]));
  const lanes = roles.map((l) => LANE[String(l).toLowerCase()] || (laneUnknown.push(hs + ":" + l), null)).filter(Boolean);
  const name = text((body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [, hs])[1]);
  const tier = (body.match(/Tier ([A-Z+]+)</) || [, null])[1];
  const sect = (label) => { const i = body.indexOf(">" + label + "</h3>"); if (i < 0) return []; const ul = body.slice(i, body.indexOf("</ul>", i)); return [...ul.matchAll(/href="\/heroes\/([^/"]+)\/"/g)].map((m) => toSlug(m[1])); };
  heroes[toSlug(hs)] = { hs, name, lanes, tier, strong: sect("Strong against"), weak: sect("Countered by") };
}

// official popularity: <section data-popularity-band-tier="C"> ... <tr data-popularity-hero-id="slug"> role, win/pick/ban
let band = null; const popMissing = [];
for (const part of pop.split(/(?=<section data-popularity-band data-popularity-band-tier=")|(?=<tr data-popularity-entry data-popularity-hero-id=")/)) {
  const b = part.match(/^<section data-popularity-band data-popularity-band-tier="([^"]+)"/); if (b) { band = b[1]; continue; }
  const m = part.match(/^<tr data-popularity-entry data-popularity-hero-id="([^"]+)"/); if (!m) continue;
  const row = part.slice(0, part.indexOf("</tr>"));
  const metric = (k) => { const x = row.match(new RegExp('data-official-metric="' + k + '"[\\s\\S]*?data-official-metric-value[^>]*>([^<]*)<')); const v = x ? parseFloat(x[1]) : NaN; return isFinite(v) ? v : null; };
  const role = (row.match(/text-text-secondary"[^>]*>([^<]+)<\/span><\/span><\/a>/) || [, ""])[1].trim();
  const h = heroes[toSlug(m[1])]; if (!h) { popMissing.push(m[1]); continue; }
  Object.assign(h, { role, band, wr: metric("win_rate"), pr: metric("pick_rate"), br: metric("ban_rate") });
}
// partners: <p ...>Partners</p><div ...><a href="/heroes/slug/">...</a>...</div>
const partnerMissing = [];
for (const h of Object.values(heroes)) {
  const page = await get("/heroes/" + h.hs + "/");
  const i = page.indexOf(">Partners</p>");
  if (i < 0) { h.partners = []; partnerMissing.push(h.hs); }
  else { const end = page.indexOf("</a></div>", i); h.partners = [...page.slice(i, end < 0 ? i : end + 4).matchAll(/href="\/heroes\/([^/"]+)\/"/g)].map((m) => toSlug(m[1])); }
  await new Promise((r) => setTimeout(r, DELAY));
}
const cn = {}; for (const x of index) if (x.c === "hero") cn[toSlug(x.i)] = (x.a || [])[0] || null;
const popText = text(pop.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""));
const srcDate = (popText.match(/Source date ([A-Z][a-z]{2} \d{1,2}, \d{4})/) || [, null])[1];
const checked = (popText.match(/Last checked: ([A-Z][a-z]{2} \d{1,2}, \d{4})/) || [, null])[1];

const out = {}, notInRepo = [], badLinks = [];
for (const [slug, h] of Object.entries(heroes).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
  if (!repoSlugs.has(slug)) notInRepo.push(slug);
  for (const s of h.strong.concat(h.weak, h.partners)) if (!heroes[s]) badLinks.push(slug + "->" + s);
  out[slug] = { name: h.name, cn: cn[slug] || null, role: h.role || "", lane: h.lanes.join("/"), tier: h.tier, band: h.band || null, wr: h.wr ?? null, pr: h.pr ?? null, br: h.br ?? null,
    page: fs.existsSync("heroes/" + slug + ".html"), strong: h.strong, weak: h.weak, partners: h.partners };
}
const meta = {
  sumber: "hokstats.gg (server internasional, region 608)",
  url: { counters: BASE + "/counters/", popularitas: BASE + "/official-popularity/", index: BASE + "/search-index.json" },
  diambil: new Date().toISOString(),
  counter_sumber: "hokstats.gg/counters (menurut llms.txt hokstats: data internasional hokbuild.com); daftar ya/tidak, tanpa angka",
  popularitas_sumber: "HOK Camp official popularity via hokstats.gg: ranked, region 608, segment 255 (semua rank)" + (srcDate ? ", tanggal sumber " + srcDate : "") + (checked ? ", dicek hokstats " + checked : ""),
  tier: "tier editorial hokstats (bukan statistik pertandingan)",
  sinergi: "Partners dari halaman hero hokstats.gg/heroes/<slug>/ (daftar ya/tidak, tanpa angka; tidak ada trio)",
  url_partner: BASE + "/heroes/<slug>/",
  alias: ALIAS, hero: Object.keys(out).length,
  relasi_counter: Object.values(out).reduce((n, h) => n + h.strong.length + h.weak.length, 0),
  relasi_partner: Object.values(out).reduce((n, h) => n + h.partners.length, 0),
  pasangan_partner: (() => { const p = new Set(); for (const [k, h] of Object.entries(out)) for (const x of h.partners) p.add([k, x].sort().join("+")); return p.size; })(),
  tanpa_partner: partnerMissing,
  tidak_ada_di_repo: notInRepo, link_tidak_dikenal: badLinks, lane_tidak_dikenal: laneUnknown, popularitas_tanpa_hero: popMissing,
};
fs.writeFileSync("data/hokstats-banpick.js", "// Dibuat oleh scripts/build-hokstats.mjs. Jangan edit manual.\nwindow.HOKSTATS = " + JSON.stringify({ meta, heroes: out }) + ";\n");
console.log("hero", meta.hero, "| relasi", meta.relasi_counter, "| partner", meta.relasi_partner, "entri /", meta.pasangan_partner, "pasangan | tanpa bagian Partners:", partnerMissing.join(", ") || "-", "| tidak ada di repo:", notInRepo.join(", ") || "-", "| link tak dikenal:", badLinks.join(", ") || "-", "| lane tak dikenal:", laneUnknown.join(", ") || "-", "| pop tanpa hero:", popMissing.join(", ") || "-");
console.log("tanpa role:", Object.keys(out).filter((k) => !out[k].role).join(", ") || "-", "| tanpa wr:", Object.keys(out).filter((k) => out[k].wr == null).join(", ") || "-", "| tanpa tier:", Object.keys(out).filter((k) => !out[k].tier).join(", ") || "-", "| popularitas:", meta.popularitas_sumber);