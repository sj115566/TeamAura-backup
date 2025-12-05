import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';


const toEmail = (username) => {
 if (username.includes('@')) return username;
 return `${username}@teamaura.app`;
};


export const useAuth = () => {
 const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('pogo_current_user') || 'null'));
 const [loading, setLoading] = useState(true); // 初始 loading 設為 true 以避免畫面閃爍
 const { showToast } = useToast();


 useEffect(() => {
   const unsubscribe = onAuthStateChanged(auth, async (user) => {
     if (user) {
      
       try {
           const { collection, query, where, getDocs } = await import('firebase/firestore');
           const q = query(collection(db, "users"), where("email", "==", user.email));
           const querySnapshot = await getDocs(q);


           if (!querySnapshot.empty) {
             const userData = querySnapshot.docs[0].data();
             const fullUser = {
               ...userData,
               uid: userData.username, // 這裡維持原本邏輯，用 username 當 uid
               email: user.email,
               firestoreId: querySnapshot.docs[0].id,
               // 確保 isAdmin 欄位存在
               isAdmin: !!userData.isAdmin
             };
             setCurrentUser(fullUser);
             localStorage.setItem('pogo_current_user', JSON.stringify(fullUser));
           } else {
              // 雖然登入成功 (密碼對)，但資料庫沒這個人 (或被 Rules 擋住)
              console.warn("User data not found or permission denied.");
              // 選擇性：是否要強制登出？
              // await signOut(auth);
              // setCurrentUser(null);
              // showToast("無法讀取使用者資料，請聯繫管理員", "error");
             
              // 暫時允許登入，但可能沒權限做事
              const fallbackUser = {
                  uid: user.email.split('@')[0],
                  email: user.email,
                  username: user.email.split('@')[0],
                  isAdmin: false,
                  points: 0
              };
              setCurrentUser(fallbackUser);
           }
       } catch (error) {
           console.error("Auth Error:", error);
           // 這裡通常是 Permission Denied
           showToast("權限不足或登入錯誤", "error");
           await signOut(auth);
           setCurrentUser(null);
       }
     } else {
       setCurrentUser(null);
       localStorage.removeItem('pogo_current_user');
     }
     setLoading(false);
   });
   return () => unsubscribe();
 }, [showToast]);


 const login = async (username, password) => {
   if (!username || !password) return showToast("請輸入帳號密碼", "error");
   setLoading(true);
   try {
     await signInWithEmailAndPassword(auth, toEmail(username), password);
     showToast("登入成功");
   } catch (e) {
     console.error(e);
     let msg = "登入失敗";
     if (e.code === 'auth/invalid-credential') msg = "帳號或密碼錯誤";
     if (e.code === 'auth/user-not-found') msg = "找不到此使用者";
     if (e.code === 'auth/too-many-requests') msg = "嘗試次數過多，請稍後再試";
     showToast(msg, "error");
   } finally {
     setLoading(false);
   }
 };


 const logout = async () => {
   try {
       await signOut(auth);
       showToast("已登出");
   } catch (e) {
       console.error(e);
   }
   setCurrentUser(null);
   localStorage.removeItem('pogo_current_user');
 };


 const updateCurrentUser = (newData) => {
   setCurrentUser(prev => {
       if (!prev) return null;
       const updated = { ...prev, ...newData };
       localStorage.setItem('pogo_current_user', JSON.stringify(updated));
       return updated;
   });
 };


 return { currentUser, loading, login, logout, updateCurrentUser };
};

