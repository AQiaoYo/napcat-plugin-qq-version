import { useState, useEffect, useCallback, useRef } from 'react'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'
import type { QQInstallInfo, InstallProgress, VersionRecommended, QQDownloadLink } from '../types'
import { IconDownload, IconRefresh, IconCheck, IconAlert, IconInfo } from '../components/icons'

/** 格式化字节 */
function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/** 格式化速度 */
function formatSpeed(bytesPerSec: number): string {
    if (!bytesPerSec || bytesPerSec <= 0) return '-'
    return formatBytes(bytesPerSec) + '/s'
}

/** 平台标签 */
function platformLabel(p: string): string {
    switch (p) {
        case 'windows': return 'Windows'
        case 'linux': return 'Linux'
        case 'mac': return 'macOS'
        default: return p
    }
}

/** 格式标签 */
function formatLabel(f: string): string {
    return f.toUpperCase()
}

/** 阶段中文描述 */
function stageLabel(stage: string): string {
    switch (stage) {
        case 'idle': return '就绪'
        case 'downloading': return '下载中'
        case 'extracting': return '解压中'
        case 'installing': return '安装中'
        case 'done': return '已完成'
        case 'error': return '失败'
        default: return stage
    }
}

/** 阶段颜色 */
function stageColor(stage: string): string {
    switch (stage) {
        case 'downloading': return 'text-blue-500'
        case 'extracting': return 'text-amber-500'
        case 'installing': return 'text-violet-500'
        case 'done': return 'text-emerald-500'
        case 'error': return 'text-red-500'
        default: return 'text-gray-400'
    }
}

/** 进度条颜色 */
function progressBarColor(stage: string): string {
    switch (stage) {
        case 'downloading': return 'bg-blue-500'
        case 'extracting': return 'bg-amber-500'
        case 'installing': return 'bg-violet-500'
        case 'done': return 'bg-emerald-500'
        case 'error': return 'bg-red-500'
        default: return 'bg-gray-400'
    }
}

export default function InstallPage() {
    const [installInfo, setInstallInfo] = useState<QQInstallInfo | null>(null)
    const [versionData, setVersionData] = useState<VersionRecommended | null>(null)
    const [progress, setProgress] = useState<InstallProgress | null>(null)
    const [loading, setLoading] = useState(true)
    const [installing, setInstalling] = useState(false)
    const [selectedLink, setSelectedLink] = useState<QQDownloadLink | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // 获取安装信息
    const fetchInstallInfo = useCallback(async () => {
        try {
            const res = await noAuthFetch<QQInstallInfo>('/install/info')
            if (res.code === 0 && res.data) setInstallInfo(res.data)
        } catch { /* ignore */ }
    }, [])

    // 获取推荐版本
    const fetchVersion = useCallback(async () => {
        try {
            const res = await noAuthFetch<VersionRecommended>('/version/recommended')
            if (res.code === 0 && res.data) {
                setVersionData(res.data)
                // 自动选择第一个推荐链接
                if (res.data.downloadLinks?.length > 0 && !selectedLink) {
                    setSelectedLink(res.data.downloadLinks[0])
                }
            }
        } catch { /* ignore */ }
    }, [selectedLink])

    // 获取安装进度
    const fetchProgress = useCallback(async () => {
        try {
            const res = await noAuthFetch<InstallProgress>('/install/progress')
            if (res.code === 0 && res.data) {
                setProgress(res.data)
                // 安装完成或失败时停止轮询
                if (res.data.stage === 'done' || res.data.stage === 'error') {
                    setInstalling(false)
                    if (pollRef.current) {
                        clearInterval(pollRef.current)
                        pollRef.current = null
                    }
                    if (res.data.stage === 'done') {
                        showToast('QQ 安装完成！重启后生效', 'success')
                    } else if (res.data.stage === 'error') {
                        showToast(res.data.error || '安装失败', 'error')
                    }
                }
            }
        } catch { /* ignore */ }
    }, [])

    // 初始加载
    useEffect(() => {
        setLoading(true)
        Promise.all([fetchInstallInfo(), fetchVersion(), fetchProgress()])
            .finally(() => setLoading(false))
    }, [fetchInstallInfo, fetchVersion, fetchProgress])

    // 安装中轮询进度
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [])

    // 刷新版本信息
    const handleRefresh = async () => {
        setLoading(true)
        try {
            await noAuthFetch('/version/refresh', { method: 'POST' })
            await Promise.all([fetchInstallInfo(), fetchVersion()])
            showToast('已刷新版本信息', 'success')
        } catch {
            showToast('刷新失败', 'error')
        } finally {
            setLoading(false)
        }
    }

    // 开始安装
    const handleInstall = async () => {
        if (!selectedLink) {
            showToast('请先选择安装包', 'warning')
            return
        }

        if (installing) return

        setInstalling(true)
        try {
            const res = await noAuthFetch('/install/start', {
                method: 'POST',
                body: JSON.stringify(selectedLink),
            })
            if (res.code !== 0) {
                showToast(res.message || '启动安装失败', 'error')
                setInstalling(false)
                return
            }
            showToast('安装任务已启动', 'info')
            // 开始轮询进度
            pollRef.current = setInterval(fetchProgress, 800)
        } catch (e) {
            showToast('启动安装失败', 'error')
            setInstalling(false)
        }
    }

    // 重置状态
    const handleReset = async () => {
        try {
            await noAuthFetch('/install/reset', { method: 'POST' })
            setProgress(null)
            setInstalling(false)
            showToast('已重置', 'info')
        } catch { /* ignore */ }
    }

    if (loading && !installInfo) {
        return (
            <div className="flex items-center justify-center h-64 empty-state">
                <div className="flex flex-col items-center gap-3">
                    <div className="loading-spinner text-primary" />
                    <div className="text-gray-400 text-sm">正在获取版本信息...</div>
                </div>
            </div>
        )
    }

    const isActive = progress && (progress.stage === 'downloading' || progress.stage === 'extracting' || progress.stage === 'installing')
    const isDone = progress?.stage === 'done'
    const isError = progress?.stage === 'error'

    return (
        <div className="space-y-6 stagger-children">
            {/* 当前环境信息 */}
            <div className="card p-5 hover-lift">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <IconInfo size={16} className="text-gray-400" />
                        当前环境
                    </h3>
                    <button onClick={handleRefresh} className="btn-ghost btn text-xs px-2.5 py-1.5" disabled={loading || !!isActive}>
                        <IconRefresh size={13} className={loading ? 'animate-spin' : ''} />
                        刷新
                    </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoCard label="QQ 版本" value={installInfo?.version || '-'} />
                    <InfoCard label="QQ Build" value={installInfo?.build || '-'} />
                    <InfoCard label="NapCat 版本" value={versionData?.napcatVersion || '-'} />
                    <InfoCard label="运行平台" value={installInfo ? `${platformLabel(installInfo.platform)} ${installInfo.arch}` : '-'} />
                    <InfoCard label="安装目录" value={installInfo?.installDir || '-'} mono />
                    <InfoCard label="推荐 Release" value={versionData?.releaseTag || '-'} highlight />
                </div>
            </div>

            {/* 版本警告 */}
            {versionData?.versionWarning && (
                <div className="card p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <div className="flex items-start gap-2">
                        <IconAlert size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-700 dark:text-amber-300 whitespace-pre-line">
                            {versionData.versionWarning}
                        </div>
                    </div>
                </div>
            )}

            {/* 安装包选择 */}
            <div className="card p-5 hover-lift">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <IconDownload size={16} className="text-gray-400" />
                    选择安装包
                </h3>

                {versionData?.downloadLinks && versionData.downloadLinks.length > 0 ? (
                    <div className="space-y-2">
                        {versionData.downloadLinks.map((link, idx) => (
                            <label
                                key={idx}
                                className={`
                                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200
                                    ${selectedLink?.url === link.url
                                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }
                                    ${isActive ? 'opacity-60 pointer-events-none' : ''}
                                `}
                            >
                                <input
                                    type="radio"
                                    name="install-link"
                                    checked={selectedLink?.url === link.url}
                                    onChange={() => setSelectedLink(link)}
                                    className="accent-primary"
                                    disabled={!!isActive}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                        {link.label}
                                    </div>
                                    <div className="text-xs text-gray-400 truncate mt-0.5">{link.url}</div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">
                                        {platformLabel(link.platform)}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">
                                        {link.arch}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">
                                        {formatLabel(link.format)}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        {loading ? '加载中...' : '未找到当前平台的推荐安装包'}
                    </div>
                )}
            </div>

            {/* 安装进度 */}
            {(isActive || isDone || isError) && progress && (
                <div className="card p-5 hover-lift animate-fade-in-up">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {isDone ? <IconCheck size={16} className="text-emerald-500" /> :
                                isError ? <IconAlert size={16} className="text-red-500" /> :
                                    <div className="loading-spinner !w-4 !h-4 !border-[1.5px]" />}
                            安装进度
                        </h3>
                        <span className={`text-xs font-medium ${stageColor(progress.stage)}`}>
                            {stageLabel(progress.stage)}
                        </span>
                    </div>

                    {/* 进度条 */}
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${progressBarColor(progress.stage)}`}
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>

                    {/* 进度详情 */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{progress.message}</span>
                        <span>{progress.percent}%</span>
                    </div>

                    {/* 下载速度 */}
                    {progress.stage === 'downloading' && (
                        <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                            <span>
                                {formatBytes(progress.downloadedBytes || 0)}
                                {progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ''}
                            </span>
                            <span>{formatSpeed(progress.speed || 0)}</span>
                        </div>
                    )}

                    {/* 错误信息 */}
                    {isError && progress.error && (
                        <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <p className="text-xs text-red-600 dark:text-red-400">{progress.error}</p>
                        </div>
                    )}
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleInstall}
                    disabled={!selectedLink || !!isActive || installing}
                    className={`
                        btn px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                        flex items-center gap-2
                        ${!selectedLink || isActive || installing
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-primary text-white hover:opacity-90 shadow-md hover:shadow-lg'
                        }
                    `}
                >
                    {installing || isActive ? (
                        <>
                            <div className="loading-spinner !w-4 !h-4 !border-[1.5px] !border-current" />
                            安装中...
                        </>
                    ) : (
                        <>
                            <IconDownload size={15} />
                            覆盖安装
                        </>
                    )}
                </button>

                {(isDone || isError) && (
                    <button
                        onClick={handleReset}
                        className="btn btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        重置
                    </button>
                )}

                {versionData?.releaseUrl && (
                    <a
                        href={versionData.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 no-underline"
                    >
                        查看 Release →
                    </a>
                )}
            </div>

            {/* 提示信息 */}
            <div className="card p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                    <IconInfo size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <p>• 覆盖安装会将新版本 QQ 安装到当前 QQ 所在目录，安装完成后需要<strong>重启 NapCat</strong> 才能生效。</p>
                        <p>• Windows 平台使用静默安装模式，Linux 平台使用 dpkg 安装 deb 包。</p>
                        <p>• 安装过程中请勿关闭页面，否则可能导致安装中断。</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

/** 信息卡片 */
function InfoCard({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
    return (
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="text-[10px] text-gray-400 font-medium mb-1">{label}</div>
            <div className={`text-sm font-semibold truncate ${highlight ? 'text-primary' :
                'text-gray-800 dark:text-gray-200'
                } ${mono ? 'font-mono text-xs' : ''}`} title={value}>
                {value}
            </div>
        </div>
    )
}
