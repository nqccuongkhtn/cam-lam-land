// Gửi email xác thực. Mặc định DEMO (chỉ log + trả mã cho client để test).
// Khi có nhà cung cấp email, đặt EMAIL_ENABLED=true và tích hợp tại đây.
export const EMAIL_LIVE = process.env.EMAIL_ENABLED === 'true';

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!EMAIL_LIVE) {
    console.log(`[mailer][DEMO] mã xác thực cho ${email}: ${code}`);
    return;
  }
  // TODO: tích hợp SMTP/Resend bằng biến môi trường (EMAIL_*).
  console.log(`[mailer] (live chưa cấu hình) mã cho ${email}: ${code}`);
}
