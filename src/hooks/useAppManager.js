import { useState, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useData } from './useData';
import { useAdmin } from './useAdmin';
import { useToast } from '../context/ToastContext';
import { db } from '../services/firebase'; // 新增引入
import { collection, query, where, getDocs } from 'firebase/firestore'; // 新增引入

// 這個 Hook 用來組合所有的功能，讓 App.jsx 保持乾淨
export const useAppManager = () => {
  const [activeTab, setActiveTab] = useState('announcements');
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [exporting, setExporting] = useState(false); // 新增匯出狀態
  const { showToast } = useToast();

  // 1. Auth 模組
  const { currentUser, loading: authLoading, login, logout, updateCurrentUser } = useAuth();

  // 2. Data 模組
  const { tasks, submissions, users, announcements, games, seasonName } = useData(currentUser, updateCurrentUser);

  // 3. Admin 模組
  const { actions: adminActions, adminLoading } = useAdmin(currentUser, seasonName, users);

  // UI Helper Actions (這些是 "Wrapper" 函式，負責先用 ID 找到物件，再呼叫 Admin Action)
  const uiActions = {
    setTab: (tab) => setActiveTab(tab),
    toggleWeek: (week) => {
      setExpandedWeeks(prev => ({ ...prev, [week]: !prev[week] }));
    },
    refresh: () => showToast("資料已是最新狀態"),
    
    // --- 匯出 CSV 功能 ---
    exportReport: async () => {
      setExporting(true);
      try {
        showToast("正在下載完整資料，請稍候...");
        
        // 1. 抓取該賽季所有已通過的提交紀錄 (不依賴前端可能被截斷的 state)
        // 這樣可以確保即使前端只顯示最近 100 筆，匯出的報表也是準確的總分
        let allSubmissions = [];
        try {
            const q = query(
                collection(db, "submissions"), 
                where("status", "==", "approved"),
                where("season", "==", seasonName) // 只抓目前賽季
            );
            const snapshot = await getDocs(q);
            allSubmissions = snapshot.docs.map(d => d.data());
        } catch (e) {
            console.error("Fetch full report failed, using local state", e);
            // 如果抓取失敗 (例如索引還沒建好)，降級使用前端現有資料
            allSubmissions = submissions.filter(s => s.status === 'approved');
        }

        // 2. 準備 CSV 內容
        const reportUsers = users.filter(u => !u.isAdmin); // 排除管理員
        
        // 建立快速查找表 Map<"uid_taskId", points>
        const subMap = new Map();
        allSubmissions.forEach(s => {
            subMap.set(`${s.uid}_${s.taskId}`, Number(s.points) || 0);
        });

        // 任務排序 (週次 -> ID)
        const sortedTasks = [...tasks].sort((a, b) => {
            const wa = parseInt(a.week) || 999;
            const wb = parseInt(b.week) || 999;
            return wa === wb ? String(a.id).localeCompare(String(b.id)) : wa - wb;
        });

        // CSV 標頭
        const headers = ['User ID', 'Username', 'Total Points', ...sortedTasks.map(t => `[W${t.week}] ${t.title}`)];
        
        // CSV 資料列
        const rows = reportUsers.map(u => {
            let total = 0;
            const taskCols = sortedTasks.map(t => {
                const pts = subMap.get(`${u.uid}_${t.id}`) || 0;
                total += pts;
                return pts;
            });
            
            // 處理 CSV 格式 (避免內容包含逗號導致跑版)
            const safeUid = `"${u.uid}"`;
            const safeName = `"${(u.username || '').replace(/"/g, '""')}"`; 
            
            return [safeUid, safeName, total, ...taskCols].join(',');
        });

        // 加上 BOM (\uFEFF) 讓 Excel 能正確識別 UTF-8 中文
        const csvString = '\uFEFF' + [headers.join(','), ...rows].join('\n');

        // 3. 觸發瀏覽器下載
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `TeamAura_Report_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("報表已匯出");
      } catch (e) {
        console.error(e);
        showToast("匯出失敗: " + e.message, "error");
      } finally {
        setExporting(false);
      }
    },

    // --- 這裡的函式名稱與 adminActions 重疊，必須確保這些 Wrapper 優先執行 ---

    deleteTask: (id) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        setDialog({ isOpen: true, title: "刪除任務", message: "確定？", onConfirm: async () => { 
          await adminActions.deleteTask(task.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    deleteAnnouncement: (id) => {
      const item = announcements.find(x => x.id === id);
      if (item) {
        setDialog({ isOpen: true, title: "刪除公告", message: "確定？", onConfirm: async () => { 
          await adminActions.deleteAnnouncement(item.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    deleteGame: (id) => {
      const item = games.find(x => x.id === id);
      if (item) {
        setDialog({ isOpen: true, title: "刪除遊戲", message: "確定？", onConfirm: async () => { 
          await adminActions.deleteGame(item.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    withdraw: (subId) => {
      const sub = submissions.find(s => s.id === subId);
      if (sub) {
        setDialog({ isOpen: true, title: "撤回提交", message: "確定？", onConfirm: async () => { 
          await adminActions.withdraw(sub.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    review: (subId, action, points, statusOverride) => {
        const sub = submissions.find(s => s.id === subId);
        if(sub) {
            adminActions.review(sub, action, points, statusOverride);
        } else {
            console.error("Submission not found in local state:", subId);
            showToast("找不到該筆資料，請重新整理", "error");
        }
    },
    updateAnnouncement: (id, title, content, rawFiles) => {
        const item = announcements.find(x => x.id === id);
        if(item) return adminActions.updateAnnouncement(item, title, content, rawFiles);
    },
    updateGame: (data) => {
        const item = games.find(g => g.id === data.id);
        if(item) return adminActions.updateGame(item, data);
    }
  };

  // 自動展開第一週 (如果還沒展開過)
  useMemo(() => {
    if (tasks.length > 0 && Object.keys(expandedWeeks).length === 0) {
        const weeks = tasks.map(t => parseInt(t.week) || 0);
        if (weeks.length > 0) setExpandedWeeks({ [Math.max(...weeks)]: true });
    }
  }, [tasks]);

  const sortedUsers = useMemo(() => {
    return [...users].filter(u => !u.isAdmin).sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
  }, [users]);

  // 組合所有 State 與 Actions 回傳給 App.jsx
  return {
    state: {
      tasks, submissions, users, announcements, games, currentUser,
      activeTab, loading: authLoading || adminLoading || exporting, expandedWeeks, seasonName, refreshing: false
    },
    actions: {
      login, 
      logout, 
      // ⚠️ 修正重點：把 ...adminActions 放在前面，...uiActions 放在後面
      // 這樣當函式名稱重複時 (如 review, deleteTask)，會優先使用 uiActions 的版本 (Wrapper)
      ...adminActions,
      ...uiActions 
    },
    sortedUsers,
    dialog,
    setDialog
  };
};