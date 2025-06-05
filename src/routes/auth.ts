import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import {
  registerValidation,
  loginValidation,
  walletLoginValidation,
  changePasswordValidation,
} from '../middleware/validation';
import { authenticate } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/wallet-login', walletLoginValidation, authController.walletLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/change-password', authenticate, changePasswordValidation, authController.changePassword);

// 2FA routes
router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/verify', authenticate, authController.verify2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);

export default router;
