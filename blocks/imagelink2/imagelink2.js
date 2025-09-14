/**
 * .carouselmini と .imagelink2 を同じ親の中で横並びにする。
 * - 2つだけを <div class="mini-pair-row"> に包む（他の兄弟には影響しない）
 * - 幅は上段 .imagelink の左右カラムの実測値に合わせてインライン指定
 * - 右の2バナーの合計高さを左カルーセル画像の高さに合わせ、各バナーは半分ずつにする
 */

function qsa(el, sel) { return Array.from(el.querySelectorAll(sel)); }
function one(el, sel) { return el.querySelector(sel); }

function onceImagesLoaded(root, cb) {
  const imgs = qsa(root, 'img');
  let pending = imgs.filter((i) => !i.complete).length;
  if (pending === 0) return cb();
  const done = () => { if (--pending <= 0) cb(); };
  imgs.forEach((img) => {
    if (!img.complete) {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });
}

function makeRow(parent, leftBlock, rightBlock) {
  // すでに包まれていれば使い回し
  if (leftBlock.parentElement.classList.contains('mini-pair-row')) {
    const row = leftBlock.parentElement;
    if (rightBlock.parentElement !== row) row.appendChild(rightBlock);
    return row;
  }
  const row = document.createElement('div');
  row.className = 'mini-pair-row';
  // インラインで横並びを強制（テーマのCSSより優先される）
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginLeft: 'auto',
    marginRight: 'auto',
  });
  parent.insertBefore(row, leftBlock);
  row.appendChild(leftBlock);
  row.appendChild(rightBlock);
  return row;
}

function measureWidths(parent, row) {
  // 上段の .imagelink から「全体幅」と「右カラム幅」を推定
  const imagelink = one(parent, ':scope > .imagelink');
  const ilRect = imagelink?.getBoundingClientRect();
  const totalW = Math.round(ilRect?.width || row.getBoundingClientRect().width || parent.clientWidth || 1200);

  // 右カラムは .imagelink の2番目の子をサンプル（なければ最後の子）
  const rightProbe = imagelink?.querySelector(':scope > div:nth-child(2)') || imagelink?.querySelector(':scope > div:last-child');
  let rightW = Math.round(rightProbe?.getBoundingClientRect().width || totalW * 0.33);

  // 変な値の保険
  if (rightW >= totalW) rightW = Math.floor(totalW / 3);
  const gap = 16;
  const leftW = Math.max(200, totalW - rightW - gap);
  return { totalW, leftW, rightW, gap };
}

function applyLayout(row, carousel, il2, dims) {
  const { totalW, leftW, rightW } = dims;

  // 行の幅を上段 .imagelink と揃える
  Object.assign(row.style, {
    width: `${totalW}px`,
    maxWidth: `${totalW}px`,
  });

  // 子ブロックの幅をインラインで確定（100%化を防ぐ）
  Object.assign(carousel.style, {
    flex: '0 0 auto',
    width: `${leftW}px`,
    maxWidth: `${leftW}px`,
    boxSizing: 'border-box',
    display: 'block',
  });
  Object.assign(il2.style, {
    flex: '0 0 auto',
    width: `${rightW}px`,
    maxWidth: `${rightW}px`,
    boxSizing: 'border-box',
    display: 'block',
  });
}

function syncHeights(carousel, il2) {
  // 左のカルーセルの表示中画像の高さを取得
  const carImg = one(carousel, 'img');
  if (!carImg) return;
  const ch = Math.round(carImg.getBoundingClientRect().height);
  if (!ch) return;

  const gap = 16;
  const each = Math.max(1, Math.floor((ch - gap) / 2));

  // 右2枚を半々に
  const imgs = qsa(il2, 'img');
  imgs.forEach((img) => {
    img.style.width = '100%';
    img.style.height = `${each}px`;
    img.style.objectFit = 'cover';
    const pic = img.closest('picture');
    if (pic) {
      pic.style.display = 'block';
      pic.style.height = `${each}px`;
      pic.style.width = '100%';
    }
  });
}

function debounce(fn, ms = 150) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export default function decorate(block) {
  // imagelink2 自身
  const il2 = block;
  const parent = il2.parentElement;
  if (!parent) return;

  // 同階層の .carouselmini を必須とする
  const carousel = one(parent, ':scope > .carouselmini');
  if (!carousel) return;

  // 2つだけを横並びに包む
  const row = makeRow(parent, carousel, il2);

  const recalc = () => {
    const dims = measureWidths(parent, row);
    applyLayout(row, carousel, il2, dims);
    syncHeights(carousel, il2);
  };

  // 画像ロード後に厳密計測
  let waitTargets = [parent, carousel, il2].filter(Boolean);
  let pending = waitTargets.length;
  const done = () => { if (--pending === 0) recalc(); };
  waitTargets.forEach((t) => onceImagesLoaded(t, done));

  // 即時一回（すぐ取れる寸法があれば先に適用）
  recalc();

  // リサイズ時追随
  window.addEventListener('resize', debounce(recalc, 150), { passive: true });
}
