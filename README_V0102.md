# 暴力快递 V0.10.2 — 使用说明

## 哪个包用于什么
- `changed_files.zip`：覆盖完整 V0.10.1 INDUSTRIAL 工程相同路径。只含本轮修改/新增文件，不重复带 13 个工业 GLB、图标或原始基线。先保留自己的未提交修改。
- `deploy.zip`：独立完整网站发布包，包含 index、SW、manifest、3 个图标、13 个工业 GLB、颜色图和许可证。可直接发布到网站根目录；不包含完整开发工程。

不要把文件全部拖到同一级。必须保留 assets/kenney-industrial 与 icons 的目录结构。
本轮没有替你修改 GitHub、Cloudflare Worker、域名或 API 密钥。

## 打开游戏
在 HTTPS 网站访问 index.html。电脑本地测试可在解压目录运行 `python -m http.server 8000`，打开 `http://localhost:8000/`。
直接双击 file:// HTML 可能不能加载外部工业 GLB；本地 HTTP 或 HTTPS 才是支持的打开方式。
首次联网缓存成功后可离线单人；多人仍需联网。

首页确认 `V0.10.2 ONLINE / INDUSTRIAL+`。工厂配送为 #107–112；原 101–118 全部保留。
暂停菜单可切换“光影：柔和 / 省电”。不需要使用更改画面/数值的测试模式进行游玩。

## 老 PWA 更新
覆盖 index.html、sw.js、manifest.webmanifest 与对应改动后，先联网重开一次。
新版就绪后在首页使用“新版已就绪 · 结束本局后更新”，确认后刷新。不会在联机中途自动刷新。
如果首页仍是旧版本，先结束本局，在浏览器普通标签页打开同一地址确认部署版本，再重开主屏幕应用。
不要删除存档来解决版本问题。此包未改变原存档键。
多人建议所有参与者更新至 V0.10.2，协议为 crash-delivery-mp0102-1。

## 开发构建
build.py 使用 src/v010-baseline.html 的明确 SHA256 作保护，再加载 pocketgl-v0102.js / v0102-industrial.js / v0102-glass.js / v0102-lighting.js / v0102-qa.js。
不要用历史 source/ 或之前的 v0101-industrial.js 重新生成这个版本。
