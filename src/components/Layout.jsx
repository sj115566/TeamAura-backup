import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useGlobalData } from '../context/DataContext';
import { Icon } from './Icons';
import { Badge } from './ui/Badge';

export const Layout = () => {
    const { 
        currentUser, availableSeasons, selectedSeason, isHistoryMode, 
        needRefresh, actions, loading, notifications, clearNotification,
        theme, toggleTheme 
    } = useGlobalData();

    const navItems = [
        { id: 'announcements', path: '', icon: 'Bell', label: '公告', hasNotif: notifications?.announcements },
        { id: 'tasks', path: 'tasks', icon: 'Map', label: '任務', hasNotif: notifications?.tasks },
        { id: 'leaderboard', path: 'leaderboard', icon: 'Trophy', label: '排行' },
        ...(currentUser?.isAdmin ? [{ id: 'report', path: 'report', icon: 'Table', label: '報表' }] : []),
        { id: 'profile', path: 'profile', icon: 'User', label: '個人' },
        { id: 'game', path: 'game', icon: 'Gamepad', label: '遊戲' }
    ];

    return (
        <div className="app-container">
            {/* Top Bar - 套用 .app-header */}
            <header className={`app-header ${isHistoryMode ? 'app-header-history' : 'app-header-default'}`}>
                {/* 套用 .app-header-inner，這裡已在 CSS 中設定 h-11 */}
                <div className="app-header-inner">
                    <div className="flex items-center gap-2">
                        <div className="font-black text-lg text-indigo-600 dark:text-indigo-400">Team Aura</div>
                        {currentUser?.isAdmin && <Badge color="indigo">ADMIN</Badge>}
                        
                        {/* 賽季選擇器 - 套用 .season-select 並加入 rounded-full (圓角) 與 px-2 (內距) */}
                        <div className="relative flex items-center">
                            <select 
                                value={selectedSeason || ''} 
                                onChange={(e) => actions.setSeason(e.target.value)} 
                                disabled={availableSeasons.length === 0} 
                                className={`season-select rounded-full px-2 border
                                    ${isHistoryMode 
                                        ? 'text-yellow-800 border-yellow-400 dark:text-yellow-400 dark:border-yellow-700' 
                                        : 'text-slate-700 border-gray-300 dark:text-slate-300 dark:border-slate-700'
                                    }`
                            }>
                                {availableSeasons.length > 0 ? (availableSeasons.map(s => <option key={s} value={s}>{s}</option>)) : (<option>載入中...</option>)}
                            </select>
                            <div className="pointer-events-none absolute right-0 flex items-center px-2 text-slate-600 dark:text-slate-400"><Icon name="ChevronDown" className="h-3 w-3" /></div>
                        </div>
                        {isHistoryMode && <Badge color="yellow">歷史模式</Badge>}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 深色模式切換按鈕 - 套用 .icon-button */}
                        <button 
                            onClick={toggleTheme} 
                            className="icon-button"
                            title={theme === 'dark' ? "切換至亮色模式" : "切換至深色模式"}
                        >
                            <Icon name={theme === 'dark' ? "Sun" : "Moon"} className="w-4 h-4" />
                        </button>

                        {!currentUser?.isAdmin && <Badge color={isHistoryMode ? "yellow" : "indigo"} className="text-sm">{Number(currentUser?.points || 0)} pts</Badge>}
                        
                        {/* 重新整理按鈕 - 套用 .icon-button */}
                        <button onClick={actions.refreshApp} className="icon-button">
                            <Icon name="RefreshCw" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {needRefresh && (<span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content - 套用 .app-main */}
            <main className="app-main">
                {isHistoryMode && (<div className="bg-yellow-100 text-yellow-900 p-2 text-xs text-center rounded-lg font-bold border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900">⚠️ 您正在檢視歷史賽季資料，僅供查閱，無法進行編輯或提交。</div>)}
                {needRefresh && (<div onClick={actions.refreshApp} className="bg-indigo-600 text-white p-3 rounded-lg shadow-lg flex items-center justify-between cursor-pointer animate-fadeIn"><div className="text-xs font-bold flex items-center gap-2"><Icon name="ArrowUp" className="w-4 h-4" />發現新版本，點擊立即更新！</div><Icon name="ChevronRight" className="w-4 h-4" /></div>)}
                <Outlet />
            </main>

            {/* Bottom Nav - 套用 .app-nav */}
            <nav className="app-nav">
                {navItems.map(tab => (
                    <NavLink 
                        key={tab.id} 
                        to={tab.path} 
                        end={tab.path === ''} 
                        onClick={() => clearNotification(tab.id)} 
                        /* 套用 .app-nav-item 及其狀態 */
                        className={({ isActive }) => `app-nav-item ${isActive ? 'active' : 'inactive'}`}
                    >
                        <div className="relative">
                            <Icon name={tab.icon} className="w-6 h-6" />
                            {tab.hasNotif && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}
                        </div>
                        {tab.label}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};