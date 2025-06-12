import { Router } from 'express';
import { PriceController } from '../controllers/PriceController';
import { authenticate } from '../middleware/auth';
import { param, query, body } from 'express-validator';
import { validationResult } from 'express-validator';
import { CustomError } from '../middleware/errorHandler';

const router = Router();
const priceController = new PriceController();

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed', 400);
  }
  next();
};

// Validation rules
const symbolValidation = [
  param('symbol')
    .isLength({ min: 2, max: 10 })
    .withMessage('Symbol must be between 2 and 10 characters')
    .matches(/^[A-Za-z]+$/)
    .withMessage('Symbol must contain only letters'),
  handleValidationErrors,
];

const daysValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  handleValidationErrors,
];

const periodValidation = [
  query('period')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Period must be between 1 and 365 days'),
  handleValidationErrors,
];

const priceAlertValidation = [
  body('symbol')
    .isLength({ min: 2, max: 10 })
    .withMessage('Symbol must be between 2 and 10 characters')
    .matches(/^[A-Za-z]+$/)
    .withMessage('Symbol must contain only letters'),
  body('targetPrice')
    .isFloat({ min: 0 })
    .withMessage('Target price must be a positive number'),
  body('condition')
    .isIn(['above', 'below'])
    .withMessage('Condition must be either "above" or "below"'),
  handleValidationErrors,
];

// All routes require authentication
router.use(authenticate);

// Public price data routes (authenticated users)
router.get('/current', priceController.getCurrentPrices);
router.get('/supported', priceController.getSupportedCurrencies);
router.get('/market-overview', priceController.getMarketOverview);
router.get('/price/:symbol', symbolValidation, priceController.getPrice);
router.get('/history/:symbol', symbolValidation, daysValidation, priceController.getPriceHistory);

// User-specific routes
router.get('/portfolio', priceController.getPortfolioValue);
router.get('/portfolio/analytics', periodValidation, priceController.getPortfolioAnalytics);
router.get('/alerts', priceController.getPriceAlerts);
router.post('/alerts', priceAlertValidation, priceController.createPriceAlert);

// Admin routes
router.post('/cache/clear', priceController.clearPriceCache);
router.get('/stats', priceController.getPriceServiceStats);

export default router;
