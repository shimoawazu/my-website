/*
 * accordion2 Block
 * Animate open/close with WAAPI (no extra CSS injection)
 * - Smooth height animation (open/close)
 * - Tiny sparkle burst when opening
 * - Respects prefers-reduced-motion
 */

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sparkleBurst(anchorEl) {
  if (prefersReducedMotion()) return;

  const wrap = document.createElement('div');
  wrap.style.position = 'absolute';
  wrap.style.pointerEvents = 'none';
  wrap.style.inset = '0';
  wrap.style.overflow = 'visible';
  // attach near summary’s chevron area
  const rect = anchorEl.getBoundingClientRect();
  const rightPad = 24; // near the ▶ chevron (CSS pads-right:46px)
  wrap.style.right = `${rightPad}px`;
  wrap.style.top = '0';

  // position context
  anchorEl.style.position ||= 'relative';
  anchorEl.appendChild(wrap);

  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('div');
    p.style.width = '6px';
    p.style.height = '6px';
    p.style.position = 'absolute';
    p.style.top = '50%';
    p.style.transform = 'translateY(-50%)';
    p.style.borderRadius = '999px';
    p.style.background = i % 2 ? 'currentColor' : 'rgba(0,0,0,.15)';
    wrap.appendChild(p);

    const angle = (Math.PI * 2 * i) / count;
    const dist = 14 + Math.random() * 10;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 6;

    const anim = p.animate(
      [
        { transform: 'translate(0, -50%) scale(0.6)', opacity: 0 },
        { transform: `translate(${dx}px, calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx * 1.2}px, calc(-50% + ${dy * 1.2}px)) scale(0.6)`, opacity: 0 },
      ],
      { duration: 520 + Math.random() * 120, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    anim.onfinish = () => p.remove();
  }
  setTimeout(() => wrap.remove(), 800);
}

function animateOpen(detailsEl, bodyEl) {
  if (prefersReducedMotion()) {
    detailsEl.open = true;
    return;
  }

  // Ensure it's measurable
  detailsEl.open = true;
  bodyEl.style.overflow = 'hidden';
  bodyEl.style.height = '0px';

  // Force reflow to apply starting height
  // eslint-disable-next-line no-unused-expressions
  bodyEl.offsetHeight;

  const end = bodyEl.scrollHeight;
  const a = bodyEl.animate(
    [
      { height: '0px', opacity: 0, transform: 'translateY(-2px) scaleY(.98)' },
      { height: `${end}px`, opacity: 1, transform: 'translateY(0) scaleY(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
  a.onfinish = () => {
    bodyEl.style.height = 'auto';
    bodyEl.style.overflow = '';
  };
}

function animateClose(detailsEl, bodyEl) {
  if (prefersReducedMotion()) {
    detailsEl.open = false;
    return;
  }

  // Measure current height while still open
  const start = bodyEl.scrollHeight;
  bodyEl.style.overflow = 'hidden';
  bodyEl.style.height = `${start}px`;

  // Force reflow
  // eslint-disable-next-line no-unused-expressions
  bodyEl.offsetHeight;

  const a = bodyEl.animate(
    [
      { height: `${start}px`, opacity: 1, transform: 'translateY(0) scaleY(1)' },
      { height: '0px', opacity: 0, transform: 'translateY(-2px) scaleY(.98)' },
    ],
    { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
  a.onfinish = () => {
    bodyEl.style.height = '';
    bodyEl.style.overflow = '';
    detailsEl.open = false;
  };
}

/**
 * Intercept summary clicks:
 * - Prevent default toggle
 * - Run our animation, then set .open accordingly
 */
function wireAnimatedToggle(detailsEl, summaryEl, bodyEl) {
  summaryEl.addEventListener('click', (e) => {
    // Allow text selection via keyboard/mouse drag without toggling accidentally
    if (window.getSelection && String(window.getSelection())) return;

    e.preventDefault();
    const isOpen = detailsEl.hasAttribute('open');

    if (isOpen) {
      animateClose(detailsEl, bodyEl);
    } else {
      animateOpen(detailsEl, bodyEl);
      sparkleBurst(summaryEl);
    }
  });

  // Keyboard “boop” feedback
  summaryEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Prevent native toggle; we will handle it via click programmatically
      e.preventDefault();
      summaryEl.click();
      if (!prefersReducedMotion()) {
        summaryEl.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }],
          { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      }
    }
  });
}

export default function decorate(block) {
  // The outer container should already have class "accordion2" per block system
  // Build details/summary markup and attach animations
  [...block.children].forEach((row) => {
    const label = row.children[0];
    const body = row.children[1];

    const summary = document.createElement('summary');
    summary.className = 'accordion2-item-label';
    summary.append(...label.childNodes);

    body.classList.add('accordion2-item-body');

    const details = document.createElement('details');
    // class on <details> is optional because CSS targets ".accordion2 details"
    details.append(summary, body);

    // Start closed by default; if original content had a hint like data-open, respect it
    if (row.dataset.open === 'true' || row.getAttribute('data-open') === 'true') {
      details.open = true;
    }

    wireAnimatedToggle(details, summary, body);
    row.replaceWith(details);
  });
}
