import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Icon } from './Icons';

// 接收 users 參數以進行即時查找
export const AdminConsole = ({ pendingSubs, processedSubs, tasks, onReview, showHistory, toggleHistory, isHistoryMode, users = [] }) => {
 const [viewing, setViewing] = useState(null);
 const [editSub, setEditSub] = useState(null);
 const [inputPoints, setInputPoints] = useState({});

 const handlePointChange = (subId, value) => {
   setInputPoints(prev => ({ ...prev, [subId]: value }));
 };

 // 輔助函式：取得最新的顯示名稱
 const getLatestDisplayName = (sub) => {
    // 1. 優先透過 userDocId (唯一識別碼) 查找目前的使用者資料
    if (sub.userDocId) {
        const foundUser = users.find(u => u.firestoreId === sub.userDocId);
        if (foundUser) return foundUser.username;
    }
    
    // 2. 如果沒有 userDocId (舊資料)，嘗試用 uid (當時的 username) 查找是否還存在該使用者
    // 注意：舊資料的 uid 就是 username
    const foundUserByUid = users.find(u => u.username === sub.uid);
    if (foundUserByUid) return foundUserByUid.username;

    // 3. 如果都找不到 (使用者可能已被刪除)，回退顯示紀錄中的快照資料
    return sub.username || sub.uid;
 };

 return (
   <div className="bg-slate-800 text-white p-5 rounded-2xl shadow-lg mt-6">
     <div className="flex justify-between items-center mb-4">
       <h3 className="font-bold flex items-center gap-2 text-lg">
         <Icon name="Shield" className="w-5 h-5 text-indigo-400" />
         {isHistoryMode ? '歷史審核紀錄' : '審核控制台'}
       </h3>
       <button
         onClick={toggleHistory}
         className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
       >
         <Icon name="History" className="w-3 h-3" /> {showHistory ? '隱藏歷史' : '顯示歷史'}
       </button>
     </div>

     {/* 待審核區塊 - 僅在非歷史模式顯示 */}
     {!isHistoryMode && (
       pendingSubs.length > 0 ? (
         <div className="space-y-3">
           {pendingSubs.map(sub => {
             const task = tasks.find(t => t.id === sub.taskId);
             const imgs = JSON.parse(sub.images || sub.proofImage || '[]');
             const isVari = task?.type === 'variable';
             const currentPoints = inputPoints[sub.id] || '';

             // 使用輔助函式取得最新名稱
             const displayName = getLatestDisplayName(sub);
             const displayId = sub.userDocId ? `(ID: ...${sub.userDocId.slice(-4)})` : '';

             let pointsToPass = 0;
             if (isVari) {
                 pointsToPass = currentPoints;
             } else {
                 if (sub.basePoints !== undefined && sub.basePoints !== null) {
                     pointsToPass = sub.basePoints;
                 } else if (task && task.points) {
                     pointsToPass = task.points;
                 } else {
                     pointsToPass = sub.points;
                 }
             }

             return (
               <div key={sub.id} className="bg-slate-700 p-4 rounded-xl border border-slate-600">
                 <div className="flex justify-between text-xs text-slate-400 mb-2">
                   <span className="font-bold text-slate-200">
                       {displayName} <span className="text-slate-500 font-normal scale-90">{displayId}</span>
                   </span>
                   <span className="bg-slate-600 px-1.5 rounded text-white">W{sub.week}</span>
                 </div>
                 <div className="font-bold text-lg mb-1">{sub.taskTitle}</div>
                 <div className="text-xs text-slate-300 mb-3">{sub.proof || '無備註'}</div>
                
                 {imgs.length > 0 && (
                   <div className="flex gap-2 overflow-x-auto mb-3 pb-2 custom-scrollbar">
                     {imgs.map((url, i) => (
                       <img
                         key={i}
                         src={url}
                         onClick={() => setViewing(url)}
                         className="w-16 h-16 object-cover rounded border border-slate-500 cursor-pointer hover:opacity-80 transition-opacity"
                         alt="proof"
                         loading="lazy"
                       />
                     ))}
                   </div>
                 )}

                 {isVari && (
                   <input
                     type="number"
                     placeholder="請輸入分數"
                     value={currentPoints}
                     onChange={(e) => handlePointChange(sub.id, e.target.value)}
                     className="w-full p-2 mb-3 bg-slate-800 text-white border border-slate-600 rounded text-sm outline-none focus:border-indigo-500 transition-colors"
                   />
                 )}

                 <div className="flex gap-2">
                   <Button
                     variant="success"
                     className="flex-1 py-1.5 text-sm"
                     onClick={() => onReview(sub.id, 'approve', pointsToPass)}
                   >
                     通過
                   </Button>
                   <Button
                     variant="ghost"
                     className="flex-1 py-1.5 text-sm bg-slate-600 hover:bg-red-500 text-white"
                     onClick={() => onReview(sub.id, 'reject', 0)}
                   >
                     駁回
                   </Button>
                 </div>
               </div>
             );
           })}
         </div>
       ) : (
         <div className="text-slate-500 text-center text-sm py-4 border border-dashed border-slate-600 rounded-xl">無待審核任務</div>
       )
     )}

     {/* 歷史紀錄區塊 - 只要 showHistory 為 true 就顯示 */}
     {showHistory && (
       <div className={`border-t border-slate-700 pt-4 mt-4 animate-fadeIn ${isHistoryMode ? 'border-t-0 pt-0 mt-0' : ''}`}>
         {!isHistoryMode && <h4 className="font-bold text-sm mb-3 text-slate-300">歷史紀錄 & 修正</h4>}
        
         <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
           {processedSubs.map(sub => {
             const isApproved = sub.status === 'approved';
             // 歷史紀錄也同步使用最新名稱
             const displayName = getLatestDisplayName(sub);

             return (
               <div key={sub.id} className="bg-slate-700/50 p-3 rounded-lg flex justify-between items-center text-xs border border-slate-700">
                 <div className="flex-1">
                   <div className="flex gap-2 mb-1 items-center">
                     <span className="font-bold text-slate-200">{displayName}</span>
                     <Badge color={sub.status==='approved'?'green':'red'}>{sub.status}</Badge>
                   </div>
                   <div className="text-slate-400 truncate">{sub.taskTitle}</div>
                   {isApproved && (
                     <div className="mt-1 text-[10px] text-slate-500">
                        原始分數: <span className="text-slate-300 font-bold">{sub.points}</span>
                     </div>
                   )}
                 </div>
                
                 {!isHistoryMode && (
                   <button
                     onClick={() => setEditSub(sub)}
                     className="p-2 bg-slate-600 hover:bg-indigo-500 rounded text-white transition-colors ml-2"
                   >
                     <Icon name="Edit2" className="w-3 h-3" />
                   </button>
                 )}
               </div>
             );
           })}
           {processedSubs.length === 0 && <div className="text-center text-slate-500 text-xs py-2">無歷史紀錄</div>}
         </div>
       </div>
     )}

     {viewing && (
       <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setViewing(null)}>
         <img src={viewing} className="max-w-full max-h-full rounded shadow-2xl" alt="proof full" />
         <button className="absolute top-4 right-4 text-white p-2"><Icon name="X" /></button>
       </div>
     )}

     <Modal isOpen={!!editSub} title="修正紀錄" onClose={() => setEditSub(null)}>
       {editSub && (
         <div className="space-y-4 text-slate-800">
           <div className="text-xs bg-gray-50 p-2 rounded">
               User: {getLatestDisplayName(editSub)}<br/>
               Task: {editSub.taskTitle}
           </div>
           <div>
             <label className="text-xs font-bold text-gray-500">狀態</label>
             <select
               value={editSub.status}
               onChange={e => setEditSub({...editSub, status: e.target.value})}
               className="w-full p-2 border rounded mt-1 outline-none focus:border-indigo-500"
             >
               <option value="approved">通過</option>
               <option value="rejected">駁回</option>
             </select>
           </div>
           {editSub.status === 'approved' && (
             <div>
               <label className="text-xs font-bold text-gray-500">
                 原始分數 (Base Points)
                 <span className="font-normal text-gray-400 ml-1 block mt-1 text-[10px]">
                   - 請輸入原始分數，系統會自動在後台計算加成。
                 </span>
               </label>
               <input
                 type="number"
                 value={editSub.basePoints !== undefined ? editSub.basePoints : editSub.points}
                 onChange={e => setEditSub({...editSub, points: e.target.value, basePoints: e.target.value})}
                 className="w-full p-2 border rounded mt-1 outline-none focus:border-indigo-500"
               />
             </div>
           )}
           <Button
             variant="primary"
             className="w-full"
             onClick={() => {
               onReview(editSub.id, 'update', editSub.points, editSub.status);
               setEditSub(null);
             }}
           >
             確認修正
           </Button>
         </div>
       )}
     </Modal>
   </div>
 );
};