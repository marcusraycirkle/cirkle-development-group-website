function showPage(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => {
    page.classList.remove('active');
    page.style.opacity = 0;
  });
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
    setTimeout(() => { targetPage.style.opacity = 1; }, 10);
  }
  window.location.hash = pageId;
}

// On load, show page based on hash or default to home
window.addEventListener('load', () => {
  const hash = window.location.hash.substring(1);
  showPage(hash || 'home');
});

// Handle hash changes (back/forward buttons)
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  showPage(hash || 'home');
});