import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, userId: string): Promise<void> {
    try {
      const token = jwt.sign(
        { id: userId, type: 'email_verification' },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'Verify Your Email - Cryptonestle',
        html: this.getVerificationEmailTemplate(verificationUrl),
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Verification email sent to: ${email}`);
    } catch (error) {
      logger.error('Error sending verification email:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, userId: string): Promise<void> {
    try {
      const token = jwt.sign(
        { id: userId, type: 'password_reset' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'Reset Your Password - Cryptonestle',
        html: this.getPasswordResetEmailTemplate(resetUrl),
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to: ${email}`);
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      throw error;
    }
  }

  /**
   * Send investment confirmation email
   */
  async sendInvestmentConfirmationEmail(
    email: string,
    investmentDetails: {
      amount: string;
      currency: string;
      planName: string;
      duration: number;
      expectedReturn: string;
      maturityDate: string;
    }
  ): Promise<void> {
    try {
      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'Investment Confirmation - Cryptonestle',
        html: this.getInvestmentConfirmationTemplate(investmentDetails),
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Investment confirmation email sent to: ${email}`);
    } catch (error) {
      logger.error('Error sending investment confirmation email:', error);
      throw error;
    }
  }

  /**
   * Send withdrawal notification email
   */
  async sendWithdrawalNotificationEmail(
    email: string,
    withdrawalDetails: {
      amount: string;
      currency: string;
      walletAddress: string;
      status: string;
    }
  ): Promise<void> {
    try {
      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'Withdrawal Update - Cryptonestle',
        html: this.getWithdrawalNotificationTemplate(withdrawalDetails),
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Withdrawal notification email sent to: ${email}`);
    } catch (error) {
      logger.error('Error sending withdrawal notification email:', error);
      throw error;
    }
  }

  /**
   * Email verification template
   */
  private getVerificationEmailTemplate(verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Cryptonestle!</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for joining Cryptonestle! To complete your registration and start investing, please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create an account with Cryptonestle, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Cryptonestle. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Password reset email template
   */
  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password for your Cryptonestle account. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This reset link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Cryptonestle. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Investment confirmation email template
   */
  private getInvestmentConfirmationTemplate(details: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Investment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Investment Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Your Investment Details</h2>
            <p>Congratulations! Your investment has been successfully confirmed. Here are the details:</p>
            <div class="details">
              <p><strong>Investment Amount:</strong> ${details.amount} ${details.currency}</p>
              <p><strong>Investment Plan:</strong> ${details.planName}</p>
              <p><strong>Duration:</strong> ${details.duration} days</p>
              <p><strong>Expected Return:</strong> ${details.expectedReturn} ${details.currency}</p>
              <p><strong>Maturity Date:</strong> ${details.maturityDate}</p>
            </div>
            <p>You can track your investment progress in your dashboard.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Cryptonestle. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Withdrawal notification email template
   */
  private getWithdrawalNotificationTemplate(details: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Withdrawal Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Withdrawal Update</h1>
          </div>
          <div class="content">
            <h2>Withdrawal Status: ${details.status}</h2>
            <div class="details">
              <p><strong>Amount:</strong> ${details.amount} ${details.currency}</p>
              <p><strong>Wallet Address:</strong> ${details.walletAddress}</p>
              <p><strong>Status:</strong> ${details.status}</p>
            </div>
            <p>You can check the latest status in your dashboard.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Cryptonestle. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
