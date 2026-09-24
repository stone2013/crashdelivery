# 更新日志

## V0.7.2 — Cloudflare TURN Fallback

- 保留 V0.7.1 的 P2P 优先与联机玩法，新增 Cloudflare Realtime TURN 凭据 Worker 接入。
- 游戏仅请求 `https://api.feelpal.app/turn-credentials` 获取短期 ICE 配置；长期 TURN 凭据仅应保存在 Worker Secrets。
- 已加入 TURN URL 清理逻辑；强制 relay 自检只有实际收集到 `relay` candidate 才算通过。
- 此版本的实际 TURN relay 与异网真机验收仍待完成。

## V0.7.1 — PUBLIC NET / 公网联机稳定版

- 联机协议升级到 `crash-delivery-mp071-1`。
- 显式 STUN / TURN RTC 配置，支持自动、仅直连、强制 relay 三种策略。
- 新增网络设置页与 ICE candidate 自检。
- HUD 显示 P2P / TURN 及 RTT；暂停页显示链路状态。
- 客机断线自动重连最多 4 次，房主保留权威世界等待重新接入。
- 键盘、手机驾驶控件按下 / 松开立即发送输入，降低 50ms 周期同步带来的延迟。
- 房主处理离散动作后立即发送权威世界快照。
- 世界快照增加单调序号，客机丢弃陈旧快照。
- 默认不内置 TURN 私钥；用户可通过 UI 或 `window.CRASH_NETWORK_CONFIG` 提供自己的 TURN。
- 保留 V0.7 的三个城区、18 单、14 辆交通车、事故绕行、双人协作、昵称、车库与下车维修。

### 验证边界

- 本地双浏览器权威同步与 UI 回归通过。
- 执行环境原生 RTC 仍未产生 ICE candidate，不能据此宣称公网 NAT/TURN 真机通过。
- 使用真实 TURN 前应在「网络设置 → 测试 ICE / TURN」确认出现 `relay`。
