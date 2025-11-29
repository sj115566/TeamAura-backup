import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit } from 'firebase/firestore';

export const useData = (currentUser, updateCurrentUser) => {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [games, setGames] = useState([]);
  const [seasonName, setSeasonName] = useState('載入中...');

  useEffect(() => {
    // 1. 系統設定 (Season)
    const unsubSettings = onSnapshot(doc(db, "system", "config"), (doc) => {
        if (doc.exists()) setSeasonName(doc.data().currentSeason);
        else setSeasonName("未設定賽季");
    });

    if (!currentUser) return unsubSettings;

    // 2. 任務列表 (Tasks)
    const unsubTasks = onSnapshot(query(collection(db, "tasks"), orderBy("id", "desc")), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id })));
    });
    
    // 3. 提交紀錄 (Submissions) - 限制讀取最近 100 筆
    const unsubSubs = onSnapshot(query(collection(db, "submissions"), orderBy("timestamp", "desc"), limit(100)), (s) => {
      // 確保這裡正確設定了 firestoreId
      setSubmissions(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });

    // 4. 公告 (Announcements) - 限制讀取最近 20 筆
    const unsubAnc = onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc"), limit(20)), (s) => {
      setAnnouncements(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });
    
    // 5. 使用者列表 (Users)
    // 這裡的邏輯非常關鍵：它負責即時更新所有人的分數，並且同步更新自己 (currentUser)
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            ...data, 
            uid: data.uid || data.username, 
            // 強制轉為數字，避免字串相加導致錯誤 (e.g., "10" + 10 = "1010")
            points: Number(data.points) || 0,
            firestoreId: doc.id 
        };
      });
      setUsers(usersData);
      
      // 同步更新當前使用者 (currentUser)
      // 當 users 集合中有自己的資料變動時 (例如積分增加)，這裡會觸發
      if (currentUser) {
          const freshMe = usersData.find(u => u.username === currentUser.username);
          if (freshMe) {
              // 檢查是否有關鍵資料變動，避免無窮迴圈
              // 這裡只要積分 (points) 或管理員權限 (isAdmin) 有變，就呼叫 updateCurrentUser
              const pointsChanged = freshMe.points !== (currentUser.points || 0);
              const adminChanged = freshMe.isAdmin !== currentUser.isAdmin;
              
              if (pointsChanged || adminChanged) {
                  console.log(`User data synced: Points ${currentUser.points} -> ${freshMe.points}`);
                  updateCurrentUser(freshMe);
              }
          }
      }
    });

    // 6. 遊戲列表 (Games)
    const unsubGames = onSnapshot(collection(db, "games"), (s) => {
      setGames(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });

    return () => { 
      unsubSettings(); 
      unsubTasks(); 
      unsubSubs(); 
      unsubAnc(); 
      unsubUsers(); 
      unsubGames(); 
    };
  }, [currentUser?.username]); 
  // 注意：這裡依賴 currentUser.username，而不是整個 currentUser 物件
  // 這樣可以避免因為 points 更新導致 useEffect 重新執行 (造成閃爍或無窮迴圈)

  return { tasks, submissions, users, announcements, games, seasonName };
};