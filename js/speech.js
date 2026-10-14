(function () {
  "use strict";
  // Input suara opsional. Mesin STT: Web Speech API bawaan browser (bukan Whisper),
  // jadi tidak ada initial_prompt. Sebagai gantinya: daftar hero dikirim sebagai
  // SpeechGrammarList (kalau browser mendukung) dan hasil transkrip di-fuzzy-match
  // ke daftar hero + alias (js/hero-match.js, data/hero-aliases.js).
  var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  var inputs = document.querySelectorAll("input[data-speech]");
  if (!Ctor || !inputs.length || !window.HeroMatch) return;

  function heroList() {
    var data = window.BANPICK_DATA;
    if (data && data.selectable) return data.selectable;
    return Array.prototype.map.call(document.querySelectorAll("[data-name]"), function (el) {
      return { name: el.getAttribute("data-name"), slug: el.getAttribute("data-slug") || window.HeroMatch.fold(el.getAttribute("data-name")) };
    });
  }
  var HEROES = heroList();
  var matcher = window.HeroMatch.create(HEROES, window.HERO_ALIASES);

  // iOS Safari meminta izin mic ulang di setiap rec.start(), jadi jangan auto-restart di iOS.
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = !isIOS;
  rec.maxAlternatives = 5;
  var Grammar = window.SpeechGrammarList || window.webkitSpeechGrammarList;
  if (Grammar) {
    try {
      var g = new Grammar();
      var names = HEROES.map(function (h) { return h.name.replace(/[^A-Za-z0-9 ]+/g, " ").trim(); }).filter(Boolean);
      g.addFromString("#JSGF V1.0; grammar heroes; public <hero> = " + names.join(" | ") + " ;", 1);
      rec.grammars = g;
    } catch (err) { /* grammar tidak didukung, abaikan */ }
  }

  var token = 0;
  var live = 0;
  var activeInput = null;
  var activeBtn = null;
  var added = {};

  function clearButton() {
    if (!activeBtn) return;
    activeBtn.classList.remove("on");
    activeBtn.textContent = "Suara";
    activeBtn.setAttribute("aria-pressed", "false");
    activeBtn = null;
    activeInput = null;
  }

  rec.onstart = function () { live = token; };
  rec.onend = function () {
    if (live !== token || !activeInput) return;
    if (isIOS) { clearButton(); return; }
    setTimeout(function () {
      if (live !== token || !activeInput) return;
      try { rec.start(); } catch (err) { clearButton(); }
    }, 150);
  };
  rec.onerror = function (event) {
    if (live !== token) return;
    if (event.error === "aborted") return;
    if (event.error === "no-speech" && !isIOS) return;
    clearButton();
  };
  function commit(name) {
    var key = window.HeroMatch.fold(name);
    if (added[key]) return;
    added[key] = true;
    activeInput.value = name;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }
  function namesOf(text) { return matcher.matchMany(text).map(function (h) { return h.name; }); }
  // Pilih alternatif transkrip yang paling banyak cocok dengan nama hero.
  function bestFinal(result) {
    var best = { text: result[0].transcript, names: namesOf(result[0].transcript) };
    for (var k = 1; k < result.length; k++) {
      var names = namesOf(result[k].transcript);
      if (names.length > best.names.length) best = { text: result[k].transcript, names: names };
    }
    return best;
  }

  rec.onresult = function (event) {
    if (!activeInput) return;
    var finalText = "";
    var finalNames = [];
    var interim = "";
    for (var i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        var pick = bestFinal(event.results[i]);
        finalText += " " + pick.text;
        finalNames = finalNames.concat(pick.names);
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    finalText = finalText.trim();
    interim = interim.trim();
    var picking = activeInput.getAttribute("data-speech") === "pick";
    if (picking) {
      finalNames.forEach(commit);
      activeInput.value = interim;
      if (interim) activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    // Interim hanya untuk tampilan; pencocokan nama pakai hasil final saja.
    if (interim) {
      activeInput.value = (finalText + " " + interim).trim();
    } else {
      activeInput.value = finalNames.length === 1 ? finalNames[0] : finalText;
    }
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
  };

  function listen(btn, input) {
    var mine = ++token;
    clearButton();
    activeBtn = btn;
    activeInput = input;
    added = {};
    btn.classList.add("on");
    btn.textContent = "Stop";
    btn.setAttribute("aria-pressed", "true");
    input.focus();
    try { rec.abort(); } catch (err) { /* belum mulai */ }
    setTimeout(function () {
      if (token !== mine) return;
      try {
        rec.start();
      } catch (err) {
        clearButton();
      }
    }, 120);
  }

  Array.prototype.forEach.call(inputs, function (input) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mic-btn";
    btn.textContent = "Suara";
    btn.title = "Opsional: ucapkan nama hero. Hasil dicocokkan ke daftar hero.";
    btn.setAttribute("aria-label", "Ucapkan nama hero (opsional)");
    btn.setAttribute("aria-pressed", "false");
    input.insertAdjacentElement("afterend", btn);
    btn.addEventListener("click", function () {
      if (activeBtn === btn) {
        token += 1;
        try { rec.abort(); } catch (err) { /* sudah berhenti */ }
        clearButton();
        return;
      }
      listen(btn, input);
    });
  });
})();
