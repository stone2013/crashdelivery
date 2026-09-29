# Crash Delivery V0.10.4 — 构建验证

- PASS：工业临街候选道路会排除附近存在 >2.25m 高架层的位置。
- PASS：工业建筑扩展脚印会检测高架/匝道安全缓冲区。
- PASS：主要配送厂房与配套厂房/设施均使用同一高架避让规则。
- PASS：Kenney 厂房模型正面与收货口统一朝向。
- PASS：2.4m 临街投递距离规则保留。
- PASS：V0.10.3 建筑尺寸分级、嵌入式收货口和玻璃破洞代码保留。
- PASS：SKYWAY / 双向路牌 / 交通罚款 / 驾驶隐藏跳跃规则保留。
- PASS：联机协议 `crash-delivery-mp0104-1`。
- PASS：全部内联 JavaScript 通过 `node --check`。

说明：这是代码和构建级验证；最终建筑视觉距离、iPhone PWA 与公网多人仍应在部署后真机验收。
