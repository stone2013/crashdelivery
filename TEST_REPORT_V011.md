# V0.11 验证报告

## 执行范围
本次 83 项离线 JS/DOM/玩法检查全部通过。检查运行在 Chromium 的离线文档中，加载的是交付包里的真实模型/调色板数据，执行真实物理、投递、碰撞、UI 和快照代码。图形 API 使用测试替身，不会编译 GLSL 或验证 GPU；这些检查不能称为 WebGL 实机通过。

## 已验证
- 28 个住宅/园林 GLB 初始化、22 栋住宅实例和 6 个配送地址。
- 所有住宅之间无重叠，采样建筑范围不侵入实际道路网格。
- #101–#106 的全部 21 个原生门窗目标逐个投递通过。
- 6 个住宅地址均使用实际货箱 throwPackage 流程完成行驶中投掷；发射车速 7 m/s（约 25 km/h），没有把包裹直接摆入目标。
- 101–118 全部 18 单连续真实包裹飞行与计分通过。
- 错件不消耗，击中空白墙不算送达。
- 6 个住宅的车辆高速接触不穿入；房主与客户端预测碰撞位置一致。
- 房主窗户破损记录、积分和送达状态能经真实 snapshot 函数应用到客机，破洞坐标/种子一致。这是离线快照往返，不是实时公网对战测试。
- 390×844、320×640、844×390、1280×820 四种尺寸的主菜单/游戏/暂停三个界面高度和宽度与容器一致。
- 驾驶隐藏跳跃、货箱状态保留人物移动/跳跃；启动及执行未记录 JS 异常。
- 主菜单实际 DOM 显示 V0.11 ONLINE / SUBURBAN。

## 构建与资源
- 6 个内联 JavaScript 块经 node --check 检查。
- 冻结原生库门基线的 SHA-256 校验通过；独立重建 index 与交付文件逐字节一致。
- Service Worker 中 48 个静态资源路径全部存在；API/房间/凭据没有加入缓存。
- 模型直接来自用户上传包，住宅使用原始 colormap，保留许可证。

## 尚未验证 / 明确边界
- 没有在真实 iPhone standalone PWA、Safari/GPU 驱动、公网 TURN 或完整五分钟 2v2 比赛中验证。本版只是保留原 2v2 实现，未声称重做它。
- PWA 三态尺寸已在桌面浏览器 DOM 中验证；不能据此保证 iOS 恢复前台、键盘或系统安全区问题已经彻底消失。
- 预览 PNG 由实际运行时导出的模型、道路、车辆与变换矩阵进行 CPU 软件渲染，不是生成式概念图，也不是手机/GPU 截图；部分阴影和玻璃透明效果未在预览中呈现。
- 住宅破洞为局部贴图视觉效果，不对原 GLB 建筑挖真实几何洞；不增加库门模型或库门贴图。

## 逐项结果
- PASS — boot without JS errors
- PASS — assets initialized
- PASS — 22 homes / six deliveries
- PASS — no road or house overlap
- PASS — #101 door 0
- PASS — #101 window 1
- PASS — #101 window 2
- PASS — #102 door 0
- PASS — #102 window 1
- PASS — #102 window 2
- PASS — #102 window 3
- PASS — #103 garage 0
- PASS — #103 door 1
- PASS — #103 window 2
- PASS — #103 window 3
- PASS — #104 door 0
- PASS — #104 window 1
- PASS — #104 window 2
- PASS — #105 garage 0
- PASS — #105 garage 1
- PASS — #105 door 2
- PASS — #105 window 3
- PASS — #106 garage 0
- PASS — #106 door 1
- PASS — #106 window 2
- PASS — 18-order sequence 101
- PASS — 18-order sequence 102
- PASS — 18-order sequence 103
- PASS — 18-order sequence 104
- PASS — 18-order sequence 105
- PASS — 18-order sequence 106
- PASS — 18-order sequence 107
- PASS — 18-order sequence 108
- PASS — 18-order sequence 109
- PASS — 18-order sequence 110
- PASS — 18-order sequence 111
- PASS — 18-order sequence 112
- PASS — 18-order sequence 113
- PASS — 18-order sequence 114
- PASS — 18-order sequence 115
- PASS — 18-order sequence 116
- PASS — 18-order sequence 117
- PASS — 18-order sequence 118
- PASS — wrong order not consumed
- PASS — blank facade not delivery
- PASS — car hull outside 101
- PASS — car hull outside 102
- PASS — car hull outside 103
- PASS — car hull outside 104
- PASS — car hull outside 105
- PASS — car hull outside 106
- PASS — 390x844 menu
- PASS — 390x844 game
- PASS — 390x844 pause
- PASS — 320x640 menu
- PASS — 320x640 game
- PASS — 320x640 pause
- PASS — 844x390 menu
- PASS — 844x390 game
- PASS — 844x390 pause
- PASS — 1280x820 menu
- PASS — 1280x820 game
- PASS — 1280x820 pause
- PASS — driver hides jump
- PASS — cargo keeps jump
- PASS — no later errors
- PASS — moving cargo native delivery 101
- PASS — moving cargo native delivery 102
- PASS — moving cargo native delivery 103
- PASS — moving cargo native delivery 104
- PASS — moving cargo native delivery 105
- PASS — moving cargo native delivery 106
- PASS — host native glass hole recorded
- PASS — guest receives score/completion
- PASS — guest glass position/seed matches
- PASS — new protocol and 18 unique parcel orders
- PASS — prediction collision parity 101
- PASS — prediction collision parity 102
- PASS — prediction collision parity 103
- PASS — prediction collision parity 104
- PASS — prediction collision parity 105
- PASS — prediction collision parity 106
- PASS — no extra runtime errors
