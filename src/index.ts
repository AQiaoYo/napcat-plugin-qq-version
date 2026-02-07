/**
 * QQ 版本查询插件
 * 
 * 查询推荐的 QQ 版本与下载链接，支持在线更新升级。
 * 主要功能：
 * - 获取推荐 QQ 版本信息
 * - 提供各平台 QQ 下载链接
 * - WebUI 管理面板
 * 
 * @author AQiaoYo
 * @license MIT
 */

import type { PluginConfigSchema, PluginConfigUIController } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { NapCatPluginContext, PluginHttpRequest, PluginHttpResponse } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { OB11Message } from 'napcat-types/napcat-onebot';
import { EventType } from 'napcat-types/napcat-onebot/event/index';

import { initConfigUI } from './config';
import { pluginState } from './core/state';
import { registerApiRoutes } from './services/api-service';
import { initVersionInfo } from './services/github-service';
import type { PluginConfig } from './types';

/** 框架配置 UI Schema，NapCat WebUI 会读取此导出来展示配置面板 */
export let plugin_config_ui: PluginConfigSchema = [];

/**
 * 插件初始化函数
 * 负责加载配置、注册 WebUI 路由
 */
const plugin_init = async (ctx: NapCatPluginContext) => {
    try {
        // 初始化状态和加载配置
        pluginState.initFromContext(ctx);
        pluginState.loadConfig(ctx);
        pluginState.log('info', `初始化完成 | name=${ctx.pluginName}`);

        // 初始化版本信息（通过 OneBot API 获取 NapCat 版本）
        await initVersionInfo(ctx);

        // 生成配置 schema 并导出（用于 NapCat WebUI 配置面板）
        try {
            const schema = initConfigUI(ctx);
            plugin_config_ui = schema || [];
        } catch (e) {
            pluginState.logDebug('initConfigUI 未实现或抛出错误，已跳过');
        }

        // 注册 WebUI 路由
        try {
            const router = ctx.router;

            // 静态资源目录
            if (router) router.static('/static', 'webui');

            // 插件信息脚本（用于前端获取插件名）
            router.get('/static/plugin-info.js', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
                try {
                    res.setHeader('Content-Type', 'application/javascript');
                    res.send(`window.__PLUGIN_NAME__ = ${JSON.stringify(ctx.pluginName)};`);
                } catch (e) {
                    res.status(500).send('// failed to generate plugin-info');
                }
            });

            // 注册 API 路由（无认证）
            registerApiRoutes(ctx);

            // 注册配置页面
            if (router && router.page) {
                router.page({
                    path: 'plugin-config',
                    title: 'QQ 安装管理',
                    icon: '�',
                    htmlFile: 'webui/index.html',
                    description: '管理 QQ 版本下载与安装'
                });
            }
        } catch (e) {
            pluginState.log('warn', '注册 WebUI 路由失败', e);
        }

        pluginState.log('info', '插件初始化完成');
    } catch (error) {
        pluginState.log('error', '插件初始化失败:', error);
    }
};

/**
 * 消息处理函数
 * 当收到消息时触发
 */
const plugin_onmessage = async (ctx: NapCatPluginContext, event: OB11Message) => {
    // 插件现在仅通过 WebUI 操作，不再处理聊天指令
    return;
};

/**
 * 插件卸载函数
 * 在插件被卸载时调用，用于清理资源
 */
const plugin_cleanup = async (ctx: NapCatPluginContext) => {
    try {
        // TODO: 在这里添加你的清理逻辑
        // 示例：清理临时文件
        // const fs = await import('fs');
        // const path = await import('path');
        // const tempDir = path.join(pluginState.dataPath, 'temp');
        // if (fs.existsSync(tempDir)) {
        //     fs.rmSync(tempDir, { recursive: true, force: true });
        // }
        pluginState.log('info', '插件已卸载');
    } catch (e) {
        pluginState.log('warn', '插件卸载时出错:', e);
    }
};

/** 获取当前配置 */
export const plugin_get_config = async (ctx: NapCatPluginContext) => {
    return pluginState.getConfig();
};

/** 设置配置（完整替换） */
export const plugin_set_config = async (ctx: NapCatPluginContext, config: PluginConfig) => {
    pluginState.logDebug(`plugin_set_config 调用: ${JSON.stringify(config)}`);
    pluginState.replaceConfig(ctx, config);
    pluginState.log('info', '配置已通过 API 更新');
};

/**
 * 配置变更回调
 * 当 WebUI 中修改配置时触发
 */
export const plugin_on_config_change = async (
    ctx: NapCatPluginContext,
    ui: PluginConfigUIController,
    key: string,
    value: unknown,
    currentConfig?: Record<string, unknown>
) => {
    try {
        pluginState.logDebug(`plugin_on_config_change: key=${key}, value=${JSON.stringify(value)}`);
        pluginState.setConfig(ctx, { [key]: value });
        pluginState.logDebug(`配置项 ${key} 已更新`);
    } catch (err) {
        pluginState.log('error', `更新配置项 ${key} 失败:`, err);
    }
};

// 导出生命周期函数
export {
    plugin_init,
    plugin_onmessage,
    plugin_cleanup
};
