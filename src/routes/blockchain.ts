import { Router } from 'express';
import { BlockchainController } from '../controllers/BlockchainController';
import { authenticate } from '../middleware/auth';
import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';
import { CustomError } from '../middleware/errorHandler';

const router = Router();
const blockchainController = new BlockchainController();

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed', 400);
  }
  next();
};

// Validation rules
const connectWalletValidation = [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('signature')
    .isLength({ min: 1 })
    .withMessage('Signature is required'),
  body('message')
    .isLength({ min: 1 })
    .withMessage('Message is required'),
  handleValidationErrors,
];

const executeInvestmentValidation = [
  body('planId')
    .isInt({ min: 1 })
    .withMessage('Valid plan ID is required'),
  body('amount')
    .isFloat({ min: 0.001 })
    .withMessage('Amount must be at least 0.001 ETH'),
  body('network')
    .optional()
    .isIn(['ethereum', 'bsc', 'polygon'])
    .withMessage('Invalid network'),
  handleValidationErrors,
];

const executeWithdrawalValidation = [
  body('investmentId')
    .isInt({ min: 1 })
    .withMessage('Valid investment ID is required'),
  body('network')
    .optional()
    .isIn(['ethereum', 'bsc', 'polygon'])
    .withMessage('Invalid network'),
  handleValidationErrors,
];

const transactionHashValidation = [
  param('hash')
    .isLength({ min: 66, max: 66 })
    .withMessage('Invalid transaction hash'),
  query('network')
    .optional()
    .isIn(['ethereum', 'bsc', 'polygon'])
    .withMessage('Invalid network'),
  handleValidationErrors,
];

const gasEstimationValidation = [
  body('method')
    .isIn(['invest', 'withdraw', 'emergencyWithdraw'])
    .withMessage('Invalid method'),
  body('params')
    .isArray()
    .withMessage('Parameters must be an array'),
  body('network')
    .optional()
    .isIn(['ethereum', 'bsc', 'polygon'])
    .withMessage('Invalid network'),
  handleValidationErrors,
];

const walletAddressValidation = [
  param('address')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  query('network')
    .optional()
    .isIn(['ethereum', 'bsc', 'polygon'])
    .withMessage('Invalid network'),
  handleValidationErrors,
];

const investmentIdValidation = [
  param('investmentId')
    .isInt({ min: 1 })
    .withMessage('Valid investment ID is required'),
  query('network')
    .optional()
    .isIn(['ethereum', 'bsc', 'polygon'])
    .withMessage('Invalid network'),
  handleValidationErrors,
];

// All routes require authentication
router.use(authenticate);

// Wallet management routes
router.post('/connect-wallet', connectWalletValidation, blockchainController.connectWallet);
router.get('/wallet-balance/:address', walletAddressValidation, blockchainController.getWalletBalance);

// Investment execution routes
router.post('/execute-investment', executeInvestmentValidation, blockchainController.executeInvestment);
router.post('/execute-withdrawal', executeWithdrawalValidation, blockchainController.executeWithdrawal);

// Transaction monitoring routes
router.get('/transaction-status/:hash', transactionHashValidation, blockchainController.getTransactionStatus);
router.post('/estimate-gas', gasEstimationValidation, blockchainController.estimateGas);

// Smart contract data routes
router.get('/investment-details/:investmentId', investmentIdValidation, blockchainController.getInvestmentDetails);
router.get('/user-investments', blockchainController.getUserInvestments);
router.get('/contract-stats', blockchainController.getContractStats);

export default router;
