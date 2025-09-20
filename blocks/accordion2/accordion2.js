/*
 * accordion2 Block
 * - Click to open/close <details>
 * - Bouncy open animation (height expand + subtle overshoot)
 * - No auto-play
 */

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensureContentWrapper(bodyEl) {
  // 内側に1枚ラッパーを作って content の弾みを付ける
  let inner = bodyEl.querySelector(':scope > .accordion2-content');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'accordion2-content';
    while (bodyEl.firstChild) inner.appendChild(bodyEl.firstChild);
    bodyEl.appendChild(inner);
  }
  return inner;
}

function animateOpen(detailsEl, bodyEl) {
  if (prefersReducedMotion()) { detailsEl.open = true; return; }

  // まず open=true にして自然高さを測る
  detailsEl.open = true;
  const inner = ensureContentWrapper(bodyEl);

  // height アニメーション準備
  bodyEl.style.overflow = 'hidden';
  bodyEl.style.height = '0px';
  // reflow
  // eslint-disable-next-line no-unused-expressions
  bodyEl.offsetHeight;

  const endH = bodyEl.scrollHeight;

  // 1) 高さを伸ばす（スッと）
  const expand = bodyEl.animate(
    [
      { height: '0px', opacity: 0, transform: 'translateY(-2px) scaleY(.985)' },
      { height: `${endH}px`, opacity: 1, transform: 'translateY(0) scaleY(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );

  expand.onfinish = () => {
    // 自然レイアウトへ復帰
    bodyEl.style.height = 'auto';
    bodyEl.style.overflow = '';

    // 2) 中身にだけ軽いバウンス（オーバーシュート）
    inner.animate(
      [
        { transform: 'scaleY(1)', offset: 0 },
        { transform: 'scaleY(1.02)', offset: 0.45 },
        { transform: 'scaleY(0.992)', offset: 0.8 },
        { transform: 'scaleY(1)', offset: 1 },
      ],
      { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  };
}

function animateClose(detailsEl, bodyEl) {
  if (prefersReducedMotion()) { detailsEl.open = false; return; }

  // 現在高さを測ってから閉じる
  const startH = bodyEl.scrollHeight;
  bodyEl.style.overflow = 'hidden';
  bodyEl.style.height = `${startH}px`;
  // reflow
  // eslint-disable-next-line no-unused-expressions
  bodyEl.offsetHeight;

  const collapse = bodyEl.animate(
    [
      { height: `${startH}px`, opacity: 1, transform: 'translateY(0) scaleY(1)' },
      { height: '0px', opacity: 0, transform: 'translateY(-2px) scaleY(.985)' },
    ],
    { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );

  collapse.onfinish = () => {
    bodyEl.style.height = '';
    bodyEl.style.overflow = '';
    detailsEl.open = false;
  };
}

function wireToggle(detailsEl, summaryEl, bodyEl) {
  // ネイティブのトグルを抑止し、アニメーション制御
  summaryEl.addEventListener('click', (e) => {
    // 選択ドラッグ中の誤作動を避ける
    if (window.getSelection && String(window.getSelection())) return;

    e.preventDefault();
    const isOpen = detailsEl.hasAttribute('open');
    if (isOpen) {
      animateClose(detailsEl, bodyEl);
    } else {
      animateOpen(detailsEl, bodyEl);
    }
  });

  // キーボードでも同様の挙動（Enter/Space）
  summaryEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      summaryEl.click();
    }
  });
}

export default function decorate(block) {
  // 既存が <details> 羅列ならそのまま使う。なければ行から生成。
  const rows = [...block.children];
  const alreadyDetails = rows[0] && rows[0].tagName === 'DETAILS';

  if (!alreadyDetails) {
    rows.forEach((row) => {
      const [labelEl, bodyEl] = row.children;

      const details = document.createElement('details');
      const summary = document.createElement('summary');
      if (labelEl) summary.append(...labelEl.childNodes);

      const body = document.createElement('div');
      body.className = 'accordion2-item-body';
      if (bodyEl) body.append(...bodyEl.childNodes);

      details.append(summary, body);
      row.replaceWith(details);
    });
  } else {
    // details がすでにある場合は body クラスだけ整える
    block.querySelectorAll(':scope > details > :not(summary)').forEach((el) => {
      el.classList.add('accordion2-item-body');
    });
  }

  // クリックで開閉（デフォルトは閉）
  const items = [...block.querySelectorAll(':scope > details')];
  items.forEach((d) => {
    const summary = d.querySelector(':scope > summary');
    const body = d.querySelector(':scope > .accordion2-item-body') || d.querySelector(':scope > :not(summary)');
    if (!summary || !body) return;

    // 初期は閉じる（データ属性で初期オープン可）
    if (d.dataset.open === 'true') d.open = true;
    else d.removeAttribute('open');

    wireToggle(d, summary, body);
  });
}
