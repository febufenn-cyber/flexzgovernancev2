/* Flexz Governance — background theme toggle.
   Two looks that share the SAME colours (map, status, accents): only the page
   BACKGROUND changes — "grey" (vault grey, default) <-> "dark" (deep navy).
   Persists to localStorage 'flexz-theme'. The pre-paint inline script in
   base.html sets data-theme before first paint to avoid a flash. */
(function () {
  "use strict";
  var KEY = "flexz-theme";
  var root = document.documentElement;

  function current() {
    // Two looks that share ALL colours (panels, text, map, accents): only the page
    // BACKGROUND differs — "dark" (gunmetal, default) <-> "silver" (brushed aluminium).
    return root.dataset.theme === "silver" ? "silver" : "dark";
  }

  function syncButton(btn, theme) {
    if (!btn) return;
    var silver = theme === "silver";
    // Button offers to switch to the OTHER background.
    btn.setAttribute("aria-pressed", silver ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      silver ? "Switch to dark background" : "Switch to silver background"
    );
    btn.title = silver ? "Dark background" : "Silver background";
    var ic = btn.querySelector(".theme-ic");
    if (ic) ic.textContent = silver ? "◐" : "◑";
    var lbl = btn.querySelector(".theme-lbl");
    if (lbl) lbl.textContent = silver ? "Dark" : "Silver";
  }

  function apply(theme, btn) {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    syncButton(btn, theme);
  }

  function init() {
    var btn = document.getElementById("theme-toggle");
    syncButton(btn, current());
    if (!btn) return;
    btn.addEventListener("click", function () {
      apply(current() === "silver" ? "dark" : "silver", btn);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
