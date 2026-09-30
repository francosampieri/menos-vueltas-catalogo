const MultiheroCarousel = (() => {
  const intervalMs = 8000;
  const swipeThreshold = 48;

  function normalizeIndex(index, count) {
    if (!Number.isInteger(count) || count < 1) return 0;
    return ((index % count) + count) % count;
  }

  function nextIndex(index, count) {
    return normalizeIndex(index + 1, count);
  }

  function previousIndex(index, count) {
    return normalizeIndex(index - 1, count);
  }

  function canAutoAdvance({ interacting = false, hidden = false, reducedMotion = false } = {}) {
    return !interacting && !hidden && !reducedMotion;
  }

  function swipeDirection(startX, endX, threshold = swipeThreshold) {
    const distance = Number(endX) - Number(startX);
    if (!Number.isFinite(distance) || Math.abs(distance) < threshold) return 0;
    return distance < 0 ? 1 : -1;
  }

  function init(root) {
    const track = root.querySelector('[data-multihero-track]');
    const slides = track ? [...track.querySelectorAll('[data-multihero-slide]')] : [];
    const dots = root.querySelector('[data-multihero-dots]');
    const previous = root.querySelector('[data-multihero-previous]');
    const next = root.querySelector('[data-multihero-next]');
    if (!track || slides.length < 2 || !dots) return;

    const mobile = window.matchMedia('(max-width: 700px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let activeIndex = 0;
    let timer = null;
    let interacting = false;
    let hidden = document.hidden;
    let pointerStart = null;

    dots.innerHTML = slides.map((_, index) =>
      `<span class="multihero-dot${index === activeIndex ? ' is-active' : ''}" aria-hidden="true"></span>`
    ).join('');

    function renderedDots() {
      return [...dots.querySelectorAll('.multihero-dot')];
    }

    function updateProgress() {
      renderedDots().forEach((dot, index) => {
        dot.classList.toggle('is-active', index === activeIndex);
        if (index !== activeIndex) dot.classList.remove('is-progressing');
      });
    }

    function startProgress() {
      const activeDot = renderedDots()[activeIndex];
      if (!activeDot || activeDot.classList.contains('is-progressing')) return;
      void activeDot.offsetWidth;
      activeDot.classList.add('is-progressing');
    }

    function render() {
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      slides.forEach((slide, index) => {
        slide.toggleAttribute('inert', index !== activeIndex);
        slide.setAttribute('aria-hidden', String(index !== activeIndex));
      });
      root.dataset.multiheroActive = String(activeIndex + 1);
      updateProgress();
    }

    function stop() {
      window.clearTimeout(timer);
      timer = null;
      root.classList.add('is-paused');
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = null;
      if (!canAutoAdvance({ interacting, hidden, reducedMotion: motion.matches })) {
        root.classList.add('is-paused');
        return;
      }
      root.classList.remove('is-paused');
      startProgress();
      timer = window.setTimeout(() => go(nextIndex(activeIndex, slides.length)), intervalMs);
    }

    function go(index) {
      activeIndex = normalizeIndex(index, slides.length);
      render();
      schedule();
    }

    function manuallyGo(index) {
      interacting = false;
      go(index);
    }

    previous?.addEventListener('click', () => manuallyGo(previousIndex(activeIndex, slides.length)));
    next?.addEventListener('click', () => manuallyGo(nextIndex(activeIndex, slides.length)));

    root.addEventListener('focusin', () => {
      interacting = true;
      stop();
    });
    root.addEventListener('focusout', event => {
      if (root.contains(event.relatedTarget)) return;
      interacting = false;
      schedule();
    });

    root.addEventListener('pointerdown', event => {
      if (!mobile.matches) return;
      pointerStart = event.clientX;
      interacting = true;
      stop();
    });
    root.addEventListener('pointerup', event => {
      if (pointerStart === null) return;
      const direction = swipeDirection(pointerStart, event.clientX);
      pointerStart = null;
      if (direction) manuallyGo(activeIndex + direction);
      else {
        interacting = false;
        schedule();
      }
    });
    root.addEventListener('pointercancel', () => {
      pointerStart = null;
      interacting = false;
      schedule();
    });

    document.addEventListener('visibilitychange', () => {
      hidden = document.hidden;
      schedule();
    });
    motion.addEventListener?.('change', schedule);
    render();
    schedule();
  }

  function initializeAll() {
    document.querySelectorAll('[data-multihero]').forEach(init);
  }

  return Object.freeze({
    intervalMs,
    nextIndex,
    previousIndex,
    canAutoAdvance,
    swipeDirection,
    initializeAll
  });
})();

if (typeof window !== 'undefined') {
  window.MultiheroCarousel = MultiheroCarousel;
  window.addEventListener('DOMContentLoaded', () => MultiheroCarousel.initializeAll());
}
