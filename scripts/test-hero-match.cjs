global.window = {};
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/../data/banpick.js", "utf8"));
eval(fs.readFileSync(__dirname + "/../data/hero-aliases.js", "utf8"));
eval(fs.readFileSync(__dirname + "/../js/hero-match.js", "utf8"));
// Jalankan: node scripts/test-hero-match.cjs
const m = window.HeroMatch.create(window.BANPICK_DATA.selectable, window.HERO_ALIASES);
const cases = [["lee bye","Li Bai"],["zi long","Zilong"],["lu ban seven","Luban No.7"],["luban number 7","Luban No.7"],["dia chan","Diaochan"],["hou yi","Hou Yi"],["ho yi","Hou Yi"],["marco pollo","Marco Polo"],["kong ming","Kongming"],["angella","Angela"],["xyzzy",null],["the",null]];
let fail = 0;
for (const [q, exp] of cases) { const r = m.match(q); const got = r ? r.name : null; const ok = got === exp; if (!ok) fail++; console.log((ok ? "OK  " : "FAIL") + " match(" + JSON.stringify(q) + ") -> " + got); }
const many = m.matchMany("ban lee bye sama zi long terus lu ban seven").map(h => h.name);
const okMany = JSON.stringify(many) === JSON.stringify(["Li Bai","Zilong","Luban No.7"]); if (!okMany) fail++;
console.log((okMany ? "OK  " : "FAIL") + " matchMany -> " + JSON.stringify(many));
const s1 = m.search("l").length === 0, s2 = m.search("li").slice(0,3).map(h=>h.name);
if (!s1) fail++; console.log((s1?"OK  ":"FAIL")+" search('l') kosong; search('li') -> " + JSON.stringify(s2));
console.log("search('zhao') ->", m.search("zhao").map(h=>h.name));
process.exit(fail ? 1 : 0);
