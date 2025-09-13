/**
 * imagelink block (Edge Delivery Services / Franklin)
 * 期待するオーサリング（Google Doc）:
 *  2×2の表（4セル）。各セルは以下いずれかでOK
 *   - 画像にリンクが巻かれている
 *   - リンク要素と画像要素が同じセルに並んでいる（順不同）
 *   - 画像だけ（その場合はリンク無しタイルとして表示）
 *
 * セマンティクス・アクセシビリティ:
 *  - img に loading="lazy" / decoding="async"
 *  - link の aria-label を alt またはリンクテキストから補完
 */

function findLinkAndPicture(cell) {
  const link = cell.querySelector('a[href]');
  // Franklin は <picture> を推奨。なければ <img> も許容
  const picture = cell.querySelector('picture') || cell.querySelector('img');

  // 画像が <img> のみで <picture> が無いとき、ラップ用に picture を生成
  let normalizedPicture = null;
  if (picture) {
    if (picture.tagName.toLowerCase() === 'picture') {
      normalizedPicture = picture;
    } else {
      // <img> を <picture> 相当にラップ（将来の最適化に備える）
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
    img.loading = img.loading || 'lazy';
    img.decoding = img.decoding || 'async';
    // 画像の自然サイズが極端に小さい場合でも拡大時のにじみを抑制
    img.setAttribute('width', img.getAttribute('width') || '');
    img.setAttribute('height', img.getAttribute('height') || '');
  }
}

function buildTile({ href, picture, label }) {
  const tile = document.createElement('div');
  tile.className = 'imagelink-tile';

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
    // リンクなしでもタイルとして表示（要件に応じて非表示にしたい場合はここで return null）
    tile.append(container);
  }

  if (picture) container.append(picture);
  return tile;
}

function deriveLabel(cell, link, picture) {
  // alt > リンクテキスト > 空
  const img = picture && picture.querySelector('img');
  const alt = img && img.getAttribute('alt');
  const linkText = link && link.textContent && link.textContent.trim();
  return (alt && alt.trim()) || linkText || '';
}

export default function decorate(block) {
  // ブロック初期DOMを「行→列」の入れ子からフラット化
  const cells = [];
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => cells.push(cell));
  });

  // 2×2に限らず柔軟に n 枚対応（今回は4枚想定）
  const tiles = [];
  cells.forEach((cell) => {
    const { link, picture } = findLinkAndPicture(cell);
    if (!picture) return; // 画像がないセルはスキップ
    ensureImgPerfAttrs(picture);

    // 画像にリンクが巻かれていないケースでは、cell内の別リンクを使う
    const href = link ? link.getAttribute('href') : null;
    const label = deriveLabel(cell, link, picture);
    const tile = buildTile({ href, picture, label });
    if (tile) tiles.push(tile);
  });

  // グリッド再構築
  const grid = document.createElement('div');
  grid.className = 'imagelink-grid';
  tiles.forEach((t) => grid.append(t));

  // 旧コンテンツを入れ替え
  block.textContent = '';
  block.append(grid);
}
