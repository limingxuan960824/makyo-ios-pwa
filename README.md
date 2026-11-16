# 魔强统一战 iPhone 启动器

这是一个不包含 ROM 的 PWA 外壳。游戏文件只在首次导入时保存到当前设备的 IndexedDB，不会上传到服务器。

## 本地运行

```powershell
node server.mjs
```

打开 `http://127.0.0.1:4173`，选择编号为 `GM G-004122-00` 的 Mega Drive ROM。

## iPhone 安装

1. 用 Safari 打开部署后的 HTTPS 地址。
2. 点击分享按钮，选择“添加到主屏幕”。
3. 将 ROM 放进 iPhone 的“文件”应用，首次启动时选择该文件。

模拟器核心来自 EmulatorJS 的稳定 CDN，第一次启动游戏需要联网。加载完成后，核心资源和应用外壳会缓存到设备。
