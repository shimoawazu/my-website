/**
 * imagelink2
 * - carousel2（なければ carousel / carouselmini）の「実際に見えている画像の高さ」に同期
 * - 横並び: 左=carousel、右=imagelink2 を .imagelink2-pair に内包
 * - 列幅: 近傍 imagelink の右カラム幅、なければ wrapper 幅の 35%（280-480px にクリップ）
 * - コンテンツ: オーサリング2行を <ul><li> の画像リンクに正規化
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ==== 近傍 carousel ブロック ==== */
function findCarouselBlockNear(block) {
  const candidates = ['.carousel2', '.carousel', '.carouselmini'];
  // 前方
  let n = block.previousElementSibling;
  while (n) {
    for (const sel of candidates) {
      const cand = n.matches?.(sel) ? n : n.querySelector?.(sel);
      if (cand) return cand;
    }
    n = n.previousElementSibling;
  }
  // 後方
  n = block.nextElementSibling;
  while (n) {
    for (const sel of candidates) {
      const cand = n.matches?.(sel) ? n : n.querySelector?.(sel);
      if (cand) return cand;
    }
    n = n.nextElementSibling;
  }
  // 全体
  for (const sel of candidates) {
    const cand = q(sel);
    if (cand) return cand;
  }
  return null;
}

/* ==== “実際に表示されている”画像ノードを取得 ==== */
function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
}

function findVisibleCarouselImage(carousel) {
  if (!carousel) return null;

  // 優先度高い順に候補セレクタを列挙
  const selectors = [
    '.carousel2 .carousel-slide-image picture > img',
    '.carousel2 .carousel-slide-image img',
    '.carousel .carousel-slide-image picture > img',
    '.carousel .carousel-slide-image img',
    '.carouselmini .carouselmini-frame picture > img',
    '.carouselmini .carouselmini-frame img',
    'picture > img',
    'img',
  ];

  for (const sel of selectors) {
    const list = qa(sel, carousel);
    // 今見えているものを返す（active スライドでなくても可視ならOK）
    const vis = list.find((img) => isVisible(img));
    if (vis) return vis;
  }
  return null;
}

/* ==== 近傍の imagelink 右カラム幅 ==== */
function findImagelinkRightNear(refNode) {
  if (!refNode) return null;
  let host = refNode;
  for (let i = 0; i < 3 && host; i += 1) {
    const right =
      host.querySelector?.('.imagelink .imagelink-right') ||
      host.querySelector?.('.block.imagelink .imagelink-right') ||
      host.querySelector?.('.imagelink > div:last-child');
    if (right) return right;
    host = host.parentElement;
  }
  return (
    q('.imagelink .imagelink-right') ||
    q('.block.imagelink .imagelink-right') ||
    q('.imagelink > div:last-child')
  );
}

/* ==== row -> li アイテム化 ==== */
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

/* ==== 横並びラッパー生成（idempotent） ==== */
function ensurePairWrapper(carousel, imagelink2) {
  if (imagelink2.parentElement?.classList.contains('imagelink2-pair')) {
    const wrap = imagelink2.parentElement;
    if (carousel && carousel.parentElement !== wrap) {
      wrap.insertBefore(carousel, wrap.firstChild);
    }
    return wrap;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'imagelink2-pair';
  if (carousel?.parentNode) {
    carousel.parentNode.insertBefore(wrapper, carousel);
    wrapper.appendChild(carousel);
    wrapper.appendChild(imagelink2);
  } else {
    const p = imagelink2.parentNode;
    p.insertBefore(wrapper, imagelink2);
    wrapper.appendChild(imagelink2);
  }
  return wrapper;
}

/* ==== 幅・高さ同期 ==== */
function bindSizeSync(wrapper, block, carousel, rightCol) {
  const computeColWidth = () => {
    if (rightCol) {
      const w = Math.round(rightCol.getBoundingClientRect().width);
      if (w > 0) return w;
    }
    const ww = wrapper.getBoundingClientRect().width || window.innerWidth;
    // 基準: 35% を 280-480 にクリップ
    return Math.max(280, Math.min(480, Math.round(ww * 0.35)));
  };

  const applyWidth = () => {
    const w = computeColWidth();
    wrapper.style.setProperty('--imagelink2-col-width', `${w}px`);
  };

  const applyHeightFromImage = () => {
    const img = findVisibleCarouselImage(carousel);
    if (!img) return;
    const h = Math.round(img.getBoundingClientRect().height);
    if (h > 0) {
      block.style.setProperty('--imagelink2-height', `${h}px`);
    }
  };

  // 初期適用
  applyWidth();
  applyHeightFromImage();

  // 監視: wrapper サイズ、右カラム、ウィンドウリサイズ
  const ro = new ResizeObserver(() => {
    applyWidth();
    applyHeightFromImage();
  });
  [wrapper, rightCol, carousel].filter(Boolean).forEach((t) => ro.observe(t));

  // 監視: 可視画像そのもの（スライドで画像が入れ替わる可能性があるので、都度再取得してから監視）
  let observedImg = null;
  const observeCurrentImg = () => {
    const img = findVisibleCarouselImage(carousel);
    if (!img || img === observedImg) return;
    if (observedImg && observedImg._ro) {
      observedImg._ro.disconnect();
      observedImg._ro = null;
    }
    const roImg = new ResizeObserver(applyHeightFromImage);
    roImg.observe(img);
    observedImg = img;
    observedImg._ro = roImg;

    // ロード未完なら load で反映
    if (!img.complete) {
      img.addEventListener('load', applyHeightFromImage, { once: true });
    }
  };
  observeCurrentImg();

  // MutationObserver: スライド遷移などで DOM が入れ替わったら再アタッチ
  const mo = new MutationObserver(() => {
    observeCurrentImg();
    applyHeightFromImage();
  });
  mo.observe(carousel, { childList: true, subtree: true, attributes: true });

  // 画像ロード（念押し）
  window.addEventListener('load', () => {
    observeCurrentImg();
    applyHeightFromImage();
  });

  // ウィンドウリサイズ
  window.addEventListener('resize', () => {
    applyWidth();
    applyHeightFromImage();
  });
}

/* ==== 画質等の軽微調整 ==== */
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

/* ==== エントリポイント ==== */
export default function decorate(block) {
  // 1) オーサリング行を <ul><li> に正規化
  const rows = qa(':scope > div', block);
  const list = document.createElement('ul');
  list.className = 'imagelink2-list';
  rows.forEach((row) => {
    const item = normalizeRowToItem(row);
    list.appendChild(item);
    row.remove();
  });
  block.appendChild(list);

  // 2) 近傍の carousel / 右カラム（幅参照）を取得
  const carousel = findCarouselBlockNear(block);
  const rightCol = findImagelinkRightNear(carousel || block);

  // 3) 横並びラッパーに格納
  const wrapper = ensurePairWrapper(carousel, block);

  // 4) 幅・高さ同期（★ 高さは「見えている画像」の高さ）
  bindSizeSync(wrapper, block, carousel || wrapper, rightCol);

  // 5) 画質系微調整
  perfTweakImages(block);
}
