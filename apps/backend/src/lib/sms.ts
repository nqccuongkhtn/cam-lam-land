// Gửi SMS qua cổng eSMS.vn (Việt Nam). Credential đọc từ BIẾN MÔI TRƯỜNG — KHÔNG hard-code.
// Cần đăng ký tài khoản + brandname với nhà mạng, rồi đặt env:
//   SMS_API_KEY, SMS_SECRET, SMS_BRANDNAME   (bắt buộc)
//   SMS_SMSTYPE  (mặc định '2' = brandname CSKH), SMS_UNICODE ('0' không dấu / '1' có dấu)
// Chưa đặt env → sendSms trả {ok:false} và hệ thống bỏ qua (nhắc trong app vẫn chạy).

export function smsConfigured(): boolean {
  return !!(process.env.SMS_API_KEY && process.env.SMS_SECRET && process.env.SMS_BRANDNAME);
}

// Chuẩn hoá SĐT VN sang 84xxxxxxxxx
function normPhone(p: string): string {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '84' + d.slice(1);
  else if (!d.startsWith('84') && d.length === 9) d = '84' + d;
  return d;
}

export async function sendSms(phone: string, content: string): Promise<{ ok: boolean; reason?: string }> {
  const ApiKey = process.env.SMS_API_KEY, SecretKey = process.env.SMS_SECRET, Brandname = process.env.SMS_BRANDNAME;
  if (!ApiKey || !SecretKey || !Brandname) return { ok: false, reason: 'SMS chưa cấu hình' };
  const to = normPhone(phone);
  if (to.length < 11) return { ok: false, reason: 'SĐT không hợp lệ' };
  try {
    const r = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ApiKey, SecretKey, Brandname, Content: content, Phone: to,
        SmsType: process.env.SMS_SMSTYPE || '2', IsUnicode: process.env.SMS_UNICODE || '0',
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (String(j.CodeResult) === '100') return { ok: true };
    return { ok: false, reason: `eSMS ${j.CodeResult ?? '?'} ${j.ErrorMessage ?? ''}`.trim() };
  } catch (e: any) { return { ok: false, reason: e?.message || 'lỗi mạng SMS' }; }
}
