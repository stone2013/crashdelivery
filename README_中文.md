# 暴力快递 V0.9.4 — ALL ROADS

## 这次是全城道路替换

住宅区、商业街、工业区现在和 SKYWAY 一样使用 Kenney City Kit Roads 2.1。原 25 个节点、38 条街道、18 件指定包裹没有重新排布；旧路板不再渲染。三个城区使用 101 块道路模块，十字口、丁字口和弯道根据实际出口旋转连接。

灯杆放在路外、灯臂朝路面；路牌和信号灯正面面向来车。64 个城区信号灯使用与交通 AI、罚款一致的时序。草地继续允许开车，暂停页保留退出。

## 怎么玩

首页选择“全城新路 · 单人派送”，一开始就能看到新道路，不需要先去试验区。“立体路网试跑”依旧单独提供高架、上下坡、环岛与桥下通行；城区东边可以直接开到试验区。

原多人合作、4 人大厅、2v2 和高延迟人物移动实现继续保留。2v2 使用已替换的城区道路，仍不开放 SKYWAY 试跑传送或高架对战。普通单人/合作保留闯红灯 $80 与分级撞车罚款；没有将其改写成 2v2 新计分规则。

电脑：WASD 行驶/走路，B 放砖，V 离座/上下车，E 交互，G 后门，F 辅助瞄准，Q/左键投掷，空格跳跃，R 放下，M 订单，N 城市地图，J 高架导览，Esc 暂停。手机使用情境按钮，支持横竖屏。

## 更新和部署

`crash_delivery_v0.9.4_changed_files.zip` 是相对完整 V0.9.3 的增量包：解压后覆盖同名相对路径，**不能删除原目录或用这个包新建不完整源码仓库**。尤其保留原来的图标、许可证、基线 HTML 以及已有 GLB。

只发布网站时，可使用 `crash_delivery_v0.9.4_deploy.zip`：这是干净的完整静态运行文件，不是源码项目。它包含 index.html、sw.js、manifest、PNG 图标及许可证。所有道路网格和颜色图已嵌入 HTML；单人加载不需访问模型 CDN。多人仍需原有在线信令/房间/TURN 服务。

先备份当前网站，再一起更新 index.html、sw.js、manifest.webmanifest。确认菜单为 **V0.9.4 ONLINE / ALL ROADS**，所有玩家均升级到同版本；新协议 crash-delivery-mp094-1 不与旧版混连。PWA 检测新版后按提示更新，不必清除存档。首次联网成功缓存后可离线打开单人；file:// 不启用 Service Worker。

本次未提交 GitHub、未修改域名或 Cloudflare Worker。请勿把长期 API Token/TURN 密钥放进任何发布文件。

## 开发重建

在完整 V0.9.3 项目应用增量包后运行：

```
python build.py
```

构建校验固定 `src/v08-baseline.html`，使用 src/city-roads-v094.js、src/roads-v09.js、22 个原始 GLB 及 PWA 文件生成 index.html。构建时有 Node 会执行 JS 语法检查。游戏运行不用 Python/Node。

查看 `TEST_REPORT_V094.md` 获取本次实际测试和边界；没有宣称 iPhone PWA、TURN 公网、全程 2v2 或手机帧率已真机验收。许可证原文保留在 licenses/。
