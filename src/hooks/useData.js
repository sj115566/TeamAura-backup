import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit, where, getDocs } from 'firebase/firestore';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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

 const isHistoryMode = useMemo(() => {
   return selectedSeason && selectedSeason !== currentSeason && currentSeason !== '載入中...';
 }, [selectedSeason, currentSeason]);

 useEffect(() => {
   if (!currentUser) return;
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
           setSelectedSeason(prev => {
               if (!prev || !all.includes(prev)) return curr;
               return prev;
           });
       } else {
           setCurrentSeason("第一賽季");
           setAvailableSeasons(["第一賽季"]);
           setSelectedSeason("第一賽季");
       }
   });
   return () => unsubSettings();
 }, [currentUser]);

 useEffect(() => {
   if (!currentUser || !selectedSeason) return;

   let unsubTasks = () => {};
   let unsubSubs = () => {};
   let unsubAnc = () => {};
   let unsubUsers = () => {};
   let unsubRoles = () => {};
   let unsubCats = () => {};

   const unsubGames = onSnapshot(collection(db, "games"), (s) => {
     setGames(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
   }, (error) => console.error("Games fetch error:", error));

   unsubRoles = onSnapshot(collection(db, "roles"), (s) => {
       setRoles(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
   }, (error) => console.error("Roles fetch error:", error));

   // 監聽 categories (根目錄)
   try {
       const catsRef = collection(db, "categories");
       unsubCats = onSnapshot(catsRef, (s) => {
           const rawCats = s.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
           // 前端排序
           rawCats.sort((a, b) => {
               const typeA = a.type || 'task';
               const typeB = b.type || 'task';
               if (typeA !== typeB) return typeA.localeCompare(typeB);
               return (a.label || '').localeCompare(b.label || '');
           });
           setCategories(rawCats);
       }, (error) => {
           console.error("Categories fetch error:", error);
           setCategories([]); 
       });
   } catch (e) {
       console.error("Setup categories listener failed:", e);
   }

   const fetchData = async () => {
     const taskQ = query(collection(db, "tasks"), orderBy("id", "desc"));
     unsubTasks = onSnapshot(taskQ, (snapshot) => {
       const allTasks = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
       const filteredTasks = allTasks.filter(t => !t.season || t.season === selectedSeason);
       setTasks(filteredTasks);
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
     });

     if (!isHistoryMode) {
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
               let freshMe = null;
               if (currentUser.firestoreId) freshMe = usersData.find(u => u.firestoreId === currentUser.firestoreId);
               if (!freshMe && currentUser.email) freshMe = usersData.find(u => u.email === currentUser.email);
               if (!freshMe) freshMe = usersData.find(u => u.username === currentUser.username);
               if (freshMe) {
                   const hasChanged = freshMe.username !== currentUser.username || freshMe.points !== (currentUser.points || 0) || freshMe.isAdmin !== currentUser.isAdmin || JSON.stringify(freshMe.roles) !== JSON.stringify(currentUser.roles);
                   if (hasChanged) updateCurrentUser(freshMe);
               }
           }
       });
     } else {
       const subQ = query(collection(db, "submissions"), where("season", "==", selectedSeason), orderBy("timestamp", "desc"));
       unsubSubs = onSnapshot(subQ, (snapshot) => {
           const allSubs = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
           setSubmissions(allSubs);
           const seasonPointsMap = {};
           allSubs.forEach(sub => { if (sub.status === 'approved') seasonPointsMap[sub.uid] = (seasonPointsMap[sub.uid] || 0) + (Number(sub.points) || 0); });
           getDocs(collection(db, "users")).then(userSnap => {
               const historyUsers = userSnap.docs.map(doc => {
                   const data = doc.data();
                   return { ...data, uid: data.uid || data.username, points: seasonPointsMap[data.uid || data.username] || 0, firestoreId: doc.id };
               });
               setUsers(historyUsers);
           });
       });
     }
   };
   fetchData();
   return () => { unsubTasks(); unsubSubs(); unsubAnc(); unsubUsers(); unsubGames(); unsubRoles(); unsubCats(); };
 }, [currentUser?.username, selectedSeason, isHistoryMode]);

 return {
     tasks, submissions, users, announcements, games, roles, categories,
     seasonName: currentSeason, currentSeason, selectedSeason, setSelectedSeason, availableSeasons, isHistoryMode, seasonGoal, seasonGoalTitle
 };
};