import React, { useEffect } from 'react';
import { Icon } from '../Icons';


export const Modal = ({ isOpen, onClose, title, children }) => {
 // 移除了鎖定背景捲動的 useEffect


 if (!isOpen) return null;


 return (
   // 外層容器：佔滿全螢幕，負責產生捲軸
   <div className="fixed inset-0 z-[999] overflow-y-auto">
    
     {/* 內容定位容器：
         min-h-full: 確保容器至少跟視窗一樣高
         flex: 使用 Flexbox
         items-center: 垂直置中 (當內容高度小於視窗時)
         justify-center: 水平置中
         p-4: 增加內距，避免 Modal 貼邊
     */}
     <div className="flex min-h-full items-center justify-center p-4">


       {/* 背景遮罩：固定在視窗背景，不隨捲動移動 */}
       <div
         className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
         onClick={onClose}
       ></div>


       {/* Modal 本體：
           relative z-10: 確保在遮罩之上
           w-full max-w-sm: 寬度限制
           flex flex-col: 內部使用 flex 垂直排列
           bg-white: 背景色
           rounded-xl: 圓角
           shadow-2xl: 陰影
           my-8: 垂直外距，這是關鍵！當內容過長時，這個 margin 確保上下有空間；
                 配合外層的 flex items-center，當內容短時會自動垂直置中；
                 當內容長超過視窗時，flex 會讓它從頂部開始延伸，margin-y 會保持上下邊距。
           max-h-none: 取消最大高度限制，讓內容自然撐開，由外層 overflow-y-auto 負責捲動
       */}
       <div
         className="relative z-10 bg-white w-full max-w-sm rounded-xl shadow-2xl flex flex-col animate-fadeIn my-8"
         onClick={(e) => e.stopPropagation()}
       >
         {/* 標題列：
            sticky top-0: 當 Modal 很長被捲動時，標題會固定在 Modal 視窗的頂部
            z-20: 確保標題在內容之上
         */}
         {title && (
           <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-white rounded-t-xl sticky top-0 z-20">
             <h3 className="font-bold text-lg text-slate-800">{title}</h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
               <Icon name="X" className="w-5 h-5" />
             </button>
           </div>
         )}


         {/* 內容區域：
             這裡不需要再設 overflow，因為是整個 Modal 在外層容器裡捲動
         */}
         <div className="p-4">
           {children}
         </div>
       </div>
     </div>
   </div>
 );
};

