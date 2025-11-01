// Load header and navigation HTML dynamically
// Templates stored in JavaScript for compatibility with file:// protocol
const HEADER_HTML = `<div class="hero-banner" style="width:100%;max-width:100vw;overflow:hidden;margin-bottom:0.5rem;">
  <img src="Amanda's Pet Services HERO.svg" alt="Dog walking hero" style="width:100%;display:block;">
</div>`;

const NAV_HTML = `<div class="topnav">
  <a href="index.html">Home</a>
  <a href="About.html">About Me</a>
  <div class="dropdown">
    <button id="home-button" class="dropbtn" aria-haspopup="true" aria-controls="home-menu" aria-expanded="false">All Services ▾</button>
    <div id="home-menu" class="dropdown-content" role="menu" aria-labelledby="home-button">
      <a href="houseSitting.html" role="menuitem" tabindex="-1">House Sitting</a>
      <a href="dropIns.html" role="menuitem" tabindex="-1">Drop-In Visits</a>
      <a href="walking.html" role="menuitem" tabindex="-1">Dog Walking</a>
    </div>
  </div>
</div>`;

document.addEventListener('DOMContentLoaded', function() {
  // Try to load from external files first (works with http:// and https://)
  // Falls back to inline templates (works with file://)
  
  const headerContainer = document.getElementById('header-container');
  const navContainer = document.getElementById('nav-container');
  const reviewsContainer = document.getElementById('reviews-container');
  
  if (headerContainer) {
    // Try fetch first
    fetch('header.html')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load header');
        return response.text();
      })
      .then(html => {
        headerContainer.innerHTML = html;
      })
      .catch(error => {
        // Fallback to inline template
        console.log('Using inline header template');
        headerContainer.innerHTML = HEADER_HTML;
      });
  }
  
  if (navContainer) {
    // Try fetch first
    fetch('nav.html')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load nav');
        return response.text();
      })
      .then(html => {
        navContainer.innerHTML = html;
        // Re-initialize dropdown functionality after nav is loaded
        initializeDropdowns();
      })
      .catch(error => {
        // Fallback to inline template
        console.log('Using inline nav template');
        navContainer.innerHTML = NAV_HTML;
        // Re-initialize dropdown functionality after nav is loaded
        initializeDropdowns();
      });
  }
  
  if (reviewsContainer) {
    // Load reviews HTML
    fetch('reviews.html')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load reviews');
        return response.text();
      })
      .then(html => {
        reviewsContainer.innerHTML = html;
        // Initialize the review carousel after the HTML is loaded
        initReviewCarousel();
      })
      .catch(error => {
        console.log('Failed to load reviews:', error);
      });
  }
});

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
// This runs on any page that includes the `.review-carousel-container` markup.
function initReviewCarousel() {
  const container = document.querySelector('.review-carousel-container');
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

  // Generate dots dynamically
  const indicators = container.querySelector('.review-carousel-indicators');
  if (!indicators) return;
  indicators.innerHTML = '';
  const dots = [];
  for (let i = 0; i < filteredReviews.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'review-dot' + (i === 0 ? ' active' : '');
    indicators.appendChild(dot);
    dots.push(dot);
  }

  let current = 0;
  function showReview(idx) {
    filteredReviews.forEach((r, i) => {
      r.classList.toggle('active', i === idx);
      r.style.display = i === idx ? '' : 'none';
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    current = idx;
  }

  // Attach arrow listeners
  filteredReviews.forEach((review, i) => {
    const leftArrow = review.querySelector('.review-arrow.left');
    const rightArrow = review.querySelector('.review-arrow.right');
    if (leftArrow) leftArrow.addEventListener('click', e => { e.stopPropagation(); showReview((current - 1 + filteredReviews.length) % filteredReviews.length); });
    if (rightArrow) rightArrow.addEventListener('click', e => { e.stopPropagation(); showReview((current + 1) % filteredReviews.length); });
  });

  dots.forEach((dot, i) => dot.addEventListener('click', () => showReview(i)));

  // Optional: auto-advance every 7 seconds
  let interval = setInterval(() => showReview((current + 1) % filteredReviews.length), 7000);
  container.addEventListener('mouseenter', () => clearInterval(interval));
  container.addEventListener('mouseleave', () => { interval = setInterval(() => showReview((current + 1) % filteredReviews.length), 7000); });

  showReview(0);
}

// Initialize review carousel on pages that already have it in the HTML (like index.html)
document.addEventListener('DOMContentLoaded', function() {
  const container = document.querySelector('.review-carousel-container');
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

// Right sidebar carousel: inject a fixed right sidebar on desktop and populate
// it with images from the imgs/ folder. Uses CSS animation for seamless scroll.
 (function createRightSidebarCarousel(){
  // Attempt to load a generated manifest `imgs.json` from the site root.
  // If it isn't available (e.g., developer didn't run the generator), fall
  // back to a small bundled set so the site still looks reasonable.
  const FALLBACK_IMAGES = [
    'Fennway.webp',
    'original (13).webp',
    'original (25).webp',
    'original (8).webp',
    'original (9).webp',
    'original.webp'
  ];

  function isDesktop() { return window.matchMedia('(min-width: 900px)').matches; }

  let sidebar = null;

  // Load image list from /imgs.json (produced by build script). Returns a
  // promise that resolves to an array of filenames (strings).
  function loadImageManifest() {
    return fetch('/imgs.json', { cache: 'no-cache' })
      .then(resp => {
        if (!resp.ok) throw new Error('no manifest');
        return resp.json();
      })
      .then(list => Array.isArray(list) ? list.filter(Boolean) : FALLBACK_IMAGES)
      .catch(() => {
        // If fetching/parsing fails, try a relative path (useful on local dev)
        return fetch('imgs.json', { cache: 'no-cache' })
          .then(resp => resp.ok ? resp.json() : FALLBACK_IMAGES)
          .then(list => Array.isArray(list) ? list.filter(Boolean) : FALLBACK_IMAGES)
          .catch(() => FALLBACK_IMAGES);
      });
  }

  function build() {
    if (!isDesktop()) return remove();
    if (document.getElementById('right-sidebar-carousel')) return; // already exists

    // Acquire the image list then create the sidebar
    loadImageManifest().then(images => {
      // If no images, bail
      if (!images || !images.length) return;

      sidebar = document.createElement('aside');
      sidebar.id = 'right-sidebar-carousel';
      sidebar.setAttribute('aria-hidden', 'true');

      const track = document.createElement('div');
      track.className = 'rsc-track';

      // Helper to append one copy of the images
      function appendOneCopy(list) {
        list.forEach(src => {
          const item = document.createElement('div');
          item.className = 'rsc-item';
          const img = document.createElement('img');
          img.src = `imgs/${src}`;
          img.alt = '';
          item.appendChild(img);
          track.appendChild(item);
        });
      }

      // Append images, then append same set again for seamless loop
      appendOneCopy(images);
      appendOneCopy(images);

      sidebar.appendChild(track);
      document.body.appendChild(sidebar);

      // Wait for images to load (with a short timeout fallback) so the track's
      // height is stable before starting the CSS animation.
      function waitForImages(imgs, timeout = 2500) {
        const promises = imgs.map(img => {
          return new Promise(resolve => {
            if (img.complete && img.naturalWidth > 0) return resolve(true);
            const onLoad = () => { cleanup(); resolve(true); };
            const onErr = () => { cleanup(); resolve(false); };
            const cleanup = () => { img.removeEventListener('load', onLoad); img.removeEventListener('error', onErr); };
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onErr);
          });
        });
        return Promise.race([
          Promise.all(promises),
          new Promise(resolve => setTimeout(resolve, timeout))
        ]);
      }

      function computeAndSetDuration(trackEl, speedPxPerSec = 28) {
        const totalPx = trackEl.scrollHeight / 2;
        const minDuration = 10; // seconds
        const duration = Math.max(minDuration, Math.round((totalPx / speedPxPerSec) * 10) / 10);
        trackEl.style.animationDuration = `${duration}s`;
        return duration;
      }

      const imgs = Array.from(track.querySelectorAll('img'));
      waitForImages(imgs).then(() => {
        computeAndSetDuration(track);
        requestAnimationFrame(() => requestAnimationFrame(() => track.classList.add('animating')));
      }).catch(() => setTimeout(() => track.classList.add('animating'), 600));

      // Recompute duration on resize (track height may change). Throttle.
      let resizeTimeout = null;
      window.addEventListener('resize', () => {
        if (!track) return;
        if (resizeTimeout) clearTimeout(resizeTimeout);
        track.classList.remove('animating');
        resizeTimeout = setTimeout(() => {
          computeAndSetDuration(track);
          requestAnimationFrame(() => track.classList.add('animating'));
        }, 180);
      });

      updateSidebarPosition();
      window.addEventListener('resize', updateSidebarPosition);
      window.addEventListener('scroll', updateSidebarPosition, { passive: true });
    }).catch(err => {
      console.warn('Right sidebar carousel: failed to load images manifest', err);
    });
  }

  function remove() {
    const existing = document.getElementById('right-sidebar-carousel');
    if (existing) existing.remove();
    sidebar = null;
  }

  function updateSidebarPosition(){
    const el = document.getElementById('right-sidebar-carousel');
    if (!el) return;
    const top = getComputedStyle(document.documentElement).getPropertyValue('--sidenav-top') || '0px';
    el.style.top = top.trim();
    el.style.height = `calc(100vh - ${top.trim()})`;
  }

  // Build on load and when viewport crosses the desktop threshold
  window.addEventListener('load', build);
  window.addEventListener('resize', () => {
    if (isDesktop()) build(); else remove();
  });
})();

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

// Enhanced accordion: only open the hidden-box when the Details trigger is clicked.
// Prevent default link navigation (href="#") and avoid scrolling the product box to top.
const detailTriggers = document.querySelectorAll('.details-link, .nav-btn.details');

detailTriggers.forEach(trigger => {
  trigger.addEventListener('click', (e) => {
    // Prevent anchor default behavior which can jump to top (href="#")
    e.preventDefault();
    e.stopPropagation();

    // Find the hidden box that belongs to this trigger's parent .box
    const parentBox = trigger.closest('.box');
    if (!parentBox) return;
    const hiddenBox = parentBox.nextElementSibling;

    if (hiddenBox && hiddenBox.classList.contains('hidden-box')) {
      const isCurrentlyOpen = hiddenBox.classList.contains('open');

      // Close all hidden boxes first
      document.querySelectorAll('.hidden-box').forEach(box => box.classList.remove('open'));

      // If it wasn't open, open it (no scroll-to-top)
      if (!isCurrentlyOpen) {
        hiddenBox.classList.add('open');

        // After a short delay, adjust scroll to center the calendly area (if present)
        setTimeout(() => {
          const calendlySection = hiddenBox.querySelector('.calendly');
          if (calendlySection) {
            calendlySection.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }
        }, 150);

        // Analytics event
        if (window.analytics) {
          const productName = parentBox.querySelector('.product-name')?.textContent || 'Unknown Product';
          window.analytics.logEvent('product_view', {
            product_name: productName,
            interaction_type: 'expand_details'
          });
        }
      }
    }
  });
});
// card slide out for first appointments
document.addEventListener('DOMContentLoaded', function() {
    const card = document.getElementById('myCard');
    card.classList.add('slide-in');
});

// callout removed — no positioning needed

// Enhanced dropdown behavior: click/touch + hover on desktop + keyboard navigation and ARIA

// Set a cookie with a given name and value
function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

// Delete a cookie by name
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

// Add event listeners to navigation buttons on index.html
document.addEventListener('DOMContentLoaded', function() {
  const navBtns = document.querySelectorAll('.nav-btn[data-page][data-href]');
  navBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      // Always remove any previous nextpage cookie before setting a new one
      deleteCookie('nextpage');
      // Optionally, also remove any legacy cookies if they exist
      deleteCookie('dropins');
      deleteCookie('walking');
      deleteCookie('housesitting');
      const page = btn.getAttribute('data-page');
      const href = btn.getAttribute('data-href');
      setCookie('nextpage', page);
      window.location.href = href;
    });
  });
});

// Attach cookie-setting to visible "Book Today" buttons on listing pages (index)
// These buttons are often inside anchors and lack data-page attributes, so
// infer the service from the surrounding .service-section/.product-name text.
document.addEventListener('DOMContentLoaded', function() {
  try {
    function inferServiceKey(el) {
      const section = el.closest('.service-section') || el.closest('.box') || el.closest('.content');
      const nameEl = section ? section.querySelector('.product-name') : document.querySelector('.product-name');
      const txt = nameEl ? nameEl.textContent.toLowerCase() : '';
      if (!txt) return null;
      if (txt.includes('house')) return 'housesitting';
      if (txt.includes('drop')) return 'dropins';
      if (txt.includes('dog') || txt.includes('walk')) return 'walking';
      // Skip introductions/free-intro buttons
      if (txt.includes('introduc') || txt.includes('intro')) return null;
      return null;
    }

    // Select book-today buttons whether nested inside anchors or standalone
    const bookButtons = Array.from(document.querySelectorAll('a .nav-btn.book-today, .nav-btn.book-today'));
    bookButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        try {
          const key = inferServiceKey(btn);
          if (key) setCookie('nextpage', key);
        } catch (err) {
          // don't block navigation on errors
          console.warn('set nextpage cookie failed', err);
        }
      });
    });
  } catch (err) {
    console.warn('book-today cookie wiring failed', err);
  }
});

// Add cookie-setting for Calendly/book interactions on service pages.
document.addEventListener('DOMContentLoaded', function() {
  try {
    const path = (window.location.pathname || '').split('/').pop().toLowerCase();
    const pageMap = {
      'housesitting.html': 'housesitting',
      'dropins.html': 'dropins',
      'walking.html': 'walking'
    };
    const pageKey = pageMap[path];
    if (!pageKey) return;

    // When any direct link to calendly is clicked, set the nextpage cookie.
    document.querySelectorAll('a[href*="calendly.com"]').forEach(a => {
      a.addEventListener('click', () => {
        try { setCookie('nextpage', pageKey); } catch (e) { /* ignore */ }
      });
    });

    // For inline widgets, listen for a user interaction inside the widget container
    // (click or mousedown) and set the cookie so the booking flow can read it.
    document.querySelectorAll('.calendly-inline-widget').forEach(el => {
      const handler = () => { try { setCookie('nextpage', pageKey); } catch (e) {} };
      el.addEventListener('click', handler);
      el.addEventListener('touchstart', handler, { passive: true });
    });
  } catch (err) {
    console.warn('cookie wiring for calendly links failed', err);
  }
});
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
