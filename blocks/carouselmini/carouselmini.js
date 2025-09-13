/**
 * carouselmini
 * - 幅：imagelink 左ヒーローに追従（--carouselmini-width）
 * - 比率：imagelink 左ヒーローに追従（--hero-ratio、無ければ16/9）
 * - 可視列：PC=3 / Tablet=2 / Mobile=1（CSS変数）
 * - 自動再生：3秒ごとに「1画像」ずつ送る。末尾まで来たら先頭に戻る（ループ）
 * - ドット：画像枚数ぶん生成し、左端に見えている画像インデックスをハイライト
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

/* ===== imagelink 左ヒーロー探索（近傍優先） ===== */
function findImagelinkLeftNear(block) {
  let node = block.previousElementSibling;
  while (node) {
    const cand = node.querySelector?.(
      '.block.imagelink .imagelink-left, .imagelink .imagelink-left, .imagelink > div:first-child'
    );
    if (cand) return cand;
    node = node.previousElementSibling;
  }
  return document.querySelector(
    '.block.imagelink .imagelink-left, .imagelink .imagelink-left, .imagelink > div:first-child'
  );
}

/* ===== imagelink 同期（幅・比率） ===== */
function bindImagelinkSync(block) {
  const el = findImagelinkLeftNear(block);
  if (!el) return;

  const applyWidth = () => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) block.style.setProperty('--carouselmini-width', `${Math.round(rect.width)}px`);
  };
  const applyRatio = () => {
    const img = el.querySelector('img');
    if (!img) return;
    const w = Number(img.getAttribute('width')) || img.naturalWidth || 0;
    const h = Number(img.getAttribute('height')) || img.naturalHeight || 0;
    if (w > 0 && h > 0) block.style.setProperty('--hero-ratio', (w / h).toString());
  };

  // 初期適用
  applyWidth(); applyRatio();

  // リサイズで幅追従
  const ro = new ResizeObserver(applyWidth);
  ro.observe(el);

  // ヒーロー画像ロード後にも追従
  const heroImg = el.querySelector('img');
  if (heroImg && !heroImg.complete) {
    heroImg.addEventListener('load', () => { applyWidth(); applyRatio(); }, { once: true });
  }

  window.addEventListener('resize', applyWidth);
}

/* ===== レイアウト数値 ===== */
function getCols(block) {
  const s = getComputedStyle(block);
  const cols = parseFloat(s.getPropertyValue('--carouselmini-cols')) || 1;
  return Math.max(1, Math.round(cols));
}

function getStepWidth(block) {
  const scroller = q('.carouselmini-slides', block);
  const items = scroller ? qa('.carouselmini-item', scroller) : [];
  if (!scroller || items.length === 0) return 0;
  if (items.length >= 2) return items[1].offsetLeft - items[0].offsetLeft; // gap込みの1枚分
  return items[0].getBoundingClientRect().width;
}

function getCurrentIndex(block) {
  const scroller = q('.carouselmini-slides', block);
  const step = getStepWidth(block) || scroller?.clientWidth || 1;
  return Math.round((scroller?.scrollLeft || 0) / step);
}

function getMaxIndex(block) {
  const scroller = q('.carouselmini-slides', block);
  const totalItems = scroller ? scroller.children.length : 0;
  const cols = getCols(block);
  return Math.max(0, totalItems - cols);
}

function scrollToIndex(block, idx, behavior = 'smooth') {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;
  const maxIdx = getMaxIndex(block);
  const target = Math.max(0, Math.min(maxIdx, idx));
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

  // 既存ボタンをクリア（statusは残す）
  qa('button', wrap).forEach((b) => b.remove());

  const scroller = q('.carouselmini-slides', block);
  const totalItems = scroller ? scroller.children.length : 0;

  for (let i = 0; i < totalItems; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `画像 ${i + 1} / ${totalItems} を表示`);
    btn.addEventListener('click', () => scrollToIndex(block, i));
    wrap.insertBefore(btn, q('.carouselmini-status', wrap));
  }

  updateIndicators(block, getCurrentIndex(block));
}

function updateIndicators(block, currentIdx) {
  const wrap = q('.carouselmini-indicators', block);
  if (!wrap) return;

  const scroller = q('.carouselmini-slides', block);
  const totalItems = scroller ? scroller.children.length : 0;

  const btns = qa('button', wrap);
  btns.forEach((b, i) => {
    if (i === currentIdx) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });

  const status = q('.carouselmini-status', wrap);
  if (status) status.textContent = `${Math.min(currentIdx + 1, totalItems)} / ${totalItems}`;
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
      updateIndicators(block, getCurrentIndex(block));
    });
  };
  scroller.addEventListener('scroll', onScroll);

  // リサイズでステップ幅や列数が変わる → 再構築＆現在地へスナップ
  const ro = new ResizeObserver(() => {
    const curr = getCurrentIndex(block);
    buildIndicators(block);
    scrollToIndex(block, curr, 'auto');
  });
  ro.observe(block);
}

/* ===== オートプレイ（3秒ごとに1画像ずつ。最後→最初にループ） ===== */
function startAutoplay(block, intervalMs = 3000) {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  const totalItems = scroller.children.length;
  if (totalItems <= 1) return; // 1枚なら不要

  if (block._carouselminiTimer) clearInterval(block._carouselminiTimer);

  block._carouselminiTimer = setInterval(() => {
    const curr = getCurrentIndex(block);
    const maxIdx = getMaxIndex(block);
    const next = curr + 1;
    if (next > maxIdx) {
      // 末尾の次は先頭へ
      scrollToIndex(block, 0);
    } else {
      scrollToIndex(block, next);
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

/* ===== 前後ボタン（1画像ずつ。ループ） ===== */
function bindNavButtons(block) {
  const prev = q('.carouselmini-nav .prev', block);
  const next = q('.carouselmini-nav .next', block);
  if (prev) {
    prev.addEventListener('click', () => {
      const curr = getCurrentIndex(block);
      const maxIdx = getMaxIndex(block);
      const target = curr - 1;
      if (target < 0) scrollToIndex(block, maxIdx);
      else scrollToIndex(block, target);
    });
  }
  if (next) {
    next.addEventListener('click', () => {
      const curr = getCurrentIndex(block);
      const maxIdx = getMaxIndex(block);
      const target = curr + 1;
      if (target > maxIdx) scrollToIndex(block, 0);
      else scrollToIndex(block, target);
    });
  }
}

/* ===== 初期化をレイアウト確定後に実行（画像ロード前の0幅対策） ===== */
function initAfterLayout(block, fn) {
  // 2フレーム待ってから実行してレイアウトを安定させる
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/* ===== エントリポイント ===== */
export default function decorate(block) {
  // オーサリングの行/セル → アイテム化
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

  // 画像の軽量属性 & typo補正
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

  // レイアウト確定後に各種バインド
  initAfterLayout(block, () => {
    buildIndicators(block);
    bindScrollUpdate(block);
    bindNavButtons(block);
    startAutoplay(block, 3000); // ★ 3秒ごとに「1画像」送る
  });
}
