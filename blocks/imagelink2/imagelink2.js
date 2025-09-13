/**
 * imagelink2
 * - 直前の carouselmini と横並びラッパ .cm-inline-row を自動生成
 * - 幅：近傍の .imagelink から左幅・右幅を計測して --cm-left-w / --cm-right-w を設定
 * - 高さ：carouselmini の viewport 高に同期し、縦2枚合計で一致させる（--i2-item-h）
 * - すべてリサイズやスライド切替に追従
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* 兄弟方向に探すヘルパ */
function findPrevByClass(el, className) {
  let n = el.previousElementSibling;
  while (n) {
    if (n.classList?.contains(className)) return n;
    n = n.previousElementSibling;
  }
  return null;
}
function findNextByClass(el, className) {
  let n = el.nextElementSibling;
  while (n) {
    if (n.classList?.contains(className)) return n;
    n = n.nextElementSibling;
  }
  return null;
}

/* 近傍の imagelink を探す（左幅・全体幅取得に使用） */
function findNearestImagelink(block) {
  // 同じセクション内で前方優先
  let n = block.previousElementSibling;
  while (n) { if (n.classList?.contains('imagelink')) return n; n = n.previousElementSibling; }
  n = block.nextElementSibling;
  while (n) { if (n.classList?.contains('imagelink')) return n; n = n.nextElementSibling; }
  return $('.imagelink');
}

/* imagelink から左カラム幅（大きい画像の列）を推定 */
function measureImagelinkLeftWidth(imagelink) {
  if (!imagelink) return 0;
  // imagelink のレイアウト実情に合わせ、「左列」領域の幅を取得
  // 既存CSSで左列が最初の列ならそれを採用
  const leftCol = imagelink.querySelector(':scope > div:first-child');
  const leftW = Math.round(leftCol?.getBoundingClientRect().width || 0);
  // 左列幅が取れない場合は比率フォールバック（70%）
  if (!leftW) {
    const contW = imagelink.getBoundingClientRect().width || 0;
    return Math.round(contW * 0.7);
  }
  return leftW;
}

/* 横並びラッパ .cm-inline-row を挿入して carouselmini と imagelink2 を内包 */
function ensureInlineRow(carouselmini, imagelink2) {
  if (!carouselmini || !imagelink2) return null;
  const already = carouselmini.parentElement?.classList?.contains('cm-inline-row')
                && imagelink2.parentElement === carouselmini.parentElement;
  if (already) return carouselmini.parentElement;

  // 横並びラッパ
  const row = document.createElement('div');
  row.className = 'cm-inline-row';

  // DOM を row に移管：carouselmini -> row、imagelink2 -> row
  const parent = carouselmini.parentElement;
  parent.insertBefore(row, carouselmini);
  row.appendChild(carouselmini);
  row.appendChild(imagelink2);
  return row;
}

/* 高さ同期：carouselmini の viewport 高 -> imagelink2 へ適用 */
function applyHeights(imagelink2, carouselmini) {
  const viewport = $('.carouselmini-viewport', carouselmini) || carouselmini;
  const rect = viewport.getBoundingClientRect();
  const h = Math.round(rect.height);
  if (!h) return;

  const cs = getComputedStyle(imagelink2);
  const gap = parseFloat(cs.getPropertyValue('--i2-gap')) || 8;
  const perItem = Math.max(0, Math.round((h - gap) / 2));
  imagelink2.style.setProperty('--i2-item-h', `${perItem}px`);

  // 念のため画像にも直接適用（古いUA対策）
  $all('picture img, img', imagelink2).forEach((img) => {
    img.style.height = `${perItem}px`;
    img.style.width = '100%';
    img.style.objectFit = 'cover';
  });
}

/* 幅同期：imagelink から左右幅を算出し、ラッパにセット */
function applyWidths(row, imagelink) {
  if (!row || !imagelink) return;
  const contW = Math.round(imagelink.getBoundingClientRect().width || 0);
  const leftW = measureImagelinkLeftWidth(imagelink);
  const gap = parseFloat(getComputedStyle(row).getPropertyValue('--cm-gap')) || 16;
  const rightW = Math.max(0, contW - leftW - gap);

  row.style.setProperty('--cm-left-w', `${leftW}px`);
  row.style.setProperty('--cm-right-w', `${rightW}px`);
}

export default function decorate(block) {
  // 画像のパフォーマンスヒント
  $all('img', block).forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // 直前（理想）は carouselmini、無ければ前後を探索
  let cm = findPrevByClass(block, 'carouselmini') || findNextByClass(block, 'carouselmini');
  if (!cm) return; // ページに carouselmini が無ければ何もしない

  // 横並びラッパを作って2つを内包
  const row = ensureInlineRow(cm, block);
  if (!row) return;

  // 幅を imagelink に合わせる
  const il = findNearestImagelink(row);
  const updateWidths = () => applyWidths(row, il);
  updateWidths();

  // リサイズに追従
  const widthObsTargets = [row, il, row.parentElement].filter(Boolean);
  const roW = new ResizeObserver(updateWidths);
  widthObsTargets.forEach((t) => roW.observe(t));
  window.addEventListener('resize', updateWidths);

  // 高さを carouselmini に合わせる
  const updateHeights = () => applyHeights(block, cm);
  const viewport = $('.carouselmini-viewport', cm) || cm;
  const track = $('.carouselmini-track', cm);

  // 初回＋画像ロード後＋遷移後＋リサイズで同期
  requestAnimationFrame(updateHeights);

  const roH = new ResizeObserver(updateHeights);
  roH.observe(viewport);

  if (track) {
    track.addEventListener('transitionend', updateHeights);
  }

  [...$all('img', cm), ...$all('img', block)].forEach((img) => {
    if (!img.complete) img.addEventListener('load', updateHeights, { once: true });
  });
  window.addEventListener('resize', updateHeights);
}
