(function () {
  "use strict";

  var KEY = "agentwan.marketplace.operations.v1";
  var subscribers = [];
  var script = typeof document !== "undefined" ? document.currentScript : null;
  var scriptUrl = script && script.src ? script.src : new URL("admin/ops-store.js", window.location.href).href;
  var assetBase = new URL("../embedded/", scriptUrl).href;
  var originalCatalog = JSON.parse(JSON.stringify(Array.isArray(window.marketplaceCatalog) ? window.marketplaceCatalog : []));
  var counters = {
    content: [1248, 8462000], design: [936, 12840000], finance: [328, 3240000],
    qualification: [214, 1860000], legal: [486, 4680000], development: [160, 2740000],
    translation: [72, 680000], live: [36, 420000]
  };

  function problem(code, message) { var error = new Error(message); error.code = code; return error; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function record(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function identifier(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value); }
  function string(value, max) { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
  function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
  function corrupt() { return problem("OPS_CORRUPT", "运营配置格式异常，原记录已保留，请检查浏览器存储。"); }
  function imagePath(value) {
    if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f]/.test(value)) throw problem("OPS_IMAGE", "请填写有效的图片地址。");
    value = value.trim();
    if (/^data:/i.test(value)) {
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(value)) throw problem("OPS_IMAGE", "本机图片仅支持 PNG、JPEG 或 WebP。");
      if (value.length > Math.ceil(2 * 1024 * 1024 * 4 / 3) + 64) throw problem("OPS_IMAGE_SIZE", "图片请控制在 2MB 以内。");
      return value;
    }
    if (value.length > 2000) throw problem("OPS_IMAGE", "图片地址过长。");
    var url;
    try { url = new URL(value, assetBase); } catch (error) { throw problem("OPS_IMAGE", "图片地址格式不正确。"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw problem("OPS_IMAGE", "图片地址仅支持 HTTP、HTTPS 或站内相对路径。");
    return value;
  }
  function validateEmployee(employee) {
    if (!record(employee) || !identifier(employee.id) || !string(employee.name, 60) || !string(employee.category, 30) ||
      !string(employee.description, 500) || typeof employee.published !== "boolean" || typeof employee.pinned !== "boolean" ||
      !integer(employee.order) || !integer(employee.usageCount) || !integer(employee.tokenTotal) ||
      !Array.isArray(employee.deliverables) || employee.deliverables.some(function (item) { return !string(item, 200); })) throw corrupt();
    return {
      id: employee.id, name: employee.name.trim(), category: employee.category.trim(), description: employee.description.trim(),
      image: imagePath(employee.image), deliverables: employee.deliverables.slice(), published: employee.published,
      pinned: employee.pinned, order: employee.order, usageCount: employee.usageCount, tokenTotal: employee.tokenTotal
    };
  }
  function validateBanner(banner) {
    if (!record(banner) || !identifier(banner.id) || !string(banner.name, 80) || !string(banner.title, 100) ||
      typeof banner.subtitle !== "string" || banner.subtitle.length > 200 || !["agents-top", "scenes-top"].includes(banner.position) ||
      !identifier(banner.targetEmployeeId) || typeof banner.enabled !== "boolean" || !integer(banner.order)) throw corrupt();
    return {
      id: banner.id, name: banner.name.trim(), title: banner.title.trim(), subtitle: banner.subtitle.trim(), image: imagePath(banner.image),
      position: banner.position, targetEmployeeId: banner.targetEmployeeId, enabled: banner.enabled, order: banner.order
    };
  }
  function unique(items) { return new Set(items.map(function (item) { return item.id; })).size === items.length; }
  function read() {
    var raw;
    try { raw = window.localStorage.getItem(KEY); } catch (error) { throw problem("OPS_STORAGE", "浏览器无法读取运营配置，请检查存储权限。"); }
    if (raw === null) return { version: 1, employees: [], banners: null };
    var data;
    try { data = JSON.parse(raw); } catch (error) { throw corrupt(); }
    if (!record(data) || data.version !== 1 || !Array.isArray(data.employees) || !(data.banners === null || Array.isArray(data.banners))) throw corrupt();
    var employees = data.employees.map(validateEmployee);
    var banners = data.banners === null ? null : data.banners.map(validateBanner);
    if (!unique(employees) || (banners && !unique(banners))) throw corrupt();
    return { version: 1, employees: employees, banners: banners };
  }
  function announce(event) {
    subscribers.slice().forEach(function (fn) { try { fn(event); } catch (error) { if (window.console) window.console.error(error); } });
  }
  function save(data) {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (error) { throw problem("OPS_SAVE", "配置未保存，可能是本机存储已满。请保留当前修改后重试。"); }
    announce({ type: "change" });
  }
  function defaultEmployees() {
    return originalCatalog.map(function (item, index) {
      var stats = counters[item.id] || [0, 0];
      return Object.assign({}, item, { published: !["development", "translation"].includes(item.id), pinned: ["content", "design"].includes(item.id), order: index + 1, usageCount: stats[0], tokenTotal: stats[1] });
    });
  }
  function employeesFrom(data) {
    var overrides = new Map(data.employees.map(function (item) { return [item.id, item]; }));
    var defaults = defaultEmployees();
    var ids = new Set(defaults.map(function (item) { return item.id; }));
    return defaults.map(function (item) { return Object.assign({}, item, overrides.get(item.id) || {}); }).concat(data.employees.filter(function (item) { return !ids.has(item.id); }))
      .sort(function (a, b) { return Number(b.pinned) - Number(a.pinned) || a.order - b.order || a.id.localeCompare(b.id); });
  }
  function defaultBanners() {
    return [
      { id: "banner_work", name: "把下一项工作，交给数字员工", title: "把下一项工作，交给合适的数字员工。", subtitle: "从文案、设计到政策解读，点开就能开始。", image: "assets/hero.jpg", position: "agents-top", targetEmployeeId: "content", enabled: true, order: 1 },
      { id: "banner_design", name: "从想法，到一套视觉方案", title: "从一个想法，到一套视觉方案。", subtitle: "让主图、海报和品牌表达，从这里开始。", image: "assets/work-design.jpg", position: "agents-top", targetEmployeeId: "design", enabled: true, order: 2 },
      { id: "banner_policy", name: "把政策重点，整理得更清楚", title: "把政策重点，整理得更清楚。", subtitle: "梳理政策条款，整理你关心的要点。", image: "assets/work-content.jpg", position: "agents-top", targetEmployeeId: "legal", enabled: false, order: 3 }
    ];
  }
  function bannersFrom(data) { return (data.banners === null ? defaultBanners() : data.banners).slice().sort(function (a, b) { return a.order - b.order || a.id.localeCompare(b.id); }); }
  function uuid(prefix) { return prefix + "_" + (window.crypto && typeof window.crypto.randomUUID === "function" ? window.crypto.randomUUID() : Date.now().toString(36) + "_" + Math.random().toString(36).slice(2)); }
  function findEmployee(data, id) {
    var employee = employeesFrom(data).find(function (item) { return item.id === id; });
    if (!employee) throw problem("OPS_EMPLOYEE", "没有找到这位数字员工。");
    return employee;
  }
  function putEmployee(data, employee) {
    data.employees = data.employees.filter(function (item) { return item.id !== employee.id; });
    data.employees.push(validateEmployee(employee));
  }
  function checkOrder(ids, items) {
    if (!Array.isArray(ids) || ids.length !== items.length || new Set(ids).size !== ids.length || ids.some(function (id) { return !items.some(function (item) { return item.id === id; }); })) {
      throw problem("OPS_ORDER", "请在完整列表中调整并保存排序，筛选后的列表不能直接保存全局顺序。");
    }
  }

  window.MarketplaceOps = {
    getEmployees: function () { return clone(employeesFrom(read())); },
    saveEmployee: function (input) {
      if (!record(input)) throw problem("OPS_EMPLOYEE", "请填写员工信息。");
      var data = read();
      var existing = input.id ? findEmployee(data, input.id) : null;
      var employee = Object.assign({ id: uuid("employee"), image: "assets/work-content.jpg", deliverables: [], published: true, pinned: false, order: employeesFrom(data).length + 1, usageCount: 0, tokenTotal: 0 }, existing || {}, input);
      employee.id = existing ? existing.id : (employee.id || uuid("employee"));
      if (!existing && input.id) throw problem("OPS_EMPLOYEE", "新增员工请勿指定已有编号。");
      employee = validateEmployee(employee);
      putEmployee(data, employee); save(data); return clone(employee);
    },
    setPublished: function (id, published) {
      if (typeof published !== "boolean") throw problem("OPS_STATUS", "上架状态不正确。");
      var data = read(), employee = findEmployee(data, id);
      employee.published = published; putEmployee(data, employee); save(data); return clone(employee);
    },
    setPinned: function (id, pinned) {
      if (typeof pinned !== "boolean") throw problem("OPS_STATUS", "置顶状态不正确。");
      var data = read(), employee = findEmployee(data, id);
      employee.pinned = pinned; putEmployee(data, employee); save(data); return clone(employee);
    },
    saveEmployeeOrder: function (ids) {
      var data = read(), employees = employeesFrom(data);
      checkOrder(ids, employees);
      ids.forEach(function (id, index) { var employee = employees.find(function (item) { return item.id === id; }); employee.order = index + 1; putEmployee(data, employee); });
      save(data); return clone(employeesFrom(data));
    },
    getBanners: function () {
      var data = read(), employees = employeesFrom(data);
      return clone(bannersFrom(data).map(function (banner) { var target = employees.find(function (item) { return item.id === banner.targetEmployeeId; }); return Object.assign({}, banner, { targetAvailable: Boolean(target && target.published), targetName: target ? target.name : "员工已失效" }); }));
    },
    saveBanner: function (input) {
      if (!record(input)) throw problem("OPS_BANNER", "请填写 Banner 信息。");
      var data = read(), banners = bannersFrom(data);
      var existing = input.id ? banners.find(function (item) { return item.id === input.id; }) : null;
      if (input.id && !existing) throw problem("OPS_BANNER", "没有找到这条 Banner。");
      var banner = Object.assign({ id: uuid("banner"), subtitle: "", image: "assets/hero.jpg", position: "agents-top", enabled: true, order: banners.length + 1 }, existing || {}, input);
      var target = findEmployee(data, banner.targetEmployeeId);
      if (!target.published && (!existing || banner.enabled || banner.targetEmployeeId !== existing.targetEmployeeId)) throw problem("OPS_TARGET", "请选择已上架的数字员工作为跳转目标。");
      banner = validateBanner(banner);
      data.banners = banners.filter(function (item) { return item.id !== banner.id; }).concat([banner]);
      save(data); return clone(banner);
    },
    deleteBanner: function (id) {
      var data = read(), banners = bannersFrom(data);
      if (!banners.some(function (item) { return item.id === id; })) throw problem("OPS_BANNER", "没有找到这条 Banner。");
      data.banners = banners.filter(function (item) { return item.id !== id; }); save(data);
    },
    saveBannerOrder: function (ids) {
      var data = read(), banners = bannersFrom(data);
      checkOrder(ids, banners);
      data.banners = ids.map(function (id, index) { return Object.assign({}, banners.find(function (item) { return item.id === id; }), { order: index + 1 }); });
      save(data); return clone(data.banners);
    },
    subscribe: function (fn) {
      if (typeof fn !== "function") throw new TypeError("请提供有效的订阅函数。");
      subscribers.push(fn); return function () { subscribers = subscribers.filter(function (item) { return item !== fn; }); };
    },
    assetUrl: function (path) { var value = imagePath(path); return /^data:/i.test(value) ? value : new URL(value, assetBase).href; }
  };
  window.addEventListener("storage", function (event) {
    if (event.key !== KEY && event.key !== null) return;
    try { read(); announce({ type: "change" }); } catch (error) { announce({ type: "error", error: error }); }
  });
})();
