/**
 * carouselmini
 * - 横幅は imagelink 左ヒーローに追従（--carouselmini-width を注入）
 * - カード比率は左ヒーローと同じ（--hero-ratio を注入・なければ 16/9）
 * - PC=3 / Tablet=2 / Mobile=1 列でスナップスクロール
 * - 左右ナビ + ドット（ページ単位） + オートプレイ
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function normalizeCellToItem(cell) {
  const item = document.createElement('li');
  item.className = 'carouselmini-item';

  const frame = document.createElement('div');
  frame.className = 'carouselmini-frame';

  // a/picture/img を優先的に拾う
  const anchor = cell.querySelector('a[href]');
  const pic = cell.querySelector('picture') || cell.querySelector('img');

  if (anchor) {
    const a = document.createElement('a');
    a.href = anchor.getAttribute('href');
    const label = anchor.getAttribute('aria-label') || anchor.textContent?.trim() || '';
    if (label) a.setAttribute('aria-label', label);
    frame.append(a);
    const target = a;
    if (pic) target.appendChild(pic);
  } else {
    if (pic) frame.appendChild(pic);
  }

  item.append(frame);
  return item;
}

/* imagelink の左ヒーロー（またはそれ相当）を見つけ、幅と比率を返す */
function findImagelinkLeft() {
  const candidates = qa(`
    .block.imagelink .imagelink-left,
    .imagelink .imagelink-left,
    .imagelink > div:first-child,
    .imagelist .left-hero,
    .imagelist > div:first-child
  `);

  for (const el of candidates) {
    const img = el.querySelector('img');
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) {
      const ratio = img
        ? (Number(img.getAttribute('width')) || img.naturalWidth || 0) /
          (Number(img.getAttribute('height')) || img.naturalHeight || 1)
        : 0;
      return { el, width: rect.width, ratio: ratio || 16 / 9 };
    }
  }
  return null;
}

/* imagelink 左ヒーローの幅/比率を監視して、carouselmini に渡す */
function bindImagelinkSync(block) {
  const apply = () => {
    const ref = findImagelinkLeft();
    if (!ref) return;
    const { el, ratio } = ref;

    // 幅は ResizeObserver で随時更新
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) block.style.setProperty('--carouselmini-width', `${Math.round(w)}px`);
    };
    updateWidth();

    // 比率（カードの aspect-ratio 用）
    if (ratio > 0) block.style.setProperty('--hero-ratio', ratio.toString());

    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);

    // 画像が後からロードされた場合
    const img = el.querySelector('img');
    if (img && !img.complete) {
      img.addEventListener('load', () => {
        updateWidth();
        const r =
          (Number(img.getAttribute('width')) || img.naturalWidth || 0) /
          (Number(img.getAttribute('height')) || img.naturalHeight || 1);
        if (r > 0) block.style.setProperty('--hero-ratio', r.toString());
      }, { once: true });
    }

    window.addEventListener('resize', updateWidth);
  };

  // 周辺ブロックのレイアウトが固まってから参照
  requestAnimationFrame(apply);
}

/* CSS変数から列数・ギャップを取得 */
function getCols(block) {
  const styles = getComputedStyle(block);
  const cols = parseFloat(styles.getPropertyValue('--carouselmini-cols')) || 1;
  return Math.max(1, Math.round(cols));
}
function getGap(block) {
  const styles = getComputedStyle(block);
  return parseFloat(styles.getPropertyValue('--carouselmini-gap')) || 0;
}

/* ページ幅（= アイテム幅×cols + gap×(cols-1)） */
function getPageWidth(block) {
  const scroller = q('.carouselmini-slides', block);
  const item = scroller?.querySelector('.carouselmini-item');
  if (!scroller || !item) return 0;
  const cols = getCols(block);
  const gap = getGap(block);
  const w = item.getBoundingClientRect().width;
  return w * cols + gap * (cols - 1);
}

/* 現在ページを算出 */
function getCurrentPage(block) {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return 0;
  const pageW = getPageWidth(block) || scroller.clientWidth;
  return Math.round(scroller.scrollLeft / Math.max(1, pageW));
}

/* 総ページ数（= ceil(totalItems / cols)） */
function getTotalPages(block) {
  const scroller = q('.carouselmini-slides', block);
  const totalItems = scroller ? scroller.children.length : 0;
  const cols = getCols(block);
  return Math.max(1, Math.ceil(totalItems / cols));
}

function scrollToPage(block, page, behavior = 'smooth') {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  const pageW = getPageWidth(block) || scroller.clientWidth;
  const total = getTotalPages(block);
  const target = Math.max(0, Math.min(total - 1, page));

  scroller.scrollTo({ left: target * pageW, top: 0, behavior });
  updateIndicators(block, target, total);
}

/* ドットを生成/更新 */
function buildIndicators(block) {
  let indiWrap = q('.carouselmini-indicators', block);
  if (!indiWrap) {
    indiWrap = document.createElement('div');
    indiWrap.className = 'carouselmini-indicators';
    // ステータス（「1/5」など）
    const status = document.createElement('span');
    status.className = 'carouselmini-status';
    status.setAttribute('aria-live', 'polite');
    status.hidden = true; // 視覚的には非表示。必要なら表示に切替えてOK。
    indiWrap.append(status);
    block.append(indiWrap);
  }

  // 既存ボタンを一旦削除（statusは残す）
  indiWrap.querySelectorAll('button').forEach((b) => b.remove());

  const total = getTotalPages(block);
  for (let i = 0; i < total; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `スライド ${i + 1} / ${total} を表示`);
    btn.addEventListener('click', () => scrollToPage(block, i));
    indiWrap.insertBefore(btn, indiWrap.querySelector('.carouselmini-status'));
  }

  // 初期アクティブ
  updateIndicators(block, 0, total);
}

function updateIndicators(block, current, total) {
  const btns = qa('.carouselmini-indicators button', block);
  btns.forEach((b, idx) => {
    if (idx === current) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
  const status = q('.carouselmini-status', block);
  if (status) status.textContent = `${current + 1} / ${total}`;
}

/* スクロール追従（ドット更新） */
function bindScrollUpdate(block) {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  let rAF = 0;
  const onScroll = () => {
    if (rAF) return;
    rAF = requestAnimationFrame(() => {
      rAF = 0;
      const curr = getCurrentPage(block);
      updateIndicators(block, curr, getTotalPages(block));
    });
  };
  scroller.addEventListener('scroll', onScroll);

  // リサイズで列数が変わる → ドット再構築
  const ro = new ResizeObserver(() => {
    buildIndicators(block);
    // ページ幅が変わるため、現在地に再スナップ
    const curr = getCurrentPage(block);
    scrollToPage(block, curr, 'auto');
  });
  ro.observe(block);
}

/* オートプレイ（ページ単位で送る） */
function startAutoplay(block, intervalMs = 3000) {
  const total = getTotalPages(block);
  if (total <= 1) return; // 1ページ以下なら不要

  // 既存を停止
  if (block._carouselminiTimer) clearInterval(block._carouselminiTimer);

  block._carouselminiTimer = setInterval(() => {
    const curr = getCurrentPage(block);
    const next = (curr + 1) % getTotalPages(block);
    scrollToPage(block, next);
  }, intervalMs);

  const stop = () => {
    if (block._carouselminiTimer) clearInterval(block._carouselminiTimer);
    block._carouselminiTimer = null;
  };
  const resume = () => {
    if (!block._carouselminiTimer) startAutoplay(block, intervalMs);
  };

  // ユーザー操作時は一時停止
  const scroller = q('.carouselmini-slides', block);
  ['mouseenter', 'focusin', 'touchstart', 'pointerdown'].forEach((ev) => {
    block.addEventListener(ev, stop);
    scroller.addEventListener(ev, stop);
  });
  ['mouseleave', 'focusout'].forEach((ev) => {
    block.addEventListener(ev, resume);
    scroller.addEventListener(ev, resume);
  });
}

export default function decorate(block) {
  // 既存の行/セルをカードに変換
  const cells = [];
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => cells.push(cell));
  });

  const items = cells.map((cell) => normalizeCellToItem(cell));

  // ビューポート + スライドUL 構築
  const viewport = document.createElement('div');
  viewport.className = 'carouselmini-viewport';

  const list = document.createElement('ul');
  list.className = 'carouselmini-slides';
  items.forEach((it) => list.appendChild(it));

  // ナビボタン
  const nav = document.createElement('div');
  nav.className = 'carouselmini-nav';
  nav.innerHTML = `
    <button type="button" class="prev" aria-label="前のスライド"></button>
    <button type="button" class="next" aria-label="次のスライド"></button>
  `;

  // 置き換え
  block.textContent = '';
  viewport.append(list, nav);
  block.append(viewport);

  // ナビイベント（ページ単位）
  nav.querySelector('.prev')?.addEventListener('click', () => {
    const curr = getCurrentPage(block);
    scrollToPage(block, curr - 1);
  });
  nav.querySelector('.next')?.addEventListener('click', () => {
    const curr = getCurrentPage(block);
    scrollToPage(block, curr + 1);
  });

  // imagelink の左ヒーローと同期（幅・比率）
  bindImagelinkSync(block);

  // ドット生成 & スクロール追従
  buildIndicators(block);
  bindScrollUpdate(block);

  // オートプレイ開始（必要に応じて秒数は調整）
  startAutoplay(block, 3000);

  // 軽微な最適化とtypo補正
  block.querySelectorAll('img').forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });
  block.querySelectorAll('source[srcset], img[src]').forEach((el) => {
    const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
    const val = el.getAttribute(attr);
    if (val && val.includes('format=webply')) {
      el.setAttribute(attr, val.replace(/format=webply/g, 'format=webp'));
    }
  });
}
