(function () {
  "use strict";

  var catalog = Array.isArray(window.marketplaceCatalog) ? window.marketplaceCatalog : [];
  var store = window.WorkspaceStore;
  var conversations = [];
  var conversationReadFailed = false;
  var usage = { status: "unavailable", inputTokens: null, outputTokens: null, totalTokens: null, remainingQuota: null, events: [] };
  var arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
  var chevron = '<svg class="conversation-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  var emptyIcon = '<span class="empty-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 11.5A8.5 8.5 0 0 1 11.5 20H4l-1 1v-9.5A8.5 8.5 0 1 1 20 11.5Z"/><path d="M7 9h9m-9 5h6"/></svg></span>';

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function employeeFor(id) {
    return catalog.find(function (employee) { return employee.id === id; }) || { id: id, name: "数字员工", description: "" };
  }

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function showStorageError(error) {
    var status = document.getElementById("workspace-storage-status");
    status.textContent = error && error.message ? error.message : "暂时无法读取对话记录，请保留当前浏览器数据，稍后重试。";
    status.hidden = false;
  }

  function numeric(value) {
    return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "—";
  }

  function dateLabel(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var now = new Date();
    var clock = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    var sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    return sameDay ? "今天 " + clock : date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " + clock;
  }

  function conversationUrl(conversation) {
    if (store && typeof store.chatUrl === "function") return store.chatUrl(conversation);
    return "chat.html?employee=" + encodeURIComponent(conversation.employeeId) + "&conversation=" + encodeURIComponent(conversation.id);
  }

  function conversationRow(conversation) {
    var employee = employeeFor(conversation.employeeId);
    var count = Array.isArray(conversation.messages) ? conversation.messages.length : 0;
    var title = conversation.title || (employee.name + "的新工作");
    var subtitle = conversation.draft && !count ? "草稿待继续" : count ? count + " 条消息" : "等待你的工作需求";
    return '<a class="conversation-row" href="' + escapeHTML(conversationUrl(conversation)) + '"><span class="employee-avatar" aria-hidden="true">' + escapeHTML(employee.name.charAt(0)) + '</span><div class="conversation-copy"><h3 class="conversation-title">' + escapeHTML(title) + '</h3><div class="conversation-meta"><span>' + escapeHTML(employee.name) + '</span><span>' + escapeHTML(subtitle) + '</span></div></div><time class="conversation-time numeric" datetime="' + escapeHTML(conversation.updatedAt || conversation.createdAt) + '">' + escapeHTML(dateLabel(conversation.updatedAt || conversation.createdAt)) + '</time>' + chevron + '</a>';
  }

  function emptyState(title, copy, action) {
    return '<div class="empty-state">' + emptyIcon + '<h3>' + escapeHTML(title) + '</h3><p>' + escapeHTML(copy) + '</p>' + (action ? '<a class="empty-action" href="index.html#employees">找一位数字员工 ' + arrow + '</a>' : "") + '</div>';
  }

  function renderRecent() {
    var target = document.getElementById("recent-conversations");
    if (conversationReadFailed) {
      target.innerHTML = emptyState("暂时无法读取对话", "请保留当前浏览器数据，稍后重新打开工作台。", false);
      setText("overview-conversations", "—");
      setText("overview-conversations-note", "等待对话记录恢复");
      return;
    }
    setText("overview-conversations", numeric(conversations.length));
    setText("overview-conversations-note", conversations.length ? "从最近的对话继续协作" : "每一次协作，从对话开始");
    target.innerHTML = conversations.length ? conversations.slice(0, 5).map(conversationRow).join("") : emptyState("下一项工作，从这里开始", "与数字员工开启对话后，可以随时回来接着聊。", true);
  }

  function renderHistory() {
    var query = document.getElementById("history-search").value.trim().toLocaleLowerCase();
    var employeeId = document.getElementById("history-employee").value;
    var results = conversations.filter(function (conversation) {
      if (employeeId !== "all" && employeeId !== conversation.employeeId) return false;
      var employee = employeeFor(conversation.employeeId);
      var messageText = (conversation.messages || []).map(function (message) { return message.text || ""; }).join(" ");
      return !query || [conversation.title, employee.name, messageText, conversation.draft].join(" ").toLocaleLowerCase().includes(query);
    });
    setText("history-result-count", conversationReadFailed ? "对话记录暂不可用" : numeric(results.length) + " 条对话");
    var target = document.getElementById("history-conversations");
    if (conversationReadFailed) target.innerHTML = emptyState("暂时无法读取对话", "请保留当前浏览器数据，稍后重新打开工作台。", false);
    else if (results.length) target.innerHTML = results.map(conversationRow).join("");
    else if (query || employeeId !== "all") target.innerHTML = emptyState("没有找到匹配的对话", "换个关键词，或选择其他数字员工再试试。", false);
    else target.innerHTML = emptyState("还没有开启的对话", "说说你想完成的工作，数字员工会从这里与你协作。", true);
  }

  function renderEmployees() {
    document.getElementById("start-employees").innerHTML = catalog.slice(0, 3).map(function (employee) {
      return '<a class="employee-card" href="chat.html?employee=' + encodeURIComponent(employee.id) + '"><div class="employee-image"><img src="' + escapeHTML(employee.image) + '" alt="' + escapeHTML(employee.name) + '工作素材" width="480" height="360" loading="lazy"></div><div class="employee-card-copy"><h3>' + escapeHTML(employee.name) + '</h3><p>' + escapeHTML(employee.description) + '</p>' + arrow + '</div></a>';
    }).join("");
  }

  function populateEmployees() {
    ["history-employee", "usage-employee"].forEach(function (id) {
      var select = document.getElementById(id);
      catalog.forEach(function (employee) {
        var option = document.createElement("option");
        option.value = employee.id;
        option.textContent = employee.name;
        select.appendChild(option);
      });
    });
  }

  function usageEvents() {
    var period = document.getElementById("usage-period").value;
    var employee = document.getElementById("usage-employee").value;
    var now = Date.now();
    var start = 0;
    if (period === "today") {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      start = today.getTime();
    } else if (period === "week") start = now - 7 * 86400000;
    else if (period === "month") start = now - 30 * 86400000;
    return (Array.isArray(usage.events) ? usage.events : []).filter(function (event) {
      var timestamp = new Date(event.createdAt || event.timestamp).getTime();
      return (employee === "all" || employee === event.employeeId) && (!start || timestamp >= start);
    });
  }

  function tokenValue(event, key) {
    var value = event[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function aggregate(events, key) {
    if (!events.length) return 0;
    if (events.some(function (event) { return tokenValue(event, key) == null; })) return null;
    return events.reduce(function (sum, event) { return sum + event[key]; }, 0);
  }

  function renderUsage() {
    var events = usageEvents();
    var isAvailable = usage.status === "available" || usage.status === "synced";
    var allPeriods = document.getElementById("usage-period").value === "all" && document.getElementById("usage-employee").value === "all";
    var input = isAvailable ? (allPeriods && usage.inputTokens != null ? usage.inputTokens : aggregate(events, "inputTokens")) : null;
    var output = isAvailable ? (allPeriods && usage.outputTokens != null ? usage.outputTokens : aggregate(events, "outputTokens")) : null;
    setText("overview-quota", numeric(usage.remainingQuota));
    setText("usage-quota", numeric(usage.remainingQuota));
    setText("overview-quota-note", usage.remainingQuota == null ? "等待额度同步" : "当前可用试用额度");
    setText("usage-quota-note", usage.remainingQuota == null ? "等待额度同步" : "当前可用试用额度");
    setText("overview-tokens", numeric(usage.totalTokens));
    setText("overview-token-note", usage.totalTokens == null ? "等待用量同步" : "累计输入与输出 Token");
    setText("usage-input", numeric(input));
    setText("usage-output", numeric(output));
    setText("usage-sync-status", isAvailable ? "用量已同步" : "等待用量同步");
    setText("usage-record-count", events.length ? numeric(events.length) + " 次调用" : isAvailable ? "0 次调用" : "— 次调用");
    document.getElementById("usage-rows").innerHTML = events.map(function (event) {
      var employee = employeeFor(event.employeeId);
      var conversation = conversations.find(function (item) { return item.id === event.conversationId; });
      var conversationTitle = conversation ? conversation.title || (employee.name + "的新工作") : event.conversationTitle || "—";
      var conversationCell = conversation ? '<a href="' + escapeHTML(conversationUrl(conversation)) + '">' + escapeHTML(conversationTitle) + '</a>' : escapeHTML(conversationTitle);
      var statuses = { success: "已完成", completed: "已完成", failed: "失败", running: "进行中", pending: "待处理" };
      return '<tr><td class="numeric">' + escapeHTML(event.id || event.callId || "—") + '<small>' + escapeHTML(dateLabel(event.createdAt || event.timestamp)) + '</small></td><td>' + conversationCell + '</td><td>' + escapeHTML(employee.name) + '</td><td class="numeric">' + numeric(tokenValue(event, "inputTokens")) + '</td><td class="numeric">' + numeric(tokenValue(event, "outputTokens")) + '</td><td><span class="status-chip">' + escapeHTML(statuses[event.status] || "待同步") + '</span></td></tr>';
    }).join("");
    document.getElementById("usage-empty").hidden = events.length > 0;
    setText("usage-empty-title", isAvailable ? "暂时没有符合条件的调用" : "用量记录会在这里汇集");
    setText("usage-empty-copy", isAvailable ? "调整时间或员工筛选，查看其他调用记录。" : "同步后，可按调用查看 Token 用量与关联对话。");
  }

  function refreshRecords() {
    try {
      if (!store) throw new Error("暂时无法读取对话记录，请稍后重新打开工作台。");
      conversations = store.listConversations();
      conversationReadFailed = false;
    } catch (error) {
      conversations = [];
      conversationReadFailed = true;
      showStorageError(error);
    }
    try {
      if (store) usage = store.getUsageSummary();
    } catch (error) {
      showStorageError(error);
    }
    var historyCount = document.getElementById("history-count");
    historyCount.hidden = conversationReadFailed || !conversations.length;
    historyCount.textContent = numeric(conversations.length);
    renderRecent();
    renderHistory();
    renderUsage();
  }

  function setView(shouldFocus) {
    var view = window.location.hash.slice(1);
    if (["overview", "history", "usage"].indexOf(view) < 0) {
      view = "overview";
      window.history.replaceState(null, "", window.location.pathname + window.location.search + "#overview");
    }
    document.querySelectorAll(".workspace-view").forEach(function (section) {
      section.hidden = section.id !== "view-" + view;
    });
    document.querySelectorAll("[data-view]").forEach(function (link) {
      var active = link.dataset.view === view;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = ({ overview: "我的工作台", history: "历史对话", usage: "用量与额度" }[view]) + " · AgentWan";
    if (shouldFocus) {
      document.getElementById("workspace-main").focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  populateEmployees();
  renderEmployees();
  refreshRecords();
  setView(false);
  window.addEventListener("hashchange", function () { setView(true); });
  window.addEventListener("pageshow", function (event) { if (event.persisted) refreshRecords(); });
  document.getElementById("history-search").addEventListener("input", renderHistory);
  document.getElementById("history-employee").addEventListener("change", renderHistory);
  document.getElementById("usage-period").addEventListener("change", renderUsage);
  document.getElementById("usage-employee").addEventListener("change", renderUsage);
  if (store && typeof store.subscribe === "function") {
    store.subscribe(function (event) {
      if (event && event.type === "error") showStorageError(event.error);
      else refreshRecords();
    });
  }
})();
