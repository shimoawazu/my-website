/**
 * imagelink2
 * - 高さ：近傍 carouselmini の .carouselmini-frame 実高さに同期（ResizeObserver）
 * - 幅　：近傍 imagelink の右カラム（.imagelink-right）実幅に同期（ResizeObserver）
 * - 配置：見つかった imagelink 右カラムの末尾へ、このブロック要素ごと append
 * - 構造：オーサリング行（縦2行想定）から <ul><li> を生成
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ==== 近傍の imagelink 右カラムを探す（前方優先） ==== */
function findImagelinkRightNear(block) {
  // 1) 前方の兄弟要素を近い順に走査
  let node = block.previousElementSibling;
  while (node) {
    const cand = node.querySelector?.('.imagelink .imagelink-right, .block.imagelink .imagelink-right, .imagelink > div:last-child');
    if (cand) return cand;
    node = node.previousElementSibling;
  }
  // 2) 文書全体の最初の候補
  return document.querySelector('.block.imagelink .imagelink-right, .imagelink .imagelink-right, .imagelink > div:last-child');
}

/* ==== 近傍の carouselmini の画像フレームを探す（前方→後方） ==== */
function findCarouselMiniFrameNear(block) {
  // 1) まず前方
  let node = block.previousElementSibling;
  while (node) {
    const cand = node.querySelector?.('.carouselmini .carouselmini-frame');
    if (cand) return cand;
    node = node.previousElementSibling;
  }
  // 2) 次に後方
  node = block.nextElementSibling;
  while (node) {
    const cand = node.querySelector?.('.carouselmini .carouselmini-frame');
    if (cand) return cand;
    node = node.nextElementSibling;
  }
  // 3) 全体から
  return document.querySelector('.carouselmini .carouselmini-frame');
}

/* ==== オーサリングのセル -> アイテム化 ==== */
function normalizeRowToItem(row) {
  const item = document.createElement('li');
  item.className = 'imagelink2-item';

  const link = row.querySelector('a[href]');
  const pic = row.querySelector('picture') || row.querySelector('img');

  if (link) {
    const a = document.createElement('a');
    a.href = link.getAttribute('href');
    const label = link.getAttribute('aria-label') || link.textContent?.trim() || '';
    if (label) a.setAttribute('aria-label', label);
    item.append(a);
    if (pic) a.appendChild(pic);
  } else if (pic) {
    const a = document.createElement('a');
    a.href = '#'; // 画像だけの場合でもレイアウト保持（あとで差し替え可）
    a.appendChild(pic);
    item.append(a);
  }

  return item;
}

/* ==== 幅・高さの同期 ==== */
function bindSizeSync(block, rightCol, cmFrame) {
  const applyWidth = () => {
    if (!rightCol) return;
    const rect = rightCol.getBoundingClientRect();
    if (rect.width > 0) block.style.setProperty('--imagelink2-width', `${Math.round(rect.width)}px`);
  };

  const applyHeight = () => {
    if (!cmFrame) return;
    const h = Math.round(cmFrame.getBoundingClientRect().height);
    if (h > 0) block.style.setProperty('--imagelink2-height', `${h}px`);
  };

  // 初期適用
  applyWidth();
  applyHeight();

  // 右カラム幅の監視
  if (rightCol) {
    const roW = new ResizeObserver(() => applyWidth());
    roW.observe(rightCol);
  }

  // carouselmini 画像高さの監視
  if (cmFrame) {
    const roH = new ResizeObserver(() => applyHeight());
    roH.observe(cmFrame);
  }

  // ウィンドウリサイズ
  window.addEventListener('resize', () => {
    applyWidth();
    applyHeight();
  });

  // 画像ロード後の反映（念のため）
  const img = cmFrame?.querySelector?.('img');
  if (img && !img.complete) {
    img.addEventListener('load', applyHeight, { once: true });
  }
}

/* ==== 右カラム末尾へブロックごと移動 ==== */
function moveBlockIntoRightColumn(block, rightCol) {
  if (!rightCol || !block || block.parentElement === rightCol) return;
  rightCol.appendChild(block);
}

/* ==== 軽微な画質系最適化 ==== */
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
  // 1) オーサリングの行を収集（2行想定だが冗長でもOK）
  const rows = qa(':scope > div', block);

  // 2) DOM再構築：<ul> に変換
  const list = document.createElement('ul');
  list.className = 'imagelink2-list';

  rows.forEach((row) => {
    const item = normalizeRowToItem(row);
    list.appendChild(item);
    row.remove();
  });

  block.appendChild(list);

  // 3) 近傍の imagelink右カラム と carouselmini画像 を取得
  const rightCol = findImagelinkRightNear(block);
  const cmFrame = findCarouselMiniFrameNear(block);

  // 4) ブロックを右カラムの直下に移動（配置要件）
  if (rightCol) moveBlockIntoRightColumn(block, rightCol);

  // 5) 幅（右カラム）・高さ（carouselmini画像）に同期
  bindSizeSync(block, rightCol, cmFrame);

  // 6) 画質周りの軽微調整
  perfTweakImages(block);
}
