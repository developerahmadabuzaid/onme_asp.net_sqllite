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

  // Hero video: poster by default, auto-loads CMS video when configured
  (function initHeroVideo() {
    var video = document.getElementById("heroVideo");
    var play = document.getElementById("heroPlay");
    var muteBtn = document.getElementById("heroMute");
    if (!video) return;
    function showPlay(show) { if (play) play.classList.toggle("hidden", !show); }
    function setMuteIcon() {
      if (!muteBtn) return;
      muteBtn.textContent = video.muted ? "تشغيل الصوت" : "كتم الصوت";
      muteBtn.setAttribute("aria-pressed", String(!video.muted));
    }
    function playWithSound() {
      if (!video.currentSrc) { video.focus(); return; }
      video.muted = false;
      video.volume = 1.0;
      video.play().then(function () {
        showPlay(false);
      }).catch(function () {
        showPlay(true);
      });
      setMuteIcon();
    }
    if (play) play.addEventListener("click", playWithSound);
    if (muteBtn) muteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      video.muted = !video.muted;
      if (!video.muted) video.volume = 1.0;
      if (video.paused) video.play().catch(function () {});
      setMuteIcon();
    });
    var justUnlocked = false; // the tap that turned the sound on must not also pause the video
    video.addEventListener("click", function () {
      if (justUnlocked) { justUnlocked = false; return; }
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });
    // Match the frame to the video's real dimensions (portrait or landscape)
    video.addEventListener("loadedmetadata", function () {
      if (video.videoWidth && video.videoHeight)
        video.style.setProperty("--video-ratio", video.videoWidth + " / " + video.videoHeight);
    });
    // Browsers block sound until the visitor interacts with the page. Try with sound first;
    // if blocked, play muted and turn the sound on at the first real interaction.
    // Only these events count as an "interaction" for the browser (touchstart/scroll do not).
    var unlockEvents = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
    var unlocking = false;
    function stopListening() {
      unlockEvents.forEach(function (n) { document.removeEventListener(n, unlockSound, true); });
      if (muteBtn) muteBtn.classList.remove("needs-sound");
    }
    function unlockSound(e) {
      if (muteBtn && e && muteBtn.contains(e.target)) { stopListening(); return; } // the button handles itself
      if (unlocking || !video.muted) return;
      unlocking = true;
      if (e && e.type !== "click" && e.target === video) justUnlocked = true;
      video.muted = false;
      video.volume = 1.0;
      video.play().then(function () {
        stopListening();
      }).catch(function () {
        justUnlocked = false;
        video.muted = true; // still not allowed: stay muted and retry on the next interaction
        video.play().catch(function () {});
      }).then(function () { unlocking = false; setMuteIcon(); });
    }
    function autoplayWithSound() {
      video.muted = false;
      video.volume = 1.0;
      video.play().then(function () {
        showPlay(false); setMuteIcon();
      }).catch(function () {
        video.muted = true;
        setMuteIcon();
        if (muteBtn) muteBtn.classList.add("needs-sound");
        video.play().then(function () { showPlay(false); }).catch(function () { showPlay(true); });
        unlockEvents.forEach(function (n) { document.addEventListener(n, unlockSound, true); });
      });
    }
    video.addEventListener("play", function () { showPlay(false); });
    video.addEventListener("pause", function () { showPlay(true); });
    fetch(API_BASE + "/api/content").then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (c) {
      if (!c || !c.settings) return;
      if (c.settings.hero_video_poster) video.poster = c.settings.hero_video_poster;
      if (c.settings.hero_video_url) {
        video.src = c.settings.hero_video_url;
        video.loop = true;
        video.muted = true;
        video.volume = 1.0;
        video.playsInline = true;
        setMuteIcon();
        video.oncanplay = function () {
          video.oncanplay = null; // canplay fires again after seeking/looping
          autoplayWithSound();
        };
        video.load();
      }
    }).catch(function () {});
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

  // Typewriter: one client message at a time, typed live (from CMS, fallback to defaults)
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
      if (c && c.examples && c.examples.length) {
        texts = c.examples.map(function (e) { return e.text; });
      }
      start();
    }).catch(function () { start(); });
    var startedTyper = false;
    function start() {
      if (startedTyper) return;
      startedTyper = true;
      boot(texts);
    }
    function boot(texts) {
    // Reduced motion: calm static list instead of animation
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var staticBox = document.createElement("div");
      staticBox.className = "examples-static";
      staticBox.innerHTML = texts.map(function (t) {
        return "<blockquote>«" + t.replace(/</g, "&lt;") + "»</blockquote>";
      }).join("");
      box.replaceWith(staticBox);
      return;
    }
    var textEl = document.getElementById("twText");
    var dotsEl = document.getElementById("twDots");
    var countEl = document.getElementById("twCount");
    texts.forEach(function (_, i) {
      var d = document.createElement("i");
      if (i === 0) d.className = "active";
      dotsEl.appendChild(d);
    });
    var dots = dotsEl.children;
    var idx = 0;
    function mark() {
      for (var k = 0; k < dots.length; k++) dots[k].className = k === idx ? "active" : "";
      countEl.textContent = (idx + 1) + " / " + texts.length;
    }
    function type(text, pos, done) {
      textEl.textContent = text.slice(0, pos);
      if (pos <= text.length) {
        setTimeout(function () { type(text, pos + 1, done); }, 55);
      } else if (done) {
        setTimeout(done, 2400);
      }
    }
    function erase(text, pos, done) {
      textEl.textContent = text.slice(0, pos);
      if (pos > 0) {
        setTimeout(function () { erase(text, pos - 1, done); }, 16);
      } else if (done) {
        setTimeout(done, 450);
      }
    }
    function cycle() {
      mark();
      type(texts[idx], 1, function () {
        erase(texts[idx], texts[idx].length, function () {
          idx = (idx + 1) % texts.length;
          cycle();
        });
      });
    }
    // Start when visible
    var started = false;
    var io3 = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !started) { started = true; cycle(); io3.disconnect(); }
      });
    }, { threshold: 0.3 });
    io3.observe(box);
    }
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
