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

// Enhanced accordion functionality with smooth animations and scroll positioning
const clickers = document.querySelectorAll('.clicker');

clickers.forEach(clicker => {
  clicker.addEventListener('click', () => {
    // Find the hidden box that belongs to this clicker's parent box
    const parentBox = clicker.closest('.box');
    const hiddenBox = parentBox.nextElementSibling;
    
    if (hiddenBox && hiddenBox.classList.contains('hidden-box')) {
      // Check if this box is currently open
      const isCurrentlyOpen = hiddenBox.classList.contains('open');
      
      // Close all hidden boxes first with smooth animation
      document.querySelectorAll('.hidden-box').forEach(box => {
        box.classList.remove('open');
      });
      
      // If this box wasn't open before, open it immediately
      if (!isCurrentlyOpen) {
        // Scroll the product box to the top smoothly
        parentBox.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });

        // Open the hidden box immediately for a snappy feel
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
        }, 150); // Minimal delay for transition to start

        // Log analytics event for product interaction
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
})
// card slide out for first appointments
document.addEventListener('DOMContentLoaded', function() {
    const card = document.getElementById('myCard');
    card.classList.add('slide-in');
});

// callout removed — no positioning needed

// Enhanced dropdown behavior: click/touch + hover on desktop + keyboard navigation and ARIA
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
