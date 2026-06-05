/* live.js — realtime telemetry motion.
   Gently "breathes" displayed integer metrics around their TRUE baseline with a
   bounded random walk (±0.35%), so the console feels live without ever crossing a
   status threshold. Status colors, counts, and the map allocation are untouched —
   those remain the authoritative, threshold-derived values from the API. */
(function () {
  "use strict";

  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  var SEL = ".bm-v, .tile .tv, .arow .av, .area-value, .card .v";
  var fmt = new Intl.NumberFormat("en-IN");

  function leadNode(host) {
    if (host.firstChild && host.firstChild.nodeType === 3 && host.firstChild.nodeValue.trim()) {
      return host.firstChild;
    }
    if (host.children.length === 0) return host;
    return null;
  }
  function readText(n) { return n.nodeType === 3 ? n.nodeValue : n.textContent; }
  function writeText(n, t) { if (n.nodeType === 3) n.nodeValue = t; else n.textContent = t; }

  // Parse a leading integer (with grouping) + trailing suffix. Reject %, decimals, L/Cr.
  function parse(text) {
    var m = String(text).trim().match(/^(\d[\d,]*)(.*)$/);
    if (!m) return null;
    var suffix = m[2] || "";
    if (/[%.]/.test(text) || /\b(L|Cr)\b/.test(suffix)) return null;
    var n = parseInt(m[1].replace(/,/g, ""), 10);
    if (!isFinite(n) || n < 50) return null; // tiny counts read oddly when jittered
    return { value: n, suffix: suffix };
  }

  function tickOne(host) {
    if (host.classList.contains("decoding")) return; // hud.js mid-scramble
    var node = leadNode(host);
    if (!node) return;
    var parsed = parse(readText(node));
    if (!parsed) return;

    // Detect external re-render (dept switch / drill): re-anchor, no flash.
    if (host.__last == null || Math.abs(parsed.value - host.__last) > Math.max(3, host.__base * 0.05)) {
      host.__base = parsed.value;
      host.__walk = 0;
      host.__last = parsed.value;
      host.__suffix = parsed.suffix;
      return;
    }

    host.__walk += (Math.random() - 0.5) * 0.0035;
    if (host.__walk > 0.0035) host.__walk = 0.0035;
    if (host.__walk < -0.0035) host.__walk = -0.0035;
    var next = Math.max(1, Math.round(host.__base * (1 + host.__walk)));
    if (next === host.__last) return;

    var up = next > host.__last;
    writeText(node, fmt.format(next) + (host.__suffix || ""));
    host.__last = next;

    host.classList.remove("tick-up", "tick-down");
    void host.offsetWidth; // restart flash
    host.classList.add(up ? "tick-up" : "tick-down");
  }

  function pulse() {
    if (document.hidden) return;
    var nodes = document.querySelectorAll(SEL);
    for (var i = 0; i < nodes.length; i++) {
      if (Math.random() < 0.5) tickOne(nodes[i]); // stagger ~half each pulse
    }
  }

  function start() { window.setInterval(pulse, 2000); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
