# Crash Delivery V0.10.3 — INDUSTRIAL DELIVERY FIX 测试报告

- PASS — 独立黑色门楼已删除
- PASS — 收货口嵌入厂房
- PASS — 临街退距 2.4m
- PASS — 主厂房最小宽度 >=18m
- PASS — 后排厂房最小宽度 >=15m
- PASS — 包裹成功后进入厂房内部
- PASS — 主界面 V0.10.3
- PASS — 协议 V0.10.3
- PASS — 玻璃破洞保留
- PASS — SKYWAY 100km/h 保留

## 尺度检查（米）
主厂房最差回退宽度： {"building-r": 25.03, "building-a": 21.7, "building-f": 18.34, "building-q": 21.21, "building-t": 18.22, "building-l": 21.18}

后排厂房目标宽度： {"building-a": 19.17, "building-r": 22.35, "building-q": 20.12, "building-f": 16.47, "building-t": 16.87, "building-l": 18.34}

## 运行边界
- 全部内联 JavaScript 已由 build.py 使用 `node --check` 通过。
- 当前执行环境禁止浏览器访问本地 HTTP/file URL，因此本轮无法在这里做最终 Chromium 实机页面截图。
- iPhone PWA、真实公网 TURN、完整多人长局仍需部署后真机验收。
