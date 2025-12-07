import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';

export const TaskListView = ({ 
    tasks, 
    submissions, 
    currentUser, 
    isAdmin, 
    expandedWeeks, 
    onToggleWeek, 
    onOpenSubmit, 
    onDeleteTask, 
    onOpenWithdraw, 
    onOpenEditTask, 
    onEditTask, 
    onDuplicateTask,
    isHistoryMode,
    onBatchSetExpanded,
    categories 
}) => {
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('incomplete'); 
  const [filterCategory, setFilterCategory] = useState('all'); 

  const categoryMap = useMemo(() => {
      const map = {};
      if (categories) categories.forEach(c => map[c.firestoreId] = c);
      return map;
  }, [categories]);

  const getTaskCategoryInfo = (task) => {
      if (task.categoryId && categoryMap[task.categoryId]) {
          return { ...categoryMap[task.categoryId], found: true };
      }
      if (task.categoryId) { 
          return { label: '未知分類', color: '#9ca3af', found: false };
      }
      return { label: task.category || '一般', color: '#f3f4f6', textColor: '#4b5563', found: false }; 
  };

  const groupTasksByWeek = (taskList) => {
      const grouped = {};
      taskList.forEach(t => {
          const w = t.week || 'Other';
          if (!grouped[w]) grouped[w] = [];
          grouped[w].push(t);
      });
      
      const sortedWeeks = Object.keys(grouped).sort((a, b) => {
          const na = parseInt(a);
          const nb = parseInt(b);
          const isANum = !isNaN(na);
          const isBNum = !isNaN(nb);

          if (isANum && isBNum) return sortOrder === 'asc' ? na - nb : nb - na;
          if (!isANum && isBNum) return 1; 
          if (isANum && !isBNum) return -1;
          return a.localeCompare(b);
      });

      return sortedWeeks.map(w => {
          grouped[w].sort((a, b) => {
              if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
              return String(b.id).localeCompare(String(a.id));
          });
          return { week: w, tasks: grouped[w] };
      });
  };

  const { pinnedList, dailyGroup, weeklyGroup } = useMemo(() => {
    let filteredTasks = tasks.filter(t => {
        if (filterCategory !== 'all') {
            if (t.categoryId === filterCategory) {
            } 
            else if (!t.categoryId && categoryMap[filterCategory] && t.category === categoryMap[filterCategory].label) {
            }
            else {
                return false;
            }
        }
        
        const mySub = submissions.find(s => 
            s.taskId === t.id && 
            (s.userDocId ? s.userDocId === currentUser.firestoreId : s.uid === (currentUser.username || currentUser.uid))
        );

        const status = mySub ? mySub.status : null;
        const isDone = status === 'pending' || status === 'approved';

        if (filterStatus === 'incomplete' && isDone) return false;
        if (filterStatus === 'complete' && !isDone) return false;

        return true;
    });

    const pList = []; 
    const dList = []; 
    const wList = []; 

    filteredTasks.forEach(task => {
        const catInfo = getTaskCategoryInfo(task);
        
        // ▼▼▼ 修正：優先使用 systemTag 判斷分組 ▼▼▼
        const isSystemPinned = catInfo.systemTag === 'pinned';
        const isSystemDaily = catInfo.systemTag === 'daily';
        
        // Fallback: 如果沒有 systemTag，才用 label 判斷 (相容舊資料)
        const isLegacyPinned = !catInfo.systemTag && catInfo.label === '常駐';
        const isLegacyDaily = !catInfo.systemTag && catInfo.label === '每日';

        if (isSystemPinned || isLegacyPinned) pList.push(task);
        else if (isSystemDaily || isLegacyDaily) dList.push(task);
        else wList.push(task);
        // ▲▲▲ 修正結束 ▲▲▲
    });

    pList.sort((a, b) => {
        if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
        return String(b.id).localeCompare(String(a.id));
    });

    return { 
        pinnedList: pList, 
        dailyGroup: groupTasksByWeek(dList), 
        weeklyGroup: groupTasksByWeek(wList) 
    };

  }, [tasks, sortOrder, filterStatus, filterCategory, submissions, currentUser, categoryMap]);

  const filterOptions = useMemo(() => {
      if (!categories) return [];
      return categories.filter(c => c.type === 'task');
  }, [categories]);

  const handleBatchExpand = (groupData, prefix, isExpand) => {
      const updates = {};
      groupData.forEach(({ week }) => { updates[`${prefix}-${week}`] = isExpand; });
      if (onBatchSetExpanded) onBatchSetExpanded(updates);
  };

  const handleSingleSectionToggle = (key, isExpand) => {
      if (onBatchSetExpanded) onBatchSetExpanded({ [key]: isExpand });
  };

  const TaskCard = ({ task }) => {
    const mySub = submissions.find(s => 
        s.taskId === task.id && 
        (s.userDocId ? s.userDocId === currentUser.firestoreId : s.uid === (currentUser.username || currentUser.uid))
    );
    
    const status = mySub ? mySub.status : null;
    const isDone = status === 'pending' || status === 'approved';
    const catInfo = getTaskCategoryInfo(task);
    const badgeStyle = { backgroundColor: catInfo.found ? catInfo.color : '#f3f4f6', color: catInfo.found ? '#ffffff' : '#4b5563' };

    return (
        <div className={`p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-indigo-100 transition-all group ${task.isPinned ? 'bg-indigo-50/30 border-indigo-100' : 'border-gray-50'}`}>
            <div className="flex items-start gap-3">
            <div className="text-xl w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">{task.icon}</div>
            <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                    {task.isPinned && <Icon name="Pin" className="w-3 h-3 text-indigo-500" />}
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={badgeStyle}>{catInfo.label}</span>
                    <div className="font-bold text-sm text-slate-800">{task.title}</div>
                </div>
                {task.description && <div className="text-[11px] text-gray-500 pl-1">{task.description}</div>}
                <div className="text-xs text-indigo-600 font-bold pl-1">{task.type === 'variable' ? '管理員評分' : `+${task.points} pts`}</div>
            </div>
            </div>
            <div className="flex justify-end items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
            {isAdmin ? (!isHistoryMode && (<><button onClick={() => onEditTask(task)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-blue-600 transition-colors"><Icon name="Edit2" className="w-4 h-4" /></button><button onClick={() => onDuplicateTask(task)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"><Icon name="Copy" className="w-4 h-4" /></button><Button variant="danger" className="p-2 rounded-lg" onClick={() => onDeleteTask(task.id)}><Icon name="Trash2" className="w-4 h-4" /></Button></>)) : (!isDone ? (!isHistoryMode && <Button variant="primary" className="text-xs px-4 py-1.5 w-full sm:w-auto" onClick={() => onOpenSubmit(task)}>回報</Button>) : (<div className="flex flex-col items-end gap-1"><Badge color={status === 'approved' ? 'green' : 'yellow'}>{status === 'approved' ? '已通過' : '審核中'}</Badge>{status === 'pending' && !isHistoryMode && <button onClick={() => onOpenWithdraw(mySub.id)} className="text-[10px] text-red-400 hover:text-red-600 underline font-bold">撤回</button>}</div>))}
            </div>
        </div>
    );
  };

  const TaskGroupSection = ({ title, icon, colorClass, groupData, prefix }) => {
      if (groupData.length === 0) return null;
      return (
          <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between px-1">
                <div className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${colorClass}`}><Icon name={icon} className="w-4 h-4" />{title}</div>
                <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shrink-0"><button onClick={() => handleBatchExpand(groupData, prefix, true)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors"><Icon name="ChevronsDown" className="w-3 h-3" /></button><div className="w-[1px] bg-slate-100 my-1"></div><button onClick={() => handleBatchExpand(groupData, prefix, false)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors"><Icon name="ChevronsUp" className="w-3 h-3" /></button></div>
              </div>
              {groupData.map(({ week, tasks: weekTasks }) => {
                  const expandKey = `${prefix}-${week}`;
                  const isExpanded = !!expandedWeeks[expandKey];
                  return (
                    <Card key={week} noPadding className={`border-slate-200 ${prefix === 'daily' ? 'bg-orange-50/10 border-orange-100' : ''}`}>
                        <div onClick={() => onToggleWeek(expandKey)} className={`p-3 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none transition-colors ${isExpanded ? 'bg-opacity-50' : 'bg-transparent'}`}><div className="flex items-center gap-2 font-bold text-slate-700"><span>{!isNaN(parseInt(week)) ? `第 ${week} 週` : week}</span><Badge color="gray">{weekTasks.length}</Badge></div><Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400" /></div>
                        {isExpanded && (<div className="p-2 space-y-2 bg-white">{weekTasks.map(task => <TaskCard key={task.id} task={task} />)}</div>)}
                    </Card>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-700 text-lg">任務列表</h2>
              <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"><Icon name={sortOrder === 'desc' ? "ArrowDown" : "ArrowUp"} className="w-4 h-4" /></button>
            </div>
            {isAdmin && !isHistoryMode && (<Button variant="primary" className="text-xs px-3 py-1.5" onClick={onOpenEditTask} icon="Plus">新增</Button>)}
          </div>

          <div className="flex flex-col gap-3">
              <div className="bg-slate-200 p-1 rounded-lg flex text-xs font-bold text-slate-500 w-full">
                  <button onClick={() => setFilterStatus('incomplete')} className={`flex-1 py-1.5 rounded-md transition-all whitespace-nowrap ${filterStatus === 'incomplete' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-700'}`}>未完成</button>
                  <button onClick={() => setFilterStatus('complete')} className={`flex-1 py-1.5 rounded-md transition-all whitespace-nowrap ${filterStatus === 'complete' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-700'}`}>已完成</button>
                  <button onClick={() => setFilterStatus('all')} className={`flex-1 py-1.5 rounded-md transition-all whitespace-nowrap ${filterStatus === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-700'}`}>全部</button>
              </div>
              
              <div className="flex flex-wrap gap-2 items-center">
                  <button 
                    onClick={() => setFilterCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterCategory === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                  >
                    全部
                  </button>
                  {filterOptions.map(cat => {
                      const isSelected = filterCategory === cat.firestoreId;
                      return (
                        <button 
                            key={cat.firestoreId}
                            onClick={() => setFilterCategory(cat.firestoreId)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1 ${isSelected ? 'ring-2 ring-offset-1 ring-slate-200' : 'hover:opacity-80'}`}
                            style={{ 
                                backgroundColor: cat.color, 
                                color: '#ffffff',
                                borderColor: cat.color 
                            }}
                        >
                            {isSelected && <Icon name="Check" className="w-3 h-3" />}
                            {cat.label}
                        </button>
                      );
                  })}
              </div>
          </div>
      </div>

      {pinnedList.length > 0 && (() => {
          const isPinnedExpanded = !!expandedWeeks['pinned-main'];
          return (
            <div className="space-y-2 mb-6">
                <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2 text-sm font-bold text-red-500 uppercase tracking-wider"><Icon name="Map" className="w-4 h-4" />常駐與公告</div><div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shrink-0"><button onClick={() => handleSingleSectionToggle('pinned-main', true)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors"><Icon name="ChevronsDown" className="w-3 h-3" /></button><div className="w-[1px] bg-slate-100 my-1"></div><button onClick={() => handleSingleSectionToggle('pinned-main', false)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors"><Icon name="ChevronsUp" className="w-3 h-3" /></button></div></div>
                {(isPinnedExpanded || expandedWeeks['pinned-main'] === undefined) && (<Card noPadding className="border-red-100 bg-red-50/10"><div className="p-2 space-y-2">{pinnedList.map(task => <TaskCard key={task.id} task={task} />)}</div></Card>)}
                {expandedWeeks['pinned-main'] === false && (<div className="text-center text-xs text-gray-400 cursor-pointer hover:text-red-500 py-2 border border-dashed border-gray-200 rounded-lg" onClick={() => handleSingleSectionToggle('pinned-main', true)}>已折疊 {pinnedList.length} 個常駐任務</div>)}
            </div>
          );
      })()}

      {weeklyGroup.length > 0 && <TaskGroupSection title="賽季進度" icon="Trophy" colorClass="text-slate-500" groupData={weeklyGroup} prefix="weekly" />}
      {dailyGroup.length > 0 && <TaskGroupSection title="每日挑戰" icon="Calendar" colorClass="text-orange-500" groupData={dailyGroup} prefix="daily" />}

      {(pinnedList.length === 0 && dailyGroup.length === 0 && weeklyGroup.length === 0) && (<div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200"><Icon name="Check" className="w-12 h-12 mx-auto mb-2 opacity-20" /><p className="text-sm font-bold">沒有符合條件的任務</p><p className="text-xs mt-1">太棒了！或者試試切換篩選器？</p></div>)}
    </div>
  );
};