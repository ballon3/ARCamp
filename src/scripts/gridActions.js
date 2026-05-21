// Initialize variables to store DOM elements and states
let gridContainer;
let gridItems;
let stageFilterButtons;
let stageResetButton;
let searchButton;
let searchClearButton;
let searchContent;
let searchContentOriginal;
let searchDialog;
let searchInput;
let closeDialog;
let activeStage;
let activeSearchTerm;

/* Event handler functions */

// Stage filter: set active stage and update visible items.
const handleStageFilterClick = (e) => {
  const button = e.currentTarget;
  activeStage = button.getAttribute('data-stage-filter') || 'all';
  updateStageFilterUI();
  applyFilters();
};

const handleStageResetClick = () => {
  activeStage = 'all';
  updateStageFilterUI();
  applyFilters();
};

// Open search dialog: show the dialog and blur the page.
const handleSearchClick = () => {
  searchDialog.showModal();
  toggleDialogPageBlur(true);
};

// Close search dialog: hide the dialog and remove the blur.
const handleCloseClick = () => {
  searchDialog.close();
  toggleDialogPageBlur(false);
};

// Clear search: reset the filter and clear the input.
const handleSearchClearClick = () => {
  activeSearchTerm = '';
  applyFilters();
  toggleClearButton();
  searchContent.innerHTML = searchContentOriginal;
  searchInput.value = '';
  searchButton.classList.remove('search--active');
};

// Filter grid: update grid items based on the search input.
const handleSearchInput = (e) => {
  activeSearchTerm = e.target.value;
  applyFilters();
  searchContent.innerHTML = activeSearchTerm === '' ? searchContentOriginal : activeSearchTerm;
  toggleClearButton(activeSearchTerm);
  searchButton.classList.toggle('search--active', activeSearchTerm !== '');
};

/* Initialize DOM elements and states */
const initializeVariables = () => {
  gridContainer = document.querySelector('[data-grid]');
  gridItems = Array.from(gridContainer?.children || []);
  stageFilterButtons = Array.from(document.querySelectorAll('[data-stage-filter]'));
  stageResetButton = document.querySelector('[data-stage-reset]');
  searchButton = document.querySelector('[data-search]');
  searchClearButton = document.querySelector('[data-clear]');
  searchContent = searchButton?.querySelector('.oh__inner');
  searchContentOriginal = searchContent?.innerHTML || '';
  searchDialog = document.getElementById('search-dialog');
  searchInput = document.getElementById('search-input');
  closeDialog = document.getElementById('close-dialog');
  activeStage = 'all';
  activeSearchTerm = '';
};

const updateStageFilterUI = () => {
  stageFilterButtons.forEach((button) => {
    const stage = button.getAttribute('data-stage-filter') || 'all';
    button.classList.toggle('is-active', stage === activeStage);
  });
};

/* Apply search + stage filters to grid items. */
const applyFilters = () => {
  const lowerCaseSearch = activeSearchTerm.toLowerCase();
  const lowerCaseStage = activeStage.toLowerCase();

  gridItems.forEach((item) => {
    const name = item.getAttribute('data-name').toLowerCase();
    const stagename = item.getAttribute('data-stagename').toLowerCase();
    const stages = (item.getAttribute('data-stages') || '')
      .split('|')
      .map((stage) => stage.trim().toLowerCase())
      .filter(Boolean);

    const matchesSearch =
      name.includes(lowerCaseSearch) || stagename.includes(lowerCaseSearch);

    const matchesStage =
      lowerCaseStage === 'all' || stages.includes(lowerCaseStage);

    item.style.display =
      matchesSearch && matchesStage ? '' : 'none';
  });
};

/* Toggle page blur when the search dialog is open or closed */
const toggleDialogPageBlur = (toggle) => {
  if (toggle) {
    document.body.classList.add('blurred');
  } else {
    document.body.classList.remove('blurred');
  }
};

/* Show or hide the clear button based on search input */
const toggleClearButton = (searchTerm = '') => {
  const isHidden = searchClearButton?.classList.contains('hidden');
  if (searchTerm === '' && !isHidden) {
    searchClearButton.classList.add('hidden');
  } else if (searchTerm !== '' && isHidden) {
    searchClearButton.classList.remove('hidden');
  }
};

/* Initialize event listeners and states */
const init = () => {
  initializeVariables();
  stageFilterButtons.forEach((button) =>
    button.addEventListener('click', handleStageFilterClick)
  );
  stageResetButton?.addEventListener('click', handleStageResetClick);
  searchButton?.addEventListener('click', handleSearchClick);
  closeDialog?.addEventListener('click', handleCloseClick);
  searchClearButton?.addEventListener('click', handleSearchClearClick);
  searchInput?.addEventListener('input', handleSearchInput);
  searchDialog?.addEventListener('close', () => toggleDialogPageBlur(false));
  updateStageFilterUI();
  applyFilters();
};

/* Cleanup event listeners and reset variables */
const cleanup = () => {
  stageFilterButtons.forEach((button) =>
    button.removeEventListener('click', handleStageFilterClick)
  );
  stageResetButton?.removeEventListener('click', handleStageResetClick);
  searchButton?.removeEventListener('click', handleSearchClick);
  closeDialog?.removeEventListener('click', handleCloseClick);
  searchClearButton?.removeEventListener('click', handleSearchClearClick);
  searchInput?.removeEventListener('input', handleSearchInput);
  gridContainer = null;
  gridItems = [];
  stageFilterButtons = [];
  stageResetButton = null;
  searchButton = null;
  searchClearButton = null;
  searchContent = null;
  searchContentOriginal = '';
  searchDialog = null;
  searchInput = null;
  closeDialog = null;
  activeStage = 'all';
  activeSearchTerm = '';
};

/* Handle Astro page events on the home page */
const handlePageEvent = (type) => {
  const page = document.documentElement.getAttribute('data-page');
  if (page !== 'home') return;
  if (type === 'load') {
    init();
  } else if (type === 'before-swap') {
    cleanup();
  }
};

// Listen for Astro's lifecycle events
document.addEventListener('astro:page-load', () => handlePageEvent('load'));
document.addEventListener('astro:before-swap', () => handlePageEvent('before-swap'));
