/**
 * carouselmini
 * - 幅：imagelink 左ヒーローに追従（--carouselmini-width を注入）
 * - 比率：imagelink 左ヒーローに追従（--hero-ratio を注入／無ければ16:9）
 * - 列数：PC=3 / Tablet=2 / Mobile=1（CSS変数）
 * - 動作：ページ送り（列数ぶん）でオートプレイ、最後で0に戻ってループ
 * - ドット：画像数ぶんを生成。先頭に見えている画像の番号をハイライト
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ===== オーサリングセル → アイテム変換 ===== */
function normalizeCellToItem(cell) {
  const item = document.createElement('li');
  item.className = 'carouselmini-item';

  const frame = document.createElement('div');
  frame.className = 'carouselmini-frame';

  const anchor = cell.querySelector('a[href]');
  const pic = cell.querySelector('picture') || cell.querySelector('img');

  if (anchor) {
    const a = document.createElement('a');
    a.href = anchor.getAttribute('href');
    const label = anchor.getAttribute('aria-label') || anchor.textContent?.trim() || '';
    if (label) a.setAttribute('aria-label', label);
    frame.append(a);
    if (pic) a.appendChild(pic);
  } else if (pic) {
    frame.appendChild(pic);
  }

  item.append(frame);
  return item;
}

/* ===== imagelink 左ヒーロー探索 ===== */
function findImagelinkLeftNear(block) {
  // 1) 近い順に前方兄弟を探索
  let node = block.previousElementSibling;
  while (node) {
    const candidate = node.querySelector?.('.imagelink .imagelink-left, .block.imagelink .imagelink-left, .imagelink > div:first-child');
    if (candidate) return candidate;
    node = node.previousElementSibling;
  }
  // 2) 同じ親の中に無ければ、文書全体から最初の候補を使用
  return document.querySelector('.block.imagelink .imagelink-left, .imagelink .imagelink-left, .imagelink > div:first-child');
}

/* ===== imagelink 同期（幅・比率） ===== */
function bindImagelinkSync(block) {
  const el = findImagelinkLeftNear(block);
  if (!el) return;

  const applyWidth = () => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) {
      block.style.setProperty('--carouselmini-width', `${Math.round(rect.width)}px`);
    }
  };

  const applyRatio = () => {
    const img = el.querySelector('img');
    if (!img) return;
    const w = Number(img.getAttribute('width')) || img.naturalWidth || 0;
    const h = Number(img.getAttribute('height')) || img.naturalHeight || 0;
    if (w > 0 && h > 0) {
      block.style.setProperty('--hero-ratio', (w / h).toString());
    }
  };

  // 初期適用
  applyWidth(); applyRatio();

  // リサイズ追従
  const ro = new ResizeObserver(applyWidth);
  ro.observe(el);

  // 画像ロード後にも追従
  const heroImg = el.querySelector('img');
  if (heroImg && !heroImg.complete) {
    heroImg.addEventListener('load', () => { applyWidth(); applyRatio(); }, { once: true });
  }

  // 画面リサイズ時
  window.addEventListener('resize', applyWidth);
}

/* ===== レイアウト／数値計算 ===== */
function getCols(block) {
  const s = getComputedStyle(block);
  const cols = parseFloat(s.getPropertyValue('--carouselmini-cols')) || 1;
  return Math.max(1, Math.round(cols));
}

function getStepWidth(block) {
  const scroller = q('.carouselmini-slides', block);
  const items = scroller ? qa('.carouselmini-item', scroller) : [];
  if (!scroller || items.length === 0) return 0;
  if (items.length >= 2) {
    // 隣り合うアイテムの offsetLeft 差分をステップ幅とする（gapを含む）
    return items[1].offsetLeft - items[0].offsetLeft;
  }
  // 1枚しか無い場合はその幅
  return items[0].getBoundingClientRect().width;
}

function clampIndex(idx, min, max) {
  return Math.max(min, Math.min(max, idx));
}

function getCurrentStartIndex(block) {
  const scroller = q('.carouselmini-slides', block);
  const step = getStepWidth(block) || scroller?.clientWidth || 1;
  return Math.round((scroller?.scrollLeft || 0) / step);
}

function getMaxStartIndex(block) {
  const scroller = q('.carouselmini-slides', block);
  const totalItems = scroller ? scroller.children.length : 0;
  const cols = getCols(block);
  return Math.max(0, totalItems - cols);
}

function scrollToStartIndex(block, idx, behavior = 'smooth') {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;
  const maxIdx = getMaxStartIndex(block);
  const target = clampIndex(idx, 0, maxIdx);
  const step = getStepWidth(block) || scroller.clientWidth;
  scroller.scrollTo({ left: target * step, top: 0, behavior });
  updateIndicators(block, target); // ドット更新
}

/* ===== ドット（画像数ぶん） ===== */
function buildIndicators(block) {
  let wrap = q('.carouselmini-indicators', block);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'carouselmini-indicators';
    const status = document.createElement('span');
    status.className = 'carouselmini-status';
    status.setAttribute('aria-live', 'polite');
    wrap.append(status);
    block.append(wrap);
  }
  // 既存ボタン削除（statusは残す）
  qa('button', wrap).forEach((b) => b.remove());

  const scroller = q('.carouselmini-slides', block);
  const totalItems = scroller ? scroller.children.length : 0;

  for (let i = 0; i < totalItems; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `画像 ${i + 1} / ${totalItems} を表示`);
    btn.addEventListener('click', () => scrollToStartIndex(block, i));
    wrap.insertBefore(btn, q('.carouselmini-status', wrap));
  }

  updateIndicators(block, getCurrentStartIndex(block));
}

function updateIndicators(block, currentStartIdx) {
  const wrap = q('.carouselmini-indicators', block);
  if (!wrap) return;
  const scroller = q('.carouselmini-slides', block);
  const totalItems = scroller ? scroller.children.length : 0;

  const btns = qa('button', wrap);
  btns.forEach((b, i) => {
    if (i === currentStartIdx) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });

  const status = q('.carouselmini-status', wrap);
  if (status) status.textContent = `${Math.min(currentStartIdx + 1, totalItems)} / ${totalItems}`;
}

/* ===== スクロール追従（ドット更新） ===== */
function bindScrollUpdate(block) {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      updateIndicators(block, getCurrentStartIndex(block));
    });
  };
  scroller.addEventListener('scroll', onScroll);

  // リサイズで列数や幅が変わる → 再構築
  const ro = new ResizeObserver(() => {
    buildIndicators(block);
    // 現在の先頭インデックスへ再スナップ
    scrollToStartIndex(block, getCurrentStartIndex(block), 'auto');
  });
  ro.observe(block);
}

/* ===== オートプレイ（列数ぶんページ送り、最後で0に戻る） ===== */
function startAutoplay(block, intervalMs = 3000) {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  const totalItems = scroller.children.length;
  const cols = getCols(block);
  if (totalItems <= cols) return; // 1ページしかないなら不要

  if (block._carouselminiTimer) clearInterval(block._carouselminiTimer);

  block._carouselminiTimer = setInterval(() => {
    const curr = getCurrentStartIndex(block);
    const maxIdx = getMaxStartIndex(block);
    const next = curr + cols;      // ページ送り（列数ぶん）
    if (next > maxIdx) {
      // 末尾を超えたら最初に戻る（ループ）
      scrollToStartIndex(block, 0);
    } else {
      scrollToStartIndex(block, next);
    }
  }, intervalMs);

  const stop = () => {
    if (block._carouselminiTimer) clearInterval(block._carouselminiTimer);
    block._carouselminiTimer = null;
  };
  const resume = () => {
    if (!block._carouselminiTimer) startAutoplay(block, intervalMs);
  };

  // ユーザー操作で一時停止／離れたら再開
  ['mouseenter', 'focusin', 'touchstart', 'pointerdown'].forEach((ev) => {
    block.addEventListener(ev, stop);
    scroller.addEventListener(ev, stop);
  });
  ['mouseleave', 'focusout'].forEach((ev) => {
    block.addEventListener(ev, resume);
    scroller.addEventListener(ev, resume);
  });
}

/* ===== 前後ボタン（ページ送り＆ループ） ===== */
function bindNavButtons(block) {
  const prev = q('.carouselmini-nav .prev', block);
  const next = q('.carouselmini-nav .next', block);
  if (prev) {
    prev.addEventListener('click', () => {
      const curr = getCurrentStartIndex(block);
      const cols = getCols(block);
      const maxIdx = getMaxStartIndex(block);
      const target = curr - cols;
      if (target < 0) scrollToStartIndex(block, maxIdx);
      else scrollToStartIndex(block, target);
    });
  }
  if (next) {
    next.addEventListener('click', () => {
      const curr = getCurrentStartIndex(block);
      const cols = getCols(block);
      const maxIdx = getMaxStartIndex(block);
      const target = curr + cols;
      if (target > maxIdx) scrollToStartIndex(block, 0);
      else scrollToStartIndex(block, target);
    });
  }
}

/* ===== エントリポイント ===== */
export default function decorate(block) {
  // 元セルを収集してアイテム化
  const cells = [];
  [...block.children].forEach((row) => { [...row.children].forEach((cell) => cells.push(cell)); });
  const items = cells.map((cell) => normalizeCellToItem(cell));

  // DOM構築
  const viewport = document.createElement('div');
  viewport.className = 'carouselmini-viewport';

  const list = document.createElement('ul');
  list.className = 'carouselmini-slides';
  items.forEach((it) => list.appendChild(it));

  const nav = document.createElement('div');
  nav.className = 'carouselmini-nav';
  nav.innerHTML = `
    <button type="button" class="prev" aria-label="前へ"></button>
    <button type="button" class="next" aria-label="次へ"></button>
  `;

  // 置換
  block.textContent = '';
  viewport.append(list, nav);
  block.append(viewport);

  // imagelink 同期（幅・比率）
  bindImagelinkSync(block);

  // ドット（画像数ぶん） & スクロール追従
  buildIndicators(block);
  bindScrollUpdate(block);

  // ナビボタン
  bindNavButtons(block);

  // オートプレイ開始（3秒。必要なら調整）
  startAutoplay(block, 3000);

  // 軽微な最適化 & typo補正（webply → webp）
  qa('img', block).forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });
  qa('source[srcset], img[src]', block).forEach((el) => {
    const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
    const val = el.getAttribute(attr);
    if (val && val.includes('format=webply')) {
      el.setAttribute(attr, val.replace(/format=webply/g, 'format=webp'));
    }
  });
}
