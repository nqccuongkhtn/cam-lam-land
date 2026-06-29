import { NextResponse } from 'next/server';
import { callClaude, aiEnabled } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!aiEnabled()) return NextResponse.json({ error: 'Tính năng AI chưa được bật (thiếu API key).' }, { status: 503 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const facts = [
    b.title && `Tiêu đề: ${b.title}`,
    b.propertyType && `Loại hình: ${b.propertyType}`,
    b.area && `Diện tích: ${b.area} m²`,
    b.price && `Giá: ${b.price}`,
    b.ward && `Xã/phường: ${b.ward}`,
    b.address && `Địa chỉ: ${b.address}`,
    b.direction && `Hướng: ${b.direction}`,
    b.legal && `Pháp lý: ${b.legal}`,
    b.bedrooms && `Phòng ngủ: ${b.bedrooms}`,
    b.bathrooms && `Phòng tắm: ${b.bathrooms}`,
    b.frontage && `Mặt tiền: ${b.frontage} m`,
  ].filter(Boolean).join('\n');
  if (!facts) return NextResponse.json({ error: 'Hãy nhập vài thông tin trước (tiêu đề, giá, diện tích…).' }, { status: 400 });

  const prompt = `Bạn là chuyên viên bất động sản tại Cam Lâm, Khánh Hòa. Viết MỘT đoạn mô tả tin rao bán bằng tiếng Việt, hấp dẫn nhưng trung thực, khoảng 4-7 câu, dựa CHỈ trên thông tin dưới đây (không bịa thêm số liệu). Nêu bật vị trí và tiềm năng khu vực Cam Lâm (gần sân bay Cam Ranh, biển Bãi Dài, hạ tầng phát triển) nếu phù hợp, pháp lý, và kết thúc bằng một lời mời liên hệ ngắn gọn. Chỉ trả về đoạn mô tả, không thêm tiêu đề hay chú thích.\n\n${facts}`;
  const text = await callClaude(prompt, 600);
  if (!text) return NextResponse.json({ error: 'Không tạo được mô tả, vui lòng thử lại.' }, { status: 502 });
  return NextResponse.json({ description: text });
}
