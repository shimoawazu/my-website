/* imagelink3
   - 直下の子 <div> 群のうち最後の2つを右カラム（縦2リンク）、
     それ以外を左カラムの3枚同時表示カルーセルにする
   - 幅は同階層の .imagelink の左右実寸（左最大幅・右最小幅）に完全一致
   - カラム間ギャップも .imagelink に合わせる
   - 高さはカルーセル画像に合わせ、右2枚はその 1/2 ずつ
   - 3秒ごとに1画像スライド、無限ループ、インジケーター同期
*/

function qsa(el, sel) { return Array.from(el.querySelectorAll(sel)); }
function one(el, sel) { return el.querySelector(sel); }

function onceImagesLoaded(root, cb) {
  const imgs = qsa(root, 'img');
  const wait = imgs.filter((i) => !i.complete).length;
  if (wait === 0) { cb(); return; }
  let left = wait;
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

/* .imagelink から実寸を厳密採寸
   - 左カラム = 子要素の中で最も幅が大きいもの
   - 右カラム = 子要素の中で最も幅が小さいもの（右カラムのカード）
   - gap = 右カラム左端 - 左カラム右端
*/
function measureFromImagelink(parent, row) {
  const imagelink = one(parent, ':scope > .imagelink');
  const containerRect = imagelink?.getBoundingClientRect()
    || row.getBoundingClientRect();

  const children = imagelink ? qsa(imagelink, ':scope > div') : [];
  const rects = children.map((c) => c.getBoundingClientRect())
    .filter((r) => r.width > 0);

  let leftRect = null;
  let rightRect = null;

  if (rects.length >= 2) {
    // 最大幅 = 左、最小幅 = 右 とみなす
    leftRect = rects.reduce((a, b) => (a.width >= b.width ? a : b));
    rightRect = rects.reduce((a, b) => (a.width <= b.width ? a : b));
  } else {
    // フォールバック：3:1 の比率仮定
    const totalW = Math.round(containerRect.width || parent.clientWidth || 1200);
    return {
      totalW,
      leftW: Math.round(totalW * 0.66),
      rightW: Math.round(totalW * 0.34),
      gap: 16,
    };
  }

  const totalW = Math.round(containerRect.width);
  const leftW  = Math.round(leftRect.width);
  const rightW = Math.round(rightRect.width);

  // 列間ギャップを幾何的に算出
  const leftRightEdge = leftRect.left + leftRect.width;
  const gap = Math.max(0, Math.round(rightRect.left - leftRightEdge));

  return { totalW, leftW, rightW, gap };
}

/* 子<div> からカードを生成 */
function createCardFromCell(cell) {
  const card = document.createElement('div');
  card.className = 'il3-card';
  const inner = cell.querySelector(':scope > div') || cell;
  card.appendChild(inner);
  return card;
}

export default function decorate(block) {
  const parent = block.parentElement;
  if (!parent) return;

  // アイテム収集
  const items = qsa(block, ':scope > div').filter((d) => d.children.length > 0);
  if (items.length < 3) return; // 左カルーセル(>=1) + 右2

  // 分割
  const sideCells = items.slice(-2);
  const carCells  = items.slice(0, -2);
  const N = carCells.length;

  // 骨格
  block.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'il3-row';
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'flex-start',
    marginLeft: 'auto',
    marginRight: 'auto',
  });

  const colLeft = document.createElement('div');
  colLeft.className = 'il3-carousel';

  const viewport = document.createElement('div');
  viewport.className = 'il3-viewport';

  const track = document.createElement('div');
  track.className = 'il3-track';
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

  // 左カード
  const cards = carCells.map(createCardFromCell);
  cards.forEach((c) => track.appendChild(c));

  // 無限用クローン（表示数=3）
  const visible = Math.min(3, N);
  const clones = cards.slice(0, visible).map((c) => c.cloneNode(true));
  clones.forEach((cl) => track.appendChild(cl));

  // 右：最後の2つ
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

  const DURATION = 400;
  let current = 0;
  let timer = null;
  let measuredGap = 16;

  function setTransition(on) {
    track.style.transition = on ? `transform ${DURATION}ms ease` : 'none';
  }

  function goTo(index, animate = true) {
    setTransition(animate);
    const cardWpx = track.firstElementChild?.getBoundingClientRect().width || 0;
    const offset = -index * cardWpx;
    track.style.transform = `translateX(${offset}px)`;
    const active = (index % N + N) % N;
    qsa(indicators, 'button').forEach((b, i) => {
      if (i === active) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  track.addEventListener('transitionend', () => {
    if (current >= N) {
      setTransition(false);
      current = 0;
      goTo(current, false);
      void track.offsetWidth;
      setTransition(true);
    }
  });

  function stepNext() {
    current += 1;        // 1画像ずつ
    goTo(current, true);
  }
  function startAuto() {
    if (timer) return;
    timer = setInterval(stepNext, 3000);
  }
  function stopAuto() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  block.addEventListener('mouseenter', stopAuto);
  block.addEventListener('mouseleave', startAuto);
  block.addEventListener('focusin', stopAuto);
  block.addEventListener('focusout', startAuto);

  // レイアウト適用（幅を imagelink に厳密一致）
  const applyLayout = () => {
    const { totalW, leftW, rightW, gap } = measureFromImagelink(parent, row);
    measuredGap = gap;

    // 行幅と列間ギャップ
    Object.assign(row.style, {
      width: `${totalW}px`,
      maxWidth: `${totalW}px`,
      gap: `${gap}px`,
    });

    // 左右幅をピクセルで一致させる
    Object.assign(colLeft.style, {
      flex: '0 0 auto',
      width: `${leftW}px`,
      maxWidth: `${leftW}px`,
      boxSizing: 'border-box',
      display: 'block',
    });
    Object.assign(colRight.style, {
      flex: '0 0 auto',
      width: `${rightW}px`,
      maxWidth: `${rightW}px`,
      boxSizing: 'border-box',
      display: 'block',
      gap: `${gap}px`,   // 右カラムの縦隙間も合わせる（好みに応じて固定でもOK）
    });

    // カード幅（3枚並び）
    const cardW = Math.floor(leftW / 3);
    cards.concat(clones).forEach((card) => {
      card.style.width = `${cardW}px`;
      card.style.height = '100%';
    });

    // 高さ算出
    const sampleImg = one(track, '.il3-card img');
    let cardH = 300;
    if (sampleImg?.naturalWidth) {
      cardH = Math.round(cardW * (sampleImg.naturalHeight / sampleImg.naturalWidth));
      cardH = Math.max(120, cardH);
    }
    viewport.style.height = `${cardH}px`;

    // 右2枚：高さ半分
    const each = Math.max(1, Math.floor((cardH - gap) / 2));
    qsa(colRight, '.il3-side-item').forEach((wrap) => {
      Object.assign(wrap.style, {
        height: `${each}px`,
        width: '100%',
      });
      const pic = one(wrap, 'picture');
      if (pic) Object.assign(pic.style, { height: '100%', width: '100%', display: 'block' });
      const img = one(wrap, 'img');
      if (img) Object.assign(img.style, { height: '100%', width: '100%', objectFit: 'cover' });
    });

    // 位置リセット
    goTo(current, false);
  };

  const recalc = () => applyLayout();
  const onResize = debounce(recalc, 150);

  // 画像読み込み後に厳密採寸
  let pending = 2;
  const done = () => { if (--pending <= 0) { recalc(); goTo(0, false); startAuto(); } };
  onceImagesLoaded(parent, done); // imagelink 側の実寸確定
  onceImagesLoaded(block, done);  // 自身の画像確定

  // 即時も一度当てる
  recalc();
  goTo(0, false);
  startAuto();

  window.addEventListener('resize', onResize, { passive: true });
}
