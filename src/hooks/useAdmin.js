import { useState } from 'react';
import { db, storage } from '../services/firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  serverTimestamp, setDoc, writeBatch, getDocs, query, where, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '../context/ToastContext';
import { compressImage } from '../utils/compressor'; 

const uploadImages = async (fileList) => {
  const urls = [];
  for (const file of fileList) {
    try {
      const fileToUpload = await compressImage(file);
      const storageRef = ref(storage, `uploads/${Date.now()}_${fileToUpload.name}`);
      await uploadBytes(storageRef, fileToUpload);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  }
  return urls;
};

export const useAdmin = (currentUser, seasonName, users) => {
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
    } finally {
      setAdminLoading(false);
    }
  };

  const actions = {
    addTask: (taskData) => execute(async () => {
      await addDoc(collection(db, "tasks"), { ...taskData, id: `t_${Date.now()}`, createdAt: serverTimestamp() });
    }, "任務新增成功"),

    deleteTask: (firestoreId) => execute(async () => {
      if (!firestoreId || typeof firestoreId !== 'string') throw new Error("無效的任務 ID (Firestore ID)");
      await deleteDoc(doc(db, "tasks", firestoreId));
    }, "已刪除"),

    submitTask: (data) => execute(async () => {
      let imageUrls = [];
      if (data.rawFiles?.length > 0) imageUrls = await uploadImages(data.rawFiles);
      await addDoc(collection(db, "submissions"), {
        id: `s_${Date.now()}`, uid: currentUser.uid, username: currentUser.username,
        taskId: data.task.id, taskTitle: data.task.title, points: data.task.points,
        status: 'pending', proof: data.proof || '無備註', timestamp: new Date().toISOString(),
        images: JSON.stringify(imageUrls), week: data.task.week, season: seasonName
      });
    }, "提交成功"),

    withdraw: (firestoreId) => execute(async () => {
      if (!firestoreId || typeof firestoreId !== 'string') throw new Error("無效的提交 ID (Firestore ID)");
      await deleteDoc(doc(db, "submissions", firestoreId));
    }, "已撤回"),

    // 關鍵修正：Review 邏輯包含分數回滾 (Rollback)
    review: (sub, action, points, statusOverride) => execute(async () => {
        if (!sub) throw new Error("提交紀錄物件不存在");
        if (!sub.firestoreId || typeof sub.firestoreId !== 'string') {
            console.error("Invalid submission object (missing firestoreId):", sub);
            throw new Error(`無法讀取提交紀錄 ID。請嘗試重新整理頁面。`);
        }

        const newStatus = statusOverride || (action === 'approve' ? 'approved' : 'rejected');
        const newPoints = Number(points) || 0;
        const oldStatus = sub.status;
        const oldPoints = Number(sub.points) || 0;

        // 1. 更新 Submission 狀態與分數
        const subRef = doc(db, "submissions", sub.firestoreId);
        await updateDoc(subRef, { status: newStatus, points: newPoints });
        
        // 2. 計算對使用者總分的影響
        // 找出該使用者目前的資料 (必須確保有 firestoreId)
        const user = users.find(u => u.uid === sub.uid);
        if (!user || !user.firestoreId) {
            console.warn(`User ${sub.uid} not found or missing firestoreId, skipping points update.`);
            return;
        }

        let pointDiff = 0;

        // 情境 A: 原本是通過，現在被駁回 (或改回審核中) -> 扣掉原本加的分數
        if (oldStatus === 'approved' && newStatus !== 'approved') {
            pointDiff = -oldPoints;
        }
        // 情境 B: 原本沒通過，現在通過 -> 加上新分數
        else if (oldStatus !== 'approved' && newStatus === 'approved') {
            pointDiff = newPoints;
        }
        // 情境 C: 原本通過，現在還是通過 (但分數可能變了) -> 修正差額
        else if (oldStatus === 'approved' && newStatus === 'approved') {
            pointDiff = newPoints - oldPoints;
        }
        // 情境 D: 原本沒通過，現在還是沒通過 -> 分數不變 (0)

        // 3. 如果分數有變動，更新使用者總分
        if (pointDiff !== 0) {
            const currentTotal = Number(user.points) || 0;
            await updateDoc(doc(db, "users", user.firestoreId), { 
                points: currentTotal + pointDiff 
            });
            console.log(`User ${user.uid} points updated: ${currentTotal} -> ${currentTotal + pointDiff} (Diff: ${pointDiff})`);
        }

    }, "操作成功"),

    addAnnouncement: (title, content, rawFiles = []) => execute(async () => {
        let imageUrls = [];
        if (rawFiles.length > 0) imageUrls = await uploadImages(rawFiles);
        await addDoc(collection(db, "announcements"), {
            id: `a_${Date.now()}`, title, content, author: currentUser.username,
            timestamp: new Date().toISOString(), images: JSON.stringify(imageUrls), season: seasonName
        });
    }, "公告已發佈"),

    updateAnnouncement: (item, title, content, rawFiles = []) => execute(async () => {
        if (!item || !item.firestoreId || typeof item.firestoreId !== 'string') throw new Error("無效的公告 ID");
        let imageUrls = [];
        let existingImages = [];
        try { existingImages = JSON.parse(item.images || '[]'); } catch(e){}
        if (rawFiles?.length > 0) imageUrls = await uploadImages(rawFiles);
        const finalImages = [...existingImages, ...imageUrls];
        await updateDoc(doc(db, "announcements", item.firestoreId), { title, content, images: JSON.stringify(finalImages) });
    }, "公告已更新"),

    deleteAnnouncement: (firestoreId) => execute(async () => {
        if (!firestoreId || typeof firestoreId !== 'string') throw new Error("無效的公告 ID");
        await deleteDoc(doc(db, "announcements", firestoreId));
    }),

    addGame: (data) => execute(async () => { 
        await addDoc(collection(db, "games"), { ...data, id: `g_${Date.now()}` }); 
    }, "遊戲已新增"),

    updateGame: (item, data) => execute(async () => { 
        if (!item || !item.firestoreId || typeof item.firestoreId !== 'string') throw new Error("無效的遊戲 ID");
        await updateDoc(doc(db, "games", item.firestoreId), data); 
    }, "遊戲已更新"),

    deleteGame: (firestoreId) => execute(async () => { 
        if (!firestoreId || typeof firestoreId !== 'string') throw new Error("無效的遊戲 ID");
        await deleteDoc(doc(db, "games", firestoreId)); 
    }),

    archive: (newSeasonName) => execute(async () => {
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
    }, "賽季重置成功！"),

    initializeSystem: () => execute(async () => {
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
        const sysRef = doc(db, "system", "config");
        await setDoc(sysRef, { currentSeason: "第一賽季" }, { merge: true });
        const ancRef = collection(db, "announcements");
        const ancSnap = await getDocs(ancRef);
        if (ancSnap.empty) {
            await addDoc(ancRef, {
                id: `a_${Date.now()}`, title: "歡迎來到新系統", content: "<p>這是系統自動建立的第一則公告。</p>",
                author: "System", timestamp: new Date().toISOString(), images: "[]", season: "第一賽季"
            });
        }
        const taskRef = collection(db, "tasks");
        const taskSnap = await getDocs(taskRef);
        if (taskSnap.empty) {
            await addDoc(taskRef, {
                id: `t_${Date.now()}`, title: "每日簽到", points: 10, icon: "📅", description: "每天登入並簽到",
                week: "1", type: "fixed", createdAt: serverTimestamp()
            });
        }
        const usersRef = collection(db, "users");
        const userQ = query(usersRef, where("email", "==", "admin@teamaura.app"));
        const userSnap = await getDocs(userQ);
        if (userSnap.empty) {
            await addDoc(usersRef, {
                username: "admin", email: "admin@teamaura.app", points: 0, isAdmin: true, joinedAt: new Date().toISOString()
            });
        }
    }, "系統初始化完成！表格已建立。")
  };

  return { actions, adminLoading };
};