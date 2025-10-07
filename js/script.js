let slideIndex = 0;
showSlides();

function showSlides() {
  let slides = document.getElementsByClassName("slide");
  for (let i = 0; i < slides.length; i++) {
    slides[i].classList.remove("active");
  }
  slideIndex++;
  if (slideIndex > slides.length) { slideIndex = 1; }
  slides[slideIndex - 1].classList.add("active");
  setTimeout(showSlides, 4000); // 4-second interval
}

function plusSlides(n) {
  let slides = document.getElementsByClassName("slide");
  slideIndex += n;
  if (slideIndex > slides.length) { slideIndex = 1; }
  if (slideIndex < 1) { slideIndex = slides.length; }
  for (let i = 0; i < slides.length; i++) {
    slides[i].classList.remove("active");
  }
  slides[slideIndex - 1].classList.add("active");
}

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

window.addEventListener('load', () => {
  const hash = window.location.hash.substring(1);
  showPage(hash || 'home');
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  showPage(hash || 'home');
});

window.addEventListener('scroll', () => {
  const header = document.querySelector('header');
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});