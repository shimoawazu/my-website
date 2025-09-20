/*
 * Accordion2
 * - クリックで開閉
 * - 「開くときだけ」中身が少し弾む（バウンス）
 * - 既に<details>構造でも、行レイアウトでもOK
 */

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensureBodyAndInner(detailsEl) {
  // body要素（summary以外）に .accordion2-item-body を付け、
  // その直下に .accordion2-content を1枚作る
  let bodyEl = detailsEl.querySelector(':scope > .accordion2-item-body');
  if (!bodyEl) {
    // summary以外の直下要素をまとめる
    const fr = document.createDocumentFragment();
    [...detailsEl.children].forEach((c) => { if (c.tagName !== 'SUMMARY') fr.appendChild(c); });
    bodyEl = document.createElement('div');
    bodyEl.className = 'accordion2-item-body';
    bodyEl.appendChild(fr);
    detailsEl.appendChild(bodyEl);
  }

  let inner = bodyEl.querySelector(':scope > .accordion2-content');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'accordion2-content';
    while (bodyEl.firstChild && bodyEl.firstChild !== inner) {
      if (bodyEl.firstChild.classList && bodyEl.firstChild.classList.contains('accordion2-content')) break;
      inner.appendChild(bodyEl.firstChild);
    }
    bodyEl.appendChild(inner);
  }
  return { bodyEl, inner };
}

function animateOpen(detailsEl, bodyEl, inner) {
  if (prefersReducedMotion()) { detailsEl.open = true; return; }

  // 先にopenして自然高さを取得
  detailsEl.open = true;

  const startH = 0;
  bodyEl.style.overflow = 'hidden';
  bodyEl.style.height = `${startH}px`;
  // reflow
  // eslint-disable-next-line no-unused-expressions
  bodyEl.offsetHeight;

  const endH = bodyEl.scrollHeight;
  const expand = bodyEl.animate(
    [
      { height: `${startH}px`, opacity: 0, transform: 'translateY(-2px) scaleY(.985)' },
      { height: `${endH}px`, opacity: 1, transform: 'translateY(0) scaleY(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );

  expand.onfinish = () => {
    bodyEl.style.height = 'auto';
    bodyEl.style.overflow = '';

    // 中身にだけ軽いバウンス（オーバーシュート）
    inner.animate(
      [
        { transform: 'scaleY(1)' },
        { transform: 'scaleY(1.02)' },
        { transform: 'scaleY(0.992)' },
        { transform: 'scaleY(1)' },
      ],
      { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  };
}

function animateClose(detailsEl, bodyEl) {
  if (prefersReducedMotion()) { detailsEl.open = false; return; }

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

function wireToggle(detailsEl) {
  const summary = detailsEl.querySelector(':scope > summary');
  if (!summary) return;

  const { bodyEl, inner } = ensureBodyAndInner(detailsEl);

  // ネイティブtoggleを抑止してアニメ制御
  summary.addEventListener('click', (e) => {
    // テキスト選択中の誤動作回避
    if (window.getSelection && String(window.getSelection())) return;

    e.preventDefault();
    const isOpen = detailsEl.hasAttribute('open');
    if (isOpen) animateClose(detailsEl, bodyEl);
    else animateOpen(detailsEl, bodyEl, inner);
  });

  // Enter/Space で同等挙動
  summary.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      summary.click();
    }
  });
}

export default function decorate(block) {
  // 1) 既存 <details> のまま使う or 行から生成
  const rows = [...block.children];
  const alreadyDetails = rows[0] && rows[0].tagName === 'DETAILS';

  if (!alreadyDetails) {
    rows.forEach((row) => {
      const [labelEl, bodyEl] = row.children;

      const details = document.createElement('details');
      const summary = document.createElement('summary');
      if (labelEl) summary.append(...labelEl.childNodes);

      if (bodyEl) details.append(summary, bodyEl);
      else details.append(summary);

      row.replaceWith(details);
    });
  }

  // 2) すべての details に配線（初期状態は閉）
  [...block.querySelectorAll(':scope > details')].forEach((d) => {
    if (d.dataset.open === 'true') d.open = true;
    else d.removeAttribute('open');
    wireToggle(d);
  });
}
