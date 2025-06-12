import { Router } from 'express';
import { WebSocketController } from '../controllers/WebSocketController';
import { authenticate } from '../middleware/auth';
import { param, body } from 'express-validator';
import { validationResult } from 'express-validator';
import { CustomError } from '../middleware/errorHandler';

const router = Router();
const webSocketController = new WebSocketController();

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed', 400);
  }
  next();
};

// Validation rules
const userIdValidation = [
  param('userId')
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
  handleValidationErrors,
];

const notificationValidation = [
  body('title')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('message')
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters'),
  body('type')
    .optional()
    .isIn(['SYSTEM', 'INVESTMENT', 'WITHDRAWAL', 'TRANSACTION', 'SECURITY', 'PROMOTION'])
    .withMessage('Invalid notification type'),
  handleValidationErrors,
];

const userNotificationValidation = [
  body('userId')
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
  ...notificationValidation,
];

// All routes require authentication
router.use(authenticate);

// General WebSocket routes
router.get('/health', webSocketController.getHealthStatus);
router.get('/stats', webSocketController.getConnectionStats);
router.get('/docs', webSocketController.getEventsDocumentation);

// User connection routes
router.get('/connection/:userId', userIdValidation, webSocketController.checkUserConnection);

// Admin notification routes
router.post('/notify/user', userNotificationValidation, webSocketController.sendNotification);
router.post('/notify/broadcast', notificationValidation, webSocketController.broadcastNotification);

// Admin trigger routes
router.post('/trigger/price-update', webSocketController.triggerPriceUpdate);
router.post('/trigger/portfolio-update/:userId', userIdValidation, webSocketController.triggerPortfolioUpdate);

export { webSocketController };
export default router;
