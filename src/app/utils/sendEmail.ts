import nodemailer from 'nodemailer';
import config from '../config/index.js';

export const sendEmail = async (to: string, html: string) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com.',
    port: 587,
    secure: config.NODE_ENV === 'production',
    auth: {
      // TODO: replace `user` and `pass` values from <https://forwardemail.net>
      user: 'ruhulthisis@gmail.com',
      pass: 'emjt xsmt aogy pmbi',
    },
  });

  await transporter.sendMail({
    from: 'ruhulthisis@gmail.com', // sender address
    to, // list of receivers
    subject: 'Reset your password within ten mins!', // Subject line
    text: '', // plain text body
    html, // html body
  });
};