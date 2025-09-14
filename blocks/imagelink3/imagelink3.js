/* imagelink3
   - ブロック直下の子 <div> を画像アイテムとして扱う
   - 最後の2アイテムは右カラム（縦2リンク）
   - それ以外を左カラムの3枚同時表示カルーセルにする
   - 幅は同階層の .imagelink（上段）の左右実寸に合わせる
   - 高さはカルーセル画像の高さに合わせ、右2枚は半分ずつに分配
   - 3秒ごとに1画像ずつスライド、無限ループ、インジケーターも同期
*/

function qsa(el, sel) { return Array.from(el.querySelectorAll(sel)); }
function one(el, sel) { return el.querySelector(sel); }

function onceImagesLoaded(root, cb) {
  const imgs = qsa(root, 'img');
  const waiting = imgs.filter((i) => !i.complete).length;
  if (waiting === 0) { cb(); return; }
  let left = waiting;
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

/* 上段 .imagelink から左右カラムの実寸を推定 */
function measureFromImagelink(parent, row) {
  const imagelink = one(parent, ':scope > .imagelink');
  const ilRect = imagelink?.getBoundingClientRect();
  const totalW = Math.round(ilRect?.width || row.getBoundingClientRect().width || parent.clientWidth || 1200);

  // 右幅の参照（imagelink の2番目の子divがあればそれ、なければ最後）
  const rightProbe = imagelink?.querySelector(':scope > div:nth-child(2)') || imagelink?.querySelector(':scope > div:last-child');
  let rightW = Math.round(rightProbe?.getBoundingClientRect().width || totalW * 0.33);
  if (rightW >= totalW) rightW = Math.floor(totalW / 3);

  const gap = 16;
  const leftW = Math.max(200, totalW - rightW - gap);
  return { totalW, leftW, rightW, gap };
}

/* 子<div> からカード要素を生成 */
function createCardFromCell(cell) {
  const card = document.createElement('div');
  card.className = 'il3-card';
  // 著者HTMLの中身を移動（:scope > div > a/picture/img の形が多い）
  const inner = cell.querySelector(':scope > div') || cell;
  card.appendChild(inner);
  return card;
}

export default function decorate(block) {
  const parent = block.parentElement;
  if (!parent) return;

  // 元アイテム収集
  const items = qsa(block, ':scope > div').filter((d) => d.children.length > 0);
  if (items.length < 3) return; // カルーセル(>=1) + 右2が必要

  // 分割：最後の2つを右、残りを左カルーセル
  const sideCells = items.slice(-2);
  const carCells = items.slice(0, -2);
  const N = carCells.length;

  // 既存内容クリアして骨格を作る
  block.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'il3-row';
  // インラインで横並び強制（テーマの全幅スタイルに勝つ）
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
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

  // 左：カードを構築（N枚）
  const cards = carCells.map(createCardFromCell);
  cards.forEach((c) => track.appendChild(c));

  // 無限用クローン（表示数=3ぶん）
  const visible = Math.min(3, N);
  const clones = cards.slice(0, visible).map((c) => c.cloneNode(true));
  clones.forEach((cl) => track.appendChild(cl));

  // 右：最後の2つを縦並び
  sideCells.forEach((cell) => {
    const wrap = document.createElement('div');
    wrap.className = 'il3-side-item';
    // cell の中身を移動
    const inner = cell.querySelector(':scope > div') || cell;
    wrap.appendChild(inner);
    colRight.appendChild(wrap);
  });

  // 寸法計算と適用
  const GAP = 16;
  const applyLayout = () => {
    const { totalW, leftW, rightW } = measureFromImagelink(parent, row);

    // 行の横幅 = 上段 imagelink と合わせる
    Object.assign(row.style, {
      width: `${totalW}px`,
      maxWidth: `${totalW}px`,
    });

    // 左右の幅をインラインで固定
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
    });

    // カード幅（3枚並び）
    const cardW = Math.floor(leftW / 3);
    cards.concat(clones).forEach((card) => {
      card.style.width = `${cardW}px`;
      card.style.height = '100%';
    });

    // 高さ算出：最初の画像の自然比から推定（読み込み済み前提）
    const sampleImg = one(track, '.il3-card img');
    let cardH = 300;
    if (sampleImg?.naturalWidth) {
      cardH = Math.round(cardW * (sampleImg.naturalHeight / sampleImg.naturalWidth));
      cardH = Math.max(120, cardH);
    }
    viewport.style.height = `${cardH}px`;

    // 右2枚：高さ半分ずつ
    const each = Math.max(1, Math.floor((cardH - GAP) / 2));
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

    // トラックの初期位置再適用
    goTo(current, false);
  };

  // インジケーター作成（1画像=1ドット）
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

  // 遷移制御
  const DURATION = 400;
  let current = 0; // 先頭
  let timer = null;

  function setTransition(on) {
    track.style.transition = on ? `transform ${DURATION}ms ease` : 'none';
  }

  function goTo(index, animate = true) {
    setTransition(animate);
    const cardWpx = track.firstElementChild?.getBoundingClientRect().width || 0;
    const offset = -index * cardWpx;
    track.style.transform = `translateX(${offset}px)`;
    // インジケーター
    const active = (index % N + N) % N;
    qsa(indicators, 'button').forEach((b, i) => {
      if (i === active) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  // 無限ループ用の巻き戻し
  track.addEventListener('transitionend', () => {
    if (current >= N) {
      // クローン領域に入ったら本体0へ瞬間移動
      setTransition(false);
      current = 0;
      goTo(current, false);
      // リフローしてアニメを復活させる
      void track.offsetWidth; // reflow
      setTransition(true);
    }
  });

  function stepNext() {
    current += 1;         // 1画像ずつ
    goTo(current, true);  // クローン領域まで遷移
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

  // ホバー/フォーカスで一時停止
  block.addEventListener('mouseenter', stopAuto);
  block.addEventListener('mouseleave', startAuto);
  block.addEventListener('focusin', stopAuto);
  block.addEventListener('focusout', startAuto);

  // 初期レイアウト：画像ロード後に厳密計測
  const recalc = () => applyLayout();
  const onResize = debounce(recalc, 150);

  const waitTargets = [parent, block];
  let pending = waitTargets.length;
  const done = () => { if (--pending <= 0) { recalc(); goTo(0, false); startAuto(); } };
  waitTargets.forEach((t) => onceImagesLoaded(t, done));

  // すぐ一回（とれた寸法で先に当てる）
  recalc();
  goTo(0, false);
  startAuto();

  window.addEventListener('resize', onResize, { passive: true });
}
