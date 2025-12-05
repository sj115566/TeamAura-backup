import React, { useState, useEffect } from 'react';
import { Tag, GitCommit, Clock, X, FileText } from 'lucide-react'; // 假設您有這些 icon
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';


export const LoginView = ({ onLogin, loading }) => {
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [versionInfo, setVersionInfo] = useState({
   version: 'Dev', // 預設值
   hash: '',
   date: '',
   notes: '' // 新增：用來存完整說明
 });


   // 控制彈出視窗的開關
   const [showModal, setShowModal] = useState(false);
  
   // ▼▼▼ 加入這段 useEffect ▼▼▼
   useEffect(() => {
     fetch('./version.json')
       .then((res) => {
         if (!res.ok) throw new Error("No version file");
         return res.json();
       })
       .then((data) => {
         setVersionInfo({
           version: data.version,
           hash: data.hash.substring(0, 7),
           date: data.date,
           notes: data.notes || "沒有詳細說明" // 讀取完整內容
         });
       })
       .catch((err) => {
         console.log("Running in local mode or version file missing");
       });
   }, []);
   // ▲▲▲ 加入上面這段 ▲▲▲




 // 保持原本的密碼邏輯 (使用者要求不更動)
 const handleLogin = (e) => {
   e?.preventDefault(); // 防止表單預設刷新
   // 如果密碼少於 6 位，自動補上後綴
   const finalPassword = password.length < 6 ? password + "_teamaura" : password;
   onLogin(username, finalPassword);
 };


 return (
   <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
     <Card className="w-full max-w-sm text-center relative pt-8 pb-8">
       <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
       <div className="text-6xl mb-4">🌀</div>
       <h1 className="text-2xl font-black text-slate-800 mb-1">Team Aura 波導戰隊</h1>
       <h1 className="text-xl font-black text-slate-800 mb-3">Pokémon GO 任務上傳系統</h1>
       <p className="text-red-500 text-xs mb-1">* 帳號中的英文字，請一律改為小寫</p>
       <p className="text-gray-400 text-xs mb-3">(密碼大小寫按照你原先的設定，不須變動)</p>
       <p className="text-gray-400 text-xs mb-3">* 無帳密、無法登入、忘記密碼等疑難雜症請直接找蘭斯</p>
      
       {/* 優化：使用 form 標籤，提升手機輸入體驗 */}
       <form onSubmit={handleLogin} className="space-y-3 mb-6">
         <input
           value={username}
           onChange={(e) => setUsername(e.target.value)}
           className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-colors"
           placeholder="帳號"
           required
         />
         <input
           type="password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-colors"
           placeholder="密碼"
           required
         />
         <Button type="submit" disabled={loading} className="w-full py-3.5">
           {loading ? '登入中...' : '登入'}
         </Button>
       </form>


     {/* ▼▼▼ 底部版本資訊區 (可點擊) ▼▼▼ */}
     <div className="flex flex-col items-center gap-2">
      
       {/* 主要版本號 */}
       <div className="flex items-center gap-2 px-3 py-1 bg-slate-200 rounded-full text-slate-600 text-xs font-mono font-bold shadow-sm">
         <Tag size={12} />
         <span>{versionInfo.version}</span>
       </div>


       {/* 時間與 Hash (點擊觸發彈窗) */}
       {versionInfo.date && (
         <button
           onClick={() => setShowModal(true)}
           className="group flex items-center gap-2 text-[10px] text-slate-400 font-mono hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-none outline-none"
           title="點擊查看版本詳情"
         >
           <Clock size={10} className="group-hover:scale-110 transition-transform" />
           <span>Last Updated: {versionInfo.date}</span>
           <GitCommit size={10} className="ml-1" />
           <span>{versionInfo.hash}</span>
         </button>
       )}
     </div>


     {/* ▼▼▼ 版本說明彈出視窗 (Modal) ▼▼▼ */}
     {showModal && (
       <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
         {/* 背景遮罩 (點擊背景也可以關閉) */}
         <div
           className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
           onClick={() => setShowModal(false)}
         ></div>


         {/* 彈窗本體 */}
         <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          
           {/* 標題列 */}
           <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
             <div className="flex items-center gap-2 text-slate-700 font-semibold">
               <FileText size={18} className="text-blue-500"/>
               <span>版本詳細資訊</span>
             </div>
             <button
               onClick={() => setShowModal(false)}
               className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
             >
               <X size={20} />
             </button>
           </div>


           {/* 內容區：顯示完整 Commit Message */}
           <div className="p-6 max-h-[60vh] overflow-y-auto">
             <div className="space-y-4">
              
               {/* 標題 (Subject) */}
               <div>
                 <h3 className="text-sm font-bold text-slate-900 mb-1">更新摘要</h3>
                 <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                   {versionInfo.version}
                 </p>
               </div>


               {/* 內容 (Body) - 支援換行顯示 */}
               <div>
                 <h3 className="text-sm font-bold text-slate-900 mb-1">詳細說明 (Commit Log)</h3>
                 <div className="text-xs font-mono text-slate-600 bg-slate-900/5 p-4 rounded-lg whitespace-pre-wrap leading-relaxed border border-slate-200/50">
                   {versionInfo.notes}
                 </div>
               </div>


               {/* 底部資訊 */}
               <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                 <span>Hash: {versionInfo.hash}</span>
                 <span>{versionInfo.date}</span>
               </div>
             </div>
           </div>


           {/* 按鈕列 */}
           <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end">
             <button
               onClick={() => setShowModal(false)}
               className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
             >
               關閉
             </button>
           </div>


         </div>
       </div>
     )}
     {/* ▲▲▲ 彈窗結束 ▲▲▲ */}
  
     </Card>
   </div>
 );
};

