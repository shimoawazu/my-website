/**
 * imagelink block (EDS/Franklin)
 * オーサリング: 4行1列（行=1..4）。
 * レイアウト: 左に1行目(幅70%)、右に2..4行目を縦3分割(幅30%)。
 * 右の高さは左画像の実高に同期し、各サムネは左画像高の30%に設定。
 * 画像: loading="lazy", decoding="async" を付与。
 */

function q(sel, root = document) { return root.querySelector(sel); }

function findLinkAndPicture(cell) {
  const link = cell.querySelector('a[href]');
  const picture = cell.querySelector('picture') || cell.querySelector('img');
  let normalizedPicture = null;

  if (picture) {
    if (picture.tagName.toLowerCase() === 'picture') {
      normalizedPicture = picture;
    } else {
      // <img>のみ → <picture>でラップして最適化互換を確保
      const pic = document.createElement('picture');
      picture.replaceWith(pic);
      pic.append(picture);
      normalizedPicture = pic;
    }
  }
  return { link, picture: normalizedPicture };
}

function ensureImgPerfAttrs(picture) {
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

  const container = document.createElement('div');
  container.className = 'imagelink-thumb';

  if (href) {
    const a = document.createElement('a');
    a.className = 'imagelink-link';
    a.href = href;
    if (label) a.setAttribute('aria-label', label);
    a.append(container);
    tile.append(a);
  } else {
    tile.append(container);
  }

  if (picture) container.append(picture);
  return tile;
}

function deriveLabel(cell, link, picture) {
  const img = picture && picture.querySelector('img');
  const alt = img && img.getAttribute('alt');
  const linkText = link && link.textContent && link.textContent.trim();
  return (alt && alt.trim()) || linkText || '';
}

/* 左右の高さ同期：左画像の表示高 -> 右カラム全体、右の各サムネは 30% */
function syncHeights(root) {
  const leftImg = root.querySelector('.left-hero img');
  const right = root.querySelector('.right-stack');

  if (!leftImg || !right) return;

  const set = () => {
    // 表示サイズから計測（CSSスケール後の実高）
    const leftH = leftImg.getBoundingClientRect().height;
    if (leftH > 0) {
      right.style.height = `${leftH}px`;
      const items = right.querySelectorAll('.stack-item');
      const gap = parseFloat(getComputedStyle(right).gap || '0');
      const totalGap = gap * Math.max(0, items.length - 1);
      const each = Math.max(0, (leftH - totalGap) * 0.30); // 指定: 左画像高の30%
      items.forEach((it) => { it.style.height = `${each}px`; });
    }
  };

  // 画像ロード後・リサイズ時に反映
  if (leftImg.complete) set();
  else leftImg.addEventListener('load', set, { once: true });

  // 右側サムネ画像が後からロードされても縦伸びしないよう高さ固定済み
  const ro = new ResizeObserver(() => set());
  ro.observe(leftImg);
  window.addEventListener('resize', set);
}

export default function decorate(block) {
  // 元の4行1列セルを収集
  const cells = [];
  [...block.children].forEach((row) => {
    // 1列前提だが安全に全セル走査
    [...row.children].forEach((cell) => cells.push(cell));
  });

  // 1..4枚だけ採用（不足はスキップ）
  const entries = cells.slice(0, 4).map((cell) => {
    const { link, picture } = findLinkAndPicture(cell);
    if (!picture) return null;
    ensureImgPerfAttrs(picture);
    const href = link ? link.getAttribute('href') : null;
    const label = deriveLabel(cell, link, picture);
    return { href, picture, label };
  }).filter(Boolean);

  // DOM 再構築
  const layout = document.createElement('div');
  layout.className = 'imagelink-layout';

  // 左（1枚目）
  if (entries[0]) {
    const left = buildTile({
      href: entries[0].href,
      picture: entries[0].picture,
      label: entries[0].label,
      extraClass: 'left-hero',
    });
    layout.append(left);
  } else {
    // 画像が無ければそのまま終了
    block.textContent = '';
    return;
  }

  // 右（2..4枚）
  const right = document.createElement('div');
  right.className = 'right-stack';

  [entries[1], entries[2], entries[3]].forEach((ent) => {
    if (!ent) return;
    const item = buildTile({
      href: ent.href,
      picture: ent.picture,
      label: ent.label,
      extraClass: 'stack-item',
    });
    right.append(item);
  });

  layout.append(right);

  // 旧コンテンツを入れ替え
  block.textContent = '';
  block.append(layout);

  // 高さ同期
  syncHeights(block);
}
