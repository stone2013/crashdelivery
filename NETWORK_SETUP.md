# V0.7.2 公网联机：Cloudflare Realtime TURN

当前方案：P2P 优先，Cloudflare Realtime TURN fallback。Ubuntu coturn 暂不使用。

## 当前线上配置

- 游戏域名：`https://game.feelpal.app`，Cloudflare DNS 的 CNAME 指向 `stone2013.github.io`（DNS only）。
- 凭据 Worker：`crashdelivery-turn-credentials`，Production 自定义域名为 `api.feelpal.app`。
- Worker `ALLOWED_ORIGIN` 已限制为 `https://game.feelpal.app`；短期 ICE 凭据 TTL 为 3600 秒。
- Worker 必需的 `TURN_KEY_ID` 和 `TURN_API_TOKEN` 尚未安全配置；最近一次接口检查返回 `worker_not_configured`。
- 一张聊天截图曾显示 TURN 凭据，添加新值前应先在 Cloudflare Realtime 撤销旧 TURN Key 并创建新的 production key。不要复制旧值，也不要将任何凭据放进仓库、前端、日志或聊天。

## 配置 Worker Secrets

在 Cloudflare Realtime TURN 中创建新的 production key。Worker 需要该 key 对应的 Turn Token ID 与 API Token。然后在 **Workers & Pages → `crashdelivery-turn-credentials` → Settings → Runtime variables and secrets** 中：

1. 添加 Secret `TURN_KEY_ID`，值为新 key 的 Turn Token ID。
2. 添加 Secret `TURN_API_TOKEN`，值为新 key 的 API Token。
3. Environment 选 Production，保持 Secret 开启，添加两项后点 Deploy。

只在 Cloudflare 控制台输入值。不要把截图、输出或临时文件中的实际凭据提交到 Git。

## 验收

1. 以只检查状态/字段、不打印 ICE 凭据的方式确认 `https://api.feelpal.app/turn-credentials` 成功返回 `iceServers`。
2. 在游戏 **网络设置 → ICE 自检** 开启强制 relay，必须实际看到 `relay` candidate；`host` 或 `srflx` 不算通过。
3. 最终用 Mac Wi-Fi 与 iPhone 5G 互相加入房间，验证双端同步、HUD 显示 TURN 中继/RTT、断线重连。

Worker 源码在 `turn-worker/src/index.js`，部署配置在 `turn-worker/wrangler.toml`。不要在本仓库运行 `wrangler secret put` 时把 Secret 值放入 shell 历史；优先从 Cloudflare Dashboard 的 Secret 表单由用户亲自输入。
