# Crash Delivery V0.11.1 — PWA FIX 测试报告

## 已验证
- PASS — 主界面显示 `V0.11.1 ONLINE / PWA FIX`
- PASS — 联机协议更新为 `crash-delivery-mp0111-1`
- PASS — 6 个内联 JavaScript 块通过 `node --check`
- PASS — PWA 不再通过 `#game.getBoundingClientRect()` 循环反推自身高度
- PASS — standalone 模式使用 `screen.height` 作为 iOS 主屏幕应用高度兜底
- PASS — `html / body / #game` 共享同一个显式像素高度
- PASS — 主菜单背景覆盖完整 PWA 高度，菜单内容内部滚动
- PASS — 暂停/帮助/结束层固定为完整游戏高度，弹窗内部滚动
- PASS — `orientationchange / pageshow / resize / visualViewport / visibilitychange / focus` 均触发重新同步
- PASS — Service Worker cache key 已跟随新 `index.html` SHA 更新，旧 V0.11 cache 会在 activate 时清理
- PASS — V0.11 SUBURBAN 住宅模型和资源仍包含在完整部署包

## 需要 iPhone 真机验收
容器无法模拟 iOS standalone WebKit 的真实状态栏/Home Indicator 行为。部署后请分别检查：
1. 主菜单最底部到 Home Indicator 不再出现额外深色空白；
2. 游戏画面 Canvas 一直铺到底部；
3. 暂停页铺满；
4. 从后台切回游戏后高度不缩短；
5. 竖屏→横屏→竖屏后仍无空白。

如果旧 PWA 仍显示旧版，请先完全关闭已安装的 PWA，再重新打开；Service Worker 会安装 V0.11.1 cache。
