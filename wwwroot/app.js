// OnMe landing — interactions + lead submission
(function () {
  "use strict";

  // Same-origin API (page is now rendered by ASP.NET itself)
  var API_BASE = window.ONME_API_BASE ||
    (window.location.protocol === "file:" ? "http://localhost:5200" : window.location.origin);

  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    window.addEventListener("load", function () {
      var manifest = document.querySelector('link[rel="manifest"]');
      var swUrl = new URL("sw.js", manifest ? manifest.href : document.baseURI).href;
      navigator.serviceWorker.register(swUrl, { updateViaCache: "none" }).then(function (reg) {
        return reg.update();
      }).catch(function () {});
    });
  }

  (function initNav() {
    var toggle = document.getElementById("menuToggle");
    var nav = document.getElementById("primaryNav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "فتح القائمة");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  })();

  // Reveal on scroll
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  // FAQ: only one open at a time
  var accs = document.querySelectorAll(".acc");
  accs.forEach(function (acc) {
    acc.querySelector("summary").addEventListener("click", function () {
      accs.forEach(function (other) {
        if (other !== acc && other.open) other.open = false;
      });
    });
  });

  (function initTyper() {
    var box = document.getElementById("exampleTyper");
    if (!box) return;
    var fallback = [
      "أحتاج ألقى موردًا في دولة أخرى لمنتج معين.",
      "أريد أحدًا يتواصل مع عدة جهات ويجمع لي المعلومات.",
      "عندي موضوع يحتاج متابعة في مدينة أخرى.",
      "أحتاج البحث والمقارنة والترتيب قبل اتخاذ قرار."
    ];
    var texts = fallback.slice();
    fetch(API_BASE + "/api/content").then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (c) {
      if (c && c.examples && c.examples.length) texts = c.examples.map(function (e) { return e.text; });
      start();
    }).catch(function () { start(); });
    var startedTyper = false;
    function start() {
      if (startedTyper) return;
      startedTyper = true;
      boot(texts);
    }
    function boot(items) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.getElementById("twText").textContent = items[0];
        return;
      }
      var textEl = document.getElementById("twText");
      var dotsEl = document.getElementById("twDots");
      var countEl = document.getElementById("twCount");
      items.forEach(function (_, i) {
        var d = document.createElement("i");
        if (i === 0) d.className = "active";
        dotsEl.appendChild(d);
      });
      var dots = dotsEl.children;
      var idx = 0;
      function mark() {
        for (var k = 0; k < dots.length; k++) dots[k].className = k === idx ? "active" : "";
        countEl.textContent = (idx + 1) + " / " + items.length;
      }
      function type(text, pos, done) {
        textEl.textContent = text.slice(0, pos);
        if (pos <= text.length) setTimeout(function () { type(text, pos + 1, done); }, 55);
        else if (done) setTimeout(done, 2400);
      }
      function erase(text, pos, done) {
        textEl.textContent = text.slice(0, pos);
        if (pos > 0) setTimeout(function () { erase(text, pos - 1, done); }, 16);
        else if (done) setTimeout(done, 450);
      }
      function cycle() {
        mark();
        type(items[idx], 1, function () {
          erase(items[idx], items[idx].length, function () { idx = (idx + 1) % items.length; cycle(); });
        });
      }
      var started = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !started) { started = true; cycle(); io.disconnect(); }
        });
      }, { threshold: 0.3 });
      io.observe(box);
    }
  })();

  // Services spotlight: one flashing card at a time, same place
  (function initSpotlight() {
    var root = document.getElementById("svcSpot");
    if (!root) return;
    var cards = Array.prototype.slice.call(root.querySelectorAll(".spot-card"));
    var dotsBox = document.getElementById("spotDots");
    if (!cards.length || !dotsBox) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var idx = 0, timer = null;
    cards.forEach(function (_, i) {
      var b = document.createElement("button");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "خدمة " + (i + 1));
      if (i === 0) b.classList.add("active");
      b.addEventListener("click", function () { go(i); restart(); });
      dotsBox.appendChild(b);
    });
    var dots = dotsBox.children;
    function go(i) {
      cards[idx].classList.remove("active");
      dots[idx].classList.remove("active");
      idx = (i + cards.length) % cards.length;
      cards[idx].classList.add("active");
      dots[idx].classList.add("active");
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); if (!reduce) timer = setInterval(function () { go(idx + 1); }, 4000); }
    document.getElementById("spotNext").addEventListener("click", function () { go(idx + 1); restart(); });
    document.getElementById("spotPrev").addEventListener("click", function () { go(idx - 1); restart(); });
    root.addEventListener("pointerenter", stop);
    root.addEventListener("pointerleave", restart);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", restart);
    var x0 = null;
    root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
      x0 = null;
      restart();
    }, { passive: true });
    restart();
  })();

  // Form
  // Services grid: click a tile to expand its description.
  //   Desktop (>720px): the description expands inside the tile.
  //   Mobile  (≤720px): the description slides into a full-width bar BELOW the row.
  (function initServices() {
    var tiles = Array.prototype.slice.call(document.querySelectorAll(".service-tile"));
    if (!tiles.length) return;
    var rowBars = Array.prototype.slice.call(document.querySelectorAll(".row-bar"));
    var mq = window.matchMedia("(max-width: 720px)");
    var isMobile = function () { return mq.matches; };

    function closeAll() {
      tiles.forEach(function (t) { t.setAttribute("aria-expanded", "false"); });
      rowBars.forEach(function (rb) { rb.classList.remove("is-open"); rb.innerHTML = ""; });
    }

    function escHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function openMobile(tile) {
      var row = tile.getAttribute("data-row");
      var bar = document.querySelector('.row-bar[data-row="' + row + '"]');
      if (!bar) return;
      var titleEl = tile.querySelector(".svc-title");
      var descEl = tile.querySelector(".svc-detail-inner p");
      var title = titleEl ? titleEl.textContent.trim() : "";
      var desc = descEl ? descEl.innerHTML.trim() : "";
      bar.innerHTML = '<div class="row-bar-inner"><h4>' + escHtml(title) + '</h4><p>' + desc + '</p></div>';
      // double rAF so the grid-template-rows transition can pick up the height change
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { bar.classList.add("is-open"); });
      });
      setTimeout(function () { bar.scrollIntoView({ behavior: "smooth", block: "center" }); }, 240);
    }

    tiles.forEach(function (tile) {
      tile.addEventListener("click", function () {
        var wasOpen = tile.getAttribute("aria-expanded") === "true";
        closeAll();
        if (wasOpen) return;
        tile.setAttribute("aria-expanded", "true");
        if (isMobile()) {
          openMobile(tile);
        } else {
          // desktop: smooth-scroll the opened card if it's near the edge
          setTimeout(function () {
            var r = tile.getBoundingClientRect();
            if (r.top < 80 || r.bottom > (window.innerHeight - 40)) {
              tile.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 220);
        }
      });
    });

    // When the breakpoint changes, reset state so we don't leave stale mobile bars
    // visible on desktop (or vice-versa).
    var lastMobile = isMobile();
    mq.addEventListener("change", function () {
      var nowMobile = isMobile();
      if (nowMobile !== lastMobile) {
        closeAll();
        lastMobile = nowMobile;
      }
    });
  })();

  // Form
  var form = document.getElementById("leadForm");
  if (!form) return;
  var statusEl = document.getElementById("formStatus");
  var submitBtn = document.getElementById("submitBtn");

  function setErr(name, msg) {
    var el = document.querySelector('[data-err="' + name + '"]');
    if (el) el.textContent = msg || "";
  }

  function validate(data) {
    var ok = true;
    setErr("name", ""); setErr("phone", ""); setErr("description", "");

    if (!data.name || data.name.trim().length < 2) {
      setErr("name", "فضلًا اكتب اسمك."); ok = false;
    }
    // Saudi mobile: 05XXXXXXXX (10 digits starting with 05)
    var phone = (data.phone || "").replace(/[\s-]/g, "");
    if (!/^05\d{8}$/.test(phone)) {
      setErr("phone", "فضلًا أدخل رقم جوال صحيح (05XXXXXXXX)."); ok = false;
    }
    if (!data.description || data.description.trim().length < 10) {
      setErr("description", "اشرح المهمة باختصار (10 أحرف على الأقل)."); ok = false;
    }
    return ok;
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    statusEl.textContent = "";
    statusEl.style.color = "#c0392b";

    var fd = new FormData(form);
    var payload = {
      name: (fd.get("name") || "").toString().trim(),
      phone: (fd.get("phone") || "").toString().trim(),
      description: (fd.get("description") || "").toString().trim(),
      location: (fd.get("location") || "").toString() || null,
    };
    // normalize location values to API enum
    var locMap = { inside_saudi: "inside_saudi", outside_saudi: "outside_saudi", unsure: "unsure" };
    if (payload.location && !locMap[payload.location]) payload.location = null;

    if (!validate(payload)) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "جارٍ الإرسال...";

    try {
      var res = await fetch(API_BASE + "/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        var errBody = null;
        try { errBody = await res.json(); } catch (_) { /* ignore */ }
        throw new Error((errBody && errBody.message) || ("تعذر الإرسال (رمز " + res.status + ")"));
      }
      var body = await res.json().catch(function () { return {}; });
      showSuccess(body.ref || body.id || "");
    } catch (err) {
      // Fallback: save locally so the demo still works without backend
      try {
        var queue = JSON.parse(localStorage.getItem("onme_leads") || "[]");
        queue.push(Object.assign({}, payload, { at: new Date().toISOString() }));
        localStorage.setItem("onme_leads", JSON.stringify(queue));
        showSuccess("محلي — سيُرسل عند تشغيل الخادم");
      } catch (_) {
        statusEl.textContent = err.message || "حدث خطأ أثناء الإرسال. حاول مجددًا.";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "أرسل طلبي";
    }
  });

  function showSuccess(ref) {
    var formView = document.getElementById("form-view");
    var successView = document.getElementById("success-view");
    if (formView) formView.hidden = true;
    if (successView) {
      successView.hidden = false;
      var refEl = document.getElementById("leadRef");
      if (refEl && ref) refEl.textContent = "رقم المرجع: " + ref;
      successView.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
})();
