(function () {
  "use strict";
  var companies = window.AdminBillingData && Array.isArray(window.AdminBillingData.companies) ? window.AdminBillingData.companies : [];
  var selectedId = new URLSearchParams(window.location.search).get("company") || (companies[0] && companies[0].id);
  var tab = "ledger";
  var currentRows = [];
  var context;
  function $(id) { return document.getElementById(id); }
  function escape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function numeric(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString("zh-CN") : "—"; }
  function company() { return companies.find(function (item) { return item.id === selectedId; }) || companies[0]; }
  function employeeName(id) {
    var employees = window.marketplaceCatalog || [];
    try { if (window.MarketplaceOps) employees = window.MarketplaceOps.getEmployees(); } catch (error) { /* Keep names readable if local config is unavailable. */ }
    var found = employees.find(function (item) { return item.id === id; });
    return found ? found.name : id ? "数字员工" : "—";
  }
  function dateText(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(/\//g, "-");
  }
  function renderCompanies() {
    var query = $("company-search").value.trim().toLocaleLowerCase();
    var list = companies.filter(function (item) { return !query || [item.name, item.shortName, item.id].join(" ").toLocaleLowerCase().includes(query); });
    $("company-count").textContent = companies.length;
    $("company-list").innerHTML = list.map(function (item) {
      var name = item.shortName || item.name;
      return '<button type="button" class="company-item' + (item.id === selectedId ? ' is-active' : '') + '" data-company="' + escape(item.id) + '"' + (item.id === selectedId ? ' aria-current="true"' : '') + '><span class="company-avatar" aria-hidden="true">' + escape(name.charAt(0)) + '</span><span><strong>' + escape(name) + '</strong><small class="numeric">' + escape(item.id) + '</small></span></button>';
    }).join("") || '<p class="empty-state">没有匹配的企业</p>';
    $("company-result-count").textContent = "共 " + list.length + " 家企业";
  }
  function metrics(item) {
    var initial = Number(item.initialPoints) || 0;
    var ledger = item.ledger || [];
    var earned = Math.max(initial, 0), spent = 0, balance = initial;
    ledger.forEach(function (event) { var amount = Number(event.delta) || 0; balance += amount; if (amount > 0) earned += amount; else spent -= amount; });
    var tokens = (item.usageEvents || []).reduce(function (sum, event) { return sum + (Number(event.inputTokens) || 0) + (Number(event.outputTokens) || 0); }, 0);
    $("available-points").innerHTML = numeric(balance) + ' <small>点</small>';
    $("earned-points").innerHTML = numeric(earned) + ' <small>点</small>';
    $("spent-points").innerHTML = numeric(spent) + ' <small>点</small>';
    $("total-tokens").textContent = numeric(tokens);
  }
  function rowsWithBalances(item) {
    var running = Number(item.initialPoints) || 0;
    return (item.ledger || []).slice().sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); }).map(function (event) {
      running += Number(event.delta) || 0;
      return Object.assign({}, event, { calculatedBalance: running });
    });
  }
  function filteredRows(item) {
    var rows = tab === "ledger" ? rowsWithBalances(item) : (item.usageEvents || []).slice();
    var period = $("billing-period").value, employee = $("billing-employee").value, type = $("billing-type").value;
    var query = $("billing-search").value.trim().toLocaleLowerCase();
    var start = 0, now = Date.now();
    if (period === "today") { var today = new Date(); today.setHours(0, 0, 0, 0); start = today.getTime(); }
    else if (period !== "all") start = now - Number(period) * 86400000;
    return rows.filter(function (event) {
      var date = new Date(event.createdAt).getTime();
      if (!Number.isFinite(date) || date < start || date > now) return false;
      if (employee !== "all" && event.employeeId !== employee) return false;
      if (tab === "ledger" && type !== "all" && event.type !== type) return false;
      return !query || [event.id, event.work, event.conversationTitle, employeeName(event.employeeId)].join(" ").toLocaleLowerCase().includes(query);
    }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
  }
  function render() {
    var item = company();
    if (!item) { $("billing-rows").innerHTML = ""; $("billing-empty").hidden = false; return; }
    selectedId = item.id;
    $("selected-company-name").textContent = item.name;
    $("selected-company-id").textContent = item.id;
    metrics(item);
    renderCompanies();
    currentRows = filteredRows(item);
    $("billing-type-control").hidden = tab !== "ledger";
    $("billing-search").placeholder = tab === "ledger" ? "搜索流水号或工作内容" : "搜索调用号或工作内容";
    document.querySelectorAll("[data-billing-tab]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.billingTab === tab); button.setAttribute("aria-pressed", String(button.dataset.billingTab === tab)); });
    if (tab === "ledger") {
      $("billing-table-head").innerHTML = '<tr><th>时间</th><th>工作内容</th><th>数字员工</th><th class="align-right">积分变动</th><th class="align-right">变动后余额</th><th>类型</th><th>状态</th></tr>';
      $("billing-rows").innerHTML = currentRows.map(function (event) {
        var positive = event.delta > 0;
        return '<tr><td class="numeric">' + escape(dateText(event.createdAt)) + '<small>' + escape(event.id) + '</small></td><td class="work-cell" title="' + escape(event.work) + '">' + escape(event.work || "—") + '</td><td>' + escape(employeeName(event.employeeId)) + '</td><td class="numeric align-right' + (positive ? ' positive' : '') + '">' + (positive ? '+' : '−') + numeric(Math.abs(event.delta)) + '</td><td class="numeric align-right">' + numeric(event.calculatedBalance) + '</td><td>' + (event.type === "grant" ? "额度发放" : "调用扣减") + '</td><td><span class="status is-active">' + (event.type === "grant" ? "已入账" : "已完成") + '</span></td></tr>';
      }).join("");
    } else {
      $("billing-table-head").innerHTML = '<tr><th>时间 / 调用号</th><th>工作内容</th><th>数字员工</th><th class="align-right">输入 Token</th><th class="align-right">输出 Token</th><th class="align-right">合计 Token</th><th>状态</th></tr>';
      $("billing-rows").innerHTML = currentRows.map(function (event) {
        var label = { success: "已完成", completed: "已完成", running: "进行中", failed: "失败", pending: "待处理" }[event.status] || "待同步";
        var statusClass = event.status === "failed" ? "is-failed" : event.status === "running" ? "is-warning" : "is-active";
        return '<tr><td class="numeric">' + escape(dateText(event.createdAt)) + '<small>' + escape(event.id) + '</small></td><td class="work-cell">' + escape(event.conversationTitle || event.work || "—") + '</td><td>' + escape(employeeName(event.employeeId)) + '</td><td class="numeric align-right">' + numeric(event.inputTokens) + '</td><td class="numeric align-right">' + numeric(event.outputTokens) + '</td><td class="numeric align-right">' + numeric(Number(event.inputTokens || 0) + Number(event.outputTokens || 0)) + '</td><td><span class="status ' + statusClass + '">' + label + '</span></td></tr>';
      }).join("");
    }
    $("billing-record-count").textContent = "共 " + currentRows.length + " 条记录";
    $("billing-footer-count").textContent = "共 " + currentRows.length + " 条";
    $("billing-empty").hidden = currentRows.length > 0;
  }
  function exportCSV() {
    var item = company();
    if (!item) return;
    var headers = tab === "ledger" ? ["流水号", "企业", "时间", "工作内容", "数字员工", "积分变动", "变动后余额", "类型"] : ["调用号", "企业", "时间", "工作内容", "数字员工", "输入Token", "输出Token", "状态"];
    var rows = currentRows.map(function (event) {
      return tab === "ledger" ? [event.id, item.name, event.createdAt, event.work, employeeName(event.employeeId), event.delta, event.calculatedBalance, event.type === "grant" ? "额度发放" : "调用扣减"] : [event.id, item.name, event.createdAt, event.conversationTitle || event.work, employeeName(event.employeeId), event.inputTokens, event.outputTokens, event.status];
    });
    function cell(value) { if (typeof value === "number") return String(value); var text = String(value == null ? "" : value); if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; }
    var csv = "\uFEFF" + [headers].concat(rows).map(function (row) { return row.map(cell).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var link = document.createElement("a"); link.href = url; link.download = item.id + (tab === "ledger" ? "-points" : "-tokens") + ".csv"; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    if (context) context.toast("已导出当前筛选的 " + currentRows.length + " 条记录。");
  }
  window.AdminBilling = {
    init: function (helpers) {
      context = helpers;
      $("company-search").addEventListener("input", renderCompanies);
      $("company-list").addEventListener("click", function (event) { var button = event.target.closest("[data-company]"); if (!button) return; selectedId = button.dataset.company; var url = new URL(window.location.href); url.searchParams.set("company", selectedId); window.history.replaceState(null, "", url); render(); });
      $("billing-tabs").addEventListener("click", function (event) { var button = event.target.closest("[data-billing-tab]"); if (!button) return; tab = button.dataset.billingTab; render(); });
      ["billing-period", "billing-employee", "billing-type"].forEach(function (id) { $(id).addEventListener("change", render); });
      $("billing-search").addEventListener("input", render);
      $("export-billing").addEventListener("click", exportCSV);
      this.refreshEmployees();
      render();
    },
    refreshEmployees: function () {
      var previous = $("billing-employee").value;
      var employees = window.marketplaceCatalog || [];
      try { if (window.MarketplaceOps) employees = window.MarketplaceOps.getEmployees(); } catch (error) { /* Initial catalog remains available. */ }
      $("billing-employee").innerHTML = '<option value="all">全部员工</option>' + employees.map(function (employee) { return '<option value="' + escape(employee.id) + '">' + escape(employee.name) + '</option>'; }).join("");
      $("billing-employee").value = employees.some(function (employee) { return employee.id === previous; }) ? previous : "all";
    },
    render: render
  };
})();
