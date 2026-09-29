# V0.11.1 — PWA FIX

- iPhone 安装到主屏幕后，不再以 `#game.getBoundingClientRect()` 反推自身高度。
- standalone 模式使用 `screen.height`（CSS px）作为 PWA 全屏高度权威值。
- Safari 浏览器模式继续使用 `visualViewport`，避免地址栏/键盘造成错误拉伸。
- `html`、`body`、`#game` 显式使用同一像素高度，取消 `inset:0 + height:auto` 的多套竞争规则。
- 主菜单背景强制覆盖完整 PWA 表面，内容仅在菜单内部滚动。
- 暂停、帮助、结束页固定为完整游戏高度，面板内部滚动。
- 旋转、pageshow、恢复前台、focus、visualViewport resize/scroll 均重新同步。
- Service Worker cache key 随新 index SHA 更新，避免继续启动旧 V0.11 HTML。
- V0.11 住宅区、原生住宅门窗、工业区、多人和 2v2 不改。
