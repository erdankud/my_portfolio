// Fades the page out before following an internal link, so navigating between
// pages reads as one continuous motion instead of a white flash. The fade-in on
// arrival is pure CSS, so it still happens if this script never runs.
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var DURATION = 220; // keep in step with the `leave` animation in style.css

  document.addEventListener("click", function (event) {
    if (reduced.matches) return;
    if (event.defaultPrevented) return;
    // Let the browser handle modified clicks: new tab, download, save-as.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;

    var link = event.target.closest("a");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;

    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (!/\.html?$/.test(url.pathname) && url.pathname !== "/") return;
    // A link to the current page would fade out and never come back.
    if (url.pathname === location.pathname && url.search === location.search) return;

    event.preventDefault();
    document.body.classList.add("is-leaving");
    setTimeout(function () {
      location.href = url.href;
    }, DURATION);
  });

  // Coming back via the browser's back button restores the page from cache with
  // the leaving class still set, which would leave it invisible.
  window.addEventListener("pageshow", function () {
    document.body.classList.remove("is-leaving");
  });
})();
