(function () {
  "use strict";
  // 沿用独立版场景数据，仅使用入口改为抽屉。
  window.marketplaceScenes = [
    {
      id: "marketing", employee: "content", category: "sales", name: "AI营销视频生成",
      description: "策划并推进一次营销活动：目标人群、渠道、物料与节奏。",
      image: "assets/work-content.jpg", imageClass: "scene-cover-marketing",
      tasks: ["梳理营销活动目标与受众", "规划视频内容、物料与发布渠道", "安排活动推进节奏"],
      preparation: ["产品或活动介绍、目标人群", "投放渠道、活动时间与预算范围", "品牌素材、已有文案或视频参考"]
    },
    {
      id: "reports", employee: "finance", category: "all", name: "AI生成汇报（日/周/月报）",
      description: "绑定飞书群，按日/周节奏整理群消息与项目进展，汇总成日报、周报，确认后再发。",
      image: "assets/work-finance.jpg", imageClass: "scene-cover-reports",
      tasks: ["梳理群消息中的项目进展", "汇总日报、周报或月报内容", "整理需要确认的进度与待办"],
      preparation: ["需要汇总的群消息或项目记录", "汇报周期、接收对象与内容范围", "现有汇报格式，以及飞书群的连接与授权安排"]
    },
    {
      id: "images", employee: "design", category: "all", name: "AI生成图片",
      description: "说一句需求，文生图或图生图生成海报与视觉物料初稿。",
      image: "assets/work-design.jpg", imageClass: "scene-cover-images",
      tasks: ["活动海报与宣传物料初稿", "基于文字需求探索视觉方向", "基于已有图片调整画面内容与风格"],
      preparation: ["图片用途、尺寸与需要呈现的内容", "品牌标识、文案与参考风格", "需要保留或修改的原始图片"]
    },
    {
      id: "templates", employee: "design", category: "all", name: "合规场景专用：名片、喜报、排行榜",
      description: "模板海报云端精控，文案与数字可修改，同款可复用。",
      image: "assets/work-design.jpg", imageClass: "scene-cover-templates",
      tasks: ["名片、喜报与排行榜的模板化制作", "替换模板中的文案、姓名与数字", "复用同款版式制作系列物料"],
      preparation: ["可使用的模板与品牌规范", "需要替换的文案、数字和图片", "物料尺寸、使用场景与审核要求"]
    },
    {
      id: "custom", employee: "content", category: "all", name: "自定义协作场景",
      description: "从目标出发，创建适合当前业务的协作项目。",
      image: "assets/work-development.svg", imageClass: "scene-cover-custom",
      tasks: ["把业务目标拆解为协作任务", "梳理需要的角色、资料与工作步骤", "明确阶段成果与确认节点"],
      preparation: ["希望解决的问题与预期成果", "参与角色、现有资料和时间安排", "需要确认的业务限制与协作方式"]
    }
  ];
})();
