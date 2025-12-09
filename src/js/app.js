/**
 * handles initialization, state management, and global event listeners.
 */
let appState = {
  pinnedSites: [],
  googleApps: [], 
  currentSearchEngine: "google",
  editingSite: null,
  themePreference: "system",
  hidePinnedSites: false,
  hideSearchBar: false,
  hideQuoteBox: false,
  pinnedSiteShape: "circle",
  searchBarRadius: 50,
  searchBarHeight: 50,
  searchBarWidth: 680,
  sidePanelWidth: 320,
  isDragModeActive: false,
  isResizeGridModeActive: false,
  isEditModeActive: false,
  isBlurEnabled: true,
  uiBlurAmount: 14,
  isGridTransparent: true,
  customizationChanged: false,
  searchHistory: [],
  linkHistory: [],
  lastVisitedLinkURL: null,
  movableElementPositions: {
    searchWrapper: { x: 50, y: 30, centered: true },
    pinnedSitesSection: { y: 45, width: 80, height: 30, centered: true },
    quoteBox: { x: 0, y: 0, width: 40, height: 20, centered: false },
  },
  initialMovableElementPositions: {
    searchWrapper: { x: 50, y: 30, centered: true },
    pinnedSitesSection: { y: 45, width: 80, height: 30, centered: true },
    quoteBox: { x: 0, y: 0, width: 40, height: 20, centered: false },
  },
};

const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
let currentSiteActionMenu = null;
let mainSortable = null;
let modalSortable = null;
let lazyLoadObserver = null;
let siteModalOutsideClickHandler;
let allSitesModalOutsideClickHandler;

const App = {
  init() {
    FaviconCache.loadFromStorage();
    this.loadState();
    this.setupGlobalEventListeners();
    this.initializeUIComponents();
    this.setupBackgroundRefresh();
    this.initializeLazyLoader();

    // Setup module event listeners
    ThemeManager.setupEventListeners();
    DropdownManager.setupEventListeners();
    GoogleAppsManager.setupEventListeners(); 
    VisibilityManager.setupEventListeners();
    CustomizationManager.setupEventListeners();
    PositionManager.setupEventListeners();
    SearchManager.setupEventListeners();
    SiteModal.setupEventListeners();
    AllSitesModal.setupEventListeners();
    EditModeManager.setupEventListeners();
    BlurManager.setupEventListeners();
    FaviconFixer.setupEventListeners();
    DataManager.setupEventListeners();
  },

  initializeLazyLoader() {
    if ("IntersectionObserver" in window) {
      lazyLoadObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute("data-src");
                lazyLoadObserver.unobserve(img);
              }
            }
          });
        },
        { rootMargin: "50px 0px", threshold: 0.1 }
      );
    }
  },

  loadState() {
    const savedState = localStorage.getItem("newTabState");
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      const defaultPositions = {
        searchWrapper: { x: 50, y: 30, centered: true },
        pinnedSitesSection: { y: 45, width: 80, height: 30, centered: true },
        quoteBox: { x: 0, y: 0, width: 40, height: 20, centered: false },
      };
      const loadedPositions = { ...defaultPositions, ...(parsedState.movableElementPositions || {}) };

      appState = { ...appState, ...parsedState, movableElementPositions: loadedPositions };
      appState.searchHistory = parsedState.searchHistory || [];
      appState.lastVisitedLinkURL = parsedState.lastVisitedLinkURL || null;

      if (!appState.googleApps || appState.googleApps.length === 0) {
        appState.googleApps = [...GOOGLE_APPS];
      }

      let loadedLinkHistory = parsedState.linkHistory || [];
      if (loadedLinkHistory.length > 0 && typeof loadedLinkHistory[0] === "string") {
        const migratedHistory = {};
        loadedLinkHistory.forEach((url) => {
          if (migratedHistory[url]) {
            migratedHistory[url].visitCount = Math.min(5, migratedHistory[url].visitCount + 1);
          } else {
            migratedHistory[url] = { url: url, visitCount: 1 };
          }
        });
        appState.linkHistory = Object.values(migratedHistory);
      } else {
        appState.linkHistory = loadedLinkHistory;
      }
    } else {
      appState.pinnedSites = [...DEFAULT_PINNED_SITES];
      appState.googleApps = [...GOOGLE_APPS]; 
    }
    document.documentElement.style.setProperty("--side-panel-width", `${appState.sidePanelWidth}px`);
    if (appState.isDragModeActive) {
      appState.isDragModeActive = false;
      DOM.dragModeControls.style.display = "none";
    }
    if (appState.hidePinnedSites && appState.hideSearchBar) {
      Toast.show("Search Bar and Pinned Sites are hidden. You can show them from Settings.");
    }
  },

  saveState() {
    localStorage.setItem("newTabState", JSON.stringify(appState));
  },

  initializeUIComponents() {
    ThemeManager.applyPreference(appState.themePreference);
    VisibilityManager.applySettings();
    EditModeManager.applySettings();
    CustomizationManager.applyAppearanceSettings();
    BlurManager.applySettings();
    ThemeManager.applyGridTransparency();
    SearchManager.populateEngineDropdown();
    SearchManager.updateAllEngineIcons();
    SiteManager.renderPinnedSites();
    GoogleAppsManager.render(); 
    QuoteManager.init();
    DOM.togglePinnedSites.checked = appState.hidePinnedSites;
    DOM.toggleSearchBar.checked = appState.hideSearchBar;
    DOM.toggleQuoteBox.checked = !appState.hideQuoteBox;
    DOM.toggleEditSites.checked = appState.isEditModeActive;
    DOM.toggleBlur.checked = appState.isBlurEnabled;
    DOM.toggleTransparentGrid.checked = appState.isGridTransparent;
    DOM.siteShapeRadios.forEach((radio) => {
      if (radio.value === appState.pinnedSiteShape) radio.checked = true;
    });
    DOM.searchRadiusSlider.value = appState.searchBarRadius;
    DOM.searchHeightSlider.value = appState.searchBarHeight;
    DOM.searchWidthSlider.value = appState.searchBarWidth;
    CustomizationManager.updateSliderValues();
    [DOM.searchRadiusSlider, DOM.searchHeightSlider, DOM.searchWidthSlider].forEach((slider) => CustomizationManager.updateSliderFill(slider));
    DOM.blurValueInput.value = appState.uiBlurAmount;
    setTimeout(() => {
      PositionManager.applyFreeMoveSettings();
      DOM.searchWrapper.style.opacity = "1";
      DOM.pinnedSitesSection.style.opacity = "1";
      DOM.quoteBox.style.opacity = "1";
    }, 50);
  },

  setupBackgroundRefresh() {
    BackgroundManager.fetchRandom();
    window.addEventListener("beforeunload", () => localStorage.removeItem("lastBackground"));
  },

  resetUI() {
    if (DOM.customizeSidePanel.classList.contains("active")) {
      CustomizationManager.toggleSidePanel();
    }
    DropdownManager.closeAll();
    DOM.searchLogoWrapper.classList.remove("loading");
    DOM.searchInput.value = "";
    if (DOM.suggestionsContainer) {
      DOM.suggestionsContainer.innerHTML = "";
      DOM.suggestionsContainer.classList.remove("active");
    }
    BackgroundManager.fetchRandom();
  },

  setupGlobalEventListeners() {
    siteModalOutsideClickHandler = ModalManager.handleOutsideClick(DOM.siteModal, ".modal-content", SiteModal.close.bind(SiteModal), [".site-card .action-button", ".action-item", ".add-site-card"]);
    allSitesModalOutsideClickHandler = ModalManager.handleOutsideClick(DOM.allSitesModal, ".modal-content", AllSitesModal.close.bind(AllSitesModal), [".all-sites-card"]);

    document.addEventListener("click", (e) => {
      if (appState.isDragModeActive || appState.isResizeGridModeActive || DOM.body.classList.contains("resizing-panel") || DOM.body.classList.contains("resizing-grid")) return;
      DropdownManager.closeAll(e); 
      siteModalOutsideClickHandler(e);
      allSitesModalOutsideClickHandler(e);
      SiteManager.closeActionMenu();
      if (DOM.suggestionsContainer && !DOM.searchContainer.contains(e.target) && !DOM.suggestionsContainer.contains(e.target)) {
        DOM.suggestionsContainer.innerHTML = "";
        DOM.suggestionsContainer.classList.remove("active");
      }
    });
    prefersDarkScheme.addEventListener("change", (e) => {
      if (appState.themePreference === "system") {
        ThemeManager.applyPreference("system");
      }
    });
    window.addEventListener(
      "resize",
      Utils.debounce(() => {
        PositionManager.applyFreeMoveSettings();
        SiteManager.checkGridOverflow();
      }, 50)
    );

    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        this.resetUI();
      }
    });
  },
};