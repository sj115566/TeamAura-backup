import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { Modal } from '../components/ui/Modal';
import { AdminConsole } from '../components/AdminConsole';

// 增加接收 users 參數
export const ProfileView = ({ 
    currentUser, tasks, submissions, users, onLogout, isAdmin, 
    onReview, onInitialize, onHardReset, isHistoryMode, 
    roles, onAddRole, onUpdateRole, onDeleteRole,
    categories, onAddCategory, onUpdateCategory, onDeleteCategory,
    onRestoreDefaultCategories,
    onFixSubmissionLinks
}) => {
  const [historySort, setHistorySort] = useState('desc');
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  const [categoryExpanded, setCategoryExpanded] = useState({ task: true, announcement: true });
 
  const [roleModal, setRoleModal] = useState({ isOpen: false, id: null, code: '', label: '', percentage: 0, color: '#6366f1' });
  const [catModal, setCatModal] = useState({ isOpen: false, id: null, label: '', color: '#6366f1', type: 'task', isSystem: false, systemTag: null });

  const handleOpenEditRole = (role) => {
      const pct = Math.round((role.multiplier - 1) * 100);
      setRoleModal({ isOpen: true, id: role.firestoreId, code: role.code, label: role.label, percentage: pct, color: role.color });
  };
  const handleOpenAddRole = () => {
      setRoleModal({ isOpen: true, id: null, code: '', label: '', percentage: 10, color: '#6366f1' });
  };
  const handleSaveRole = () => {
      const multiplier = 1 + (Number(roleModal.percentage) / 100);
      const data = { code: roleModal.code, label: roleModal.label, multiplier: multiplier, color: roleModal.color };
      if (roleModal.id) onUpdateRole(roleModal.id, data);
      else onAddRole(data);
      setRoleModal({ isOpen: false, id: null, code: '', label: '', percentage: 0, color: '#6366f1' });
  };

  const handleOpenEditCat = (cat) => {
      setCatModal({ 
          isOpen: true, 
          id: cat.firestoreId, 
          label: cat.label, 
          color: cat.color, 
          type: cat.type || 'task', 
          isSystem: !!cat.isSystem,
          systemTag: cat.systemTag || null 
      });
  };

  const handleOpenAddCat = (type = 'task') => {
      setCatModal({ isOpen: true, id: null, label: '', color: '#6366f1', type: type, isSystem: false, systemTag: null });
  };

  const handleSaveCat = () => {
      const isDuplicate = categories.some(c => c.label === catModal.label && c.color === catModal.color && c.type === catModal.type && c.firestoreId !== catModal.id);
      if (isDuplicate) {
          const confirmCreate = window.confirm(`系統偵測到已經存在一個名稱為「${catModal.label}」且顏色相同的標籤。\n\n建立重複的標籤可能會造成混淆，您確定要繼續嗎？`);
          if (!confirmCreate) return;
      }
      const data = { 
          label: catModal.label, 
          color: catModal.color, 
          type: catModal.type, 
          isSystem: catModal.isSystem,
          systemTag: catModal.systemTag 
      };
      
      if (catModal.id) onUpdateCategory(catModal.id, data);
      else onAddCategory(data);
      setCatModal({ isOpen: false, id: null, label: '', color: '#6366f1', type: 'task', isSystem: false, systemTag: null });
  };

  const toggleCategoryExpand = (type) => {
      setCategoryExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const currentMultiplier = useMemo(() => {
      if (!currentUser?.roles || !roles) return 1;
      const safeRoles = roles || [];
      const userRoles = currentUser.roles || [];
      const activeRoles = safeRoles.filter(r => userRoles.includes(r.code));
      let totalExtra = 0;
      activeRoles.forEach(r => {
          const rate = Number(r.multiplier) || 1;
          totalExtra += (rate - 1);
      });
      return Math.max(1, 1 + totalExtra);
  }, [currentUser, roles]);

  const { mySubs, pendingSubs, processedSubs, statsData, totalBasePoints } = useMemo(() => {
      const my = submissions.filter(s => {
          if (s.userDocId) return s.userDocId === currentUser.firestoreId;
          return s.uid === (currentUser.username || currentUser.uid);
      });

      const pending = isAdmin ? submissions.filter(s => s.status === 'pending') : [];
      const processed = isAdmin ? submissions.filter(s => s.status !== 'pending') : [];
      const stats = { pinned: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0 }, weeks: {} };
      let totalBase = 0;

      if (!isAdmin || isHistoryMode) {
        tasks.forEach(t => {
            let type = 'seasonal';
            if (t.isPinned) type = 'pinned';
            
            if (type === 'pinned') {
                stats.pinned.totalTasks++;
                stats.pinned.totalPts += (Number(t.points) || 0);
            } else {
                const w = t.week || 'Other';
                if (!stats.weeks[w]) stats.weeks[w] = { week: w, daily: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0 }, seasonal: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0 } };
                stats.weeks[w][type].totalTasks++;
                stats.weeks[w][type].totalPts += (Number(t.points) || 0);
            }
        });
        my.forEach(s => {
            if (s.status === 'approved') {
                const task = tasks.find(t => t.id === s.taskId);
                if (task) {
                    let type = 'seasonal';
                    if (task.isPinned) type = 'pinned';
                    
                    const base = Number(s.points) || 0;
                    totalBase += base;

                    if (type === 'pinned') {
                        stats.pinned.completed++;
                        stats.pinned.earnedBase += base;
                    } else {
                        const w = task.week || 'Other';
                        if (stats.weeks[w]) {
                            stats.weeks[w][type].completed++;
                            stats.weeks[w][type].earnedBase += base;
                        }
                    }
                }
            }
        });
      }
      const sortedWeeks = Object.values(stats.weeks).sort((a, b) => parseInt(b.week) - parseInt(a.week));
      return { mySubs: my, pendingSubs: pending, processedSubs: processed, statsData: { pinned: stats.pinned, weeks: sortedWeeks }, totalBasePoints: totalBase };
  }, [tasks, submissions, currentUser, isAdmin, isHistoryMode]);

  const sortedHistoryWeeks = useMemo(() => {
    return [...new Set(mySubs.map(s => s.week))].sort((a,b) => {
      const na = parseInt(a), nb = parseInt(b);
      const compare = (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
      return historySort === 'asc' ? compare : -compare;
    });
  }, [mySubs, historySort]);

  const myRoleBadges = useMemo(() => {
      if (!currentUser?.roles || !roles) return [];
      return (roles || []).filter(r => currentUser.roles.includes(r.code));
  }, [currentUser, roles]);
  const presetColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#64748b'];

  const StatProgress = ({ title, data, colorClass, barColorClass }) => {
      if (!data || data.totalTasks === 0) return null;
      const earned = data.earnedBase;
      const maxPts = data.totalPts; 
      const percent = Math.min(100, (data.completed / data.totalTasks) * 100);
      return (
          <div className="mb-3 last:mb-0">
              <div className="flex justify-between mb-1 text-xs">
                  <span className={`font-bold ${colorClass}`}>{title}</span>
                  <span className="font-bold text-slate-700">{earned} <span className="text-[10px] font-normal">Pts</span> <span className="text-gray-400 text-[9px]">/ {maxPts} Pts</span></span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>完成度</span><span>{data.completed} / {data.totalTasks}</span></div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className={`h-1.5 rounded-full transition-all duration-500 ${barColorClass}`} style={{ width: `${percent}%` }}></div></div>
          </div>
      );
  };

  const finalTotalPoints = Math.round(totalBasePoints * currentMultiplier);
  const bonusPoints = finalTotalPoints - totalBasePoints;

  const CategorySection = ({ title, type, cats }) => {
      const isExpanded = categoryExpanded[type];
      return (
        <div className="mb-4 last:mb-0">
            <div 
                onClick={() => toggleCategoryExpand(type)}
                className="flex justify-between items-center mb-2 px-1 cursor-pointer select-none group"
            >
                <div className="flex items-center gap-2">
                    <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400 group-hover:text-slate-600" />
                    <h3 className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{title}</h3>
                    <Badge color="gray" className="text-[10px]">{cats.length}</Badge>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenAddCat(type); }} 
                    className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                >
                    + 新增
                </button>
            </div>
            
            {isExpanded && (
                <Card noPadding>
                    <div className="divide-y divide-gray-50">
                        {cats.length > 0 ? cats.map((cat, index) => {
                            const isSystemTag = !!cat.systemTag || ['每日', '常駐'].includes(cat.label);

                            return (
                                <div key={cat.firestoreId || index} className="p-3 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] px-2 py-0.5 rounded text-white font-bold shadow-sm" style={{ backgroundColor: cat.color }}>
                                            {cat.label}
                                        </span>
                                        {isSystemTag && <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded">系統保留</span>}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleOpenEditCat(cat)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-500 transition-colors">
                                            <Icon name="Edit2" className="w-3.5 h-3.5"/>
                                        </button>
                                        {!isSystemTag && (
                                            <button onClick={() => onDeleteCategory(cat.firestoreId)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors">
                                                <Icon name="Trash2" className="w-3.5 h-3.5"/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="p-4 text-center text-xs text-gray-400">尚無{title}設定</div>
                        )}
                    </div>
                </Card>
            )}
        </div>
      );
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <Card className="text-center">
        <h2 className="font-black text-xl text-slate-800 break-all mb-2">{currentUser.username || currentUser.uid}</h2>
        {myRoleBadges.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
            {myRoleBadges.map(role => (
                <span key={role.code} className="text-[10px] px-2 py-0.5 rounded border font-bold shadow-sm" style={{ backgroundColor: role.color ? `${role.color}15` : '#f3f4f6', color: role.color || '#6b7280', borderColor: role.color ? `${role.color}40` : '#e5e7eb' }}>{role.label}</span>
            ))}
          </div>
        )}
        <div className="text-xs text-gray-400 mb-4">{isAdmin ? 'Administrator' : 'Trainer'}</div>
        {(!isAdmin || isHistoryMode) && (
          <>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 mb-4">
              <div><div className="text-2xl font-black text-slate-800">{totalBasePoints}{bonusPoints > 0 && (<span className="text-lg text-indigo-600 ml-1">(+{bonusPoints})</span>)}</div><div className="text-[10px] text-gray-400 uppercase font-bold">總積分</div></div>
              <div><div className="text-2xl font-black text-slate-700">{mySubs.filter(s => s.status === 'approved').length}</div><div className="text-[10px] text-gray-400 uppercase font-bold">完成任務</div></div>
            </div>
            <div className="text-left bg-gray-50 rounded-xl mb-4 border border-gray-100 overflow-hidden">
              <div onClick={() => setShowStats(!showStats)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors">
                <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Icon name="Table" className="w-3 h-3" /> 任務進度統計</h3><Icon name={showStats ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400" />
              </div>
              {showStats && (
                <div className="px-4 pb-4 animate-fadeIn space-y-4 border-t border-gray-100 pt-4 bg-slate-50/50">
                  {statsData.pinned.totalTasks > 0 && (<div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div><StatProgress title="常駐與公告任務" data={statsData.pinned} colorClass="text-red-500" barColorClass="bg-red-400" /></div>)}
                  {statsData.weeks.length > 0 ? statsData.weeks.map(weekItem => {
                      const weekTotalBase = weekItem.daily.earnedBase + weekItem.seasonal.earnedBase;
                      return (
                        <div key={weekItem.week} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-50 pl-2"><span className="font-bold text-slate-700 text-sm">第 {weekItem.week} 週</span><span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">本週合計: {weekTotalBase} Pts</span></div>
                          <div className="pl-2 space-y-4"><StatProgress title="每日挑戰" data={weekItem.daily} colorClass="text-orange-500" barColorClass="bg-orange-400" /><StatProgress title="賽季進度" data={weekItem.seasonal} colorClass="text-slate-600" barColorClass="bg-indigo-400" /></div>
                        </div>
                      );
                  }) : !statsData.pinned.totalTasks && <div className="text-xs text-gray-400 text-center py-2">尚無統計資料</div>}
                </div>
              )}
            </div>
          </>
        )}
        {!isHistoryMode && <Button variant="danger" onClick={onLogout} className="w-full bg-white border border-red-100" icon="LogOut">登出</Button>}
      </Card>

      {(!isAdmin || isHistoryMode) && mySubs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2"><h3 className="font-bold text-slate-700 text-sm ml-1">提交紀錄</h3><button onClick={() => setHistorySort(prev => prev === 'desc' ? 'asc' : 'desc')} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"><Icon name={historySort === 'desc' ? "ArrowDown" : "ArrowUp"} className="w-3 h-3" /></button></div>
          {sortedHistoryWeeks.map(week => (
            <Card key={week} noPadding>
              <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-100">第 {week} 週</div>
              <div className="divide-y divide-gray-50">
                {mySubs.filter(s => s.week === week).map(sub => (
                    <div key={sub.id} className="p-3 flex justify-between items-center text-sm"><span className="font-medium text-slate-700">{sub.taskTitle}</span><div className="flex items-center gap-2">{sub.status === 'approved' && <div className="text-xs"><span className="font-bold text-slate-900">{Number(sub.points) || 0} <span className="text-[10px] font-normal">Pts</span></span></div>}<Badge color={sub.status === 'approved' ? 'green' : sub.status === 'rejected' ? 'red' : 'yellow'}>{sub.status === 'approved' ? '完成' : sub.status === 'rejected' ? '退回' : '審核中'}</Badge></div></div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 傳遞 users 給 AdminConsole */}
      {isAdmin && <AdminConsole pendingSubs={pendingSubs} processedSubs={processedSubs} tasks={tasks} onReview={onReview} showHistory={showHistory} toggleHistory={() => setShowHistory(!showHistory)} isHistoryMode={isHistoryMode} users={users} />}
     
      {isAdmin && !isHistoryMode && (
          <div className="mt-6 space-y-6">
              <div>
                  <div className="flex justify-between items-center mb-2 px-1">
                      <h3 className="font-bold text-slate-700 text-sm">身分組設定 (加成系統)</h3>
                      <button onClick={handleOpenAddRole} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100">+ 新增</button>
                  </div>
                  <Card noPadding>
                      <div className="divide-y divide-gray-50">
                          {(roles || []).length > 0 ? (roles || []).map(role => {
                              const pct = Math.round((role.multiplier - 1) * 100);
                              return (
                                <div key={role.firestoreId} className="p-3 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2"><span className="font-mono text-xs bg-gray-100 px-1 rounded text-gray-500">{role.code}</span><span style={{color: role.color}} className="font-bold">{role.label}</span><span className="text-xs text-gray-400">{pct > 0 ? `+${pct}%` : '0%'}</span></div>
                                    <div className="flex gap-1"><button onClick={() => handleOpenEditRole(role)} className="p-1 text-gray-400 hover:text-indigo-500"><Icon name="Edit2" className="w-3 h-3"/></button><button onClick={() => onDeleteRole(role.firestoreId)} className="p-1 text-gray-400 hover:text-red-500"><Icon name="Trash2" className="w-3 h-3"/></button></div>
                                </div>
                              );
                          }) : <div className="p-4 text-center text-xs text-gray-400">尚無身分組設定</div>}
                      </div>
                  </Card>
              </div>

              <div>
                  <div className="flex justify-between items-center mb-2 px-1">
                      <h3 className="font-bold text-slate-700 text-sm">分類標籤管理</h3>
                      {onRestoreDefaultCategories && (
                        <button 
                            onClick={() => window.confirm("確定要匯入預設分類標籤？\n這將會補齊缺少的預設分類，並修復現有分類的系統標籤(System Tag)連結。\n請在修改過標籤名稱後執行此操作以確保任務分組正確。") && onRestoreDefaultCategories()}
                            className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded hover:bg-gray-200"
                        >
                            匯入預設
                        </button>
                      )}
                  </div>
                  <CategorySection title="任務分類" type="task" cats={(categories || []).filter(c => c.type !== 'announcement')} />
                  <CategorySection title="公告分類" type="announcement" cats={(categories || []).filter(c => c.type === 'announcement')} />
              
                  {onFixSubmissionLinks && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                          <button 
                              onClick={() => {
                                  if(window.confirm("確定要執行修復？\n這會掃描所有提交紀錄，若發現沒有 ID 的舊紀錄，會嘗試用該紀錄的 uid (username) 與現有使用者配對並補上 ID。\n\n請確保要修復的使用者已將暱稱改回當初提交時的名稱！")) {
                                      onFixSubmissionLinks();
                                  }
                              }}
                              className="w-full bg-slate-200 text-slate-600 text-xs py-2 rounded-lg hover:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                          >
                              <Icon name="RefreshCw" className="w-3 h-3" />
                              修復提交紀錄連結 (綁定 ID)
                          </button>
                          <p className="text-[10px] text-gray-400 mt-1 px-1">
                              * 若使用者改名後紀錄消失，請先讓他改回舊名，執行此修復後，再改新名。
                          </p>
                      </div>
                  )}
              </div>
          </div>
      )}

      <Modal isOpen={roleModal.isOpen} onClose={() => setRoleModal({ ...roleModal, isOpen: false })} title={roleModal.id ? "編輯身分組" : "新增身分組"}>
          <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500">代號 (唯一 ID)</label><input className="w-full p-2 border rounded mt-1 text-sm" placeholder="如: vip, mod" value={roleModal.code} onChange={e => setRoleModal({...roleModal, code: e.target.value})} disabled={!!roleModal.id} /></div>
              <div><label className="text-xs font-bold text-gray-500">顯示名稱</label><input className="w-full p-2 border rounded mt-1 text-sm" value={roleModal.label} onChange={e => setRoleModal({...roleModal, label: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-500">積分加成 (%)</label><div className="flex items-center gap-2"><input type="number" className="w-full p-2 border rounded mt-1 text-sm" value={roleModal.percentage} onChange={e => setRoleModal({...roleModal, percentage: e.target.value})} /><span className="text-sm font-bold text-gray-500">%</span></div></div>
              <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">標籤顏色</label>
                  <div className="flex flex-wrap gap-2 mb-2">{presetColors.map(color => <button key={color} type="button" onClick={() => setRoleModal({...roleModal, color})} className={`w-6 h-6 rounded-full border-2 ${roleModal.color === color ? 'border-gray-600 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />)}</div>
                  <div className="flex items-center gap-2"><input type="color" className="w-10 h-10 p-1 border rounded cursor-pointer shrink-0" value={roleModal.color} onChange={e => setRoleModal({...roleModal, color: e.target.value})} /><input type="text" className="w-full p-2 border rounded text-sm uppercase" value={roleModal.color} onChange={e => setRoleModal({...roleModal, color: e.target.value})} /></div>
              </div>
              <Button onClick={handleSaveRole} className="w-full">儲存</Button>
          </div>
      </Modal>

      <Modal isOpen={catModal.isOpen} onClose={() => setCatModal({ ...catModal, isOpen: false })} title={catModal.id ? "編輯分類" : "新增分類"}>
          <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500">分類名稱</label><input className="w-full p-2 border rounded mt-1 text-sm" value={catModal.label} onChange={e => setCatModal({...catModal, label: e.target.value})} /><p className="text-[10px] text-gray-400 mt-1">顯示於標籤上的名稱。</p></div>
              <div>
                  <label className="text-xs font-bold text-gray-500">適用類型</label>
                  <select className="w-full p-2 border rounded mt-1 text-sm" value={catModal.type} onChange={e => setCatModal({...catModal, type: e.target.value})}>
                      <option value="task">任務 (Task)</option>
                      <option value="announcement">公告 (Announcement)</option>
                  </select>
              </div>
              <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">標籤顏色</label>
                  <div className="flex flex-wrap gap-2 mb-2">{presetColors.map(color => <button key={color} type="button" onClick={() => setCatModal({...catModal, color})} className={`w-6 h-6 rounded-full border-2 ${catModal.color === color ? 'border-gray-600 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />)}</div>
                  <div className="flex items-center gap-2"><input type="color" className="w-10 h-10 p-1 border rounded cursor-pointer shrink-0" value={catModal.color} onChange={e => setCatModal({...catModal, color: e.target.value})} /><input type="text" className="w-full p-2 border rounded text-sm uppercase" value={catModal.color} onChange={e => setCatModal({...catModal, color: e.target.value})} /></div>
              </div>
              {catModal.systemTag && <div className="text-[10px] text-indigo-500 bg-indigo-50 p-2 rounded">此為系統保留標籤 ({catModal.systemTag})，若修改名稱，關聯的任務依然會留在原系統區塊。</div>}
              <Button onClick={handleSaveCat} className="w-full">儲存</Button>
          </div>
      </Modal>
    </div>
  );
};