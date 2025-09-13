/**
 * carouselmini
 * - 「画像カード」を横並びにし、PCで3枚（Tablet 2 / SP 1）見せるミニカルーセル
 * - 横幅は imagelink の左ヒーロー幅に自動追従（変数 --carouselmini-width を注入）
 * - カード比率は左ヒーローと同じ（--hero-ratio を注入）。不明なときは 16/9。
 *
 * オーサリング（Google Doc）:
 *   - 行方向に「画像(リンク可)」を並べるだけ（1行N列でも、N行1列でもOK）
 *   - Franklinのレンダリング後は <div class="carouselmini"> の直下に <div>… が複数並ぶ形
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function normalizeCellToItem(cell) {
  // <a><picture><img> などを包んだ「カード」DOMに組み替える
  const item = document.createElement('li');
  item.className = 'carouselmini-item';

  const frame = document.createElement('div');
  frame.className = 'carouselmini-frame';

  // 画像 or picture を探す（順不同）
  const anchor = cell.querySelector('a[href]');
  const pic = cell.querySelector('picture') || cell.querySelector('img');

  if (anchor) {
    const a = document.createElement('a');
    a.href = anchor.getAttribute('href');
    a.setAttribute('aria-label', anchor.textContent?.trim() || anchor.getAttribute('aria-label') || '');
    frame.append(a);

    // aの中に picture/img を入れる
    const target = a;
    if (pic) {
      if (pic.tagName.toLowerCase() === 'picture') {
        target.appendChild(pic);
      } else {
        // <img>のみ → そのまま入れる
        target.appendChild(pic);
      }
    }
  } else {
    // リンクが無い場合でも絵として表示
    frame.appendChild(document.createElement('div')).append(pic);
  }

  item.append(frame);
  return item;
}

/* imagelink の左ヒーロー（またはそれ相当）を見つけ、幅と比率を返す */
function findImagelinkLeft() {
  // 優先順で探索（同じセクションや直前のブロックを想定）
  const candidates = qa(`
    .block.imagelink .imagelink-left,
    .imagelink .imagelink-left,
    .imagelink > div:first-child,
    .imagelist .left-hero,
    .imagelist > div:first-child
  `);

  for (const el of candidates) {
    const img = el.querySelector('img');
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) {
      const ratio = img
        ? (Number(img.getAttribute('width')) || img.naturalWidth) /
          (Number(img.getAttribute('height')) || img.naturalHeight || 1)
        : NaN;
      return { el, width: rect.width, ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : NaN };
    }
  }
  return null;
}

/* imagelink 左ヒーローの幅/比率を監視して、carouselmini に渡す */
function bindImagelinkSync(block) {
  const apply = () => {
    const ref = findImagelinkLeft();
    if (!ref) return;
    const { el, ratio } = ref;

    // 幅は ResizeObserver で随時更新
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) block.style.setProperty('--carouselmini-width', `${Math.round(w)}px`);
    };
    updateWidth();

    // 比率（カードの aspect-ratio 用）
    if (Number.isFinite(ratio) && ratio > 0) {
      block.style.setProperty('--hero-ratio', ratio.toString());
    }

    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);

    // 左ヒーローの画像が後からロードされる場合にも追従
    const img = el.querySelector('img');
    if (img && !img.complete) {
      img.addEventListener('load', () => {
        const w = el.getBoundingClientRect().width;
        if (w > 0) block.style.setProperty('--carouselmini-width', `${Math.round(w)}px`);
        const r =
          (Number(img.getAttribute('width')) || img.naturalWidth) /
          (Number(img.getAttribute('height')) || img.naturalHeight || 1);
        if (r > 0) block.style.setProperty('--hero-ratio', r.toString());
      }, { once: true });
    }

    // ウィンドウリサイズ時も再計算
    window.addEventListener('resize', updateWidth);
  };

  // 少し遅延して周辺ブロックのレイアウトが固まってから参照
  requestAnimationFrame(apply);
}

/* ページ送り（1ページ＝現在の表示列数ぶん） */
function pageBy(block, dir = 1) {
  const scroller = q('.carouselmini-slides', block);
  if (!scroller) return;

  const styles = getComputedStyle(block);
  const gap = parseFloat(styles.getPropertyValue('--carouselmini-gap')) || 0;
  const cols = parseFloat(styles.getPropertyValue('--carouselmini-cols')) || 1;

  const item = scroller.querySelector('.carouselmini-item');
  if (!item) return;

  const itemWidth = item.getBoundingClientRect().width;
  const pageWidth = itemWidth * cols + gap * (cols - 1);

  scroller.scrollBy({ left: pageWidth * dir, behavior: 'smooth' });
}

export default function decorate(block) {
  // 既存の行/セルをカードに変換
  const cells = [];
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => cells.push(cell));
  });

  const items = cells
    .map((cell) => normalizeCellToItem(cell))
    .filter(Boolean);

  // ビューポート + スライドUL 構築
  const viewport = document.createElement('div');
  viewport.className = 'carouselmini-viewport';

  const list = document.createElement('ul');
  list.className = 'carouselmini-slides';
  items.forEach((it) => list.appendChild(it));

  // ナビボタン
  const nav = document.createElement('div');
  nav.className = 'carouselmini-nav';
  nav.innerHTML = `
    <button type="button" class="prev" aria-label="Previous"></button>
    <button type="button" class="next" aria-label="Next"></button>
  `;

  // 置き換え
  block.textContent = '';
  viewport.append(list, nav);
  block.append(viewport);

  // ナビイベント
  nav.querySelector('.prev')?.addEventListener('click', () => pageBy(block, -1));
  nav.querySelector('.next')?.addEventListener('click', () => pageBy(block, +1));

  // imagelink の左ヒーローと同期（幅・比率）
  bindImagelinkSync(block);

  // 軽微な最適化
  block.querySelectorAll('img').forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // ありがちなtypoを補正（webply → webp）
  block.querySelectorAll('source[srcset], img[src]').forEach((el) => {
    const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
    const val = el.getAttribute(attr);
    if (val && val.includes('format=webply')) {
      el.setAttribute(attr, val.replace(/format=webply/g, 'format=webp'));
    }
  });
}
