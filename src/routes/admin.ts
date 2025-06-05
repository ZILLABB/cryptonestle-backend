import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, authorize } from '../middleware/auth';
import { createInvestmentPlanValidation, paginationValidation, idParamValidation } from '../middleware/validation';

const router = Router();
const adminController = new AdminController();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// User management
router.get('/users', paginationValidation, adminController.getUsers);
router.get('/users/:id', idParamValidation, adminController.getUser);
router.put('/users/:id/status', idParamValidation, adminController.updateUserStatus);

// Investment plan management
router.get('/investment-plans', paginationValidation, adminController.getInvestmentPlans);
router.post('/investment-plans', createInvestmentPlanValidation, adminController.createInvestmentPlan);
router.put('/investment-plans/:id', idParamValidation, createInvestmentPlanValidation, adminController.updateInvestmentPlan);
router.delete('/investment-plans/:id', idParamValidation, adminController.deleteInvestmentPlan);

// Investment management
router.get('/investments', paginationValidation, adminController.getInvestments);
router.put('/investments/:id/status', idParamValidation, adminController.updateInvestmentStatus);

// Withdrawal management
router.get('/withdrawals', paginationValidation, adminController.getWithdrawals);
router.put('/withdrawals/:id/status', idParamValidation, adminController.updateWithdrawalStatus);

// Transaction management
router.get('/transactions', paginationValidation, adminController.getTransactions);

// System settings
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);

export default router;
