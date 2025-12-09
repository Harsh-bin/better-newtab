/**
 * Manages rendering, creation, deletion, and sorting of pinned site cards.
 */
function createSortableGrid(gridElement, onEndCallback) {
  return Sortable.create(gridElement, {
    animation: 200,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    filter: ".add-site-card, .all-sites-card",
    onMove: (evt) => !evt.related.classList.contains("add-site-card") && !evt.related.classList.contains("all-sites-card"),
    onStart: () => {
      SiteManager.closeActionMenu();
      DOM.body.classList.add("drag-mode-sortable-active");
    },
    onEnd: () => {
      DOM.body.classList.remove("drag-mode-sortable-active");
      if (onEndCallback) onEndCallback();
    },
  });
}

const SiteManager = {
  renderPinnedSites() {
    DOM.sitesGrid.innerHTML = "";
    appState.pinnedSites.forEach((site) => {
      DOM.sitesGrid.appendChild(this._createSiteCard(site));
    });

    const allSitesCard = document.createElement("div");
    allSitesCard.className = "site-card all-sites-card";
    allSitesCard.id = "allSitesCard";
    allSitesCard.style.display = "none";
    allSitesCard.innerHTML = `<a href="#" class="site-link all-sites-link" aria-label="Show all sites"><div class="site-icon"><i class="fas fa-th"></i></div><span class="site-name">All Sites</span></a>`;
    allSitesCard.querySelector(".all-sites-link").addEventListener("click", (e) => {
      e.preventDefault();
      AllSitesModal.open();
    });
    DOM.sitesGrid.appendChild(allSitesCard);

    const addCard = document.createElement("div");
    addCard.className = "site-card add-site-card";
    addCard.innerHTML = `<a href="#" class="site-link add-site-link" aria-label="Add new site"><div class="site-icon"><i class="fas fa-plus"></i></div><span class="site-name">Add Site</span></a>`;
    addCard.querySelector(".add-site-link").addEventListener("click", (e) => {
      e.preventDefault();
      if (!appState.isDragModeActive) {
        this.closeActionMenu();
        SiteModal.open();
      } else {
        Toast.show("Exit drag mode to add sites!");
        e.stopPropagation();
      }
    });
    DOM.sitesGrid.appendChild(addCard);

    CustomizationManager.applyAppearanceSettings();
    this.setupSortable();
    this.checkGridOverflow();
  },

  _createSiteCard(site) {
    const siteCard = document.createElement("div");
    siteCard.className = "site-card";
    siteCard.dataset.id = site.id;

    let faviconHtml = "";
    const fallbackLetter = site.name.charAt(0).toUpperCase();

    if (site.favicon) {
      if (site.favicon.startsWith("fa-text:")) {
        const letter = site.favicon.split(":")[1];
        faviconHtml = `<span class="favicon-fallback-letter">${letter}</span>`;
      } else {
        faviconHtml = `<img data-src="${site.favicon}" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjFmMWYxIi8+Cjx0ZXh0IHg9IjMyIiB5PSIzNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZzwvdGV4dD4KPC9zdmc+" alt="${site.name} favicon" onerror="this.parentNode.innerHTML='<span class=\\'favicon-fallback-letter\\'>${fallbackLetter}</span>'; this.alt='Default icon for ${site.name}'">`;
      }
    } else {
      faviconHtml = `<i class="fas fa-globe"></i>`;
    }

    siteCard.innerHTML = `<a href="${site.url}" class="site-link" aria-label="Go to ${site.name}"><div class="site-icon">${faviconHtml}</div><span class="site-name">${site.name}</span></a><div class="site-actions"><button class="icon-button action-button site-menu-button" aria-label="Site options for ${site.name}"><i class="fas fa-ellipsis-v"></i></button></div>`;

    if (site.favicon && !site.favicon.startsWith("fa-text:")) {
      this.lazyLoadFavicon(siteCard, site.favicon);
    }

    siteCard.querySelector(".site-menu-button").addEventListener("click", (e) => {
      if (appState.isDragModeActive) {
        Toast.show("Exit drag mode to use menus!");
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      this.openActionMenu(e.currentTarget, site);
    });
    return siteCard;
  },

  lazyLoadFavicon(cardElement, faviconUrl) {
    if (!faviconUrl) return;

    const img = cardElement.querySelector("img[data-src]");
    if (!img) return;

    if (lazyLoadObserver) {
      lazyLoadObserver.observe(img);
    } else {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    }
  },

  addSiteToGrid(site) {
    const siteCard = this._createSiteCard(site);
    const addCard = DOM.sitesGrid.querySelector(".add-site-card");
    DOM.sitesGrid.insertBefore(siteCard, addCard);
    CustomizationManager.applyAppearanceSettings();
    this.checkGridOverflow();
  },

  removeSiteFromGrid(siteId) {
    const siteCard = DOM.sitesGrid.querySelector(`.site-card[data-id='${siteId}']`);
    if (siteCard) {
      siteCard.remove();
      this.checkGridOverflow();
    }
  },

  updateSiteInGrid(site) {
    const oldCard = DOM.sitesGrid.querySelector(`.site-card[data-id='${site.id}']`);
    if (oldCard) {
      const newCard = this._createSiteCard(site);
      oldCard.parentNode.replaceChild(newCard, oldCard);
      CustomizationManager.applyAppearanceSettings();
    }
  },

  openActionMenu(menuButton, site) {
    this.closeActionMenu();
    const actionMenu = document.createElement("div");
    actionMenu.className = "action-menu active";
    actionMenu.innerHTML = `<div class="action-item edit-site"><i class="fas fa-edit"></i> Edit</div><div class="action-item delete-site"><i class="fas fa-trash"></i> Delete</div>`;
    document.body.appendChild(actionMenu);
    currentSiteActionMenu = actionMenu;
    const rect = menuButton.getBoundingClientRect();
    actionMenu.style.top = `${rect.bottom + 5}px`;
    let leftPosition = rect.right - actionMenu.offsetWidth;
    const viewportWidth = window.innerWidth;
    if (leftPosition + actionMenu.offsetWidth > viewportWidth - 10) leftPosition = viewportWidth - actionMenu.offsetWidth - 10;
    if (leftPosition < 10) leftPosition = 10;
    actionMenu.style.left = `${leftPosition}px`;
    actionMenu.querySelector(".edit-site").addEventListener("click", (e) => {
      e.stopPropagation();
      SiteModal.open(site);
      this.closeActionMenu();
    });
    actionMenu.querySelector(".delete-site").addEventListener("click", (e) => {
      e.stopPropagation();
      SiteManager.delete(site.id);
      this.closeActionMenu();
    });
    DropdownManager.closeAll();
  },

  closeActionMenu() {
    if (currentSiteActionMenu) {
      currentSiteActionMenu.remove();
      currentSiteActionMenu = null;
    }
  },

  delete(id) {
    appState.pinnedSites = appState.pinnedSites.filter((site) => site.id != id);
    DebouncedSave.immediateSave();
    this.removeSiteFromGrid(id);
    if (DOM.allSitesModal.classList.contains("active")) {
      AllSitesModal.render();
    }
    SiteModal.close();
    Toast.show("Site deleted successfully!");
  },

  checkGridOverflow: Utils.debounce(() => {
    const grid = DOM.sitesGrid;
    const allSitesCard = document.getElementById("allSitesCard");
    if (!grid || !allSitesCard) return;

    const siteCards = Array.from(grid.querySelectorAll(".site-card[data-id]"));
    siteCards.forEach((card) => (card.style.display = "flex"));

    let isOverflowing = grid.scrollHeight > grid.clientHeight;

    if (isOverflowing) {
      allSitesCard.style.display = "flex";
      for (let i = siteCards.length - 1; i >= 0; i--) {
        if (grid.scrollHeight <= grid.clientHeight) break;
        siteCards[i].style.display = "none";
      }
    } else {
      allSitesCard.style.display = "none";
    }
  }, 50),

  setupSortable() {
    if (mainSortable) mainSortable.destroy();
    if (!appState.isDragModeActive && DOM.sitesGrid) {
      mainSortable = createSortableGrid(DOM.sitesGrid, () => {
        const newOrderIds = Array.from(DOM.sitesGrid.children)
          .filter((el) => el.dataset.id)
          .map((el) => parseInt(el.dataset.id));
        const currentSites = [...appState.pinnedSites];
        appState.pinnedSites = newOrderIds.map((id) => currentSites.find((s) => s.id === id)).filter(Boolean);

        DebouncedSave.immediateSave();
        if (DOM.allSitesModal.classList.contains("active")) {
          AllSitesModal.render();
        }
      });
    }
  },
};