(function () {
  "use strict";

  var STORAGE_KEY = "agentwan.marketplace.workspace.v1";
  var subscribers = [];
  var sequence = 0;

  function failure(code, message, cause) {
    var error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isDate(value) {
    if (typeof value !== "string") return false;
    var date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString() === value;
  }

  function isIdentifier(value) {
    return typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
  }

  function invalidData() {
    return failure("WORKSPACE_STORAGE_CORRUPT", "本机对话记录格式异常，暂时无法读取或保存。原有记录已保留，请先检查浏览器存储。");
  }

  function validateFile(file) {
    if (!isRecord(file) || typeof file.name !== "string" || !file.name ||
      !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.type !== "string") throw invalidData();
    return { name: file.name, size: file.size, type: file.type };
  }

  function validateMessage(message) {
    if (!isRecord(message) || !isIdentifier(message.id) || message.role !== "user" ||
      typeof message.text !== "string" || !Array.isArray(message.files) || !isDate(message.createdAt)) throw invalidData();
    var files = message.files.map(validateFile);
    if (!message.text.trim() && !files.length) throw invalidData();
    return { id: message.id, role: "user", text: message.text, files: files, createdAt: message.createdAt };
  }

  function validateConversation(conversation) {
    if (!isRecord(conversation) || !isIdentifier(conversation.id) || !isIdentifier(conversation.employeeId) ||
      !(conversation.sceneId === null || isIdentifier(conversation.sceneId)) || typeof conversation.title !== "string" ||
      !conversation.title.trim() || !isDate(conversation.createdAt) || !isDate(conversation.updatedAt) ||
      conversation.updatedAt < conversation.createdAt || !Array.isArray(conversation.messages) ||
      typeof conversation.draft !== "string" || ["draft", "unconnected"].indexOf(conversation.status) < 0) throw invalidData();
    var messages = conversation.messages.map(validateMessage);
    var messageIds = new Set(messages.map(function (message) { return message.id; }));
    if (messageIds.size !== messages.length) throw invalidData();
    return {
      id: conversation.id, employeeId: conversation.employeeId, sceneId: conversation.sceneId,
      title: conversation.title, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt,
      messages: messages, draft: conversation.draft, status: conversation.status
    };
  }

  function read() {
    var raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      throw failure("WORKSPACE_STORAGE_UNAVAILABLE", "浏览器无法读取本机对话记录，请检查存储权限。", error);
    }
    if (raw === null) return { version: 1, conversations: [] };
    var data;
    try { data = JSON.parse(raw); } catch (error) { throw invalidData(); }
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.conversations)) throw invalidData();
    var conversations = data.conversations.map(validateConversation);
    var ids = new Set(conversations.map(function (conversation) { return conversation.id; }));
    if (ids.size !== conversations.length) throw invalidData();
    return { version: 1, conversations: conversations };
  }

  function announce(event) {
    subscribers.slice().forEach(function (subscriber) {
      try { subscriber(event); } catch (error) {
        if (window.console && window.console.error) window.console.error("工作台状态订阅处理失败", error);
      }
    });
  }

  function save(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      throw failure("WORKSPACE_STORAGE_WRITE_FAILED", "对话未能保存，可能是本机存储已满或未获得存储权限。请保留当前输入后重试。", error);
    }
    announce({ type: "change" });
  }

  function id(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return prefix + "_" + window.crypto.randomUUID();
    sequence += 1;
    return prefix + "_" + Date.now().toString(36) + "_" + sequence.toString(36) + "_" + Math.random().toString(36).slice(2, 12);
  }

  function find(data, conversationId) {
    var conversation = data.conversations.find(function (item) { return item.id === conversationId; });
    if (!conversation) throw failure("WORKSPACE_CONVERSATION_NOT_FOUND", "没有找到这条对话，请从历史对话中重新选择。");
    return conversation;
  }

  function activityTime(conversation) {
    return new Date(Math.max(Date.now(), Date.parse(conversation.updatedAt))).toISOString();
  }

  function titleFor(text) {
    var characters = Array.from(text.replace(/\s+/g, " ").trim());
    return characters.slice(0, 30).join("") + (characters.length > 30 ? "…" : "");
  }

  window.WorkspaceStore = {
    listConversations: function () {
      return read().conversations.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    },

    getConversation: function (conversationId) {
      return read().conversations.find(function (item) { return item.id === conversationId; }) || null;
    },

    createConversation: function (options) {
      options = options || {};
      if (!isIdentifier(options.employeeId)) throw failure("WORKSPACE_INVALID_EMPLOYEE", "请先选择一位数字员工。");
      var catalog = window.marketplaceCatalog;
      if (Array.isArray(catalog) && !catalog.some(function (employee) { return employee.id === options.employeeId; })) {
        throw failure("WORKSPACE_INVALID_EMPLOYEE", "没有找到这位数字员工，请从集市重新选择。");
      }
      var sceneId = options.sceneId || null;
      if (sceneId !== null && !isIdentifier(sceneId)) throw failure("WORKSPACE_INVALID_SCENE", "场景信息不正确，请重新选择。");
      var data = read();
      var now = new Date().toISOString();
      var conversation = {
        id: id("conversation"), employeeId: options.employeeId, sceneId: sceneId,
        title: "新对话", createdAt: now, updatedAt: now, messages: [], draft: "", status: "draft"
      };
      data.conversations.push(conversation);
      save(data);
      return copy(conversation);
    },

    addMessage: function (conversationId, options) {
      options = options || {};
      if (options.text != null && typeof options.text !== "string") throw failure("WORKSPACE_INVALID_MESSAGE", "消息内容格式不正确。");
      if (options.files != null && !Array.isArray(options.files)) throw failure("WORKSPACE_INVALID_MESSAGE", "附件信息格式不正确。");
      var text = (options.text || "").trim();
      var files = (options.files || []).map(function (file) {
        if (!file || typeof file.name !== "string" || !file.name || !Number.isSafeInteger(file.size) || file.size < 0 ||
          (file.type != null && typeof file.type !== "string")) throw failure("WORKSPACE_INVALID_MESSAGE", "附件信息格式不正确。");
        return { name: file.name, size: file.size, type: file.type || "" };
      });
      if (!text && !files.length) throw failure("WORKSPACE_EMPTY_MESSAGE", "先输入工作需求，或添加参考文件。");
      var data = read();
      var conversation = find(data, conversationId);
      if (text && !conversation.messages.some(function (message) { return Boolean(message.text.trim()); })) {
        conversation.title = titleFor(text);
      } else if (!conversation.messages.length && files.length) {
        conversation.title = titleFor(files[0].name);
      }
      var now = activityTime(conversation);
      conversation.messages.push({ id: id("message"), role: "user", text: text, files: files, createdAt: now });
      conversation.updatedAt = now;
      conversation.status = "unconnected";
      conversation.draft = "";
      save(data);
      return copy(conversation);
    },

    setDraft: function (conversationId, text) {
      if (typeof text !== "string") throw failure("WORKSPACE_INVALID_DRAFT", "草稿内容格式不正确。");
      var data = read();
      var conversation = find(data, conversationId);
      if (conversation.draft === text) return copy(conversation);
      conversation.draft = text;
      conversation.updatedAt = activityTime(conversation);
      save(data);
      return copy(conversation);
    },

    subscribe: function (subscriber) {
      if (typeof subscriber !== "function") throw new TypeError("订阅回调必须是函数。");
      subscribers.push(subscriber);
      return function () { subscribers = subscribers.filter(function (item) { return item !== subscriber; }); };
    },

    chatUrl: function (conversation) {
      if (!conversation || !isIdentifier(conversation.id) || !isIdentifier(conversation.employeeId) ||
        (conversation.sceneId != null && !isIdentifier(conversation.sceneId))) throw failure("WORKSPACE_INVALID_CONVERSATION", "对话信息不完整。");
      return "chat.html?employee=" + encodeURIComponent(conversation.employeeId) + "&conversation=" + encodeURIComponent(conversation.id) +
        (conversation.sceneId ? "&scene=" + encodeURIComponent(conversation.sceneId) : "");
    },

    getUsageSummary: function () {
      return { status: "unavailable", inputTokens: null, outputTokens: null, totalTokens: null, remainingQuota: null, usedQuota: null, events: [] };
    }
  };

  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try {
      read();
      announce({ type: "change" });
    } catch (error) {
      announce({ type: "error", error: error });
    }
  });
})();
