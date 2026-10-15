// Bangun data/pro-builds.js: 5 build pro terbaru per hero dari data pertandingan KPL (pvp.qq.com/matchdata).
// API publik: prod.comp.smoba.qq.com/leaguesite/{matches,match/battles,battle}/open
// Nama/ikon item EN: hokmeta.com/api/items.json (id item = id CN). Ikon arcana: game.gtimg.cn mingwen/{id}.png
// Pakai: node scripts/build-pro-builds.mjs [league_id,...]   (default: liga 2026 terbaru dulu, lalu mundur)
import fs from "fs";
const API = "https://prod.comp.smoba.qq.com/leaguesite";
const PER_HERO = 5, RAW_CAP = 40, MIN_FINISHED = 4;
const CACHE = process.env.PRO_CACHE; // opsional: folder cache detail battle (tidak berubah setelah selesai)
const get = async (u, tries = 3) => {
  const ck = CACHE && u.includes("/battle/open") ? CACHE + "/" + u.split("=").pop() + ".json" : null;
  if (ck && fs.existsSync(ck)) return JSON.parse(fs.readFileSync(ck, "utf8"));
  const j = await get0(u, tries); if (ck) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(ck, JSON.stringify(j)); } return j;
};
const get0 = async (u, tries) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(u, { headers: { Referer: "https://pvp.qq.com/" } }); if (r.ok) return await r.json(); } catch {}
    await new Promise((s) => setTimeout(s, 800 * (i + 1)));
  }
  throw new Error("gagal: " + u);
};
async function pool(list, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]); } })); return out; }

// --- pemetaan hero: id Tencent -> slug repo (dari CSV HoK Camp + hokmeta), hanya slug yang punya heroes/<slug>.html
const slugs = new Set(fs.readdirSync("heroes").filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5)));
const heroMap = {};
for (const l of fs.readFileSync(new URL("./hero-ids.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1)) { const [id, slug] = l.split(","); if (slugs.has(slug)) heroMap[id] = slug; }

// --- item
const items = {}; for (const it of await get("https://hokmeta.com/api/items.json")) items[it.id] = it;
// item CN yang tak ada di global: kalau harganya komponen (< 1500), dipakai sebagai komponen tipe CN-nya
const CNT = { 1: "Attack", 2: "Magic", 3: "Defense", 4: "Movement", 5: "Jungle", 7: null };
const cnItems = {}; try { for (const it of await get0("https://pvp.qq.com/web201605/js/item.json", 3)) cnItems[it.item_id] = it; } catch {}
const BOOTS = new Set(["1421", "1422", "1423", "1424", "1425", "1426"]);
// Item jadi: level 3, atau harga >= 1500, atau sepatu tier 2 (700). Komponen/setengah jadi dibuang.
const finished = (it) => it.level >= 3 || it.gold >= 1500 || BOOTS.has(String(it.id));
const assetItems = new Set(fs.readdirSync("assets/items").map((f) => f.replace(/\.webp$/, "")));
const fileOf = (name) => name.replace(/'/g, "").replace(/ /g, "_");
// --- arcana CN -> EN
const ARC = { "霸者":"Bulwark","传承":"Inheritance","夺萃":"Reaver","繁荣":"Prosperity","纷争":"Conflict","红月":"Red Moon","回声":"Reverberation","祸源":"Calamity","怜悯":"Compassion","轮回":"Reincarnation","梦魇":"Nightmare","冥想":"Meditation","圣人":"Saint","狩猎":"Hunt","兽痕":"Beast Scar","贪婪":"Avarice","调和":"Harmony","无双":"Unparalleled","献祭":"Tribute","心眼":"Mind's Eye","凶兆":"Omen","宿命":"Fate","虚空":"Void","异变":"Mutation","隐匿":"Stealth","鹰眼":"Eagle Eye","长生":"Longevity" };
const leagueJs = await (await fetch("https://pvp.qq.com/m/matchdata/js/league.js")).text();
const ming = {}; for (const m of leagueJs.matchAll(/\{"ming_id":"(\d+)","ming_name":"([^"]+)","ming_level":"(\d)"/g)) ming[m[1]] = m[2];
const assetArc = new Set(fs.readdirSync("assets/arcana").map((f) => f.replace(/\.webp$/, "")));

const POS = { "发育路": "Farm Lane", "对抗路": "Clash Lane", "中路": "Mid Lane", "打野": "Jungle", "游走": "Roam" };
const SPELL = { "闪现": "Flash", "惩击": "Smite", "净化": "Purify", "斩杀": "Execute", "治疗术": "Heal", "狂暴": "Berserk", "眩晕": "Stun", "干扰": "Disrupt", "弱化": "Weaken", "疾跑": "Sprint", "终结": "Execute", "晕眩": "Stun" };
const unknown = { hero: {}, item: {}, arcana: {}, droppedComponents: 0 };
let leagueIds = process.argv[2] ? process.argv[2].split(",") : null;
const leagues = (await get(API + "/leagues/open")).results.sort((a, b) => b.start_time.localeCompare(a.start_time));
if (!leagueIds) leagueIds = leagues.filter((l) => l.start_time >= (process.env.PRO_SINCE || "2025-01-01")).map((l) => l.league_id);
const lname = Object.fromEntries(leagues.map((l) => [l.league_id, l.league_name]));
const builds = {}; let battlesRead = 0;
const full = () => [...new Set(Object.values(heroMap))].every((s) => (raw[s] || []).length >= RAW_CAP);
const raw = {};
for (const lid of leagueIds) {
  if (full()) break;
  const matches = (await get(`${API}/matches/open?league_id=${lid}`)).results.filter((m) => m && m.status === 2).sort((a, b) => b.start_time.localeCompare(a.start_time));
  for (let i = 0; i < matches.length; i += 8) {
    if (full()) break;
    const chunk = matches.slice(i, i + 8);
    const per = await pool(chunk, 8, async (m) => {
      const bs = (await get(`${API}/match/battles/open?match_id=${m.match_id}`)).results.filter((b) => b && b.status === 2).sort((a, b) => b.battle_seq - a.battle_seq);
      const det = await pool(bs, 4, (b) => get(`${API}/battle/open?battle_id=${b.battle_id}`).then((r) => r.data).catch(() => null));
      return det.filter(Boolean).map((d) => ({ m, d }));
    });
    for (const { m, d } of per.flat()) { // urutan sudah terbaru dulu
      battlesRead++;
      for (const p of d.battle_player_list || []) {
        const slug = heroMap[p.hero_id];
        if (!slug) { unknown.hero[p.hero_id] = p.hero_name; continue; }
        const arr = (raw[slug] ||= []); if (arr.length >= RAW_CAP) continue;
        const its = []; let bad = false;
        for (const e of p.BriefEquipList || []) {
          const it = items[e.equip_id];
          if (!it) {
            const cn = cnItems[e.equip_id];
            if (cn && cn.total_price < 1500 && CNT[cn.item_type]) { its.push({ id: String(e.equip_id), name: e.equip_name, type: CNT[cn.item_type], level: 1, gold: cn.total_price }); continue; }
            unknown.item[e.equip_id] = e.equip_name; bad = true; continue; // item jadi CN-only: build dilewati
          }
          its.push(it);
        }
        const cnt = {}; for (const s of String(p.symbol_ids || "").split("+").filter(Boolean)) cnt[s] = (cnt[s] || 0) + 1;
        const arc = Object.entries(cnt).sort((a, b) => a[0][0] - b[0][0] || b[1] - a[1]).map(([id, c]) => {
          const zh = ming[id] || id, en = ARC[zh]; if (!en) unknown.arcana[id] = zh;
          return { id, n: en || zh, c, i: en && assetArc.has(fileOf(en)) ? `../assets/arcana/${fileOf(en)}.webp` : `https://game.gtimg.cn/images/yxzj/img201606/mingwen/${id}.png` };
        });
        const camp = p.camp === 1 ? d.camp1 : d.camp2, opp = p.camp === 1 ? d.camp2 : d.camp1;
        arr.push({
          date: m.start_time.slice(0, 10), league: lname[lid] || lid, stage: m.match_stage_desc || "", game: d.battle_seq,
          team: camp?.team_abbreviation || p.team_name, teamName: p.team_name || camp?.team_name || "", teamIcon: p.team_icon || camp?.team_icon || "", vsIcon: opp?.team_icon || "", vs: opp?.team_abbreviation || "", win: d.win_camp === p.camp,
          player: (p.actual_player_name || p.player_name || "").replace(/^.*\./, ""), pos: POS[p.position_desc] || p.position_desc || "",
          k: p.kill_num, d: p.death_num, a: p.assist_num, mins: Math.round((d.game_duration || 0) / 60000),
          spell: SPELL[p.SummonerAbilityInfo?.summoner_ability_name] || p.SummonerAbilityInfo?.summoner_ability_name || "", raw: its, bad, arcana: arc,
        });
      }
    }
    process.stdout.write(`\r${lid} ${Math.min(i + 8, matches.length)}/${matches.length} battle=${battlesRead}   `);
  }
}

// --- lengkapi build: komponen -> item jadi paling sering dipakai hero ini (tipe sama) di build pro lain
const icon = (it) => assetItems.has(fileOf(it.name)) ? `../assets/items/${fileOf(it.name)}.webp` : it.icon;
let completed = 0, skipped = 0;
for (const [slug, arr] of Object.entries(raw)) {
  const freq = {}; for (const b of arr) for (const it of b.raw) if (finished(it)) freq[it.id] = (freq[it.id] || 0) + 1;
  const ranked = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).map((id) => items[id]);
  const out = (builds[slug] = []), cands = [];
  for (const b of arr) {
    const fin = [], seen = new Set(), comps = [];
    for (const it of b.raw) { if (finished(it)) { if (!seen.has(it.id)) { seen.add(it.id); fin.push(it); } } else comps.push(it); }
    if (b.bad || fin.length < 1 || fin.length > 6) { skipped++; continue; }
    const res = fin.map((it) => ({ id: +it.id, n: it.name, i: icon(it) }));
    let ok = true;
    for (const c of comps) {
      if (res.length >= 6) break;
      const boots = c.type === "Movement";
      const pick = ranked.find((f) => !seen.has(f.id) && (boots ? BOOTS.has(String(f.id)) : f.type === c.type && !BOOTS.has(String(f.id))) && !(boots && res.some((r) => BOOTS.has(String(r.id)))));
      if (!pick) continue; // komponen tanpa kandidat: slot diisi di bawah
      seen.add(pick.id); res.push({ id: +pick.id, n: pick.name, i: icon(pick), predicted: true, from: c.name });
    }
    // slot kosong (snapshot < 6 item): isi item jadi paling sering di build pro hero ini, tanpa duplikat, maks 1 sepatu
    for (const f of ranked) {
      if (res.length >= 6) break;
      if (seen.has(f.id)) continue;
      if (BOOTS.has(String(f.id)) && res.some((r) => BOOTS.has(String(r.id)))) continue;
      seen.add(f.id); res.push({ id: +f.id, n: f.name, i: icon(f), predicted: true, from: "" });
    }
    if (!ok || res.length !== 6) { skipped++; continue; }
    const { raw: _r, bad: _b, ...rest } = b; cands.push({ ...rest, tier: fin.length, items: res });
  }
  // tangga cadangan: >=4 item jadi dulu, lalu 3, 2, 1 (terbaru dulu di tiap tingkat)
  for (const t of [MIN_FINISHED, 3, 2, 1]) for (const c of cands) if (out.length < PER_HERO && (t === MIN_FINISHED ? c.tier >= t : c.tier === t)) out.push(c);
  for (const c of out) completed += c.items.filter((r) => r.predicted).length;
  skipped += cands.length - out.length;
}
const all = [...new Set(Object.values(heroMap))];
const meta = { sumber: "KPL / pvp.qq.com matchdata (prod.comp.smoba.qq.com leaguesite API)", liga: leagueIds.filter((l) => lname[l]).map((l) => lname[l]), diambil: new Date().toISOString().slice(0, 10), battle: battlesRead,
  filter_item: "item jadi = level 3 / harga >= 1500 gold / sepatu tier 2. Komponen diganti item jadi tipe sama yang paling sering dipakai hero ini di build pro lain (predicted:true). Slot kosong (maks 2) diisi item jadi paling sering di build pro hero ini (predicted:true). Prioritas build >=4 item jadi; kalau kurang dari 5 build, turun ke 3, 2, lalu 1 item jadi (field tier). Build dengan item yang sudah tidak ada di daftar item sekarang dilewati.", item_dilengkapi: completed, build_dilewati: skipped,
  hero_5: all.filter((s) => (builds[s] || []).length >= PER_HERO).length, hero_kurang: all.filter((s) => (builds[s] || []).length < PER_HERO).map((s) => `${s}:${(builds[s] || []).length}`),
  hero_tidak_dipetakan: unknown.hero, item_tidak_dikenal: unknown.item, arcana_tanpa_nama_en: unknown.arcana };
fs.writeFileSync("data/pro-builds.js", "// Dibuat oleh scripts/build-pro-builds.mjs. Jangan edit manual.\nwindow.PRO_BUILDS = " + JSON.stringify({ meta, heroes: builds }) + ";\n");
console.log("\n" + JSON.stringify(meta, null, 1));
