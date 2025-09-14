/* imagelink3 (70/30固定・モバイル1枚表示)
   - block直下の子<div>群のうち、最後の2つを右カラム（縦2リンク）、
     それ以外を左カラムのカルーセル要素にする
   - デスクトップは一度に3枚表示、モバイル（<=900px）は1枚表示
   - 3秒ごとに1枚進む無限ループ、インジケーター同期
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
  if (items.length < 3) return; // 左カルーセル(>=1) + 右2 が必要

  /* 分割：最後の2つは右、残りは左カルーセル */
  const sideCells = items.slice(-2);
  const carCells  = items.slice(0, -2);
  const N = carCells.length;

  /* 骨組み */
  block.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'il3-row';

  const colLeft = document.createElement('div');
  colLeft.className = 'il3-carousel';

  const viewport = document.createElement('div');
  viewport.className = 'il3-viewport';

  const track = document.createElement('div');
  track.className  = 'il3-track';
  viewport.appendChild(track);

  const indicators = document.createElement('ol');
  indicators.className = 'il3-indicators';
  colLeft.appendChild(viewport);
  colLeft.appendChild(indicators);

  const colRight = document.createElement('div');
  colRight.className = 'il3-side';

  row.appendChild(colLeft);
  row.appendChild(colRight);
  block.appendChild(row);

  /* 左：カード配置 */
  const cards = carCells.map(createCardFromCell);
  cards.forEach((c) => track.appendChild(c));

  /* 無限用クローン（最大可視=3ぶん） */
  const clones = cards.slice(0, 3).map((c) => c.cloneNode(true));
  clones.forEach((cl) => track.appendChild(cl));

  /* 右：最後の2つ */
  sideCells.forEach((cell) => {
    const wrap = document.createElement('div');
    wrap.className = 'il3-side-item';
    const inner = cell.querySelector(':scope > div') || cell;
    wrap.appendChild(inner);
    colRight.appendChild(wrap);
  });

  /* インジケーター */
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

  /* スライド制御 */
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
  function goTo(index, animate = true) {
    setTransition(animate);
    const cardEl = track.firstElementChild;
    const cardW = cardEl ? cardEl.getBoundingClientRect().width : 0;
    const x = -index * cardW;
    track.style.transform = `translateX(${x}px)`;
    updateIndicators(index);
  }
  track.addEventListener('transitionend', () => {
    if (current >= N) {
      /* クローン領域に来たら瞬時に巻き戻す */
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

  /* レイアウト計算：高さとカード幅（70/30比率はCSSが担当） */
  const applyLayout = () => {
    const visible = getVisibleCount();
    const leftW = colLeft.clientWidth;
    const cardW = Math.floor(leftW / visible);

    // カード幅
    qsa(track, '.il3-card').forEach((card) => {
      card.style.width = `${cardW}px`;
      card.style.height = '100%';
    });

    // 高さ計算：サンプル画像の比率から推定（なければ300px）
    const sample = one(track, '.il3-card img');
    let h = 300;
    if (sample && sample.naturalWidth) {
      h = Math.max(120, Math.round(cardW * (sample.naturalHeight / sample.naturalWidth)));
    }
    viewport.style.height = `${h}px`;

    // 右2枚はカルーセル高さを等分（縦ギャップぶんを差し引き）
    const gap = parseInt(getComputedStyle(row).gap || '16', 10) || 16;
    const each = Math.max(1, Math.floor((h - gap) / 2));
    qsa(colRight, '.il3-side-item').forEach((wrap) => {
      wrap.style.height = `${each}px`;
      const pic = one(wrap, 'picture'); if (pic) { pic.style.width = '100%'; pic.style.height = '100%'; }
      const img = one(wrap, 'img');      if (img) { img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; }
    });

    // 現在位置を再適用
    goTo(current, false);
  };

  const onResize = debounce(() => {
    // 表示枚数が変わった場合も cardW を再計算
    applyLayout();
  }, 150);

  // 初期化：画像読み込み後にサイズ確定
  let waits = 2;
  const ready = () => { if (--waits <= 0) { applyLayout(); goTo(0, false); startAuto(); } };
  onceImagesLoaded(block, ready);   // 自身
  onceImagesLoaded(document, ready);/* ページ全体(念のため) */

  // 即時適用（画像未読込でも暫定）
  applyLayout(); goTo(0, false); startAuto();

  window.addEventListener('resize', onResize, { passive: true });
}
