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
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            ...data, 
            uid: data.uid || data.username, 
            points: Number(data.points) || 0,
            firestoreId: doc.id // 確保這裡也有設定
        };
      });
      setUsers(usersData);
      
      if (currentUser) {
          const freshMe = usersData.find(u => u.username === currentUser.username);
          if (freshMe && (freshMe.points !== currentUser.points || freshMe.isAdmin !== currentUser.isAdmin)) {
              updateCurrentUser(freshMe);
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

  return { tasks, submissions, users, announcements, games, seasonName };
};