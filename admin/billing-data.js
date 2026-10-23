(function () {
  "use strict";

  var now = Date.now();
  function ago(days, minutes) { return new Date(now - days * 86400000 - (minutes || 0) * 60000).toISOString(); }
  function future(days) { return new Date(now + days * 86400000).toISOString(); }
  function summarize(item) {
    item = item || {};
    var initial = Number(item.initialPoints) || 0;
    var earned = Math.max(initial, 0), spent = Math.max(-initial, 0), available = initial;
    (item.ledger || []).forEach(function (event) {
      var delta = Number(event.delta) || 0;
      available += delta;
      if (delta > 0) earned += delta;
      else spent -= delta;
    });
    var tokens = (item.usageEvents || []).reduce(function (sum, event) {
      return sum + (Number(event.inputTokens) || 0) + (Number(event.outputTokens) || 0);
    }, 0);
    return { earned: earned, spent: spent, available: available, tokens: tokens };
  }
  function percentage(used, total) {
    return Math.max(0, Math.min(100, total > 0 ? used / total * 100 : used > 0 ? 100 : 0));
  }
  function getEntitlements(item) {
    var totals = summarize(item);
    var settings = item && item.entitlements || {};
    var baseTotal = Math.floor(totals.earned * 0.8);
    var baseUsed = Math.min(totals.spent, baseTotal);
    var giftTotal = totals.earned - baseTotal;
    // 示例分配仅拆分已有入账，超出基础额度的消耗归入赠送额度，绝不追加积分。
    var allocations = [
      { id: "base", name: "基础额度", source: "体验套餐基础额度", total: baseTotal, used: baseUsed },
      { id: "gift", name: "赠送额度", source: "新企业试用赠送", total: giftTotal, used: totals.spent - baseUsed }
    ].map(function (allocation) {
      allocation.remaining = allocation.total - allocation.used;
      allocation.percent = percentage(allocation.used, allocation.total);
      allocation.validFrom = settings.validFrom || null;
      allocation.validUntil = settings.validUntil || null;
      return allocation;
    });
    return {
      planName: settings.planName || "体验版", isExample: true,
      total: totals.earned, used: totals.spent, remaining: totals.available,
      percent: percentage(totals.spent, totals.earned), nextUpdateAt: settings.nextUpdateAt || null,
      allocations: allocations, addOnCount: 0, addOnPoints: 0
    };
  }
  function ledger(companyId, grant, deductions) {
    var balance = 0;
    var items = [{ id: companyId + "_credit_01", createdAt: ago(3, 120), employeeId: null, work: "新企业试用额度", type: "grant", delta: grant, status: "credited" }];
    var employees = ["finance", "content", "legal", "design", "content"];
    var work = ["经营费用分类整理", "本周项目进展汇报", "惠企政策重点梳理", "品牌活动主视觉", "秋季新品推广文案"];
    var times = [[2, 150], [1, 180], [1, 60], [0, 110], [0, 90]];
    deductions.forEach(function (points, index) {
      items.push({ id: companyId + "_debit_" + String(index + 1).padStart(2, "0"), createdAt: ago(times[index][0], times[index][1]), employeeId: employees[index], work: work[index], type: "consume", delta: -points, status: "completed" });
    });
    items.forEach(function (item) { balance += item.delta; item.balance = balance; });
    return items;
  }
  var usageRows = [
    ["content", "秋季新品推广文案", 5200, 3100, "success", 0, 90],
    ["design", "品牌活动主视觉", 4800, 6400, "success", 0, 110],
    ["legal", "惠企政策重点梳理", 11200, 5100, "success", 1, 60],
    ["finance", "经营费用分类整理", 16400, 8600, "success", 2, 150],
    ["content", "本周项目进展汇报", 0, 0, "running", 0, 20],
    ["content", "推广文案方向补充", 7200, 3800, "success", 0, 100],
    ["design", "主视觉方案调整", 0, 0, "failed", 0, 130],
    ["qualification", "企业资质材料清单", 9600, 4200, "success", 2, 180]
  ];
  var definitions = [
    ["ENT-1001", "云杉科技有限公司", "云杉科技", 10000, [520, 180, 300, 240, 120], 1],
    ["ENT-1002", "观澜品牌管理有限公司", "观澜品牌", 20000, [360, 220, 180, 600, 200], 1.4],
    ["ENT-1003", "知行企业咨询有限公司", "知行咨询", 8000, [240, 100, 420, 160, 80], 0.75],
    ["ENT-1004", "青禾商贸有限公司", "青禾商贸", 15000, [280, 140, 180, 320, 160], 1.15],
    ["ENT-1005", "远山制造有限公司", "远山制造", 30000, [1200, 360, 480, 640, 220], 2.2],
    ["ENT-1006", "拾光生活用品有限公司", "拾光生活", 12000, [180, 120, 160, 280, 140], 0.9]
  ];

  window.AdminBillingData = {
    isExample: true,
    summarize: summarize,
    getEntitlements: getEntitlements,
    companies: definitions.map(function (item) {
      return {
        id: item[0], name: item[1], shortName: item[2], initialPoints: 0,
        ledger: ledger(item[0], item[3], item[4]),
        entitlements: { planName: "体验版", validFrom: ago(3, 120), validUntil: future(27), nextUpdateAt: future(27) },
        usageEvents: usageRows.map(function (row, index) {
          return { id: item[0] + "_RUN_" + String(index + 1).padStart(3, "0"), createdAt: ago(row[5], row[6]), employeeId: row[0], conversationTitle: row[1], inputTokens: Math.round(row[2] * item[5]), outputTokens: Math.round(row[3] * item[5]), status: row[4] };
        }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })
      };
    })
  };
})();
