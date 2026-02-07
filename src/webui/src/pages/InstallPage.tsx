import { useState, useEffect, useCallback, useRef } from 'react'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'
import type { QQInstallInfo, InstallProgress, VersionRecommended, QQDownloadLink } from '../types'
import {
    IconDownload, IconRefresh, IconAlert, IconPackage,
    IconWindows, IconLinux, IconApple, IconServer, IconFolder, IconTag, IconCpu,
    IconExternalLink, IconCheckCircle, IconXCircle, IconRotateCcw
} from '../components/icons'

/* ==================== 工具函数 ==================== */

function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSec: number): string {
    if (!bytesPerSec || bytesPerSec <= 0) return '-'
    return formatBytes(bytesPerSec) + '/s'
}

function platformLabel(p: string): string {
    switch (p) {
        case 'windows': return 'Windows'
        case 'linux': return 'Linux'
        case 'mac': return 'macOS'
        default: return p
    }
}

function PlatformIcon({ platform, size = 16, className = '' }: { platform: string; size?: number; className?: string }) {
    switch (platform) {
        case 'windows': case 'win32': return <IconWindows size={size} className={className} />
        case 'linux': return <IconLinux size={size} className={className} />
        case 'mac': case 'darwin': return <IconApple size={size} className={className} />
        default: return <IconServer size={size} className={className} />
    }
}

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

function stageColor(stage: string): string {
    switch (stage) {
        case 'downloading': return 'text-blue-600 dark:text-blue-400'
        case 'extracting': return 'text-amber-600 dark:text-amber-400'
        case 'installing': return 'text-violet-600 dark:text-violet-400'
        case 'done': return 'text-emerald-600 dark:text-emerald-400'
        case 'error': return 'text-red-600 dark:text-red-400'
        default: return 'text-gray-500'
    }
}

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

function isAutoInstallSupported(platform?: string): boolean {
    return platform === 'linux'
}

function isWindowsPlatform(platform?: string): boolean {
    return platform === 'windows' || platform === 'win32'
}

function isMacPlatform(platform?: string): boolean {
    return platform === 'mac' || platform === 'darwin'
}

/* ==================== 主组件 ==================== */

export default function InstallPage() {
    const [installInfo, setInstallInfo] = useState<QQInstallInfo | null>(null)
    const [versionData, setVersionData] = useState<VersionRecommended | null>(null)
    const [progress, setProgress] = useState<InstallProgress | null>(null)
    const [loading, setLoading] = useState(true)
    const [installing, setInstalling] = useState(false)
    const [selectedLink, setSelectedLink] = useState<QQDownloadLink | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchInstallInfo = useCallback(async () => {
        try {
            const res = await noAuthFetch<QQInstallInfo>('/install/info')
            if (res.code === 0 && res.data) setInstallInfo(res.data)
        } catch { /* ignore */ }
    }, [])

    const fetchVersion = useCallback(async () => {
        try {
            const res = await noAuthFetch<VersionRecommended>('/version/recommended')
            if (res.code === 0 && res.data) {
                setVersionData(res.data)
                if (res.data.downloadLinks?.length > 0 && !selectedLink) {
                    setSelectedLink(res.data.downloadLinks[0])
                }
            }
        } catch { /* ignore */ }
    }, [selectedLink])

    const fetchProgress = useCallback(async () => {
        try {
            const res = await noAuthFetch<InstallProgress>('/install/progress')
            if (res.code === 0 && res.data) {
                setProgress(res.data)
                if (res.data.stage === 'done' || res.data.stage === 'error') {
                    setInstalling(false)
                    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
                    if (res.data.stage === 'done') showToast('QQ 安装完成，重启后生效', 'success')
                    else if (res.data.stage === 'error') showToast(res.data.error || '安装失败', 'error')
                }
            }
        } catch { /* ignore */ }
    }, [])

    useEffect(() => {
        setLoading(true)
        Promise.all([fetchInstallInfo(), fetchVersion(), fetchProgress()]).finally(() => setLoading(false))
    }, [fetchInstallInfo, fetchVersion, fetchProgress])

    useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current) } }, [])

    const handleRefresh = async () => {
        setLoading(true)
        try {
            await noAuthFetch('/version/refresh', { method: 'POST' })
            await Promise.all([fetchInstallInfo(), fetchVersion()])
            showToast('已刷新版本信息', 'success')
        } catch { showToast('刷新失败', 'error') }
        finally { setLoading(false) }
    }

    const handleInstall = async () => {
        if (!selectedLink) { showToast('请先选择安装包', 'warning'); return }
        if (installing) return
        setInstalling(true)
        try {
            const res = await noAuthFetch('/install/start', { method: 'POST', body: JSON.stringify(selectedLink) })
            if (res.code !== 0) { showToast(res.message || '启动安装失败', 'error'); setInstalling(false); return }
            showToast('安装任务已启动', 'info')
            pollRef.current = setInterval(fetchProgress, 800)
        } catch { showToast('启动安装失败', 'error'); setInstalling(false) }
    }

    const handleReset = async () => {
        try {
            await noAuthFetch('/install/reset', { method: 'POST' })
            setProgress(null); setInstalling(false); showToast('已重置', 'info')
        } catch { /* ignore */ }
    }

    const currentPlatform = installInfo?.platform || versionData?.platform?.platform || ''
    const autoInstallSupported = isAutoInstallSupported(currentPlatform)
    const isWindows = isWindowsPlatform(currentPlatform)
    const isMac = isMacPlatform(currentPlatform)
    const isActive = progress && ['downloading', 'extracting', 'installing'].includes(progress.stage)
    const isDone = progress?.stage === 'done'
    const isError = progress?.stage === 'error'

    if (loading && !installInfo) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="loading-spinner !w-6 !h-6 text-brand-500" />
                    <span className="text-xs text-gray-400">正在获取版本信息...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* 环境信息卡片 */}
            <div className="rounded-xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <IconServer size={14} />
                        </div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">运行环境</span>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={loading || !!isActive}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                        <IconRefresh size={12} className={loading ? 'animate-spin' : ''} />
                        刷新
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-white/[0.04]">
                    <EnvItem icon={<IconPackage size={14} />} label="QQ 版本" value={installInfo?.version || '-'} />
                    <EnvItem icon={<IconTag size={14} />} label="Build" value={installInfo?.build || '-'} />
                    <EnvItem icon={<IconShieldSmall />} label="NapCat" value={versionData?.napcatVersion || '-'} />
                    <EnvItem icon={<PlatformIcon platform={currentPlatform} size={14} />} label="平台" value={installInfo ? `${platformLabel(installInfo.platform)} ${installInfo.arch}` : '-'} />
                    <EnvItem icon={<IconFolder size={14} />} label="安装目录" value={installInfo?.installDir || '-'} mono />
                    <EnvItem icon={<IconCpu size={14} />} label="推荐版本" value={versionData?.releaseTag || '-'} accent />
                </div>
            </div>

            {/* 版本警告 */}
            {versionData?.versionWarning && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06]">
                    <IconAlert size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300/90 whitespace-pre-line">{versionData.versionWarning}</p>
                </div>
            )}

            {/* 安装/下载区域 */}
            {autoInstallSupported ? (
                <LinuxInstallPanel
                    versionData={versionData}
                    selectedLink={selectedLink}
                    onSelectLink={setSelectedLink}
                    progress={progress}
                    isActive={!!isActive}
                    isDone={!!isDone}
                    isError={!!isError}
                    installing={installing}
                    onInstall={handleInstall}
                    onReset={handleReset}
                />
            ) : (isWindows || isMac) ? (
                <ManualDownloadPanel
                    platform={isWindows ? 'windows' : 'mac'}
                    links={versionData?.downloadLinks || []}
                />
            ) : (
                <div className="rounded-xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-10 flex flex-col items-center text-center">
                    <IconAlert size={36} className="text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-400 font-medium">暂未检测到当前平台的推荐下载链接</p>
                    <p className="text-xs text-gray-400/70 mt-1">请尝试点击"刷新"或前往 NapCat 官网手动查找</p>
                </div>
            )}
        </div>
    )
}

/* ==================== 子组件 ==================== */

function EnvItem({ icon, label, value, mono, accent }: {
    icon: React.ReactNode; label: string; value: string; mono?: boolean; accent?: boolean
}) {
    return (
        <div className="px-4 py-3.5 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                {icon}
                <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
            </div>
            <span className={`text-[13px] font-semibold truncate ${mono ? 'font-mono text-[12px]' : ''} ${accent ? 'text-brand-500' : 'text-gray-800 dark:text-gray-200'}`} title={value}>
                {value}
            </span>
        </div>
    )
}

function IconShieldSmall() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
    )
}

function LinuxInstallPanel({ versionData, selectedLink, onSelectLink, progress, isActive, isDone, isError, installing, onInstall, onReset }: {
    versionData: VersionRecommended | null
    selectedLink: QQDownloadLink | null
    onSelectLink: (link: QQDownloadLink) => void
    progress: InstallProgress | null
    isActive: boolean; isDone: boolean; isError: boolean; installing: boolean
    onInstall: () => void; onReset: () => void
}) {
    const links = versionData?.downloadLinks || []

    return (
        <div className="rounded-xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.04]">
                <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500">
                    <IconDownload size={14} />
                </div>
                <div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">自动安装更新</span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">Linux</span>
                </div>
            </div>

            <div className="p-5 space-y-5">
                {isActive && progress && (
                    <div className="space-y-2.5 p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.04]">
                        <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold ${stageColor(progress.stage)}`}>{stageLabel(progress.stage)}</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300 tabular-nums">{progress.percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-300 ease-out ${progressBarColor(progress.stage)}`} style={{ width: `${progress.percent}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                            <span className="truncate mr-4">
                                {progress.totalBytes && progress.totalBytes > 0
                                    ? `${formatBytes(progress.downloadedBytes || 0)} / ${formatBytes(progress.totalBytes)}`
                                    : progress.message}
                            </span>
                            <span className="tabular-nums flex-shrink-0">{formatSpeed(progress.speed || 0)}</span>
                        </div>
                    </div>
                )}

                {(isDone || isError) && (
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${isDone
                        ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06]'
                        : 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06]'
                        }`}>
                        {isDone
                            ? <IconCheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
                            : <IconXCircle size={20} className="text-red-500 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${isDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                {isDone ? '安装完成，重启 NapCat 后生效' : '安装失败'}
                            </p>
                            {isError && progress?.error && <p className="text-xs text-red-500/80 mt-0.5 truncate">{progress.error}</p>}
                        </div>
                        <button onClick={onReset} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0 cursor-pointer">
                            <IconRotateCcw size={11} /> 重置
                        </button>
                    </div>
                )}

                {links.length > 0 && (
                    <div className="space-y-2.5">
                        <p className="text-xs text-gray-500 dark:text-gray-400">选择要安装的版本：</p>
                        <div className="space-y-2">
                            {links.map((link, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onSelectLink(link)}
                                    className={`group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedLink?.url === link.url
                                        ? 'border-brand-300 dark:border-brand-500/40 bg-brand-50/50 dark:bg-brand-500/[0.06]'
                                        : 'border-gray-150 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1] hover:bg-gray-50/50 dark:hover:bg-white/[0.02]'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedLink?.url === link.url
                                        ? 'border-brand-500 bg-brand-500'
                                        : 'border-gray-300 dark:border-gray-600'
                                        }`}>
                                        {selectedLink?.url === link.url && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{link.label}</div>
                                        <div className="text-[10px] text-gray-400 truncate mt-0.5">{link.url}</div>
                                    </div>
                                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 flex-shrink-0">
                                        {link.format}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={onInstall}
                    disabled={installing || !selectedLink || isActive}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-brand-500/20 hover:shadow-brand-500/30"
                >
                    {installing
                        ? <><div className="loading-spinner !w-3.5 !h-3.5 !border-[1.5px] !border-white !border-t-transparent" /> 正在处理...</>
                        : <><IconDownload size={15} /> 开始安装</>
                    }
                </button>
            </div>
        </div>
    )
}

function ManualDownloadPanel({ platform, links }: { platform: 'windows' | 'mac'; links: QQDownloadLink[] }) {
    return (
        <div className="rounded-xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.04]">
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <PlatformIcon platform={platform} size={14} />
                </div>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    下载安装包 ({platform === 'windows' ? 'Windows' : 'macOS'})
                </span>
            </div>

            <div className="p-5 space-y-4">
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-500/[0.06] border border-amber-200/60 dark:border-amber-500/15">
                    <IconAlert size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                        当前平台不支持自动安装。请下载对应安装包手动安装，完成后重启 NapCat 即可。
                    </p>
                </div>

                {links.length > 0 ? (
                    <div className="space-y-2">
                        {links.map((link, idx) => (
                            <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-3 p-3.5 rounded-lg border border-gray-150 dark:border-white/[0.06] hover:border-brand-300 dark:hover:border-brand-500/30 hover:bg-brand-50/30 dark:hover:bg-brand-500/[0.03] transition-all no-underline"
                            >
                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/[0.06] group-hover:bg-brand-100 dark:group-hover:bg-brand-500/10 flex items-center justify-center text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0">
                                    <PlatformIcon platform={link.platform} size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">{link.label}</div>
                                    <div className="text-[10px] text-gray-400 uppercase mt-0.5">{link.format} 格式</div>
                                </div>
                                <IconExternalLink size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 text-center py-4">暂无可用的下载链接</p>
                )}
            </div>
        </div>
    )
}
