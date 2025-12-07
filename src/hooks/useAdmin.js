import { useState } from 'react';
import { db, storage } from '../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, writeBatch, getDocs, query, where, getDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '../context/ToastContext';
import { compressImage } from '../utils/compressor';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const uploadImages = async (fileList) => {
 const urls = [];
 for (const file of fileList) {
   try {
     const fileToUpload = await compressImage(file);
     const storageRef = ref(storage, `uploads/${Date.now()}_${fileToUpload.name}`);
     await uploadBytes(storageRef, fileToUpload);
     const url = await getDownloadURL(storageRef);
     urls.push(url);
   } catch (error) { console.error("Upload failed:", error); }
 }
 return urls;
};

export const useAdmin = (currentUser, seasonName, users, roles = []) => {
 const { showToast } = useToast();
 const [adminLoading, setAdminLoading] = useState(false);

 const execute = async (fn, successMsg) => {
   setAdminLoading(true);
   try {
     const result = await fn();
     if (successMsg) showToast(successMsg);
     return result !== false;
   } catch (e) {
     console.error(e);
     showToast(e.message || "操作失敗", "error");
     return false;
   } finally { setAdminLoading(false); }
 };

 // ... (其他 helper 函式保持不變: clearCollection, getValidSeason, calculateMultiplier, recalculateUserPoints) ...
 const clearCollection = async (collectionName) => {
   const q = query(collection(db, collectionName));
   const snapshot = await getDocs(q);
   const batch = writeBatch(db);
   let count = 0;
   snapshot.docs.forEach((doc) => { batch.delete(doc.ref); count++; });
   if (count > 0) await batch.commit();
 };

 const getValidSeason = () => {
     if (!seasonName || seasonName === '載入中...' || seasonName === '未設定賽季') throw new Error("系統尚未載入賽季資訊");
     return seasonName;
 };

 const calculateMultiplier = (userRoleCodes, allRoles = roles) => {
     const safeRoles = allRoles || [];
     const userRoles = userRoleCodes || [];
     const activeRoles = safeRoles.filter(r => userRoles.includes(r.code));
     let totalExtra = 0;
     activeRoles.forEach(r => { totalExtra += (Number(r.multiplier) || 1) - 1; });
     return Math.max(1, 1 + totalExtra);
 };

 const recalculateUserPoints = async (userId, userDocId, currentSeason, currentRoles = roles) => {
     const q = query(collection(db, "submissions"), where("uid", "==", userId), where("season", "==", currentSeason), where("status", "==", "approved"));
     const snapshot = await getDocs(q);
     const userDocSnap = await getDoc(doc(db, "users", userDocId));
     if (!userDocSnap.exists()) return;
     const userData = userDocSnap.data();
     const multiplier = calculateMultiplier(userData.roles, currentRoles);
     let totalBasePoints = 0;
     snapshot.forEach(doc => {
         const data = doc.data();
         totalBasePoints += (data.basePoints !== undefined ? Number(data.basePoints) : Number(data.points)) || 0;
     });
     let newTotalPoints = Math.round(totalBasePoints * multiplier);
     await updateDoc(doc(db, "users", userDocId), { points: newTotalPoints });
 };

 const actions = {
   uploadSingleImage: async (file) => {
        try { const urls = await uploadImages([file]); return urls[0]; } 
        catch (error) { console.error("Editor upload failed", error); throw error; }
   },

   addTask: (taskData) => execute(async () => {
     const currentSeason = getValidSeason();
     await addDoc(collection(db, "tasks"), { ...taskData, id: `t_${Date.now()}`, season: currentSeason, createdAt: serverTimestamp() });
   }, "任務新增成功"),

   updateTask: (firestoreId, taskData) => execute(async () => {
     if (!firestoreId) throw new Error("無效的任務 ID");
     const { firestoreId: _, id, createdAt, season, ...updateFields } = taskData;
     await updateDoc(doc(db, "tasks", firestoreId), updateFields);
   }, "任務更新成功"),

   deleteTask: (firestoreId) => execute(async () => {
     if (!firestoreId || typeof firestoreId !== 'string') throw new Error("無效的任務 ID");
     await deleteDoc(doc(db, "tasks", firestoreId));
   }, "已刪除"),

   submitTask: (data) => execute(async () => {
     const currentSeason = getValidSeason();
     let imageUrls = [];
     if (data.rawFiles?.length > 0) imageUrls = await uploadImages(data.rawFiles);
     const basePoints = data.task.type === 'fixed' ? (Number(data.task.points) || 0) : 0;
     await addDoc(collection(db, "submissions"), {
       id: `s_${Date.now()}`, uid: currentUser.uid, username: currentUser.username,
       taskId: data.task.id, taskTitle: data.task.title,
       points: basePoints, basePoints: basePoints, status: 'pending', proof: data.proof || '無備註', timestamp: new Date().toISOString(),
       images: JSON.stringify(imageUrls), week: data.task.week, season: currentSeason
     });
   }, "提交成功"),

   withdraw: (firestoreId) => execute(async () => {
     if (!firestoreId) throw new Error("無效的提交 ID");
     await deleteDoc(doc(db, "submissions", firestoreId));
   }, "已撤回"),

   review: (sub, action, inputPoints, statusOverride) => execute(async () => {
       // ... (保持原樣)
       if (!sub || !sub.firestoreId) throw new Error("無效的提交紀錄");
       const newStatus = statusOverride || (action === 'approve' ? 'approved' : 'rejected');
       let finalBasePoints = Number(inputPoints) || 0;
       if (newStatus === 'approved') {
           try {
               const tasksRef = collection(db, "tasks");
               const q = query(tasksRef, where("id", "==", sub.taskId));
               const querySnapshot = await getDocs(q);
               if (!querySnapshot.empty) {
                   const taskData = querySnapshot.docs[0].data();
                   if (taskData.type === 'fixed') {
                       const currentTaskPoints = Number(taskData.points) || 0;
                       if (currentTaskPoints !== finalBasePoints) finalBasePoints = currentTaskPoints;
                   }
               }
           } catch (e) { console.warn("同步任務分數失敗", e); }
       } else if (newStatus === 'rejected') finalBasePoints = 0;
       const user = users.find(u => u.uid === sub.uid);
       if (!user || !user.firestoreId) return;
       const subRef = doc(db, "submissions", sub.firestoreId);
       await updateDoc(subRef, { status: newStatus, points: finalBasePoints, basePoints: finalBasePoints });
       const currentSeason = getValidSeason();
       await recalculateUserPoints(sub.uid, user.firestoreId, currentSeason);
   }, "操作成功"),

   addAnnouncement: (title, content, rawFiles = [], category = '一般', isPinned = false, categoryId = null) => execute(async () => {
       const currentSeason = getValidSeason();
       let imageUrls = [];
       if (rawFiles.length > 0) imageUrls = await uploadImages(rawFiles);
       // 務必寫入 categoryId
       await addDoc(collection(db, "announcements"), {
           id: `a_${Date.now()}`, title, content, category, categoryId, isPinned, author: currentUser.username, timestamp: new Date().toISOString(), images: JSON.stringify(imageUrls), season: currentSeason
       });
   }, "公告已發佈"),

   updateAnnouncement: (item, title, content, rawFiles = [], category = '一般', isPinned = false, keepOldImages, categoryId = null) => execute(async () => {
       if (!item?.firestoreId) throw new Error("無效的公告 ID");
       let imageUrls = [];
       let existingImages = keepOldImages ? keepOldImages : JSON.parse(item.images || '[]');
       if (rawFiles?.length > 0) imageUrls = await uploadImages(rawFiles);
       const finalImages = [...existingImages, ...imageUrls];
       // 務必更新 categoryId
       await updateDoc(doc(db, "announcements", item.firestoreId), { title, content, category, categoryId, isPinned, images: JSON.stringify(finalImages) });
   }, "公告已更新"),

   deleteAnnouncement: (firestoreId) => execute(async () => {
       if (!firestoreId) throw new Error("無效的公告 ID");
       await deleteDoc(doc(db, "announcements", firestoreId));
   }),

   // ... (Game, Role, Category CRUD 保持不變) ...
   addGame: (data) => execute(async () => { await addDoc(collection(db, "games"), { ...data, id: `g_${Date.now()}` }); }, "遊戲已新增"),
   updateGame: (item, data) => execute(async () => { await updateDoc(doc(db, "games", item.firestoreId), data); }, "遊戲已更新"),
   deleteGame: (firestoreId) => execute(async () => { await deleteDoc(doc(db, "games", firestoreId)); }),
   addRole: (data) => execute(async () => { await addDoc(collection(db, "roles"), { ...data, multiplier: Number(data.multiplier) || 1 }); }, "身分組已新增"),
   updateRole: (id, data) => execute(async () => { await updateDoc(doc(db, "roles", id), { ...data, multiplier: Number(data.multiplier) || 1 }); }, "身分組已更新"),
   deleteRole: (id) => execute(async () => { await deleteDoc(doc(db, "roles", id)); }, "身分組已刪除"),
   addCategory: (data) => execute(async () => { await addDoc(collection(db, "categories"), data); }, "分類已新增"),
   updateCategory: (id, data) => execute(async () => { await updateDoc(doc(db, "categories", id), data); }, "分類已更新"),
   deleteCategory: (id) => execute(async () => { await deleteDoc(doc(db, "categories", id)); }, "分類已刪除"),

   updateUserRoles: (userId, newRoles) => execute(async () => {
       const user = users.find(u => u.uid === userId);
       if (!user) throw new Error("找不到使用者");
       await updateDoc(doc(db, "users", user.firestoreId), { roles: newRoles });
       const currentSeason = getValidSeason();
       await recalculateUserPoints(userId, user.firestoreId, currentSeason);
   }, "使用者身分已更新"),
   updateSeasonGoal: (newGoal, newTitle) => execute(async () => { await setDoc(doc(db, "system", "config"), { seasonGoal: Number(newGoal), seasonGoalTitle: newTitle }, { merge: true }); }, "目標設定已更新"),
   archive: (newSeasonName) => execute(async () => { await setDoc(doc(db, "system", "config"), { currentSeason: newSeasonName, availableSeasons: arrayUnion(seasonName) }, { merge: true }); }, "賽季重置成功！"),
   
   hardResetSystem: () => execute(async () => {
       // ... (保持原樣)
       console.log("⚠️ 強制重置...");
       await clearCollection("submissions");
       await clearCollection("tasks");
       await clearCollection("announcements");
       await clearCollection("games");
       await clearCollection("roles");
       await clearCollection("categories");
       const usersSnapshot = await getDocs(collection(db, "users"));
       const batch = writeBatch(db);
       usersSnapshot.forEach((userDoc) => { batch.update(userDoc.ref, { points: 0, roles: [] }); });
       await batch.commit();
   }, "系統已強制重置！"),

   initializeSystem: () => execute(async () => {
       // ... (保持原樣)
       const taskSnap = await getDocs(collection(db, "tasks"));
       if (!taskSnap.empty) throw new Error("系統已有資料");
       const gameSnap = await getDocs(collection(db, "games"));
       if (gameSnap.empty) {
           const defaultGames = [{ id: 'g_1', title: '2048', url: 'https://hczhcz.github.io/2048/', icon: '🔢' }, { id: 'g_2', title: 'Hextris', url: 'https://hextris.github.io/hextris/', icon: '⬡' }, { id: 'g_3', title: 'Tetris', url: 'https://chvin.github.io/react-tetris/', icon: '🧱' }];
           for(const g of defaultGames) await addDoc(collection(db, "games"), g);
       }
       const roleSnap = await getDocs(collection(db, "roles"));
       if (roleSnap.empty) {
           await addDoc(collection(db, "roles"), { code: "vip", label: "VIP", multiplier: 1.1, color: "#eab308" });
       }
       const catRef = collection(db, "categories");
       const catSnap = await getDocs(catRef);
       if (catSnap.empty) {
           const defaultCats = [{ label: '一般', color: '#64748b', type: 'task' }, { label: '每日', color: '#f97316', type: 'task' }, { label: '賽季', color: '#eab308', type: 'task' }, { label: '常駐', color: '#ef4444', type: 'task' }];
           for(const c of defaultCats) await addDoc(catRef, c);
       }
       await setDoc(doc(db, "system", "config"), { currentSeason: "第一賽季", availableSeasons: [], seasonGoal: 10000, seasonGoalTitle: "Season Goal" }, { merge: true });
       const ancRef = collection(db, "announcements");
       if ((await getDocs(ancRef)).empty) {
           await addDoc(ancRef, { id: `a_${Date.now()}`, title: "歡迎來到新系統", content: "<p>這是系統自動建立的第一則公告。</p>", author: "System", timestamp: new Date().toISOString(), images: "[]", season: "第一賽季" });
       }
       const taskRef = collection(db, "tasks");
       if ((await getDocs(taskRef)).empty) {
           await addDoc(taskRef, { id: `t_${Date.now()}`, title: "每日簽到", points: 10, icon: "📅", description: "每天登入並簽到", week: "1", type: "fixed", createdAt: serverTimestamp(), season: "第一賽季" });
       }
       const usersRef = collection(db, "users");
       const userQ = query(usersRef, where("email", "==", "admin@teamaura.app"));
       if ((await getDocs(userQ)).empty) {
           await addDoc(usersRef, { username: "admin", email: "admin@teamaura.app", points: 0, isAdmin: true, joinedAt: new Date().toISOString() });
       }
   }, "系統初始化完成！"),

   // ▼▼▼ 關鍵修正：資料遷移 (Migration) ▼▼▼
   restoreDefaultCategories: () => execute(async () => {
       const catRef = collection(db, "categories");
       const catSnap = await getDocs(catRef);
       
       // 1. 建立「標籤名稱 -> ID」的對照表 (含類型)
       // key: "Label-Type" (例如 "一般-task")
       let categoryMap = {};
       
       // 載入現有分類
       catSnap.docs.forEach(d => {
           const data = d.data();
           const key = `${data.label}-${data.type || 'task'}`;
           categoryMap[key] = d.id;
       });

       const defaultCats = [
           { label: '一般', color: '#64748b', type: 'task' },
           { label: '每日', color: '#f97316', type: 'task' }, 
           { label: '每週', color: '#3b82f6', type: 'task' },
           { label: '挑戰', color: '#8b5cf6', type: 'task' },
           { label: '賽季', color: '#eab308', type: 'task' },
           { label: '常駐', color: '#ef4444', type: 'task' },
           { label: '一般', color: '#64748b', type: 'announcement' },
           { label: '活動', color: '#22c55e', type: 'announcement' },
           { label: '重要', color: '#ef4444', type: 'announcement' },
           { label: '更新', color: '#3b82f6', type: 'announcement' },
           { label: '維護', color: '#f97316', type: 'announcement' }
       ];
       
       let addedCount = 0;
       
       // 2. 補齊缺少的預設分類
       for(const c of defaultCats) {
           const key = `${c.label}-${c.type}`;
           if (!categoryMap[key]) {
               const docRef = await addDoc(catRef, c);
               categoryMap[key] = docRef.id; // 更新對照表
               addedCount++;
           }
       }
       
       // 如果有新增分類，需要重新讀取嗎？不用，因為我們已經手動更新了 categoryMap

       // 3. 遷移任務資料 (將舊的 label 對應到新的 ID)
       const taskRef = collection(db, "tasks");
       const taskSnap = await getDocs(taskRef);
       const taskBatch = writeBatch(db);
       let taskUpdateCount = 0;
       
       taskSnap.forEach(t => {
           const data = t.data();
           // 如果只有 category (舊文字) 但沒有 categoryId，或 categoryId 為空
           if (data.category && !data.categoryId) {
               const key = `${data.category}-task`;
               const targetId = categoryMap[key];
               
               if (targetId) {
                   taskBatch.update(t.ref, { categoryId: targetId });
                   taskUpdateCount++;
               }
           }
       });

       // 4. 遷移公告資料
       const ancRef = collection(db, "announcements");
       const ancSnap = await getDocs(ancRef);
       // 若資料量大，這裡應該分批處理，但 WebContainer 環境通常資料不多
       let ancUpdateCount = 0;

       ancSnap.forEach(a => {
           const data = a.data();
           if (data.category && !data.categoryId) {
               const key = `${data.category}-announcement`;
               const targetId = categoryMap[key];
               
               if (targetId) {
                   taskBatch.update(a.ref, { categoryId: targetId });
                   ancUpdateCount++;
               }
           }
       });

       if (taskUpdateCount > 0 || ancUpdateCount > 0) {
           await taskBatch.commit();
       }

       console.log(`Migration Complete: Added ${addedCount} cats, Updated ${taskUpdateCount} tasks, ${ancUpdateCount} announcements.`);

   }, "資料遷移與分類匯入完成！")
   // ▲▲▲ 修正結束 ▲▲▲
 };
 return { actions, adminLoading };
};