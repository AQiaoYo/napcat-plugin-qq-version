import { useState } from 'react'
import ToastContainer from './components/ToastContainer'
import InstallPage from './pages/InstallPage'
import ConfigPage from './pages/ConfigPage'
import { useTheme } from './hooks/useTheme'
import { IconPackage, IconSettings, IconGithub } from './components/icons'

export type PageId = 'install' | 'config'

const tabs: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'install', label: 'QQ 版本管理', icon: <IconPackage size={15} /> },
    { id: 'config', label: '设置', icon: <IconSettings size={15} /> },
]

function App() {
    const [currentPage, setCurrentPage] = useState<PageId>('install')
    useTheme()

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f11] text-gray-800 dark:text-gray-200 transition-colors duration-300">
            <ToastContainer />

            {/* 顶部导航栏 */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#18181b]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/[0.06]">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-14">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shadow-sm shadow-brand-500/20">
                                <IconPackage size={14} />
                            </div>
                            <span className="font-bold text-sm text-gray-900 dark:text-white tracking-tight">QQ Version</span>
                        </div>

                        <nav className="flex items-center bg-gray-100/80 dark:bg-white/[0.06] rounded-lg p-0.5">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setCurrentPage(tab.id)}
                                    className={`
                                        relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer
                                        ${currentPage === tab.id
                                            ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                        }
                                    `}
                                >
                                    {tab.icon}
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </nav>

                        <a
                            href="https://github.com/AQiaoYo/napcat-plugin-qq-version"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all no-underline"
                        >
                            <IconGithub size={16} />
                        </a>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
                <div key={currentPage} className="page-enter">
                    {currentPage === 'install' ? <InstallPage /> : <ConfigPage />}
                </div>
            </main>
        </div>
    )
}

export default App
