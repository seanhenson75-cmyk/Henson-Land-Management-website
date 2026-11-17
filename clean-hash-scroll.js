(function () {
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function stickyOffset() {
    var offset = 0;
    var nodes = document.querySelectorAll("header.nav, .nav, .pageNav");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var position = window.getComputedStyle(el).position;
      if (position !== "sticky" && position !== "fixed") continue;
      var rect = el.getBoundingClientRect();
      if (rect.bottom > offset && rect.top <= 1) offset = rect.bottom;
    }
    return offset;
  }

  function scrollToId(id) {
    if (!id) return false;
    var target = document.getElementById(id);
    if (!target) return false;
    var margin = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
    var top = target.getBoundingClientRect().top + window.pageYOffset - stickyOffset() - margin;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
    return true;
  }

  function stripHash() {
    if (!location.hash) return;
    history.replaceState(null, "", location.pathname + location.search);
  }

  function onHashLinkClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest('a[href^="#"]');
    if (!link) return;
    var href = link.getAttribute("href");
    if (!href) return;
    var id = decodeURIComponent(href.slice(1));
    if (!id) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      stripHash();
      return;
    }
    if (!document.getElementById(id)) return;
    event.preventDefault();
    scrollToId(id);
    stripHash();
  }

  function scrollFromLoadHash() {
    var hash = location.hash;
    if (!hash) return;
    var id = decodeURIComponent(hash.slice(1));
    scrollToId(id);
    stripHash();
  }

  document.addEventListener("click", onHashLinkClick);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      requestAnimationFrame(scrollFromLoadHash);
    });
  } else {
    requestAnimationFrame(scrollFromLoadHash);
  }
})();
