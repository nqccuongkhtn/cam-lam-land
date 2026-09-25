'use client';
// Hướng dẫn TRA CỨU + NHẬP danh sách nóng.
import { useLockBody } from '@/lib/useLockBody';
export function GuideModal({ onClose }: { onClose: () => void }) {
  useLockBody(); // khoá cuộn nền khi mở hướng dẫn
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 text-sm text-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-lg font-bold text-[#0A2540]">❓ Hướng dẫn</p>
        <p className="mb-1 font-bold text-[#0A2540]">🔎 Cách tra cứu</p>
        <ul className="mb-3 list-disc space-y-1.5 pl-5">
          <li>Gõ ô lớn: <b>tên chủ / số thửa / xã / nội dung</b> — <b>không cần dấu</b> (vd “nguyen van a”, “cam an bac”).</li>
          <li>Nhiều từ = khớp <b>tất cả</b> (vd “170 cam an bac”).</li>
          <li>Đúng 1 thửa: điền ô <b>Thửa</b> + <b>Tờ</b> + chọn <b>Xã</b>.</li>
          <li>Bấm <b>chip nguồn</b> (Ngăn chặn, Hồ sơ, Công ích…) để lọc; số bên cạnh là số bản ghi.</li>
          <li><b>Chưa gõ gì</b> = hiện toàn bộ; cuộn xuống tự tải thêm. Bấm 1 dòng để <b>xem đầy đủ</b>; nút <b>“Xem chi tiết”</b> bung hết.</li>
          <li><span className="font-bold text-red-600">NGĂN CHẶN</span> (đỏ) = đang bị toà án/thi hành án ngăn giao dịch — cẩn trọng.</li>
        </ul>
        <p className="mb-1 font-bold text-[#0A2540]">➕ Cách nhập / thêm danh sách nóng</p>
        <ul className="mb-3 list-disc space-y-1.5 pl-5">
          <li>Cần <b>đăng nhập</b>. Bấm nút đỏ <b>“+ Thêm vào danh sách nóng”</b> góc phải trên.</li>
          <li>Điền: <b>Nội dung / lý do nóng</b> (nên có), <b>Tên/Chủ</b>, <b>Xã</b>, <b>Số thửa</b>, <b>Số tờ</b>. Chỉ cần ít nhất 1 trong: Số thửa / Tên / Nội dung.</li>
          <li><b>Mức độ</b>: <span className="font-bold text-red-600">Ngăn chặn</span> (đỏ, nặng nhất) · <span className="font-bold text-amber-600">Cảnh báo</span> (vàng) · Thường.</li>
          <li><b>🔗 Link công văn</b>: dán đường link công văn/quyết định liên quan → bản ghi hiện nút <b>“📎 Công văn đính kèm”</b> bấm mở được.</li>
          <li><b>Nguồn</b>: chọn/gõ loại (Ngăn chặn, Hồ sơ…) hoặc để “Thêm mới”.</li>
          <li>Bấm <b>Lưu</b> → bản ghi hiện <b>đầu danh sách</b>, nhãn <b>● Mới thêm</b>, <b>mọi người thấy chung</b>.</li>
          <li><b>Sửa / Xoá</b> bản ghi đã thêm: bấm mở dòng → nút <b>✎ Sửa</b> / <b>🗑 Xoá</b>. Chỉ <b>admin</b> hoặc tài khoản quyền <b>quản lý danh sách nóng</b> (role <code>hotlist</code>).</li>
          <li>Dữ liệu gốc (file Excel) là <b>chỉ đọc</b> — chỉ bản ghi <b>thêm tay</b> mới sửa/xoá được.</li>
        </ul>
        <div className="text-right"><button onClick={onClose} className="rounded bg-[#0A2540] px-5 py-1.5 text-sm font-bold text-white">Đã hiểu</button></div>
      </div>
    </div>
  );
}
