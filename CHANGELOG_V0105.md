# Crash Delivery V0.10.5 — INDUSTRIAL POLISH

## 工业区
- 工业区连续铺设灰色水泥地坪，普通道路仍保持深灰沥青。
- Kenney 工业建筑视觉模型翻转，使可视正面与临街收货面一致。
- #107–#112 的收货面继续绑定最近的地面普通道路，并保留约 2–4 m 的小型装卸前场。
- 在厂房临街侧增加清晰的仓库/卷帘门立面与黄色装卸边线，避免看到“后门/背墙”朝马路。

## 交通指示牌
- 移除 SKYWAY 原先放在路边的宽幅 highway sign。
- 新增真正跨道路的绿色门架式指路牌：支柱在道路两侧、横梁和绿色方向牌位于车道上方。
- 主要方向包含 CITY / INDUSTRY / SKYWAY。

## 车辆阴影
- 删除货车底下整块矩形假影子。
- 改为四轮接触阴影 + 车底窄接触阴影，仍使用轻量低模方案。
- 2v2 对手车辆复用同一接触阴影。

## PWA / iPhone
- 新增显式 `--appH` 视口同步。
- `#game`、Canvas、HUD 和暂停层强制使用同一实际应用高度。
- 在 resize / orientationchange / pageshow / visualViewport / 回到前台时重新同步。
- 暂停菜单改为自身滚动，safe-area 只用于内部安全间距，避免再次撑出底部空白。

## 兼容
- 保留 CITY LOOP、SKYWAY 100 km/h、18 单、玻璃破洞、交通罚款、多人合作、2v2、双向路牌和工业模型。
- 主界面：`V0.10.5 ONLINE / INDUSTRIAL POLISH`
- 联机协议：`crash-delivery-mp0105-1`
