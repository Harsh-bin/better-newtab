/**
 * Provides a generic framework for opening and closing modal dialogs.
 */
const FaviconCache = {
  cache: new Map(),
  maxSize: 100,

  get(domain) {
    return this.cache.get(domain);
  },

  set(domain, url) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(domain, url);
  },

  loadFromStorage() {
    try {
      const cached = localStorage.getItem("faviconCache");
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.forEach(([domain, url]) => this.cache.set(domain, url));
      }
    } catch (e) {
      console.warn("Failed to load favicon cache:", e);
    }
  },

  saveToStorage() {
    try {
      const toSave = Array.from(this.cache.entries());
      localStorage.setItem("faviconCache", JSON.stringify(toSave));
    } catch (e) {
      console.warn("Failed to save favicon cache:", e);
    }
  },
};

const ModalManager = {
  open(modalElement) {
    modalElement.classList.add("active");
    DOM.body.classList.add("modal-active");
  },
  close(modalElement) {
    modalElement.classList.remove("active");
    DOM.body.classList.remove("modal-active");
  },
  handleOutsideClick(modalElement, contentSelector, closeCallback, ignoreSelectors = []) {
    return (e) => {
      if (modalElement.classList.contains("active") && !modalElement.querySelector(contentSelector).contains(e.target) && !ignoreSelectors.some((selector) => e.target.closest(selector))) {
        closeCallback();
      }
    };
  },
};

const SiteModal = {
  open(site = null) {
    DOM.modalTitle.textContent = site ? "Edit Site" : "Add New Site";
    DOM.siteNameInput.value = site ? site.name : "";
    DOM.siteUrlInput.value = site ? site.url : "";
    DOM.deleteSiteBtn.style.display = site ? "block" : "none";
    appState.editingSite = site;
    ModalManager.open(DOM.siteModal);
  },

  close() {
    ModalManager.close(DOM.siteModal);
    appState.editingSite = null;
  },

  save() {
    const name = DOM.siteNameInput.value.trim();
    const url = DOM.siteUrlInput.value.trim();
    if (!name || !url) return Toast.show("Please fill in both fields");
    let processedUrl = !/^(https?:\/\/)/i.test(url) ? "https://" + url : url;
    if (!this.isValidUrl(processedUrl)) return Toast.show("Please enter a valid URL.");

    if (appState.editingSite) {
      const siteToUpdate = appState.pinnedSites.find((s) => s.id === appState.editingSite.id);
      if (siteToUpdate) {
        const urlChanged = siteToUpdate.url !== processedUrl;
        siteToUpdate.name = name;
        siteToUpdate.url = processedUrl;

        if (urlChanged) {
          siteToUpdate.favicon = `fa-text:${name.charAt(0).toUpperCase()}`;
          this._validateAndSetIcon(siteToUpdate);
        }

        SiteManager.updateSiteInGrid(siteToUpdate);
        if (DOM.allSitesModal.classList.contains("active")) AllSitesModal.render();
        DebouncedSave.immediateSave();
        this.close();
        Toast.show("Site updated successfully!");
      }
    } else {
      const newSite = {
        id: Date.now(),
        name,
        url: processedUrl,
        favicon: `fa-text:${name.charAt(0).toUpperCase()}`,
      };

      appState.pinnedSites.push(newSite);
      SiteManager.addSiteToGrid(newSite);
      if (DOM.allSitesModal.classList.contains("active")) AllSitesModal.render();
      DebouncedSave.immediateSave();
      this.close();
      Toast.show("Site added successfully!");

      this._validateAndSetIcon(newSite);
    }
  },

  async _validateAndSetIcon(site) {
    try {
      const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=64`;
      const iconDetails = await FaviconFixer._fetchImageAndGetDimensions(googleFaviconUrl);

      if (iconDetails.width > 16 || iconDetails.height > 16) {
        const siteInState = appState.pinnedSites.find((s) => s.id === site.id);
        if (siteInState) {
          siteInState.favicon = iconDetails.url;
          SiteManager.updateSiteInGrid(siteInState);
          DebouncedSave.immediateSave();
        }
      }
    } catch (error) {
      console.warn(`On-the-fly favicon validation failed for ${site.url}:`, error);
    }
  },

  isValidUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  },

  setupEventListeners() {
    DOM.closeModalBtn.addEventListener("click", this.close.bind(this));
    DOM.cancelModalBtn.addEventListener("click", this.close.bind(this));
    DOM.saveSiteBtn.addEventListener("click", this.save.bind(this));
    DOM.deleteSiteBtn.addEventListener("click", () => SiteManager.delete(appState.editingSite.id));
    const handleEnter = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.save();
      }
    };
    DOM.siteNameInput.addEventListener("keypress", handleEnter);
    DOM.siteUrlInput.addEventListener("keypress", handleEnter);
  },
};

const AllSitesModal = {
  open() {
    this.render();
    ModalManager.open(DOM.allSitesModal);
  },

  close() {
    ModalManager.close(DOM.allSitesModal);
    DOM.allSitesGrid.innerHTML = "";
  },

  render() {
    DOM.allSitesGrid.innerHTML = "";
    appState.pinnedSites.forEach((site) => {
      const siteCard = SiteManager._createSiteCard(site);
      DOM.allSitesGrid.appendChild(siteCard);
      const siteLink = siteCard.querySelector('.site-link');
      if (siteLink) {
        siteLink.addEventListener('click', () => {
          this.close();
        });
      }
    });
    CustomizationManager.applyAppearanceSettings();
    this.setupSortable();
  },

  setupSortable() {
    if (modalSortable) modalSortable.destroy();
    modalSortable = createSortableGrid(DOM.allSitesGrid, () => {
      const newOrderIds = Array.from(DOM.allSitesGrid.children)
        .filter((el) => el.dataset.id)
        .map((el) => parseInt(el.dataset.id));
      const newPinnedSites = [];
      newOrderIds.forEach((id) => {
        const site = appState.pinnedSites.find((s) => s.id === id);
        if (site) newPinnedSites.push(site);
      });
      appState.pinnedSites = newPinnedSites;
      DebouncedSave.immediateSave();
      SiteManager.renderPinnedSites();
    });
  },

  setupEventListeners() {
    DOM.closeAllSitesModalBtn.addEventListener("click", this.close.bind(this));
  },
};