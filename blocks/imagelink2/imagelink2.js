/**
 * imagelink2
 * - carouselmini と imagelink2 を横並び（.cm-inline-row）にする
 * - 近傍の .imagelink から右カラム幅を実測し、imagelink2 幅を強制一致
 * - ResizeObserver と画像 load 後にも追従
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function findSibling(root, cls, preferPrev = true) {
  let n = preferPrev ? root.previousElementSibling : root.nextElementSibling;
  while (n) {
    if (n.classList && n.classList.contains(cls)) return n;
    n = preferPrev ? n.previousElementSibling : n.nextElementSibling;
  }
  return null;
}

function findNearestInContainer(block, cls) {
  // 同じ親 <div> 内で前優先→後を検索
  return findSibling(block, cls, true) || findSibling(block, cls, false);
}

function findNearestImagelink(block) {
  // 同じ親から探し、見つからなければ最寄り上位→全体へ
  const local = findNearestInContainer(block, 'imagelink');
  if (local) return local;

  let p = block.parentElement;
  while (p) {
    const c = p.querySelector(':scope > .imagelink');
    if (c) return c;
    p = p.parentElement;
  }
  return $('.imagelink');
}

function measureImagelinkCols(imagelink) {
  if (!imagelink) return { left: 0, right: 0, total: 0, gap: 16 };
  const styles = getComputedStyle(imagelink);
  const gap = parseFloat(styles.columnGap || styles.gap) || 16;

  const total = Math.round(imagelink.getBoundingClientRect().width || 0);
  const leftEl  = imagelink.querySelector(':scope > div:first-child');
  const rightEl = imagelink.querySelector(':scope > div:nth-child(2)');

  const left  = Math.round(leftEl ?.getBoundingClientRect().width  || 0);
  let   right = Math.round(rightEl?.getBoundingClientRect().width || 0);

  if (!right && total && left) {
    right = Math.max(0, total - left - gap);
  }
  return { left, right, total, gap };
}

function ensureInlineRow(carouselmini, imagelink2) {
  if (!carouselmini || !imagelink2) return null;

  // 既にラップ済みならそれを返す
  if (carouselmini.parentElement === imagelink2.parentElement &&
      carouselmini.parentElement.classList?.contains('cm-inline-row')) {
    return carouselmini.parentElement;
  }

  // 2つを包むラッパを作成（先に来る方の位置に挿入）
  const row = document.createElement('div');
  row.className = 'cm-inline-row';

  const container = carouselmini.parentElement;
  const first = (carouselmini.compareDocumentPosition(imagelink2) & Node.DOCUMENT_POSITION_FOLLOWING)
    ? carouselmini : imagelink2;

  container.insertBefore(row, first);
  row.appendChild(carouselmini);
  row.appendChild(imagelink2);

  return row;
}

function applyWidths(row, imagelink, imagelink2) {
  const { left, right, gap } = measureImagelinkCols(imagelink);
  const leftW  = left  || 640;
  const rightW = right || 320;

  // CSS 変数に反映（行全体）
  row.style.setProperty('--cm-gap', `${Math.round(gap)}px`);
  row.style.setProperty('--cm-left-w',  `${leftW}px`);
  row.style.setProperty('--cm-right-w', `${rightW}px`);

  // 念のため imagelink2 にも inline 指定で強制（ブロック全幅化の保険）
  Object.assign(imagelink2.style, {
    width:    `${rightW}px`,
    maxWidth: `${rightW}px`,
    flex:     `0 0 ${rightW}px`,
  });
}

export default async function decorate(block) {
  // 画像のパフォーマンスヒント
  $all('img', block).forEach((img) => {
    if (!img.getAttribute('loading'))  img.setAttribute('loading',  'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // 近傍の carouselmini を取得（同じセクションの前優先）
  let cm = findNearestInContainer(block, 'carouselmini') ||
           findNearestInContainer(block, 'carousel'); // 念のため

  // DOM レンダリング待ち（他ブロックの decorate 後）を最大 2 秒までポーリング
  const start = performance.now();
  function waitForCM() {
    if (!cm) cm = findNearestInContainer(block, 'carouselmini') || findNearestInContainer(block, 'carousel');
    if (!cm && performance.now() - start < 2000) {
      requestAnimationFrame(waitForCM);
      return;
    }
    bootstrap();
  }

  function bootstrap() {
    // 横並びラップ
    const row = ensureInlineRow(cm, block) || block.parentElement;
    const il = findNearestImagelink(row);

    // 初期幅反映
    applyWidths(row, il, block);

    // 画像ロードやリサイズでも再計測
    const update = () => applyWidths(row, il, block);

    const ro = new ResizeObserver(update);
    [row, il].filter(Boolean).forEach((t) => ro.observe(t));

    window.addEventListener('resize', update);
    $all('img', il || document).forEach((im) => {
      if (im.complete) return;
      im.addEventListener('load', update, { once: true });
      im.addEventListener('error', update, { once: true });
    });
  }

  waitForCM();
}
