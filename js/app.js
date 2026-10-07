(function () {
  const q = document.getElementById('cari-hero');
  const grid = document.getElementById('hero-grid');
  const countEl = document.getElementById('hasil-count');
  const empty = document.getElementById('kosong');
  const filterBtns = document.querySelectorAll('[data-filter]');
  if (!q || !grid) return;

  let laneFilter = 'all';

  function apply() {
    const term = (q.value || '').trim().toLowerCase();
    const cards = grid.querySelectorAll('.hero-card');
    let shown = 0;
    cards.forEach(function (card) {
      const name = (card.dataset.name || '').toLowerCase();
      const slug = (card.dataset.slug || '').toLowerCase();
      const lane = card.dataset.lane || '';
      const matchText = !term || name.indexOf(term) !== -1 || slug.indexOf(term) !== -1;
      const matchLane = laneFilter === 'all' || lane === laneFilter;
      const ok = matchText && matchLane;
      card.classList.toggle('hidden', !ok);
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = shown + ' hero ditampilkan';
    if (empty) empty.classList.toggle('hidden', shown > 0);
  }

  q.addEventListener('input', apply);
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      laneFilter = btn.dataset.filter;
      apply();
    });
  });
  apply();
})();
