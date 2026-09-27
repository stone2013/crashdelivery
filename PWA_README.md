# Crash Delivery — PWA build

基线：用户上传的 `crashdelivery-main.zip` 当前 main。
已验证该 index.html 含 V0.8.0 2v2 runtime / DeliveryDuel2v2，不是旧 V0.5。

PWA：
- iPhone / iPad：Safari → 分享 → 添加到主屏幕
- Android / Chrome / Edge：浏览器安装 PWA
- `index.html` 导航采用 network-first；断网时可回退到最近缓存版本
- TURN credentials 与 `/rooms` 实时接口绝不缓存
- 多人游戏仍必须联网

部署要求：HTTPS（或 localhost）。
