import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CustomError } from './errorHandler';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    throw new CustomError(errorMessages.join(', '), 400);
  }
  
  next();
};

// Auth validation rules
export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('walletAddress')
    .optional()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Please provide a valid Ethereum wallet address'),
  handleValidationErrors,
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

export const walletLoginValidation = [
  body('walletAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Please provide a valid Ethereum wallet address'),
  body('signature')
    .notEmpty()
    .withMessage('Signature is required'),
  body('message')
    .notEmpty()
    .withMessage('Message is required'),
  handleValidationErrors,
];

// Investment validation rules
export const createInvestmentValidation = [
  body('planId')
    .notEmpty()
    .withMessage('Investment plan ID is required'),
  body('amount')
    .isFloat({ min: 0.001 })
    .withMessage('Amount must be greater than 0.001'),
  body('currency')
    .optional()
    .isIn(['ETH', 'BTC', 'USDT', 'USDC', 'BNB'])
    .withMessage('Invalid currency'),
  body('transactionHash')
    .optional()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash'),
  handleValidationErrors,
];

// Investment plan validation rules
export const createInvestmentPlanValidation = [
  body('name')
    .isLength({ min: 3, max: 100 })
    .withMessage('Plan name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('durationDays')
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1 and 365 days'),
  body('returnPercentage')
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Return percentage must be between 0.1 and 100'),
  body('minAmount')
    .isFloat({ min: 0.001 })
    .withMessage('Minimum amount must be greater than 0.001'),
  body('maxAmount')
    .isFloat({ min: 0.001 })
    .withMessage('Maximum amount must be greater than 0.001'),
  handleValidationErrors,
];

// Withdrawal validation rules
export const createWithdrawalValidation = [
  body('amount')
    .isFloat({ min: 0.001 })
    .withMessage('Amount must be greater than 0.001'),
  body('walletAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Please provide a valid Ethereum wallet address'),
  body('currency')
    .optional()
    .isIn(['ETH', 'BTC', 'USDT', 'USDC', 'BNB'])
    .withMessage('Invalid currency'),
  handleValidationErrors,
];

// User profile validation rules
export const updateProfileValidation = [
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phoneNumber')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  handleValidationErrors,
];

// Password validation rules
export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  handleValidationErrors,
];

// Pagination validation
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
];

// ID parameter validation
export const idParamValidation = [
  param('id')
    .notEmpty()
    .withMessage('ID parameter is required'),
  handleValidationErrors,
];
