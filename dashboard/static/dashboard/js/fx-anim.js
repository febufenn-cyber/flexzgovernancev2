/*  Fusion Center — GSAP entrance polish.
 *  Cinematic on-load choreography + SplitText title + card pop-in as dashboard.js
 *  inserts them. Deliberately does NOT touch the KPI numbers — those are formatted
 *  strings (e.g. "12.5 Cr", "83%") owned by dashboard.js; animating them would
 *  corrupt the displayed values. Pure presentation, fully reduced-motion aware.
 */
(function () {
  var gsap = window.gsap;
  if (!gsap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function run() {
    // Kinetic title reveal
    try {
      if (window.SplitText) {
        gsap.registerPlugin(window.SplitText);
        var h1 = document.querySelector('.topbar .brand h1');
        if (h1) {
          var split = new window.SplitText(h1, { type: 'chars' });
          gsap.from(split.chars, {
            yPercent: 120, opacity: 0, stagger: 0.018,
            duration: 0.5, ease: 'power3.out', delay: 0.1,
          });
        }
      }
    } catch (e) { /* SplitText optional */ }

    // Staggered entrance for the main chrome + panels
    var bits = ['.fusionbar', '.topbar', '.cards', '.mapwrap', '.panel']
      .map(function (s) { return document.querySelector(s); })
      .filter(Boolean);
    if (bits.length) {
      gsap.from(bits, {
        y: 18, opacity: 0, duration: 0.6, stagger: 0.08,
        ease: 'power2.out', clearProps: 'transform',
      });
    }

    // Pop each summary card in as dashboard.js renders it
    var host = document.getElementById('summary-cards');
    if (host) {
      var obs = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (node) {
            if (node.nodeType === 1 && node.classList && node.classList.contains('card')) {
              gsap.from(node, {
                y: 14, opacity: 0, scale: 0.97, duration: 0.45,
                ease: 'power2.out', clearProps: 'transform',
              });
            }
          });
        });
      });
      obs.observe(host, { childList: true });
      setTimeout(function () { obs.disconnect(); }, 9000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
