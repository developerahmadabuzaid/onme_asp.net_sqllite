// OnMe Admin — dashboard + leads + content + media + settings
(function () {
  "use strict";
  var API = window.ONME_API_BASE ||
    (window.location.protocol === "file:" ? "http://localhost:5200" : window.location.origin);
  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", function () {
      var manifest = document.querySelector('link[rel="manifest"]');
      var swUrl = new URL("sw.js", manifest ? manifest.href : document.baseURI).href;
      navigator.serviceWorker.register(swUrl, { updateViaCache: "none" }).then(function (reg) {
        return reg.update();
      }).catch(function () {});
    });
  }
  // Safe storage: localStorage may throw in strict privacy modes —
  // fall back to memory so the login script never dies silently.
  var store = (function () {
    try {
      localStorage.setItem("__onme_probe", "1");
      localStorage.removeItem("__onme_probe");
      return localStorage;
    } catch (_) {
      var mem = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();
  var token = store.getItem("onme_token") || "";
  var user = null;
  try { user = JSON.parse(store.getItem("onme_user") || "null"); } catch (_) {}

  var loginView = document.getElementById("login-view");
  var appView = document.getElementById("app-view");

  function authHeaders(extra) {
    return Object.assign({ Authorization: "Bearer " + token }, extra || {});
  }
  function showApp() {
    loginView.hidden = true; appView.hidden = false;
    document.getElementById("userEmail").textContent = (user && user.email) || "";
    loadDashboard(); loadLeads();
  }
  function showLogin() {
    loginView.hidden = false; appView.hidden = true;
  }
  if (token) showApp(); else showLogin();

  // Tabs
  document.querySelectorAll(".side-nav button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".side-nav button").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      var tab = document.getElementById("tab-" + btn.dataset.tab);
      if (tab) tab.classList.add("active");
      if (btn.dataset.tab === "content") loadContent();
      if (btn.dataset.tab === "media") loadMedia();
      if (btn.dataset.tab === "settings") loadSettings();
      if (btn.dataset.tab === "dash") loadDashboard();
    });
  });

  // Login
  document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var err = document.getElementById("loginErr");
    err.textContent = "";
    try {
      var res = await fetch(API + "/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      if (!res.ok) throw new Error("بيانات الدخول غير صحيحة");
      var body = await res.json();
      token = body.token;
      user = body.user;
      store.setItem("onme_token", token);
      store.setItem("onme_user", JSON.stringify(user));
      showApp();
    } catch (ex) { err.textContent = ex.message; }
  });
  document.getElementById("logoutBtn").addEventListener("click", function () {
    store.removeItem("onme_token");
    store.removeItem("onme_user");
    location.reload();
  });

  async function api(path, opts) {
    var res = await fetch(API + path, Object.assign({}, opts || {}, {
      headers: authHeaders((opts && opts.headers) || (opts && opts.body instanceof FormData ? {} : { "Content-Type": "application/json" })),
    }));
    if (res.status === 401) { showLogin(); throw new Error("انتهت الجلسة — سجّل الدخول مجددًا"); }
    if (!res.ok) {
      var msg = "خطأ " + res.status;
      try { var b = await res.json(); if (b.message) msg = b.message; } catch (_) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Dashboard
  async function loadDashboard() {
    try {
      var d = await api("/api/admin/dashboard");
      var labels = { new: "جديدة", reviewing: "قيد المراجعة", inProgress: "قيد التنفيذ", completed: "مكتملة" };
      var html = "";
      Object.keys(labels).forEach(function (k) {
        html += '<div class="stat"><b>' + (d.counts[k] ?? 0) + "</b><span>" + labels[k] + "</span></div>";
      });
      document.getElementById("stats").innerHTML = html;
      var tb = document.querySelector("#latestTable tbody");
      tb.innerHTML = d.latest.map(function (l) {
        return "<tr><td>" + l.refCode + "</td><td>" + esc(l.name) + "</td><td dir='ltr'>" + esc(l.phone) + "</td><td>" + statusBadge(l.status) + "</td><td>" + fmtDate(l.createdAt) + "</td></tr>";
      }).join("") || "<tr><td colspan='5'>لا توجد طلبات بعد</td></tr>";
    } catch (e) { console.warn(e); }
  }

  function statusBadge(s) {
    var labels = {
      New: "جديد", Contacted: "تم التواصل", Reviewing: "قيد المراجعة",
      Quoted: "تم العرض", InProgress: "قيد التنفيذ",
      Completed: "مكتمل", Cancelled: "ملغى"
    };
    return "<span class='badge b-" + s + "'>" + (labels[s] || s) + "</span>";
  }

  // Leads
  var currentLead = null;
  async function loadLeads() {
    try {
      var q = document.getElementById("q").value || "";
      var st = document.getElementById("statusFilter").value || "";
      var d = await api("/api/admin/leads?q=" + encodeURIComponent(q) + "&status=" + encodeURIComponent(st) + "&pageSize=50");
      var tb = document.querySelector("#leadsTable tbody");
      tb.innerHTML = d.items.map(function (l) {
        return "<tr><td>" + esc(l.name) + "</td><td>" + statusBadge(l.status) + "</td><td>" + fmtDate(l.createdAt) + "</td>" +
          "<td><button class='btn' data-open='" + l.id + "'>فتح</button></td></tr>";
      }).join("") || "<tr><td colspan='4'>لا توجد نتائج</td></tr>";
      tb.querySelectorAll("[data-open]").forEach(function (b) {
        b.addEventListener("click", function () { openLead(+b.dataset.open); });
      });
    } catch (e) { console.warn(e); }
  }
  document.getElementById("searchBtn").addEventListener("click", loadLeads);

  var locLabels = { inside_saudi: "داخل السعودية", outside_saudi: "خارج السعودية", unsure: "غير متأكد" };
  async function openLead(id) {
    var l = await api("/api/admin/leads/" + id);
    currentLead = l;
    document.getElementById("leadDetail").hidden = false;
    document.getElementById("dTitle").textContent = l.refCode + " — " + l.name;
    document.getElementById("dMeta").textContent =
      "الجوال: " + l.phone + " · الموقع: " + (locLabels[l.location] || "—") + " · أُرسل: " + fmtDate(l.createdAt);
    document.getElementById("dDesc").textContent = l.description;
    document.getElementById("dStatus").value = l.status;
    renderNotes(l.notes || []);
    document.getElementById("leadDetail").scrollIntoView({ behavior: "smooth" });
  }
  function renderNotes(notes) {
    document.getElementById("dNotes").innerHTML = notes.map(function (n) {
      return "<li>" + esc(n.body) + " <span class='muted small'>— " + fmtDate(n.createdAt) + "</span></li>";
    }).join("") || "<li class='muted'>لا توجد ملاحظات</li>";
  }
  document.getElementById("dSave").addEventListener("click", async function () {
    if (!currentLead) return;
    var st = document.getElementById("dStatus").value;
    var updated = await api("/api/admin/leads/" + currentLead.id, {
      method: "PUT", body: JSON.stringify({ status: st }),
    });
    currentLead = updated;
    loadLeads(); loadDashboard();
    alert("تم حفظ الحالة");
  });
  document.getElementById("noteAdd").addEventListener("click", async function () {
    if (!currentLead) return;
    var inp = document.getElementById("noteInput");
    if (!inp.value.trim()) return;
    await api("/api/admin/leads/" + currentLead.id + "/notes", {
      method: "POST", body: JSON.stringify({ body: inp.value.trim() }),
    });
    inp.value = "";
    openLead(currentLead.id);
  });

  // Content
  async function loadContent() {
    var d = await api("/api/admin/page-content");
    document.getElementById("sections").innerHTML = d.sections.map(function (s) {
      return "<div class='item-card'><b>#" + s.id + " " + esc(s.key) + "</b>" +
        "<input class='grow' data-sec-title='" + s.id + "' value=\"" + escAttr(s.title) + "\" />" +
        "<input class='grow' data-sec-body='" + s.id + "' value=\"" + escAttr(s.body || "") + "\" />" +
        "<button class='btn btn-primary' data-sec-save='" + s.id + "'>حفظ</button></div>";
    }).join("");
    document.querySelectorAll("[data-sec-save]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var id = b.dataset.secSave;
        var title = document.querySelector("[data-sec-title='" + id + "']").value;
        var body = document.querySelector("[data-sec-body='" + id + "']").value;
        await api("/api/admin/page-content/sections/" + id, { method: "PUT", body: JSON.stringify({ title: title, body: body }) });
        alert("تم الحفظ");
      });
    });

    document.getElementById("services").innerHTML = d.services.map(function (s) {
      return "<div class='item-card'><input data-svc-t='" + s.id + "' value=\"" + escAttr(s.title) + "\" />" +
        "<input class='grow' data-svc-d='" + s.id + "' value=\"" + escAttr(s.description || "") + "\" />" +
        "<button class='btn btn-primary' data-svc-save='" + s.id + "'>حفظ</button>" +
        "<button class='btn danger' data-svc-del='" + s.id + "'>حذف</button></div>";
    }).join("");
    document.querySelectorAll("[data-svc-save]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var id = b.dataset.svcSave;
        await api("/api/admin/services/" + id, { method: "PUT", body: JSON.stringify({
          title: document.querySelector("[data-svc-t='" + id + "']").value,
          description: document.querySelector("[data-svc-d='" + id + "']").value }) });
        alert("تم الحفظ");
      });
    });
    document.querySelectorAll("[data-svc-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("حذف هذه الخدمة؟")) return;
        await api("/api/admin/services/" + b.dataset.svcDel, { method: "DELETE" });
        loadContent();
      });
    });

    document.getElementById("faqs").innerHTML = d.faqs.map(function (f) {
      return "<div class='item-card'><input data-faq-q='" + f.id + "' value=\"" + escAttr(f.question) + "\" />" +
        "<input class='grow' data-faq-a='" + f.id + "' value=\"" + escAttr(f.answer) + "\" />" +
        "<button class='btn btn-primary' data-faq-save='" + f.id + "'>حفظ</button>" +
        "<button class='btn danger' data-faq-del='" + f.id + "'>حذف</button></div>";
    }).join("");
    document.querySelectorAll("[data-faq-save]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var id = b.dataset.faqSave;
        await api("/api/admin/faqs/" + id, { method: "PUT", body: JSON.stringify({
          question: document.querySelector("[data-faq-q='" + id + "']").value,
          answer: document.querySelector("[data-faq-a='" + id + "']").value }) });
        alert("تم الحفظ");
      });
    });
    document.querySelectorAll("[data-faq-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("حذف هذا السؤال؟")) return;
        await api("/api/admin/faqs/" + b.dataset.faqDel, { method: "DELETE" });
        loadContent();
      });
    });

    document.getElementById("examples").innerHTML = (d.examples || []).map(function (e) {
      return "<div class='item-card'><input class='grow' data-ex-t='" + e.id + "' value=\"" + escAttr(e.text) + "\" />" +
        "<button class='btn btn-primary' data-ex-save='" + e.id + "'>حفظ</button>" +
        "<button class='btn danger' data-ex-del='" + e.id + "'>حذف</button></div>";
    }).join("") || "<p class='muted'>لا توجد أمثلة بعد</p>";
    document.querySelectorAll("[data-ex-save]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var id = b.dataset.exSave;
        await api("/api/admin/examples/" + id, { method: "PUT", body: JSON.stringify({
          text: document.querySelector("[data-ex-t='" + id + "']").value }) });
        alert("تم الحفظ");
      });
    });
    document.querySelectorAll("[data-ex-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("حذف هذا المثال؟")) return;
        await api("/api/admin/examples/" + b.dataset.exDel, { method: "DELETE" });
        loadContent();
      });
    });
  }
  document.getElementById("svcAdd").addEventListener("click", async function () {
    var t = document.getElementById("svcTitle").value.trim();
    var d = document.getElementById("svcDesc").value.trim();
    if (!t) return alert("اكتب عنوان الخدمة");
    await api("/api/admin/services", { method: "POST", body: JSON.stringify({ title: t, description: d }) });
    document.getElementById("svcTitle").value = ""; document.getElementById("svcDesc").value = "";
    loadContent();
  });
  document.getElementById("faqAdd").addEventListener("click", async function () {
    var q = document.getElementById("faqQ").value.trim();
    var a = document.getElementById("faqA").value.trim();
    if (!q || !a) return alert("اكتب السؤال والإجابة");
    await api("/api/admin/faqs", { method: "POST", body: JSON.stringify({ question: q, answer: a }) });
    document.getElementById("faqQ").value = ""; document.getElementById("faqA").value = "";
    loadContent();
  });
  document.getElementById("exAdd").addEventListener("click", async function () {
    var t = document.getElementById("exText").value.trim();
    if (!t) return alert("اكتب نص المثال");
    await api("/api/admin/examples", { method: "POST", body: JSON.stringify({ text: t }) });
    document.getElementById("exText").value = "";
    loadContent();
  });

  // Media
  async function loadMedia() {
    var items = await api("/api/admin/media");
    document.getElementById("mediaGrid").innerHTML = items.map(function (m) {
      var prev = m.kind === "video"
        ? "<video src='" + API + m.url + "' controls></video>"
        : "<img src='" + API + m.url + "' alt='' />";
      return "<div class='media-item'>" + prev + "<div class='meta'><span>" + esc(m.fileName) + "</span><button class='btn danger' data-media-del='" + m.id + "'>حذف</button></div></div>";
    }).join("") || "<p class='muted'>لا توجد ملفات</p>";
    document.querySelectorAll("[data-media-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("حذف هذا الملف؟")) return;
        await api("/api/admin/media/" + b.dataset.mediaDel, { method: "DELETE" });
        loadMedia();
      });
    });
  }
  document.getElementById("uploadForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var res = await fetch(API + "/api/admin/media", { method: "POST", headers: authHeaders(), body: fd });
    if (!res.ok) return alert("فشل الرفع");
    e.target.reset();
    loadMedia();
  });

  // Settings
  async function loadSettings() {
    var d = await api("/api/admin/page-content");
    var keys = ["brand_name", "brand_tagline", "phone", "footer_text", "copyright", "seo_title", "seo_description", "hero_video_url", "hero_video_poster"];
    document.getElementById("settingsForm").innerHTML = keys.map(function (k) {
      return "<div class='item-card'><b>" + k + "</b><input class='grow' data-set='" + k + "' value=\"" + escAttr((d.settings && d.settings[k]) || "") + "\" dir='auto' /><button class='btn btn-primary' data-set-save='" + k + "'>حفظ</button></div>";
    }).join("");
    document.querySelectorAll("[data-set-save]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var k = b.dataset.setSave;
        var v = document.querySelector("[data-set='" + k + "']").value;
        await api("/api/admin/settings/" + k, { method: "PUT", body: JSON.stringify({ value: v }) });
        alert("تم الحفظ");
      });
    });
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function escAttr(s) { return esc(s).replace(/\n/g, " "); }
  function fmtDate(s) { try { return new Date(s).toLocaleString("ar-SA"); } catch (_) { return s; } }
})();
