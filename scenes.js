(function () {
  "use strict";

  var tabs = document.getElementById("marketplace-tabs");
  var agentPanel = document.getElementById("agent-panel");
  var scenePanel = document.getElementById("scenario-panel");
  if (!tabs || !agentPanel || !scenePanel) return;

  var scenes = [
    {
      id: "marketing", employee: "content", category: "sales", name: "AI营销视频生成",
      description: "策划并推进一次营销活动：目标人群、渠道、物料与节奏。",
      image: "assets/work-content.jpg", imageClass: "scene-cover-marketing",
      tasks: ["梳理营销活动目标与受众", "规划视频内容、物料与发布渠道", "安排活动推进节奏"],
      preparation: ["产品或活动介绍、目标人群", "投放渠道、活动时间与预算范围", "品牌素材、已有文案或视频参考"]
    },
    {
      id: "reports", employee: "finance", category: "all", name: "AI生成汇报（日/周/月报）",
      description: "绑定飞书群，按日/周节奏整理群消息与项目进展，汇总成日报、周报，确认后再发。",
      image: "assets/work-finance.jpg", imageClass: "scene-cover-reports",
      tasks: ["梳理群消息中的项目进展", "汇总日报、周报或月报内容", "整理需要确认的进度与待办"],
      preparation: ["需要汇总的群消息或项目记录", "汇报周期、接收对象与内容范围", "现有汇报格式，以及飞书群的连接与授权安排"]
    },
    {
      id: "images", employee: "design", category: "all", name: "AI生成图片",
      description: "说一句需求，文生图或图生图生成海报与视觉物料初稿。",
      image: "assets/work-design.jpg", imageClass: "scene-cover-images",
      tasks: ["活动海报与宣传物料初稿", "基于文字需求探索视觉方向", "基于已有图片调整画面内容与风格"],
      preparation: ["图片用途、尺寸与需要呈现的内容", "品牌标识、文案与参考风格", "需要保留或修改的原始图片"]
    },
    {
      id: "templates", employee: "design", category: "all", name: "合规场景专用：名片、喜报、排行榜",
      description: "模板海报云端精控，文案与数字可修改，同款可复用。",
      image: "assets/work-design.jpg", imageClass: "scene-cover-templates",
      tasks: ["名片、喜报与排行榜的模板化制作", "替换模板中的文案、姓名与数字", "复用同款版式制作系列物料"],
      preparation: ["可使用的模板与品牌规范", "需要替换的文案、数字和图片", "物料尺寸、使用场景与审核要求"]
    },
    {
      id: "custom", employee: "content", category: "all", name: "自定义协作场景",
      description: "从目标出发，创建适合当前业务的协作项目。",
      image: "assets/work-development.svg", imageClass: "scene-cover-custom",
      tasks: ["把业务目标拆解为协作任务", "梳理需要的角色、资料与工作步骤", "明确阶段成果与确认节点"],
      preparation: ["希望解决的问题与预期成果", "参与角色、现有资料和时间安排", "需要确认的业务限制与协作方式"]
    }
  ];
  var sceneById = new Map(scenes.map(function (scene) { return [scene.id, scene]; }));
  var tabButtons = Array.from(tabs.querySelectorAll('[role="tab"][data-market-tab]'));
  var dialog = document.getElementById("service-dialog");
  var dialogBody = document.getElementById("dialog-body");
  var activeTab = "agents";
  var category = "all";
  var panelAnimation = null;
  var sceneFocus = null;
  var sceneDialogOpen = false;

  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "发现服务");
  agentPanel.setAttribute("role", "tabpanel");
  agentPanel.setAttribute("aria-labelledby", "tab-agents");
  scenePanel.setAttribute("role", "tabpanel");
  scenePanel.setAttribute("aria-labelledby", "tab-scenes");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function arrowMarkup() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
  }
  function sceneUrl(scene) {
    return "chat.html?employee=" + encodeURIComponent(scene.employee) + "&scene=" + encodeURIComponent(scene.id);
  }
  function cardMarkup(scene) {
    return '<article class="scenario-card" data-scene-id="' + scene.id + '">' +
      '<button type="button" class="scenario-card-trigger" data-scene-open="' + scene.id +
      '" aria-labelledby="scene-title-' + scene.id + '" aria-describedby="scene-description-' + scene.id + '">' +
      '<span class="scenario-card-cover ' + scene.imageClass + '"><img src="' + scene.image +
      '" alt="" width="600" height="390" loading="lazy" decoding="async"></span>' +
      '<span class="scenario-card-content"><span class="scenario-card-title" id="scene-title-' + scene.id + '">' +
      escapeHtml(scene.name) + '</span><span class="scenario-card-description" id="scene-description-' + scene.id + '">' +
      escapeHtml(scene.description) + '</span><span class="scenario-card-footer" aria-hidden="true">查看场景' + arrowMarkup() +
      '</span></span></button></article>';
  }

  scenePanel.innerHTML = '<div class="scenario-toolbar"><div class="category-filters scenario-filters" aria-label="场景分类">' +
    '<button type="button" class="is-active" data-scene-category="all" aria-pressed="true">全部</button>' +
    '<button type="button" data-scene-category="sales" aria-pressed="false">销售增长</button></div>' +
    '<div class="search-wrap scenario-search"><label class="sr-only" for="scene-search">搜索场景</label>' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>' +
    '<input id="scene-search" type="search" placeholder="搜索场景" autocomplete="off"></div></div>' +
    '<p class="scenario-result-count" id="scene-result-count" role="status" aria-live="polite">5 个场景</p>' +
    '<div class="scenario-grid" id="scene-grid">' + scenes.map(cardMarkup).join("") + '</div>' +
    '<div class="empty-state scenario-empty" id="scene-empty" hidden><h3>没有找到相关场景</h3>' +
    '<p>换个关键词，或查看全部场景。</p><button type="button" class="button button-secondary" id="reset-scenes">查看全部场景</button></div>';

  var search = document.getElementById("scene-search");
  var cards = Array.from(scenePanel.querySelectorAll(".scenario-card"));
  var empty = document.getElementById("scene-empty");
  var count = document.getElementById("scene-result-count");

  function setTab(nextTab, focus) {
    if (!["agents", "scenes"].includes(nextTab)) return;
    var previous = activeTab;
    activeTab = nextTab;
    tabButtons.forEach(function (tab) {
      var selected = tab.dataset.marketTab === nextTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle("is-active", selected);
      if (selected && focus) tab.focus();
    });
    if (panelAnimation) { panelAnimation.cancel(); panelAnimation = null; }
    agentPanel.hidden = nextTab !== "agents";
    scenePanel.hidden = nextTab !== "scenes";
    if (previous !== nextTab) {
      var panel = nextTab === "agents" ? agentPanel : scenePanel;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && typeof panel.animate === "function") {
        panelAnimation = panel.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
        panelAnimation.onfinish = function () { panelAnimation = null; };
      }
      window.dispatchEvent(new CustomEvent("market:changed", { detail: { tab: nextTab, current: nextTab, previous: previous } }));
      if (nextTab === "agents") window.marketplaceMotion?.refresh?.();
    }
  }

  function applyFilters() {
    var query = search.value.trim().toLocaleLowerCase("zh-CN");
    var visibleCount = 0;
    cards.forEach(function (card) {
      var scene = sceneById.get(card.dataset.sceneId);
      var text = [scene.name, scene.description, scene.tasks.join(" ")].join(" ").toLocaleLowerCase("zh-CN");
      var matches = (category === "all" || scene.category === category) && (!query || text.includes(query));
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    count.textContent = visibleCount + " 个场景";
    empty.hidden = visibleCount > 0;
    scenePanel.querySelectorAll("[data-scene-category]").forEach(function (button) {
      var selected = button.dataset.sceneCategory === category;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-active", selected);
    });
  }

  function listMarkup(items) {
    return items.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("");
  }
  function restoreSceneFocus() {
    if (!sceneDialogOpen) return;
    sceneDialogOpen = false;
    dialog?.classList.remove("scenario-dialog");
    var target = sceneFocus;
    sceneFocus = null;
    if (target && target.isConnected && !target.closest("[hidden]")) target.focus({ preventScroll: true });
  }
  function closeSceneDialog() {
    if (!dialog || !sceneDialogOpen) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      dialog.hidden = true;
      restoreSceneFocus();
    }
  }
  function showScene(scene) {
    if (!dialog || !dialogBody) return;
    sceneFocus = document.activeElement;
    sceneDialogOpen = true;
    dialog.dataset.view = "profile";
    dialog.classList.add("scenario-dialog");
    dialog.setAttribute("aria-labelledby", "dialog-title");
    dialog.setAttribute("aria-describedby", "dialog-description");
    dialogBody.innerHTML = '<div class="scenario-detail"><div class="scenario-detail-heading"><p class="profile-category">协作场景</p>' +
      '<h2 id="dialog-title" tabindex="-1">' + escapeHtml(scene.name) + '</h2>' +
      '<p id="dialog-description" class="dialog-intro">' + escapeHtml(scene.description) + '</p></div>' +
      '<div class="scenario-detail-layout"><div class="scenario-detail-visual"><div class="scenario-detail-cover ' + scene.imageClass +
      '"><img src="' + scene.image + '" alt="" width="600" height="390" decoding="async"></div>' +
      '<div class="dialog-actions"><a class="button button-primary" href="' + sceneUrl(scene) + '">开始对话' + arrowMarkup() + '</a></div></div>' +
      '<div class="scenario-detail-content"><section><h3>适用任务</h3><ul class="scenario-task-list">' + listMarkup(scene.tasks) + '</ul></section>' +
      '<section><h3>开始前，准备这些</h3><ul class="scenario-preparation">' + listMarkup(scene.preparation) + '</ul></section></div></div></div>';
    dialog.hidden = false;
    if (!dialog.open) {
      try { dialog.showModal(); }
      catch (error) { dialog.setAttribute("open", ""); }
    }
    window.requestAnimationFrame(function () { if (sceneDialogOpen) document.getElementById("dialog-title")?.focus({ preventScroll: true }); });
  }

  tabs.addEventListener("click", function (event) {
    var tab = event.target.closest('[role="tab"][data-market-tab]');
    if (tab && tabs.contains(tab)) setTab(tab.dataset.marketTab, false);
  });
  tabs.addEventListener("keydown", function (event) {
    var current = event.target.closest('[role="tab"][data-market-tab]');
    if (!current || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    var index = tabButtons.indexOf(current);
    var next = event.key === "Home" ? 0 : event.key === "End" ? tabButtons.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length;
    setTab(tabButtons[next].dataset.marketTab, true);
  });
  scenePanel.addEventListener("click", function (event) {
    var filter = event.target.closest("[data-scene-category]");
    if (filter) { category = filter.dataset.sceneCategory; applyFilters(); return; }
    var opener = event.target.closest("[data-scene-open]");
    if (opener) {
      var scene = sceneById.get(opener.dataset.sceneOpen);
      if (scene) showScene(scene);
    }
    if (event.target.closest("#reset-scenes")) {
      category = "all";
      search.value = "";
      applyFilters();
      search.focus();
    }
  });
  search.addEventListener("input", applyFilters);
  document.addEventListener("market:show-agents", function () { setTab("agents", false); });
  if (dialog) {
    dialog.addEventListener("close", restoreSceneFocus);
    dialog.addEventListener("click", function (event) {
      if (!sceneDialogOpen || !event.target.closest("[data-close-dialog]")) return;
      event.preventDefault();
      event.stopPropagation();
      closeSceneDialog();
    });
    dialog.addEventListener("keydown", function (event) {
      if (!sceneDialogOpen || typeof dialog.showModal === "function") return;
      if (event.key === "Escape") { event.preventDefault(); closeSceneDialog(); }
    });
  }
  window.addEventListener("pagehide", function () { panelAnimation?.cancel(); });
  setTab(tabButtons.find(function (tab) { return tab.getAttribute("aria-selected") === "true"; })?.dataset.marketTab || "agents", false);
})();
