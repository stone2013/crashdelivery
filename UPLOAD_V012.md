# V0.12 GitHub 更新说明（仅新增/修改文件）

## 应用到哪个版本

本包以本次聊天中上传的 `crashdelivery-v0.11.2-physics-hotfix.zip` 为基线。不是全量项目；请保留仓库中所有未出现在包里的文件。无需删除任何旧文件。

## 上传

解压后，保持包内目录结构，把内容合并到原仓库根目录。同名文件覆盖；新增文件夹合并。

- `index.html`、`sw.js`、`VERSION.json`：网页、离线缓存和版本信息，必须一起更新。
- `assets/kenney-commercial/`、`assets/kenney-cars/`、`assets/kenney-environment/`：新模型、调色板和授权，必须保持路径完整。
- `build.py` 与 `src/v012/`：可复现构建源代码，避免后续构建退回旧版；也一并提交。
- 说明与 `tests/v012/`：更新清单和可重跑的测试；不增加游戏运行依赖。

**不要只上传 index.html，不要把 ZIP 文件本身当作网站文件，也不要把新 assets 文件夹中的模型拍平到仓库根目录。**

部署完成后联网重新打开游戏，看到 `V0.12.0 CITY EXPANSION`，等待“城市已就绪”。已安装 PWA 的用户按页面更新提示加载新版本；版本仍旧时关闭游戏窗口后重新打开。第一次成功联网加载并完成 Service Worker 缓存之前，不保证离线可启动。

联机双方应更新到 V0.12，协议版本不同的旧客户端不能混用。

未修改 CNAME、自定义域名、Cloudflare Worker、TURN 密钥或网络服务地址；没有替你推送 GitHub，也没有删除远端内容。

## 本地构建与测试

不需要 npm 或重新下载素材。

```sh
# 生成候选页面，原 index.html / sw.js / VERSION.json 保持不变
python build.py --output candidate.html

# 确认后重建根输出及离线缓存清单
python build.py

# 可选：已安装 Python Playwright 和 Chromium 时，运行 CPU/DOM 回归
python tests/v012/regression.py --chromium /path/to/chromium
```

CPU/DOM 回归使用仅测试用的 WebGL 空实现，真实游戏代码、模型解析、物理与 DOM 均运行，但**不等于通过原生 WebGL/手机性能验收**。测试适配器只在测试脚本中注入，不会进入发布网页。

包中 `PATCH_FILES_V012.txt` 是真实差异文件列表；原始测试数据在 `tests/v012/release-results.json`。
