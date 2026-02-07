/**
 * API 服务模块
 * 注册 WebUI API 路由（无认证模式）
 * 
 * NapCat 路由器提供两种注册方式：
 * - router.get / router.post：需要认证（NapCat WebUI 登录后才能访问）
 * - router.getNoAuth / router.postNoAuth：无需认证（插件自己的 WebUI 页面可直接调用）
 * 
 * 一般插件自带的 WebUI 页面使用 NoAuth 路由，因为页面本身已在 NapCat WebUI 内嵌展示。
 */

import type { NapCatPluginContext, PluginHttpRequest, PluginHttpResponse } from 'napcat-types/napcat-onebot/network/plugin/types';
import { pluginState } from '../core/state';
import {
    getVersionMatchResult,
    getRecommendedLinks,
    getCurrentQQInfo,
    getNapCatVersion,
    getCurrentPlatform,
    clearCache
} from './github-service';
import {
    getQQInstallInfo,
    getInstallProgress,
    resetInstallProgress,
    startInstall,
    isInstallRunning
} from './install-service';

/**
 * 解析请求体
 * PluginHttpRequest.body 已由框架解析
 */
function parseBody(req: PluginHttpRequest): Record<string, unknown> {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body as object).length > 0) {
        return req.body as Record<string, unknown>;
    }
    return {};
}

/**
 * 注册 API 路由
 * @param ctx 插件上下文
 */
export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;

    // ==================== 基础接口（无认证）====================

    // 插件信息
    router.getNoAuth('/info', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        res.json({
            code: 0,
            data: { pluginName: ctx.pluginName }
        });
    });

    // 状态接口
    router.getNoAuth('/status', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        res.json({
            code: 0,
            data: {
                pluginName: pluginState.pluginName,
                uptime: pluginState.getUptime(),
                uptimeFormatted: pluginState.getUptimeFormatted(),
                config: pluginState.getConfig(),
                stats: pluginState.stats
            }
        });
    });

    // ==================== 配置接口（无认证）====================

    // 获取配置
    router.getNoAuth('/config', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        res.json({ code: 0, data: pluginState.getConfig() });
    });

    // 保存配置
    router.postNoAuth('/config', async (req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            const body = parseBody(req);
            pluginState.setConfig(ctx, body as Partial<import('../types').PluginConfig>);
            pluginState.log('info', '配置已保存');
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            pluginState.log('error', '保存配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // ==================== QQ 版本查询接口（无认证）====================

    // 获取完整版本匹配信息（所有平台下载链接）
    router.getNoAuth('/version', async (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            const result = await getVersionMatchResult(ctx);
            if (!result) {
                return res.status(502).json({ code: -1, message: '获取 Release 信息失败' });
            }
            res.json({ code: 0, data: result });
        } catch (e) {
            pluginState.log('error', '获取版本信息失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    // 获取当前平台推荐的下载链接
    router.getNoAuth('/version/recommended', async (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            const { result, recommended } = await getRecommendedLinks(ctx);
            if (!result) {
                return res.status(502).json({ code: -1, message: '获取 Release 信息失败' });
            }
            res.json({
                code: 0,
                data: {
                    ...result,
                    downloadLinks: recommended,
                    platform: getCurrentPlatform()
                }
            });
        } catch (e) {
            pluginState.log('error', '获取推荐版本失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    // 获取当前运行环境信息
    router.getNoAuth('/version/current', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            const qqInfo = getCurrentQQInfo(ctx);
            res.json({
                code: 0,
                data: {
                    napcatVersion: getNapCatVersion(),
                    qqVersion: qqInfo.version,
                    qqBuild: qqInfo.build,
                    platform: getCurrentPlatform()
                }
            });
        } catch (e) {
            pluginState.log('error', '获取当前版本信息失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    // 清除缓存并重新获取
    router.postNoAuth('/version/refresh', async (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            clearCache();
            const result = await getVersionMatchResult(ctx);
            if (!result) {
                return res.status(502).json({ code: -1, message: '刷新失败' });
            }
            res.json({ code: 0, data: result });
        } catch (e) {
            pluginState.log('error', '刷新版本信息失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    // ==================== QQ 安装接口（无认证）====================

    // 获取 QQ 安装信息（安装路径、当前版本、平台等）
    router.getNoAuth('/install/info', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            const info = getQQInstallInfo(ctx);
            res.json({ code: 0, data: info });
        } catch (e) {
            pluginState.log('error', '获取安装信息失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    // 获取安装进度
    router.getNoAuth('/install/progress', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            const progress = getInstallProgress();
            res.json({ code: 0, data: progress });
        } catch (e) {
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    // 开始安装 QQ（传入下载链接信息，仅 Linux 支持）
    router.postNoAuth('/install/start', async (req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            // Windows / Mac 不支持自动安装
            if (process.platform === 'win32') {
                return res.status(400).json({ code: -1, message: 'Windows 平台不支持自动安装，请手动下载安装包进行安装' });
            }
            if (process.platform === 'darwin') {
                return res.status(400).json({ code: -1, message: 'macOS 平台不支持自动安装，请手动下载 DMG 安装包进行安装' });
            }

            if (isInstallRunning()) {
                return res.status(409).json({ code: -1, message: '已有安装任务正在进行中' });
            }

            const body = parseBody(req);
            const { url, label, platform, arch, format } = body;

            if (!url || typeof url !== 'string') {
                return res.status(400).json({ code: -1, message: '缺少下载链接 url' });
            }

            const link = {
                url: url as string,
                label: (label as string) || '',
                platform: (platform as 'windows' | 'linux' | 'mac' | 'unknown') || 'unknown',
                arch: (arch as 'x64' | 'arm64' | 'unknown') || 'unknown',
                format: (format as 'exe' | 'deb' | 'rpm' | 'dmg' | 'unknown') || 'unknown',
            };

            // 异步执行安装，立即返回
            startInstall(ctx, link).catch((err: unknown) => {
                pluginState.log('error', '安装任务异常:', err);
            });

            res.json({ code: 0, message: '安装任务已启动' });
        } catch (e) {
            pluginState.log('error', '启动安装失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    // 重置安装状态
    router.postNoAuth('/install/reset', (_req: PluginHttpRequest, res: PluginHttpResponse) => {
        try {
            resetInstallProgress();
            res.json({ code: 0, message: 'ok' });
        } catch (e) {
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    pluginState.logDebug('API 路由注册完成');
}
