(function () {
  "use strict";

  var catalog = window.marketplaceCatalog || [];
  var operations = window.MarketplaceOps;
  var store = window.WorkspaceStore;
  var byId = new Map(catalog.map(function (employee) { return [employee.id, employee]; }));
  var $ = function (id) { return document.getElementById(id); };
  var drawer = $("employee-drawer");
  var input = $("drawer-input");
  var active = null;
  var activeScene = null;
  var conversation = null;
  var pendingFiles = [];
  var savedViews = new Map();
  var category = "推荐";
  var sceneCategory = "all";
  var toastTimer;
  var previousFocus;
  var composing = false;
  var currentView = "agents";
  var closeTimer;
  var rechargeCloseTimer;
  var scenes = window.marketplaceScenes || [];
  // 只模拟本页扣点：50 点、每次发送 10 点，刷新或重置后恢复；不产生真实 Token 用量。
  var previewQuota = { total: 50, remaining: new URLSearchParams(window.location.search).get("quota") === "empty" ? 0 : 50, perMessage: 10 };
  var lastMarketView = "agents";

  if (new URLSearchParams(window.location.search).get("embed") === "1") document.body.classList.add("embed-mode");

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function toast(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { $("toast").hidden = true; }, 4000);
  }

  function storageError(error) {
    $("drawer-status").textContent = error.message || "未能保存，请保留当前输入后重试。";
    $("drawer-status").classList.add("is-error");
    toast($("drawer-status").textContent);
  }

  function clearStatus() {
    $("drawer-status").textContent = "";
    $("drawer-status").classList.remove("is-error");
  }

  function contextKey() { return active.id + ":" + (activeScene ? activeScene.id : ""); }

  function remember() {
    if (!active) return;
    savedViews.set(contextKey(), {
      conversationId: conversation ? conversation.id : null,
      draft: input.value,
      files: pendingFiles.slice()
    });
  }

  function saveDraft() {
    if (!active) return true;
    remember();
    if (!conversation && !input.value.trim()) return true;
    try {
      if (!conversation) conversation = store.createConversation({ employeeId: active.id, sceneId: activeScene ? activeScene.id : null });
      conversation = store.setDraft(conversation.id, input.value);
      remember();
      clearStatus();
      return true;
    } catch (error) {
      storageError(error);
      return false;
    }
  }

  function updateSend() {
    $("drawer-send").disabled = Boolean(active && active.published === false) || previewQuota.remaining <= 0 || (!input.value.trim() && pendingFiles.length === 0);
  }

  function renderQuota() {
    var exhausted = previewQuota.remaining <= 0;
    $("drawer-quota-value").textContent = previewQuota.remaining.toLocaleString("zh-CN");
    $("drawer-quota-total").textContent = previewQuota.total.toLocaleString("zh-CN");
    $("drawer-quota").classList.toggle("is-empty", exhausted);
    $("drawer-quota-note").textContent = exhausted ? "体验额度已用完，可前往 Workspace 继续使用。" : "每次发送模拟扣 10 点，还可发送 " + (previewQuota.remaining / previewQuota.perMessage) + " 次";
    $("quota-exhausted").hidden = !exhausted;
    $("drawer-credit-cta").textContent = "额度";
    $("composer-hint").textContent = exhausted ? "当前输入会保留" : "Enter 发送 · Shift + Enter 换行";
    updateSend();
  }

  function simulateEmptyQuota() {
    if (!saveDraft()) return;
    previewQuota.remaining = 0;
    hideRecharge(false);
    renderQuota();
    renderWorkspace();
    showRecharge();
  }

  function resetDemoQuota() {
    previewQuota.remaining = previewQuota.total;
    var url = new URL(window.location.href);
    url.searchParams.delete("quota");
    window.history.replaceState(null, "", url);
    hideRecharge(false);
    renderQuota();
    renderWorkspace();
    toast("体验额度已恢复为 50 点，对话和草稿保留。");
  }

  function showRecharge() {
    var panel = $("recharge-panel");
    window.clearTimeout(rechargeCloseTimer);
    panel.classList.remove("is-closing");
    $("recharge-copy").textContent = previewQuota.remaining <= 0 ? "体验额度已用完，可前往 Workspace 继续使用。" : "前往 Workspace 管理额度，继续使用数字员工服务。";
    if (!panel.open) panel.showModal();
    $("drawer-credit-cta").setAttribute("aria-expanded", "true");
    $("recharge-close").focus({ preventScroll: true });
  }

  function hideRecharge(restoreFocus) {
    var panel = $("recharge-panel");
    window.clearTimeout(rechargeCloseTimer);
    $("drawer-credit-cta").setAttribute("aria-expanded", "false");
    function finish() {
      panel.classList.remove("is-closing");
      if (panel.open) panel.close();
      if (restoreFocus && drawer.open) $("drawer-credit-cta").focus({ preventScroll: true });
    }
    if (!panel.open || !restoreFocus || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    panel.classList.add("is-closing");
    rechargeCloseTimer = window.setTimeout(finish, 180);
  }

  function renderPending() {
    var holder = $("pending-files");
    holder.replaceChildren();
    holder.hidden = pendingFiles.length === 0;
    pendingFiles.forEach(function (file, index) {
      var chip = node("span", "file-chip", file.name + " · 待上传");
      var remove = node("button", "remove-file", "×");
      remove.type = "button";
      remove.dataset.removeFile = String(index);
      remove.setAttribute("aria-label", "取消添加 " + file.name);
      chip.appendChild(remove);
      holder.appendChild(chip);
    });
    updateSend();
  }

  function renderMessages() {
    $("drawer-messages").replaceChildren();
    var messages = conversation ? conversation.messages : [];
    $("drawer-welcome").hidden = messages.length > 0;
    messages.forEach(function (message) {
      var article = node("article", "message message-" + (message.role === "user" ? "user" : "assistant"));
      var author = message.role === "user" ? "你" : active.name + " · 示例回复";
      article.appendChild(node("div", "message-author", author));
      if (message.text) article.appendChild(node("p", "message-body", message.text));
      if (message.files.length) {
        var files = node("div", "message-files");
        message.files.forEach(function (file) { files.appendChild(node("span", "file-chip", file.name + " · 待上传")); });
        article.appendChild(files);
      }
      $("drawer-messages").appendChild(article);
    });
    window.requestAnimationFrame(function () { $("drawer-scroll").scrollTop = $("drawer-scroll").scrollHeight; });
  }

  function updateRoute() {
    var url = new URL(window.location.href);
    if (active && drawer.open) {
      url.searchParams.set("employee", active.id);
      if (conversation) url.searchParams.set("conversation", conversation.id);
      else url.searchParams.delete("conversation");
      if (activeScene) url.searchParams.set("scene", activeScene.id);
      else url.searchParams.delete("scene");
    } else {
      ["employee", "conversation", "scene"].forEach(function (key) { url.searchParams.delete(key); });
    }
    window.history.replaceState(null, "", url);
  }

  function openEmployee(employeeId, sceneId, conversationId, forceNew) {
    var employee = byId.get(employeeId);
    if (!employee) { toast("没有找到这位员工，请重新选择。"); return; }
    if (employee.published === false && (!conversationId || forceNew)) { toast("这位员工已下架，可以从工作台查看已有对话。"); return; }
    window.clearTimeout(closeTimer);
    drawer.classList.remove("is-closing");
    if (drawer.open && !saveDraft()) return;
    var scene = scenes.find(function (item) { return item.id === sceneId; }) || null;
    var next = null;
    var stash = savedViews.get(employee.id + ":" + (scene ? scene.id : ""));
    try {
      if (!forceNew && (conversationId || (stash && stash.conversationId))) {
        next = store.getConversation(conversationId || stash.conversationId);
        if (!next || next.employeeId !== employee.id || next.sceneId !== (scene ? scene.id : null)) throw new Error("对话与所选员工或场景不一致，请从历史记录重新打开。");
      } else if (!forceNew) {
        next = store.listConversations().find(function (item) {
          return !item.isExample && item.employeeId === employee.id && item.sceneId === (scene ? scene.id : null);
        }) || null;
      }
    } catch (error) { toast(error.message); return; }
    active = employee;
    activeScene = scene;
    conversation = next;
    var useStash = !forceNew && stash && stash.conversationId === (next ? next.id : null);
    input.value = useStash ? stash.draft : next ? next.draft : "";
    pendingFiles = useStash ? stash.files.slice() : [];
    $("drawer-title").textContent = employee.name;
    $("drawer-mark").textContent = employee.name.slice(0, 1);
    $("drawer-subtitle").textContent = scene ? scene.name : employee.description;
    input.disabled = employee.published === false;
    input.placeholder = employee.published === false ? "这位员工已下架，已有对话仅供查看。" : "告诉我，你想完成什么工作？";
    $("drawer-new").disabled = employee.published === false;
    $("drawer-attach").disabled = employee.published === false;
    $("drawer-intro").textContent = "你好，我是" + employee.name + "。" + (scene ? "我们可以从“" + scene.name + "”开始。" : "把需要完成的工作告诉我。" );
    $("drawer-capabilities").replaceChildren();
    employee.deliverables.forEach(function (item) { $("drawer-capabilities").appendChild(node("p", "", item)); });
    $("drawer-prompts").replaceChildren();
    var prompts = scene ? ["我想开始“" + scene.name + "”，请先帮我整理需要准备的信息。"] : ["我想请你帮我处理" + (employee.deliverables[0] || employee.description || employee.name) + "，需要先准备哪些资料？", "先了解你能帮我做什么。"];
    prompts.forEach(function (prompt) {
      var button = node("button", "prompt-chip", prompt);
      button.type = "button";
      button.dataset.prompt = prompt;
      $("drawer-prompts").appendChild(button);
    });
    clearStatus();
    hideRecharge(false);
    renderQuota();
    renderPending();
    renderMessages();
    if (!drawer.open) {
      previousFocus = document.activeElement;
      drawer.showModal();
      document.body.classList.add("drawer-open");
    }
    remember();
    updateRoute();
    input.focus({ preventScroll: true });
    if (previewQuota.remaining <= 0 && employee.published !== false) showRecharge();
  }

  function closeDrawer() {
    if (!saveDraft()) return;
    hideRecharge(false);
    remember();
    if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { drawer.close(); return; }
    drawer.classList.add("is-closing");
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function () { drawer.classList.remove("is-closing"); drawer.close(); }, 180);
  }

  function refreshOperations() {
    if (!operations) return;
    try {
      catalog = operations.getEmployees().map(function (employee) {
        var item = Object.assign({}, employee);
        if (item.image) item.image = operations.assetUrl(item.image);
        return item;
      });
      byId = new Map(catalog.map(function (employee) { return [employee.id, employee]; }));
      window.marketplaceCatalog = catalog;
      if (active && byId.has(active.id)) {
        active = byId.get(active.id);
        $("drawer-title").textContent = active.name;
        $("drawer-mark").textContent = active.name.slice(0, 1);
        $("drawer-subtitle").textContent = activeScene ? activeScene.name : active.description;
        input.disabled = active.published === false;
        input.placeholder = active.published === false ? "这位员工已下架，已有对话仅供查看。" : "告诉我，你想完成什么工作？";
        $("drawer-new").disabled = active.published === false;
        $("drawer-attach").disabled = active.published === false;
        updateSend();
      }
    } catch (error) { toast(error.message || "运营配置暂时无法读取，已保留当前页面。"); }
  }

  function renderCatalog() {
    var query = $("role-search").value.trim().toLocaleLowerCase("zh-CN");
    var employees = catalog.filter(function (employee) {
      return employee.published !== false && (category === "推荐" || employee.category === category) &&
        [employee.name, employee.category, employee.description].join(" ").toLocaleLowerCase("zh-CN").includes(query);
    });
    $("role-grid").replaceChildren();
    employees.forEach(function (employee) {
      var card = node("article", "role-card");
      card.dataset.employee = employee.id;
      var cover = node("button", "role-cover cover-" + employee.id);
      cover.type = "button";
      cover.setAttribute("aria-label", "使用" + employee.name);
      var image = node("img");
      image.src = employee.image;
      image.alt = employee.name + "工作素材";
      image.width = 64;
      image.height = 64;
      image.loading = "lazy";
      cover.appendChild(image);
      card.appendChild(cover);
      var copy = node("div", "role-info");
      var title = node("button", "role-title", employee.name);
      title.type = "button";
      title.setAttribute("title", employee.name);
      var heading = node("div", "role-heading");
      heading.appendChild(title);
      if (employee.category !== employee.name) heading.appendChild(node("span", "role-category", employee.category));
      copy.appendChild(heading);
      copy.appendChild(node("p", "role-description", employee.description));
      var actions = node("div", "role-actions");
      var trial = node("button", "button button-primary", "开始使用");
      trial.type = "button";
      trial.appendChild(node("span", "role-action-arrow", "↗"));
      actions.appendChild(trial);
      copy.appendChild(actions);
      card.appendChild(copy);
      $("role-grid").appendChild(card);
    });
    $("result-count").textContent = employees.length + " 位数字员工";
    $("empty-state").hidden = employees.length !== 0;
    $("category-filters").querySelectorAll("button").forEach(function (button) {
      var selected = button.dataset.category === category;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderScenes() {
    var query = $("scene-search") ? $("scene-search").value.trim().toLocaleLowerCase("zh-CN") : "";
    var visible = scenes.filter(function (scene) {
      var employee = byId.get(scene.employee);
      return employee && employee.published !== false && (sceneCategory === "all" || scene.category === sceneCategory) &&
        [scene.name, scene.description].join(" ").toLocaleLowerCase("zh-CN").includes(query);
    });
    $("scene-grid").replaceChildren();
    visible.forEach(function (scene) {
      var card = node("article", "scenario-card");
      card.dataset.employee = scene.employee;
      card.dataset.scene = scene.id;
      var trigger = node("button", "scenario-card-trigger");
      trigger.type = "button";
      var cover = node("span", "scenario-card-cover " + scene.imageClass);
      var image = node("img");
      image.src = scene.image;
      image.alt = "";
      image.loading = "lazy";
      cover.appendChild(image);
      trigger.appendChild(cover);
      var copy = node("span", "scenario-card-content");
      copy.appendChild(node("span", "scenario-card-title", scene.name));
      copy.appendChild(node("span", "scenario-card-description", scene.description));
      var footer = node("span", "scenario-card-footer", "开始场景");
      footer.appendChild(node("span", "scenario-card-arrow", "→"));
      copy.appendChild(footer);
      trigger.appendChild(copy);
      card.appendChild(trigger);
      $("scene-grid").appendChild(card);
    });
    if ($("scene-result-count")) $("scene-result-count").textContent = visible.length + " 个场景";
    if ($("scene-empty")) $("scene-empty").hidden = visible.length !== 0;
    document.querySelectorAll("[data-scene-category]").forEach(function (button) {
      var selected = button.dataset.sceneCategory === sceneCategory;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function employeeIcon(employeeId) {
    var drawings = {
      content: ["M5 4h9l5 5v11H5z", "M14 4v5h5M8 12h5M8 16h7"],
      design: ["m12 3 8 8-6 9H6L3 12z", "m12 3 2 8-8 9M14 11l6 0", "M10 14h.01"],
      finance: ["M4 4h16v16H4z", "M8 15v2M12 11v6M16 7v10"],
      qualification: ["M8 15 6 22l6-3 6 3-2-7", "M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14", "m9 10 2 2 4-4"],
      legal: ["M5 3h10l4 4v14H5z", "M15 3v5h4M8 12h8M8 16h5"],
      development: ["m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"],
      translation: ["M3 5h11M8 3v2M5 8c1 4 4 7 8 9M12 5c0 5-4 10-9 12", "m14 20 4-10 4 10M15.5 17h5"],
      live: ["M4 7h12v12H4z", "m9 10 4 3-4 3zM19 8c2 3 2 7 0 10M18 3l1 2M6 3l-1 2"]
    };
    var type = drawings[employeeId] ? employeeId : "content";
    var avatar = node("span", "history-avatar history-avatar--" + type);
    avatar.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    drawings[type].forEach(function (drawing) {
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", drawing);
      svg.appendChild(path);
    });
    avatar.appendChild(svg);
    return avatar;
  }

  function renderWorkspace() {
    try {
      var records = store.listConversations();
      $("workspace-total").textContent = String(records.length);
      var usage = store.getUsageSummary();
      $("workspace-token").textContent = usage.totalTokens == null ? "—" : usage.totalTokens.toLocaleString("zh-CN");
      $("workspace-quota").textContent = previewQuota.remaining.toLocaleString("zh-CN");
      $("history-list").replaceChildren();
      records.forEach(function (item) {
        var employee = byId.get(item.employeeId);
        if (!employee) return;
        var row = node("button", "history-row");
        row.type = "button";
        row.dataset.employee = item.employeeId;
        row.dataset.conversation = item.id;
        if (item.sceneId) row.dataset.scene = item.sceneId;
        var recentUserMessage = item.messages.slice().reverse().find(function (message) { return message.role === "user"; });
        var preview = item.draft.trim() || (recentUserMessage && (recentUserMessage.text.trim() || (recentUserMessage.files[0] && recentUserMessage.files[0].name))) || item.title;
        preview = preview.replace(/\s+/g, " ");
        row.setAttribute("aria-label", employee.name + "，" + preview + "，继续对话");
        row.appendChild(employeeIcon(employee.id));
        var copy = node("span", "history-copy");
        copy.appendChild(node("strong", "history-employee-name", employee.name));
        copy.appendChild(node("span", "history-preview", preview));
        var meta = node("small", "history-meta");
        meta.appendChild(node("span", "", item.isExample ? "示例对话" : item.messages.length ? "本机记录 · 未连接" : "本机草稿 · 未连接"));
        var time = node("time", "history-time", new Date(item.updatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }));
        time.setAttribute("datetime", item.updatedAt);
        meta.appendChild(time);
        copy.appendChild(meta);
        row.appendChild(copy);
        row.appendChild(node("span", "history-open", "继续 →"));
        $("history-list").appendChild(row);
      });
    } catch (error) {
      $("history-list").replaceChildren(node("p", "", error.message));
      toast(error.message);
    }
  }

  function showView(view) {
    if (!["agents", "scenes", "workspace"].includes(view)) return;
    currentView = view;
    $("marketplace-tabs").hidden = view === "workspace";
    $("workspace-heading").hidden = view !== "workspace";
    if (view !== "workspace") lastMarketView = view;
    document.querySelector(".workspace-back").dataset.view = lastMarketView;
    document.querySelectorAll("[data-view]").forEach(function (button) {
      var selected = button.dataset.view === view;
      button.classList.toggle("is-active", selected);
      if (button.getAttribute("role") === "tab") {
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      } else if (button.dataset.view === "workspace") button.setAttribute("aria-pressed", String(selected));
    });
    ["agents", "scenes", "workspace"].forEach(function (name) { $("view-" + name).hidden = name !== view; });
    $("view-description").textContent = {
      agents: "找到合适的数字员工，点开就能开始工作。",
      scenes: "从具体场景开始，把工作交给合适的数字员工。",
      workspace: "查看最近对话，继续上次的工作。"
    }[view];
    var url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
    if (view === "workspace") renderWorkspace();
    if (window.MarketplaceBanner) window.MarketplaceBanner.setView(view);
  }

  $("marketplace-tabs").addEventListener("keydown", function (event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    var tabs = Array.from(this.querySelectorAll('[role="tab"]'));
    var index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    showView(tabs[index].dataset.view);
    tabs[index].focus();
  });

  ["推荐", "内容创作", "设计", "财税", "法务", "开发", "翻译", "营销", "数据", "客服"].forEach(function (name) {
    var button = node("button", "category-chip", name);
    button.type = "button";
    button.dataset.category = name;
    $("category-filters").appendChild(button);
  });

  document.addEventListener("click", function (event) {
    var view = event.target.closest("[data-view]");
    if (view) {
      showView(view.dataset.view);
      if (view.classList.contains("workspace-back")) $("tab-" + lastMarketView).focus({ preventScroll: true });
      return;
    }
    var card = event.target.closest("[data-employee]");
    if (card) { openEmployee(card.dataset.employee, card.dataset.scene, card.dataset.conversation); return; }
    var filter = event.target.closest("[data-category]");
    if (filter) { category = filter.dataset.category; renderCatalog(); return; }
    var sceneFilter = event.target.closest("[data-scene-category]");
    if (sceneFilter) { sceneCategory = sceneFilter.dataset.sceneCategory; renderScenes(); return; }
    var prompt = event.target.closest("[data-prompt]");
    if (prompt) { input.value = prompt.dataset.prompt; updateSend(); saveDraft(); updateRoute(); input.focus(); return; }
    var remove = event.target.closest("[data-remove-file]");
    if (remove) { pendingFiles.splice(Number(remove.dataset.removeFile), 1); remember(); renderPending(); }
  });

  $("role-search").addEventListener("input", renderCatalog);
  if ($("scene-search")) $("scene-search").addEventListener("input", renderScenes);
  $("drawer-close").addEventListener("click", closeDrawer);
  $("drawer-credit-cta").addEventListener("click", showRecharge);
  $("quota-exhausted-link").addEventListener("click", showRecharge);
  $("quota-simulate-empty").addEventListener("click", simulateEmptyQuota);
  $("quota-reset").addEventListener("click", resetDemoQuota);
  $("recharge-close").addEventListener("click", function () { hideRecharge(true); });
  $("recharge-back").addEventListener("click", function () { hideRecharge(true); });
  $("recharge-panel").addEventListener("cancel", function (event) { event.preventDefault(); hideRecharge(true); });
  $("recharge-panel").addEventListener("close", function () { $("drawer-credit-cta").setAttribute("aria-expanded", "false"); });
  $("recharge-panel").addEventListener("click", function (event) {
    if (event.target !== $("recharge-panel")) return;
    var box = $("recharge-panel").getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) hideRecharge(true);
  });
  if ($("drawer-new")) $("drawer-new").addEventListener("click", function () { if (active) openEmployee(active.id, activeScene ? activeScene.id : null, null, true); });
  drawer.addEventListener("cancel", function (event) {
    event.preventDefault();
    if ($("recharge-panel").open) { hideRecharge(true); return; }
    closeDrawer();
  });
  drawer.addEventListener("close", function () {
    window.clearTimeout(closeTimer);
    drawer.classList.remove("is-closing");
    document.body.classList.remove("drawer-open");
    updateRoute();
    renderWorkspace();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  });
  drawer.addEventListener("click", function (event) {
    if (event.target !== drawer) return;
    var box = drawer.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDrawer();
  });
  input.addEventListener("compositionstart", function () { composing = true; });
  input.addEventListener("compositionend", function () { composing = false; });
  input.addEventListener("input", function () { updateSend(); saveDraft(); updateRoute(); });
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) {
      event.preventDefault();
      if (!$("drawer-send").disabled) $("drawer-form").requestSubmit();
    }
  });
  $("drawer-attach").addEventListener("click", function () { $("drawer-file").click(); });
  $("drawer-file").addEventListener("change", function () {
    Array.from(this.files || []).forEach(function (file) { pendingFiles.push({ name: file.name, size: file.size, type: file.type || "" }); });
    this.value = "";
    remember();
    renderPending();
    clearStatus();
  });
  $("drawer-form").addEventListener("submit", function (event) {
    event.preventDefault();
    if (active && active.published === false) { toast("这位员工已下架，暂时不能发起新的工作。"); return; }
    if (previewQuota.remaining <= 0) { showRecharge(); return; }
    if (!active || (!input.value.trim() && pendingFiles.length === 0) || !saveDraft()) return;
    try {
      if (!conversation) conversation = store.createConversation({ employeeId: active.id, sceneId: activeScene ? activeScene.id : null });
      conversation = store.addMessage(conversation.id, { text: input.value, files: pendingFiles });
      previewQuota.remaining = Math.max(0, previewQuota.remaining - previewQuota.perMessage);
      input.value = "";
      pendingFiles = [];
      remember();
      renderPending();
      renderMessages();
      renderQuota();
      renderWorkspace();
      clearStatus();
      updateRoute();
      if (previewQuota.remaining <= 0) showRecharge();
    } catch (error) { storageError(error); }
  });
  window.addEventListener("pagehide", function () { if (drawer.open) saveDraft(); });
  store.subscribe(function (event) {
    if (event.type === "error") { if (drawer.open) storageError(event.error); else toast(event.error.message); }
    // 不重绘正在编辑的输入，避免本机其他标签页或保存通知覆盖草稿。
    if (!$("view-workspace").hidden) renderWorkspace();
  });

  refreshOperations();
  if (operations) operations.subscribe(function (event) {
    if (event && event.type === "error") { toast(event.error && event.error.message || "运营配置暂时无法读取。"); return; }
    refreshOperations();
    renderCatalog();
    renderScenes();
    renderWorkspace();
  });
  window.EmbeddedMarketplace = { openEmployee: openEmployee, showView: showView, getView: function () { return currentView; } };
  renderCatalog();
  renderScenes();
  renderWorkspace();
  var route = new URLSearchParams(window.location.search);
  showView(route.get("view") || "agents");
  if (route.get("employee")) openEmployee(route.get("employee"), route.get("scene"), route.get("conversation"));
})();
