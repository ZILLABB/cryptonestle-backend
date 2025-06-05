import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';
import { updateProfileValidation, paginationValidation } from '../middleware/validation';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// User profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', updateProfileValidation, userController.updateProfile);
router.get('/dashboard', userController.getDashboard);

// User investments
router.get('/investments', paginationValidation, userController.getUserInvestments);

// User transactions
router.get('/transactions', paginationValidation, userController.getUserTransactions);

// User withdrawals
router.get('/withdrawals', paginationValidation, userController.getUserWithdrawals);

// User notifications
router.get('/notifications', paginationValidation, userController.getNotifications);
router.put('/notifications/:id/read', userController.markNotificationAsRead);

export default router;
