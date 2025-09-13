/**
 * imagelink2
 * 目的：
 * - carouselmini と imagelink2 を必ず横並び（.cm-inline-row）にする
 * - 幅は近傍の .imagelink から算出（左列=carouselmini、右列=imagelink2）
 * - リサイズにも追従
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* 兄弟探索 */
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

/* 近傍の imagelink（幅参照元） */
function findNearestImagelink(block) {
  // 同じ親内を優先して前→後の順に探索
  let n = block.previousElementSibling;
  while (n) { if (n.classList?.contains('imagelink')) return n; n = n.previousElementSibling; }
  n = block.nextElementSibling;
  while (n) { if (n.classList?.contains('imagelink')) return n; n = n.nextElementSibling; }
  // 最後の手段：ページ内の最初の imagelink
  return $('.imagelink');
}

/* imagelink から左列幅・全体幅を計測 */
function measureImagelinkWidths(imagelink) {
  if (!imagelink) return { left: 0, total: 0 };
  const total = Math.round(imagelink.getBoundingClientRect().width || 0);
  // 左側の大きい画像：最初の div を左列とみなす
  const leftCol = imagelink.querySelector(':scope > div:first-child');
  const left = Math.round(leftCol?.getBoundingClientRect().width || 0);
  return { left, total };
}

/* 横並び用のラッパを生成して2ブロックを内包 */
function ensureInlineRow(carouselmini, imagelink2) {
  if (!carouselmini || !imagelink2) return null;
  const same = carouselmini.parentElement === imagelink2.parentElement;
  const alreadyWrapped =
    same &&
    carouselmini.parentElement.classList?.contains('cm-inline-row');

  if (alreadyWrapped) return carouselmini.parentElement;

  if (same) {
    const parent = carouselmini.parentElement;
    const row = document.createElement('div');
    row.className = 'cm-inline-row';
    parent.insertBefore(row, carouselmini);
    row.appendChild(carouselmini);
    row.appendChild(imagelink2);
    return row;
  }

  // 親が異なる場合は carouselmini 側の直前にラッパを作り、両者を移動
  const row = document.createElement('div');
  row.className = 'cm-inline-row';
  const cmParent = carouselmini.parentElement;
  cmParent.insertBefore(row, carouselmini);
  row.appendChild(carouselmini);
  row.appendChild(imagelink2);
  return row;
}

/* 幅を算出してラッパに反映（左=carouselmini、右=imagelink2） */
function applyWidths(row, imagelink) {
  if (!row || !imagelink) return;
  const { left, total } = measureImagelinkWidths(imagelink);

  // フォールバック：左列が取れない場合は 70%
  const leftW = left || Math.round(total * 0.7);
  const gap = parseFloat(getComputedStyle(row).getPropertyValue('--cm-gap')) || 16;
  const rightW = Math.max(0, total - leftW - gap);

  row.style.setProperty('--cm-left-w', `${leftW}px`);
  row.style.setProperty('--cm-right-w', `${rightW}px`);
}

/* デコレータ本体 */
export default async function decorate(block) {
  // パフォーマンスヒント
  $all('img', block).forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // 近接する carouselmini を待ってから横並びを構成
  const startAt = performance.now();
  const timeoutMs = 2000;
  let cm = null;

  function trySetup() {
    if (!cm) {
      cm = findPrevByClass(block, 'carouselmini') || findNextByClass(block, 'carouselmini');
    }
    if (!cm) {
      if (performance.now() - startAt < timeoutMs) {
        requestAnimationFrame(trySetup);
      }
      return;
    }

    // 横並びラッパ化
    const row = ensureInlineRow(cm, block);
    if (!row) return;

    // imagelink を取得して幅同期
    const il = findNearestImagelink(row);
    const updateWidths = () => applyWidths(row, il);
    updateWidths();

    // リサイズに追従
    const roTargets = [row, il, row.parentElement].filter(Boolean);
    const ro = new ResizeObserver(updateWidths);
    roTargets.forEach((t) => ro.observe(t));
    window.addEventListener('resize', updateWidths);
  }

  trySetup();
}
