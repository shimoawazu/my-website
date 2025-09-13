/**
 * carouselmini (3-up)
 * - ブロック内の各行をスライド化（最後の2枚も含めて全て対象）
 * - 3枚同時表示（--cm-per-view = 3）、3秒で1枚送り、無限ループ（クローン方式）
 * - インディケーターは画像枚数ぶん。左端に見えている実スライドに合わせて更新
 * - 幅は近傍の imagelink 左カラム幅に同期
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ===== 近傍 imagelink から左幅を測定 ===== */
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

/* ===== メイン ===== */
export default function decorate(block) {
  // 1) 既存行（画像行）を取得し、空なら終了
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

  // 既存行を抜いて配置
  rows.forEach((r) => r.remove());
  block.appendChild(leftRoot);

  // 3) 行 → スライド
  const slides = rows.map(makeSlideFromRow);
  slides.forEach((s) => track.appendChild(s));

  // 画像の軽微最適化
  perfTweakImages(block);

  // 4) 3枚同時表示のセットアップ
  const perView = 3;
  block.style.setProperty('--cm-per-view', String(perView));

  if (slides.length === 0) {
    indicators.style.display = 'none';
    return;
  }

  // 無限ループ用クローン（前後に perView 枚）
  const addClones = (count) => {
    const len = slides.length;
    // 左端側に末尾から count 枚を追加
    for (let i = 0; i < count; i += 1) {
      const src = slides[(len - count + i + len) % len];
      track.insertBefore(src.cloneNode(true), track.firstChild);
    }
    // 右端側に先頭から count 枚を追加
    for (let i = 0; i < count; i += 1) {
      const src = slides[i % len];
      track.appendChild(src.cloneNode(true));
    }
  };
  const cloneCount = Math.min(perView, slides.length);
  addClones(cloneCount);

  // インジケーター（実スライド数ぶん）
  slides.forEach((_, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Show slide ${i + 1}`);
    btn.addEventListener('click', () => goto(i + cloneCount));
    li.appendChild(btn);
    indicators.appendChild(li);
  });

  // 5) ステート／移動制御（仮想index = クローン込みの先頭からの位置）
  const unit = 100 / perView;        // 1スライドぶんの%移動量
  const virtualStart = cloneCount;    // 実スライドの先頭位置
  let virtualIndex = virtualStart;    // 左端に見えているスライドの仮想index
  let timer = null;

  function setActiveByVirtualIndex() {
    const realTotal = slides.length;
    // 左端に見えている「実スライド」のインデックス
    const realIndex = ((virtualIndex - cloneCount) % realTotal + realTotal) % realTotal;

    // アクティブ表示（任意）
    const allSlides = qa('.carouselmini-track > .carouselmini-slide', leftRoot);
    allSlides.forEach((s) => s.classList.remove('carouselmini-slide--active'));
    const target = allSlides[virtualIndex];
    if (target) target.classList.add('carouselmini-slide--active');

    // インジケーター更新
    qa('.carouselmini-indicators button', leftRoot).forEach((b, i) => {
      b.setAttribute('aria-current', i === realIndex ? 'true' : 'false');
    });
  }

  function applyTransform(withTransition = true) {
    track.style.transition = withTransition ? 'transform 400ms ease' : 'none';
    track.style.transform = `translateX(-${virtualIndex * unit}%)`;
  }

  function goto(nextVirtualIndex) {
    virtualIndex = nextVirtualIndex;
    applyTransform(true);
    setActiveByVirtualIndex();
  }

  function step(dir = 1) {
    goto(virtualIndex + dir);
  }

  // 初期位置へ
  applyTransform(false);
  setActiveByVirtualIndex();

  // 端での巻き戻し（瞬時ジャンプ）
  track.addEventListener('transitionend', () => {
    const realTotal = slides.length;
    if (virtualIndex >= realTotal + cloneCount) {
      virtualIndex -= realTotal;
      applyTransform(false);
      setActiveByVirtualIndex();
    } else if (virtualIndex < cloneCount) {
      virtualIndex += realTotal;
      applyTransform(false);
      setActiveByVirtualIndex();
    }
  });

  // 6) オートプレイ（3秒）
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function play() { stop(); if (slides.length > 0) timer = setInterval(() => step(1), 3000); }
  leftRoot.addEventListener('mouseenter', stop);
  leftRoot.addEventListener('focusin', stop);
  leftRoot.addEventListener('mouseleave', play);
  leftRoot.addEventListener('focusout', play);
  play();

  /* ===== 幅の同期（imagelink 左カラム） ===== */
  const imagelink = findImagelinkNear(block);
  const applyWidth = () => {
    let left = measureLeftWidthFromImagelink(imagelink);
    if (!left) {
      // フォールバック：親幅の 65%
      const wrapW = block.getBoundingClientRect().width || window.innerWidth;
      left = Math.round(wrapW * 0.65);
    }
    block.style.setProperty('--cm-left-w', `${left}px`);
  };
  applyWidth();

  const ro = new ResizeObserver(applyWidth);
  [imagelink, block].filter(Boolean).forEach((t) => ro.observe(t));

  // 画像ロード時の高さ変動に備えて再配置（% ベースなので特に不要だが微ブレ抑止）
  qa('img', viewport).forEach((im) => {
    if (!im.complete) im.addEventListener('load', () => applyWidth(), { once: true });
  });
  window.addEventListener('resize', applyWidth);
}
