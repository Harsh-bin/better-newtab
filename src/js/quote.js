/**
 * Manages the animated quote box using the Typed.js library.
 */
const QuoteManager = {
  init() {
    if (DOM.quoteText && typeof Typed !== "undefined" && typeof quotes !== "undefined") {
      new Typed("#quoteText", {
        strings: quotes,
        typeSpeed: 130,
        backSpeed: 30,
        startDelay: 2000,
        backDelay: 8000,
        loop: true,
        loopCount: Infinity,
        showCursor: false,
        cursorChar: "|",
        shuffle: true,
      });
    }
  },
};