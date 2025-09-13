// imagelink2 を carouselmini の右横へ。
// - 同じ親要素内で carouselmini を見つけ、.cm-row ラッパーに包んで横並び。
// - 幅は imagelink の「左カラム（大）」と「右カラム（小）」の実測幅に合わせて
//   carouselmini / imagelink2 にインライン指定（画像読込後＆リサイズ時に再計算）。

function findPrevCarouselMini(block) {
  let el = block.previousElementSibling;
  while (el) {
    if (el.classList && el.classList.contains('carouselmini')) return el;
    el = el.previousElementSibling;
  }
  return null;
}

function imagesLoaded(root, cb) {
  const imgs = Array.from(root.querySelectorAll('img'));
  let pending = 0;
  if (imgs.length === 0) {
    cb();
    return;
  }
  imgs.forEach((img) => {
    if (!img.complete) {
      pending += 1;
      img.addEventListener('load', onDone, { once: true });
      img.addEventListener('error', onDone, { once: true });
    }
  });
  if (pending === 0) cb();

  function onDone() {
    pending -= 1;
    if (pending === 0) cb();
  }
}

function applyLayout({ row, carousel, imagelink2, imagelink }) {
  if (!row || !carousel || !imagelink2) return;

  // imagelink 全体幅で .cm-row をセンター寄せ（左右位置を揃える）
  const ilRect = imagelink ? imagelink.getBoundingClientRect() : null;

  // imagelink の左右カラムを取得（左=大、右=小）
  const leftCol  = imagelink ? imagelink.querySelector(':scope > div:nth-child(1)') : null;
  const rightCol = imagelink ? imagelink.querySelector(':scope > div:nth-child(2)') : null;

  // フォールバック：もし取れなければ現在の表示幅を使う
  const leftW  = leftCol  ? leftCol.getBoundingClientRect().width  : Math.max(320, carousel.getBoundingClientRect().width);
  const rightW = rightCol ? rightCol.getBoundingClientRect().width : Math.max(200, Math.round(leftW * 0.35));
  const totalW = ilRect ? ilRect.width : (leftW + rightW);

  // ラッパー幅（中央寄せで imagelink と左端を揃える）
  row.style.maxWidth = `${Math.round(totalW)}px`;
  row.style.marginLeft = 'auto';
  row.style.marginRight = 'auto';

  // 各ブロック幅をインライン指定（!important より強い）
  carousel.style.width = `${Math.round(leftW)}px`;
  imagelink2.style.width = `${Math.round(rightW)}px`;

  // 念のため横並び固定
  carousel.style.flex = '0 0 auto';
  imagelink2.style.flex = '0 0 auto';
}

export default function decorate(block) {
  const container = block.parentElement;          // imagelink2 の親
  if (!container) return;

  // 同じ親の中から直前側にある carouselmini を探す（確実に同階層の相棒を取る）
  const carousel = findPrevCarouselMini(block) || container.querySelector(':scope > .carouselmini');
  if (!carousel) return;

  // 既にラップ済みなら二重化しない
  if (carousel.parentElement && carousel.parentElement.classList.contains('cm-row')) {
    // 既存ラッパーに imagelink2 が入ってなければ移動
    if (block.parentElement !== carousel.parentElement) {
      carousel.parentElement.appendChild(block);
    }
  } else {
    // 新規に .cm-row を作って横並び
    const row = document.createElement('div');
    row.className = 'cm-row';
    container.insertBefore(row, carousel); // carousel の位置に挿入
    row.appendChild(carousel);
    row.appendChild(block);
  }

  const row = carousel.parentElement.classList.contains('cm-row')
    ? carousel.parentElement
    : null;
  if (!row) return;

  // imagelink（上段の横2カラム）を同じ親から取得
  const imagelink = container.querySelector(':scope > .imagelink');

  // 画像読み込み完了後に寸法を合わせ、その後リサイズでも追随
  const recalc = () => applyLayout({ row, carousel, imagelink2: block, imagelink });

  // imagelink/ carouselmini/ imagelink2 の画像を待ってから計測
  const waitTargets = [imagelink || container, carousel, block].filter(Boolean);
  let waits = waitTargets.length;
  waitTargets.forEach((rt) => {
    imagesLoaded(rt, () => {
      waits -= 1;
      if (waits === 0) recalc();
    });
  });

  // 念のため初期呼び
  recalc();

  // リサイズ時も再計算
  window.addEventListener('resize', recalc, { passive: true });
}
