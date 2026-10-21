(function () {
  "use strict";

  var catalog = Array.isArray(window.marketplaceCatalog) ? window.marketplaceCatalog : [];
  var store = window.WorkspaceStore;
  var params = new URLSearchParams(window.location.search);
  var conversation = null;
  var initialStorageError = null;
  if (params.get("conversation") && store) {
    try { conversation = store.getConversation(params.get("conversation")); }
    catch (error) { initialStorageError = error; }
  }
  if (conversation) {
    params.set("employee", conversation.employeeId);
    if (conversation.sceneId) params.set("scene", conversation.sceneId);
    else params.delete("scene");
  }
  var requestedEmployee = params.get("employee");
  var employee = catalog.find(function (item) { return item.id === requestedEmployee; }) || catalog[0];
  if (!employee) return;

  var profiles = {
    content: { mark: "文", preparation: "内容主题、面向的人群、发布渠道，以及已有的产品或品牌资料", prompts: ["我想准备一份短视频脚本，请先帮我梳理需要提供的资料。", "我想为一款产品写电商文案，需要先明确哪些信息？"], labels: ["准备一份短视频脚本", "开始一份电商文案"] },
    design: { mark: "设", preparation: "设计用途、使用尺寸、文案，以及可以参考的品牌素材", prompts: ["我需要设计一张电商主图，可以先帮我整理要准备的资料吗？", "我想做一张活动海报，需要先明确哪些要求？"], labels: ["准备电商主图需求", "整理活动海报要求"] },
    finance: { mark: "财", preparation: "需要处理的记账或报表工作，以及相关账目、发票资料的范围", prompts: ["我想整理本月的发票，请先帮我梳理需要准备的资料。", "我需要一份财务报表，可以先明确工作范围吗？"], labels: ["梳理发票资料", "明确报表工作范围"] },
    qualification: { mark: "资", preparation: "准备申报的资质名称、条件要求，以及已有的材料清单", prompts: ["我想准备一项资质申报，可以先整理材料清单吗？", "我已有一份资质条件说明，想逐条理解需要哪些资料。"], labels: ["整理申报材料清单", "梳理申报条件"] },
    legal: { mark: "策", preparation: "政策原文、文件出处、希望理解的条款，以及关注的问题", prompts: ["我有一份政策文件，想先梳理其中的重点。", "我想理解一项政策条款，可以先明确需要提供的信息吗？"], labels: ["梳理政策文件重点", "理解一项具体条款"] },
    development: { mark: "开", preparation: "页面目标、功能要求、已有设计，以及需要对接的接口资料", prompts: ["我想做一个落地页，先帮我梳理需要确认的功能。", "我有一个小程序页面需求，可以先整理页面与接口范围吗？"], labels: ["梳理落地页需求", "明确页面与接口范围"] },
    translation: { mark: "译", preparation: "原文、目标语言、使用场景，以及需要保留的专业术语", prompts: ["我有一份商务文档需要翻译，先明确需要哪些资料。", "我想准备多语种字幕，可以先整理翻译要求吗？"], labels: ["准备商务文档翻译", "整理字幕翻译要求"] },
    live: { mark: "播", preparation: "直播主题、介绍的产品、面向的人群，以及已有的流程安排", prompts: ["我想准备一场直播，先帮我整理脚本需要的信息。", "我需要直播话术卡和场控清单，可以先明确工作范围吗？"], labels: ["准备直播脚本需求", "整理话术与场控范围"] }
  };
  var profile = profiles[employee.id] || profiles.content;
  var messages = document.getElementById("messages");
  var scrollArea = document.getElementById("message-scroll");
  var form = document.getElementById("message-form");
  var input = document.getElementById("message-input");
  var fileInput = document.getElementById("file-input");
  var pendingFiles = [];
  var sentFiles = [];
  var requirementTexts = [];
  var toastTimer;
  var capabilityDialog = document.getElementById("capability-dialog");
  var capabilityTrigger = document.getElementById("show-capabilities");
  var contextPanel = document.getElementById("context-panel");
  var contextToggle = document.getElementById("context-toggle");
  var draftTimer;
  var historyPanel = document.getElementById("recent-panel");
  var historyToggle = document.getElementById("history-toggle");

  function textElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function fileIcon() {
    var wrapper = document.createElement("span");
    wrapper.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>';
    return wrapper.firstElementChild;
  }

  function notify(message) {
    var toast = document.getElementById("chat-toast");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function () { toast.hidden = true; }, 4200);
  }

  function updateComposer() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, window.innerWidth < 600 ? 130 : 180) + "px";
    document.getElementById("send-message").disabled = !input.value.trim() && pendingFiles.length === 0;
  }

  function updatePendingFiles() {
    var holder = document.getElementById("pending-files");
    holder.replaceChildren();
    holder.hidden = pendingFiles.length === 0;
    pendingFiles.forEach(function (file, index) {
      var chip = textElement("div", "pending-file");
      chip.appendChild(textElement("span", "", file.name));
      var remove = textElement("button", "remove-file");
      remove.type = "button";
      remove.dataset.removeFile = String(index);
      remove.setAttribute("aria-label", "取消添加 " + file.name);
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
      chip.appendChild(remove);
      holder.appendChild(chip);
    });
    updateComposer();
  }

  function updateReferences() {
    var holder = document.getElementById("reference-files");
    holder.replaceChildren();
    document.getElementById("file-count").textContent = sentFiles.length + " 个";
    if (sentFiles.length === 0) holder.appendChild(textElement("p", "empty-copy", "还没有添加参考文件。"));
    sentFiles.forEach(function (file) {
      var row = textElement("div", "reference-file");
      row.appendChild(fileIcon());
      var copy = textElement("span", "", file.name);
      copy.appendChild(textElement("small", "", "待连接"));
      row.appendChild(copy);
      holder.appendChild(row);
    });
  }

  function updateRequirement() {
    var holder = document.getElementById("requirement-original");
    holder.replaceChildren();
    requirementTexts.forEach(function (text) { holder.appendChild(textElement("p", "", text)); });
    if (requirementTexts.length === 0) holder.appendChild(textElement("p", "empty-copy", "还没有填写工作需求。"));
    var state = document.getElementById("requirement-status");
    state.textContent = requirementTexts.length ? "已填写" : "待补充";
    state.classList.toggle("has-requirement", requirementTexts.length > 0);
  }

  function appendMessage(sender, text, files, isExampleHistory) {
    var article = textElement("article", "message " + (sender === "user" ? "message-user" : "message-assistant"));
    var meta = textElement("div", "message-meta");
    meta.appendChild(textElement("span", "message-author", sender === "user" ? "你" : employee.name));
    if (sender === "user" && !isExampleHistory) meta.appendChild(textElement("span", "message-local-state", "未发送"));
    article.appendChild(meta);
    if (text) {
      var body = textElement("div", "message-content");
      body.appendChild(textElement("p", "", text));
      article.appendChild(body);
    }
    if (files && files.length) {
      var list = textElement("div", "message-files");
      files.forEach(function (file) {
        var chip = textElement("span", "message-file");
        chip.appendChild(fileIcon());
        chip.appendChild(textElement("span", "", file.name));
        list.appendChild(chip);
      });
      article.appendChild(list);
    }
    messages.appendChild(article);
  }

  function scrollToLatest() {
    window.requestAnimationFrame(function () {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }

  function updateProfile() {
    var scenarioNames = { marketing: "AI营销视频生成", reports: "AI生成汇报", images: "AI生成图片", templates: "名片、喜报与排行榜", custom: "自定义协作场景" };
    var scenarioName = scenarioNames[params.get("scene")];
    document.title = (scenarioName || employee.name) + " · AgentWan";
    if (scenarioName) document.querySelector(".eyebrow").textContent = scenarioName;
    if (conversation && conversation.isExample) document.querySelector(".eyebrow").textContent = "示例对话" + (scenarioName ? " · " + scenarioName : "");
    document.getElementById("employee-name").textContent = employee.name;
    document.getElementById("employee-mark").textContent = profile.mark;
    document.getElementById("welcome-author").textContent = employee.name;
    document.getElementById("member-name").textContent = employee.name;
    document.getElementById("member-avatar").textContent = profile.mark;
    document.getElementById("welcome-message").textContent = "告诉我你希望完成的工作，以及手头已有的资料。可以先提供" + profile.preparation + "。";
    document.getElementById("back-to-marketplace").href = "index.html?employee=" + encodeURIComponent(employee.id) + "#employees";
    document.getElementById("new-conversation").href = "chat.html?employee=" + encodeURIComponent(employee.id) + (params.get("scene") ? "&scene=" + encodeURIComponent(params.get("scene")) : "");
    var prompts = document.getElementById("starter-prompts");
    prompts.replaceChildren();
    profile.prompts.forEach(function (prompt, index) {
      var button = textElement("button", "", profile.labels[index]);
      button.type = "button";
      button.dataset.prompt = prompt;
      var icon = document.createElement("span");
      icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>';
      button.appendChild(icon.firstElementChild);
      prompts.appendChild(button);
    });
  }

  function populateCapabilities() {
    var holder = document.getElementById("capability-body");
    holder.replaceChildren();
    var title = textElement("h2", "", employee.name);
    title.id = "capability-title";
    title.tabIndex = -1;
    holder.appendChild(title);
    holder.appendChild(textElement("p", "capability-description", employee.description));
    var columns = textElement("div", "capability-columns");
    var scope = textElement("section", "capability-section");
    scope.appendChild(textElement("h3", "", "可以协助的工作"));
    var list = textElement("ul");
    employee.deliverables.forEach(function (item) { list.appendChild(textElement("li", "", item)); });
    scope.appendChild(list);
    var price = textElement("div", "capability-price");
    price.appendChild(textElement("span", "", "服务参考价"));
    price.appendChild(textElement("strong", "", "¥" + employee.price + " / " + employee.unit));
    scope.appendChild(price);
    columns.appendChild(scope);
    var preparation = textElement("section", "capability-section capability-preparation");
    preparation.appendChild(textElement("h3", "", "开始前可以准备"));
    preparation.appendChild(textElement("p", "", profile.preparation + "。"));
    preparation.appendChild(textElement("p", "preparation-note", "可以先描述一项具体工作，资料不完整时再继续补充。"));
    columns.appendChild(preparation);
    holder.appendChild(columns);
  }

  document.getElementById("starter-prompts").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-prompt]");
    if (!button) return;
    input.value = button.dataset.prompt;
    updateComposer();
    input.focus();
  });

  function saveDraft() {
    window.clearTimeout(draftTimer);
    if (!store || (!conversation && !input.value.trim())) return;
    try {
      if (!conversation) {
        conversation = store.createConversation({ employeeId: employee.id, sceneId: params.get("scene") || "" });
        window.history.replaceState(null, "", store.chatUrl(conversation));
      }
      conversation = store.setDraft(conversation.id, input.value);
      renderRecent();
    }
    catch (error) { storageFailed(error); }
  }
  input.addEventListener("input", function () {
    updateComposer();
    if (!conversation && input.value.trim()) { saveDraft(); return; }
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, 400);
  });
  window.addEventListener("pagehide", saveDraft);
  window.addEventListener("pageshow", function (event) { if (event.persisted) renderRecent(); });
  document.addEventListener("click", function (event) {
    if (event.target.closest("a[href]")) saveDraft();
  }, true);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });

  document.getElementById("choose-files").addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    Array.from(fileInput.files || []).forEach(function (file) {
      if (!pendingFiles.some(function (existing) { return existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified; })) {
        pendingFiles.push(file);
      }
    });
    fileInput.value = "";
    updatePendingFiles();
    input.focus();
  });
  document.getElementById("pending-files").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-remove-file]");
    if (!button) return;
    pendingFiles.splice(Number(button.dataset.removeFile), 1);
    updatePendingFiles();
    input.focus();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    var files = pendingFiles.slice();
    if (!text && !files.length) {
      notify("先输入工作需求，或添加参考文件。");
      input.focus();
      return;
    }
    try {
      if (!store) throw new Error("工作记录暂时无法保存，请稍后重试。");
      window.clearTimeout(draftTimer);
      if (!conversation) conversation = store.createConversation({ employeeId: employee.id, sceneId: params.get("scene") || "" });
      conversation = store.addMessage(conversation.id, { text: text, files: files });
      store.setDraft(conversation.id, "");
      window.history.replaceState(null, "", store.chatUrl(conversation));
    } catch (error) {
      storageFailed(error);
      return;
    }
    appendMessage("user", text, files);
    document.querySelector(".message-assistant").hidden = true;
    if (text) requirementTexts.push(text);
    files.forEach(function (file) {
      if (!sentFiles.some(function (existing) { return existing.name === file.name && existing.size === file.size; })) sentFiles.push(file);
    });
    input.value = "";
    pendingFiles = [];
    updatePendingFiles();
    updateRequirement();
    updateReferences();
    renderRecent();
    notify("已保存到工作记录，数字员工暂未连接。");
    scrollToLatest();
    input.focus();
  });

  capabilityTrigger.addEventListener("click", function () {
    populateCapabilities();
    capabilityDialog.showModal();
    document.getElementById("capability-title").focus();
  });
  document.getElementById("close-capabilities").addEventListener("click", function () { capabilityDialog.close(); });
  capabilityDialog.addEventListener("close", function () { capabilityTrigger.focus(); });
  capabilityDialog.addEventListener("click", function (event) {
    if (event.target !== capabilityDialog) return;
    var box = capabilityDialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) capabilityDialog.close();
  });

  function setContextOpen(open) {
    contextPanel.classList.toggle("is-open", open);
    contextToggle.setAttribute("aria-expanded", String(open));
    if (open) document.getElementById("close-context").focus();
    else contextToggle.focus();
  }
  contextToggle.addEventListener("click", function () { setContextOpen(!contextPanel.classList.contains("is-open")); });
  document.getElementById("close-context").addEventListener("click", function () { setContextOpen(false); });

  function storageFailed(error) {
    var message = error && error.message ? error.message : "工作记录暂时无法读取。";
    document.getElementById("history-storage-state").textContent = message;
    notify(message);
  }

  function renderRecent() {
    var holder = document.getElementById("recent-conversations");
    holder.replaceChildren();
    try {
      var recent = store ? store.listConversations().filter(function (item) { return item.messages.length || item.draft.trim(); }).slice(0, 12) : [];
      if (!recent.length) holder.appendChild(textElement("p", "recent-empty", "开始一项工作后，在这里继续。"));
      recent.forEach(function (item) {
        var role = catalog.find(function (entry) { return entry.id === item.employeeId; });
        var link = textElement("a", "recent-conversation");
        link.href = store.chatUrl(item);
        if (conversation && conversation.id === item.id) { link.classList.add("is-current"); link.setAttribute("aria-current", "page"); }
        link.appendChild(textElement("strong", "", item.messages.length ? item.title : (item.draft.trim().slice(0, 30) || "新对话")));
        link.appendChild(textElement("span", "", (role ? role.name : "数字员工") + " · " + new Date(item.updatedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })));
        holder.appendChild(link);
      });
    } catch (error) {
      holder.appendChild(textElement("p", "recent-empty", "暂时无法读取工作记录。"));
      storageFailed(error);
    }
  }

  function restoreConversation() {
    if (!conversation) return;
    if (conversation.messages.length) document.querySelector(".message-assistant").hidden = true;
    conversation.messages.forEach(function (message) {
      appendMessage(message.role, message.text, message.files, conversation.isExample);
      if (message.text && message.role === "user") requirementTexts.push(message.text);
      message.files.forEach(function (file) {
        if (!sentFiles.some(function (entry) { return entry.name === file.name && entry.size === file.size; })) sentFiles.push(file);
      });
    });
    input.value = conversation.draft;
    updateRequirement();
    updateReferences();
    if (conversation.messages.length) scrollToLatest();
  }

  function setHistoryOpen(open) {
    historyPanel.classList.toggle("is-open", open);
    historyToggle.setAttribute("aria-expanded", String(open));
    historyToggle.setAttribute("aria-label", open ? "收起最近对话" : "展开最近对话");
    if (open) document.getElementById("close-history").focus();
    else historyToggle.focus();
  }
  historyToggle.addEventListener("click", function () { setHistoryOpen(!historyPanel.classList.contains("is-open")); });
  document.getElementById("close-history").addEventListener("click", function () { setHistoryOpen(false); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && historyPanel.classList.contains("is-open")) setHistoryOpen(false);
  });
  if (store) store.subscribe(function (event) {
    if (event.type === "error") storageFailed(event.error);
    else renderRecent();
  });

  updateProfile();
  restoreConversation();
  renderRecent();
  updateComposer();
  if (initialStorageError) storageFailed(initialStorageError);
  else if (params.get("conversation") && !conversation) notify("当前浏览器中没有这条对话，可以发起新的工作。");
  if (requestedEmployee && !catalog.some(function (item) { return item.id === requestedEmployee; })) notify("没有找到指定员工，已打开内容创作试用对话。");
})();
