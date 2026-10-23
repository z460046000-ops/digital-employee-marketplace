(function () {
  "use strict";
  var ops = window.MarketplaceOps;
  var state = { view: "employees", employees: [], banners: [], employeeOrder: [], bannerOrder: [], employeeDirty: false, bannerDirty: false, status: "all", drag: null };
  var saving = false;
  var toastTimer;
  var confirmResolver;
  var lastDialogTrigger;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function $(id) { return document.getElementById(id); }
  function escape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function numeric(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString("zh-CN") : "—"; }
  function asset(path) { try { return ops.assetUrl(path); } catch (error) { return "../embedded/assets/work-content.jpg"; } }
  function toast(message) { window.clearTimeout(toastTimer); $("admin-toast").textContent = message; $("admin-toast").hidden = false; toastTimer = window.setTimeout(function () { $("admin-toast").hidden = true; }, 3600); }
  function errorMessage(error) { return error && error.message ? error.message : "操作未能保存，请稍后再试。"; }
  function pageError(error) { $("page-error").textContent = errorMessage(error); $("page-error").hidden = false; }
  function employeeFor(id) { return state.employees.find(function (item) { return item.id === id; }); }
  function list(kind) { return kind === "employees" ? state.employees : state.banners; }
  function orderKey(kind) { return kind === "employees" ? "employeeOrder" : "bannerOrder"; }
  function dirtyKey(kind) { return kind === "employees" ? "employeeDirty" : "bannerDirty"; }
  function ordered(kind) {
    var records = list(kind), ids = state[orderKey(kind)];
    return ids.map(function (id) { return records.find(function (item) { return item.id === id; }); }).filter(Boolean);
  }
  function preserveOrder(previous, records) { var ids = records.map(function (record) { return record.id; }); return previous.filter(function (id) { return ids.includes(id); }).concat(ids.filter(function (id) { return !previous.includes(id); })); }
  function refresh() {
    try {
      state.employees = ops.getEmployees();
      state.banners = ops.getBanners();
      state.employeeOrder = state.employeeDirty ? preserveOrder(state.employeeOrder, state.employees) : state.employees.map(function (item) { return item.id; });
      state.bannerOrder = state.bannerDirty ? preserveOrder(state.bannerOrder, state.banners) : state.banners.map(function (item) { return item.id; });
      $("page-error").hidden = true;
      renderCategoryOptions(); renderEmployees(); renderBanners();
      if (window.AdminBilling) { window.AdminBilling.refreshEmployees(); window.AdminBilling.render(); }
    } catch (error) { pageError(error); }
  }
  function renderCategoryOptions() {
    var previous = $("employee-category").value || "all";
    var categories = Array.from(new Set(state.employees.map(function (item) { return item.category; }))).sort(function (a, b) { return a.localeCompare(b, "zh-CN"); });
    $("employee-category").innerHTML = '<option value="all">全部分类</option>' + categories.map(function (category) { return '<option value="' + escape(category) + '">' + escape(category) + '</option>'; }).join("");
    $("employee-category").value = categories.includes(previous) ? previous : "all";
    $("employee-category-options").innerHTML = categories.map(function (category) { return '<option value="' + escape(category) + '"></option>'; }).join("");
  }
  function employeeFiltered() { return Boolean($("employee-search").value.trim() || $("employee-category").value !== "all" || state.status !== "all"); }
  function bannerFiltered() { return Boolean($("banner-search").value.trim() || $("banner-position").value !== "all" || $("banner-status").value !== "all"); }
  function dragControls(kind, item, enabled) {
    return '<div class="drag-controls"><button type="button" class="drag-handle" draggable="' + enabled + '" data-drag="' + kind + '" aria-label="拖动排序 ' + escape(item.name) + '"' + (enabled ? '' : ' disabled') + '><svg viewBox="0 0 12 20" aria-hidden="true"><circle cx="3" cy="4" r="1.3"/><circle cx="9" cy="4" r="1.3"/><circle cx="3" cy="10" r="1.3"/><circle cx="9" cy="10" r="1.3"/><circle cx="3" cy="16" r="1.3"/><circle cx="9" cy="16" r="1.3"/></svg></button><span class="sort-accessible"><button type="button" data-move="up" data-kind="' + kind + '" aria-label="上移 ' + escape(item.name) + '"' + (enabled ? '' : ' disabled') + '>↑</button><button type="button" data-move="down" data-kind="' + kind + '" aria-label="下移 ' + escape(item.name) + '"' + (enabled ? '' : ' disabled') + '>↓</button></span></div>';
  }
  function renderEmployees() {
    var query = $("employee-search").value.trim().toLocaleLowerCase(), category = $("employee-category").value;
    var records = ordered("employees").filter(function (item) {
      return (category === "all" || category === item.category) && (state.status === "all" || (state.status === "published") === item.published) && (!query || [item.name, item.description, item.category].join(" ").toLocaleLowerCase().includes(query));
    });
    $("employee-total").textContent = state.employees.length;
    $("employee-published").textContent = state.employees.filter(function (item) { return item.published; }).length;
    $("employee-unpublished").textContent = state.employees.filter(function (item) { return !item.published; }).length;
    $("employee-rows").innerHTML = records.map(function (item) {
      return '<tr data-id="' + escape(item.id) + '"><td class="drag-col">' + dragControls("employees", item, !employeeFiltered()) + '</td><td class="order-cell numeric">' + (state.employeeOrder.indexOf(item.id) + 1) + '</td><td><div class="employee-cell"><img src="' + escape(asset(item.image)) + '" alt="" width="52" height="44"><div><h3>' + escape(item.name) + '</h3><p title="' + escape(item.description) + '">' + escape(item.description) + '</p></div></div></td><td>' + escape(item.category) + '</td><td class="numeric align-right">' + numeric(item.usageCount) + '</td><td class="numeric align-right">' + numeric(item.tokenTotal) + '</td><td><span class="status' + (item.published ? ' is-active' : '') + '">' + (item.published ? "已上架" : "未上架") + '</span></td><td><button class="switch" type="button" role="switch" aria-checked="' + item.pinned + '" aria-label="置顶 ' + escape(item.name) + '" data-employee-action="pin"></button></td><td><div class="row-actions"><button class="text-button" data-employee-action="edit">编辑</button><button class="text-button strong" data-employee-action="publish">' + (item.published ? "下架" : "上架") + '</button></div></td></tr>';
    }).join("");
    $("employee-empty").hidden = records.length > 0;
    $("employee-result-count").textContent = "共 " + records.length + " 位数字员工";
    $("save-employee-order").disabled = !state.employeeDirty;
    $("employee-sort-note").textContent = employeeFiltered() ? "清除搜索和筛选后，可拖动调整完整列表顺序。" : state.employeeDirty ? "排序尚未保存，点击“保存排序”后同步至前台。" : "拖动行首手柄调整顺序，置顶员工优先展示。";
    $("employee-sort-note").classList.toggle("is-dirty", state.employeeDirty);
    document.querySelectorAll("[data-status]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.status === state.status); button.setAttribute("aria-pressed", String(button.dataset.status === state.status)); });
  }
  function renderBanners() {
    var query = $("banner-search").value.trim().toLocaleLowerCase(), position = $("banner-position").value, status = $("banner-status").value;
    var records = ordered("banners").filter(function (item) { return (position === "all" || position === item.position) && (status === "all" || (status === "enabled") === item.enabled) && (!query || [item.name, item.title, item.targetName].join(" ").toLocaleLowerCase().includes(query)); });
    $("banner-rows").innerHTML = records.map(function (item) {
      var available = item.targetAvailable !== false;
      var employee = employeeFor(item.targetEmployeeId);
      return '<tr data-id="' + escape(item.id) + '"><td class="drag-col">' + dragControls("banners", item, !bannerFiltered()) + '</td><td class="order-cell numeric">' + (state.bannerOrder.indexOf(item.id) + 1) + '</td><td><div class="banner-cell"><div class="banner-thumb"><img src="' + escape(asset(item.image)) + '" alt="" width="160" height="40"><span>' + escape(item.title) + '</span></div><div><h3 title="' + escape(item.name) + '">' + escape(item.name) + '</h3><p>' + escape(item.id) + '</p></div></div></td><td>' + (item.position === "scenes-top" ? "场景集市顶部" : "智能体集市顶部") + '</td><td>' + escape(employee ? employee.name : item.targetName || "未选择") + (available ? '' : '<small class="unavailable-target">关联员工已下架</small>') + '</td><td><span class="status' + (item.enabled && available ? ' is-active' : !available ? ' is-warning' : '') + '">' + (!available ? "目标不可用" : item.enabled ? "已启用" : "未启用") + '</span></td><td><div class="row-actions"><button class="text-button" data-banner-action="edit">编辑</button><button class="text-button strong" data-banner-action="toggle">' + (item.enabled ? "停用" : "启用") + '</button><button class="text-button danger" data-banner-action="delete">删除</button></div></td></tr>';
    }).join("");
    $("banner-empty").hidden = records.length > 0;
    $("banner-result-count").textContent = "共 " + records.length + " 张 Banner";
    $("save-banner-order").disabled = !state.bannerDirty;
    $("banner-sort-note").textContent = bannerFiltered() ? "清除搜索和筛选后，可拖动调整同一运营位内的顺序。" : state.bannerDirty ? "排序尚未保存，点击“保存排序”后同步至前台。" : "拖动行首手柄调整同一运营位内的顺序。";
    $("banner-sort-note").classList.toggle("is-dirty", state.bannerDirty);
  }
  function openDialog(id) { lastDialogTrigger = document.activeElement; var dialog = $(id); dialog.showModal(); var field = dialog.querySelector("input:not([type=hidden]),button"); if (field) field.focus({ preventScroll: true }); }
  function closeDialog(id) { var dialog = $(id); if (dialog.open) dialog.close(); }
  function confirmAction(title, message, action) {
    if (confirmResolver) return Promise.resolve(false);
    $("confirm-title").textContent = title; $("confirm-copy").textContent = message; $("confirm-accept").textContent = action || "确认";
    openDialog("confirm-dialog");
    return new Promise(function (resolve) { confirmResolver = resolve; });
  }
  function resolveConfirm(accept) { if (!confirmResolver) return; var resolve = confirmResolver; confirmResolver = null; closeDialog("confirm-dialog"); resolve(accept); }
  async function clearPending(kind) {
    if (!state[dirtyKey(kind)]) return true;
    if (!await confirmAction("还有未保存的排序", "继续操作会放弃这次排序调整，已保存的配置不受影响。", "放弃调整")) return false;
    state[dirtyKey(kind)] = false;
    state[orderKey(kind)] = list(kind).map(function (item) { return item.id; });
    if (kind === "employees") renderEmployees(); else renderBanners();
    return true;
  }
  function perform(action, message) {
    saving = true;
    try { var result = action(); if (message) toast(message); return result; }
    catch (error) { toast(errorMessage(error)); return null; }
    finally { saving = false; refresh(); }
  }
  function openEmployee(item) {
    $("employee-form").reset(); $("employee-form-error").hidden = true;
    $("employee-dialog-title").textContent = item ? "编辑数字员工" : "上架数字员工";
    $("employee-id").value = item ? item.id : "";
    $("employee-name").value = item ? item.name : "";
    $("employee-category-input").value = item ? item.category : "";
    $("employee-description").value = item ? item.description : "";
    $("employee-image").value = item ? item.image : "assets/work-content.jpg";
    $("employee-published-input").checked = item ? item.published : true;
    $("employee-pinned-input").checked = item ? item.pinned : false;
    $("employee-cover-preview").src = asset($("employee-image").value);
    openDialog("employee-dialog");
  }
  function targetOptions(current) {
    var available = state.employees.filter(function (item) { return item.published; });
    var options = available.map(function (item) { return '<option value="' + escape(item.id) + '">' + escape(item.name) + '</option>'; });
    if (current && !available.some(function (item) { return item.id === current; })) {
      var item = employeeFor(current); options.unshift('<option value="' + escape(current) + '">' + escape(item ? item.name : "原关联员工") + '（已下架）</option>');
    }
    $("banner-target").innerHTML = options.join("") || '<option value="">暂无已上架员工</option>';
  }
  function previewBanner() {
    $("banner-preview-title").textContent = $("banner-title").value.trim() || "把下一项工作，交给合适的数字员工。";
    $("banner-preview-subtitle").textContent = $("banner-subtitle").value.trim();
    $("banner-preview-image").src = asset($("banner-image").value.trim() || "assets/hero.jpg");
  }
  function openBanner(item) {
    $("banner-form").reset(); $("banner-form-error").hidden = true;
    $("banner-dialog-title").textContent = item ? "编辑 Banner" : "新增 Banner";
    $("banner-id").value = item ? item.id : "";
    $("banner-name").value = item ? item.name : "";
    $("banner-title").value = item ? item.title : "把下一项工作，交给合适的数字员工。";
    $("banner-subtitle").value = item ? item.subtitle : "从文案、设计到政策解读，点开就能开始。";
    $("banner-image").value = item ? item.image : "assets/hero.jpg";
    $("banner-position-input").value = item ? item.position : "agents-top";
    targetOptions(item && item.targetEmployeeId);
    if (item) $("banner-target").value = item.targetEmployeeId;
    $("banner-enabled").checked = item ? item.enabled : true;
    previewBanner(); openDialog("banner-dialog");
  }
  function showFormError(id, error) { $(id).textContent = errorMessage(error); $(id).hidden = false; }
  function uploadImage(file, inputId, errorId, callback) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { showFormError(errorId, new Error("请选择 PNG、JPG 或 WebP 图片。")); return; }
    if (file.size > 2 * 1024 * 1024) { showFormError(errorId, new Error("图片不能超过 2 MB，请压缩后重新选择。")); return; }
    var reader = new FileReader();
    reader.addEventListener("load", function () { $(inputId).value = reader.result; $(errorId).hidden = true; callback(); });
    reader.addEventListener("error", function () { showFormError(errorId, new Error("图片读取失败，请重新选择。")); });
    reader.readAsDataURL(file);
  }
  function sameGroup(kind, first, second) { return kind === "employees" ? Boolean(first.pinned) === Boolean(second.pinned) : first.position === second.position; }
  function captureRows(kind) {
    var map = new Map();
    $(kind === "employees" ? "employee-rows" : "banner-rows").querySelectorAll("tr[data-id]").forEach(function (row) { map.set(row.dataset.id, row.getBoundingClientRect().top); });
    return map;
  }
  function animateRows(kind, before) {
    if (reducedMotion.matches) return;
    $(kind === "employees" ? "employee-rows" : "banner-rows").querySelectorAll("tr[data-id]").forEach(function (row) {
      var previous = before.get(row.dataset.id); if (previous == null || typeof row.animate !== "function") return;
      var delta = previous - row.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) row.animate([{ transform: "translateY(" + delta + "px)", opacity: .7 }, { transform: "translateY(0)", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" });
    });
  }
  function reorder(kind, fromId, toId, after) {
    var records = list(kind), first = records.find(function (item) { return item.id === fromId; }), second = records.find(function (item) { return item.id === toId; });
    if (!first || !second || fromId === toId) return;
    if (!sameGroup(kind, first, second)) { toast(kind === "employees" ? "置顶与普通员工分别排序。" : "请在同一运营位内调整顺序。"); return; }
    var before = captureRows(kind), ids = state[orderKey(kind)].filter(function (id) { return id !== fromId; });
    var to = ids.indexOf(toId); if (to < 0) return;
    ids.splice(to + (after ? 1 : 0), 0, fromId);
    state[orderKey(kind)] = ids; state[dirtyKey(kind)] = true;
    if (kind === "employees") renderEmployees(); else renderBanners();
    animateRows(kind, before);
  }
  function moveWithKeyboard(kind, id, direction) {
    var records = ordered(kind), index = records.findIndex(function (item) { return item.id === id; });
    var next = index + (direction === "down" ? 1 : -1);
    if (next < 0 || next >= records.length) return;
    reorder(kind, id, records[next].id, direction === "down");
    var row = $(kind === "employees" ? "employee-rows" : "banner-rows").querySelector('tr[data-id="' + CSS.escape(id) + '"]');
    if (row) { var button = row.querySelector('[data-move="' + direction + '"]'); if (button) button.focus(); }
  }
  function clearDragClasses() { document.querySelectorAll(".is-dragging,.drop-before,.drop-after,.drop-invalid").forEach(function (row) { row.classList.remove("is-dragging", "drop-before", "drop-after", "drop-invalid"); }); }
  function wireDrag(kind, id) {
    var tbody = $(id);
    tbody.addEventListener("dragstart", function (event) {
      var handle = event.target.closest("[data-drag]");
      if (!handle || handle.draggable !== true || (kind === "employees" ? employeeFiltered() : bannerFiltered())) { event.preventDefault(); return; }
      var row = handle.closest("tr[data-id]"); state.drag = { kind: kind, id: row.dataset.id }; row.classList.add("is-dragging");
      if (event.dataTransfer) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", row.dataset.id); }
    });
    tbody.addEventListener("dragover", function (event) {
      if (!state.drag || state.drag.kind !== kind) return;
      var row = event.target.closest("tr[data-id]"); if (!row || row.dataset.id === state.drag.id) return;
      event.preventDefault(); clearDragClasses();
      var draggingRow = tbody.querySelector('tr[data-id="' + CSS.escape(state.drag.id) + '"]'); if (draggingRow) draggingRow.classList.add("is-dragging");
      var from = list(kind).find(function (item) { return item.id === state.drag.id; }), to = list(kind).find(function (item) { return item.id === row.dataset.id; });
      var invalid = !sameGroup(kind, from, to); var box = row.getBoundingClientRect(); row.classList.add(invalid ? "drop-invalid" : event.clientY > box.top + box.height / 2 ? "drop-after" : "drop-before");
      if (event.dataTransfer) event.dataTransfer.dropEffect = invalid ? "none" : "move";
    });
    tbody.addEventListener("drop", function (event) {
      if (!state.drag || state.drag.kind !== kind) return;
      event.preventDefault(); var row = event.target.closest("tr[data-id]");
      if (row) { var box = row.getBoundingClientRect(); reorder(kind, state.drag.id, row.dataset.id, event.clientY > box.top + box.height / 2); }
      state.drag = null; clearDragClasses();
    });
    tbody.addEventListener("dragend", function () { state.drag = null; clearDragClasses(); });
  }
  async function changeView(view, updateHash) {
    if (!["employees", "billing", "operations"].includes(view)) view = "employees";
    if (view !== state.view && !await clearPending(state.view === "operations" ? "banners" : "employees")) return false;
    state.view = view;
    document.body.classList.toggle("has-company-panel", view === "billing");
    $("company-sidebar").hidden = view !== "billing";
    document.querySelectorAll(".page-view").forEach(function (section) { section.hidden = section.id !== "view-" + view; });
    document.querySelectorAll(".primary-nav [data-view]").forEach(function (link) { var active = link.dataset.view === view; link.classList.toggle("is-active", active); if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
    document.title = ({ employees: "数字员工", billing: "积分与用量", operations: "Banner 管理" }[view]) + " · 万大圣运营管理";
    if (updateHash) window.history.pushState(null, "", "#" + view);
    if (view === "billing" && window.AdminBilling) window.AdminBilling.render();
    window.scrollTo({ top: 0, behavior: "auto" });
    return true;
  }
  function wireEvents() {
    document.querySelector(".primary-nav").addEventListener("click", async function (event) { var link = event.target.closest("[data-view]"); if (!link) return; event.preventDefault(); await changeView(link.dataset.view, true); });
    window.addEventListener("hashchange", async function () { var requested = window.location.hash.slice(1); if (!await changeView(requested, false)) window.history.replaceState(null, "", "#" + state.view); });
    window.addEventListener("beforeunload", function (event) { if (state.employeeDirty || state.bannerDirty) { event.preventDefault(); event.returnValue = ""; } });
    $("employee-search").addEventListener("input", renderEmployees); $("employee-category").addEventListener("change", renderEmployees);
    $("employee-status-tabs").addEventListener("click", function (event) { var button = event.target.closest("[data-status]"); if (!button) return; state.status = button.dataset.status; renderEmployees(); });
    ["banner-position", "banner-status"].forEach(function (id) { $(id).addEventListener("change", renderBanners); }); $("banner-search").addEventListener("input", renderBanners);
    $("add-employee").addEventListener("click", async function () { if (await clearPending("employees")) openEmployee(); });
    $("add-banner").addEventListener("click", async function () { if (await clearPending("banners")) openBanner(); });
    $("employee-rows").addEventListener("click", async function (event) {
      var button = event.target.closest("[data-employee-action]"); if (!button) return;
      var row = button.closest("tr[data-id]"), item = employeeFor(row.dataset.id); if (!item || !await clearPending("employees")) return;
      if (button.dataset.employeeAction === "edit") { openEmployee(item); return; }
      if (button.dataset.employeeAction === "pin") perform(function () { return ops.setPinned(item.id, !item.pinned); }, item.pinned ? "已取消置顶。" : "已置顶，前台展示已更新。");
      if (button.dataset.employeeAction === "publish") {
        if (item.published && !await confirmAction("下架数字员工？", "下架后将不在集市展示，关联 Banner 会暂停跳转，已有对话仍保留。", "确认下架")) return;
        perform(function () { return ops.setPublished(item.id, !item.published); }, item.published ? "员工已下架。" : "员工已上架。");
      }
    });
    $("banner-rows").addEventListener("click", async function (event) {
      var button = event.target.closest("[data-banner-action]"); if (!button) return;
      var row = button.closest("tr[data-id]"), item = state.banners.find(function (entry) { return entry.id === row.dataset.id; }); if (!item || !await clearPending("banners")) return;
      if (button.dataset.bannerAction === "edit") { openBanner(item); return; }
      if (button.dataset.bannerAction === "toggle") perform(function () { return ops.saveBanner(Object.assign({}, item, { enabled: !item.enabled })); }, item.enabled ? "Banner 已停用。" : "Banner 已启用。");
      if (button.dataset.bannerAction === "delete") {
        if (!await confirmAction("删除这张 Banner？", "“" + item.name + "”将从运营列表和前台移除。", "删除 Banner")) return;
        perform(function () { return ops.deleteBanner(item.id); }, "Banner 已删除。");
      }
    });
    ["employees", "banners"].forEach(function (kind) {
      $(kind === "employees" ? "save-employee-order" : "save-banner-order").addEventListener("click", function () {
        saving = true;
        try { if (kind === "employees") ops.saveEmployeeOrder(state.employeeOrder.slice()); else ops.saveBannerOrder(state.bannerOrder.slice()); state[dirtyKey(kind)] = false; toast("排序已保存，前台展示顺序已更新。"); }
        catch (error) { toast(errorMessage(error)); }
        finally { saving = false; refresh(); }
      });
    });
    document.addEventListener("click", function (event) {
      var close = event.target.closest("[data-close]"); if (close) closeDialog(close.dataset.close);
      var move = event.target.closest("[data-move]"); if (move) { var row = move.closest("tr[data-id]"); moveWithKeyboard(move.dataset.kind, row.dataset.id, move.dataset.move); }
    });
    ["employee-dialog", "banner-dialog"].forEach(function (id) {
      $(id).addEventListener("close", function () { if (lastDialogTrigger && document.contains(lastDialogTrigger)) lastDialogTrigger.focus({ preventScroll: true }); });
      $(id).addEventListener("click", function (event) { if (event.target !== $(id)) return; var box = $(id).getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(id); });
    });
    $("confirm-cancel").addEventListener("click", function () { resolveConfirm(false); }); $("confirm-accept").addEventListener("click", function () { resolveConfirm(true); });
    $("confirm-dialog").addEventListener("cancel", function (event) { event.preventDefault(); resolveConfirm(false); });
    $("confirm-dialog").addEventListener("close", function () { if (lastDialogTrigger && document.contains(lastDialogTrigger)) lastDialogTrigger.focus({ preventScroll: true }); });
    $("employee-image").addEventListener("input", function () { $("employee-cover-preview").src = asset($("employee-image").value); });
    $("employee-upload").addEventListener("change", function () { uploadImage(this.files[0], "employee-image", "employee-form-error", function () { $("employee-cover-preview").src = asset($("employee-image").value); }); this.value = ""; });
    $("employee-form").addEventListener("submit", function (event) {
      event.preventDefault(); var id = $("employee-id").value; var existing = id ? employeeFor(id) : {};
      var data = Object.assign({}, existing, { id: id, name: $("employee-name").value.trim(), category: $("employee-category-input").value.trim(), description: $("employee-description").value.trim(), image: $("employee-image").value.trim(), published: $("employee-published-input").checked, pinned: $("employee-pinned-input").checked });
      if (!id) delete data.id;
      saving = true;
      try { ops.saveEmployee(data); closeDialog("employee-dialog"); toast("数字员工已保存。"); }
      catch (error) { showFormError("employee-form-error", error); }
      finally { saving = false; refresh(); }
    });
    ["banner-title", "banner-subtitle", "banner-image"].forEach(function (id) { $(id).addEventListener("input", previewBanner); });
    $("banner-upload").addEventListener("change", function () { uploadImage(this.files[0], "banner-image", "banner-form-error", previewBanner); this.value = ""; });
    $("banner-form").addEventListener("submit", function (event) {
      event.preventDefault(); var id = $("banner-id").value; var existing = id ? state.banners.find(function (item) { return item.id === id; }) : {};
      var data = Object.assign({}, existing, { id: id, name: $("banner-name").value.trim(), title: $("banner-title").value.trim(), subtitle: $("banner-subtitle").value.trim(), image: $("banner-image").value.trim(), position: $("banner-position-input").value, targetEmployeeId: $("banner-target").value, enabled: $("banner-enabled").checked });
      if (!id) delete data.id;
      saving = true;
      try { ops.saveBanner(data); closeDialog("banner-dialog"); toast("Banner 已保存，可在前台查看。"); }
      catch (error) { showFormError("banner-form-error", error); }
      finally { saving = false; refresh(); }
    });
    wireDrag("employees", "employee-rows"); wireDrag("banners", "banner-rows");
    window.addEventListener("pageshow", function (event) { if (event.persisted) refresh(); });
  }
  if (!ops) { pageError(new Error("运营配置暂时无法加载，请刷新页面后重试。")); return; }
  wireEvents();
  if (window.AdminBilling) window.AdminBilling.init({ toast: toast });
  refresh();
  changeView(window.location.hash.slice(1) || "employees", false);
  ops.subscribe(function (event) { if (event && event.type === "error") { pageError(event.error); return; } if (!saving) refresh(); });
})();
