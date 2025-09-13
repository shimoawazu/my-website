/**
 * carouselmini
 * - ブロック内の行（div）から最後の2行を「画像リンク」列へ、残りを「スライド」へ変換
 * - カルーセルは最後の2行を除いたスライドのみで自動再生（3秒）、無限ループ
 * - 幅は imagelink の左（大）/右（小）の実幅に同期（ResizeObserver）
 * - 高さは左スライドで「実際に見えている画像の高さ」を取得し、右列に同期
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ===== imagelink 近傍の列幅を取得 ===== */
function findImagelinkNear(block) {
  // 近傍の兄弟方向に走査 → 全体
  const pick = (node) => node?.classList?.contains('imagelink') ? node : node?.querySelector?.('.imagelink');
  let n = block.previousElementSibling;
  while (n) { const r = pick(n); if (r) return r; n = n.previousElementSibling; }
  n = block.nextElementSibling;
  while (n) { const r = pick(n); if (r) return r; n = n.nextElementSibling; }
  return q('.imagelink');
}

function measureColumnsFromImagelink(root) {
  if (!root) return { left: 0, right: 0 };
  // 左 = 最初の子、右 = 最後の子（右列の1枚分の実幅とみなす）
  const leftCol = root.querySelector(':scope > div:first-child') || root.firstElementChild;
  const rightAny = root.querySelector(':scope > div:last-child') || root.lastElementChild;
  const left = Math.round(leftCol?.getBoundingClientRect().width || 0);
  const right = Math.round(rightAny?.getBoundingClientRect().width || 0);
  return { left, right };
}

/* ===== “可視中”のスライド内画像を特定 ===== */
function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
}
function currentVisibleImg(leftRoot) {
  // 現在表示中スライドの img を拾う
  const img = leftRoot.querySelector('.carouselmini-slide--active img') ||
              leftRoot.querySelector('.carouselmini-slide picture > img') ||
              leftRoot.querySelector('.carouselmini-slide img');
  return img && isVisible(img) ? img : img; // 候補があれば返す
}

/* ===== 行を Slide / Link に正規化 ===== */
function makeSlideFromRow(row) {
  const slide = document.createElement('div');
  slide.className = 'carouselmini-slide';
  const pic = row.querySelector('picture') || row.querySelector('img');
  if (pic) slide.appendChild(pic);
  return slide;
}

function makeLinkFromRow(row) {
  const linkWrap = document.createElement('div');
  linkWrap.className = 'carouselmini-link';
  const aSrc = row.querySelector('a[href]');
  const pic = row.querySelector('picture') || row.querySelector('img');
  const a = document.createElement('a');
  a.href = aSrc ? aSrc.getAttribute('href') : '#';
  const label = aSrc?.getAttribute('aria-label') || aSrc?.textContent?.trim();
  if (label) a.setAttribute('aria-label', label);
  if (pic) a.appendChild(pic);
  linkWrap.appendChild(a);
  return linkWrap;
}

function perfTweakImages(root) {
  qa('img', root).forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });
  qa('source[srcset], img[src]', root).forEach((el) => {
    const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
    const v = el.getAttribute(attr);
    if (v && v.includes('format=webply')) el.setAttribute(attr, v.replace(/format=webply/g, 'format=webp'));
  });
}

/* ===== スライダー（無限ループ：クローン方式） ===== */
function buildInfiniteTrack(track, slides) {
  // 先頭末尾にクローンを追加
  const first = slides[0].cloneNode(true);
  const last  = slides[slides.length - 1].cloneNode(true);
  track.appendChild(first);                           // 末尾クローン（先頭）
  track.insertBefore(last, track.firstChild);         // 先頭クローン（末尾）
  return { headClone: last, tailClone: first };
}

function setActiveSlideState(leftRoot, indexReal, total) {
  // indexReal: 0..total-1（実スライド番号）
  qa('.carouselmini-slide', leftRoot).forEach((s) => s.classList.remove('carouselmini-slide--active'));
  const slidesOnly = qa('.carouselmini-track > .carouselmini-slide', leftRoot)
    .filter((_, i, arr) => i !== 0 && i !== arr.length - 1); // クローン除外
  const active = slidesOnly[indexReal];
  if (active) active.classList.add('carouselmini-slide--active');

  // インジケーター
  qa('.carouselmini-indicators button', leftRoot).forEach((b, i) => {
    b.setAttribute('aria-current', i === indexReal ? 'true' : 'false');
  });
}

function startAutoplay(ctx, intervalMs = 3000) {
  const { leftRoot } = ctx;
  const stop = () => { if (ctx.timer) clearInterval(ctx.timer); ctx.timer = null; };
  const go = () => {
    stop();
    ctx.timer = setInterval(() => ctx.goto(ctx.index + 1), intervalMs);
  };
  leftRoot.addEventListener('mouseenter', stop);
  leftRoot.addEventListener('focusin', stop);
  leftRoot.addEventListener('mouseleave', go);
  leftRoot.addEventListener('focusout', go);
  go();
  ctx.stop = stop;
  ctx.go = go;
}

/* ===== メイン ===== */
export default function decorate(block) {
  const rows = qa(':scope > div', block);
  if (rows.length === 0) return;

  // 分割：最後の2行をリンク、残りをスライド
  const linkCount = Math.min(2, rows.length);
  const linkRows = rows.slice(-linkCount);
  const slideRows = rows.slice(0, rows.length - linkCount);

  // ベース構造
  const pair = document.createElement('div');
  pair.className = 'carouselmini-pair';

  const leftRoot = document.createElement('div');
  leftRoot.className = 'carouselmini-left';
  const viewport = document.createElement('div');
  viewport.className = 'carouselmini-viewport';
  const track = document.createElement('div');
  track.className = 'carouselmini-track';
  viewport.appendChild(track);
  leftRoot.appendChild(viewport);

  const indicators = document.createElement('ol');
  indicators.className = 'carouselmini-indicators';
  leftRoot.appendChild(indicators);

  const rightRoot = document.createElement('div');
  rightRoot.className = 'carouselmini-right';

  pair.appendChild(leftRoot);
  pair.appendChild(rightRoot);

  // 既存の行を取り外してからペアを入れる
  rows.forEach((r) => r.remove());
  block.appendChild(pair);

  // スライド生成（最後の2枚を除く）
  const slides = slideRows.map((r) => makeSlideFromRow(r));
  slides.forEach((s) => track.appendChild(s));

  // リンク生成（最後の2枚）
  const links = linkRows.map((r) => makeLinkFromRow(r));
  links.forEach((l) => rightRoot.appendChild(l));

  // 画像の軽微最適化
  perfTweakImages(block);

  // スライドが1枚以下ならカルーセルせず終了（インジケータ非表示）
  if (slides.length <= 1) {
    indicators.style.display = 'none';
  }

  // 無限ループ準備（クローン追加）
  let headClone, tailClone;
  if (slides.length >= 1) {
    const clones = buildInfiniteTrack(track, slides);
    headClone = clones.headClone; // 先頭側にある「末尾クローン」
    tailClone = clones.tailClone; // 末尾側にある「先頭クローン」
  }

  // インジケーター
  for (let i = 0; i < slides.length; i += 1) {
    const liBtn = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Show slide ${i + 1}`);
    btn.addEventListener('click', () => ctx.goto(i));
    liBtn.appendChild(btn);
    indicators.appendChild(liBtn);
  }

  // ステート
  const ctx = {
    block,
    leftRoot,
    viewport,
    track,
    slides,
    total: slides.length,
    index: 0, // 実スライドのインデックス（0..total-1）
    widthPx: 0,
    moving: false,
    goto: (toIndex) => {
      if (ctx.total === 0) return;
      const dir = toIndex > ctx.index ? 1 : -1;
      const targetReal = ((toIndex % ctx.total) + ctx.total) % ctx.total; // 0..total-1
      ctx.index = targetReal;

      // 表示位置（クローンを含むトラック上の実インデックス）= real+1
      const trackIndex = targetReal + 1;
      ctx.moving = true;
      ctx.track.style.transition = 'transform 400ms ease';
      ctx.track.style.transform = `translateX(-${trackIndex * 100}%)`;
      setActiveSlideState(leftRoot, ctx.index, ctx.total);
    },
  };

  // 初期位置：クローン分 1枚分左へ（= 最初の実スライド）
  if (slides.length >= 1) {
    ctx.track.style.transform = 'translateX(-100%)';
    setActiveSlideState(leftRoot, ctx.index, ctx.total);
  }

  // 無限ループ調整（transitionendでクローン越えを即座に巻き戻し）
  ctx.track.addEventListener('transitionend', () => {
    if (!ctx.moving || ctx.total === 0) return;
    ctx.moving = false;

    const matrices = getComputedStyle(ctx.track).transform;
    // 現在の可視スライドを推定（% ベースなので index で判断）
    // クローン端の時に巻き戻し
    // 左端（先頭クローン表示中）に来た場合
    const atHeadClone = ctx.index === ctx.total - 1 && headClone && isVisible(headClone);
    // 右端（末尾クローン表示中）に来た場合
    const atTailClone = ctx.index === 0 && tailClone && isVisible(tailClone);

    if (atHeadClone) {
      // 本当の最後の実スライド位置へジャンプ（transition無効）
      ctx.track.style.transition = 'none';
      ctx.track.style.transform = `translateX(-${ctx.total * 100}%)`;
      // 強制再描画
      void ctx.track.offsetHeight; // eslint-disable-line no-unused-expressions
      ctx.track.style.transition = 'transform 400ms ease';
    } else if (atTailClone) {
      ctx.track.style.transition = 'none';
      ctx.track.style.transform = 'translateX(-100%)';
      void ctx.track.offsetHeight;
      ctx.track.style.transition = 'transform 400ms ease';
    }
  });

  // 自動再生（3秒）
  if (slides.length >= 2) {
    startAutoplay(ctx, 3000);
  }

  /* ==== 幅・高さの同期 ==== */
  const imagelink = findImagelinkNear(block);

  const applyWidths = () => {
    // imagelink から幅を拾う（無ければ親幅から比率計算）
    let { left, right } = measureColumnsFromImagelink(imagelink);
    const wrapW = block.getBoundingClientRect().width || window.innerWidth;

    if (!left && !right) {
      left = Math.round(wrapW * 0.65);
      right = Math.round(wrapW * 0.35);
    } else if (!left && right) {
      left = Math.max(280, Math.min(1200, wrapW - right - 12));
    } else if (left && !right) {
      right = Math.max(200, Math.min(600, Math.round(left * 0.5)));
    }
    block.style.setProperty('--cm-left-w', `${left}px`);
    block.style.setProperty('--cm-right-w', `${right}px`);
  };

  const applyHeight = () => {
    const img = currentVisibleImg(leftRoot);
    const h = Math.round((img?.getBoundingClientRect().height) || viewport.getBoundingClientRect().height || 0);
    if (h > 0) block.style.setProperty('--cm-height', `${h}px`);
  };

  // 初回適用
  applyWidths();
  // viewport の高さは画像読み込み後で決まるので、load/resize/observerで追従
  applyHeight();

  // ResizeObserver で imagelink/左ビュー/画像を監視
  const roTargets = [imagelink, leftRoot, viewport].filter(Boolean);
  const ro = new ResizeObserver(() => {
    applyWidths();
    applyHeight();
  });
  roTargets.forEach((t) => ro.observe(t));

  // imagelink 内の左右カラムが別要素であればそれぞれも監視（精度UP）
  if (imagelink) {
    const leftCol = imagelink.querySelector(':scope > div:first-child');
    const rightAny = imagelink.querySelector(':scope > div:last-child');
    if (leftCol) ro.observe(leftCol);
    if (rightAny) ro.observe(rightAny);
  }

  // 画像ロード後に高さを反映
  const imgNow = currentVisibleImg(leftRoot);
  if (imgNow && !imgNow.complete) {
    imgNow.addEventListener('load', applyHeight, { once: true });
  }
  qa('img', viewport).forEach((im) => {
    if (!im.complete) im.addEventListener('load', applyHeight, { once: true });
  });

  window.addEventListener('resize', () => {
    applyWidths();
    applyHeight();
  });
}
