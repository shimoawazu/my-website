/**
 * imagelink2
 * - carouselmini と imagelink2 を横並び（.cm-inline-row）にする
 * - 近傍の .imagelink から「左カラム幅」「右カラム幅」を実測し、
 *   --cm-left-w / --cm-right-w に反映（= imagelink2 の幅は右カラム幅に完全一致）
 * - リサイズにも追従
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function findPrevByClass(el, cls) {
  let n = el.previousElementSibling;
  while (n) { if (n.classList?.contains(cls)) return n; n = n.previousElementSibling; }
  return null;
}
function findNextByClass(el, cls) {
  let n = el.nextElementSibling;
  while (n) { if (n.classList?.contains(cls)) return n; n = n.nextElementSibling; }
  return null;
}

/* 近傍の imagelink（幅参照元）を探す */
function findNearestImagelink(block) {
  // 同じ親内で前→後を優先して探索
  let n = block.previousElementSibling;
  while (n) { if (n.classList?.contains('imagelink')) return n; n = n.previousElementSibling; }
  n = block.nextElementSibling;
  while (n) { if (n.classList?.contains('imagelink')) return n; n = n.nextElementSibling; }
  // 最後の手段：ページ内の最初の imagelink
  return $('.imagelink');
}

/* imagelink から「左カラム」「右カラム（=2番目の子）」の実幅を計測 */
function measureImagelinkCols(imagelink, rowGap = 16) {
  if (!imagelink) return { left: 0, right: 0, total: 0 };
  const total = Math.round(imagelink.getBoundingClientRect().width || 0);

  const leftCol  = imagelink.querySelector(':scope > div:first-child');
  const rightCol = imagelink.querySelector(':scope > div:nth-child(2)');

  const left  = Math.round(leftCol ?.getBoundingClientRect().width  || 0);
  let   right = Math.round(rightCol?.getBoundingClientRect().width || 0);

  // 右が取得できない場合は推定（全体 - 左 - すき間）
  if (!right && total && left) {
    right = Math.max(0, total - left - Math.round(rowGap));
  }
  return { left, right, total };
}

/* 横並びラッパを作成 */
function ensureInlineRow(carouselmini, imagelink2) {
  if (!carouselmini || !imagelink2) return null;

  const sameParent = carouselmini.parentElement === imagelink2.parentElement;
  const already = sameParent && carouselmini.parentElement.classList?.contains('cm-inline-row');
  if (already) return carouselmini.parentElement;

  // 同じ親ならその場でラップ、違う親なら carouselmini 側に寄せる
  const row = document.createElement('div');
  row.className = 'cm-inline-row';
  const anchorParent = carouselmini.parentElement;

  anchorParent.insertBefore(row, carouselmini);
  row.appendChild(carouselmini);
  row.appendChild(imagelink2);

  return row;
}

/* 実測幅をラッパに適用 */
function applyWidths(row, imagelink) {
  if (!row || !imagelink) return;

  // 行のギャップ値を取得（cm-inline-row の --cm-gap）
  const gap = parseFloat(getComputedStyle(row).getPropertyValue('--cm-gap')) || 16;
  const { left, right } = measureImagelinkCols(imagelink, gap);

  // フォールバック：どちらか欠けたら比率で推定
  const rowWidth = Math.round(row.getBoundingClientRect().width || 0);
  let leftW  = left  || Math.round(rowWidth * 0.7);
  let rightW = right || Math.max(0, rowWidth - leftW - Math.round(gap));

  row.style.setProperty('--cm-left-w',  `${leftW}px`);
  row.style.setProperty('--cm-right-w', `${rightW}px`);
}

/* メイン */
export default async function decorate(block) {
  // 画像のパフォーマンスヒント
  $all('img', block).forEach((img) => {
    if (!img.getAttribute('loading'))  img.setAttribute('loading',  'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // 近接する carouselmini を探し、横並びを構成
  const start = performance.now();
  const timeoutMs = 2000;
  let cm = null;

  function boot() {
    if (!cm) {
      cm = findPrevByClass(block, 'carouselmini') || findNextByClass(block, 'carouselmini');
    }
    if (!cm) {
      if (performance.now() - start < timeoutMs) requestAnimationFrame(boot);
      return;
    }

    const row = ensureInlineRow(cm, block);
    if (!row) return;

    // imagelink を探して幅を同期
    const il = findNearestImagelink(row);
    const update = () => applyWidths(row, il);

    // 初期・画像ロード後・リサイズで更新
    update();
    const ro = new ResizeObserver(update);
    [row, il, row.parentElement].filter(Boolean).forEach((t) => ro.observe(t));
    window.addEventListener('resize', update);

    // ページ内画像の読込完了でも再計測
    $all('img', il || document).forEach((im) => {
      if (im.complete) return;
      im.addEventListener('load', update, { once: true });
      im.addEventListener('error', update, { once: true });
    });
  }

  boot();
}
