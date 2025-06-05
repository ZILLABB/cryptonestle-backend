import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController';
import { authenticate } from '../middleware/auth';
import { paginationValidation, idParamValidation } from '../middleware/validation';

const router = Router();
const transactionController = new TransactionController();

// All routes require authentication
router.use(authenticate);

// Transaction routes
router.get('/', paginationValidation, transactionController.getUserTransactions);
router.get('/:id', idParamValidation, transactionController.getTransaction);

export default router;
