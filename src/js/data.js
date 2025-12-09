/**
 * Handles data import, export, and hard reset functionality.
 */
const DataManager = {
  exportSettings() {
    try {
      const stateToExport = { ...appState };

      delete stateToExport.searchEngineFavicons;

      const replacements = [];
      const placeholderPrefix = "##JSON_OBJECT_PLACEHOLDER_";

      const stateString = JSON.stringify(
        stateToExport,
        (key, value) => {
          if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            const isSimpleObject = Object.values(value).every((v) => typeof v !== "object" || v === null);

            if (isSimpleObject) {
              const compactJSON = JSON.stringify(value);
              const placeholder = `${placeholderPrefix}${replacements.length}##`;
              replacements.push({ placeholder: `"${placeholder}"`, value: compactJSON });
              return placeholder;
            }
          }
          return value;
        },
        2
      );

      let finalJsonString = stateString;
      replacements.forEach((rep) => {
        finalJsonString = finalJsonString.replace(rep.placeholder, rep.value);
      });

      const blob = new Blob([finalJsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `new-tab-settings-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Toast.show("Settings exported successfully!");
    } catch (error) {
      console.error("Failed to export settings:", error);
      Toast.show("Error exporting settings.");
    }
  },

  importSettings() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json";
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const newState = JSON.parse(event.target.result);
          if (newState.pinnedSites && newState.currentSearchEngine) {
            localStorage.setItem("newTabState", JSON.stringify(newState));
            Toast.show("Settings imported successfully! Reloading...");
            setTimeout(() => location.reload(), 1500);
          } else {
            throw new Error("Invalid settings file format.");
          }
        } catch (error) {
          console.error("Failed to import settings:", error);
          Toast.show("Error: Invalid or corrupt settings file.");
        }
      };
      reader.readAsText(file);
    };
    fileInput.click();
  },

  hardReset() {
    if (window.confirm("Are you sure you want to perform a hard reset? All your pinned sites and settings will be permanently deleted.")) {
      if (window.confirm("This action cannot be undone. Please confirm one last time.")) {
        localStorage.removeItem("newTabState");
        localStorage.removeItem("faviconCache");
        Toast.show("Reset successful! Reloading...");
        setTimeout(() => location.reload(), 1500);
      }
    }
  },

  setupEventListeners() {
    DOM.exportSettingsBtn.addEventListener("click", this.exportSettings.bind(this));
    DOM.importSettingsBtn.addEventListener("click", this.importSettings.bind(this));
    DOM.hardResetBtn.addEventListener("click", this.hardReset.bind(this));
  },
};