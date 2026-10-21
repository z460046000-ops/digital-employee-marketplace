(function () {
  "use strict";

  // 页面内容由 HTML 提供。交互脚本加载失败时，员工与价格仍可阅读。
  var catalog = Array.isArray(window.marketplaceCatalog) ? window.marketplaceCatalog : [];
  var catalogById = new Map(catalog.map(function (role) { return [role.id, role]; }));
  var grid = document.getElementById("role-grid");
  var filters = document.getElementById("category-filters");
  var search = document.getElementById("role-search");
  var count = document.getElementById("result-count");
  var empty = document.getElementById("empty-state");
  var reset = document.getElementById("reset-search");
  var dialog = document.getElementById("service-dialog");
  var dialogBody = document.getElementById("dialog-body");
  var toast = document.getElementById("toast");
  var selectedCategory = "all";
  var selectedScope = "all";
  var navLinks = Array.from(document.querySelectorAll(".main-nav [data-nav]"));
  var previousFocus = null;
  var toastTimer = null;
  var fallbackDialog = false;

  function setNavigation(active) {
    navLinks.forEach(function (link) {
      var selected = link.dataset.nav === active;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      setNavigation(link.dataset.nav);
      if (link.dataset.nav !== "guide") {
        selectedScope = link.dataset.nav === "featured" ? "featured" : "all";
        selectedCategory = "all";
        if (search) search.value = "";
        applyFilters();
      }
    });
  });
  function navigationFromHash() {
    var current = window.location.hash;
    setNavigation(current === "#how-it-works" ? "guide" : current === "#featured" ? "featured" : "discover");
    if (current === "#featured") {
      selectedScope = "featured";
      selectedCategory = "all";
      applyFilters();
    }
  }
  window.addEventListener("hashchange", navigationFromHash);
  navigationFromHash();

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function priceText(role) {
    return "¥" + role.price + " / " + role.unit;
  }

  function categoryValue(value) {
    return !value || value === "全部" || value === "推荐" || value === "recommend" ? "all" : value;
  }

  function announce(message) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }, 4500);
  }

  function applyFilters() {
    if (!grid) return;
    var query = search ? search.value.trim().toLocaleLowerCase("zh-CN") : "";
    var visibleCount = 0;

    grid.querySelectorAll(".role-card").forEach(function (card) {
      var categoryMatches = selectedCategory === "all" || card.dataset.category === selectedCategory;
      var searchableText = [card.dataset.name, card.dataset.description, card.dataset.category].join(" ").toLocaleLowerCase("zh-CN");
      var scopeMatches = selectedScope !== "featured" || ["content", "design", "finance"].includes(card.querySelector("[data-role]")?.dataset.role);
      var matches = scopeMatches && categoryMatches && (!query || searchableText.includes(query));
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    if (count) count.textContent = visibleCount + " 位员工";
    if (empty) empty.hidden = visibleCount !== 0;
    if (filters) {
      filters.querySelectorAll("button[data-category]").forEach(function (button) {
        var active = categoryValue(button.dataset.category) === selectedCategory;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    document.dispatchEvent(new CustomEvent("catalog:updated", {
      detail: { count: visibleCount, category: selectedCategory, query: query }
    }));
  }

  function resetFilters() {
    selectedCategory = "all";
    selectedScope = "all";
    setNavigation("discover");
    if (search) search.value = "";
    applyFilters();
    if (search) search.focus();
  }

  function restoreFocus() {
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
  }

  function closeDialog() {
    if (!dialog) return;
    if (fallbackDialog || typeof dialog.close !== "function") {
      dialog.removeAttribute("open");
      dialog.hidden = true;
      fallbackDialog = false;
      restoreFocus();
    } else if (dialog.open) {
      dialog.close();
    }
  }

  function showDialog(markup, view) {
    if (!dialog || !dialogBody) {
      announce("详情暂时无法打开，请继续浏览员工信息。");
      return;
    }

    var alreadyOpen = dialog.open || dialog.hasAttribute("open");
    if (!alreadyOpen) previousFocus = document.activeElement;
    dialog.dataset.view = view || "standard";
    dialogBody.innerHTML = markup;
    dialog.setAttribute("aria-labelledby", "dialog-title");
    dialog.setAttribute("aria-describedby", "dialog-description");
    dialog.hidden = false;

    if (!alreadyOpen) {
      try {
        if (typeof dialog.showModal !== "function") throw new Error("Dialog unavailable");
        dialog.showModal();
      } catch (error) {
        fallbackDialog = true;
        dialog.setAttribute("open", "");
      }
    }

    window.requestAnimationFrame(function () {
      var target = dialogBody.querySelector("[data-autofocus]") || dialogBody.querySelector("#dialog-title");
      if (target && dialog.open) target.focus({ preventScroll: true });
    });
  }

  function titleMarkup(title, description) {
    return '<h2 id="dialog-title" tabindex="-1">' + escapeHtml(title) + '</h2>' +
      '<p id="dialog-description" class="dialog-intro">' + escapeHtml(description) + '</p>';
  }

  function roleSummary(role) {
    return '<div class="dialog-service-summary">' +
      '<span class="dialog-service-name">' + escapeHtml(role.name) + '</span>' +
      '<strong class="dialog-price">' + escapeHtml(priceText(role)) + '</strong></div>';
  }

  function deliverableList(role) {
    return '<ul class="dialog-deliverables">' + role.deliverables.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join("") + '</ul>';
  }

  function roleButton(role, action, label, className) {
    return '<button type="button" class="' + className + '" data-action="' + action +
      '" data-role="' + escapeHtml(role.id) + '">' + escapeHtml(label) + '</button>';
  }

  var preparation = {
    content: ["产品或主题、目标读者", "内容用途、篇幅与参考风格"],
    design: ["使用场景、尺寸与文案", "品牌素材与风格参考"],
    finance: ["需要整理的账期与资料", "报表用途和关注的问题"],
    qualification: ["拟申请事项与主体情况", "已有材料与办理要求"],
    legal: ["需要解读的政策原文", "关心的条款与具体使用场景"],
    development: ["页面目标与功能说明", "设计或样例、接口资料"],
    translation: ["原文、目标语言与用途", "术语要求与表达风格"],
    live: ["直播主题与产品信息", "时长、受众与已有话术"]
  };

  function showDetails(role) {
    var items = preparation[role.id] || ["具体工作内容", "希望获得的成果与参考资料"];
    showDialog(
      '<div class="employee-profile-head"><div class="profile-category">' + escapeHtml(role.category) + ' · 数字员工</div>' +
      titleMarkup(role.name, role.description) + '</div>' +
      '<div class="profile-layout"><div class="profile-visual">' +
      '<div class="dialog-image-wrap"><img class="dialog-image" src="' + escapeHtml(role.image) +
      '" alt="' + escapeHtml(role.name) + '工作素材" loading="lazy"></div>' +
      roleSummary(role) +
      '<div class="dialog-actions">' + roleButton(role, "trial", "免费试用", "button button-primary") +
      roleButton(role, "buy", "购买", "button button-secondary") + '</div></div>' +
      '<div class="profile-content"><section class="profile-section"><h3>适合交给我的事</h3>' + deliverableList(role) + '</section>' +
      '<section class="profile-section"><h3>开始前，准备这些</h3><ul class="profile-preparation">' + items.map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join("") + '</ul></section>' +
      '<section class="profile-section"><h3>协作方式</h3><div class="profile-workflow"><span>描述需求</span><span>确认范围</span><span>查看成果</span></div></section>' +
      '<details class="profile-environment"><summary>工具与资料说明</summary><p>知识资料、工具连接与技能授权将在真实员工接入后展示。当前是页面预览，不代表已获得相应授权。</p></details>' +
      '<p class="dialog-note">参考价格与计价单位以正式服务说明为准。免费试用将进入员工对话预览。</p></div></div>',
      "profile"
    );
  }

  function showTrial(role) {
    window.location.assign("chat.html?employee=" + encodeURIComponent(role.id));
  }

  function showPurchase(role) {
    showDialog(
      titleMarkup("确认服务", "确认员工与计价方式，再预览订单概览。") +
      roleSummary(role) + '<h3>服务范围</h3>' + deliverableList(role) +
      '<div class="dialog-callout">当前不会创建真实订单，也不会扣款。服务范围、计费边界及支付方式待正式接入。</div>' +
      '<div class="dialog-actions">' + roleButton(role, "order-preview", "预览订单", "button button-primary") +
      roleButton(role, "details", "返回服务详情", "button button-secondary") + '</div>'
    );
  }

  function showOrderPreview(role) {
    showDialog(
      titleMarkup("订单预览", "以下是当前选择的服务概览，尚未创建真实订单。") +
      '<dl class="order-preview"><div><dt>服务员工</dt><dd>' + escapeHtml(role.name) + '</dd></div>' +
      '<div><dt>参考价格</dt><dd>' + escapeHtml(priceText(role)) + '</dd></div>' +
      '<div><dt>计价单位</dt><dd>按' + escapeHtml(role.unit) + '计价</dd></div>' +
      '<div><dt>当前状态</dt><dd>仅供预览，未下单</dd></div></dl>' +
      '<p class="dialog-note">单个计价单位对应的工作量、月度额度等条件仍需确认。此处不计算订单金额。</p>' +
      '<div class="dialog-actions"><button type="button" class="button button-primary" data-close-dialog>继续浏览员工</button>' +
      roleButton(role, "buy", "返回确认", "button button-secondary") + '</div>'
    );
  }

  function showAccount() {
    showDialog(
      titleMarkup("我的工作台", "此处展示账号入口的预览说明。") +
      '<div class="dialog-callout">当前页面尚未连接账号系统。登录、订单和工作台内容需在正式服务中查看。</div>' +
      '<div class="dialog-actions"><button type="button" class="button button-primary" data-close-dialog>继续浏览</button></div>'
    );
  }

  function showGuide() {
    var section = document.getElementById("how-it-works");
    if (section) {
      section.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      return;
    }
    showDialog(
      titleMarkup("如何选择服务", "先找到适合的员工，再确认交付范围与计价方式。") +
      '<ol class="dialog-deliverables"><li>通过分类或搜索找到员工，查看服务详情。</li>' +
      '<li>选择免费试用，填写希望完成的工作。</li><li>确认计价单位后，预览购买流程。</li></ol>' +
      '<p class="dialog-note">本页面用于体验交互流程，不会发送需求、创建订单或扣款。</p>'
    );
  }

  if (filters) {
    filters.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-category]");
      if (!button || !filters.contains(button)) return;
      selectedScope = "all";
      setNavigation("discover");
      selectedCategory = categoryValue(button.dataset.category);
      applyFilters();
    });
  }
  if (search) search.addEventListener("input", function () { selectedScope = "all"; setNavigation("discover"); applyFilters(); });
  if (reset) reset.addEventListener("click", resetFilters);

  document.addEventListener("click", function (event) {
    var browseLink = event.target.closest('a[href="#employees"]');
    if (browseLink) { selectedScope = "all"; selectedCategory = "all"; if (search) search.value = ""; setNavigation("discover"); applyFilters(); }
    var closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      event.preventDefault();
      closeDialog();
      return;
    }

    var control = event.target.closest("[data-action]");
    if (!control) return;
    var action = control.dataset.action;
    if (action === "account") {
      event.preventDefault();
      showAccount();
      return;
    }
    if (action === "guide") {
      event.preventDefault();
      showGuide();
      return;
    }
    if (!["details", "trial", "buy", "order-preview"].includes(action)) return;
    event.preventDefault();
    var role = catalogById.get(control.dataset.role);
    if (!role) {
      announce("暂未找到这位员工，请从员工目录重新选择。");
      return;
    }
    if (action === "details") showDetails(role);
    if (action === "trial") showTrial(role);
    if (action === "buy") showPurchase(role);
    if (action === "order-preview") showOrderPreview(role);
  });

  if (dialog) {
    dialog.addEventListener("close", restoreFocus);
    dialog.addEventListener("click", function (event) {
      if (event.target !== dialog) return;
      var bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        closeDialog();
      }
    });
    dialog.addEventListener("keydown", function (event) {
      if (!fallbackDialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
      if (event.key === "Tab") {
        var focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]'));
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first && last) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last && first) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  applyFilters();
})();

// 导航始终可操作，仅随滚动增强玻璃底色。
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var pending = false;
  function update() { header.classList.toggle('is-scrolled', window.scrollY > 16); pending = false; }
  window.addEventListener('scroll', function () { if (!pending) { pending = true; window.requestAnimationFrame(update); } }, { passive: true });
  update();
})();
