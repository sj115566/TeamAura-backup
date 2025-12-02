import React, { useState, useEffect } from 'react';
import { Tag, GitCommit, Clock } from 'lucide-react'; // 假設您有這些 icon
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export const LoginView = ({ onLogin, loading, onInitialize }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [versionInfo, setVersionInfo] = useState({
    version: 'Dev', // 預設值
    hash: '',
    date: ''
  });

    // ▼▼▼ 加入這段 useEffect ▼▼▼
    useEffect(() => {
      // 這裡去抓取跟網頁同層級的 version.json
      // 注意：本地開發 (Localhost) 時通常會抓不到 (404)，這是正常的
      fetch('./version.json')
        .then((res) => {
          if (!res.ok) throw new Error("No version file");
          return res.json();
        })
        .then((data) => {
          console.log("Version loaded:", data);
          // 如果抓到了，就更新狀態
          setVersionInfo({
            version: data.version,    // 例如: main 或 v1.0.0
            hash: data.hash.substring(0, 7), // 只取 hash 前7碼
            date: data.date
          });
        })
        .catch((err) => {
          // 本地開發或發生錯誤時，保持預設值或顯示 Local
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

        {/* ▼▼▼ 將版本號顯示在底部 ▼▼▼ */}
        <div className="flex flex-col items-center gap-1">
          
          {/* 主要版本號顯示 */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-200 rounded-full text-slate-600 text-xs font-mono font-bold shadow-sm">
            <Tag size={12}/>
            <span>{versionInfo.version}</span>
          </div>

          {/* 次要資訊 (Commit Hash)，滑鼠移上去可以看到時間 (選用) */}
          {versionInfo.hash && (
            <div 
              className="flex items-center gap-1 text-[10px] text-slate-400 font-mono hover:text-slate-600 transition-colors cursor-help"
              title={`Build Time: ${versionInfo.date}`}
            >
              <GitCommit size={10} />
              <span>{versionInfo.hash}</span>
            </div>
          )}
        </div>
        {/* ▲▲▲ 結束 ▲▲▲ */}
    
      </Card>
    </div>
  );
};