/**
 * imagelink optional enhancer
 * - コンテナに --hero-ratio を注入（1枚目の画像比を使用）
 * - 画像の軽量属性を付与
 * - src/srcset の "format=webply" → "format=webp" を自動修正
 */
(function () {
  const blocks = document.querySelectorAll('.imagelink');
  blocks.forEach((blk) => {
    // 1枚目の画像を取得
    const firstImg = blk.querySelector(':scope > div:nth-child(1) img');

    // タイポ修正（source/srcset, img/src）
    blk.querySelectorAll('source[srcset], img[src]').forEach((el) => {
      const attr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
      const val = el.getAttribute(attr);
      if (val && val.includes('format=webply')) {
        el.setAttribute(attr, val.replace(/format=webply/g, 'format=webp'));
      }
    });

    // 画像の最適化属性
    blk.querySelectorAll('img').forEach((img) => {
      if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    });

    // --hero-ratio を 1枚目の画像から設定（width/height → aspect-ratio）
    const setRatio = () => {
      if (!firstImg) return;
      const w = Number(firstImg.getAttribute('width')) || firstImg.naturalWidth;
      const h = Number(firstImg.getAttribute('height')) || firstImg.naturalHeight;
      if (w > 0 && h > 0) blk.style.setProperty('--hero-ratio', (w / h).toString());
    };

    if (firstImg) {
      if (firstImg.complete) setRatio();
      else firstImg.addEventListener('load', setRatio, { once: true });
    }
  });
})();
