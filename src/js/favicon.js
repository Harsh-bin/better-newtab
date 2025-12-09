/**
 * A utility to find the best available high-resolution favicon for each pinned site.
 */
const FaviconFixer = {
  abortController: null,

  _fetchImageAndGetDimensions(url) {
    return new Promise((resolve, reject) => {
      const tempImg = new Image();
      tempImg.onload = () => {
        resolve({ url, width: tempImg.naturalWidth, height: tempImg.naturalHeight });
        tempImg.src = "";
      };
      tempImg.onerror = () => {
        reject(new Error(`Failed to load image from ${url}`));
        tempImg.src = "";
      };
      tempImg.src = url;
    });
  },

  async _fetchFaviconFromHTML(url) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch HTML via proxy");
      }
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const link = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
      let faviconUrl = "";
      if (link && link.href) {
        faviconUrl = new URL(link.href, url).href;
      } else {
        const siteUrl = new URL(url).origin;
        faviconUrl = `${siteUrl}/favicon.ico`;
      }
      return this._fetchImageAndGetDimensions(faviconUrl);
    } catch (error) {
      throw new Error("HTML parsing failed");
    }
  },

  async _findBestFavicon(siteUrl) {
    const domain = new URL(siteUrl).hostname;
    const encodedUrl = encodeURIComponent(siteUrl);

    try {
      const googleFaviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${encodedUrl}`;
      const googleResult = await this._fetchImageAndGetDimensions(googleFaviconUrl);
      const isGoogle16x16 = googleResult.width === 16 && googleResult.height === 16;

      if (!isGoogle16x16) return googleResult.url;
    } catch (error) {
      console.warn(`Google service failed for ${domain}. Falling back...`);
    }

    try {
      const htmlResult = await this._fetchFaviconFromHTML(siteUrl);
      return htmlResult.url;
    } catch (error) {
      console.warn(`HTML parsing failed for ${domain}. Falling back to placeholder...`);
    }

    const firstLetter = domain.charAt(0).toUpperCase();
    return `fa-text:${firstLetter}`;
  },

  _showProgressIndicator() {
    DOM.progressModal.classList.add("active");
    DOM.body.classList.add("modal-active");
    this._updateProgress(0);
  },

  _hideProgressIndicator() {
    DOM.progressModal.classList.remove("active");
    DOM.body.classList.remove("modal-active");
  },

  _updateProgress(percentage) {
    const p = Math.round(percentage);
    DOM.progressText.textContent = `${p}%`;
    document.documentElement.style.setProperty("--progress-percentage", `${p * 3.6}deg`);
  },

  async run() {
    DropdownManager.closeAll();
    const allSites = [...appState.pinnedSites];
    const totalItems = allSites.length;

    if (totalItems === 0) {
      return Toast.show("No pinned sites to fix!");
    }

    this._showProgressIndicator();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    let processedCount = 0;
    let wasCancelled = false;

    signal.addEventListener("abort", () => {
      wasCancelled = true;
    });

    for (const site of allSites) {
      if (signal.aborted) break;

      const bestIconUrl = await this._findBestFavicon(site.url);

      if (bestIconUrl) {
        const siteToUpdate = appState.pinnedSites.find((s) => s.id === site.id);
        if (siteToUpdate) {
          siteToUpdate.favicon = bestIconUrl;
          try {
            const domain = new URL(site.url).hostname;
            FaviconCache.set(domain, bestIconUrl);
          } catch (e) {
            console.warn("Could not update cache for:", site.url);
          }
        }
      }

      processedCount++;
      this._updateProgress((processedCount / totalItems) * 100);
    }

    if (wasCancelled) {
      this._hideProgressIndicator();
      Toast.show("Icon fix cancelled!");
      this.abortController = null;
      return;
    }

    FaviconCache.saveToStorage();
    DebouncedSave.immediateSave();
    SiteManager.renderPinnedSites();
    if (DOM.allSitesModal.classList.contains("active")) {
      AllSitesModal.render();
    }

    setTimeout(() => {
      this._hideProgressIndicator();
      Toast.show("Icon fix complete!");
    }, 500);

    this.abortController = null;
  },

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
    }
  },

  setupEventListeners() {
    DOM.fixIconsBtn.addEventListener("click", this.run.bind(this));
    DOM.cancelFixIconsBtn.addEventListener("click", this.cancel.bind(this));
  },
};