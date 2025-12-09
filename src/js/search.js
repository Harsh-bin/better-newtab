/**
 * Manages search and link history for suggestions.
 */
const HistoryManager = {

    _normalizeUrlForStorage(url) {
        const trimmedUrl = url.trim();
        if (/^(localhost|127\.0\.0\.1|\[::1\]|(\d{1,3}\.){3}\d{1,3}|file:\/\/)/i.test(trimmedUrl) || trimmedUrl.startsWith("http://")) {
            return trimmedUrl;
        }
        return trimmedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
    },

    addSearch(query) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;
        appState.searchHistory = appState.searchHistory.filter((item) => item !== trimmedQuery);
        appState.searchHistory.unshift(trimmedQuery);
        if (appState.searchHistory.length > 200) {
            appState.searchHistory.pop();
        }
        DebouncedSave.immediateSave();
    },

    removeSearch(query) {
        const trimmedQuery = query.trim();
        appState.searchHistory = appState.searchHistory.filter((item) => item !== trimmedQuery);
        DebouncedSave.immediateSave();
        Toast.show("Search item removed from history.");
    },

    getSearchSuggestions(inputValue) {
        const trimmedInput = inputValue.trim().toLowerCase();
        if (!trimmedInput) return [];
        return appState.searchHistory.filter((item) => item.toLowerCase().startsWith(trimmedInput));
    },

    addLink(url) {
        const normalizedUrl = this._normalizeUrlForStorage(url);
        if (!normalizedUrl) return;

        let currentLinkEntry = appState.linkHistory.find((item) => item.url === normalizedUrl);
        if (!currentLinkEntry) {
            currentLinkEntry = { url: normalizedUrl, visitCount: 0 };
            appState.linkHistory.push(currentLinkEntry);
        }

        if (normalizedUrl === this._normalizeUrlForStorage(appState.lastVisitedLinkURL || '')) {
            currentLinkEntry.visitCount = Math.min(currentLinkEntry.visitCount + 1, 5);
        } else {
            currentLinkEntry.visitCount = 1;
        }

        const newVisitCount = currentLinkEntry.visitCount;
        if (newVisitCount > 0) {
            appState.linkHistory.forEach((item) => {
                if (item.url !== normalizedUrl) {
                    if (item.visitCount > 0 && newVisitCount >= item.visitCount) {
                        item.visitCount = 0;
                    }
                }
            });
        }

        appState.lastVisitedLinkURL = normalizedUrl;
        appState.linkHistory.sort((a, b) => b.visitCount - a.visitCount);

        if (appState.linkHistory.length > 200) {
            appState.linkHistory.pop();
        }

        DebouncedSave.immediateSave();
    },

    removeLink(url) {
        const normalizedUrl = this._normalizeUrlForStorage(url);
        appState.linkHistory = appState.linkHistory.filter((item) => item.url !== normalizedUrl);
        DebouncedSave.immediateSave();
        Toast.show("Link removed from history.");
    },

    getLinkSuggestions(inputValue) {
        const trimmedInput = inputValue.trim().toLowerCase();
        if (!trimmedInput) return [];
        return appState.linkHistory
            .filter((item) => {
                const searchableUrl = item.url.replace(/^http:\/\//, '');
                return searchableUrl.toLowerCase().startsWith(trimmedInput)
            })
            .sort((a, b) => b.visitCount - a.visitCount);
    },
};

/**
 * Handles all logic related to the search bar, including engine selection,
 * search execution, and suggestion handling.
 */
const SearchManager = {
    currentQuery: "",
    selectedSuggestionIndex: -1,
    _suggestionRequestController: null,
    _jsonpRequestCounter: 0,

    setEngine(engineKey) {
        if (SEARCH_ENGINES[engineKey]) {
            appState.currentSearchEngine = engineKey;
            const { name, icon } = SEARCH_ENGINES[engineKey];
            DOM.currentEngine.innerHTML = `<img src="${icon}" alt="${name} logo">`;
            DebouncedSave.immediateSave();
        }
    },

    updateAllEngineIcons() {
        this.setEngine(appState.currentSearchEngine);
    },

    performSearch(queryOverride) {
        if (appState.isDragModeActive) return Toast.show("Exit drag mode to search!");
        const query = (typeof queryOverride === "string" ? queryOverride : DOM.searchInput.value).trim();
        if (!query) return;

        DOM.searchLogoWrapper.classList.add("loading");

        const isLink = Utils.isUrl(query);

        if (isLink) {
            let url = query;
            if (!/^(https?|ftp|file):\/\//i.test(url)) {
                url = /^(localhost|127\.0\.0\.1|\[::1\]|(\d{1,3}\.){3}\d{1,3})/i.test(url) ? "http://" + url : "https://" + url;
            }

            HistoryManager.addLink(query);
            window.open(url, "_self");
        } else {
            HistoryManager.addSearch(query);
            const searchUrl = SEARCH_ENGINES[appState.currentSearchEngine].url + encodeURIComponent(query);
            window.open(searchUrl, "_self");
        }

        this.selectedSuggestionIndex = -1;
        DOM.suggestionsContainer.classList.remove("active");
    },

    fetchSuggestions(query, engineOverride = null) {
        if (this._suggestionRequestController) {
            if (this._suggestionRequestController.abort) {
                this._suggestionRequestController.abort();
            }
        }

        const engineKey = engineOverride || appState.currentSearchEngine;
        const engineConfig = SEARCH_ENGINES[engineKey];

        if (!engineConfig || !engineConfig.suggestionUrl) {
            this.renderSuggestions([], query);
            return;
        }

        const encodedQuery = encodeURIComponent(query);

        if (engineConfig.suggestionType === 'json') {
            const controller = new AbortController();
            this._suggestionRequestController = controller;
            const url = engineConfig.suggestionUrl.replace('{query}', encodedQuery);

            fetch(url, { signal: controller.signal })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => {
                    this.processIncomingSuggestions(data, engineKey, query);
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error(`Suggestion fetch error for ${engineKey}:`, error);
                    }
                });
        } else if (engineConfig.suggestionType === 'jsonp') {
            const script = document.createElement("script");
            const callbackName = 'jsonpCallback' + this._jsonpRequestCounter++;

            window[callbackName] = (data) => {
                this.processIncomingSuggestions(data, engineKey, query);
                try {
                    document.body.removeChild(script);
                    delete window[callbackName];
                } catch (e) {}
            };

            const url = engineConfig.suggestionUrl
                .replace('{query}', encodedQuery)
                .replace('{callback}', callbackName);

            script.src = url;
            script.onerror = () => {
                console.error(`JSONP request failed for ${engineKey}`);
                delete window[callbackName];
                try {
                    document.body.removeChild(script);
                } catch (e) {}
            };

            document.body.appendChild(script);
        }
    },

    processIncomingSuggestions(data, engineKey, query) {
        const originalQuery = query || this.currentQuery;
        const engineConfig = SEARCH_ENGINES[engineKey];
        if (!engineConfig) return;

        try {
            const suggestions = engineConfig.suggestionParser(data);
            this.renderSuggestions(suggestions, originalQuery);
        } catch (e) {
            console.error(`Error parsing suggestions for ${engineKey}:`, e);
            this.renderSuggestions([], originalQuery);
        }
    },

    renderSuggestions(apiSuggestions, originalQuery) {
        if (originalQuery !== this.currentQuery) {
            return;
        }

        const suggestionsContainer = DOM.suggestionsContainer;
        const searchBox = DOM.searchBox;
        if (!suggestionsContainer || !searchBox) return;

        suggestionsContainer.innerHTML = "";
        suggestionsContainer.classList.remove("active");
        this.selectedSuggestionIndex = -1;

        const linkSuggestions = HistoryManager.getLinkSuggestions(originalQuery);
        const searchSuggestions = HistoryManager.getSearchSuggestions(originalQuery);
        const historyItems = new Set();

        const createSuggestionElement = (text, type, iconClass) => {
            const div = document.createElement("div");
            div.className = "suggestion-item";

            const isLink = Utils.isUrl(text);
            if (isLink) {
                iconClass = "fa-link";
                div.classList.add("link-suggestion");
            }

            const icon = document.createElement("i");
            icon.className = `fas ${iconClass}`;
            div.appendChild(icon);

            const textSpan = document.createElement("span");
            textSpan.className = "suggestion-text";
            textSpan.textContent = text;
            div.appendChild(textSpan);

            div.onclick = () => {
                DOM.searchInput.value = text;
                suggestionsContainer.innerHTML = "";
                suggestionsContainer.classList.remove("active");
                DOM.searchInput.focus();
                this.performSearch(text);
            };

            if (type === "link" || type === "search") {
                div.classList.add("history-item");
                const deleteBtn = document.createElement("button");
                deleteBtn.className = "delete-history-btn";
                deleteBtn.innerHTML = "&times;";
                deleteBtn.title = `Remove from ${type} history`;
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (type === "link") HistoryManager.removeLink(text);
                    else HistoryManager.removeSearch(text);

                    div.remove();

                    const remainingItems = suggestionsContainer.querySelectorAll(".suggestion-item");
                    if (remainingItems.length === 0) {
                        suggestionsContainer.classList.remove("active");
                    } else {
                        const separators = suggestionsContainer.querySelectorAll("hr");
                        separators.forEach((hr) => {
                            if (!hr.previousElementSibling || hr.previousElementSibling.tagName === "HR" || !hr.nextElementSibling) {
                                hr.remove();
                            }
                        });
                    }
                };
                div.appendChild(deleteBtn);
            }

            return div;
        };

        let hasHistory = false;
        if (linkSuggestions.length > 0) {
            hasHistory = true;
            linkSuggestions.forEach((s) => {
                historyItems.add(s.url);
                suggestionsContainer.appendChild(createSuggestionElement(s.url, "link", "fa-link"));
            });
        }

        if (searchSuggestions.length > 0) {
            if (hasHistory) suggestionsContainer.appendChild(document.createElement("hr"));
            hasHistory = true;
            searchSuggestions.forEach((s) => {
                historyItems.add(s);
                suggestionsContainer.appendChild(createSuggestionElement(s, "search", "fa-history"));
            });
        }

        if (apiSuggestions.length > 0) {
            if (hasHistory) suggestionsContainer.appendChild(document.createElement("hr"));
            apiSuggestions.forEach((s) => {
                if (!historyItems.has(s)) {
                    suggestionsContainer.appendChild(createSuggestionElement(s, "api", "fa-search"));
                }
            });
        }

        if (suggestionsContainer.hasChildNodes()) {
            const searchBoxRect = searchBox.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            suggestionsContainer.style.visibility = "hidden";
            suggestionsContainer.style.display = "block";
            const suggestionsHeight = suggestionsContainer.offsetHeight;
            suggestionsContainer.style.visibility = "";
            suggestionsContainer.style.display = "";
            const spaceBelow = viewportHeight - searchBoxRect.bottom;
            const requiredSpace = suggestionsHeight + 15;
            if (spaceBelow < requiredSpace && searchBoxRect.top > requiredSpace) {
                suggestionsContainer.style.top = `${searchBoxRect.top - suggestionsHeight - 10}px`;
            } else {
                suggestionsContainer.style.top = `${searchBoxRect.bottom + 10}px`;
            }
            suggestionsContainer.style.left = `${searchBoxRect.left}px`;
            suggestionsContainer.style.width = `${searchBoxRect.width}px`;
            suggestionsContainer.classList.add("active");
        }
    },

    populateEngineDropdown() {
        DOM.engineDropdown.innerHTML = "";

        const createEngineOption = (engineKey, showName = false) => {
            const engine = SEARCH_ENGINES[engineKey];
            const div = document.createElement("div");
            div.className = "search-engine-option";
            div.dataset.engine = engineKey;
            div.title = engine.name;
            div.innerHTML = `<div class="logo"><img src="${engine.icon}" alt="${engine.name} logo"></div>${showName ? `<span>${engine.name}</span>` : ""}`;
            return div;
        };

        const strip = document.createElement("div");
        strip.className = "search-engine-strip";
        ["brave", "yandex", "startpage", "ecosia", "baidu"].forEach((key) => strip.appendChild(createEngineOption(key)));
        DOM.engineDropdown.appendChild(strip);

        ["google", "bing", "duckduckgo", "wikipedia"].forEach((key) => DOM.engineDropdown.appendChild(createEngineOption(key, true)));
    },

    updateSuggestionSelection(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === this.selectedSuggestionIndex) {
                item.classList.add("selected");
                item.scrollIntoView({ block: "nearest" });
                DOM.searchInput.value = item.querySelector(".suggestion-text").textContent;
            } else {
                item.classList.remove("selected");
            }
        });
    },

    setupEventListeners() {
        DOM.engineSelector.addEventListener("click", (e) => {
            e.stopPropagation();
            SiteManager.closeActionMenu();
            if (appState.isDragModeActive) return Toast.show("Exit drag mode to change search engine!");

            const positionCallback = () => {
                const searchBoxRect = DOM.searchBox.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                DOM.engineDropdown.style.visibility = "hidden";
                DOM.engineDropdown.style.display = "block";
                const dropdownHeight = DOM.engineDropdown.offsetHeight;
                DOM.engineDropdown.style.display = "";
                DOM.engineDropdown.style.visibility = "";
                const spaceRequired = dropdownHeight + 15;
                DOM.engineDropdown.style.top = viewportHeight - searchBoxRect.bottom < spaceRequired ? `${searchBoxRect.top - dropdownHeight - 10}px` : `${searchBoxRect.bottom + 10}px`;
                DOM.engineDropdown.style.left = `${searchBoxRect.left}px`;
            };

            DropdownManager.toggle(DOM.engineDropdown, positionCallback);
        });

        DOM.searchBtn.addEventListener("click", () => this.performSearch());

        DOM.searchInput.addEventListener("keydown", (e) => {
            const suggestions = DOM.suggestionsContainer.querySelectorAll(".suggestion-item");
            const hasSuggestions = suggestions.length > 0 && DOM.suggestionsContainer.classList.contains("active");

            switch (e.key) {
                case "ArrowDown":
                    if (hasSuggestions) {
                        e.preventDefault();
                        this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % suggestions.length;
                        this.updateSuggestionSelection(suggestions);
                    }
                    break;
                case "ArrowUp":
                    if (hasSuggestions) {
                        e.preventDefault();
                        this.selectedSuggestionIndex = (this.selectedSuggestionIndex - 1 + suggestions.length) % suggestions.length;
                        this.updateSuggestionSelection(suggestions);
                    }
                    break;
                case "Enter":
                    if (hasSuggestions && this.selectedSuggestionIndex > -1) {
                        e.preventDefault();
                        suggestions[this.selectedSuggestionIndex].click();
                    } else {
                        e.preventDefault();
                        this.performSearch();
                    }
                    break;
                case "Escape":
                    if (hasSuggestions) {
                        DOM.suggestionsContainer.classList.remove("active");
                        this.selectedSuggestionIndex = -1;
                    }
                    break;
            }
        });

        const throttledGlow = Utils.throttle((e) => {
            const rect = DOM.searchBox.getBoundingClientRect(),
                x = e.clientX - rect.left,
                y = e.clientY - rect.top;
            DOM.searchBox.style.setProperty("--mouse-x", `${(x / rect.width) * 100}%`);
            DOM.searchBox.style.setProperty("--mouse-y", `${(y / rect.height) * 100}%`);
        }, 16);
        DOM.searchWrapper.addEventListener("mousemove", throttledGlow);
        DOM.searchWrapper.addEventListener("mouseleave", () => {
            DOM.searchBox.style.setProperty("--mouse-x", "50%");
            DOM.searchBox.style.setProperty("--mouse-y", "50%");
        });

        DOM.engineDropdown.addEventListener("click", (e) => {
            const option = e.target.closest(".search-engine-option");
            if (option && option.dataset.engine) {
                e.stopPropagation();
                this.setEngine(option.dataset.engine);
                DropdownManager.closeAll();
            }
        });

        DOM.searchInput.addEventListener("keyup", (e) => {
            if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) {
                return;
            }

            const input = DOM.searchInput;
            let originalValue = input.value;
            const selectionStart = input.selectionStart;
            const selectionEnd = input.selectionEnd;
            const isDeletionKey = ["Backspace", "Delete"].includes(e.key);

            if (isDeletionKey && selectionStart !== selectionEnd) {
                originalValue = input.value.substring(0, selectionStart);
            }

            if (!isDeletionKey && originalValue.length > 0 && selectionStart === originalValue.length) {
                let bestMatchItem = HistoryManager.getLinkSuggestions(originalValue)[0];
                let isLink = true;

                if (!bestMatchItem) {
                    bestMatchItem = { url: HistoryManager.getSearchSuggestions(originalValue)[0] };
                    isLink = false;
                }

                if (bestMatchItem && bestMatchItem.url) {
                    const searchableBestMatch = isLink ? bestMatchItem.url.replace(/^http:\/\//, '') : bestMatchItem.url;

                    if (searchableBestMatch.toLowerCase().startsWith(originalValue.toLowerCase()) && searchableBestMatch.length > originalValue.length) {
                        const remainder = searchableBestMatch.substring(originalValue.length);
                        input.value = originalValue + remainder;
                        input.setSelectionRange(originalValue.length, input.value.length);
                    }
                }
            }

            this.currentQuery = originalValue;
            if (this.currentQuery.length < 1) {
                DOM.suggestionsContainer.innerHTML = "";
                DOM.suggestionsContainer.classList.remove("active");
                return;
            }

            this.selectedSuggestionIndex = -1;
            this.fetchSuggestions(this.currentQuery);
        });
    },
};