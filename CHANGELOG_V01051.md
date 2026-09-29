# Crash Delivery V0.10.5.1 — TEXTURE DOORS / PWA FULLSCREEN

## 工业投递门
- 不再构建 V0.10.5 的额外 3D 卷帘门/门楼模型。
- V0.10.3 的 receiving-bays-and-hardstand 3D 收货块在运行时移除，不再绘制。
- #107–#112 的卷帘门、仓库门、集装箱门、编号统一改成 Canvas/WebGL 贴图 Decal。
- 门贴图直接贴在 Kenney 厂房正面；投递碰撞仍使用原来的不可见 Trigger，不改变判定规则。
- 黄色装卸区也改成地面 Decal，保持 2–4 m 小装卸前场。
- #111 玻璃目标继续使用 V0.10.2 的可破洞玻璃贴图系统。

## PWA
- 主菜单、游戏画面、暂停/帮助/结束页统一使用同一个实际应用高度。
- iPhone standalone 模式额外使用 screen.height 作为全屏高度兜底。
- 主菜单改为内部滚动；safe-area 只用于内容间距，不再缩短整个根容器。
- pageshow、resize、orientationchange、visualViewport resize/scroll、恢复前台时重新同步高度。

## 保留
- V0.10.5 灰色工业水泥地、库门朝地面道路、门架式绿色指路牌、货车接触阴影。
- SKYWAY 100 km/h、交通罚款、18 单、多人与 2v2。
- 联机协议：crash-delivery-mp01051-1。
