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
 const [categories, setCategories] = useState([]);
 
 const [currentSeason, setCurrentSeason] = useState('載入中...');
 const [availableSeasons, setAvailableSeasons] = useState([]);
 const [selectedSeason, setSelectedSeason] = useState(null);
 const [seasonGoal, setSeasonGoal] = useState(1000);
 const [seasonGoalTitle, setSeasonGoalTitle] = useState("Season Goal");

 // 新增：暫存完整的系統設定，以便切換賽季時讀取歷史目標
 const [systemConfig, setSystemConfig] = useState(null);

 const [dataLoading, setDataLoading] = useState(true);

 const isHistoryMode = useMemo(() => {
   return selectedSeason && selectedSeason !== currentSeason && currentSeason !== '載入中...';
 }, [selectedSeason, currentSeason]);

 // 1. 監聽系統設定 (Config)
 useEffect(() => {
   if (!currentUser) return;
   const unsubSettings = onSnapshot(doc(db, "system", "config"), (docSnap) => {
       if (docSnap.exists()) {
           const data = docSnap.data();
           setSystemConfig(data); // 儲存完整設定

           const curr = data.currentSeason || "第一賽季";
           setCurrentSeason(curr);
           
           const past = data.availableSeasons || [];
           const all = Array.from(new Set([...past, curr]));
           setAvailableSeasons(all);
           
           setSelectedSeason(prev => {
               if (!prev || !all.includes(prev)) return curr;
               return prev;
           });
       } else {
           setCurrentSeason("第一賽季");
           setAvailableSeasons(["第一賽季"]);
           setSelectedSeason("第一賽季");
           setSystemConfig(null);
       }
   });
   return () => unsubSettings();
 }, [currentUser]);

 // 2. 根據 selectedSeason 更新顯示的目標與標題
 useEffect(() => {
   if (!systemConfig || !selectedSeason) return;

   // 預設使用當前設定
   let targetGoal = Number(systemConfig.seasonGoal) || 1000;
   let targetTitle = systemConfig.seasonGoalTitle || "Season Goal";

   // 如果是歷史模式，且設定中有該賽季的歷史紀錄，則使用歷史紀錄
   // 假設 history 結構為: { "第一賽季": { seasonGoal: 5000, seasonGoalTitle: "S1目標" } }
   if (selectedSeason !== systemConfig.currentSeason && systemConfig.history && systemConfig.history[selectedSeason]) {
       const historyData = systemConfig.history[selectedSeason];
       if (historyData.seasonGoal) targetGoal = Number(historyData.seasonGoal);
       if (historyData.seasonGoalTitle) targetTitle = historyData.seasonGoalTitle;
   }

   setSeasonGoal(targetGoal);
   setSeasonGoalTitle(targetTitle);
 }, [selectedSeason, systemConfig]);

 useEffect(() => {
   if (!currentUser || !selectedSeason) return;

   setDataLoading(true);

   let unsubTasks = () => {};
   let unsubSubs = () => {};
   let unsubAnc = () => {};
   let unsubUsers = () => {};
   let unsubRoles = () => {};
   let unsubCats = () => {};
   let unsubGames = () => {};

   const loadedStatus = { tasks: false, users: false, announcements: false };
   const checkLoading = () => {
       if (loadedStatus.tasks && loadedStatus.users && loadedStatus.announcements) {
           setDataLoading(false);
       }
   };

   unsubGames = onSnapshot(collection(db, "games"), (s) => {
     setGames(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
   }, (error) => console.error("Games fetch error:", error));

   unsubRoles = onSnapshot(collection(db, "roles"), (s) => {
       setRoles(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
   }, (error) => console.error("Roles fetch error:", error));

   const catsRef = collection(db, "categories");
   unsubCats = onSnapshot(catsRef, (s) => {
       const rawCats = s.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
       rawCats.sort((a, b) => {
           const typeA = a.type || 'task';
           const typeB = b.type || 'task';
           if (typeA !== typeB) return typeA.localeCompare(typeB);
           const sysA = !!a.systemTag;
           const sysB = !!b.systemTag;
           if (sysA !== sysB) return sysB ? 1 : -1;
           return (a.label || '').localeCompare(b.label || '');
       });
       setCategories(rawCats);
   });

   const taskQ = query(collection(db, "tasks"), orderBy("id", "desc"));
   unsubTasks = onSnapshot(taskQ, (snapshot) => {
       const allTasks = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
       const filteredTasks = allTasks.filter(t => !t.season || t.season === selectedSeason);
       setTasks(filteredTasks);
       loadedStatus.tasks = true;
       checkLoading();
   });

   const ancQ = query(collection(db, "announcements"), orderBy("timestamp", "desc"), limit(50));
   unsubAnc = onSnapshot(ancQ, (snapshot) => {
       const allAnc = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
       const filteredAnc = allAnc.filter(a => !a.season || a.season === selectedSeason);
       filteredAnc.sort((a, b) => {
           if (a.isPinned === b.isPinned) return new Date(b.timestamp) - new Date(a.timestamp);
           return a.isPinned ? -1 : 1;
       });
       setAnnouncements(filteredAnc);
       loadedStatus.announcements = true;
       checkLoading();
   });

   if (!isHistoryMode) {
       // --- 一般模式 (Live) ---
       const limitCount = currentUser?.isAdmin ? 1000 : 100;
       const subQ = query(collection(db, "submissions"), where("season", "==", selectedSeason), orderBy("timestamp", "desc"), limit(limitCount));
       unsubSubs = onSnapshot(subQ, (s) => { setSubmissions(s.docs.map(d => ({ ...d.data(), firestoreId: d.id }))); });
       
       unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
           const usersData = snapshot.docs.map(doc => {
               const data = doc.data();
               return { ...data, uid: data.uid || data.username, points: Number(data.points) || 0, firestoreId: doc.id };
           });
           setUsers(usersData);
           
           if (currentUser) {
               let freshMe = usersData.find(u => u.firestoreId === currentUser.firestoreId) || 
                             usersData.find(u => u.username === currentUser.username);
               if (freshMe) {
                   const hasChanged = freshMe.points !== (currentUser.points || 0) || 
                                    JSON.stringify(freshMe.roles) !== JSON.stringify(currentUser.roles);
                   if (hasChanged) updateCurrentUser(freshMe);
               }
           }
           loadedStatus.users = true;
           checkLoading();
       });
   } else {
       // --- 歷史模式 (History) ---
       // 1. 抓取該賽季所有提交
       const subQ = query(collection(db, "submissions"), where("season", "==", selectedSeason), orderBy("timestamp", "desc"));
       
       unsubSubs = onSnapshot(subQ, async (snapshot) => {
           const allSubs = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
           setSubmissions(allSubs);

           // 2. 計算該賽季的積分
           const seasonPointsMap = {};
           allSubs.forEach(sub => { 
               if (sub.status === 'approved') {
                   const pts = Number(sub.points) || 0;
                   // 優先用 ID 累加，若無則用 username (相容舊資料)
                   if (sub.userDocId) {
                       seasonPointsMap[sub.userDocId] = (seasonPointsMap[sub.userDocId] || 0) + pts;
                   } else if (sub.uid) {
                       seasonPointsMap[sub.uid] = (seasonPointsMap[sub.uid] || 0) + pts;
                   }
               } 
           });

           // 3. 抓取使用者列表 (只需抓一次，因為歷史模式不需要即時監聽使用者資料變更)
           // 這裡我們還是用 getDocs 來獲取當前使用者名單，然後將積分替換為計算結果
           try {
               const userSnap = await getDocs(collection(db, "users"));
               const historyUsers = userSnap.docs.map(doc => {
                   const data = doc.data();
                   // 嘗試從 map 中取得分數 (優先 ID，備用 username)
                   const historyPoints = seasonPointsMap[doc.id] !== undefined ? seasonPointsMap[doc.id] : (seasonPointsMap[data.username] || 0);
                   
                   return { 
                       ...data, 
                       uid: data.uid || data.username, 
                       points: historyPoints, // <--- 這裡覆蓋為歷史分數
                       firestoreId: doc.id 
                   };
               });
               setUsers(historyUsers);
           } catch (e) {
               console.error("Error fetching history users:", e);
           }
           
           loadedStatus.users = true;
           checkLoading();
       });
   }

   const safeTimer = setTimeout(() => setDataLoading(false), 3000);

   return () => { 
       clearTimeout(safeTimer);
       unsubTasks(); unsubSubs(); unsubAnc(); unsubUsers(); unsubGames(); unsubRoles(); unsubCats(); 
   };
 }, [currentUser?.username, selectedSeason, isHistoryMode]);

 return {
     tasks, submissions, users, announcements, games, roles, categories,
     seasonName: currentSeason, currentSeason, selectedSeason, setSelectedSeason, availableSeasons, isHistoryMode, seasonGoal, seasonGoalTitle,
     dataLoading
 };
};