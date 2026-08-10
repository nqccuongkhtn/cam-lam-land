'use client';
import dynamic from 'next/dynamic';

// Các tiện ích NỔI (không thuộc nội dung chính) — nạp SAU khi trang đã hiện, tải client-only.
// Giảm JS/hydrate lúc đầu → trang hiện nhanh & mượt hơn, nhất là trên điện thoại.
const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false });
const AiAssistant = dynamic(() => import('./AiAssistant'), { ssr: false });
const CompareBar = dynamic(() => import('./CompareBar'), { ssr: false });
// Lưu ý: InstallPrompt KHÔNG hoãn ở đây — nó phải bắt sự kiện beforeinstallprompt sớm, nên giữ nạp ngay trong layout.

export default function DeferredWidgets() {
  return (
    <>
      <ChatWidget />
      <AiAssistant />
      <CompareBar />
    </>
  );
}
