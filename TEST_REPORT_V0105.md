# Crash Delivery V0.10.5 测试报告

## 已通过
- V0.10.5 主界面版本 / title / 联机协议静态检查。
- 6 个内联 JavaScript script block 全部通过 `node --check`。
- `build.py` 从固定 V0.10.4 baseline 重建的 candidate 与交付 `index.html` SHA-256 完全一致。
- 工业区连续水泥地坪代码存在并使用低于道路的高度层，避免覆盖 Kenney 路面。
- 厂房视觉模型使用 180° frontage 翻转；临街自定义仓库门继续绑定 `h.model`，并保留 2–4 m 装卸前场。
- 旧的路侧宽幅 `sign-highway` 实例已移除；门架式 CITY / INDUSTRY / SKYWAY 指路牌存在。
- 原 3.8×8m 矩形货车 shadow mesh 已删除；改为 4 个轮胎接触阴影 + 窄底盘接触阴影。
- `manifest.webmanifest`、Service Worker cache 版本和 V0.10.5 名称已同步。
- PWA 根容器、Canvas、HUD 与暂停层使用同一 `--appH`，并监听 iOS 常见 viewport 变化事件。

## 浏览器测试限制
本执行环境的 Chromium 被组织策略禁止访问 `127.0.0.1` 和 `file://` 页面，因此本轮无法在这里完成本地 WebGL 页面截图/交互回归。没有把这个限制冒充成“浏览器测试通过”。

建议部署后在 iPhone PWA 重点验收：
1. 暂停页和游戏画面底部不再出现额外深色空白条；
2. 工业区为连续灰色水泥地；
3. 库门朝向地面道路，门到路边有一小段装卸区；
4. 货车底部不再出现整块矩形阴影；
5. 绿色宽幅方向牌横跨道路上方，而不是放在路边。
