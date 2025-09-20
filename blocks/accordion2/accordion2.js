/*
 * accordion Block
 * Auto-toggle open/close every 3s for demo/verification.
 * - Builds <details>/<summary> if rows are provided
 * - Pauses on hover/focus, stops on user click
 */

export default function decorate(block) {
  // 1) 既に<details>構造なら流用。そうでなければ行から生成。
  const rows = [...block.children];
  const isAlreadyDetails = rows[0] && rows[0].tagName === 'DETAILS';
  if (!isAlreadyDetails) {
    rows.forEach((row) => {
      const [labelEl, bodyEl] = row.children;
      const details = document.createElement('details');

      const summary = document.createElement('summary');
      if (labelEl) summary.append(...labelEl.childNodes);

      const body = document.createElement('div');
      if (bodyEl) body.append(...bodyEl.childNodes);
      body.className = 'accordion-item-body';

      details.append(summary, body);
      row.replaceWith(details);
    });
  }

  // 2) 直下の<details>を取得
  const items = [...block.querySelectorAll(':scope > details')];
  if (!items.length) return;

  // 3) いったん全て閉じる
  items.forEach((d) => d.removeAttribute('open'));

  let idx = -1;
  let timerId = null;

  function showNext() {
    const prev = idx;
    idx = (idx + 1) % items.length;
    if (prev >= 0) items[prev].open = false;
    items[idx].open = true;
  }

  function start() {
    if (timerId) return;
    // 最初の1回を即時実行、その後3秒ごと
    showNext();
    timerId = setInterval(showNext, 3000);
  }

  function stop() {
    if (!timerId) return;
    clearInterval(timerId);
    timerId = null;
  }

  // 4) ユーザー操作に配慮（ホバー/フォーカスで一時停止、クリックで停止）
  block.addEventListener('mouseenter', stop);
  block.addEventListener('mouseleave', start);
  block.addEventListener('focusin', stop);
  block.addEventListener('focusout', start);

  items.forEach((d) => {
    const summary = d.querySelector('summary');
    if (summary) {
      summary.addEventListener('click', () => {
        // ユーザーが操作したら自動切替は止める
        stop();
      });
    }
  });

  // 5) タブ非表示時は停止、復帰したら再開
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  // 6) 起動
  start();
}
