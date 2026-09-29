# Crash Delivery V0.10.5.1 测试报告

## 构建/静态验证
- PASS — 主界面显示 `V0.10.5.1 ONLINE / TEXTURE DOORS`
- PASS — 联机协议 `crash-delivery-mp01051-1`
- PASS — V0.10.5 额外 3D 厂房门面不再构建
- PASS — `receiving-bays-and-hardstand` 收货 3D 块从工业 chunks 中移除
- PASS — 工业门使用 Canvas → WebGL Texture Decal
- PASS — 门编号直接绘制在贴图中
- PASS — 黄色装卸前场使用地面贴图/Decal
- PASS — 原 `industrial012.targets` / `ind012TargetHit` 不可见投递 Trigger 保留
- PASS — 玻璃破洞贴图系统保留
- PASS — PWA standalone 使用 `screen.height` 全屏兜底
- PASS — 主菜单采用内部滚动，不再依赖内容高度撑满页面
- PASS — 6 个内联 JavaScript 块全部通过 `node --check`
- PASS — `build.py` 从固定 V0.10.5 baseline 成功重建

## 真机仍需验收
当前运行环境不能替代 iPhone standalone PWA。部署后请重点检查：
1. 主菜单底部是否一直铺到 Home Indicator；
2. 游戏与暂停页是否无额外深色空白；
3. #107–#112 是否只看到贴在厂房墙面的门，不再出现外挂黑色门楼；
4. 卷帘门贴图是否与墙面朝向一致；
5. 包裹仍能从车上投进不可见收货 Trigger；
6. #111 玻璃破洞仍正常。
