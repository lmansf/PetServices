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
      <a href="index.html" role="menuitem" class="nav-services-link nav-highlightable">Services</a>
      <hr>
      <button type="button" class="logout-button nav-highlightable" role="menuitem">Sign In</button>
    </div>
  </div>
</nav>`;

const FOOTER_HTML = `<footer class="site-footer" aria-label="Amanda's Pet Services footer">
  <video class="site-footer__video" autoplay loop muted playsinline>
    <source src="footer.mp4" type="video/mp4" />
    Your browser does not support the video tag.
  </video>
  <div class="site-footer__overlay">
    <div class="site-footer__content">
      <h2>Connect With Me</h2>
      <p class="site-footer__contact">Contact: amansfld@gmail.com | (727) 346-8269</p>
      <div class="site-footer__links" role="group" aria-label="Primary footer links">
        <a href="feedback.html">Feedback</a>
        <a href="About.html">About Me</a>
        <a href="https://www.rover.com/members/amanda-m-retired-dog-mom-ready-to-play/" target="_blank" rel="noopener">Rover Profile</a>
      </div>
    </div>
  </div>
</footer>`;

(function enforceSignInGate() {
  if (typeof window === 'undefined') return;
  try {
    const path = (window.location.pathname || '').toLowerCase();
    const bypassPaths = ['/signin.html', '/signin', '/error.html'];
    if (bypassPaths.some(suffix => path.endsWith(suffix))) {
      return;
    }

    const signedIn = Boolean(sessionStorage.getItem('userEmail'));
    const guestMode = sessionStorage.getItem('guestExploring') === 'true';
    if (signedIn || guestMode) {
      return;
    }

    const redirectBase = (() => {
      try {
        return new URL('signin.html', window.location.origin).toString();
      } catch (err) {
        return 'signin.html';
      }
    })();

    const nextDest = encodeURIComponent(window.location.pathname + window.location.search);
    const separator = redirectBase.includes('?') ? '&' : '?';
    window.location.replace(`${redirectBase}${separator}next=${nextDest}`);
  } catch (err) {
    console.warn('sign-in enforcement failed', err);
  }
})();

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

let lazyModulePromise = null;

function loadLazyModule(trigger = 'manual') {
  if (!lazyModulePromise) {
    lazyModulePromise = import('./script.lazy.js')
      .catch(err => {
        lazyModulePromise = null;
        throw err;
      });
  }
  return lazyModulePromise;
}

function invokeLazy(methodName, ...args) {
  return loadLazyModule(methodName)
    .then(mod => {
      const fn = mod?.[methodName];
      if (typeof fn === 'function') {
        return fn(...args);
      }
    })
    .catch(err => console.warn(`[lazy] ${methodName} failed`, err));
}

function whenVisible(element, callback, options = { rootMargin: '200px' }) {
  if (!element) return;
  if (!('IntersectionObserver' in window)) {
    callback(element);
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        obs.disconnect();
        callback(element);
      }
    });
  }, options);

  observer.observe(element);
}

function observeLazyFeature(element, methodName, args = [], options) {
  if (!element) return;
  const invokeArgs = Array.isArray(args) ? args : [args];
  whenVisible(element, () => invokeLazy(methodName, ...invokeArgs), options);
}

function scheduleIdleLazyLoad() {
  if (typeof window === 'undefined') return;
  const idle = window.requestIdleCallback || function(cb) { setTimeout(cb, 500); };
  idle(() => loadLazyModule('idle'));
}

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

function queueLoyaltyPricing() {
  invokeLazy('ensureLoyaltyPricing');
}

if (typeof window !== 'undefined') {
  window.applyDogMomPricing = () => invokeLazy('applyDogMomPricing');
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

function updateBookingActions() {
  const guestMode = !isUserSignedIn();
  document.querySelectorAll('.book-action').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    if (!link.dataset.bookingHref) {
      link.dataset.bookingHref = link.getAttribute('href') || '';
    }

    const originalHref = link.dataset.bookingHref || '';
    const ctaButton = link.querySelector('.book-today');

    if (guestMode) {
      link.href = 'profile.html';
      link.setAttribute('aria-label', 'Complete your profile before booking');
      if (ctaButton) ctaButton.textContent = 'Complete your profile.';
    } else {
      if (originalHref) {
        link.href = originalHref;
      }
      link.removeAttribute('aria-label');
      if (ctaButton) ctaButton.textContent = 'Book Today';
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Try to load from external files first (works with http:// and https://)
  // Falls back to inline templates (works with file://)
  
  const headerContainer = document.getElementById('header-container');
  const navContainer = document.getElementById('nav-container');
  const reviewsContainer = document.getElementById('reviews-container');
  const footerContainer = document.getElementById('footer-container');
  
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
      queueLoyaltyPricing();
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
      afterRender: () => prepareReviewCarousel(reviewsContainer)
    });
  }

  if (footerContainer) {
    hydrateFragment({
      url: 'footer.html',
      container: footerContainer,
      fallbackHtml: FOOTER_HTML
    });
  }

  applyAuthVisibility();
  queueLoyaltyPricing();
  const mainCarousel = document.getElementById('main-carousel');
  if (mainCarousel) {
    observeLazyFeature(mainCarousel, 'initMainCarousel');
  }

  const petCarousel = document.querySelector('.pet-carousel');
  if (petCarousel) {
    observeLazyFeature(petCarousel, 'initPetCarousel');
  }

  scheduleIdleLazyLoad();
  updateBookingActions();
});

function prepareReviewCarousel(container) {
  if (!container) return;
  observeLazyFeature(container, 'initReviewCarousel', [{ container }]);
}

async function checkProfileCompletion(email, button) {
  // Check session storage first
  let isComplete = sessionStorage.getItem('profileComplete');

  if (isComplete === null) {
    try {
      // We need to fetch the profile to know for sure
      if (window.firebase && window.firebase.functions) {
        const getUserProfile = firebase.functions().httpsCallable('getUserProfile');
        // SECURITY UPDATE: Do not pass email. The function now uses the authenticated user's ID.
        const result = await getUserProfile();
        const data = result.data;

        // Check fields
        const hasName = data.firstName && data.lastName;
        const hasPhone = data.phone;
        const hasAddress = data.address && data.address.street && data.address.city && data.address.state && data.address.zip;
        const hasPets = data.pets && data.pets.length > 0;

        isComplete = (hasName && hasPhone && hasAddress && hasPets) ? 'true' : 'false';
        sessionStorage.setItem('profileComplete', isComplete);
      }
    } catch (e) {
      console.warn('Failed to check profile completion', e);
      // If we can't check, assume complete to avoid annoying the user
      return;
    }
  }

  if (isComplete === 'false') {
    // Blinking effect removed per user request
    // button.classList.add('profile-incomplete');

    // Also highlight the Profile link in the dropdown
    // const profileLink = document.querySelector('.account-menu a[href="profile.html"]');
    // if (profileLink) {
    //   profileLink.classList.add('profile-incomplete');
    // }

    // Create tooltip element attached to body
    let tooltip = document.getElementById('profile-tooltip-element');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'profile-tooltip-element';
      tooltip.className = 'profile-tooltip';
      tooltip.textContent = "Complete your profile to schedule your first introduction today!";
      document.body.appendChild(tooltip);
    }

    // Add mouse events for "attached to mouse" behavior
    button.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });

    button.addEventListener('mousemove', (e) => {
      // Position tooltip near the mouse cursor
      const offset = 15;
      tooltip.style.left = (e.clientX + offset) + 'px';
      tooltip.style.top = (e.clientY + offset) + 'px';
    });

    button.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
}

// Account/email dropdown toggle
const ADMIN_EMAILS = ['amansfld@gmail.com', 'lmansf96@gmail.com'];

function initializeAccountNav() {
  const dropdown = document.querySelector('.account-dropdown');
  if (!dropdown) return;
  const button = dropdown.querySelector('.account-button');
  const menu = dropdown.querySelector('.account-menu');
  const accountLabel = dropdown.querySelector('.account-label');
  
  if (!button || !menu) return;

  // Display user email if logged in
  const userEmail = sessionStorage.getItem('userEmail');
  updateAccountLabel(accountLabel, userEmail);
  
  // Clear existing menu items to rebuild based on role
  menu.innerHTML = '';

  const createLink = (text, href, extraClass = '') => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.setAttribute('role', 'menuitem');
    if (extraClass) a.className = extraClass;
    return a;
  };

  const createButton = (text, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'logout-button nav-highlightable';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  };

  const createHr = () => document.createElement('hr');

  if (userEmail) {
    checkProfileCompletion(userEmail, button);
    
    const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());

    if (isAdmin) {
        // Admin Menu
        menu.appendChild(createLink('Admin Management', 'admin.html'));
        menu.appendChild(createLink('Services', 'index.html', 'nav-services-link nav-highlightable'));
        menu.appendChild(createLink('My Profile', 'profile.html'));
    } else {
        // User/Customer Menu
        menu.appendChild(createLink('Services', 'index.html', 'nav-services-link nav-highlightable'));
        menu.appendChild(createLink('My Profile', 'profile.html'));
    }

    // Log Out
    menu.appendChild(createHr());
    menu.appendChild(createButton('Log out', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('userEmail');
        sessionStorage.removeItem('loyaltyBadge');
        sessionStorage.removeItem('guestExploring');
        dispatchDogMomBadgeChange();
        window.location.href = 'index.html';
    }));

  } else {
    // Guest Menu
    menu.appendChild(createLink('Services', 'index.html', 'nav-services-link nav-highlightable'));
    menu.appendChild(createHr());
    menu.appendChild(createButton('Sign in', (e) => {
        e.preventDefault();
        const currentPath = (typeof window !== 'undefined')
          ? `${window.location.pathname || '/'}${window.location.search || ''}`
          : 'index.html';
        const signInTarget = `signin.html?next=${encodeURIComponent(currentPath)}`;
        window.location.href = signInTarget;
    }));
  }

  updateBookingActions();

  // Highlight services link if it exists
  const servicesLink = menu.querySelector('.nav-services-link');
  if (servicesLink) servicesLink.classList.add('nav-highlight');

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
