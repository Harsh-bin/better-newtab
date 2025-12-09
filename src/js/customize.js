/**
 * Handles the customization side panel and all appearance-related settings.
 */
const CustomizationManager = {
  toggleSidePanel() {
    document.documentElement.style.setProperty("--side-panel-width", `${appState.sidePanelWidth}px`);
    const isActive = DOM.customizeSidePanel.classList.toggle("active");
    DOM.body.classList.toggle("side-panel-active", isActive);

    setTimeout(() => {
      PositionManager.applyFreeMoveSettings();
    }, 410);

    if (isActive) {
      appState.customizationChanged = false;
      DOM.siteShapeRadios.forEach((radio) => {
        if (radio.value === appState.pinnedSiteShape) radio.checked = true;
      });
      DOM.searchRadiusSlider.value = appState.searchBarRadius;
      DOM.searchHeightSlider.value = appState.searchBarHeight;
      DOM.searchWidthSlider.value = appState.searchBarWidth;
      DOM.blurValueInput.value = appState.uiBlurAmount;
      this.updateSliderValues();
      [DOM.searchRadiusSlider, DOM.searchHeightSlider, DOM.searchWidthSlider].forEach((slider) => this.updateSliderFill(slider));
    } else {
      if (appState.customizationChanged) {
        DebouncedSave.immediateSave();
        Toast.show("Customization saved!");
      }
    }
  },

  updatePinnedSiteShape() {
    appState.pinnedSiteShape = document.querySelector('input[name="siteShape"]:checked').value;
    appState.customizationChanged = true;
    this.applyAppearanceSettings();
    DebouncedSave.save();
  },

  updateSearchBarAppearance() {
    appState.searchBarRadius = parseInt(DOM.searchRadiusSlider.value);
    appState.searchBarHeight = parseInt(DOM.searchHeightSlider.value);
    appState.searchBarWidth = parseInt(DOM.searchWidthSlider.value);
    appState.customizationChanged = true;

    this.applyAppearanceSettings();
    PositionManager.applyFreeMoveSettings();

    DebouncedSave.save();
    this.updateSliderValues();
  },

  updateSliderValues() {
    DOM.searchRadiusValue.textContent = `${appState.searchBarRadius}px`;
    DOM.searchHeightValue.textContent = `${appState.searchBarHeight}px`;
    DOM.searchWidthValue.textContent = `${appState.searchBarWidth}px`;
  },

  updateSliderFill(slider) {
    const min = slider.min || 0;
    const max = slider.max || 100;
    const value = slider.value;
    const percentage = ((value - min) / (max - min)) * 100;
    if (typeof slider.style.setProperty === "function") {
      slider.style.setProperty("--slider-progress-percent", `${percentage}%`);
    }
  },

  applyAppearanceSettings() {
    document.querySelectorAll(".site-icon").forEach((icon) => {
      icon.style.clipPath = "";
      icon.style.borderRadius = "";
      switch (appState.pinnedSiteShape) {
        case "circle":
          icon.style.borderRadius = "50%";
          break;
        case "square":
          icon.style.borderRadius = "0%";
          break;
        case "rounded-square":
          icon.style.borderRadius = "25%";
          break;
        case "pebble":
          icon.style.borderRadius = "60% 40% 30% 70% / 60% 30% 70% 40%";
          break;
        case "squircle":
          icon.style.borderRadius = "35%";
          break;
        default:
          icon.style.borderRadius = "50%";
      }
    });
    DOM.searchBox.style.borderRadius = `${appState.searchBarRadius}px`;
    DOM.searchBox.style.height = `${appState.searchBarHeight}px`;
    document.documentElement.style.setProperty("--search-max-width", `${appState.searchBarWidth}px`);
    document.documentElement.style.setProperty("--search-radius-val", `${appState.searchBarRadius}px`);

    const dropdownRadius = Math.min(appState.searchBarRadius, 16);
    const suggestionRadius = Math.min(appState.searchBarRadius, 12);
    DOM.engineDropdown.style.borderRadius = `${dropdownRadius}px`;
    DOM.suggestionsContainer.style.borderRadius = `${suggestionRadius}px`;
  },

  setupEventListeners() {
    DOM.openCustomizePanel.addEventListener("click", () => {
      DropdownManager.closeAll();
      SiteManager.closeActionMenu();
      this.toggleSidePanel();
    });
    DOM.closeCustomizePanelBtn.addEventListener("click", this.toggleSidePanel.bind(this));
    DOM.resizeHandle.addEventListener("mousedown", this.initResize.bind(this));
    DOM.siteShapeRadios.forEach((radio) => radio.addEventListener("change", this.updatePinnedSiteShape.bind(this)));

    [DOM.searchRadiusSlider, DOM.searchHeightSlider, DOM.searchWidthSlider].forEach((slider) => {
      slider.addEventListener("input", () => {
        this.updateSearchBarAppearance();
        this.updateSliderFill(slider);
      });
    });
  },

  initResize(e) {
    e.preventDefault();
    DOM.body.classList.add("resizing-panel");
    this.resizePanelHandler = this.resizePanel.bind(this);
    this.stopResizeHandler = this.stopResize.bind(this);
    document.addEventListener("mousemove", this.resizePanelHandler);
    document.addEventListener("mouseup", this.stopResizeHandler);
  },

  resizePanel(e) {
    let newWidth = window.innerWidth - e.clientX;
    const minWidth = 280,
      maxWidth = 800;
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    appState.sidePanelWidth = newWidth;
    document.documentElement.style.setProperty("--side-panel-width", `${newWidth}px`);
    PositionManager.applyFreeMoveSettings();
  },

  stopResize() {
    DOM.body.classList.remove("resizing-panel");
    document.removeEventListener("mousemove", this.resizePanelHandler);
    document.removeEventListener("mouseup", this.stopResizeHandler);
    DebouncedSave.immediateSave();
  },
};

const PositionManager = {
  activeDraggable: null,
  offsetX: 0,
  offsetY: 0,

  getMovableElements() {
    return { searchWrapper: DOM.searchWrapper, pinnedSitesSection: DOM.pinnedSitesSection, quoteBox: DOM.quoteBox };
  },

  saveInitialPositions() {
    appState.initialMovableElementPositions = JSON.parse(JSON.stringify(appState.movableElementPositions));
  },

  enterDragMode() {
    if (DOM.customizeSidePanel.classList.contains("active")) CustomizationManager.toggleSidePanel();
    if (appState.isResizeGridModeActive) this.exitResizeGridMode();
    appState.isDragModeActive = true;
    this.saveInitialPositions();
    this.setupDraggableElements();
    DOM.dragModeControls.style.display = "flex";
    DOM.pinnedSitesSection.classList.remove("grid-transparent");
    DebouncedSave.immediateSave();
    Toast.show("Drag mode enabled. Drag elements and then confirm/cancel!");
    DOM.body.classList.add("drag-active");
  },

  exitDragMode() {
    appState.isDragModeActive = false;
    this.removeDraggableElements();
    DOM.dragModeControls.style.display = "none";
    DOM.body.classList.remove("drag-active");
    ThemeManager.applyGridTransparency();
    DebouncedSave.immediateSave();
  },

  enterResizeGridMode() {
    if (DOM.customizeSidePanel.classList.contains("active")) CustomizationManager.toggleSidePanel();
    if (appState.isDragModeActive) this.exitDragMode();
    appState.isResizeGridModeActive = true;
    this.saveInitialPositions();
    DOM.dragModeControls.style.display = "flex";
    DOM.pinnedSitesSection.classList.remove("grid-transparent");
    Toast.show("Resize mode enabled. Adjust elements and then confirm/cancel!");
    DOM.body.classList.add("resize-grid-active");
  },

  exitResizeGridMode() {
    appState.isResizeGridModeActive = false;
    DOM.dragModeControls.style.display = "none";
    DOM.body.classList.remove("resize-grid-active");
    ThemeManager.applyGridTransparency();
  },

  confirmPositions() {
    if (appState.isDragModeActive) this.exitDragMode();
    if (appState.isResizeGridModeActive) this.exitResizeGridMode();
    Toast.show("Changes saved!");
    DebouncedSave.immediateSave();
  },

  cancelPositions() {
    appState.movableElementPositions = JSON.parse(JSON.stringify(appState.initialMovableElementPositions));
    this.applyFreeMoveSettings();
    if (appState.isDragModeActive) this.exitDragMode();
    if (appState.isResizeGridModeActive) this.exitResizeGridMode();
    Toast.show("Changes undone!");
  },

  setupDraggableElements() {
    const movableElems = this.getMovableElements();
    for (const key in movableElems) {
      const elem = movableElems[key];
      if (elem) {
        elem.addEventListener("mousedown", this.startDrag.bind(this));
        elem.style.cursor = "grab";
      }
    }
  },

  removeDraggableElements() {
    const movableElems = this.getMovableElements();
    for (const key in movableElems) {
      const elem = movableElems[key];
      if (elem) {
        elem.removeEventListener("mousedown", this.startDrag.bind(this));
        elem.style.cursor = "auto";
      }
    }
  },

  startDrag(e) {
    if (!appState.isDragModeActive || e.button !== 0 || this.activeDraggable || e.target.classList.contains("resize-handle")) return;
    e.preventDefault();
    this.activeDraggable = e.currentTarget;

    let keyToUpdate = Object.keys(DOM).find((key) => DOM[key] === this.activeDraggable);
    if (keyToUpdate && appState.movableElementPositions[keyToUpdate]) {
      appState.movableElementPositions[keyToUpdate].centered = false;
    }

    this.activeDraggable.style.cursor = "grabbing";
    this.offsetX = e.clientX - this.activeDraggable.getBoundingClientRect().left;
    this.offsetY = e.clientY - this.activeDraggable.getBoundingClientRect().top;
    document.addEventListener("mousemove", this.drag.bind(this));
    document.addEventListener("mouseup", this.endDrag.bind(this));
  },

  drag(e) {
    if (!this.activeDraggable) return;
    e.preventDefault();
    const container = DOM.mainContent;
    const containerRect = container.getBoundingClientRect();
    const elem = this.activeDraggable;
    let newX = e.clientX - containerRect.left - this.offsetX;
    let newY = e.clientY - containerRect.top - this.offsetY;
    const clampedX = Math.min(Math.max(0, newX), container.clientWidth - elem.offsetWidth);
    const clampedY = Math.min(Math.max(0, newY), container.clientHeight - elem.offsetHeight);
    elem.style.left = `${clampedX}px`;
    elem.style.top = `${clampedY}px`;

    let keyToUpdate = Object.keys(DOM).find((key) => DOM[key] === elem);
    if (keyToUpdate && appState.movableElementPositions[keyToUpdate]) {
      const pos = appState.movableElementPositions[keyToUpdate];
      if (keyToUpdate === "searchWrapper") {
        const newCenterX = clampedX + elem.offsetWidth / 2;
        const newCenterY = clampedY + elem.offsetHeight / 2;
        pos.x = (newCenterX / container.clientWidth) * 100;
        pos.y = (newCenterY / container.clientHeight) * 100;
      } else {
        pos.x = (clampedX / container.clientWidth) * 100;
        pos.y = (clampedY / container.clientHeight) * 100;
      }
    }
  },

  endDrag() {
    if (!this.activeDraggable) return;
    this.activeDraggable.style.cursor = "grab";
    this.activeDraggable = null;
    document.removeEventListener("mousemove", this.drag.bind(this));
    document.removeEventListener("mouseup", this.endDrag.bind(this));
    DebouncedSave.save();
  },

  resetAllPositions() {
    const container = DOM.mainContent;
    if (!container) return;

    const defaultPositions = {
      searchWrapper: { x: 50, y: 30, centered: true },
      pinnedSitesSection: { y: 45, width: 80, height: 30, centered: true },
      quoteBox: { x: 0, y: 0, width: 40, height: 20, centered: false },
    };

    for (const key in defaultPositions) {
      const config = defaultPositions[key];
      appState.movableElementPositions[key] = { ...appState.movableElementPositions[key], ...config };
    }

    if (!appState.isDragModeActive && !appState.isResizeGridModeActive) {
      this.saveInitialPositions();
    }
    appState.customizationChanged = true;
    this.applyFreeMoveSettings();
    DebouncedSave.immediateSave();
    Toast.show("All elements reset to their default positions.");
  },

  applyFreeMoveSettings() {
    const container = DOM.mainContent;
    if (!container) return;
    const movableElems = this.getMovableElements();

    for (const key in movableElems) {
      const elem = movableElems[key];
      if (elem && appState.movableElementPositions[key]) {
        const pos = appState.movableElementPositions[key];

        elem.style.width = pos.width ? `${pos.width}%` : "";
        elem.style.height = pos.height ? `${pos.height}%` : "";

        let newX, newY;

        if (key === "searchWrapper") {
          const anchorX = (pos.x / 100) * container.clientWidth;
          const anchorY = (pos.y / 100) * container.clientHeight;
          newX = anchorX - elem.offsetWidth / 2;
          newY = anchorY - elem.offsetHeight / 2;
        } else {
          if (pos.centered) {
            newX = container.clientWidth / 2 - elem.offsetWidth / 2;
          } else {
            newX = (pos.x / 100) * container.clientWidth;
          }
          newY = (pos.y / 100) * container.clientHeight;
        }

        const clampedX = Math.min(Math.max(0, newX), container.clientWidth - elem.offsetWidth);
        const clampedY = Math.min(Math.max(0, newY), container.clientHeight - elem.offsetHeight);

        elem.style.left = `${clampedX}px`;
        elem.style.top = `${clampedY}px`;
        elem.style.cursor = appState.isDragModeActive ? "grab" : "auto";
      }
    }
    SiteManager.checkGridOverflow();
  },

  initElementResize(e) {
    e.preventDefault();
    e.stopPropagation();
    DOM.body.classList.add("resizing-grid");

    const handle = e.target;
    const container = handle.closest(".resizable-element");
    if (!container) return;

    const keyToUpdate = Object.keys(DOM).find((key) => DOM[key] === container);
    if (!keyToUpdate) return;

    const mainContent = DOM.mainContent;
    const direction = handle.dataset.direction;

    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = container.getBoundingClientRect();

    const doResize = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newLeft = startRect.left - mainContent.offsetLeft;
      let newTop = startRect.top - mainContent.offsetTop;
      let newWidth = startRect.width;
      let newHeight = startRect.height;

      if (direction.includes("e")) newWidth = startRect.width + dx;
      if (direction.includes("w")) {
        newWidth = startRect.width - dx;
        newLeft = startRect.left - mainContent.offsetLeft + dx;
      }
      if (direction.includes("s")) newHeight = startRect.height + dy;
      if (direction.includes("n")) {
        newHeight = startRect.height - dy;
        newTop = startRect.top - mainContent.offsetTop + dy;
      }

      const minWidth = parseFloat(getComputedStyle(container).minWidth) || 150;
      const minHeight = parseFloat(getComputedStyle(container).minHeight) || 50;

      if (newWidth < minWidth) {
        if (direction.includes("w")) newLeft += newWidth - minWidth;
        newWidth = minWidth;
      }
      if (newHeight < minHeight) {
        if (direction.includes("n")) newTop += newHeight - minHeight;
        newHeight = minHeight;
      }

      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;

      const pos = appState.movableElementPositions[keyToUpdate];
      pos.centered = false;
      pos.x = (newLeft / mainContent.clientWidth) * 100;
      pos.y = (newTop / mainContent.clientHeight) * 100;
      pos.width = (newWidth / mainContent.clientWidth) * 100;
      pos.height = (newHeight / mainContent.clientHeight) * 100;

      if (keyToUpdate === "pinnedSitesSection") {
        SiteManager.checkGridOverflow();
      }
    };

    const stopResize = () => {
      DOM.body.classList.remove("resizing-grid");
      document.removeEventListener("mousemove", doResize);
      document.removeEventListener("mouseup", stopResize);
      DebouncedSave.save();
    };

    document.addEventListener("mousemove", doResize);
    document.addEventListener("mouseup", stopResize);
  },

  setupEventListeners() {
    DOM.enterDragModeBtn.addEventListener("click", this.enterDragMode.bind(this));
    DOM.enterResizeGridModeBtn.addEventListener("click", this.enterResizeGridMode.bind(this));
    DOM.resetAllPositionsBtn.addEventListener("click", this.resetAllPositions.bind(this));
    DOM.confirmDragBtn.addEventListener("click", this.confirmPositions.bind(this));
    DOM.cancelDragBtn.addEventListener("click", this.cancelPositions.bind(this));

    document.querySelectorAll(".resizable-element .resize-handle").forEach((handle) => {
      handle.addEventListener("mousedown", this.initElementResize.bind(this));
    });
  },
};