import { useReducer, useEffect, useState, useMemo, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { db, auth, storage } from '../services/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  where, 
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const initialState = {
  tasks: [],
  submissions: [],
  users: [],
  announcements: [],
  games: [],
  currentUser: JSON.parse(localStorage.getItem('pogo_current_user') || 'null'),
  activeTab: 'announcements',
  loading: false,
  refreshing: false,
  expandedWeeks: {},
  seasonName: '載入中...',
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, currentUser: action.payload };
    case 'UPDATE_DATA':
      return { ...state, [action.collection]: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_SEASON':
      return { ...state, seasonName: action.payload };
    case 'TOGGLE_WEEK':
      return { 
        ...state, 
        expandedWeeks: { 
          ...state.expandedWeeks, 
          [action.payload]: !state.expandedWeeks[action.payload] 
        } 
      };
    case 'LOGOUT':
      return { ...state, currentUser: null, activeTab: 'announcements' };
    default:
      return state;
  }
}

const toEmail = (username) => {
  if (username.includes('@')) return username;
  return `${username}@teamaura.app`;
};

const uploadImages = async (fileList) => {
  const urls = [];
  for (const file of fileList) {
    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push(url);
  }
  return urls;
};

export const useAppManager = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { showToast } = useToast(); 
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const isFetching = useRef(false);

  // 監聽 Auth 狀態 (白名單邏輯)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          const fullUser = { ...userData, uid: userData.username, email: user.email, firestoreId: querySnapshot.docs[0].id }; 
          dispatch({ type: 'SET_USER', payload: fullUser });
          localStorage.setItem('pogo_current_user', JSON.stringify(fullUser));
        } else {
          console.warn("User not found in whitelist, logging out...");
          await signOut(auth);
          dispatch({ type: 'LOGOUT' });
          localStorage.removeItem('pogo_current_user');
          showToast("您的帳號尚未建立資料，請聯繫管理員", "error");
        }
      } else {
        dispatch({ type: 'LOGOUT' });
        localStorage.removeItem('pogo_current_user');
      }
    });
    return () => unsubscribe();
  }, []);

  // 資料監聽
  useEffect(() => {
    if (!state.currentUser) return;
    
    const unsubSettings = onSnapshot(doc(db, "system", "config"), (doc) => {
        if (doc.exists()) dispatch({ type: 'SET_SEASON', payload: doc.data().currentSeason });
        else dispatch({ type: 'SET_SEASON', payload: "未設定賽季" });
    });

    const unsubTasks = onSnapshot(query(collection(db, "tasks"), orderBy("id", "desc")), (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
      dispatch({ type: 'UPDATE_DATA', collection: 'tasks', payload: tasks });
      if (tasks.length > 0 && Object.keys(state.expandedWeeks).length === 0) {
         const weeks = tasks.map(t => parseInt(t.week) || 0);
         if (weeks.length > 0) dispatch({ type: 'TOGGLE_WEEK', payload: Math.max(...weeks) });
      }
    });
    
    const unsubSubs = onSnapshot(query(collection(db, "submissions"), orderBy("timestamp", "desc")), (s) => dispatch({ type: 'UPDATE_DATA', collection: 'submissions', payload: s.docs.map(d => ({ ...d.data(), firestoreId: d.id })) }));
    const unsubAnc = onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc")), (s) => dispatch({ type: 'UPDATE_DATA', collection: 'announcements', payload: s.docs.map(d => ({ ...d.data(), firestoreId: d.id })) }));
    
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
      dispatch({ type: 'UPDATE_DATA', collection: 'users', payload: users });
      if (state.currentUser) {
          const freshMe = users.find(u => u.username === state.currentUser.username);
          if (freshMe) {
              const updatedUser = { ...state.currentUser, ...freshMe };
              dispatch({ type: 'SET_USER', payload: updatedUser });
              localStorage.setItem('pogo_current_user', JSON.stringify(updatedUser));
          }
      }
    });

    const unsubGames = onSnapshot(collection(db, "games"), (s) => dispatch({ type: 'UPDATE_DATA', collection: 'games', payload: s.docs.map(d => ({ ...d.data(), firestoreId: d.id })) }));

    return () => { unsubSettings(); unsubTasks(); unsubSubs(); unsubAnc(); unsubUsers(); unsubGames(); };
  }, [state.currentUser?.username]);

  const confirmAction = (title, message, action) => {
    setDialog({ isOpen: true, title, message, onConfirm: async () => { await action(); setDialog({ isOpen: false, loading: false }); }});
  };

  const sortedUsers = useMemo(() => {
    return [...state.users].filter(u => !u.isAdmin).sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
  }, [state.users]);

  const actions = {
    login: async (u, p) => {
      if (!u || !p) return showToast("請輸入帳號密碼", "error");
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await signInWithEmailAndPassword(auth, toEmail(u), p);
        showToast("登入成功");
      } catch (e) {
        console.error(e);
        let msg = "登入失敗";
        if (e.code === 'auth/invalid-credential') msg = "帳號或密碼錯誤";
        if (e.code === 'auth/user-not-found') msg = "找不到此使用者";
        showToast(msg, "error");
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    },
    logout: async () => { await signOut(auth); dispatch({ type: 'LOGOUT' }); },
    setTab: (tab) => dispatch({ type: 'SET_TAB', payload: tab }),
    toggleWeek: (week) => dispatch({ type: 'TOGGLE_WEEK', payload: week }),
    refresh: () => { showToast("資料已是最新狀態"); },
    
    addTask: async (taskData) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await addDoc(collection(db, "tasks"), { ...taskData, id: `t_${Date.now()}`, createdAt: serverTimestamp() });
        showToast("任務新增成功"); return true;
      } catch (e) { showToast("新增失敗", "error"); return false; } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    },
    deleteTask: (id) => {
      confirmAction("刪除任務", "確定？", async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try { const task = state.tasks.find(t => t.id === id); if(task) await deleteDoc(doc(db, "tasks", task.firestoreId)); showToast("已刪除"); } 
        catch (e) { showToast(e.message, "error"); } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
      });
    },
    submitTask: async (data) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        let imageUrls = [];
        if (data.rawFiles?.length > 0) imageUrls = await uploadImages(data.rawFiles);
        await addDoc(collection(db, "submissions"), {
          id: `s_${Date.now()}`, uid: state.currentUser.uid, username: state.currentUser.username,
          taskId: data.task.id, taskTitle: data.task.title, points: data.task.points,
          status: 'pending', proof: data.proof || '無備註', timestamp: new Date().toISOString(),
          images: JSON.stringify(imageUrls), week: data.task.week, season: state.seasonName
        });
        showToast("提交成功"); return true;
      } catch (e) { showToast("提交失敗", "error"); return false; } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    },
    withdraw: (subId) => {
      confirmAction("撤回提交", "確定？", async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try { const sub = state.submissions.find(s => s.id === subId); if(sub) await deleteDoc(doc(db, "submissions", sub.firestoreId)); showToast("已撤回"); } 
        catch (e) { showToast(e.message, "error"); } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
      });
    },
    review: async (subId, action, points, statusOverride) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const sub = state.submissions.find(s => s.id === subId);
        if (!sub) throw new Error("找不到紀錄");
        const newStatus = statusOverride || (action === 'approve' ? 'approved' : 'rejected');
        const newPoints = Number(points) || 0;
        await updateDoc(doc(db, "submissions", sub.firestoreId), { status: newStatus, points: newPoints });
        if (newStatus === 'approved') {
           const user = state.users.find(u => u.uid === sub.uid);
           if (user) {
               const currentPoints = Number(user.points) || 0;
               await updateDoc(doc(db, "users", user.firestoreId), { points: currentPoints + newPoints });
           }
        }
        showToast("操作成功");
      } catch (e) { showToast(e.message, "error"); } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    },
    addAnnouncement: async (title, content, rawFiles = []) => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            let imageUrls = [];
            if (rawFiles.length > 0) imageUrls = await uploadImages(rawFiles);
            await addDoc(collection(db, "announcements"), {
                id: `a_${Date.now()}`, title, content, author: state.currentUser.username,
                timestamp: new Date().toISOString(), images: JSON.stringify(imageUrls), season: state.seasonName
            });
            showToast("公告已發佈"); return true;
        } catch(e) { showToast("發佈失敗", "error"); return false; } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    },
    updateAnnouncement: async (id, title, content, rawFiles = []) => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            const item = state.announcements.find(x => x.id === id);
            if (!item) throw new Error("找不到公告");
            let imageUrls = [];
            let existingImages = [];
            try { existingImages = JSON.parse(item.images || '[]'); } catch(e){}
            if (rawFiles?.length > 0) imageUrls = await uploadImages(rawFiles);
            const finalImages = [...existingImages, ...imageUrls];
            await updateDoc(doc(db, "announcements", item.firestoreId), { title, content, images: JSON.stringify(finalImages) });
            showToast("公告已更新"); return true;
        } catch(e) { showToast("更新失敗", "error"); return false; } finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    },
    deleteAnnouncement: (id) => {
        confirmAction("刪除公告", "確定？", async () => { const item = state.announcements.find(x => x.id === id); if(item) await deleteDoc(doc(db, "announcements", item.firestoreId)); });
    },
    addGame: async (data) => { await addDoc(collection(db, "games"), { ...data, id: `g_${Date.now()}` }); showToast("遊戲已新增"); return true; },
    updateGame: async (data) => { const item = state.games.find(g => g.id === data.id); if(item) await updateDoc(doc(db, "games", item.firestoreId), data); showToast("遊戲已更新"); return true; },
    deleteGame: (id) => { confirmAction("刪除遊戲", "確定？", async () => { const item = state.games.find(x => x.id === id); if(item) await deleteDoc(doc(db, "games", item.firestoreId)); }); },

    // 🌟 初始化功能 (自動建立所有集合)
    initializeSystem: async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            // 1. 建立預設遊戲 (Games)
            const defaultGames = [
                { id: 'g_1', title: '2048', url: 'https://hczhcz.github.io/2048/', icon: '🔢' },
                { id: 'g_2', title: 'Hextris', url: 'https://hextris.github.io/hextris/', icon: '⬡' },
                { id: 'g_3', title: 'Tetris', url: 'https://chvin.github.io/react-tetris/', icon: '🧱' },
            ];
            for(const g of defaultGames) {
                const q = query(collection(db, "games"), where("title", "==", g.title));
                const snap = await getDocs(q);
                if(snap.empty) await addDoc(collection(db, "games"), g);
            }

            // 2. 建立系統設定檔 (System)
            const sysRef = doc(db, "system", "config");
            await setDoc(sysRef, { currentSeason: "第一賽季" }, { merge: true });

            // 3. 建立範例公告 (Announcements)
            const ancRef = collection(db, "announcements");
            const ancSnap = await getDocs(ancRef);
            if (ancSnap.empty) {
                await addDoc(ancRef, {
                    id: `a_${Date.now()}`,
                    title: "歡迎來到新系統",
                    content: "<p>這是系統自動建立的第一則公告。</p>",
                    author: "System",
                    timestamp: new Date().toISOString(),
                    images: "[]",
                    season: "第一賽季"
                });
            }

            // 4. 建立範例任務 (Tasks)
            const taskRef = collection(db, "tasks");
            const taskSnap = await getDocs(taskRef);
            if (taskSnap.empty) {
                await addDoc(taskRef, {
                    id: `t_${Date.now()}`,
                    title: "每日簽到",
                    points: 10,
                    icon: "📅",
                    description: "每天登入並簽到",
                    week: "1",
                    type: "fixed",
                    createdAt: serverTimestamp()
                });
            }

            // 5. 建立範例使用者 (Users) - 解決無法登入問題
            const usersRef = collection(db, "users");
            // 檢查是否有 admin@teamaura.app，沒有就建立
            const userQ = query(usersRef, where("email", "==", "admin@teamaura.app"));
            const userSnap = await getDocs(userQ);
            if (userSnap.empty) {
                await addDoc(usersRef, {
                    username: "admin",
                    email: "admin@teamaura.app",
                    points: 0,
                    isAdmin: true,
                    joinedAt: new Date().toISOString()
                });
            }

            showToast("系統初始化完成！表格已建立。");
        } catch(e) { console.error(e); showToast("初始化失敗", "error"); }
        finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    },

    archive: async (newSeasonName) => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            await setDoc(doc(db, "system", "config"), { currentSeason: newSeasonName }, { merge: true });
            const usersSnapshot = await getDocs(collection(db, "users"));
            const batches = [];
            let batch = writeBatch(db);
            let count = 0;
            usersSnapshot.forEach((userDoc) => {
                batch.update(userDoc.ref, { points: 0 });
                count++;
                if (count >= 400) { batches.push(batch.commit()); batch = writeBatch(db); count = 0; }
            });
            if (count > 0) batches.push(batch.commit());
            await Promise.all(batches);
            showToast("賽季重置成功！");
            return true;
        } catch (e) { console.error(e); showToast("重置失敗", "error"); return false; }
        finally { dispatch({ type: 'SET_LOADING', payload: false }); }
    }
  };

  return { state, actions, sortedUsers, dialog, setDialog };
};