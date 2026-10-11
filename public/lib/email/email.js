const nodemailer = require("nodemailer");

// ========================================
// 1. EMAIL CONFIGURATION
// ========================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:4200";

// ========================================
// 2. VERIFY SMTP CONNECTION
// ========================================

transporter
  .verify()
  .then(() => {
    console.log("Gmail SMTP connection successful");
  })
  .catch((error) => {
    console.error("Gmail SMTP connection failed:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });
  });

// ========================================
// 3. SEND WELCOME EMAIL TO USER
// ========================================

async function sendWelcomeEmail(name, email) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email transporter configuration is missing");
  }

  if (!email) {
    throw new Error("User email is missing");
  }

  const safeName = escapeHtml(name || "User");
  const safeEmail = escapeHtml(email);

  const mailOptions = {
    from: `"ABG Analyzer" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Welcome to ABG Analyzer!",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:25px;">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:600px;margin:auto;background:#fff;
          border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:28px 20px;text-align:center;
              background:#12304d;color:#fff;">
              <h1 style="margin:0;font-size:25px;">
                🩺 ABG Analyzer
              </h1>
              <p style="margin:10px 0 0;color:#d4e5f5;">
                Welcome to your healthcare workspace
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:30px;color:#26364b;">
              <h2 style="color:#147f86;">
                Welcome, ${safeName}!
              </h2>

              <p style="font-size:15px;line-height:1.8;">
                Thank you for registering with ABG Analyzer.
                Your account registration has been received successfully.
              </p>

              <div style="background:#f0faf8;border:1px solid #d7eeea;
                padding:18px;border-radius:8px;margin:22px 0;">
                <p style="margin:0 0 10px;color:#147f86;font-weight:bold;">
                  Your account details
                </p>

                <p style="margin:7px 0;">
                  <strong>Name:</strong> ${safeName}
                </p>

                <p style="margin:7px 0;word-break:break-word;">
                  <strong>Email:</strong> ${safeEmail}
                </p>

                <p style="margin:7px 0;">
                  <strong>Account:</strong> Registered
                </p>
              </div>

              <p style="font-size:15px;line-height:1.8;">
                You can sign in to your account and access your workspace.
              </p>

              <div style="text-align:center;margin:28px 0;">
                <a href="${FRONTEND_URL}/login"
                  style="display:inline-block;padding:13px 25px;
                  background:#147f86;color:#fff;text-decoration:none;
                  border-radius:7px;font-weight:bold;">
                  Sign In to Your Account
                </a>
              </div>

              <p style="font-size:13px;line-height:1.7;color:#64748b;">
                ABG Analyzer is a clinical decision-support aid.
                Always consult a qualified healthcare professional
                for medical interpretation and treatment decisions.
              </p>

              <p style="font-size:15px;line-height:1.7;">
                Regards,<br/>
                <strong>ABG Analyzer Team</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f1f5f9;text-align:center;
              padding:15px;color:#8290a2;font-size:12px;">
              &copy; ${new Date().getFullYear()} ABG Analyzer.
              All rights reserved.
            </td>
          </tr>
        </table>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log("Welcome email sent successfully:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    return info;
  } catch (error) {
    console.error("Welcome email failed:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  }
}

// ========================================
// 4. SEND NEW REGISTRATION EMAIL TO ADMIN
// ========================================

async function sendAdminRegistrationEmail(name, email) {
  if (!process.env.ADMIN_EMAIL) {
    throw new Error("ADMIN_EMAIL is not configured");
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email transporter configuration is missing");
  }

  if (!email) {
    throw new Error("Registered user email is missing");
  }

  const safeName = escapeHtml(name || "User");
  const safeEmail = escapeHtml(email);

  const registeredAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  const mailOptions = {
    from: `"ABG Analyzer Notifications" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: "New User Registration - ABG Analyzer",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:25px;">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:600px;margin:auto;background:#fff;
          border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:25px;text-align:center;
              background:#12304d;color:#fff;">
              <h1 style="margin:0;font-size:24px;">
                🩺 ABG Analyzer
              </h1>
              <p style="margin:10px 0 0;color:#d4e5f5;">
                Admin Notification
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;color:#26364b;">
              <h2 style="margin-top:0;color:#147f86;">
                New User Registered
              </h2>

              <p style="font-size:15px;line-height:1.7;">
                A new user has registered on the ABG Analyzer platform.
                Registration details are provided below.
              </p>

              <table width="100%" cellpadding="12" cellspacing="0"
                style="border-collapse:collapse;margin:20px 0;
                font-size:14px;">

                <tr style="background:#f5f8fc;">
                  <td style="border:1px solid #e2e8f0;">
                    <strong>User Name</strong>
                  </td>
                  <td style="border:1px solid #e2e8f0;">
                    ${safeName}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #e2e8f0;">
                    <strong>Email</strong>
                  </td>
                  <td style="border:1px solid #e2e8f0;word-break:break-word;">
                    ${safeEmail}
                  </td>
                </tr>

                <tr style="background:#f5f8fc;">
                  <td style="border:1px solid #e2e8f0;">
                    <strong>Role</strong>
                  </td>
                  <td style="border:1px solid #e2e8f0;">
                    USER
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #e2e8f0;">
                    <strong>Registration Time</strong>
                  </td>
                  <td style="border:1px solid #e2e8f0;">
                    ${escapeHtml(registeredAt)}
                  </td>
                </tr>
              </table>

              <div style="text-align:center;margin:25px 0;">
                <a href="${FRONTEND_URL}/admin-dashboard"
                  style="display:inline-block;padding:13px 24px;
                  background:#147f86;color:#fff;text-decoration:none;
                  border-radius:7px;font-weight:bold;">
                  Open Admin Dashboard
                </a>
              </div>

              <p style="font-size:14px;color:#64748b;line-height:1.7;">
                This is an automated notification from ABG Analyzer.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f1f5f9;text-align:center;
              padding:15px;color:#8290a2;font-size:12px;">
              &copy; ${new Date().getFullYear()} ABG Analyzer.
              All rights reserved.
            </td>
          </tr>
        </table>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log("Admin email sent successfully:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    return info;
  } catch (error) {
    console.error("Admin notification email failed:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  }
}

// ========================================
// 5. ESCAPE HTML VALUES
// ========================================

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

// ========================================
// 6. EXPORT FUNCTIONS
// ========================================

module.exports = {
  sendWelcomeEmail,
  sendAdminRegistrationEmail,
};
