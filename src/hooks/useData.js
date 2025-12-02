import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit, where, getDocs } from 'firebase/firestore';

export const useData = (currentUser, updateCurrentUser) => {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [games, setGames] = useState([]);
  const [roles, setRoles] = useState([]); 
  
  // 賽季狀態
  const [currentSeason, setCurrentSeason] = useState('載入中...');
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  
  // 賽季目標分數與標題
  const [seasonGoal, setSeasonGoal] = useState(1000);
  const [seasonGoalTitle, setSeasonGoalTitle] = useState("Season Goal");

  // 判斷是否為歷史模式
  const isHistoryMode = useMemo(() => {
    return selectedSeason && selectedSeason !== currentSeason && currentSeason !== '載入中...';
  }, [selectedSeason, currentSeason]);

  // 1. 監聽系統設定 (公開或需登入)
  // 為了避免權限錯誤，這裡也建議等待 currentUser 存在，除非你的 system 集合是完全公開的
  // 根據你的 Rules，system 集合需要 isAuthenticated()，所以必須等待 currentUser
  useEffect(() => {
    if (!currentUser) return; // 新增：等待登入後才監聽設定

    const unsubSettings = onSnapshot(doc(db, "system", "config"), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const curr = data.currentSeason || "第一賽季";
            
            setCurrentSeason(curr);
            
            if (data.seasonGoal) setSeasonGoal(Number(data.seasonGoal));
            if (data.seasonGoalTitle) setSeasonGoalTitle(data.seasonGoalTitle);
            
            const past = data.availableSeasons || [];
            const all = Array.from(new Set([...past, curr]));
            setAvailableSeasons(all);

            // 只有當尚未選擇賽季時，才自動切換到當前賽季
            setSelectedSeason(prev => {
                if (!prev || !all.includes(prev)) return curr;
                return prev;
            });
        } else {
            // 文件不存在的處理 (初始化)
            setCurrentSeason("第一賽季");
            setAvailableSeasons(["第一賽季"]);
            setSelectedSeason("第一賽季");
        }
    }, (error) => {
        console.error("系統設定讀取失敗:", error);
        // 不要在這裡直接設為無法讀取，可能會覆蓋掉正確狀態，讓它保持 '載入中...' 或重試
    });

    return () => unsubSettings();
  }, [currentUser]); // 依賴 currentUser

  // 2. 主資料監聽
  useEffect(() => {
    // 關鍵修正：必須要有 currentUser 且已選擇賽季才開始監聽
    if (!currentUser || !selectedSeason) return;

    let unsubTasks = () => {};
    let unsubSubs = () => {};
    let unsubAnc = () => {};
    let unsubUsers = () => {};
    let unsubRoles = () => {};

    // --- 載入遊戲 (需要登入) ---
    const unsubGames = onSnapshot(collection(db, "games"), (s) => {
      setGames(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    }, (error) => console.error("Games fetch error:", error));

    // --- 載入身分組 (需要登入) ---
    unsubRoles = onSnapshot(collection(db, "roles"), (s) => {
        setRoles(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    }, (error) => console.error("Roles fetch error:", error));

    const fetchData = async () => {
      // Tasks (需要登入)
      const taskQ = query(collection(db, "tasks"), orderBy("id", "desc"));
      unsubTasks = onSnapshot(taskQ, (snapshot) => {
        const allTasks = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
        const filteredTasks = allTasks.filter(t => !t.season || t.season === selectedSeason);
        setTasks(filteredTasks);
      }, (error) => console.error("Tasks fetch error:", error));

      // Announcements (需要登入)
      const ancQ = query(collection(db, "announcements"), orderBy("timestamp", "desc"), limit(50));
      unsubAnc = onSnapshot(ancQ, (snapshot) => {
          const allAnc = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
          const filteredAnc = allAnc.filter(a => !a.season || a.season === selectedSeason);
          setAnnouncements(filteredAnc);
      }, (error) => console.error("Announcements fetch error:", error));

      if (!isHistoryMode) {
        // 當前賽季模式
        const limitCount = currentUser?.isAdmin ? 1000 : 100;
        const subQ = query(
            collection(db, "submissions"), 
            where("season", "==", selectedSeason),
            orderBy("timestamp", "desc"), 
            limit(limitCount)
        );
        
        unsubSubs = onSnapshot(subQ, (s) => {
            setSubmissions(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
        }, (error) => console.error("Submissions fetch error:", error));

        // Users (需要登入)
        unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
            const usersData = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    ...data, 
                    uid: data.uid || data.username, 
                    points: Number(data.points) || 0,
                    firestoreId: doc.id 
                };
            });
            setUsers(usersData);
            
            // 同步更新當前使用者的最新資料
            if (currentUser) {
                const freshMe = usersData.find(u => u.username === currentUser.username);
                // 只有當分數或權限改變時才更新，避免無限迴圈
                if (freshMe && (freshMe.points !== (currentUser.points || 0) || freshMe.isAdmin !== currentUser.isAdmin || JSON.stringify(freshMe.roles) !== JSON.stringify(currentUser.roles))) {
                    updateCurrentUser(freshMe);
                }
            }
        }, (error) => console.error("Users fetch error:", error));

      } else {
        // 歷史模式
        const subQ = query(
            collection(db, "submissions"), 
            where("season", "==", selectedSeason),
            orderBy("timestamp", "desc")
        );
        
        unsubSubs = onSnapshot(subQ, (snapshot) => {
            const allSubs = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
            setSubmissions(allSubs);

            // 歷史模式下，使用者積分需動態計算 (因為 users 集合只存當前積分)
            // 這裡可以依賴 useAdmin 裡的邏輯，或者簡單加總 approved 的 points
            const seasonPointsMap = {};
            allSubs.forEach(sub => {
                if (sub.status === 'approved') {
                    // 這裡的 points 已經是加權後的了 (如果是舊資料)
                    // 但因為我們改了架構，現在 points = basePoints
                    // 在歷史模式下如果想正確顯示當年的加權分，會比較複雜
                    // 這裡先維持簡單加總，顯示歷史紀錄
                    const pts = Number(sub.points) || 0;
                    seasonPointsMap[sub.uid] = (seasonPointsMap[sub.uid] || 0) + pts;
                }
            });

            getDocs(collection(db, "users")).then(userSnap => {
                const historyUsers = userSnap.docs.map(doc => {
                    const data = doc.data();
                    const uid = data.uid || data.username;
                    return {
                        ...data,
                        uid: uid,
                        points: seasonPointsMap[uid] || 0, // 覆蓋為該賽季的歷史積分
                        firestoreId: doc.id
                    };
                });
                setUsers(historyUsers);
            });
        }, (error) => console.error("History fetch error:", error));
      }
    };

    fetchData();

    return () => { 
      unsubTasks(); 
      unsubSubs(); 
      unsubAnc(); 
      unsubUsers(); 
      unsubGames(); 
      unsubRoles();
    };
  }, [currentUser?.username, selectedSeason, isHistoryMode]); // 加入 currentUser?.username 確保切換使用者時重抓

  return { 
      tasks, submissions, users, announcements, games, roles,
      seasonName: currentSeason, 
      currentSeason, 
      selectedSeason, 
      setSelectedSeason, 
      availableSeasons,
      isHistoryMode,
      seasonGoal,
      seasonGoalTitle
  };
};