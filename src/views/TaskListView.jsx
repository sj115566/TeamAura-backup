import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';

// 定義分類顏色
const categoryColors = {
    '一般': 'bg-gray-100 text-gray-600',
    '每日': 'bg-orange-100 text-orange-700',
    '每週': 'bg-blue-100 text-blue-700',
    '挑戰': 'bg-purple-100 text-purple-700',
    '賽季': 'bg-yellow-100 text-yellow-700'
};

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
    onExpandAll,
    onCollapseAll,
    isHistoryMode 
}) => {
  const [sortOrder, setSortOrder] = useState('desc');
  // 新增篩選狀態
  const [filterStatus, setFilterStatus] = useState('incomplete'); // incomplete, complete, all
  const [filterCategory, setFilterCategory] = useState('all');

  const groupedTasks = useMemo(() => {
    // 1. 先根據篩選條件過濾任務
    let filteredTasks = tasks.filter(t => {
        // 分類篩選
        if (filterCategory !== 'all' && (t.category || '一般') !== filterCategory) return false;
        
        // 狀態篩選
        const mySub = submissions.find(s => s.taskId === t.id && s.uid === currentUser.uid);
        const status = mySub ? mySub.status : null;
        const isDone = status === 'pending' || status === 'approved';

        if (filterStatus === 'incomplete' && isDone) return false;
        if (filterStatus === 'complete' && !isDone) return false;

        return true;
    });

    // 2. 進行分組
    const grouped = {};
    filteredTasks.forEach(t => {
      const w = t.week || 'Other';
      if (!grouped[w]) grouped[w] = [];
      grouped[w].push(t);
    });
    
    // 3. 週次排序
    const sortedWeeks = Object.keys(grouped).sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      const compare = (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
      return sortOrder === 'asc' ? compare : -compare;
    });

    // 4. 週內任務排序：置頂優先 -> ID (時間)
    sortedWeeks.forEach(w => {
        grouped[w].sort((a, b) => {
            // 先比置頂 (true 在前)
            if (!!a.isPinned !== !!b.isPinned) {
                return a.isPinned ? -1 : 1;
            }
            // 再比 ID (建立時間)
            return String(b.id).localeCompare(String(a.id));
        });
    });

    return sortedWeeks.map(w => ({ week: w, tasks: grouped[w] }));
  }, [tasks, sortOrder, filterStatus, filterCategory, submissions, currentUser]);

  // 計算所有可用的分類
  const availableCategories = useMemo(() => {
      const cats = new Set(['一般', '每日', '每週', '挑戰', '賽季']);
      tasks.forEach(t => t.category && cats.add(t.category));
      return Array.from(cats);
  }, [tasks]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 頂部控制列 */}
      <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-700 text-lg">任務列表</h2>
              <div className="flex gap-1">
                  <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} 
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"
                    title="切換週次排序"
                  >
                    <Icon name={sortOrder === 'desc' ? "ArrowDown" : "ArrowUp"} className="w-4 h-4" />
                  </button>
              </div>
            </div>
            {isAdmin && !isHistoryMode && (
              <Button variant="primary" className="text-xs px-3 py-1.5" onClick={onOpenEditTask} icon="Plus">
                新增
              </Button>
            )}
          </div>

          {/* 篩選器與操作區域 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {/* 左側：篩選條件群組 (狀態 + 分類) */}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {/* 狀態篩選 Segmented Control */}
                  <div className="bg-slate-200 p-1 rounded-lg flex text-xs font-bold text-slate-500 w-full sm:w-auto">
                      <button 
                        onClick={() => setFilterStatus('incomplete')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${filterStatus === 'incomplete' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-700'}`}
                      >
                        未完成
                      </button>
                      <button 
                        onClick={() => setFilterStatus('complete')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${filterStatus === 'complete' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-700'}`}
                      >
                        已完成
                      </button>
                      <button 
                        onClick={() => setFilterStatus('all')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${filterStatus === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-700'}`}
                      >
                        全部
                      </button>
                  </div>

                  {/* 分類篩選 Dropdown */}
                  <select 
                      value={filterCategory} 
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 w-full sm:w-auto min-w-[100px]"
                  >
                      <option value="all">所有分類</option>
                      {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>

              {/* 中間間隔：使用 flex-1 自動推開，達成您想要的空白效果 */}
              <div className="flex-1 hidden sm:block"></div>

              {/* 右側：全部展開/折疊按鈕 */}
              <div className="flex justify-end">
                <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shrink-0">
                    <button 
                        onClick={onExpandAll} 
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                        title="展開全部週次"
                    >
                        <Icon name="ChevronsDown" className="w-4 h-4" />
                    </button>
                    <div className="w-[1px] bg-slate-100 my-1"></div>
                    <button 
                        onClick={onCollapseAll} 
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                        title="折疊全部週次"
                    >
                        <Icon name="ChevronsUp" className="w-4 h-4" />
                    </button>
                </div>
              </div>
          </div>
      </div>

      <div className="space-y-3">
        {groupedTasks.length > 0 ? groupedTasks.map(({ week, tasks: weekTasks }) => (
          <Card key={week} noPadding className="border-slate-200">
            <div 
              onClick={() => onToggleWeek(week)} 
              className="p-3 bg-slate-50 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 select-none transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <Icon name="Calendar" className="w-4 h-4 text-indigo-500" />
                <span>第 {week} 週</span>
                <Badge color="gray">{weekTasks.length} 任務</Badge>
              </div>
              <Icon name={expandedWeeks[week] ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400" />
            </div>
            {expandedWeeks[week] && (
              <div className="p-2 space-y-2 bg-white">
                {weekTasks.map(task => {
                  const mySub = submissions.find(s => s.taskId === task.id && s.uid === currentUser.uid);
                  const status = mySub ? mySub.status : null;
                  const isDone = status === 'pending' || status === 'approved';
                  const catColor = categoryColors[task.category] || categoryColors['一般'];

                  return (
                    <div key={task.id} className={`p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-indigo-100 transition-all group ${task.isPinned ? 'bg-indigo-50/30 border-indigo-100' : 'border-gray-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className="text-xl w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                            {task.icon}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                              {task.isPinned && <Icon name="Map" className="w-3 h-3 text-indigo-500" />} {/* Pin Icon */}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${catColor}`}>
                                  {task.category || '一般'}
                              </span>
                              <div className="font-bold text-sm text-slate-800">{task.title}</div>
                          </div>
                          {task.description && <div className="text-[11px] text-gray-500 pl-1">{task.description}</div>}
                          <div className="text-xs text-indigo-600 font-bold pl-1">{task.type === 'variable' ? '管理員評分' : `+${task.points} pts`}</div>
                        </div>
                      </div>
                      
                      <div className="flex justify-end items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                        {isAdmin ? (
                          !isHistoryMode && (
                            <>
                                {/* 編輯按鈕 */}
                                <button 
                                    onClick={() => onEditTask(task)} 
                                    className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-blue-600 transition-colors"
                                    title="編輯任務"
                                >
                                    <Icon name="Edit2" className="w-4 h-4" />
                                </button>

                                {/* 複製按鈕 */}
                                <button 
                                    onClick={() => onDuplicateTask(task)} 
                                    className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                                    title="複製此任務"
                                >
                                    {/* 使用 Copy Icon */}
                                    <Icon name="Copy" className="w-4 h-4" /> 
                                </button>
                                <Button variant="danger" className="p-2 rounded-lg" onClick={() => onDeleteTask(task.id)}>
                                    <Icon name="Trash2" className="w-4 h-4" />
                                </Button>
                            </>
                          )
                        ) : (
                          !isDone ? (
                            !isHistoryMode && <Button variant="primary" className="text-xs px-4 py-1.5 w-full sm:w-auto" onClick={() => onOpenSubmit(task)}>回報</Button>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <Badge color={status === 'approved' ? 'green' : 'yellow'}>{status === 'approved' ? '已通過' : '審核中'}</Badge>
                              {status === 'pending' && !isHistoryMode && <button onClick={() => onOpenWithdraw(mySub.id)} className="text-[10px] text-red-400 hover:text-red-600 underline font-bold">撤回</button>}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )) : (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                <Icon name="Check" className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-bold">沒有符合條件的任務</p>
                <p className="text-xs mt-1">太棒了！或者試試切換篩選器？</p>
            </div>
        )}
      </div>
    </div>
  );
};