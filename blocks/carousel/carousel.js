import { fetchPlaceholders } from '../../scripts/aem.js';

function clampIndex(n, total, fallback = 0) {
  const x = Number.isFinite(n) ? Math.floor(n) : fallback;
  return ((x % total) + total) % total;
}

function updateActiveSlide(slide) {
  if (!slide) return;
  const block = slide.closest('.carousel');
  const slideIndex = parseInt(slide.dataset.slideIndex, 10) || 0;
  block.dataset.activeSlide = String(slideIndex);

  const slides = block.querySelectorAll('.carousel-slide');
  slides.forEach((aSlide, idx) => {
    const isActive = idx === slideIndex;
    aSlide.setAttribute('aria-hidden', String(!isActive));
    aSlide.querySelectorAll('a').forEach((link) => {
      if (!isActive) {
        link.setAttribute('tabindex', '-1');
      } else {
        link.removeAttribute('tabindex');
      }
    });
  });

  const indicators = block.querySelectorAll('.carousel-slide-indicator');
  indicators.forEach((indicator, idx) => {
    const btn = indicator.querySelector('button');
    if (!btn) return;
    if (idx === slideIndex) {
      btn.setAttribute('disabled', 'true');
    } else {
      btn.removeAttribute('disabled');
    }
  });
}

function showSlide(block, slideIndex = 0) {
  const scroller = block.querySelector('.carousel-slides');
  const slides = block.querySelectorAll('.carousel-slide');
  const total = slides.length;
  if (!scroller || total === 0) return;

  const current = parseInt(block.dataset.activeSlide, 10) || 0;
  const target = clampIndex(slideIndex, total, current);
  const activeSlide = slides[target];

  // 先に状態更新（aria・tabindex・indicator）
  updateActiveSlide(activeSlide);

  // スクロール（scroll-snap と併用）
  scroller.scrollTo({
    top: 0,
    left: activeSlide.offsetLeft,
    behavior: 'smooth',
  });
}

function bindEvents(block) {
  const slideIndicators = block.querySelector('.carousel-slide-indicators');

  if (slideIndicators) {
    slideIndicators.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', (e) => {
        const slideIndicator = e.currentTarget.parentElement;
        const idx = parseInt(slideIndicator.dataset.targetSlide, 10);
        showSlide(block, idx);
      });
    });
  }

  const prevBtn = block.querySelector('.slide-prev');
  const nextBtn = block.querySelector('.slide-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const curr = parseInt(block.dataset.activeSlide, 10) || 0;
      showSlide(block, curr - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const curr = parseInt(block.dataset.activeSlide, 10) || 0;
      showSlide(block, curr + 1);
    });
  }

  // 横スクロールコンテナを root に指定
  const scroller = block.querySelector('.carousel-slides');
  if (!scroller) return;

  const slideObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) updateActiveSlide(entry.target);
    });
  }, { root: scroller, threshold: 0.6 });

  block.querySelectorAll('.carousel-slide').forEach((slide) => {
    slideObserver.observe(slide);
  });
}

function createSlide(row, slideIndex, carouselId) {
  const slide = document.createElement('li');
  slide.dataset.slideIndex = String(slideIndex);
  slide.setAttribute('id', `carousel-${carouselId}-slide-${slideIndex}`);
  slide.classList.add('carousel-slide');

  // 左列=画像, 右列=コンテンツ
  row.querySelectorAll(':scope > div').forEach((column, colIdx) => {
    column.classList.add(`carousel-slide-${colIdx === 0 ? 'image' : 'content'}`);
    slide.append(column);
  });

  // アクセシビリティ: 見出しに id を付与して aria-labelledby を有効化
  const labeledBy = slide.querySelector('h1, h2, h3, h4, h5, h6');
  if (labeledBy) {
    if (!labeledBy.id) {
      labeledBy.id = `carousel-${carouselId}-slide-${slideIndex}-heading`;
    }
    slide.setAttribute('aria-labelledby', labeledBy.id);
  }

  return slide;
}

let carouselId = 0;

export default async function decorate(block) {
  carouselId += 1;
  block.setAttribute('id', `carousel-${carouselId}`);

  const rows = block.querySelectorAll(':scope > div');
  const isSingleSlide = rows.length < 2;

  const placeholders = await fetchPlaceholders();

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', placeholders.carousel || 'Carousel');

  // コンテナとスライド UL を先に組み立ててから block に配置
  const container = document.createElement('div');
  container.classList.add('carousel-slides-container');

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.classList.add('carousel-slides');
  container.append(slidesWrapper);
  block.prepend(container);

  let slideIndicators;
  if (!isSingleSlide) {
    const slideIndicatorsNav = document.createElement('nav');
    slideIndicatorsNav.setAttribute('aria-label', placeholders.carouselSlideControls || 'Carousel Slide Controls');
    slideIndicators = document.createElement('ol');
    slideIndicators.classList.add('carousel-slide-indicators');
    slideIndicatorsNav.append(slideIndicators);
    block.append(slideIndicatorsNav);

    const slideNavButtons = document.createElement('div');
    slideNavButtons.classList.add('carousel-navigation-buttons');
    slideNavButtons.innerHTML = `
      <button type="button" class="slide-prev" aria-label="${placeholders.previousSlide || 'Previous Slide'}"></button>
      <button type="button" class="slide-next" aria-label="${placeholders.nextSlide || 'Next Slide'}"></button>
    `;
    container.append(slideNavButtons);
  }

  // スライド生成
  rows.forEach((row, idx) => {
    const slide = createSlide(row, idx, carouselId);
    slidesWrapper.append(slide);

    if (slideIndicators) {
      const indicator = document.createElement('li');
      indicator.classList.add('carousel-slide-indicator');
      indicator.dataset.targetSlide = String(idx);
      indicator.innerHTML = `<button type="button" aria-label="${(placeholders.showSlide || 'Show Slide')} ${idx + 1} ${(placeholders.of || 'of')} ${rows.length}"></button>`;
      slideIndicators.append(indicator);
    }

    // 元の行は削除
    row.remove();
  });

  // 初期状態: 最初のスライドをアクティブに
  const firstSlide = slidesWrapper.querySelector('.carousel-slide');
  if (firstSlide) {
    updateActiveSlide(firstSlide);
  }
  // 単一スライドでなければイベントをバインド
  if (!isSingleSlide) {
    bindEvents(block);
  }
}
