# NapCat QQ版本查询插件

查询推荐的 QQ 版本与下载链接，支持在线更新升级。

## 📁 项目结构

```
napcat-plugin-qq-version/
├── src/
│   ├── index.ts              # 插件入口，导出生命周期函数
│   ├── config.ts             # 配置定义和 WebUI Schema
│   ├── types.ts              # TypeScript 类型定义
│   ├── core/
│   │   └── state.ts          # 全局状态管理单例
│   ├── handlers/
│   │   └── message-handler.ts # 消息处理器（已弃用指令解析，仅保留工具函数）
│   ├── services/
│   │   └── api-service.ts    # WebUI API 路由（无认证模式）
│   └── webui/                # React SPA 前端（独立构建）
```

## 🚀 功能说明

- **QQ版本查询**: 自动从 GitHub 获取 NapCat 推荐的 QQ 版本信息。
- **全平台支持**: 提供 Windows, Linux, macOS 各版本的下载链接。
- **WebUI 管理**: 提供美观的后台管理界面，支持一键配置、状态监控。
- **在线更新**: 在 WebUI 环境下支持部分环境的自动安装/更新（Beta）。

## 🛠️ 安装与构建

1. **安装依赖**
```bash
pnpm install
```

2. **完整构建**
```bash
# 构建前端并打包后端，产物在 dist/ 目录
pnpm run build
```

3. **部署**
将生成的 `dist` 文件夹放入 NapCat 的 `plugins` 目录下即可。

## 📄 开源协议

MIT
