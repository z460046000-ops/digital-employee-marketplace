(function () {
  "use strict";
  var holder = document.getElementById("marketplace-banner");
  var api = window.EmbeddedMarketplace;
  var operations = window.MarketplaceOps;
  if (!holder || !api) return;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var banners = [];
  var index = 0;
  var currentView = api.getView();
  var timer;
  var userPaused = false;
  var hovering = false;
  var focused = false;
  var fallback = [{ id: "default-content", title: "把下一项工作，交给合适的数字员工。", subtitle: "从文案、设计到政策解读，点开就能开始。", image: "assets/hero.jpg", targetEmployeeId: "content", enabled: true, position: "agents-top" }];

  function stopTimer() { window.clearTimeout(timer); }
  function beginTimer() {
    stopTimer();
    if (userPaused || hovering || focused || reduced.matches || document.hidden || banners.length < 2 || holder.hidden) return;
    timer = window.setTimeout(function () { select(index + 1); }, 7000);
  }
  function select(nextIndex) {
    if (!banners.length) return;
    index = (nextIndex + banners.length) % banners.length;
    var banner = banners[index];
    $("banner-title").textContent = banner.title || banner.name;
    $("banner-subtitle").textContent = banner.subtitle || "选择合适的数字员工，开始一项具体工作。";
    $("banner-image").src = operations ? operations.assetUrl(banner.image) : banner.image;
    $("banner-image").alt = "";
    $("banner-action").setAttribute("aria-label", "开始使用：" + (banner.title || banner.name));
    $("banner-counter").textContent = String(index + 1).padStart(2, "0") + " / " + String(banners.length).padStart(2, "0");
    $("banner-dots").querySelectorAll("button").forEach(function (button, number) {
      button.classList.toggle("is-current", number === index);
      button.setAttribute("aria-pressed", String(number === index));
    });
    if (!reduced.matches && typeof $("banner-title").animate === "function") {
      $("banner-title").animate([{ opacity: .2, transform: "translateY(6px)", filter: "blur(4px)" }, { opacity: 1, transform: "translateY(0)", filter: "blur(0)" }], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" });
      $("banner-image").animate([{ opacity: .6 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
    }
    beginTimer();
  }
  function refresh() {
    stopTimer();
    var lastId = banners[index] && banners[index].id;
    var position = currentView === "agents" ? "agents-top" : currentView === "scenes" ? "scenes-top" : null;
    try {
      var source = operations ? operations.getBanners() : fallback;
      var employees = operations ? operations.getEmployees() : window.marketplaceCatalog || [];
      var available = source.filter(function (banner) {
        var target = employees.find(function (employee) { return employee.id === banner.targetEmployeeId; });
        return banner.enabled && banner.targetAvailable !== false && target && target.published !== false;
      });
      var positioned = available.filter(function (banner) { return banner.position === position; });
      banners = position ? (positioned.length ? positioned : available) : [];
    } catch (error) { banners = []; }
    holder.hidden = !position || banners.length === 0;
    document.body.classList.toggle("has-marketplace-banner", !holder.hidden);
    $("banner-dots").replaceChildren();
    banners.forEach(function (banner, number) {
      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "查看推荐 " + (number + 1) + "：" + (banner.title || banner.name));
      button.addEventListener("click", function () { select(number); });
      $("banner-dots").appendChild(button);
    });
    $("banner-pause").hidden = banners.length < 2 || reduced.matches;
    $("banner-dots").hidden = banners.length < 2;
    index = Math.max(0, banners.findIndex(function (banner) { return banner.id === lastId; }));
    if (!holder.hidden) select(index);
  }
  $("banner-action").addEventListener("click", function () {
    var banner = banners[index];
    if (banner) api.openEmployee(banner.targetEmployeeId);
  });
  $("banner-pause").addEventListener("click", function () {
    userPaused = !userPaused;
    this.setAttribute("aria-pressed", String(userPaused));
    this.setAttribute("aria-label", userPaused ? "恢复自动切换" : "暂停自动切换");
    this.firstElementChild.textContent = userPaused ? "▷" : "Ⅱ";
    beginTimer();
  });
  holder.addEventListener("mouseenter", function () { hovering = true; stopTimer(); });
  holder.addEventListener("mouseleave", function () { hovering = false; beginTimer(); });
  holder.addEventListener("focusin", function () { focused = true; stopTimer(); });
  holder.addEventListener("focusout", function () {
    window.requestAnimationFrame(function () { focused = holder.contains(document.activeElement); beginTimer(); });
  });
  document.addEventListener("visibilitychange", beginTimer);
  if (typeof reduced.addEventListener === "function") reduced.addEventListener("change", refresh);
  if (operations) operations.subscribe(refresh);
  window.addEventListener("pageshow", refresh);
  window.MarketplaceBanner = { setView: function (view) { currentView = view; refresh(); } };
  refresh();
})();
