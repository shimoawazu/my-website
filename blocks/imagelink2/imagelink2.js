/**
 * imagelink2
 * 目的:
 *  - 近傍の carousel2（無ければ carousel / carouselmini）を検出
 *  - 両者を .imagelink2-pair ラッパーへ入れて横並びに（左:carousel2 / 右:imagelink2）
 *  - 高さ: carousel の見た目の高さに同期（ResizeObserver）
 *  - 列幅: 近傍の imagelink 右カラム幅、なければ carousel 幅の 35% を基準に算出
 *  - コンテンツ: オーサリング2行 -> <ul><li> に変換（画像リンク2枚）
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ===== 近傍 carousel ブロックの検出（前方→後方→全体） ===== */
function findCarouselBlockNear(block) {
  const candidates = ['.carousel2', '.carousel', '.carouselmini'];
  // 前方の兄弟から探索
  let node = block.previousElementSibling;
  while (node) {
    for (const sel of candidates) {
      const cand = node.matches?.(sel) ? node : node.querySelector?.(sel);
      if (cand) return cand;
    }
    node = node.previousElementSibling;
  }
  // 後方
  node = block.nextElementSibling;
  while (node) {
    for (const sel of candidates) {
      const cand = node.matches?.(sel) ? node : node.querySelector?.(sel);
      if (cand) return cand;
    }
    node = node.nextElementSibling;
  }
  // 全体から
  for (const sel of candidates) {
    const cand = q(sel);
    if (cand) return cand;
  }
  return null;
}

/* ===== carousel 側の「高さ代表値」を取るノード ===== */
function findCarouselFrame(carousel) {
  if (!carousel) return null;
  // よくある候補から順に
  return (
    carousel.querySelector('.carousel2-frame') ||
    carousel.querySelector('.carousel-slide-image') ||
    carousel.querySelector('.carousel-slides-container') ||
    carousel.querySelector('.carousel-slides') ||
    carousel.querySelector('img') ||
    carousel
  );
}

/* ===== 近傍の imagelink 右カラム（幅参照用） ===== */
function findImagelinkRightNear(refNode) {
  if (!refNode) return null;
  // 直近祖先の中や兄弟から探す
  let host = refNode;
  for (let i = 0; i < 3 && host; i += 1) {
    const right =
      host.querySelector?.('.imagelink .imagelink-right') ||
      host.querySelector?.('.block.imagelink .imagelink-right') ||
      host.querySelector?.('.imagelink > div:last-child');
    if (right) return right;
    host = host.parentElement;
  }
  // 全体から最初のもの
  return (
    q('.imagelink .imagelink-right') ||
    q('.block.imagelink .imagelink-right') ||
    q('.imagelink > div:last-child')
  );
}

/* ===== row -> li アイテム化 ===== */
function normalizeRowToItem(row) {
  const item = document.createElement('li');
  item.className = 'imagelink2-item';

  const link = row.querySelector('a[href]');
  const pic  = row.querySelector('picture') || row.querySelector('img');

  if (link) {
    const a = document.createElement('a');
    a.href = link.getAttribute('href');
    const label = link.getAttribute('aria-label') || link.textContent?.trim() || '';
    if (label) a.setAttribute('aria-label', label);
    item.append(a);
    if (pic) a.appendChild(pic);
  } else if (pic) {
    const a = document.createElement('a');
    a.href = '#';
    a.appendChild(pic);
    item.append(a);
  }
  return item;
}

/* ===== 横並びラッパー生成（idempotent） ===== */
function ensurePairWrapper(carousel, imagelink2) {
  // 既に親がラッパーならそのまま返す
  if (imagelink2.parentElement && imagelink2.parentElement.classList.contains('imagelink2-pair')) {
    const wrap = imagelink2.parentElement;
    // carousel が入っていなければ先頭へ
    if (carousel && carousel.parentElement !== wrap) {
      wrap.insertBefore(carousel, wrap.firstChild);
    }
    return wrap;
  }
  // 新規ラッパーを carousel の直前に挿入して2要素を内包
  const wrapper = document.createElement('div');
  wrapper.className = 'imagelink2-pair';
  if (carousel && carousel.parentNode) {
    carousel.parentNode.insertBefore(wrapper, carousel);
    wrapper.appendChild(carousel);
    wrapper.appendChild(imagelink2);
  } else if (imagelink2.parentNode) {
    // 最悪、imagelink2 の位置に置いてから carousel を先頭に
    const parent = imagelink2.parentNode;
    parent.insertBefore(wrapper, imagelink2);
    wrapper.appendChild(carousel || document.createComment('no-carousel'));
    wrapper.appendChild(imagelink2);
  }
  return wrapper;
}

/* ===== 幅・高さ同期 ===== */
function bindSizeSync(wrapper, block, carousel, rightCol) {
  const frame = findCarouselFrame(carousel);

  const applyColWidth = () => {
    let w = 0;
    if (rightCol) {
      w = Math.round(rightCol.getBoundingClientRect().width);
    }
    if (!w) {
      const ww = wrapper.getBoundingClientRect().width || window.innerWidth;
      w = Math.max(280, Math.min(480, Math.round(ww * 0.35))); // 35% を基準に 280-480 の範囲にクリップ
    }
    wrapper.style.setProperty('--imagelink2-col-width', `${w}px`);
    block.style.setProperty('--imagelink2-width', `${w}px`);
  };

  const applyHeight = () => {
    if (!frame) return;
    const h = Math.round(frame.getBoundingClientRect().height || carousel.getBoundingClientRect().height);
    if (h > 0) block.style.setProperty('--imagelink2-height', `${h}px`);
  };

  // 初期適用
  applyColWidth();
  applyHeight();

  // 監視（幅・高さ）
  const obsTargets = [wrapper, rightCol, frame, carousel].filter(Boolean);
  const ro = new ResizeObserver(() => {
    applyColWidth();
    applyHeight();
  });
  obsTargets.forEach((t) => ro.observe(t));

  // 画像ロードで高さが変わる場合に追従
  const carImg = frame?.querySelector?.('img') || carousel?.querySelector?.('img');
  if (carImg && !carImg.complete) {
    carImg.addEventListener('load', applyHeight, { once: true });
  }
  const imgs = qa('.imagelink2-item img', block);
  imgs.forEach((img) => {
    if (!img.complete) img.addEventListener('load', applyColWidth, { once: true });
  });

  // ウィンドウリサイズ
  window.addEventListener('resize', () => { applyColWidth(); applyHeight(); });
}

/* ===== 画質系の軽微調整 ===== */
function perfTweakImages(root) {
  qa('img', root).forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });
  qa('source[srcset], img[src]', root).forEach((el) => {
    const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
    const val = el.getAttribute(attr);
    if (val && val.includes('format=webply')) {
      el.setAttribute(attr, val.replace(/format=webply/g, 'format=webp'));
    }
  });
}

/* ===== エントリポイント ===== */
export default function decorate(block) {
  // 1) オーサリング行を <ul><li> に
  const rows = qa(':scope > div', block);
  const list = document.createElement('ul');
  list.className = 'imagelink2-list';
  rows.forEach((row) => {
    const item = normalizeRowToItem(row);
    list.appendChild(item);
    row.remove();
  });
  block.appendChild(list);

  // 2) 近傍の carousel / imagelink 右カラムを取得
  const carousel = findCarouselBlockNear(block);
  const rightCol = findImagelinkRightNear(carousel || block);

  // 3) 横並びラッパーを用意して配置
  const wrapper = ensurePairWrapper(carousel, block);

  // 4) 幅・高さ同期（右列幅 / 高さ）
  bindSizeSync(wrapper, block, carousel, rightCol);

  // 5) 画質最適化
  perfTweakImages(block);
}
