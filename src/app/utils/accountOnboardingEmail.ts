import config from '../config/index.js';
import { sendEmail } from './sendEmail.js';

type UserName = {
  firstName: string;
  middleName?: string;
  lastName: string;
};

type AccountOnboardingEmailArgs = {
  to: string;
  userId: string;
  temporaryPassword: string;
  roleLabel: string;
  name?: UserName;
  departmentName?: string;
};

function resolveDisplayName(name?: UserName) {
  if (!name) {
    return 'there';
  }

  return [name.firstName, name.middleName, name.lastName]
    .filter(Boolean)
    .join(' ');
}

function buildAccountOnboardingEmail({
  userId,
  temporaryPassword,
  roleLabel,
  name,
  departmentName,
}: Omit<AccountOnboardingEmailArgs, 'to'>) {
  const displayName = resolveDisplayName(name);
  const superAdminEmail = config.super_admin_email;
  const departmentLine = departmentName
    ? `Department: ${departmentName}`
    : undefined;
  const subject = 'Your account has been created successfully';
  const text = [
    'Welcome to the Polytechnic Management System',
    '',
    `Hello ${displayName},`,
    '',
    `Your ${roleLabel} account has been successfully created. You may now sign in using the credentials below:`,
    '',
    `User ID: ${userId}`,
    departmentLine,
    `Temporary Password: ${temporaryPassword}`,
    '',
    'For security purposes, please change your password after your first login from your profile settings.',
    '',
    `If you did not request this account, kindly contact the system administrator at ${superAdminEmail}.`,
    '',
    'Polytechnic Management System',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background: #eff6ff; padding: 32px; color: #1f2937;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
        <div style="background: #1d4ed8; color: #ffffff; padding: 24px 28px;">
          <h1 style="margin: 0; font-size: 24px; line-height: 1.3;">Account Created Successfully</h1>
          <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.92;">
            Welcome to the Polytechnic Management System
          </p>
        </div>
        <div style="padding: 28px;">
          <p style="margin: 0 0 16px; font-size: 15px;">Hello ${displayName},</p>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7;">
            Your <strong>${roleLabel}</strong> account has been successfully created. You may now sign in using the credentials below:
          </p>

          <div style="border: 1px solid #d1d5db; border-radius: 12px; background: #f9fafb; padding: 18px 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em;">User ID</p>
            <p style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #111827;">${userId}</p>

            ${
              departmentName
                ? `<p style="margin: 0 0 10px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em;">Department</p>
            <p style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #111827;">${departmentName}</p>`
                : ''
            }

            <p style="margin: 0 0 10px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em;">One-Time Password</p>
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #111827;">${temporaryPassword}</p>
          </div>

          <div style="border-left: 4px solid #2563eb; background: #eff6ff; padding: 14px 16px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #1e3a8a;">
              For security purposes, please change your password after your first login from your profile settings.
            </p>
          </div>

          <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #4b5563;">
            If you did not request this account, kindly contact the system administrator at
            <a href="mailto:${superAdminEmail}" style="color: #1d4ed8; text-decoration: none; font-weight: 700;">${superAdminEmail}</a>.
          </p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; background: #f9fafb; padding: 16px 28px;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            Polytechnic Management System
          </p>
        </div>
      </div>
    </div>
  `;

  return {
    subject,
    text,
    html,
  };
}

export async function sendAccountOnboardingEmail({
  to,
  userId,
  temporaryPassword,
  roleLabel,
  name,
  departmentName,
}: AccountOnboardingEmailArgs) {
  const message = buildAccountOnboardingEmail({
    userId,
    temporaryPassword,
    roleLabel,
    name,
    departmentName,
  });

  return sendEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
