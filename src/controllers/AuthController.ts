import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { ethers } from 'ethers';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { generateReferralCode } from '../utils/helpers';
import { EmailService } from '../services/EmailService';

export class AuthController {
  private emailService = new EmailService();

  // Generate JWT tokens
  private generateTokens(userId: string): { accessToken: string; refreshToken: string } {
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';

    const accessToken = jwt.sign(
      { id: userId },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { id: userId },
      jwtRefreshSecret,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  // Register new user
  register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, firstName, lastName, walletAddress, referralCode } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(walletAddress ? [{ walletAddress }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new CustomError('User with this email or wallet address already exists', 409);
    }

    // Validate referral code if provided
    let referrerId = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
      });
      if (!referrer) {
        throw new CustomError('Invalid referral code', 400);
      }
      referrerId = referrer.id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    // Generate unique referral code for new user
    const userReferralCode = await generateReferralCode();

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        walletAddress,
        referralCode: userReferralCode,
        referredBy: referrerId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        referralCode: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, user.id);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  });

  // Login user
  login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        role: true,
        status: true,
        isTwoFactorEnabled: true,
        isEmailVerified: true,
      },
    });

    if (!user || !user.password) {
      throw new CustomError('Invalid email or password', 401);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new CustomError('Invalid email or password', 401);
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new CustomError('Account is not active', 401);
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${user.email}`);

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
        requiresTwoFactor: user.isTwoFactorEnabled,
      },
    });
  });

  // Wallet-based login
  walletLogin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { walletAddress, signature, message } = req.body;

    // Verify signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new CustomError('Invalid signature', 401);
      }
    } catch (error) {
      throw new CustomError('Invalid signature', 401);
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        role: true,
        status: true,
        isTwoFactorEnabled: true,
      },
    });

    if (!user) {
      // Create new user with wallet
      const userReferralCode = await generateReferralCode();
      user = await prisma.user.create({
        data: {
          email: `${walletAddress.toLowerCase()}@wallet.local`, // Generate a unique email for wallet users
          walletAddress,
          referralCode: userReferralCode,
          isEmailVerified: true, // Wallet users are considered verified
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          walletAddress: true,
          role: true,
          status: true,
          isTwoFactorEnabled: true,
        },
      });
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new CustomError('Account is not active', 401);
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    logger.info(`User logged in with wallet: ${walletAddress}`);

    res.json({
      status: 'success',
      message: 'Wallet login successful',
      data: {
        user,
        accessToken,
        refreshToken,
        requiresTwoFactor: user.isTwoFactorEnabled,
      },
    });
  });

  // Logout user
  logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // In a production app, you might want to blacklist the token
    // For now, we'll just return a success message
    logger.info(`User logged out: ${req.user?.email}`);

    res.json({
      status: 'success',
      message: 'Logout successful',
    });
  });

  // Refresh token
  refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new CustomError('Refresh token is required', 401);
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'default-refresh-secret') as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new CustomError('Invalid refresh token', 401);
      }

      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user.id);

      res.json({
        status: 'success',
        data: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      throw new CustomError('Invalid refresh token', 401);
    }
  });

  // Change password
  changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user?.password) {
      throw new CustomError('User not found or password not set', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new CustomError('Current password is incorrect', 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    logger.info(`Password changed for user: ${req.user?.email}`);

    res.json({
      status: 'success',
      message: 'Password changed successfully',
    });
  });

  // Setup 2FA
  setup2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Cryptonestle (${req.user!.email})`,
      issuer: 'Cryptonestle',
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Save secret to database (temporarily)
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    res.json({
      status: 'success',
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
      },
    });
  });

  // Verify 2FA
  verify2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
      throw new CustomError('2FA not set up', 400);
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new CustomError('Invalid 2FA token', 400);
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });

    res.json({
      status: 'success',
      message: '2FA enabled successfully',
    });
  });

  // Disable 2FA
  disable2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, isTwoFactorEnabled: true },
    });

    if (!user?.isTwoFactorEnabled) {
      throw new CustomError('2FA is not enabled', 400);
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new CustomError('Invalid 2FA token', 400);
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    res.json({
      status: 'success',
      message: '2FA disabled successfully',
    });
  });

  // Forgot password
  forgotPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      await this.emailService.sendPasswordResetEmail(user.email, user.id);
    }

    // Always return success to prevent email enumeration
    res.json({
      status: 'success',
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  });

  // Reset password
  resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token, newPassword } = req.body;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));

      await prisma.user.update({
        where: { id: decoded.id },
        data: { password: hashedPassword },
      });

      res.json({
        status: 'success',
        message: 'Password reset successfully',
      });
    } catch (error) {
      throw new CustomError('Invalid or expired reset token', 400);
    }
  });

  // Verify email
  verifyEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      await prisma.user.update({
        where: { id: decoded.id },
        data: { isEmailVerified: true },
      });

      res.json({
        status: 'success',
        message: 'Email verified successfully',
      });
    } catch (error) {
      throw new CustomError('Invalid or expired verification token', 400);
    }
  });

  // Resend verification email
  resendVerification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isEmailVerified: true },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    if (user.isEmailVerified) {
      throw new CustomError('Email is already verified', 400);
    }

    await this.emailService.sendVerificationEmail(user.email, user.id);

    res.json({
      status: 'success',
      message: 'Verification email sent',
    });
  });
}
