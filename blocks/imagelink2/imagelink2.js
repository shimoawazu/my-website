/**
 * imagelink2
 * - 高さ：近傍 carouselmini の .carouselmini-frame 実高さに同期（ResizeObserver）
 *         無ければ最初の画像のアスペクト比から自動算出（フォールバック）
 * - 幅　：近傍 imagelink の右カラム実幅に同期（ResizeObserver）
 * - 配置：imagelink ブロック（全体）の「直後」にこのブロックを移動
 *         → 右側画像群の“下”に来る。CSSで右端へ寄せる
 * - 構造：オーサリング2行 → <ul><li> に変換
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function findImagelinkPartsNear(block) {
  let nearRoot = null;
  let rightCol = null;

  // 兄弟を近い順に探索して imagelink ルートを掴む
  let node = block.previousElementSibling;
  while (node) {
    const rootCand = node.classList?.contains('imagelink') ? node : node.querySelector?.('.imagelink');
    if (rootCand) { nearRoot = rootCand; break; }
    node = node.previousElementSibling;
  }
  if (!nearRoot) nearRoot = q('.imagelink');

  if (nearRoot) {
    rightCol =
      nearRoot.querySelector('.imagelink-right') ||
      nearRoot.querySelector(':scope > .imagelink__right') ||
      nearRoot.querySelector(':scope > div:last-child');
  }
  return { imagelinkRoot: nearRoot, rightCol };
}

function findCarouselMiniFrameNear(block) {
  let node = block.previousElementSibling;
  while (node) {
    const cand = node.querySelector?.('.carouselmini .carouselmini-frame');
    if (cand) return cand;
    node = node.previousElementSibling;
  }
  node = block.nextElementSibling;
  while (node) {
    const cand = node.querySelector?.('.carouselmini .carouselmini-frame');
    if (cand) return cand;
    node = node.nextElementSibling;
  }
  return q('.carouselmini .carouselmini-frame');
}

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

function bindSizeSync(block, rightCol, cmFrame) {
  const applyWidth = () => {
    const base = rightCol || block.parentElement;
    if (!base) return;
    const w = Math.round(base.getBoundingClientRect().width);
    if (w > 0) block.style.setProperty('--imagelink2-width', `${w}px`);
  };

  const heightFromFrame = () => {
    if (!cmFrame) return 0;
    return Math.round(cmFrame.getBoundingClientRect().height);
  };

  const heightFromFirstImage = () => {
    const img = q('.imagelink2-item img', block);
    if (!img) return 0;
    const w = img.naturalWidth || parseInt(img.getAttribute('width'), 10) || 0;
    const h = img.naturalHeight || parseInt(img.getAttribute('height'), 10) || 0;
    if (w > 0 && h > 0) {
      const bw = block.getBoundingClientRect().width || w;
      const totalH = Math.round((bw * h) / w);
      return Math.max(120, totalH);
    }
    return 0;
  };

  const applyHeight = () => {
    let h = heightFromFrame();
    if (!h || h <= 0) h = heightFromFirstImage();
    if (h && h > 0) block.style.setProperty('--imagelink2-height', `${h}px`);
  };

  applyWidth();
  applyHeight();

  if (rightCol) {
    const roW = new ResizeObserver(applyWidth);
    roW.observe(rightCol);
  } else if (block.parentElement) {
    const roW = new ResizeObserver(applyWidth);
    roW.observe(block.parentElement);
  }
  if (cmFrame) {
    const roH = new ResizeObserver(applyHeight);
    roH.observe(cmFrame);
  }

  const anyImg = q('.imagelink2-item img', block);
  if (anyImg && !anyImg.complete) {
    anyImg.addEventListener('load', () => { applyWidth(); applyHeight(); }, { once: true });
  }

  window.addEventListener('resize', () => { applyWidth(); applyHeight(); });
}

function moveBlockAfterImagelink(block, imagelinkRoot) {
  if (!imagelinkRoot || !imagelinkRoot.parentNode) return;
  const parent = imagelinkRoot.parentNode;
  if (block.previousElementSibling === imagelinkRoot) return;
  parent.insertBefore(block, imagelinkRoot.nextSibling);
}

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

export default function decorate(block) {
  const rows = qa(':scope > div', block);
  const list = document.createElement('ul');
  list.className = 'imagelink2-list';
  rows.forEach((row) => {
    const item = normalizeRowToItem(row);
    list.appendChild(item);
    row.remove();
  });
  block.appendChild(list);

  const { imagelinkRoot, rightCol } = findImagelinkPartsNear(block);
  const cmFrame = findCarouselMiniFrameNear(block);

  if (imagelinkRoot) moveBlockAfterImagelink(block, imagelinkRoot);

  bindSizeSync(block, rightCol, cmFrame);

  perfTweakImages(block);
}
