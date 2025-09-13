/**
 * carouselmini
 * - 幅：imagelink 左ヒーローに追従（--carouselmini-width）
 * - 比率：imagelink 左ヒーローに追従（--hero-ratio、無ければ16/9）
 * - 可視列：PC=3 / Tablet=2 / Mobile=1（CSS変数）
 * - 自動再生：3秒ごとに「1画像」ずつ。末尾の後ろに 1/2 のクローンを並べ、
 *              [ …, N ] → [ N, 1*, 2* ] を表示した直後に [1,2,3] へ瞬時リセット
 * - ドット：元画像枚数ぶん。左端が 1*（クローン）になった時は最右（N）を点灯
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

  // リサイズ追従
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
  if (items.length >= 2) return items[1].offsetLeft - items[0].offsetLeft; // gap込み
  return items[0].getBoundingClientRect().width;
}

function getCurrentIndex(block) {
  const scroller = q('.carouselmini-slides', block);
  const step = getStepWidth(block) || scroller?.clientWidth || 1;
  return Math.round((scroller?.scrollLeft || 0) / step);
}

/* totalItems にはクローンを含む。maxIndex は「左端として成立する最大インデックス」 */
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

/* ===== ドット（元画像数ぶん） ===== */
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

  const totalOriginal = block._cmOriginal || 0;
  for (let i = 0; i < totalOriginal; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `画像 ${i + 1} / ${totalOriginal} を表示`);
    btn.addEventListener('click', () => scrollToIndex(block, i));
    wrap.insertBefore(btn, q('.carouselmini-status', wrap));
  }

  updateIndicators(block, getCurrentIndex(block));
}

/* 左端インデックス → ドットのインデックス（元画像スケール） */
function mapIndexToDot(currentIdx, totalOriginal) {
  if (totalOriginal <= 0) return 0;
  const eff = currentIdx % totalOriginal;
  // 左端が 1枚目クローン（= eff === 0 かつ currentIdx >= totalOriginal）なら最右を点灯
  if (currentIdx >= totalOriginal && eff === 0) return totalOriginal - 1;
  return eff;
}

function updateIndicators(block, currentIdx) {
  const wrap = q('.carouselmini-indicators', block);
  if (!wrap) return;

  const totalOriginal = block._cmOriginal || 0;
  const btns = qa('button', wrap);
  const dotIdx = mapIndexToDot(currentIdx, totalOriginal);

  btns.forEach((b, i) => {
    if (i === dotIdx) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });

  const status = q('.carouselmini-status', wrap);
  if (status) status.textContent = `${dotIdx + 1} / ${totalOriginal}`;
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

  // リサイズでステップ幅/列数が変わる → 再構築＆現在地へスナップ
  const ro = new ResizeObserver(() => {
    const curr = getCurrentIndex(block);
    buildIndicators(block);
    scrollToIndex(block, curr, 'auto');
  });
  ro.observe(block);
}

/* ===== オートプレイ（1枚ずつ、N → 1* → 2* → リセット→ 1） ===== */
function startAutoplay(block, intervalMs = 3000) {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  const totalOriginal = block._cmOriginal || 0;
  const totalItems = scroller.children.length; // クローン込み
  if (totalOriginal <= 1 || totalItems <= 1) return;

  if (block._carouselminiTimer) clearInterval(block._carouselminiTimer);

  block._carouselminiTimer = setInterval(() => {
    const curr = getCurrentIndex(block);
    const cols = getCols(block);
    const maxIdx = getMaxIndex(block);
    const firstCloneIdx = totalOriginal;      // 左端=1* の位置
    const secondCloneIdx = totalOriginal + 1; // 左端=2* の位置

    // 2* を表示した「次」は、[1,2,3] へ瞬時リセット
    if (curr >= secondCloneIdx) {
      scrollToIndex(block, 0, 'auto'); // ノーアニメで戻す
      return;
    }

    // 通常は1枚送る。末尾（N）→ 1* → 2* と進む
    const next = curr + 1;
    if (next > maxIdx) {
      // 念のため上限ガード（通常は secondCloneIdx を超える前にリセットされる）
      scrollToIndex(block, 0, 'auto');
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

/* ===== 前後ボタン（1枚ずつ。末尾→1*→2*→リセット） ===== */
function bindNavButtons(block) {
  const prev = q('.carouselmini-nav .prev', block);
  const next = q('.carouselmini-nav .next', block);
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  const totalOriginal = block._cmOriginal || 0;

  if (prev) {
    prev.addEventListener('click', () => {
      const curr = getCurrentIndex(block);
      const cols = getCols(block);
      const maxIdx = getMaxIndex(block);
      let target = curr - 1;

      if (target < 0) {
        // 先頭から戻る → 末尾左端へ
        target = Math.max(0, totalOriginal - cols);
      }
      scrollToIndex(block, target);
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      const curr = getCurrentIndex(block);
      const secondCloneIdx = totalOriginal + 1;
      const target = curr + 1;

      if (curr >= secondCloneIdx) {
        // 2* の次はリセット
        scrollToIndex(block, 0, 'auto');
      } else {
        scrollToIndex(block, target);
      }
    });
  }
}

/* ===== 初期化をレイアウト確定後に実行（画像ロード前の0幅対策） ===== */
function initAfterLayout(block, fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/* ===== エントリポイント ===== */
export default function decorate(block) {
  // オーサリングの行/セル → アイテム化
  const cells = [];
  [...block.children].forEach((row) => { [...row.children].forEach((cell) => cells.push(cell)); });
  const originals = cells.map((cell) => normalizeCellToItem(cell));

  // 元画像枚数を保存（ドットはこの数で作る）
  const totalOriginal = originals.length;
  block._cmOriginal = totalOriginal;

  // DOM構築
  const viewport = document.createElement('div');
  viewport.className = 'carouselmini-viewport';

  const list = document.createElement('ul');
  list.className = 'carouselmini-slides';

  // 元画像を追加
  originals.forEach((it) => list.appendChild(it));

  // 末尾に「1枚目」「2枚目」のクローンを追加
  const cloneCount = Math.min(2, totalOriginal);
  for (let i = 0; i < cloneCount; i += 1) {
    const clone = originals[i].cloneNode(true);
    list.appendChild(clone);
  }

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

  // 画像の軽量属性 & typo補正（webply → webp）
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
    buildIndicators(block);     // ドット＝元画像数
    bindScrollUpdate(block);    // スクロールでドット更新
    bindNavButtons(block);      // 前後ボタン（1枚ずつ）
    startAutoplay(block, 3000); // ★ 3秒ごとに1枚送り（N→1*→2*→リセット→1…）
  });
}
