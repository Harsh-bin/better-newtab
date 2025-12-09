/**
 * A collection of general-purpose utility functions.
 */
const Utils = {
  throttle(func, limit) {
    let inThrottle;
    return function () {
      const args = arguments,
        context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },
  debounce(func, delay) {
    let timeout;
    return function () {
      const context = this,
        args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  },
  isUrl(str) {
    if (!str) return false;
    const trimmedStr = str.trim();
    const hasProtocol = /^(https?|ftp):\/\//i.test(trimmedStr);
    const isLocalOrIp = /^(localhost|127\.0\.0\.1|\[::1\]|(\d{1,3}\.){3}\d{1,3})/i.test(trimmedStr);
    const hasDot = trimmedStr.includes(".") && !trimmedStr.includes(" ");
    return hasProtocol || isLocalOrIp || hasDot;
  },
};

const DebouncedSave = {
  save: Utils.debounce(() => App.saveState(), 1000),
  immediateSave() {
    App.saveState();
  },
};