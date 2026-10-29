import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { zh } from '../i18n/zh';

/** Chinese meaning that follows the "always / tap to show" setting. */
export function ChineseText({ text, className = '' }: { text: string; className?: string }) {
  const { settings } = useApp();
  const [shown, setShown] = useState(false);
  if (settings.chineseMode === 'always' || shown) return <p className={`zh ${className}`}>{text}</p>;
  return (
    <button type="button" className={`zh-reveal ${className}`} onClick={() => setShown(true)}>
      {zh.common.showChinese}
    </button>
  );
}
