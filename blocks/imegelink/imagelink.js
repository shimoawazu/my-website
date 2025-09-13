/**
 * imagelink block
 * 入力HTML想定（Franklin/EDSの表レンダリング後）:
 * <div class="imagelink">
 *   <div><div><a><picture><img ...></a></div></div>  ← 1枚目（左）
 *   <div><div><a><picture><img ...></a></div></div>  ← 2枚目（右 上）
 *   <div><div><a><picture><img ...></a></div></div>  ← 3枚目（右 中）
 *   <div><div><a><picture><img ...></a></div></div>  ← 4枚目（右 下）
 * </div>
 *
 * 出力：左(1枚目) + 右(2〜4枚) の2カラムに再構築
 * 右の総高さは左画像の実表示高さに同期し、3等分で綺麗に収める
 */

function $(sel, root = document) { return root.querySelector(sel); }

function getCellsFromBlock(block) {
  // block 直下の子div（= 行）を取り、その中の先頭div（= セル）を拾う
  const rows = Array.from(block.children);
  const cells = [];
  rows.forEach((row) => {
    const cell = row && row.firstElementChild ? row.firstElementChild : row;
    if (cell) cells.push(cell);
  });
  return cells;
}

function findLinkAndPicture(cell) {
  // a[href] と picture/img を検索（順不同）
  const link = cell.querySelector('a[href]');
  const picOrImg = cell.querySelector('picture') || cell.querySelector('img');
  let picture = null;

  if (picOrImg) {
    if (picOrImg.tagName.toLowerCase() === 'picture') {
      picture = picOrImg;
    } else {
      // <img>のみ → <picture>にラップ（最適化互換）
      const pic = document.createElement('picture');
      picOrImg.replaceWith(pic);
      pic.append(picOrImg);
      picture = pic;
    }
  }
  return { link, picture };
}

function perfAttrs(picture) {
  if (!picture) return;
  const img = picture.querySelector('img');
  if (!img) return;
  if (!img.loading) img.loading = 'lazy';
  if (!img.decoding) img.decoding = 'async';
}

function labelFrom(cell, link, picture) {
  const img = picture && picture.querySelector('img');
  const alt = img && img.getAttribute('alt');
  const linkText = link && link.textContent && link.textContent.trim();
  return (alt && alt.trim()) || linkText || '';
}

function buildTile({ href, picture, label, extraClass = '' }) {
  const tile = document.createElement('div');
  tile.className = `imagelink-tile ${extraClass}`.trim();

  const thumb = document.createElement('div');
  thumb.className = 'imagelink-thumb';

  if (href) {
    const a = document.createElement('a');
    a.className = 'imagelink-link';
    a.href = href;
    if (label) a.setAttribute('aria-label', label);
    a.append(thumb);
    tile.append(a);
  } else {
    tile.append(thumb);
  }

  if (picture) thumb.append(picture);
  return tile;
}

function syncHeights(block) {
  const leftImg = block.querySelector('.imagelink-left img');
  const right = block.querySelector('.imagelink-right');
  if (!leftImg || !right) return;

  const apply = () => {
    const h = leftImg.getBoundingClientRect().height;
    if (h <= 0) return;
    right.style.height = `${h}px`;

    const items = right.querySelectorAll('.stack-item');
    const gap = parseFloat(getComputedStyle(right).gap || '0');
    const n = Math.max(1, items.length);
    const totalGap = gap * Math.max(0, n - 1);
    const each = Math.max(60, (h - totalGap) / n);
    items.forEach((el) => { el.style.height = `${each}px`; });
  };

  const rafApply = () => requestAnimationFrame(apply);

  if (leftImg.complete) rafApply();
  else leftImg.addEventListener('load', rafApply, { once: true });

  const ro = new ResizeObserver(rafApply);
  ro.observe(leftImg);
  window.addEventListener('resize', rafApply);

  // 右側の画像ロード後にも再同期
  block.querySelectorAll('.imagelink-right img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', rafApply, { once: true });
  });
}

export default function decorate(block) {
  // 入力セル抽出（4つ想定）
  const rawCells = getCellsFromBlock(block).slice(0, 4);
  const items = rawCells.map((cell) => {
    const { link, picture } = findLinkAndPicture(cell);
    if (!picture) return null;
    perfAttrs(picture);
    const href = link ? link.getAttribute('href') : null;
    const label = labelFrom(cell, link, picture);
    return { href, picture, label };
  }).filter(Boolean);

  if (!items.length) { block.textContent = ''; return; }

  // レイアウトDOM生成（これが無いと縦並びになります）
  const layout = document.createElement('div');
  layout.className = 'imagelink-layout';

  // 左（1枚目）
  const leftWrap = document.createElement('div');
  leftWrap.className = 'imagelink-left';
  leftWrap.append(
    buildTile({
      href: items[0]?.href || null,
      picture: items[0]?.picture || null,
      label: items[0]?.label || '',
    })
  );

  // 右（2〜4枚）
  const rightWrap = document.createElement('div');
  rightWrap.className = 'imagelink-right';
  [items[1], items[2], items[3]].forEach((ent) => {
    if (!ent) return;
    rightWrap.append(
      buildTile({
        href: ent.href,
        picture: ent.picture,
        label: ent.label,
        extraClass: 'stack-item',
      })
    );
  });

  // 旧内容と置き換え
  block.textContent = '';
  layout.append(leftWrap, rightWrap);
  block.append(layout);

  // 高さ同期
  syncHeights(block);
}
