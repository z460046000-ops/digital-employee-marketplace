(function () {
  "use strict";

  // Independent examples never become metered calls or overwrite browser records.
  var now = new Date();
  function when(daysAgo, minutes) {
    var date = new Date(now);
    if (daysAgo === 0) date.setTime(date.getTime() - 60 * 60 * 1000);
    else { date.setDate(date.getDate() - daysAgo); date.setHours(12, 0, 0, 0); }
    date.setTime(date.getTime() + (minutes || 0) * 60000);
    return date.toISOString();
  }

  function conversation(id, employeeId, title, daysAgo, messages, options) {
    options = options || {};
    return {
      id: id, employeeId: employeeId, sceneId: options.sceneId || null,
      title: title, createdAt: when(daysAgo, -messages.length * 3), updatedAt: when(daysAgo),
      messages: messages.map(function (message, index) {
        return { id: id + "_message_" + (index + 1), role: message[0], text: message[1], files: [], createdAt: when(daysAgo, -(messages.length - index - 1) * 3) };
      }),
      draft: "", status: options.status || "completed", isExample: true
    };
  }

  var conversations = [
    conversation("example_content", "content", "秋季新品短视频脚本", 0, [
      ["user", "想做一条秋季保温杯新品短视频，时长 30 秒，面向通勤人群。重点是轻便和一键开盖，语气自然一些。"],
      ["assistant", "建议从早高峰出门的场景切入。\n\n0–5 秒：整理背包，顺手装入保温杯。旁白：早上赶时间，东西想带得简单一点。\n5–18 秒：展示单手开盖与放入包侧袋的动作。\n18–26 秒：切到办公室，杯子放在桌边。旁白：从路上到工位，一杯热水刚刚好。\n26–30 秒：产品定格，留出品牌与购买入口。"],
      ["user", "不要出现保温时长承诺，结尾也不要太像广告。"],
      ["assistant", "已去掉时长与性能承诺。结尾改为：镜头停在桌边的杯子和刚打开的笔记本，字幕写“把日常，过得轻一点”。保留产品名称，不加催促购买的口播。"]
    ]),
    conversation("example_design", "design", "品牌活动主视觉方向", 1, [
      ["user", "为秋季新品发布准备活动主视觉。希望用蓝色，但不要科技光效，需要能延展到海报和邀请函。"],
      ["assistant", "可以采用纸张与几何构成的方向：白底保留大面积留白，以钴蓝色块组织主标题，产品照片作为视觉中心。海报突出活动主题，邀请函保留同一组几何图形，保证不同尺寸的识别一致。"],
      ["user", "先出一套排版规范，主标题不要太满。"],
      ["assistant", "排版建议：标题控制在两行，左侧对齐；画面四周保留约 8% 的安全区；日期和地点放在底部信息区。主视觉只使用黑、白、蓝三种颜色，图片不叠加发光效果。交付清单：竖版海报、横版封面、邀请函三个尺寸。"]
    ]),
    conversation("example_legal", "legal", "小微企业扶持政策要点", 2, [
      ["user", "帮我把这份小微企业扶持政策整理成内部讨论提纲，重点关注适用对象、申报材料和办理时间。"],
      ["assistant", "建议分四部分核对：\n1. 适用对象：企业规模、注册地、经营年限等条件。\n2. 支持事项：区分可申请的项目，避免把不同条款叠加理解。\n3. 申报材料：营业执照、财务资料及各事项要求的证明文件。\n4. 时间安排：分别记录申报开始、截止及补正时间。\n\n涉及金额、期限和办理入口的内容，应逐项对应正式政策原文后再用于申报。"]
    ]),
    conversation("example_finance", "finance", "9月经营数据与费用归集", 4, [
      ["user", "把 9 月经营数据整理成月报提纲，费用分为人员、营销和日常运营三类，缺少凭证的项目单独列出来。"],
      ["assistant", "月报结构已整理：\n一、经营概览：收入、支出及月度变化。\n二、费用归集：按人员、营销、日常运营分别汇总，并保留原始明细索引。\n三、待核对事项：缺少凭证、归属期间不清、重复记录三类单独列出。\n四、下月跟进：补齐凭证、确认费用归属和完成复核。\n\n待核对项目不纳入已确认费用，确认后再更新汇总表。"]
    ]),
    conversation("example_reports", "content", "本周项目进展汇报", 0, [
      ["user", "整理本周项目汇报，按已完成、进行中、需要协调三部分写。已经确认了首页方向，员工详情和工作台还在调整。"],
      ["assistant", "汇报提纲已整理：\n已完成：确认首页的视觉方向与主要入口。\n进行中：细化员工详情的信息层级，补充工作台的对话记录和用量入口。\n需要协调：确认试用额度规则、调用记录字段及接口联调时间。\n\n下一步可补充每项工作的负责人和预计完成时间，再形成正式周报。"]
    ], { sceneId: "reports", status: "running" }),
    conversation("example_qualification", "qualification", "企业资质申报材料清单", 12, [
      ["user", "准备一份企业资质申报的资料收集清单，先按通用材料分类，具体申报项目确定后再补。"],
      ["assistant", "通用材料清单可先分为五组：\n1. 主体信息：营业执照、企业基本情况。\n2. 人员信息：相关人员名单及所需证明。\n3. 经营情况：财务资料、业务合同及项目记录。\n4. 管理制度：质量、人员和档案管理文件。\n5. 待补材料：按目标资质的正式要求逐项确认。\n\n建议给每项资料增加“负责人、有效期、收集状态”三列，便于后续跟进。"]
    ], { status: "draft" })
  ];

  var events = [
    { id: "EX-1021-008", conversationId: "example_content", employeeId: "content", createdAt: when(0), inputTokens: 5200, outputTokens: 3100, status: "success" },
    { id: "EX-1021-007", conversationId: "example_design", employeeId: "design", createdAt: when(1), inputTokens: 4800, outputTokens: 6400, status: "success" },
    { id: "EX-1021-006", conversationId: "example_legal", employeeId: "legal", createdAt: when(2), inputTokens: 11200, outputTokens: 5100, status: "success" },
    { id: "EX-1021-005", conversationId: "example_finance", employeeId: "finance", createdAt: when(4), inputTokens: 16400, outputTokens: 8600, status: "success" },
    { id: "EX-1021-004", conversationId: "example_reports", employeeId: "content", createdAt: when(0, -5), inputTokens: 0, outputTokens: 0, status: "running" },
    { id: "EX-1021-003", conversationId: "example_content", employeeId: "content", createdAt: when(0, -12), inputTokens: 7200, outputTokens: 3800, status: "success" },
    { id: "EX-1021-002", conversationId: "example_design", employeeId: "design", createdAt: when(1, -8), inputTokens: 0, outputTokens: 0, status: "failed" },
    { id: "EX-1021-001", conversationId: "example_qualification", employeeId: "qualification", createdAt: when(12), inputTokens: 9600, outputTokens: 4200, status: "success" }
  ].sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
  var input = events.reduce(function (sum, event) { return sum + event.inputTokens; }, 0);
  var output = events.reduce(function (sum, event) { return sum + event.outputTokens; }, 0);
  var total = input + output;

  window.WorkspaceExamples = {
    conversations: conversations,
    usage: { status: "example", inputTokens: input, outputTokens: output, totalTokens: total, remainingQuota: 1000000 - total, usedQuota: total, events: events, quotaUnit: "Token" }
  };
})();
