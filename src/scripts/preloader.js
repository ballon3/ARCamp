// Preloader element reference
let loading;

// Initialize the preloader element.
const initializeElements = () => {
  loading = document.querySelector('.loading');
};

// Load assets and dispatch a custom event when done.
const loadAssets = async () => {
  // Do not block on remote image downloads; allow page animation to start immediately.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const event = new CustomEvent('assetsLoaded');
  document.dispatchEvent(event);
};

// Show the preloader, load assets if needed, and then hide the preloader.
const toggleLoading = async () => {
  if (sessionStorage.getItem('preloadComplete') === 'true') {
    hide();
    return;
  }
  show();
  await loadAssets();
  sessionStorage.setItem('preloadComplete', 'true');
  hide();
};

// Display the preloader.
const show = () => {
  loading.classList.remove('hidden');
};

// Hide the preloader.
const hide = () => {
  loading.classList.add('hidden');
};

// Cleanup to reset references.
const cleanup = () => {
  loading = null;
};

// Initialize the preloader logic.
const init = () => {
  initializeElements();
  if (loading) toggleLoading();
};

// Execute a callback only if the current page is the home page.
const handlePageEvent = (callback) => {
  const page = document.documentElement.getAttribute('data-page');
  if (page === 'home') callback();
};

// Listen for Astro's lifecycle events.
document.addEventListener('astro:page-load', () => {
  handlePageEvent(init);
});

document.addEventListener('astro:before-swap', () => {
  handlePageEvent(cleanup);
});

// Clear the preload flag before page unload to ensure the loader appears on refresh.
window.addEventListener('beforeunload', () => {
  sessionStorage.removeItem('preloadComplete');
});
