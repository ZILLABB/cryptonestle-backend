import { Router } from 'express';
import { WithdrawalController } from '../controllers/WithdrawalController';
import { authenticate } from '../middleware/auth';
import { createWithdrawalValidation, paginationValidation, idParamValidation } from '../middleware/validation';

const router = Router();
const withdrawalController = new WithdrawalController();

// All routes require authentication
router.use(authenticate);

// Withdrawal routes
router.post('/', createWithdrawalValidation, withdrawalController.createWithdrawal);
router.get('/', paginationValidation, withdrawalController.getUserWithdrawals);
router.get('/:id', idParamValidation, withdrawalController.getWithdrawal);

export default router;
