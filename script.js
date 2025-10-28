// Pet Carousel Logic for About.html
document.addEventListener('DOMContentLoaded', function() {
  const carousel = document.querySelector('.pet-carousel');
  if (!carousel) return;
  const slides = Array.from(carousel.querySelectorAll('.pet-slide'));
  const leftArrow = document.querySelector('.pet-carousel-arrow.left');
  const rightArrow = document.querySelector('.pet-carousel-arrow.right');
  const dots = Array.from(document.querySelectorAll('.pet-dot'));
  let current = 0;

  function showSlide(idx) {
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === idx);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === idx);
    });
    current = idx;
  }

  leftArrow.addEventListener('click', () => {
    showSlide((current - 1 + slides.length) % slides.length);
  });
  rightArrow.addEventListener('click', () => {
    showSlide((current + 1) % slides.length);
  });
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
  const images = [
    'Fennway.webp',
    'original (13).webp',
    'original (25).webp',
    'original (8).webp',
    'original (9).webp',
    'original.webp'
  ];

  function isDesktop() { return window.matchMedia('(min-width: 900px)').matches; }

  let sidebar = null;

  function build() {
    if (!isDesktop()) return remove();
    if (document.getElementById('right-sidebar-carousel')) return; // already exists

    sidebar = document.createElement('aside');
    sidebar.id = 'right-sidebar-carousel';
    sidebar.setAttribute('aria-hidden', 'true');

    const track = document.createElement('div');
    track.className = 'rsc-track';

    // Append images, then append same set again for seamless loop
    images.forEach(src => {
      const item = document.createElement('div');
      item.className = 'rsc-item';
      const img = document.createElement('img');
      img.src = `imgs/${src}`;
      img.alt = '';
      item.appendChild(img);
      track.appendChild(item);
    });
    // duplicate
    images.forEach(src => {
      const item = document.createElement('div');
      item.className = 'rsc-item';
      const img = document.createElement('img');
      img.src = `imgs/${src}`;
      img.alt = '';
      item.appendChild(img);
      track.appendChild(item);
    });

    sidebar.appendChild(track);
    document.body.appendChild(sidebar);

    // Wait for images to load (with a short timeout fallback) so the track's
    // height is stable before starting the CSS animation. This prevents the
    // brief visual pause that happens when the animation begins before layout
    // settles.
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
      // Race between all images and a timeout so we never wait forever
      return Promise.race([
        Promise.all(promises),
        new Promise(resolve => setTimeout(resolve, timeout))
      ]);
    }

    function computeAndSetDuration(trackEl, speedPxPerSec = 28) {
      // The track contains two copies; we animate by translating -50% so the
      // distance we travel equals half the track scrollHeight.
      const totalPx = trackEl.scrollHeight / 2;
      // Minimum duration to keep the motion gentle
      const minDuration = 10; // seconds
      const duration = Math.max(minDuration, Math.round((totalPx / speedPxPerSec) * 10) / 10);
      trackEl.style.animationDuration = `${duration}s`;
      return duration;
    }

    const imgs = Array.from(track.querySelectorAll('img'));
    waitForImages(imgs).then(() => {
      // Ensure duration matches the rendered size, then start animation
      computeAndSetDuration(track);
      // small timeout to ensure browser laid out the height change
      requestAnimationFrame(() => requestAnimationFrame(() => track.classList.add('animating')));
    }).catch(() => {
      // fallback: start the animation regardless after a short delay
      setTimeout(() => track.classList.add('animating'), 600);
    });

    // Recompute duration on resize (track height may change). Throttle to avoid
    // excessive recalculations.
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
      if (!track) return;
      if (resizeTimeout) clearTimeout(resizeTimeout);
      // Pause animation while recalculating to avoid visible speed jumps
      track.classList.remove('animating');
      resizeTimeout = setTimeout(() => {
        computeAndSetDuration(track);
        // restart the animation in the next frame
        requestAnimationFrame(() => track.classList.add('animating'));
      }, 180);
    });

    // keep sidebar top/height in sync with --sidenav-top
    updateSidebarPosition();
    window.addEventListener('resize', updateSidebarPosition);
    window.addEventListener('scroll', updateSidebarPosition, { passive: true });
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
    // height should account for --sidenav-top
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

// Carousel image configuration
const carouselImages = [
    { src: "original (13).webp", alt: "Professional dog walking and pet care services" },
    { src: "original (25).webp", alt: "Dog walking services in action" },
    { src: "original (8).webp", alt: "Professional pet care and companionship" },
    { src: "original (9).webp", alt: "Happy pets with professional care" }
];

// Auto-slideshow functionality (no manual controls)
let slideIndex = 0;
let slideInterval;

// Initialize slideshow when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Test Firebase connection
  if (typeof firebase !== 'undefined' && window.firebaseApp) {
    console.log('✅ Firebase is connected successfully!');
    console.log('Firebase App:', window.firebaseApp);
    
    // Test Analytics
    if (window.analytics) {
      console.log('✅ Firebase Analytics is working!');
      // Log a test event
      window.analytics.logEvent('page_view', {
        page_title: document.title,
        page_location: window.location.href
      });
    }
  } else {
    console.error('❌ Firebase is not loaded properly');
  }

  // Initialize dynamic carousel
  initializeCarousel();
});

// Function to create carousel slides dynamically
function createCarouselSlides() {
    const slidesContainer = document.querySelector('.slides-container');
    if (!slidesContainer) return;
    
    // Clear existing slides
    slidesContainer.innerHTML = '';
    
    // Create slides from image array
    carouselImages.forEach((image, index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        if (index === 0) slide.style.display = 'block';
        else slide.style.display = 'none';
        
        slide.innerHTML = `
            <img src="imgs/${image.src}" alt="${image.alt}">
        `;
        
        slidesContainer.appendChild(slide);
    });
}

// Show specific slide
function showSlide(n) {
  let slides = document.getElementsByClassName("slide");
  
  if (!slides.length) return;
  
  if (n >= slides.length) { slideIndex = 0; }
  if (n < 0) { slideIndex = slides.length - 1; }
  
  // Hide all slides
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  
  // Show current slide
  if (slides[slideIndex]) {
    slides[slideIndex].style.display = "block";
  }
}

// Auto-slide functionality
function startAutoSlide() {
  slideInterval = setInterval(function() {
    slideIndex++;
    if (slideIndex >= carouselImages.length) {
      slideIndex = 0;
    }
    showSlide(slideIndex);
  }, 4000); // Change slide every 4 seconds
}

// Initialize carousel
function initializeCarousel() {
    createCarouselSlides();
    showSlide(slideIndex);
    startAutoSlide();
}

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
document.addEventListener('DOMContentLoaded', function() {
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
});
