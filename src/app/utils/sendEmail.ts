import nodemailer from 'nodemailer';
import config from '../config/index.js';

const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 587;
function resolveSmtpPort() {
  const value = Number(config.smtp_port ?? DEFAULT_SMTP_PORT);

  if (Number.isNaN(value)) {
    throw new Error('SMTP_PORT must be a valid number.');
  }

  return value;
}

function resolveSmtpSecure(port: number) {
  if (config.smtp_secure === 'true') {
    return true;
  }

  if (config.smtp_secure === 'false') {
    return false;
  }

  return port === 465;
}

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export const sendEmail = async ({
  to,
  subject,
  html,
  text = '',
}: SendEmailOptions) => {
  if (!config.smtp_user || !config.smtp_pass) {
    throw new Error(
      'Email service is not configured. Set SMTP_USER and SMTP_PASS in environment variables.',
    );
  }

  const port = resolveSmtpPort();
  const from = config.smtp_from || config.smtp_user;

  const transporter = nodemailer.createTransport({
    host: config.smtp_host || DEFAULT_SMTP_HOST,
    port,
    secure: resolveSmtpSecure(port),
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return {
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    messageId: info.messageId,
  };
};
