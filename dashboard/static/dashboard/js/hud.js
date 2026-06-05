/* hud.js — Sovereign Command HUD layer.
   Adds a "decrypt" scramble-reveal to numeric values as they render.
   Self-contained: observes the JS-rendered containers, never edits dashboard.js. */
(function () {
  "use strict";

  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var GLYPHS = "0123456789#%/\\<>*".split("");
  var animating = new WeakSet();

  // Numeric value elements worth decrypting (each contains at least one digit).
  var SEL = ".bm-v, .card .v, .tile .tv, .area-value, .deptrow .val, .arow .av";

  function pick() {
    return GLYPHS[(Math.random() * GLYPHS.length) | 0];
  }

  // Animate the element's leading text (handles "3,520<span>unit</span>" and plain text).
  function targetNode(host) {
    if (host.firstChild && host.firstChild.nodeType === 3 && host.firstChild.nodeValue.trim()) {
      return host.firstChild;
    }
    if (host.children.length === 0) return host;
    return null;
  }

  function write(node, text) {
    if (node.nodeType === 3) node.nodeValue = text;
    else node.textContent = text;
  }

  function reveal(host) {
    if (animating.has(host)) return;
    var node = targetNode(host);
    if (!node) return;
    var finalText = node.nodeType === 3 ? node.nodeValue : node.textContent;
    if (!finalText || !/\d/.test(finalText)) return;
    if (host.__rv === finalText) return;
    host.__rv = finalText;
    if (reduce) return;

    var chars = finalText.split("");
    var total = 14;
    var frame = 0;
    animating.add(host);
    host.classList.add("decoding");

    var id = window.setInterval(function () {
      frame += 1;
      var settle = Math.floor((frame / total) * chars.length);
      var out = "";
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        if (i < settle || !/[0-9]/.test(c)) out += c;
        else out += pick();
      }
      write(node, out);
      if (frame >= total) {
        window.clearInterval(id);
        write(node, finalText);
        host.__rv = finalText;
        host.classList.remove("decoding");
        animating.delete(host);
      }
    }, 30);
  }

  var pending = null;
  function scan() {
    pending = null;
    var nodes = document.querySelectorAll(SEL);
    for (var i = 0; i < nodes.length; i++) reveal(nodes[i]);
  }
  function schedule() {
    if (pending) return;
    pending = window.setTimeout(scan, 60);
  }

  function start() {
    var roots = [
      "#summary-cards", "#top-metric", "#primary-metric",
      "#detail-tiles", "#dept-overview", "#alert-list", "#area-grid",
    ];
    var observer = new MutationObserver(schedule);
    roots.forEach(function (sel) {
      var el = document.querySelector(sel);
      // childList only: our own text writes are characterData and won't re-trigger.
      if (el) observer.observe(el, { childList: true, subtree: true });
    });
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
