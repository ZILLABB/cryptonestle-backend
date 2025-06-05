import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index';

/**
 * Generate a unique referral code
 */
export const generateReferralCode = async (): Promise<string> => {
  let referralCode: string;
  let isUnique = false;

  do {
    // Generate a random 8-character code
    referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Check if it's unique
    const existingUser = await prisma.user.findUnique({
      where: { referralCode },
    });
    
    isUnique = !existingUser;
  } while (!isUnique);

  return referralCode;
};

/**
 * Generate a unique transaction ID
 */
export const generateTransactionId = (): string => {
  return `TXN_${Date.now()}_${uuidv4().substring(0, 8).toUpperCase()}`;
};

/**
 * Calculate investment return
 */
export const calculateInvestmentReturn = (
  amount: number,
  returnPercentage: number
): number => {
  return (amount * returnPercentage) / 100;
};

/**
 * Calculate maturity date
 */
export const calculateMaturityDate = (
  startDate: Date,
  durationDays: number
): Date => {
  const maturityDate = new Date(startDate);
  maturityDate.setDate(maturityDate.getDate() + durationDays);
  return maturityDate;
};

/**
 * Format currency amount
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'ETH',
  decimals: number = 8
): string => {
  return `${amount.toFixed(decimals)} ${currency}`;
};

/**
 * Validate Ethereum address
 */
export const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Validate transaction hash
 */
export const isValidTransactionHash = (hash: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

/**
 * Generate pagination metadata
 */
export const generatePaginationMeta = (
  page: number,
  limit: number,
  total: number
) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
  };
};

/**
 * Sleep function for delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Sanitize user input
 */
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Check if date is in the past
 */
export const isDateInPast = (date: Date): boolean => {
  return date < new Date();
};

/**
 * Check if date is in the future
 */
export const isDateInFuture = (date: Date): boolean => {
  return date > new Date();
};

/**
 * Convert string to boolean
 */
export const stringToBoolean = (str: string): boolean => {
  return str.toLowerCase() === 'true';
};

/**
 * Get time difference in days
 */
export const getDaysDifference = (date1: Date, date2: Date): number => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Format date to string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Parse pagination parameters
 */
export const parsePaginationParams = (
  page?: string,
  limit?: string
): { page: number; limit: number; skip: number } => {
  const parsedPage = Math.max(1, parseInt(page || '1', 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit || '10', 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
  };
};

/**
 * Generate API response
 */
export const generateApiResponse = (
  status: 'success' | 'error',
  message: string,
  data?: any,
  meta?: any
) => {
  const response: any = {
    status,
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta !== undefined) {
    response.meta = meta;
  }

  return response;
};
