const nodemailer = require('nodemailer');

// Transporter — uses Gmail App Password from .env
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ── Send verification OTP ──────────────────────────────────────
async function sendVerificationEmail(toEmail, fullName, otp) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"KeruBelle" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify Your KeruBelle Account – OTP Inside',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your Account</title>
</head>
<body style="margin:0;padding:0;background-color:#FFF0F5;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF0F5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(212,165,184,0.18);border:1px solid #F8C8DC;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#F8C8DC 0%,#D4A5B8 100%);padding:36px 32px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:50%;text-align:center;line-height:56px;margin-bottom:12px;">
                <span style="font-size:26px;">👜</span>
              </div>
              <h1 style="margin:0;font-size:34px;font-style:italic;font-weight:700;color:#fff;letter-spacing:1px;font-family:'Georgia',serif;">KeruBelle</h1>
              <p style="margin:4px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-family:Arial,sans-serif;">Luxury Handbags &nbsp;·&nbsp; Saves You Money!</p>
            </td>
          </tr>

          <!-- Divider accent -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#F8C8DC,#D4A5B8,#F8C8DC);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 32px;">

              <!-- Welcome badge -->
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#D4A5B8;font-family:Arial,sans-serif;">Account Verification</p>
              <h2 style="margin:0 0 20px;font-size:24px;color:#2d2d2d;font-family:'Georgia',serif;font-weight:700;">Welcome to KeruBelle! 🎉</h2>

              <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;font-family:Arial,sans-serif;">Dear <strong style="color:#2d2d2d;">${fullName || 'Valued Customer'}</strong>,</p>

              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;font-family:Arial,sans-serif;">
                Thank you for creating your KeruBelle account! Please use the One-Time Password (OTP) below to verify your email address and activate your account:
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:linear-gradient(135deg,#FFF0F5,#FFF5F9);border:2px solid #F8C8DC;border-radius:16px;padding:28px 40px;text-align:center;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4A5B8;font-family:Arial,sans-serif;">Your Verification Code</p>
                      <p style="margin:0;font-size:48px;font-weight:900;letter-spacing:14px;color:#2d2d2d;font-family:'Courier New',monospace;text-shadow:0 2px 4px rgba(212,165,184,0.3);">${otp}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Validity note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:14px;color:#8B6914;font-family:Arial,sans-serif;">
                      ⏱️ &nbsp;This OTP is valid for the next <strong>60 minutes</strong>. Please do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- What's next -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FFF4;border:1px solid #86EFAC;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;font-family:Arial,sans-serif;">✅ &nbsp;What's next?</p>
                    <ol style="margin:0;padding-left:18px;font-size:13px;color:#166534;line-height:1.8;font-family:Arial,sans-serif;">
                      <li>Enter the 6-digit code above on the verification screen</li>
                      <li>Your account will be activated instantly</li>
                      <li>Start exploring our luxury handbag collections!</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#777;line-height:1.7;font-family:Arial,sans-serif;">
                If you did not create a KeruBelle account, please ignore this email. No action is needed.
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:#444;font-family:Arial,sans-serif;">
                Thank you,<br/>
                <strong style="color:#D4A5B8;font-family:'Georgia',serif;font-style:italic;font-size:18px;">Kerubelle</strong>
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#F8C8DC,transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FFF5F9;padding:24px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:16px;font-style:italic;font-weight:700;color:#D4A5B8;font-family:'Georgia',serif;">KeruBelle</p>
              <p style="margin:0 0 4px;font-size:12px;color:#aaa;font-family:Arial,sans-serif;letter-spacing:1px;">Luxury Handbags &nbsp;·&nbsp; Saves You Money!</p>
              <p style="margin:6px 0 0;font-size:12px;color:#bbb;font-family:Arial,sans-serif;">
                📞 +254 14492024 &nbsp;|&nbsp; ✉️ <a href="mailto:kerubelle@gmail.com" style="color:#D4A5B8;text-decoration:none;">kerubelle@gmail.com</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#ccc;font-family:Arial,sans-serif;">© ${new Date().getFullYear()} KeruBelle Luxury Handbags. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

// ── Send forgot-password OTP ───────────────────────────────────
async function sendForgotPasswordEmail(toEmail, fullName, otp) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"KeruBelle" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'OTP For Email Password Reset – KeruBelle',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#FFF0F5;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF0F5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(212,165,184,0.18);border:1px solid #F8C8DC;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#F8C8DC 0%,#D4A5B8 100%);padding:36px 32px;text-align:center;">
              <!-- Logo mark -->
              <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:50%;text-align:center;line-height:56px;margin-bottom:12px;">
                <span style="font-size:26px;">👜</span>
              </div>
              <h1 style="margin:0;font-size:34px;font-style:italic;font-weight:700;color:#fff;letter-spacing:1px;font-family:'Georgia',serif;">KeruBelle</h1>
              <p style="margin:4px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-family:Arial,sans-serif;">Luxury Handbags &nbsp;·&nbsp; Saves You Money!</p>
            </td>
          </tr>

          <!-- Divider accent -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#F8C8DC,#D4A5B8,#F8C8DC);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 32px;">

              <!-- Subject line -->
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#D4A5B8;font-family:Arial,sans-serif;">OTP For Email Password Reset</p>
              <h2 style="margin:0 0 20px;font-size:24px;color:#2d2d2d;font-family:'Georgia',serif;font-weight:700;">Reset Your Password</h2>

              <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;font-family:Arial,sans-serif;">Dear <strong style="color:#2d2d2d;">${fullName || 'Valued Customer'}</strong>,</p>

              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;font-family:Arial,sans-serif;">
                Thank you for requesting an OTP. Please use the One-Time Password (OTP) below to reset your email password:
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:linear-gradient(135deg,#FFF0F5,#FFF5F9);border:2px solid #F8C8DC;border-radius:16px;padding:28px 40px;text-align:center;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4A5B8;font-family:Arial,sans-serif;">Your One-Time Password</p>
                      <p style="margin:0;font-size:48px;font-weight:900;letter-spacing:14px;color:#2d2d2d;font-family:'Courier New',monospace;text-shadow:0 2px 4px rgba(212,165,184,0.3);">${otp}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Validity note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:14px;color:#8B6914;font-family:Arial,sans-serif;">
                      ⏱️ &nbsp;This OTP is valid for the next <strong>60 minutes</strong>. Please do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#777;line-height:1.7;font-family:Arial,sans-serif;">
                If you did not request this verification, please ignore this email. Your password will remain unchanged.
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:#444;font-family:Arial,sans-serif;">
                Thank you,<br/>
                <strong style="color:#D4A5B8;font-family:'Georgia',serif;font-style:italic;font-size:18px;">Kerubelle</strong>
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#F8C8DC,transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FFF5F9;padding:24px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:16px;font-style:italic;font-weight:700;color:#D4A5B8;font-family:'Georgia',serif;">KeruBelle</p>
              <p style="margin:0 0 4px;font-size:12px;color:#aaa;font-family:Arial,sans-serif;letter-spacing:1px;">Luxury Handbags &nbsp;·&nbsp; Saves You Money!</p>
              <p style="margin:6px 0 0;font-size:12px;color:#bbb;font-family:Arial,sans-serif;">
                📞 +254 14492024 &nbsp;|&nbsp; ✉️ <a href="mailto:kerubelle@gmail.com" style="color:#D4A5B8;text-decoration:none;">kerubelle@gmail.com</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#ccc;font-family:Arial,sans-serif;">© ${new Date().getFullYear()} KeruBelle Luxury Handbags. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

module.exports = { sendVerificationEmail, sendForgotPasswordEmail };
