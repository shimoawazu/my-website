/**
 * imagelink block
 * Authoring: 4行1列（各行に画像＋任意でリンク）
 * Render: 左=1行目(70%) / 右=2〜4行目を縦3分割(30%)
 * 右の高さは左画像の表示高に自動同期して等分
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function findLinkAndPicture(cell) {
  const link = cell.querySelector('a[href]');
  const picOrImg = cell.querySelector('picture') || cell.querySelector('img');
  let picture = null;

  if (picOrImg) {
    if (picOrImg.tagName.toLowerCase() === 'picture') {
      picture = picOrImg;
    } else {
      // <img>のみ → <picture>にラップ
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

function buildTile({ href, picture, label, extraClass = '' }) {
  const tile = document.createElement('div');
  tile.className = `imagelink-tile ${extraClass}`.trim();

  const thumb = document.createElement('div');
  thumb.className = 'imagelink-thumb';

  let wrap = thumb;
  if (href) {
    const a = document.createElement('a');
    a.className = 'imagelink-link';
    a.href = href;
    if (label) a.setAttribute('aria-label', label);
    a.append(thumb);
    wrap = a;
  }
  if (picture) thumb.append(picture);

  tile.append(wrap);
  return tile;
}

function labelFrom(cell, link, picture) {
  const img = picture && picture.querySelector('img');
  const alt = img && img.getAttribute('alt');
  const linkText = link && link.textContent && link.textContent.trim();
  return (alt && alt.trim()) || linkText || '';
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
    const each = Math.max(60, (h - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length));
    items.forEach((el) => { el.style.height = `${each}px`; });
  };

  const rafApply = () => requestAnimationFrame(apply);

  if (leftImg.complete) rafApply();
  else leftImg.addEventListener('load', rafApply, { once: true });

  // リサイズやフォントロード等で再計測
  const ro = new ResizeObserver(rafApply);
  ro.observe(leftImg);
  window.addEventListener('resize', rafApply);

  // 右側の画像ロードでも再同期
  block.querySelectorAll('.imagelink-right img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', rafApply, { once: true });
  });
}

export default function decorate(block) {
  // 元セル取得（4行1列想定）
  const cells = [];
  [...block.children].forEach((row) => [...row.children].forEach((cell) => cells.push(cell)));

  // 4枚だけ採用
  const entries = cells.slice(0, 4).map((cell) => {
    const { link, picture } = findLinkAndPicture(cell);
    if (!picture) return null;
    perfAttrs(picture);
    const href = link ? link.getAttribute('href') : null;
    const label = labelFrom(cell, link, picture);
    return { href, picture, label };
  }).filter(Boolean);

  if (!entries.length) { block.textContent = ''; return; }

  // レイアウトDOMを必ず生成
  const layout = document.createElement('div');
  layout.className = 'imagelink-layout';

  // 左
  const leftWrap = document.createElement('div');
  leftWrap.className = 'imagelink-left';
  leftWrap.append(buildTile({
    href: entries[0]?.href || null,
    picture: entries[0]?.picture || null,
    label: entries[0]?.label || '',
  }));
  layout.append(leftWrap);

  // 右
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

  // 同期
  syncHeights(block);
}
