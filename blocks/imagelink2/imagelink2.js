/**
 * imagelink2
 * - 高さ：近傍 carouselmini の .carouselmini-frame 実高さに同期（ResizeObserver）
 *         無ければ最初の画像のアスペクト比から自動算出（フォールバック）
 * - 幅　：近傍 imagelink の右カラム実幅に同期（ResizeObserver）
 * - 配置：imagelink ブロック（全体）の「直後」にこのブロックを移動
 *         → 右側画像群の“下”に来る。右寄せは CSS/JS 両方で担保。
 * - 構造：オーサリング2行 → <ul><li> に変換
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ==== 近傍の imagelink 右カラム＆ルートを探す ==== */
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

/* ==== 近傍の carouselmini 画像フレームを探す ==== */
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

/* ==== row -> li へ正規化 ==== */
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

/* ==== 幅・高さの同期（フォールバック含む） ==== */
function bindSizeSync(block, rightCol, cmFrame) {
  const applyWidth = () => {
    const base = rightCol || block.parentElement;
    if (!base) return;
    const w = Math.round(base.getBoundingClientRect().width);
    if (w > 0) {
      block.style.setProperty('--imagelink2-width', `${w}px`);
      // 右寄せを JS でも明示（親がflex/gridでも効く）
      block.style.width = `${w}px`;
      block.style.marginLeft = 'auto';
      block.style.marginRight = '0';
      block.style.justifySelf = 'end';   // CSS Grid 親のとき
      block.style.alignSelf = 'start';   // 必要に応じて
    }
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
    if (h && h > 0) {
      block.style.setProperty('--imagelink2-height', `${h}px`);
      block.style.height = `${h}px`;
    }
  };

  // 初期
  applyWidth();
  applyHeight();

  // 監視
  const roList = [];
  if (rightCol) {
    const roW = new ResizeObserver(applyWidth);
    roW.observe(rightCol);
    roList.push(roW);
  } else if (block.parentElement) {
    const roW = new ResizeObserver(applyWidth);
    roW.observe(block.parentElement);
    roList.push(roW);
  }
  if (cmFrame) {
    const roH = new ResizeObserver(applyHeight);
    roH.observe(cmFrame);
    roList.push(roH);
  }

  // 画像ロード後
  const anyImg = q('.imagelink2-item img', block);
  if (anyImg && !anyImg.complete) {
    anyImg.addEventListener('load', () => { applyWidth(); applyHeight(); }, { once: true });
  }

  window.addEventListener('resize', () => { applyWidth(); applyHeight(); });
}

/* ==== imagelink ブロックの直後に移動（右群の下） ==== */
function moveBlockAfterImagelink(block, imagelinkRoot) {
  if (!imagelinkRoot || !imagelinkRoot.parentNode) return;
  const parent = imagelinkRoot.parentNode;
  if (block.previousElementSibling === imagelinkRoot) return;
  parent.insertBefore(block, imagelinkRoot.nextSibling);
}

/* ==== 軽微な画質最適化 ==== */
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
  // 1) オーサリング行 → <ul> に組み替え
  const rows = qa(':scope > div', block);
  const list = document.createElement('ul');
  list.className = 'imagelink2-list';

  rows.forEach((row) => {
    const item = normalizeRowToItem(row);
    list.appendChild(item);
    row.remove();
  });
  block.appendChild(list);

  // 2) 近傍要素の取得
  const { imagelinkRoot, rightCol } = findImagelinkPartsNear(block);
  const cmFrame = findCarouselMiniFrameNear(block);

  // 3) imagelink ブロックの直後に移動（＝右側画像の“下”）
  if (imagelinkRoot) {
    moveBlockAfterImagelink(block, imagelinkRoot);
  }

  // 4) サイズ同期（幅=右カラム or 親、 高さ=carouselmini or フォールバック）
  bindSizeSync(block, rightCol, cmFrame);

  // 5) 画質まわり
  perfTweakImages(block);

  // 6) 念のため：右寄せをクラスでも強制できるように
  block.classList.add('imagelink2--right');
}
