/**
 * imagelink block
 * Authoring: Google Doc で 4行1列。各行に画像（リンク任意）。
 * Render: 左=1枚目 / 右=2〜4枚（縦3分割）。右の高さは左画像の実高に同期。
 * Note: 1枚目の想定は 1680x945（約16:9）、2〜4枚は 520x245 / 1040x490 / 1040x490 など。
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $$ (sel, root = document) { return [...root.querySelectorAll(sel)]; }

function findLinkAndPicture(cell) {
  const link = cell.querySelector('a[href]');
  const picOrImg = cell.querySelector('picture') || cell.querySelector('img');
  let picture = null;

  if (picOrImg) {
    if (picOrImg.tagName.toLowerCase() === 'picture') {
      picture = picOrImg;
    } else {
      // <img>のみ → <picture>でラップ（EDSの最適化互換性）
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
  if (img) {
    if (!img.loading) img.loading = 'lazy';
    if (!img.decoding) img.decoding = 'async';
  }
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

/** 左右の高さ同期：左画像の表示高 -> 右カラム全体、右アイテムは3等分 */
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
    const each = Math.max(60, (h - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length));
    items.forEach((el) => { el.style.height = `${each}px`; });
  };

  const rafApply = () => requestAnimationFrame(apply);

  // 初期＆ロード後
  if (leftImg.complete) rafApply();
  else leftImg.addEventListener('load', rafApply, { once: true });

  // リサイズ・ソース切替にも追従
  const ro = new ResizeObserver(rafApply);
  ro.observe(leftImg);
  window.addEventListener('resize', rafApply);

  // 右画像ロードでも再計算
  block.querySelectorAll('.imagelink-right img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', rafApply, { once: true });
  });
}

export default function decorate(block) {
  // Doc由来の「行→列」構造をフラット化して最初の4セルのみ採用
  const cells = [];
  [...block.children].forEach((row) => [...row.children].forEach((cell) => cells.push(cell)));

  const entries = cells.slice(0, 4).map((cell) => {
    const { link, picture } = findLinkAndPicture(cell);
    if (!picture) return null;
    perfAttrs(picture);
    const href = link ? link.getAttribute('href') : null;
    const label = labelFrom(cell, link, picture);
    return { href, picture, label };
  }).filter(Boolean);

  if (!entries.length) { block.textContent = ''; return; }

  // レイアウトDOMを必ず生成（これが無いと縦並びになる）
  const layout = document.createElement('div');
  layout.className = 'imagelink-layout';

  // 左（1枚目）
  const leftWrap = document.createElement('div');
  leftWrap.className = 'imagelink-left';
  leftWrap.append(buildTile({
    href: entries[0]?.href || null,
    picture: entries[0]?.picture || null,
    label: entries[0]?.label || '',
  }));
  layout.append(leftWrap);

  // 右（2〜4枚）
  const rightWrap = document.createElement('div');
  rightWrap.className = 'imagelink-right';
  [entries[1], entries[2], entries[3]].forEach((ent) => {
    if (!ent) return;
    rightWrap.append(buildTile({
      href: ent.href,
      picture: ent.picture,
      label: ent.label,
      extraClass: 'stack-item',
    }));
  });
  layout.append(rightWrap);

  // 置き換え
  block.textContent = '';
  block.append(layout);

  // 高さ同期
  syncHeights(block);
}
