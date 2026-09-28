# Crash Delivery V0.9.2 — Collision + Sign + PWA Hotfix

- 桥墩加入实体碰撞，车辆不能再穿过高架桥柱。
- 上下坡两侧加入连续碰撞边界，保留坡顶可驾驶和桥下通行。
- 草地继续允许驾驶；本版没有把绿地改成硬墙。
- 路灯、交通灯、停止牌、警示牌和高速牌改为按车流方向朝向，并把支柱移出同高度车道。
- SKYWAY 路边牌整体后移，避免支柱侵入道路。
- PWA/iPhone 视口改用 visualViewport + standalone 全屏兜底，尝试填满底部安全区域；按钮仍使用 safe-area 避让。
- 保留 V0.9.1 闯红灯/撞车罚款、暂停菜单退出和多人房主权威结算。
- 联机协议更新为 `crash-delivery-mp092-1`。
