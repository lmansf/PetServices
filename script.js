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

// Your existing accordion functionality
const clickers = document.querySelectorAll('.clicker');

clickers.forEach(clicker => {
  clicker.addEventListener('click', () => {
    // Find the hidden box that belongs to this clicker's parent box
    const parentBox = clicker.closest('.box');
    const hiddenBox = parentBox.nextElementSibling;
    
    if (hiddenBox && hiddenBox.classList.contains('hidden-box')) {
      // Check if this box is currently visible
      const isCurrentlyVisible = hiddenBox.style.display === 'block';
      
      // Hide all hidden boxes first
      document.querySelectorAll('.hidden-box').forEach(box => {
        box.style.display = 'none';
      });
      
      // If this box wasn't visible before, show it (toggle behavior)
      if (!isCurrentlyVisible) {
        hiddenBox.style.display = 'block';
        
        // Log analytics event for product interaction
        if (window.analytics) {
          const productName = parentBox.querySelector('.product-name')?.textContent || 'Unknown Product';
          window.analytics.logEvent('product_view', {
            product_name: productName,
            interaction_type: 'expand_details'
          });
        }
      }
      // If it was visible, it stays hidden (toggled off)
    }
  });
})