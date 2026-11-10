// Ubah CSV hero HoK Camp (Battle Record > Heroes) jadi data awal pemakaian hero (tabel hero_usage_baseline).
// Pakai:
//   node scripts/import-camp-baseline.mjs <file.csv> [--json out.json] [--email user@contoh.com] [--sql out.sql]
// CSV: header hero,hero_power,matches,win_rate (nama hero global, mis. "Flowborn (Marksman)", "Lady Sun").
// --json  simpan hasil mapping { updated, source, heroes: { slug: matches }, unmapped }.
// --email cetak SQL upsert untuk user itu (user_id dicari dari auth.users lewat email). Jalankan di SQL Editor
//         Supabase / connector (butuh akses service, bukan anon key). Tidak ada yang dijalankan dari skrip ini.
// Nama yang tidak ketemu di data/banpick-merged.js dilaporkan dan dilewati, tidak ditebak.
import fs from "fs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const csvPath = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!csvPath) { console.error("Pakai: node scripts/import-camp-baseline.mjs <file.csv> [--json out.json] [--email x] [--sql out.sql]"); process.exit(2); }

// Nama lama / nama lain -> slug repo (sama dengan alias di scripts/build-banpick-merged.mjs).
const ALIAS = { "zhu bajie": "ata", annette: "anette", shieldun: "dunshan", "ying zheng": "garuda", "niu mo": "lapulapu", "hai yue": "haya", "sikong zhen": "devara" };

const w = {}; new Function("window", fs.readFileSync("data/banpick-merged.js", "utf8"))(w);
const H = w.BANPICK_DATA.heroes;
const key = (s) => String(s).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
// Nama sama di dua slug: pakai slug yang punya halaman build, lalu yang punya lebih banyak sumber.
const byName = {};
for (const [slug, h] of Object.entries(H)) {
  const k = key(h.name), cur = byName[k];
  const better = !cur || (h.page && !H[cur].page) || (!!h.page === !!H[cur].page && (h.src || []).length > (H[cur].src || []).length);
  if (better) byName[k] = slug;
}

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { cells.push(cur); cur = ""; } else cur += c;
    }
    cells.push(cur); rows.push(cells);
  }
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

function mapRows(rows) {
  const heroes = {}, unmapped = [], bad = [];
  for (const r of rows) {
    const k = key(r.hero), slug = byName[k] || (ALIAS[k] && H[ALIAS[k]] ? ALIAS[k] : null);
    const n = Number(String(r.matches).replace(/[,.\s]/g, ""));
    if (!slug) { unmapped.push(r.hero); continue; }
    if (!Number.isInteger(n) || n < 0) { bad.push(r.hero + "=" + r.matches); continue; }
    if (slug in heroes) { bad.push(r.hero + " (slug " + slug + " dobel)"); continue; }
    heroes[slug] = n;
  }
  return { heroes, unmapped, bad };
}

const sqlStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";
function upsertSql(email, heroes, source = "hokcamp") {
  const vals = Object.entries(heroes).sort().map(([s, n]) => `  (${sqlStr(s)}, ${n})`).join(",\n");
  return `-- Data awal HoK Camp untuk ${email}: ${Object.keys(heroes).length} hero.
with u as (select id from auth.users where lower(email) = lower(${sqlStr(email)})),
v (hero_slug, matches) as (values
${vals}
)
insert into public.hero_usage_baseline (user_id, hero_slug, matches, source, updated_at)
select u.id, v.hero_slug, v.matches, ${sqlStr(source)}, now() from u cross join v
on conflict (user_id, hero_slug) do update set matches = excluded.matches, source = excluded.source, updated_at = excluded.updated_at;
-- Cek: harus ${Object.keys(heroes).length} baris. Kalau 0, user belum terdaftar / belum konfirmasi email.
select count(*) as baris, sum(matches) as total_match from public.hero_usage_baseline
where user_id = (select id from auth.users where lower(email) = lower(${sqlStr(email)}));
`;
}

const { heroes, unmapped, bad } = mapRows(parseCsv(fs.readFileSync(csvPath, "utf8")));
const total = Object.values(heroes).reduce((a, b) => a + b, 0);
console.error(`${Object.keys(heroes).length} hero terpetakan, total ${total} match.`);
if (unmapped.length) console.error("Tidak ketemu (dilewati): " + unmapped.join(", "));
if (bad.length) console.error("Baris bermasalah (dilewati): " + bad.join(", "));
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ updated: new Date().toISOString(), source: "hokcamp", csv: csvPath, heroes, unmapped, bad }, null, 1) + "\n");
const email = opt("--email");
if (email) { const sql = upsertSql(email, heroes); if (opt("--sql")) fs.writeFileSync(opt("--sql"), sql); else process.stdout.write(sql); }
