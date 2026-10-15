// Bangun data/hokcamp-combos.js dari CSV duo/trio HoK Camp (halaman detail hero, tab Pairings).
// Pakai: node scripts/build-hokcamp-combos.mjs <duo.csv> <trio.csv> [tanggal-ambil]
import fs from "fs";
const [duoCsv, trioCsv, fetched = "2026-10-15"] = process.argv.slice(2);
if (!duoCsv || !trioCsv) { console.error("pakai: node scripts/build-hokcamp-combos.mjs duo.csv trio.csv [tanggal]"); process.exit(1); }
function parse(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const split = (l) => { const out = []; let cur = "", q = false; for (const c of l) { if (c === '"') q = !q; else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}
const pct = (s) => parseFloat(String(s).replace("%", ""));
const unmatched = new Map();
function collect(rows, cols) {
  const best = new Map();
  for (const r of rows) {
    const names = cols.map(([n]) => r[n]), slugs = cols.map(([, s]) => r[s]);
    if (names.some((n) => !n)) continue; // entri cacat dari API (anggota kurang)
    if (slugs.some((s) => !s)) { names.forEach((n, i) => { if (!slugs[i]) unmatched.set(n, (unmatched.get(n) || 0) + 1); }); continue; }
    const v = pct(r.compatibility); if (!isFinite(v)) continue;
    const key = slugs.slice().sort().join("+");
    if (!best.has(key) || v > best.get(key)) best.set(key, v);
  }
  return [...best].map(([k, v]) => ({ h: k.split("+"), v })).sort((a, b) => b.v - a.v);
}
const duo = collect(parse(duoCsv), [["hero", "slug"], ["partner", "partner_slug"]]);
const trio = collect(parse(trioCsv), [["hero", "slug"], ["partner1", "partner1_slug"], ["partner2", "partner2_slug"]]);
const out = {
  meta: {
    sumber: "HoK Camp (camp.honorofkings.com), halaman detail hero > Pairings (API getherodataall: strategyData.combination)",
    metrik: "Compatibility (%), satu-satunya angka yang diberikan; tanpa filter rank/server/periode",
    diambil: fetched,
    jumlah: { duo: duo.length, trio: trio.length },
    dilewati_tidak_ada_di_repo: [...unmatched.keys()].sort(),
  },
  duo, trio,
};
fs.writeFileSync("data/hokcamp-combos.js", "// Dibuat oleh scripts/build-hokcamp-combos.mjs. Jangan edit manual.\nwindow.HOKCAMP_COMBOS = " + JSON.stringify(out, null, 1) + ";\n");
console.log("duo", duo.length, "trio", trio.length, "dilewati", out.meta.dilewati_tidak_ada_di_repo);
