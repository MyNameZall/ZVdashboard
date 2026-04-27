/* ============================================
   LOKADJAYA — Alpine.js Application Logic
   Modern-Rustic Hub | Lamongan
   ============================================ */

// --- Scroll Animation Observer ---
document.addEventListener('DOMContentLoaded', () => {
  // Intersection Observer for fade-up animations
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );

  document.querySelectorAll('.fade-up').forEach((el) => {
    observer.observe(el);
  });

  // Hero background parallax (subtle)
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    setTimeout(() => heroBg.classList.add('loaded'), 100);
  }

  // Generate floating particles for hero
  generateParticles();
});

// --- Particle Generator ---
function generateParticles() {
  const container = document.querySelector('.hero-particles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 8 + 6) + 's';
    particle.style.animationDelay = (Math.random() * 5) + 's';
    particle.style.width = (Math.random() * 4 + 2) + 'px';
    particle.style.height = particle.style.width;
    container.appendChild(particle);
  }
}

// --- Alpine.js Components ---
document.addEventListener('alpine:init', () => {
  // Navigation Store
  Alpine.store('nav', {
    scrolled: false,
    mobileOpen: false,
    init() {
      window.addEventListener('scroll', () => {
        this.scrolled = window.scrollY > 60;
      });
    },
    toggleMobile() {
      this.mobileOpen = !this.mobileOpen;
      document.body.style.overflow = this.mobileOpen ? 'hidden' : '';
    },
    closeMobile() {
      this.mobileOpen = false;
      document.body.style.overflow = '';
    },
  });

  // Testimonial Carousel
  Alpine.data('carousel', () => ({
    current: 0,
    total: 4,
    autoplayInterval: null,
    touchStartX: 0,
    touchEndX: 0,

    init() {
      this.startAutoplay();
    },

    startAutoplay() {
      this.autoplayInterval = setInterval(() => {
        this.next();
      }, 5000);
    },

    stopAutoplay() {
      clearInterval(this.autoplayInterval);
    },

    restartAutoplay() {
      this.stopAutoplay();
      this.startAutoplay();
    },

    next() {
      this.current = (this.current + 1) % this.total;
    },

    prev() {
      this.current = (this.current - 1 + this.total) % this.total;
    },

    goTo(index) {
      this.current = index;
      this.restartAutoplay();
    },

    handleTouchStart(e) {
      this.touchStartX = e.changedTouches[0].screenX;
      this.stopAutoplay();
    },

    handleTouchEnd(e) {
      this.touchEndX = e.changedTouches[0].screenX;
      const diff = this.touchStartX - this.touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) this.next();
        else this.prev();
      }
      this.restartAutoplay();
    },

    getTranslateX() {
      // Calculate based on card width + gap
      if (window.innerWidth >= 768) {
        return `translateX(-${this.current * (50 + 2.35)}%)`;
      }
      return `translateX(-${this.current * (100 + 4.7)}%)`;
    },
  }));

  // Counter Animation
  Alpine.data('counter', (target, duration = 2000) => ({
    value: 0,
    target: target,
    animated: false,

    animateCount() {
      if (this.animated) return;
      this.animated = true;

      const start = 0;
      const end = this.target;
      const startTime = performance.now();

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        this.value = Math.round(start + (end - start) * eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    },
  }));
});

// --- Smooth Scroll for anchor links ---
document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a[href^="#"]');
  if (!anchor) return;

  e.preventDefault();
  const target = document.querySelector(anchor.getAttribute('href'));
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Close mobile menu if open
    if (Alpine.store('nav')) {
      Alpine.store('nav').closeMobile();
    }
  }
});
