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
      }
      // If it was visible, it stays hidden (toggled off)
    }
  });
})