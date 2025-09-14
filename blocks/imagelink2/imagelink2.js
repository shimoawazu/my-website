// imagelink2 を carouselmini の右横へ配置。
// ・carouselmini と imagelink2 を .cm-row で包んで横並びに
// ・.cm-row の幅を先行する .imagelink と合わせる
// ・carouselmini の幅を .imagelink 左カラム（大画像）幅に合わせる

export default function decorate(block) {
  const section = block.closest('.section') || block.parentElement;
  if (!section) return;

  // 同じセクション内の carouselmini と imagelink を取得
  const carousel = section.querySelector(':scope > .carouselmini');
  const imagelink = section.querySelector(':scope > .imagelink');

  if (!carousel) return;

  // 既にラップ済みでなければ .cm-row を作成して横並びにする
  let row = carousel.parentElement;
  if (!row || !row.classList || !row.classList.contains('cm-row')) {
    row = document.createElement('div');
    row.className = 'cm-row';
    // carouselmini の直前に挿入し、carouselmini と imagelink2 を移動
    carousel.before(row);
    row.append(carousel);
    row.append(block);
  }

  // 幅合わせ：imagelink の全体幅、左カラム幅を参照して反映
  const applySizes = () => {
    if (imagelink) {
      const ilRect = imagelink.getBoundingClientRect();
      if (ilRect.width > 0) {
        // .cm-row の最大幅を imagelink に合わせ、左右位置（中央寄せ）を揃える
        row.style.maxWidth = `${Math.round(ilRect.width)}px`;
        row.style.marginLeft = 'auto';
        row.style.marginRight = 'auto';
      }
      // 左カラム（大画像）の幅を測って carouselmini に適用
      const leftCol = imagelink.querySelector(':scope > div:first-child');
      if (leftCol) {
        const leftRect = leftCol.getBoundingClientRect();
        if (leftRect.width > 0) {
          carousel.style.width = `${Math.round(leftRect.width)}px`;
          // 100%指定などで広がっていた場合に備えて overflow を明示
          carousel.style.overflow = 'hidden';
          // 横並び時に収まらないケース回避のための最小限の保険
          carousel.style.flex = '0 0 auto';
        }
      }
    }
  };

  // 画像読み込み後にも再計算
  const waitForImages = (root) => {
    const imgs = root ? root.querySelectorAll('img') : [];
    let pending = 0;
    imgs.forEach((img) => {
      if (!img.complete) {
        pending += 1;
        img.addEventListener('load', () => {
          pending -= 1;
          if (pending === 0) applySizes();
        }, { once: true });
        img.addEventListener('error', () => {
          pending -= 1;
          if (pending === 0) applySizes();
        }, { once: true });
      }
    });
    // すでに読み込み済みなら即適用
    if (pending === 0) applySizes();
  };

  waitForImages(imagelink || document);
  window.addEventListener('resize', applySizes);
}
