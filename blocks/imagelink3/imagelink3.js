/* imagelink3: 3枚ピッタリ（SPは1枚）を保証。
   - 幅はCSSの割合で厳密分割（サブピクセルOK）
   - JSは「可視枚数 × ビューポート幅」でオフセット計算のみ
   - 3秒オート / 無限ループ
*/
function qsa(el, sel) { return Array.from(el.querySelectorAll(sel)); }
function one(el, sel) { return el.querySelector(sel); }
function onceImagesLoaded(root, cb) {
  const imgs = qsa(root, 'img');
  const pending = imgs.filter((i) => !i.complete).length;
  if (pending === 0) { cb(); return; }
  let left = pending;
  const done = () => { if (--left <= 0) cb(); };
  imgs.forEach((img) => {
    if (!img.complete) {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });
}
function debounce(fn, ms = 150) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function getVisibleCount() {
  return window.matchMedia('(max-width: 900px)').matches ? 1 : 3;
}
function createCardFromCell(cell) {
  const card = document.createElement('div');
  card.className = 'il3-card';
  const inner = cell.querySelector(':scope > div') || cell;
  card.appendChild(inner);
  return card;
}

export default function decorate(block) {
  const items = qsa(block, ':scope > div').filter((d) => d.children.length > 0);
  if (items.length < 3) return;

  // 末尾2つは右側リンク、残りはカルーセル
  const sideCells = items.slice(-2);
  const carCells  = items.slice(0, -2);
  const N = carCells.length;

  // DOM 骨組み
  block.innerHTML = '';
  const row = document.createElement('div'); row.className = 'il3-row';
  const colLeft  = document.createElement('div'); colLeft.className  = 'il3-carousel';
  const viewport = document.createElement('div'); viewport.className = 'il3-viewport';
  const track    = document.createElement('div'); track.className    = 'il3-track';
  viewport.appendChild(track);
  const indicators = document.createElement('ol'); indicators.className = 'il3-indicators';
  colLeft.appendChild(viewport); colLeft.appendChild(indicators);

  const colRight = document.createElement('div'); colRight.className = 'il3-side';
  row.appendChild(colLeft); row.appendChild(colRight);
  block.appendChild(row);

  // カルーセルカード
  const cards = carCells.map(createCardFromCell);
  cards.forEach((c) => track.appendChild(c));
  // 無限用に先頭から最大3枚クローン（SP=1でも問題なし）
  cards.slice(0, 3).forEach((c) => track.appendChild(c.cloneNode(true)));

  // 右の2リンク
  sideCells.forEach((cell) => {
    const wrap = document.createElement('div');
    wrap.className = 'il3-side-item';
    const inner = cell.querySelector(':scope > div') || cell;
    wrap.appendChild(inner);
    colRight.appendChild(wrap);
  });

  // インジケーター
  indicators.innerHTML = '';
  for (let i = 0; i < N; i += 1) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Show ${i + 1} of ${N}`);
    btn.addEventListener('click', () => {
      stopAuto();
      current = i;
      goTo(current, true);
      startAuto();
    });
    li.appendChild(btn);
    indicators.appendChild(li);
  }

  // スライド制御
  const DURATION = 400;
  let current = 0;
  let timer = null;

  function setTransition(on) {
    track.style.transition = on ? `transform ${DURATION}ms ease` : 'none';
  }
  function updateIndicators(idx) {
    const active = (idx % N + N) % N;
    qsa(indicators, 'button').forEach((b, i) => {
      if (i === active) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  // 可視枚数と高さ・右2枚の高さを計算
  function applyLayout() {
    const visible = getVisibleCount();
    // CSS変数にも反映（flex-basis: 100% / var(--il3-visible)）
    block.style.setProperty('--il3-visible', String(visible));

    // スライド1枚の幅は「ビューポート幅 / 可視枚数」
    const cardW = viewport.clientWidth / visible || 1;

    // 高さ：画像比率が取れればそれを優先。無ければ16:9。
    const sample = one(track, '.il3-card img');
    let h = Math.round(cardW * 9 / 16);
    if (sample && sample.naturalWidth > 0) {
      h = Math.max(120, Math.round(cardW * (sample.naturalHeight / sample.naturalWidth)));
    }
    viewport.style.height = `${h}px`;

    // 右2枚はカルーセル高さを2分割（間のgap分を差し引く）
    const gap = parseInt(getComputedStyle(row).gap || '16', 10) || 16;
    const each = Math.max(1, Math.floor((h - gap) / 2));
    qsa(colRight, '.il3-side-item').forEach((wrap) => {
      wrap.style.height = `${each}px`;
      const pic = one(wrap, 'picture'); if (pic) { pic.style.width = '100%'; pic.style.height = '100%'; }
      const img = one(wrap, 'img');      if (img) { img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; }
    });

    // 現在位置を再適用（サブピクセルでもピタッと止まる）
    goTo(current, false);
  }

  function slideSizePx() {
    const visible = getVisibleCount();
    return (viewport.clientWidth / visible) || 1;
  }

  function goTo(index, animate = true) {
    setTransition(animate);
    const x = -index * slideSizePx();
    track.style.transform = `translateX(${x}px)`;
    updateIndicators(index);
  }

  // 無限ループ：末尾クローンから先頭へスナップ
  track.addEventListener('transitionend', () => {
    if (current >= N) {
      setTransition(false);
      current = 0;
      goTo(current, false);
      void track.offsetWidth; // reflow
      setTransition(true);
    }
  });

  function stepNext() { current += 1; goTo(current, true); }
  function startAuto() { if (!timer) timer = setInterval(stepNext, 3000); }
  function stopAuto()  { if (timer) { clearInterval(timer); timer = null; } }

  block.addEventListener('mouseenter', stopAuto);
  block.addEventListener('mouseleave', startAuto);
  block.addEventListener('focusin', stopAuto);
  block.addEventListener('focusout', startAuto);

  const onResize = debounce(() => { applyLayout(); }, 150);

  // 初期化（画像読み込み後に最終レイアウト）＋フォールバック即時描画
  onceImagesLoaded(block, () => { applyLayout(); startAuto(); });
  applyLayout(); startAuto();

  window.addEventListener('resize', onResize, { passive: true });
}
