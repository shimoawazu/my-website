/**
 * carouselmini
 * - ブロック内の行から「最後の2行」を右側の画像リンク列へ、残りを左のスライダーへ
 * - 左スライダーは 3 枚同時表示（--cm-per-view = 3）
 * - 無限ループ（クローン方式）＆ 3秒オートプレイ（ホバー/フォーカスで一時停止）
 * - 幅は imagelink の左/右カラム幅に同期、右列は右端揃え
 * - 右列の高さは左スライダーの“表示中の画像”の実高さに同期
 */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ===== 近傍 imagelink から左右の幅を測定 ===== */
function findImagelinkNear(block) {
  const pick = (node) => node?.classList?.contains('imagelink') ? node : node?.querySelector?.('.imagelink');
  let n = block.previousElementSibling;
  while (n) { const r = pick(n); if (r) return r; n = n.previousElementSibling; }
  n = block.nextElementSibling;
  while (n) { const r = pick(n); if (r) return r; n = n.nextElementSibling; }
  return q('.imagelink');
}

function measureColumnsFromImagelink(root) {
  if (!root) return { left: 0, right: 0 };
  const leftCol = root.querySelector(':scope > div:first-child') || root.firstElementChild;
  const rightCol = root.querySelector(':scope > div:last-child') || root.lastElementChild;
  const left = Math.round(leftCol?.getBoundingClientRect().width || 0);
  const right = Math.round(rightCol?.getBoundingClientRect().width || 0);
  return { left, right };
}

/* ===== 可視中の画像（左スライダー内） ===== */
function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
}
function currentVisibleImg(leftRoot) {
  // 「アクティブ」クラス優先、なければ先頭の img
  return (
    leftRoot.querySelector('.carouselmini-slide--active img') ||
    leftRoot.querySelector('.carouselmini-slide picture > img') ||
    leftRoot.querySelector('.carouselmini-slide img')
  );
}

/* ===== 行正規化 ===== */
function makeSlideFromRow(row) {
  const slide = document.createElement('div');
  slide.className = 'carouselmini-slide';
  const pic = row.querySelector('picture') || row.querySelector('img');
  if (pic) slide.appendChild(pic);
  return slide;
}

function makeLinkFromRow(row) {
  const wrap = document.createElement('div');
  wrap.className = 'carouselmini-link';
  const aSrc = row.querySelector('a[href]');
  const pic = row.querySelector('picture') || row.querySelector('img');
  const a = document.createElement('a');
  a.href = aSrc ? aSrc.getAttribute('href') : '#';
  const label = aSrc?.getAttribute('aria-label') || aSrc?.textContent?.trim();
  if (label) a.setAttribute('aria-label', label);
  if (pic) a.appendChild(pic);
  wrap.appendChild(a);
  return wrap;
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
  // 1) オーサリング行を取得
  const rows = qa(':scope > div', block);
  if (rows.length === 0) return;

  // 2) 「最後の2行」をリンク列へ、残りをスライダーへ
  const linkRows = rows.slice(-2);
  const slideRows = rows.slice(0, Math.max(0, rows.length - 2));

  // 3) ベース DOM 構造
  const pair = document.createElement('div');
  pair.className = 'carouselmini-pair';

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

  const rightRoot = document.createElement('div');
  rightRoot.className = 'carouselmini-right';

  pair.appendChild(leftRoot);
  pair.appendChild(rightRoot);

  // 既存 row を除去し、pair を設置
  rows.forEach((r) => r.remove());
  block.appendChild(pair);

  // 4) スライド/リンク生成
  const slides = slideRows.map(makeSlideFromRow);
  slides.forEach((s) => track.appendChild(s));

  const links = linkRows.map(makeLinkFromRow);
  links.forEach((l) => rightRoot.appendChild(l));

  // 画像の軽微最適化
  perfTweakImages(block);

  // 5) 3枚同時表示のためのセットアップ
  const perView = 3; // 必須要件
  block.style.setProperty('--cm-per-view', String(perView));

  // スライドが perView 未満ならオート/インジケータ無効化（そのまま静的表示）
  if (slides.length === 0) {
    indicators.style.display = 'none';
    return;
  }

  // クローン追加（無限ループ用）：前後に perView 枚
  const addClones = (count) => {
    const len = slides.length;
    // 先頭側（左端）に末尾から count 枚
    for (let i = 0; i < count; i += 1) {
      const src = slides[len - count + i] || slides[(len - 1 + i) % len];
      track.insertBefore(src.cloneNode(true), track.firstChild);
    }
    // 末尾側（右端）に先頭から count 枚
    for (let i = 0; i < count; i += 1) {
      const src = slides[i % len];
      track.appendChild(src.cloneNode(true));
    }
  };
  const cloneCount = Math.min(perView, slides.length);
  addClones(cloneCount);

  // インジケーター（実スライド枚数ぶん）
  slides.forEach((_, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Show slide ${i + 1}`);
    btn.addEventListener('click', () => goto(i + cloneCount)); // 仮想indexへ移動
    li.appendChild(btn);
    indicators.appendChild(li);
  });

  // 6) ステートと移動制御（仮想index = クローンを含む先頭からの位置）
  const unit = 100 / perView;                 // 1スライドぶんの%移動量
  const virtualStart = cloneCount;            // 実スライドの先頭位置
  let virtualIndex = virtualStart;            // 現在の仮想index（左端のスライド基準）
  let timer = null;

  function setActiveByVirtualIndex() {
    const realTotal = slides.length;
    const realIndex = ((virtualIndex - cloneCount) % realTotal + realTotal) % realTotal;
    // アクティブスライドの見た目（任意）
    qa('.carouselmini-slide', leftRoot).forEach((s) => s.classList.remove('carouselmini-slide--active'));
    // クローンを含むノード配列
    const allSlides = qa('.carouselmini-track > .carouselmini-slide', leftRoot);
    const target = allSlides[virtualIndex];
    if (target) target.classList.add('carouselmini-slide--active');

    // インジケーター
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
    const totalWithClones = realTotal + cloneCount * 2;
    // 右端側（末尾クローン群）へ到達したら先頭へ巻き戻し
    if (virtualIndex >= realTotal + cloneCount) {
      virtualIndex -= realTotal;
      applyTransform(false);
      setActiveByVirtualIndex();
    }
    // 左端側（先頭クローン群）へ到達したら末尾へ巻き戻し
    if (virtualIndex < cloneCount) {
      virtualIndex += realTotal;
      applyTransform(false);
      setActiveByVirtualIndex();
    }
  });

  // 7) オートプレイ（3秒）
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function play() { stop(); if (slides.length > perView - 1) timer = setInterval(() => step(1), 3000); }
  leftRoot.addEventListener('mouseenter', stop);
  leftRoot.addEventListener('focusin', stop);
  leftRoot.addEventListener('mouseleave', play);
  leftRoot.addEventListener('focusout', play);
  play();

  /* ===== 幅・高さの同期 ===== */
  const imagelink = findImagelinkNear(block);

  const applyWidths = () => {
    let { left, right } = measureColumnsFromImagelink(imagelink);
    const wrapW = block.getBoundingClientRect().width || window.innerWidth;

    if (!left && !right) {
      // フォールバック: 65% / 35%
      left = Math.round(wrapW * 0.65);
      right = Math.round(wrapW * 0.35);
    } else if (!left && right) {
      left = Math.max(280, Math.min(1200, wrapW - right - 12));
    } else if (left && !right) {
      right = Math.max(200, Math.min(600, Math.round(left * 0.5)));
    }
    block.style.setProperty('--cm-left-w', `${left}px`);
    block.style.setProperty('--cm-right-w', `${right}px`);
  };

  const applyHeight = () => {
    const img = currentVisibleImg(leftRoot);
    const h = Math.round(
      (img?.getBoundingClientRect().height) ||
      viewport.getBoundingClientRect().height || 0
    );
    if (h > 0) block.style.setProperty('--cm-height', `${h}px`);
  };

  // 初期適用
  applyWidths();
  applyHeight();

  // 監視: リサイズ・画像ロード・DOM変更（スライド切替時の画像入替にも追従）
  const ro = new ResizeObserver(() => {
    applyWidths();
    applyHeight();
  });
  [imagelink, leftRoot, viewport].filter(Boolean).forEach((t) => ro.observe(t));

  if (imagelink) {
    const leftCol = imagelink.querySelector(':scope > div:first-child');
    const rightCol = imagelink.querySelector(':scope > div:last-child');
    if (leftCol) ro.observe(leftCol);
    if (rightCol) ro.observe(rightCol);
  }

  // 画像ロード時にも高さ反映
  qa('img', viewport).forEach((im) => {
    if (!im.complete) im.addEventListener('load', applyHeight, { once: true });
  });
  window.addEventListener('resize', () => {
    applyWidths();
    applyHeight();
  });
}
