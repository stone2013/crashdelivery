# 暴力快递 V0.7.2 ONLINE · Cloudflare TURN fallback

V0.7.2 优先使用 Cloudflare Realtime TURN。Cloudflare TURN 长期 key 只保存在 Worker Secret，浏览器通过自定义 `api` 子域名获取短期 `iceServers`，不会写入前端或 GitHub。

V0.7.1 基于 V0.7 城市交通版继续开发，重点不是新增地图，而是把跨网络联机做成可诊断、可配置、可恢复的版本。

## 这一版新增

- **显式 STUN / TURN 配置**：默认使用 `stun:stun.l.google.com:19302` 尝试 P2P；可在游戏菜单的「网络设置」填入自己的 TURN URL、用户名与 credential。
- **三种策略**：自动（P2P 优先 + TURN 兜底）、仅直连、强制 TURN。
- **ICE 自检**：不需要另一名玩家，也可以在本机收集 ICE candidate。出现 `srflx` 表示 STUN 获取到公网候选；出现 `relay` 才说明 TURN 中继可用。
- **链路诊断**：联机 HUD 会显示房间码、P2P / TURN 链路和 RTT；暂停页也会显示网络状态。
- **断线恢复**：客机断线后最多自动重试 4 次；房主保留房间和权威世界，等待队友重新接入。断线时暂停车辆避免失控。
- **即时输入发送**：键盘和手机踏板/方向按钮在按下、松开时立即发送输入，不再完全依赖 50ms 周期包，降低网络操作延迟。
- **动作后即时权威快照**：开门、换岗、投递等动作由房主裁定后立即发送一次世界快照，减少等待下一周期同步的延迟。
- **世界快照序号**：客机拒绝旧快照，降低重连或排队消息导致状态回滚的风险。
- V0.7 的 18 单、三城区、交通 AI、事故绕行、昵称、指定包裹、下车回收、维修、车库全部保留。

## 公网联机怎么用

### 1. 没有 TURN 时

双方打开同一个 V0.7.1 页面，一人创建房间，另一人输入房间码。游戏会用 STUN 尝试建立 WebRTC P2P。

这在很多家庭宽带 / Wi-Fi 网络之间可以工作，但**不能保证所有 NAT / 蜂窝网络组合都能直连**。

### 2. 要提高成功率：配置 TURN

进入：

`主菜单 → 网络设置`

填写：

- TURN 地址，例如 `turn:turn.example.com:3478`
- 用户名
- credential / 密码
- 连接策略选择“自动”即可

然后先点 **测试 ICE / TURN**。只有测试结果出现 `relay`，才能说明浏览器实际拿到了 TURN relay candidate。

如果要验证“确实走中继”，选择 **强制 TURN 中继**，两边都使用同一套有效 TURN 配置，再创建 / 加入房间。

> V0.7.1 **不会内置任何第三方 TURN 密钥**。TURN 会产生服务器流量，公共共享凭据也可能失效，所以应使用你自己的 TURN 服务或正规供应商凭据。

### 3. 诊断含义

- `host`：本机候选。
- `srflx`：STUN 得到的公网映射候选。
- `relay`：TURN 中继候选。
- `P2P 直连`：当前选中的链路不是 relay。
- `TURN 中继`：实际 selected candidate pair 使用了 relay。

## 部署

网站入口仍是根目录 `index.html`。如果部署到 `stone2013/crashdelivery`，把这个文件替换仓库根目录的 `index.html` 即可。

双方必须都使用 **V0.7.1**；联机协议为：

`crash-delivery-mp071-1`

邀请链接仍支持 `?room=123456`。

## TURN 配置的另一种方式

除了游戏 UI，还可以在加载游戏前设置：

```js
window.CRASH_NETWORK_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
    ]
  }
};
```

`window.CRASH_NETWORK_CONFIG.config` 会作为 PeerJS / RTCPeerConnection 配置覆盖游戏内默认 RTC 配置。

## 测试

本构建 SHA-256：`33215bd85d4046fa6f7670c721f1a550d8107f5f72a7970bc082bf675c4e5cf5`。

已重新通过：

- 单人 / 物理 / 车库：31 / 31
- 四种尺寸与触控：32 / 32
- 18 单完整投递：21 / 21
- 双客户端权威同步：30 / 30
- 城市交通：24 / 24
- 城市长期 / 地图 / 双端：26 / 26
- V0.7.1 网络设置 / TURN 配置 UI：24 / 24

另外运行了实际 Chromium 的 ICE 自检 UI。本执行环境得到 **0 个 ICE candidate**，与此前原生 RTC 探针一致，因此这里**不能宣称真实公网 WebRTC / TURN 已经通过**。这正是 V0.7.1 新增诊断界面的用途：部署后可在你的真实 Wi-Fi、蜂窝网络和 TURN 服务上直接看到候选类型。

尚未验证：

- iPhone 蜂窝网络 ↔ Mac Wi-Fi 的真实异网 PeerJS 会话
- 中国大陆 ↔ 海外 NAT 组合
- 有效生产 TURN 的 relay candidate
- Safari 真机断线重连

## 安全说明

如果你在网络设置中点击“保存到本机”，TURN 凭据会保存在当前浏览器的 `localStorage` 中。不要在公共电脑保存长期有效的 TURN 密钥；可随时点“清除 TURN 凭据”。TURN 凭据不会进入游戏房间快照或发给另一名玩家。
