import * as LucideIcons from 'lucide-react';

export const Icon = ({ name, className, ...props }) => {
  // 動態取得 Lucide 圖示
  const LucideIcon = LucideIcons[name];

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    // 回傳一個預設的圓圈，避免報錯
    return <LucideIcons.Circle className={className} {...props} />;
  }

  return <LucideIcon className={className} {...props} />;
};