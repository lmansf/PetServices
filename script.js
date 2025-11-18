// Load header and navigation HTML dynamically
// Templates stored in JavaScript for compatibility with file:// protocol
const HEADER_HTML = `<div class="hero-banner" style="width:100%;max-width:100vw;overflow:hidden;margin-bottom:0.5rem;">
  <img src="Amanda's Pet Services HERO.svg" alt="Dog walking hero" style="width:100%;display:block;">
</div>`;

const NAV_HTML = `<nav class="topnav account-nav">
  <div class="account-dropdown">
    <button class="account-button" type="button" aria-haspopup="true" aria-expanded="false">
      <span class="account-label">Guest</span>
      <span class="account-caret">
        <i class="fa fa-caret-down" aria-hidden="true"></i>
      </span>
    </button>
    <div class="account-menu" role="menu">
      <a href="About.html" role="menuitem">About Me</a>
      <a href="index.html" role="menuitem" class="nav-services-link nav-highlightable nav-highlight">Services</a>
      <a href="profile.html" role="menuitem" class="auth-hidden" data-auth="signed-in">Profile</a>
      <a href="firstform.html" role="menuitem" class="auth-hidden" data-auth="signed-in">First Form</a>
      <a href="feedback.html" role="menuitem" class="auth-hidden" data-auth="signed-in">Feedback</a>
      <hr>
      <button type="button" class="logout-button nav-highlightable" role="menuitem">Log out</button>
    </div>
  </div>
</nav>`;

const FRAGMENT_CACHE_KEY = 'aps-fragment-cache-v1';
let fragmentCacheStore = (() => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FRAGMENT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('fragment cache unavailable', err);
    return {};
  }
})();

function persistFragmentCache() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FRAGMENT_CACHE_KEY, JSON.stringify(fragmentCacheStore));
  } catch (err) {
    console.warn('fragment cache persist failed', err);
  }
}

function getCachedFragment(path) {
  try {
    return fragmentCacheStore?.[path]?.html || '';
  } catch (err) {
    return '';
  }
}

function setCachedFragment(path, html) {
  if (!html) return;
  fragmentCacheStore[path] = { html, ts: Date.now() };
  const keys = Object.keys(fragmentCacheStore);
  if (keys.length > 8) {
    keys
      .sort((a, b) => (fragmentCacheStore[b].ts || 0) - (fragmentCacheStore[a].ts || 0))
      .slice(8)
      .forEach(key => delete fragmentCacheStore[key]);
  }
  persistFragmentCache();
}

function hydrateFragment(options) {
  const {
    url,
    container,
    fallbackHtml = '',
    afterRender,
    fatalOnFail = false
  } = options || {};

  if (!container || !url) return;

  const applyHtml = (html) => {
    if (typeof html !== 'string' || !html) return false;
    container.innerHTML = html;
    if (typeof afterRender === 'function') {
      try { afterRender(); } catch (err) { console.warn('fragment afterRender failed', err); }
    }
    return true;
  };

  const cached = getCachedFragment(url);
  if (cached) {
    applyHtml(cached);
  } else if (fallbackHtml) {
    applyHtml(fallbackHtml);
  }

  fetch(url, { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return response.text();
    })
    .then(html => {
      setCachedFragment(url, html);
      applyHtml(html);
    })
    .catch(err => {
      console.warn('fragment fetch failed', url, err);
      if (!cached && fallbackHtml) {
        const success = applyHtml(fallbackHtml);
        if (!success && fatalOnFail) {
          window.location.href = `error.html?code=500&msg=${encodeURIComponent('Critical fragment failed to load')}&from=${encodeURIComponent(window.location.pathname)}`;
        }
      } else if (fatalOnFail && !container.innerHTML) {
        window.location.href = `error.html?code=500&msg=${encodeURIComponent('Critical fragment failed to load')}&from=${encodeURIComponent(window.location.pathname)}`;
      }
    });
}

const DOGMOM_DISCOUNT = 5;
let dogMomPricingWatcherId = null;
let lastDogMomBadgeState = null;

function dispatchDogMomBadgeChange() {
  try {
    window.dispatchEvent(new Event('dogmom-badge-change'));
  } catch (err) {
    // no-op if window unavailable
  }
}

function initializeMobileNav() {
  // Legacy mobile navigation hook; kept as no-op until new menu is reintroduced.
}

function isUserSignedIn() {
  return Boolean(sessionStorage.getItem('userEmail'));
}

function hasLoyaltyBadge() {
  const badge = sessionStorage.getItem('loyaltyBadge');
  return typeof badge === 'string' && badge.toLowerCase() === 'dogmom';
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

function applyDogMomPricing() {
  if (!hasLoyaltyBadge()) return;

  try {
    document.querySelectorAll('[data-price-base]').forEach((node) => {
      if (node.dataset.dogmomApplied === 'true') return;

      const baseAttr = node.getAttribute('data-price-base');
      const basePrice = typeof baseAttr === 'string' ? parseFloat(baseAttr) : NaN;
      if (!Number.isFinite(basePrice)) return;

      const precisionAttr = parseInt(node.getAttribute('data-price-precision') || '', 10);
      const precision = Number.isInteger(precisionAttr)
        ? Math.max(0, precisionAttr)
        : (Number.isInteger(basePrice) ? 0 : 2);

      const unitText = node.getAttribute('data-price-unit') || '';
      const discountAttr = parseFloat(node.getAttribute('data-price-discount'));
      const discountValue = Number.isFinite(discountAttr) ? discountAttr : DOGMOM_DISCOUNT;
      const discountedPrice = Math.max(0, basePrice - discountValue);

      node.classList.add('dogmom-price-active');
      node.dataset.dogmomApplied = 'true';
      node.innerHTML = '';
      node.appendChild(createPriceLine('price-current', discountedPrice, unitText, precision));
      node.appendChild(createPriceLine('price-original', basePrice, unitText, precision));
    });
  } catch (err) {
    console.warn('dogMom pricing adjustment failed', err);
  }
}

if (typeof window !== 'undefined') {
  window.applyDogMomPricing = applyDogMomPricing;
}

function startDogMomPricingWatcher() {
  if (dogMomPricingWatcherId) return;

  const refreshPricing = () => {
    const isDogMom = hasLoyaltyBadge();
    const hasUnstyledPrice = document.querySelector('[data-price-base]:not([data-dogmom-applied="true"])');
    if (isDogMom && (hasUnstyledPrice || lastDogMomBadgeState === false)) {
      applyDogMomPricing();
    }
    lastDogMomBadgeState = isDogMom;
  };

  window.addEventListener('focus', refreshPricing, { passive: true });
  window.addEventListener('dogmom-badge-change', refreshPricing);
  dogMomPricingWatcherId = window.setInterval(refreshPricing, 2000);
  refreshPricing();
}

function updateAccountLabel(accountLabel, userEmail) {
  if (!accountLabel) return;
  const labelText = userEmail || 'Guest';
  accountLabel.textContent = '';

  if (userEmail && hasLoyaltyBadge()) {
    const icon = document.createElement('span');
    icon.className = 'loyalty-badge-icon';
    icon.textContent = '👑';
    icon.setAttribute('aria-hidden', 'true');
    accountLabel.appendChild(icon);
  }

  accountLabel.appendChild(document.createTextNode(labelText));
}

function applyAuthVisibility() {
  const signedIn = isUserSignedIn();
  document.querySelectorAll('[data-auth="signed-in"]').forEach((el) => {
    el.classList.toggle('auth-hidden', !signedIn);
  });
  document.querySelectorAll('[data-auth="signed-out"]').forEach((el) => {
    el.classList.toggle('auth-hidden', signedIn);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Try to load from external files first (works with http:// and https://)
  // Falls back to inline templates (works with file://)
  
  const headerContainer = document.getElementById('header-container');
  const navContainer = document.getElementById('nav-container');
  const reviewsContainer = document.getElementById('reviews-container');
  
  if (headerContainer) {
    hydrateFragment({
      url: 'header.html',
      container: headerContainer,
      fallbackHtml: HEADER_HTML,
      fatalOnFail: true
    });
  }
  
  if (navContainer) {
    const afterNavRender = () => {
      initializeDropdowns();
      initializeAccountNav();
      initializeMobileNav();
      applyAuthVisibility();
      applyDogMomPricing();
    };

    hydrateFragment({
      url: 'nav.html',
      container: navContainer,
      fallbackHtml: NAV_HTML,
      afterRender: afterNavRender,
      fatalOnFail: true
    });
  }
  
  if (reviewsContainer) {
    hydrateFragment({
      url: 'reviews.html',
      container: reviewsContainer,
      afterRender: () => initReviewCarousel()
    });
  }

  applyAuthVisibility();
  applyDogMomPricing();
  startDogMomPricingWatcher();
});

// Account/email dropdown toggle
function initializeAccountNav() {
  const dropdown = document.querySelector('.account-dropdown');
  if (!dropdown) return;
  const button = dropdown.querySelector('.account-button');
  const menu = dropdown.querySelector('.account-menu');
  const accountLabel = dropdown.querySelector('.account-label');
  const servicesLink = dropdown.querySelector('.nav-services-link');
  const originalLogoutButton = dropdown.querySelector('.logout-button');
  const highlightClass = 'nav-highlight';
  if (!button || !menu) return;

  // Display user email if logged in
  const userEmail = sessionStorage.getItem('userEmail');
  updateAccountLabel(accountLabel, userEmail);

  if (originalLogoutButton) {
    originalLogoutButton.replaceWith(originalLogoutButton.cloneNode(true));
  }

  const updatedLogoutButton = dropdown.querySelector('.logout-button');
  const updateNavHighlight = (signedIn) => {
    if (servicesLink) servicesLink.classList.toggle(highlightClass, signedIn);
    if (updatedLogoutButton) updatedLogoutButton.classList.toggle(highlightClass, !signedIn);
  };

  if (updatedLogoutButton) {
    if (userEmail) {
      updatedLogoutButton.textContent = 'Log out';
      updatedLogoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('userEmail');
        sessionStorage.removeItem('loyaltyBadge');
        sessionStorage.removeItem('guestExploring');
        dispatchDogMomBadgeChange();
        window.location.href = 'signin.html';
      });
    } else {
      updatedLogoutButton.textContent = 'Sign In';
      updatedLogoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('guestExploring');
        window.location.href = 'signin.html';
      });
    }
  }

  updateNavHighlight(Boolean(userEmail));

  function setOpen(isOpen) {
    dropdown.classList.toggle('open', isOpen);
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  button.addEventListener('click', () => {
    const isOpen = !dropdown.classList.contains('open');
    setOpen(isOpen);
  });

  // Close when clicking outside
  document.addEventListener('click', (evt) => {
    if (!dropdown.contains(evt.target)) {
      setOpen(false);
    }
  });
}

// Pet Carousel Logic for About.html
document.addEventListener('DOMContentLoaded', function() {
  const carousel = document.querySelector('.pet-carousel');
  if (!carousel) return;
  const slides = Array.from(carousel.querySelectorAll('.pet-slide'));
  const leftArrow = document.querySelector('.pet-carousel-arrow.left');
  const rightArrow = document.querySelector('.pet-carousel-arrow.right');
  const dots = Array.from(document.querySelectorAll('.pet-dot'));
  let current = 0;

  // If we're on a narrow screen, disable the carousel behavior and
  // instead show the slides stacked vertically (CSS handles layout).
  try {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (isMobile) {
      // Ensure all slides are visible and mark them active so any
      // styles that rely on .active still apply.
      slides.forEach(s => {
        s.classList.add('active');
        s.style.position = '';
        s.style.opacity = '';
      });
      // Hide controls that are not useful in stacked mode
      if (leftArrow) leftArrow.style.display = 'none';
      if (rightArrow) rightArrow.style.display = 'none';
      dots.forEach(d => d.style.display = 'none');
      // Nothing more to do for carousel behavior on mobile
      return;
    }
  } catch (e) {
    // if matchMedia is not supported, continue with carousel behavior
  }

  // Show a slide by index. options.center controls whether to center/scroll
  // the active slide into view (default true). Passing center:false avoids
  // triggering additional scrolling when the carousel was already scrolled
  // by arrow logic.
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
          // center using a computed scrollLeft for consistent behavior
          centerSlide(idx, true);
        }
      } catch (e) {
        // ignore if scrollIntoView options unsupported
      }
    }
  }

  // Helper: on mobile, scroll the carousel by a number of slides; on
  // desktop fallback to showSlide which toggles classes.
  function scrollBySlide(steps) {
    const mq = window.matchMedia('(max-width: 900px)');
    if (!mq.matches || !carousel) {
      // Desktop: update current via showSlide
      showSlide((current + steps + slides.length) % slides.length);
      return;
    }

    // Compute gap between slides (fallback to 12px)
    const cs = getComputedStyle(carousel);
    const gap = parseFloat(cs.gap || cs.columnGap || '12') || 12;
    const slideRect = slides[0].getBoundingClientRect();
    const slideWidth = slideRect.width;
    const delta = (slideWidth + gap) * steps;

    // Perform the scroll and then update the active index based on the
    // slide closest to the center of the carousel after the scroll.
    carousel.scrollBy({ left: delta, behavior: 'smooth' });

    // After the smooth scroll completes (approx), determine nearest slide
    // to center and update classes without triggering another scroll.
    setTimeout(() => {
      updateCurrentFromScroll();
    }, 380);
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
      // Update active classes but avoid centering again (we already scrolled)
      showSlide(bestIdx, { center: false });
    } catch (e) {
      // ignore
    }
  }

  // Center a slide in the carousel by computing the proper scrollLeft.
  function centerSlide(idx, smooth = true) {
    try {
      if (!carousel || !slides[idx]) return;
      const mq = window.matchMedia('(max-width: 900px)');
      if (!mq.matches) return;

      const slide = slides[idx];
      // offsetLeft is relative to the scroll container for direct children
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

  leftArrow.addEventListener('click', () => scrollBySlide(-1));
  rightArrow.addEventListener('click', () => scrollBySlide(1));
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => showSlide(i));
  });

  // Optional: swipe support for mobile
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

  // Initialize
  showSlide(0);
  // Ensure first slide is centered on mobile after layout stabilizes
  try {
    const mqInit = window.matchMedia('(max-width: 900px)');
    if (mqInit.matches) requestAnimationFrame(() => requestAnimationFrame(() => centerSlide(0, false)));
  } catch (e) { /* ignore */ }
});

// Review carousel logic (previously inline in index.html)
// This runs on any page that includes the `.review-carousel` markup.
function initReviewCarousel() {
  const container = document.querySelector('.review-carousel');
  if (!container) return;

  const allReviews = Array.from(container.querySelectorAll('.review-block'));
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

  // Hide all review-blocks not in filteredReviews
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

  // Auto-advance every 5 seconds
  let interval = setInterval(() => showReview((current + 1) % filteredReviews.length), 5000);
  
  // Pause on hover and resume when not hovering
  container.addEventListener('mouseenter', () => clearInterval(interval));
  container.addEventListener('mouseleave', () => { 
    interval = setInterval(() => showReview((current + 1) % filteredReviews.length), 5000); 
  });

  showReview(0);
}

// Initialize review carousel on pages that already have it in the HTML (like index.html)
document.addEventListener('DOMContentLoaded', function() {
  const container = document.querySelector('.review-carousel');
  if (container) {
    initReviewCarousel();
  }
});
// Calculate and set the CSS variable that controls where the side nav starts
function updateSideNavTop() {
  try {
    const hero = document.querySelector('.hero-banner') || document.querySelector('.header');
    if (!hero) {
      document.documentElement.style.setProperty('--sidenav-top', `0px`);
      return;
    }

    // Use boundingClientRect so we can react to scrolling. When the hero is
    // visible, set the side-nav top to the hero's bottom (so the nav sits
    // underneath). Once the hero scrolls out of view, set top to 0 so the
    // nav locks to the viewport top and no blank space is left behind.
    const rect = hero.getBoundingClientRect();
    const bottom = Math.max(0, Math.round(rect.bottom));
    document.documentElement.style.setProperty('--sidenav-top', `${bottom}px`);
  } catch (err) {
    // fail silently
    console.warn('updateSideNavTop error', err);
  }
}

// Initialize and keep in sync on resize/load
window.addEventListener('load', updateSideNavTop);
window.addEventListener('resize', updateSideNavTop);
// Update on scroll so the side-nav snaps to the top when the hero scrolls out
window.addEventListener('scroll', updateSideNavTop, { passive: true });

// Add a page-specific class so we can tweak styles (e.g., move Calendly badge)
(function markAboutPage(){
  try {
    const p = window.location.pathname || '';
    const filename = p.split('/').pop().toLowerCase();
    if (filename === 'about.html' || document.title.toLowerCase().includes('about')) {
      document.body.classList.add('about-page');
    }
  } catch (e) { /* ignore */ }
})();

// Right sidebar carousel removed - leftover from old navbar

// Ensure profile picture loads even if the file was moved out of `imgs/`.
// This will try a small set of likely alternate paths if the current src fails.
(function ensureProfileImage(){
  document.addEventListener('DOMContentLoaded', function(){
    const img = document.getElementById('profile-picture');
    if (!img) return;

    // If the image loads fine, nothing to do
    if (img.complete && img.naturalWidth > 0) return;

    const originalSrc = img.getAttribute('src') || '';

    const candidates = [
      originalSrc, // keep current as first
      'original.webp',
      'profile.webp',
      'profile.jpg',
      'imgs/original.webp',
      'imgs/original (25).webp'
    ];

    // Remove duplicates and undefined
    const uniq = Array.from(new Set(candidates.filter(Boolean)));

    let idx = 0;
    function tryNext(){
      if (idx >= uniq.length) {
        console.warn('Profile image: no candidate loaded.', uniq);
        return;
      }
      const src = uniq[idx++];
      const test = new Image();
      test.onload = function(){
        img.src = src;
        console.log('Profile image loaded from', src);
      };
      test.onerror = function(){
        tryNext();
      };
      test.src = src;
    }

    // Start with the next candidate if current didn't load
    if (!(img.complete && img.naturalWidth > 0)) tryNext();
  });
})();

// Main slideshow (reads /imgs.json). Provides thumbnails, captions, and simple filtering.
let carouselItems = [];
let fullCarouselItems = [];
let mainSlideIndex = 0;
let mainSlideInterval = null;
const MAIN_SLIDE_DELAY = 4000; // ms

function filenameToCaption(name) {
  // Remove extension and common punctuation, then tidy spacing
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

  // Attach prev/next handlers
  const prev = document.querySelector('#main-carousel .carousel-arrow.prev');
  const next = document.querySelector('#main-carousel .carousel-arrow.next');
  if (prev) prev.onclick = () => { showMainSlide(mainSlideIndex - 1); };
  if (next) next.onclick = () => { showMainSlide(mainSlideIndex + 1); };

  // pause on hover
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

  // reset auto interval so users get the full interval after manual change
  restartMainAutoSlide();
}

function startMainAutoSlide() {
  if (mainSlideInterval) return;
  mainSlideInterval = setInterval(() => { showMainSlide(mainSlideIndex + 1); }, MAIN_SLIDE_DELAY);
}

function pauseMainAutoSlide() { if (mainSlideInterval) clearInterval(mainSlideInterval); mainSlideInterval = null; }
function resumeMainAutoSlide() { if (!mainSlideInterval) startMainAutoSlide(); }
function restartMainAutoSlide() { pauseMainAutoSlide(); resumeMainAutoSlide(); }

// Image filter removed: function intentionally left out. Filtering UI was removed from HTML.

// Initialize slideshow when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Load manifest then build carousel
  loadMainManifest().then(list => {
    fullCarouselItems = list;
    carouselItems = list.slice();
    buildMainCarousel(carouselItems);
    showMainSlide(0);
    startMainAutoSlide();

    // Filter UI removed from markup; no wiring necessary.

    // keyboard left/right
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') showMainSlide(mainSlideIndex - 1);
      else if (e.key === 'ArrowRight') showMainSlide(mainSlideIndex + 1);
    });
  }).catch(err => {
    console.warn('Main carousel: failed to load images', err);
  });
});

// Enhanced accordion: when Details is clicked, open the matching hidden-box
// and smoothly center the whole service tile + details in the viewport.
const detailTriggers = document.querySelectorAll('.details-link, .nav-btn.details');

detailTriggers.forEach(trigger => {
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const parentSection = trigger.closest('.service-section') || trigger.closest('.box');
    if (!parentSection) return;

    // In the All Services layout, the hidden box is a sibling of .box
    const hiddenBox = parentSection.querySelector('.hidden-box') || parentSection.nextElementSibling;

    if (hiddenBox && hiddenBox.classList.contains('hidden-box')) {
      const isCurrentlyOpen = hiddenBox.classList.contains('open');

      // Close all hidden boxes
      document.querySelectorAll('.hidden-box.open').forEach(box => box.classList.remove('open'));

      if (!isCurrentlyOpen) {
        hiddenBox.classList.add('open');

        // After layout updates, scroll the entire service tile into a
        // centered position so it's obvious something expanded.
        setTimeout(() => {
          const target = parentSection.classList.contains('service-section') ? parentSection : hiddenBox;
          try {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          } catch (_) {
            // Fallback: simple scroll
            const rect = target.getBoundingClientRect();
            window.scrollTo({
              top: window.scrollY + rect.top - (window.innerHeight * 0.25),
              behavior: 'smooth'
            });
          }
        }, 150);

        // Analytics event
        if (window.analytics) {
          const productName = parentSection.querySelector('.product-name')?.textContent || 'Unknown Product';
          window.analytics.logEvent('product_view', {
            product_name: productName,
            interaction_type: 'expand_details'
          });
        }
      }
    }
  });
});
// Enhanced dropdown behavior: click/touch + hover on desktop + keyboard navigation and ARIA
function initializeDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown');

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown.open').forEach(d => {
      d.classList.remove('open');
      const b = d.querySelector('.dropbtn');
      if (b) b.setAttribute('aria-expanded', 'false');
      const m = d.querySelector('.dropdown-content');
      if (m) m.querySelectorAll('[role="menuitem"]').forEach(i => i.setAttribute('tabindex','-1'));
    });
  }

  dropdowns.forEach(dd => {
    const btn = dd.querySelector('.dropbtn');
    const menu = dd.querySelector('.dropdown-content');
    if (!btn || !menu) return;

    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));

    // Initialize ARIA and tabindex
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    items.forEach(it => it.setAttribute('tabindex','-1'));

    function openDropdown() {
      closeAllDropdowns();
      dd.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      items.forEach(it => it.setAttribute('tabindex','0'));
    }

    function closeDropdown() {
      dd.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      items.forEach(it => it.setAttribute('tabindex','-1'));
    }

    // Click toggles dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dd.classList.contains('open')) closeDropdown(); else openDropdown();
    });

    // Keyboard handling on button
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
        items[0]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openDropdown();
        items[items.length-1]?.focus();
      } else if (e.key === 'Escape') {
        closeDropdown();
        btn.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (dd.classList.contains('open')) closeDropdown(); else { openDropdown(); items[0]?.focus(); }
      }
    });

    // Keyboard navigation within menu
    menu.addEventListener('keydown', (e) => {
      const currentIndex = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[(currentIndex + 1) % items.length]; next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[(currentIndex - 1 + items.length) % items.length]; prev.focus();
      } else if (e.key === 'Home') {
        e.preventDefault(); items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault(); items[items.length-1].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault(); closeDropdown(); btn.focus();
      }
    });

    // When clicking a menu item, close the dropdown (let link follow)
    items.forEach(it => {
      it.addEventListener('click', () => { closeDropdown(); });
    });
  });

  // Close any open dropdown when clicking outside
  document.addEventListener('click', (e) => {
    // if click inside an open dropdown, ignore (already handled). Otherwise close.
    if (!e.target.closest('.dropdown')) closeAllDropdowns();
  });

  // Close on Escape globally
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });
}

// Initialize dropdowns on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeDropdowns();
});
