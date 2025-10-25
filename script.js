const clickers = document.querySelectorAll('.clicker');

clickers.forEach(clicker => {
  clicker.addEventListener('click', () => {
    // Hide all hidden boxes
    document.querySelectorAll('.hidden-box').forEach(box => {
        box.style.display = 'none';
    })

    // Find the hidden box that belongs to this clicker's parent box
    const parentBox = clicker.closest('.box');
    const hiddenBox = parentBox.nextElementSibling;
    
    if (hiddenBox && hiddenBox.classList.contains('hidden-box')) {
      hiddenBox.style.display = 'block';
    }
});

})