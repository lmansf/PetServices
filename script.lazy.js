const PROMOTION_DISCOUNT = 5;
let promotionPricingWatcherId = null;
let lastPromotionBadgeState = null;
let petCarouselInitialized = false;
let mainCarouselInitialized = false;
let carouselItems = [];
let fullCarouselItems = [];
let mainSlideIndex = 0;
let mainSlideInterval = null;
const MAIN_SLIDE_DELAY = 4000; // ms

function hasPromotionBadge() {
  try {
    const badge = sessionStorage.getItem('promotionBadge');
    return typeof badge === 'string' && badge.toLowerCase() === 'dogmom';
  } catch (err) {
    return false;
  }
}

function formatPriceForDisplay(amount, decimals = 0) {
  const precision = Number.isInteger(decimals) ? Math.max(0, decimals) : (Number.isInteger(amount) ? 0 : 2);
  return `$${amount.toFixed(Math.min(4, precision))}`;
}

function createPriceLine(className, amount, unitText, decimals) {
  const line = document.createElement('span');
  line.className = className;

  const amountSpan = document.createElement('span');
  amountSpan.className = 'price-amount';
  amountSpan.textContent = formatPriceForDisplay(amount, decimals);
  line.appendChild(amountSpan);

  if (unitText) {
    const unitSpan = document.createElement('span');
    unitSpan.className = 'price-unit';
    unitSpan.textContent = unitText;
    line.appendChild(unitSpan);
  }

  return line;
}

export function applyPromotionPricing() {
  if (!hasPromotionBadge()) return;

  try {
    document.querySelectorAll('[data-price-base]').forEach((node) => {
      if (node.dataset.promotionApplied === 'true') return;

      const baseAttr = node.getAttribute('data-price-base');
      const basePrice = typeof baseAttr === 'string' ? parseFloat(baseAttr) : NaN;
      if (!Number.isFinite(basePrice)) return;

      const precisionAttr = parseInt(node.getAttribute('data-price-precision') || '', 10);
      const precision = Number.isInteger(precisionAttr)
        ? Math.max(0, precisionAttr)
        : (Number.isInteger(basePrice) ? 0 : 2);

      const unitText = node.getAttribute('data-price-unit') || '';
      const discountAttr = parseFloat(node.getAttribute('data-price-discount'));
      const discountValue = Number.isFinite(discountAttr) ? discountAttr : PROMOTION_DISCOUNT;
      const discountedPrice = Math.max(0, basePrice - discountValue);

      node.classList.add('promotion-price-active');
      node.dataset.promotionApplied = 'true';
      node.innerHTML = '';
      node.appendChild(createPriceLine('price-current', discountedPrice, unitText, precision));
      node.appendChild(createPriceLine('price-original', basePrice, unitText, precision));
    });
  } catch (err) {
    console.warn('promotion pricing adjustment failed', err);
  }
}

export function startPromotionPricingWatcher() {
  if (promotionPricingWatcherId || typeof window === 'undefined') return;

  const refreshPricing = () => {
    const isPromo = hasPromotionBadge();
    const hasUnstyledPrice = document.querySelector('[data-price-base]:not([data-promotion-applied="true"])');
    if (isPromo && (hasUnstyledPrice || lastPromotionBadgeState === false)) {
      applyPromotionPricing();
    }
    lastPromotionBadgeState = isPromo;
  };

  window.addEventListener('focus', refreshPricing, { passive: true });
  window.addEventListener('promotion-badge-change', refreshPricing);
  promotionPricingWatcherId = window.setInterval(refreshPricing, 2000);
  refreshPricing();
}

export function ensurePromotionPricing() {
  applyPromotionPricing();
  startPromotionPricingWatcher();
}

export function initPetCarousel() {
  if (petCarouselInitialized) return;
  const carousel = document.querySelector('.pet-carousel');
  if (!carousel) return;
  petCarouselInitialized = true;

  const slides = Array.from(carousel.querySelectorAll('.pet-slide'));
  const leftArrow = document.querySelector('.pet-carousel-arrow.left');
  const rightArrow = document.querySelector('.pet-carousel-arrow.right');
  const dots = Array.from(document.querySelectorAll('.pet-dot'));
  let current = 0;

  try {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (isMobile) {
      slides.forEach(s => {
        s.classList.add('active');
        s.style.position = '';
        s.style.opacity = '';
      });
      if (leftArrow) leftArrow.style.display = 'none';
      if (rightArrow) rightArrow.style.display = 'none';
      dots.forEach(d => d.style.display = 'none');
      return;
    }
  } catch (e) {
    // continue with desktop behavior
  }

  function showSlide(idx, options = { center: true }) {
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === idx);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === idx);
    });
    current = idx;

    if (options.center) {
      try {
        const mq = window.matchMedia('(max-width: 900px)');
        if (mq.matches && carousel && slides[idx]) {
          centerSlide(idx, true);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  function scrollBySlide(steps) {
    const mq = window.matchMedia('(max-width: 900px)');
    if (!mq.matches || !carousel) {
      showSlide((current + steps + slides.length) % slides.length);
      return;
    }

    const cs = getComputedStyle(carousel);
    const gap = parseFloat(cs.gap || cs.columnGap || '12') || 12;
    const slideRect = slides[0].getBoundingClientRect();
    const slideWidth = slideRect.width;
    const delta = (slideWidth + gap) * steps;

    carousel.scrollBy({ left: delta, behavior: 'smooth' });
    setTimeout(() => updateCurrentFromScroll(), 380);
  }

  function updateCurrentFromScroll() {
    try {
      const carouselRect = carousel.getBoundingClientRect();
      const centerX = carouselRect.left + carouselRect.width / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      slides.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const slideCenter = r.left + r.width / 2;
        const dist = Math.abs(slideCenter - centerX);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      });
      showSlide(bestIdx, { center: false });
    } catch (e) {
      // ignore
    }
  }

  function centerSlide(idx, smooth = true) {
    try {
      if (!carousel || !slides[idx]) return;
      const mq = window.matchMedia('(max-width: 900px)');
      if (!mq.matches) return;

      const slide = slides[idx];
      const slideLeft = slide.offsetLeft;
      const slideWidth = slide.offsetWidth;
      const containerWidth = carousel.clientWidth;
      const target = Math.max(0, slideLeft - (containerWidth - slideWidth) / 2);
      if (smooth && 'scrollTo' in carousel) {
        carousel.scrollTo({ left: target, behavior: 'smooth' });
      } else if ('scrollLeft' in carousel) {
        carousel.scrollLeft = target;
      }
    } catch (e) {
      // ignore
    }
  }

  if (leftArrow) leftArrow.addEventListener('click', () => scrollBySlide(-1));
  if (rightArrow) rightArrow.addEventListener('click', () => scrollBySlide(1));
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => showSlide(i));
  });

  let startX = null;
  carousel.addEventListener('touchstart', e => {
    if (e.touches.length === 1) startX = e.touches[0].clientX;
  });
  carousel.addEventListener('touchend', e => {
    if (startX === null) return;
    const endX = e.changedTouches[0].clientX;
    if (endX - startX > 40) {
      showSlide((current - 1 + slides.length) % slides.length);
    } else if (startX - endX > 40) {
      showSlide((current + 1) % slides.length);
    }
    startX = null;
  });

  showSlide(0);
  try {
    const mqInit = window.matchMedia('(max-width: 900px)');
    if (mqInit.matches) requestAnimationFrame(() => requestAnimationFrame(() => centerSlide(0, false)));
  } catch (e) {}
}

export function initReviewCarousel({ container } = {}) {
  const target = container || document.querySelector('.review-carousel');
  if (!target || target.dataset.reviewCarouselInit === 'true') return;
  target.dataset.reviewCarouselInit = 'true';

  const allReviews = Array.from(target.querySelectorAll('.review-block'));
  const seenServices = new Set();
  const filteredReviews = [];
  let goldSlide = null;

  allReviews.forEach(r => {
    const service = r.getAttribute('data-service');
    if (r.classList.contains('gold-slide')) { goldSlide = r; return; }
    if (!seenServices.has(service)) {
      seenServices.add(service);
      filteredReviews.push(r);
    } else {
      r.style.display = 'none';
    }
  });
  if (goldSlide) filteredReviews.unshift(goldSlide);

  allReviews.forEach(r => {
    if (!filteredReviews.includes(r)) r.style.display = 'none';
    else r.style.display = '';
  });

  let current = 0;
  function showReview(idx) {
    filteredReviews.forEach((r, i) => {
      r.classList.toggle('active', i === idx);
      r.style.display = i === idx ? '' : 'none';
    });
    current = idx;
  }

  let interval = setInterval(() => showReview((current + 1) % filteredReviews.length), 5000);

  target.addEventListener('mouseenter', () => clearInterval(interval));
  target.addEventListener('mouseleave', () => {
    interval = setInterval(() => showReview((current + 1) % filteredReviews.length), 5000);
  });

  showReview(0);
}

function filenameToCaption(name) {
  const base = name.replace(/\.[^.]+$/, '');
  return base.replace(/[\-_\(\)]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadMainManifest() {
  const fallback = ['original (13).webp','original (25).webp','original (8).webp','original (9).webp'];
  return fetch('/imgs.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error('no manifest'); return r.json(); })
    .catch(() => fetch('imgs.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : fallback).catch(() => fallback))
    .then(list => Array.isArray(list) ? list : fallback)
    .then(list => list.map(fn => ({ src: fn, alt: filenameToCaption(fn), caption: filenameToCaption(fn) })));
}

export function initMainCarousel() {
  if (mainCarouselInitialized) return;
  const root = document.getElementById('main-carousel');
  if (!root) return;
  mainCarouselInitialized = true;

  loadMainManifest().then(list => {
    fullCarouselItems = list;
    carouselItems = list.slice();
    buildMainCarousel(carouselItems);
    showMainSlide(0);
    startMainAutoSlide();

    document.addEventListener('keydown', handleCarouselKeydown);
  }).catch(err => {
    console.warn('Main carousel: failed to load images', err);
  });
}

function buildMainCarousel(items) {
  const slidesContainer = document.querySelector('.slides-container');
  const thumbs = document.querySelector('.carousel-thumbs');
  const captionEl = document.querySelector('.carousel-caption');
  if (!slidesContainer) return;

  slidesContainer.innerHTML = '';
  if (thumbs) thumbs.innerHTML = '';

  items.forEach((item, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.setAttribute('role','group');
    slide.setAttribute('aria-roledescription','slide');
    slide.setAttribute('aria-label', `${i+1} of ${items.length}`);
    slide.style.display = i === 0 ? 'block' : 'none';

    const img = document.createElement('img');
    img.src = `imgs/${item.src}`;
    img.alt = item.alt || '';
    img.loading = 'lazy';
    slide.appendChild(img);

    slidesContainer.appendChild(slide);

    if (thumbs) {
      const t = document.createElement('button');
      t.className = 'thumb';
      t.type = 'button';
      t.setAttribute('aria-label', `Show ${item.caption}`);
      t.setAttribute('role','tab');
      t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      t.innerHTML = `<img src="imgs/${item.src}" alt="${item.alt || ''}" loading="lazy">`;
      t.addEventListener('click', () => { showMainSlide(i); });
      thumbs.appendChild(t);
    }
  });

  if (captionEl) captionEl.textContent = items[0]?.caption || '';

  const prev = document.querySelector('#main-carousel .carousel-arrow.prev');
  const next = document.querySelector('#main-carousel .carousel-arrow.next');
  if (prev) prev.onclick = () => { showMainSlide(mainSlideIndex - 1); };
  if (next) next.onclick = () => { showMainSlide(mainSlideIndex + 1); };

  const stage = document.querySelector('#main-carousel .carousel-stage');
  if (stage) {
    stage.addEventListener('mouseenter', pauseMainAutoSlide);
    stage.addEventListener('mouseleave', resumeMainAutoSlide);
  }
}

function showMainSlide(n) {
  const slides = Array.from(document.querySelectorAll('#main-carousel .slide'));
  const thumbs = Array.from(document.querySelectorAll('#main-carousel .thumb'));
  const captionEl = document.querySelector('.carousel-caption');
  if (!slides.length) return;

  if (n >= slides.length) n = 0;
  if (n < 0) n = slides.length - 1;
  mainSlideIndex = n;

  slides.forEach((s, i) => { s.style.display = i === n ? 'block' : 'none'; });
  thumbs.forEach((t, i) => { t.setAttribute('aria-selected', i === n ? 'true' : 'false'); t.classList.toggle('active', i === n); });
  if (captionEl) captionEl.textContent = (carouselItems[n] && carouselItems[n].caption) || '';

  restartMainAutoSlide();
}

function startMainAutoSlide() {
  if (mainSlideInterval) return;
  mainSlideInterval = setInterval(() => { showMainSlide(mainSlideIndex + 1); }, MAIN_SLIDE_DELAY);
}

function pauseMainAutoSlide() {
  if (mainSlideInterval) clearInterval(mainSlideInterval);
  mainSlideInterval = null;
}

function resumeMainAutoSlide() {
  if (!mainSlideInterval) startMainAutoSlide();
}

function restartMainAutoSlide() {
  pauseMainAutoSlide();
  resumeMainAutoSlide();
}

function handleCarouselKeydown(e) {
  if (e.key === 'ArrowLeft') {
    showMainSlide(mainSlideIndex - 1);
  } else if (e.key === 'ArrowRight') {
    showMainSlide(mainSlideIndex + 1);
  }
}
