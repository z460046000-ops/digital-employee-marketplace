(function () {
  "use strict";

  var catalog = window.marketplaceCatalog || [];
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
  var scenes = window.marketplaceScenes || [];
  var originalExampleMessages = new Set();
  (window.WorkspaceExamples.conversations || []).forEach(function (item) {
    item.messages.forEach(function (message) { originalExampleMessages.add(message.id); });
  });

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
      $("drawer-status").classList.remove("is-error");
      $("drawer-status").textContent = "已保存在本机 · 未发送给数字员工";
      return true;
    } catch (error) {
      storageError(error);
      return false;
    }
  }

  function updateSend() {
    $("drawer-send").disabled = !input.value.trim() && pendingFiles.length === 0;
  }

  function renderPending() {
    var holder = $("pending-files");
    holder.replaceChildren();
    holder.hidden = pendingFiles.length === 0;
    pendingFiles.forEach(function (file, index) {
      var chip = node("span", "file-chip", file.name);
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
        message.files.forEach(function (file) { files.appendChild(node("span", "file-chip", file.name + " · 未上传")); });
        article.appendChild(files);
      }
      if (message.role === "user" && !originalExampleMessages.has(message.id)) article.appendChild(node("small", "message-state", "仅存本机 · 未发送"));
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
    $("drawer-intro").textContent = "你好，我是" + employee.name + "。" + (scene ? "我们可以从“" + scene.name + "”开始。" : "把需要完成的工作告诉我。" );
    $("drawer-capabilities").replaceChildren();
    employee.deliverables.forEach(function (item) { $("drawer-capabilities").appendChild(node("p", "", item)); });
    $("drawer-prompts").replaceChildren();
    var prompts = scene ? ["我想开始“" + scene.name + "”，请先帮我整理需要准备的信息。"] : ["我想请你帮我处理" + employee.deliverables[0] + "，需要先准备哪些资料？", "先了解你能帮我做什么。"];
    prompts.forEach(function (prompt) {
      var button = node("button", "prompt-chip", prompt);
      button.type = "button";
      button.dataset.prompt = prompt;
      $("drawer-prompts").appendChild(button);
    });
    $("drawer-status").classList.remove("is-error");
    $("drawer-status").textContent = next && next.isExample ? "示例对话 · 新输入仅保存在本机" : "当前消息保存在本机，数字员工尚未连接。";
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
  }

  function closeDrawer() {
    if (!saveDraft()) return;
    remember();
    drawer.close();
  }

  function renderCatalog() {
    var query = $("role-search").value.trim().toLocaleLowerCase("zh-CN");
    var employees = catalog.filter(function (employee) {
      return (category === "推荐" || employee.category === category) &&
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
      image.width = 480;
      image.height = 360;
      image.loading = "lazy";
      cover.appendChild(image);
      card.appendChild(cover);
      var copy = node("div", "role-info");
      var title = node("button", "role-title", employee.name);
      title.type = "button";
      copy.appendChild(title);
      copy.appendChild(node("p", "role-description", employee.description));
      var price = node("p", "role-price");
      price.appendChild(node("span", "currency", "¥"));
      price.appendChild(document.createTextNode(String(employee.price)));
      price.appendChild(node("span", "unit", "/" + employee.unit));
      copy.appendChild(price);
      var actions = node("div", "role-actions");
      var trial = node("button", "button button-primary", "免费试用");
      trial.type = "button";
      actions.appendChild(trial);
      var purchase = node("button", "button button-secondary", "购买");
      purchase.type = "button";
      purchase.dataset.purchase = employee.id;
      actions.appendChild(purchase);
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
      return (sceneCategory === "all" || scene.category === sceneCategory) &&
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
      copy.appendChild(node("span", "scenario-card-footer", "开始使用 →"));
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

  function renderWorkspace() {
    try {
      var records = store.listConversations();
      $("workspace-total").textContent = String(records.length);
      var usage = store.getUsageSummary();
      $("workspace-token").textContent = usage.totalTokens == null ? "—" : usage.totalTokens.toLocaleString("zh-CN");
      $("workspace-quota").textContent = usage.remainingQuota == null ? "—" : usage.remainingQuota.toLocaleString("zh-CN");
      $("history-list").replaceChildren();
      records.forEach(function (item) {
        var employee = byId.get(item.employeeId);
        if (!employee) return;
        var row = node("button", "history-row");
        row.type = "button";
        row.dataset.employee = item.employeeId;
        row.dataset.conversation = item.id;
        if (item.sceneId) row.dataset.scene = item.sceneId;
        row.appendChild(node("strong", "", item.title));
        row.appendChild(node("small", "", employee.name + " · " + (item.isExample ? "示例对话" : item.messages.length ? "本机记录 · 未连接" : "本机草稿")));
        row.appendChild(node("span", "", "继续对话 →"));
        $("history-list").appendChild(row);
      });
    } catch (error) {
      $("history-list").replaceChildren(node("p", "", error.message));
      toast(error.message);
    }
  }

  function showView(view) {
    if (!["agents", "scenes", "workspace"].includes(view)) return;
    $("marketplace-tabs").hidden = view === "workspace";
    $("workspace-heading").hidden = view !== "workspace";
    document.querySelectorAll("[data-view]").forEach(function (button) {
      var selected = button.dataset.view === view;
      button.classList.toggle("is-active", selected);
      if (button.getAttribute("role") === "tab") {
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      } else button.setAttribute("aria-pressed", String(selected));
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
    var purchase = event.target.closest("[data-purchase]");
    if (purchase) { toast("购买暂未开放，可以先免费试用。"); return; }
    var view = event.target.closest("[data-view]");
    if (view) { showView(view.dataset.view); return; }
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
  if ($("drawer-new")) $("drawer-new").addEventListener("click", function () { if (active) openEmployee(active.id, activeScene ? activeScene.id : null, null, true); });
  drawer.addEventListener("cancel", function (event) { event.preventDefault(); closeDrawer(); });
  drawer.addEventListener("close", function () {
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
    $("drawer-status").textContent = "已添加文件名，文件内容尚未上传；刷新后需重新选择附件。";
  });
  $("drawer-form").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!active || (!input.value.trim() && pendingFiles.length === 0) || !saveDraft()) return;
    try {
      if (!conversation) conversation = store.createConversation({ employeeId: active.id, sceneId: activeScene ? activeScene.id : null });
      conversation = store.addMessage(conversation.id, { text: input.value, files: pendingFiles });
      input.value = "";
      pendingFiles = [];
      remember();
      renderPending();
      renderMessages();
      $("drawer-status").textContent = "消息已保存在本机，数字员工尚未连接。";
      updateRoute();
    } catch (error) { storageError(error); }
  });
  window.addEventListener("pagehide", function () { if (drawer.open) saveDraft(); });
  store.subscribe(function (event) {
    if (event.type === "error") { if (drawer.open) storageError(event.error); else toast(event.error.message); }
    // 不重绘正在编辑的输入，避免本机其他标签页或保存通知覆盖草稿。
    if (!$("view-workspace").hidden) renderWorkspace();
  });

  renderCatalog();
  renderScenes();
  renderWorkspace();
  var route = new URLSearchParams(window.location.search);
  showView(route.get("view") || "agents");
  if (route.get("employee")) openEmployee(route.get("employee"), route.get("scene"), route.get("conversation"));
})();
