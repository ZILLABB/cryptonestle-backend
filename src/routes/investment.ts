import { Router } from 'express';
import { InvestmentController } from '../controllers/InvestmentController';
import { authenticate, optionalAuth } from '../middleware/auth';
import { createInvestmentValidation, paginationValidation, idParamValidation } from '../middleware/validation';

const router = Router();
const investmentController = new InvestmentController();

// Public routes
router.get('/plans', optionalAuth, paginationValidation, investmentController.getInvestmentPlans);
router.get('/plans/:id', idParamValidation, investmentController.getInvestmentPlan);

// Protected routes
router.use(authenticate);

// Investment operations
router.post('/', createInvestmentValidation, investmentController.createInvestment);
router.get('/', paginationValidation, investmentController.getUserInvestments);
router.get('/:id', idParamValidation, investmentController.getInvestment);

export default router;
