/*
 * accordion2 Block (no animation)
 * - Click to open/close
 * - Opened content has dark gray bg + white text
 */

export default function decorate(block) {
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
    block.querySelectorAll(':scope > details > :not(summary)').forEach((el) => {
      el.classList.add('accordion2-item-body');
    });
  }

  // 初期状態は閉
  [...block.querySelectorAll(':scope > details')].forEach((d) => {
    if (d.dataset.open === 'true') d.open = true;
    else d.removeAttribute('open');
  });
}
