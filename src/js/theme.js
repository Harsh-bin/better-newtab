/**
 * Manages theme switching (dark, light, system) and related UI elements.
 */
const ThemeManager = {
  applyPreference(preference) {
    appState.themePreference = preference;
    let themeToApply = preference === "system" ? (prefersDarkScheme.matches ? "dark" : "light") : preference;
    DOM.body.setAttribute("data-theme", themeToApply);
    this.updateThemeIcon(preference);
    DebouncedSave.immediateSave();
  },

  setTheme(preference) {
    this.applyPreference(preference);
  },

  updateThemeIcon(preference) {
    const icon = DOM.themeBtn.querySelector("i");
    switch (preference) {
      case "dark":
        icon.className = "fas fa-moon";
        break;
      case "light":
        icon.className = "fas fa-sun";
        break;
      case "system":
        icon.className = "fas fa-desktop";
        break;
      default:
        icon.className = prefersDarkScheme.matches ? "fas fa-moon" : "fas fa-sun";
        break;
    }
  },

  applyGridTransparency() {
    DOM.pinnedSitesSection.classList.toggle("grid-transparent", appState.isGridTransparent);
  },

  toggleGridTransparency() {
    appState.isGridTransparent = DOM.toggleTransparentGrid.checked;
    this.applyGridTransparency();
    DebouncedSave.immediateSave();
    Toast.show(`Grid background ${appState.isGridTransparent ? "hidden" : "visible"}`);
  },

  setupEventListeners() {
    DOM.themeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      SiteManager.closeActionMenu();
      DropdownManager.toggle(DOM.themeDropdown);
    });
    DOM.themeDropdown.querySelectorAll(".dropdown-item[data-theme-preference]").forEach((item) => {
      item.addEventListener("click", (e) => {
        ThemeManager.setTheme(e.currentTarget.dataset.themePreference);
        DropdownManager.closeAll();
      });
    });
    DOM.toggleTransparentGrid.addEventListener("change", this.toggleGridTransparency.bind(this));
  },
};