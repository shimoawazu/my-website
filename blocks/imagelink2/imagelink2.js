/**
 * imagelink2
 * - 直近の carouselmini の viewport 高さに合わせて、
 *   縦2枚の合計高さ＝carouselmini の高さ になるよう各画像の高さを自動調整
 * - 監視タイミング：ResizeObserver（viewport）、transitionend（スライド切替）、
 *   画像 load、window resize
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/** 直近の carouselmini ブロックを探す */
function findNearestCarouselmini(block) {
  const isCM = (el) => el?.classList?.contains('carouselmini');
  // まず兄弟を前方に
  let n = block.previousElementSibling;
  while (n) { if (isCM(n)) return n; n = n.previousElementSibling; }
  // 次に後方
  n = block.nextElementSibling;
  while (n) { if (isCM(n)) return n; n = n.nextElementSibling; }
  // なければページ内の最初
  return $('.carouselmini');
}

/** gap(px) を取得（CSS変数 --i2-gap が優先。なければ computed gap/row-gap） */
function getGapPx(el) {
  const cs = getComputedStyle(el);
  const varGap = cs.getPropertyValue('--i2-gap').trim();
  if (varGap) {
    const v = parseFloat(varGap);
    if (!Number.isNaN(v)) return v;
  }
  const gap = parseFloat(cs.getPropertyValue('row-gap') || cs.getPropertyValue('gap')) || 0;
  return gap;
}

/** 高さを計算して --i2-item-h をセット */
function applyHeights(block, viewportHeight) {
  if (!viewportHeight) return;
  const gap = getGapPx(block);
  const perItem = Math.max(0, Math.round((viewportHeight - gap) / 2));
  block.style.setProperty('--i2-item-h', `${perItem}px`);

  // 念のため、画像自体にも直接反映（CSS変数が効かない古い UA 対策）
  $all('picture img, img', block).forEach((img) => {
    img.style.height = `${perItem}px`;
    img.style.width = '100%';
    img.style.objectFit = 'cover';
  });
}

/** carouselmini viewport の現在の高さ（px）を取得 */
function getViewportHeight(carouselmini) {
  const viewport = $('.carouselmini-viewport', carouselmini) || carouselmini;
  const rect = viewport.getBoundingClientRect();
  return Math.round(rect.height);
}

export default function decorate(block) {
  // 画像の perf ヒント
  $all('img', block).forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  const cm = findNearestCarouselmini(block);
  if (!cm) return; // 近傍に carouselmini が無ければ何もしない

  const viewport = $('.carouselmini-viewport', cm) || cm;
  const track = $('.carouselmini-track', cm);

  // 初回適用（レイアウト確定後に実行）
  const initial = () => applyHeights(block, getViewportHeight(cm));
  requestAnimationFrame(initial);

  // viewport のサイズ変化を監視（スライドごとに高さが変わる場合にも追従）
  const ro = new ResizeObserver(() => {
    applyHeights(block, getViewportHeight(cm));
  });
  ro.observe(viewport);

  // スライドのアニメ完了時にも再計算（高さが一拍遅れて更新されるケース対策）
  if (track) {
    track.addEventListener('transitionend', () => {
      applyHeights(block, getViewportHeight(cm));
    });
  }

  // carouselmini / imagelink2 内の画像ロード後にも再計算
  [...$all('img', cm), ...$all('img', block)].forEach((img) => {
    if (!img.complete) img.addEventListener('load', () => {
      applyHeights(block, getViewportHeight(cm));
    }, { once: true });
  });

  // 画面リサイズ
  window.addEventListener('resize', () => {
    applyHeights(block, getViewportHeight(cm));
  });
}
