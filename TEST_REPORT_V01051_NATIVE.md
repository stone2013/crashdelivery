# V0.10.5.1 NATIVE DOORS 测试报告

## PASS
- 主界面版本：V0.10.5.1 ONLINE / NATIVE DOORS。
- 不新增工业库门 3D 模型。
- 不绘制新增工业库门贴图；上一版 `V01051` 门贴图绘制被禁用。
- 旧 `receiving-bays-and-hardstand` 收货几何从运行时 chunks 移除。
- #107–#112 的不可见 Trigger 重新贴到 Kenney 主厂房临街立面前。
- 只保留地面黄色细框作为可选提示。
- 厂房主体 collider 保留；旧收货口 bollard / dispatch-sill collider 移除。
- PWA `--appH51`、standalone `screen.height` 兜底与内部滚动逻辑保留。
- 6 个内联 JavaScript 块通过 `node --check`。
- `build.py` 从固定 V0.10.5.1 baseline 可重复构建。

## 真机验收重点
Kenney GLB 在游戏里由自定义 loader 烘焙成顶点色，运行时没有保留语义化“garage door”节点。因此本版以已经校正的“模型临街正面”作为原生库门立面，不生成任何替代门。请重点查看 #107–#112，确认选中的原模型该临街面确实带有你想要的库门；若某个模型本身没有库门，下一步应把该订单换到一个原生带库门的 Kenney building，而不是补画门。
