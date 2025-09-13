/**
 * carouselmini (3-up)
 * - ブロック内の各行をそのままスライド化（最後の2枚も含む）
 * - 3枚同時表示、3秒で1枚送り、クローン方式の無限ループ
 * - 幅は近傍の imagelink 左カラム幅に同期
 * - 高さは「表示中の3枚の実高の最大値」を viewport に毎回セット（imagelink 高さとは無関係）
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ===== imagelink の左カラム幅を取得 ===== */
function findImagelinkNear(block) {
  const pick = (node) => node?.classList?.contains('imagelink') ? node : node?.querySelector?.('.imagelink');
  let n = block.previousElementSibling;
  while (n) { const r = pick(n); if (r) return r; n = n.previousElementSibling; }
  n = block.nextElementSibling;
  while (n) { const r = pick(n); if (r) return r; n = n.nextElementSibling; }
  return q('.imagelink');
}
function measureLeftWidthFromImagelink(root) {
  if (!root) return 0;
  const leftCol = root.querySelector(':scope > div:first-child') || root.firstElementChild;
  return Math.round(leftCol?.getBoundingClientRect().width || 0);
}

/* ===== スライド化ユーティリティ ===== */
function makeSlideFromRow(row) {
  const slide = document.createElement('div');
  slide.className = 'carouselmini-slide';
  const pic = row.querySelector('picture') || row.querySelector('img');
  if (pic) slide.appendChild(pic);
  return slide;
}

function perfTweakImages(root) {
  qa('img', root).forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });
  qa('source[srcset], img[src]', root).forEach((el) => {
    const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
    const v = el.getAttribute(attr);
    if (v && v.includes('format=webply')) el.setAttribute(attr, v.replace(/format=webply/g, 'format=webp'));
  });
}

/* ===== 表示中3枚の最大高さを viewport に反映 ===== */
function setViewportHeightForVisible(viewport, track, perView, virtualIndex) {
  const slidesAll = qa(':scope > .carouselmini-slide', track);
  if (slidesAll.length === 0) return;
  let maxH = 0;

  for (let k = 0; k < perView; k += 1) {
    const idx = virtualIndex + k;
    const s = slidesAll[idx];
    if (!s) continue;

    const img = s.querySelector('img') || s.querySelector('picture img');
    if (!img) continue;

    // スライドの現在の幅に対する画像の自然高を推定
    const sw = s.getBoundingClientRect().width || 0;
    let h = 0;
    if (img.naturalWidth && img.naturalHeight && sw) {
      h = (img.naturalHeight / img.naturalWidth) * sw;
    } else {
      h = img.getBoundingClientRect().height; // フォールバック
    }
    if (h > maxH) maxH = h;
  }

  if (maxH > 0) {
    viewport.style.height = `${Math.round(maxH)}px`;
  }
}

/* ===== メイン ===== */
export default function decorate(block) {
  // 1) 元の行を取得
  const rows = qa(':scope > div', block);
  if (rows.length === 0) return;

  // 2) DOM 構築
  const leftRoot = document.createElement('div');
  leftRoot.className = 'carouselmini-left';

  const viewport = document.createElement('div');
  viewport.className = 'carouselmini-viewport';

  const track = document.createElement('div');
  track.className = 'carouselmini-track';

  viewport.appendChild(track);
  leftRoot.appendChild(viewport);

  const indicators = document.createElement('ol');
  indicators.className = 'carouselmini-indicators';
  leftRoot.appendChild(indicators);

  // 既存行を除去して配置
  rows.forEach((r) => r.remove());
  block.appendChild(leftRoot);

  // 3) 行 → スライド
  const slides = rows.map(makeSlideFromRow);
  slides.forEach((s) => track.appendChild(s));

  perfTweakImages(block);

  // 4) 3枚同時表示
  const perView = 3;
  block.style.setProperty('--cm-per-view', String(perView));

  if (slides.length === 0) {
    indicators.style.display = 'none';
    return;
  }

  // 5) 無限ループ用に前後クローンを perView 枚追加
  const cloneCount = Math.min(perView, slides.length);
  const addClones = (count) => {
    const len = slides.length;
    // 左へ（末尾から count）
    for (let i = 0; i < count; i += 1) {
      const src = slides[(len - count + i + len) % len];
      track.insertBefore(src.cloneNode(true), track.firstChild);
    }
    // 右へ（先頭から count）
    for (let i = 0; i < count; i += 1) {
      const src = slides[i % len];
      track.appendChild(src.cloneNode(true));
    }
  };
  addClones(cloneCount);

  // 6) インジケーター（実スライド数ぶん）
  slides.forEach((_, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Show slide ${i + 1}`);
    btn.addEventListener('click', () => goto(i + cloneCount));
    li.appendChild(btn);
    indicators.appendChild(li);
  });

  // 7) ステート／移動制御
  const unit = 100 / perView;           // 1枚ぶんの%移動量
  const virtualStart = cloneCount;       // 実スライド先頭の仮想位置
  let virtualIndex = virtualStart;
  let timer = null;

  function updateIndicators() {
    const realTotal = slides.length;
    const realIndex = ((virtualIndex - cloneCount) % realTotal + realTotal) % realTotal;
    qa('.carouselmini-indicators button', leftRoot).forEach((b, i) => {
      b.setAttribute('aria-current', i === realIndex ? 'true' : 'false');
    });
  }

  function applyTransform(withTransition = true) {
    track.style.transition = withTransition ? 'transform 400ms ease' : 'none';
    track.style.transform = `translateX(-${virtualIndex * unit}%)`;
  }

  function refreshHeightSoon() {
    // レイアウト反映後に高さを計算
    requestAnimationFrame(() => {
      setViewportHeightForVisible(viewport, track, perView, virtualIndex);
    });
  }

  function goto(nextVirtualIndex) {
    virtualIndex = nextVirtualIndex;
    applyTransform(true);
    updateIndicators();
    refreshHeightSoon();
  }

  function step(dir = 1) {
    goto(virtualIndex + dir);
  }

  // 初期位置
  applyTransform(false);
  updateIndicators();
  refreshHeightSoon();

  // 端で瞬時巻き戻し
  track.addEventListener('transitionend', () => {
    const realTotal = slides.length;
    if (virtualIndex >= realTotal + cloneCount) {
      virtualIndex -= realTotal;
      applyTransform(false);
      updateIndicators();
      refreshHeightSoon();
    } else if (virtualIndex < cloneCount) {
      virtualIndex += realTotal;
      applyTransform(false);
      updateIndicators();
      refreshHeightSoon();
    }
  });

  // 8) オートプレイ（3秒）
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function play() { stop(); if (slides.length > 0) timer = setInterval(() => step(1), 3000); }
  leftRoot.addEventListener('mouseenter', stop);
  leftRoot.addEventListener('focusin', stop);
  leftRoot.addEventListener('mouseleave', play);
  leftRoot.addEventListener('focusout', play);
  play();

  /* ===== 幅同期（imagelink 左カラム） ===== */
  const imagelink = findImagelinkNear(block);
  const applyWidth = () => {
    let left = measureLeftWidthFromImagelink(imagelink);
    if (!left) {
      // フォールバック：ブロックの親幅
      const wrapW = block.parentElement?.getBoundingClientRect().width || block.getBoundingClientRect().width || window.innerWidth;
      left = Math.round(wrapW);
    }
    block.style.setProperty('--cm-left-w', `${left}px`);
    refreshHeightSoon(); // 幅が変われば高さも再計算
  };
  applyWidth();

  const ro = new ResizeObserver(() => {
    applyWidth();
  });
  [imagelink, block.parentElement, block].filter(Boolean).forEach((t) => ro.observe(t));

  // 画像ロード完了時にも高さ再計算
  qa('img', track).forEach((im) => {
    if (!im.complete) im.addEventListener('load', refreshHeightSoon, { once: true });
  });
  window.addEventListener('resize', applyWidth);
}
