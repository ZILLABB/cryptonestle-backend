import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle Prisma errors
const handlePrismaError = (error: PrismaClientKnownRequestError): AppError => {
  let message = 'Database error occurred';
  let statusCode = 500;

  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const target = error.meta?.target as string[];
      message = `Duplicate value for ${target?.join(', ') || 'field'}`;
      statusCode = 409;
      break;
    case 'P2014':
      // Invalid ID
      message = 'Invalid ID provided';
      statusCode = 400;
      break;
    case 'P2003':
      // Foreign key constraint violation
      message = 'Related record not found';
      statusCode = 400;
      break;
    case 'P2025':
      // Record not found
      message = 'Record not found';
      statusCode = 404;
      break;
    default:
      message = 'Database operation failed';
      statusCode = 500;
  }

  return new CustomError(message, statusCode);
};

// Handle validation errors
const handleValidationError = (error: any): AppError => {
  const errors = error.errors || error.details;
  const message = errors?.map((err: any) => err.message || err.msg).join(', ') || 'Validation failed';
  return new CustomError(message, 400);
};

// Handle JWT errors
const handleJWTError = (): AppError => {
  return new CustomError('Invalid token. Please log in again.', 401);
};

const handleJWTExpiredError = (): AppError => {
  return new CustomError('Your token has expired. Please log in again.', 401);
};

// Send error response in development
const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode || 500).json({
    status: 'error',
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Send error response in production
const sendErrorProd = (err: AppError, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR:', err);

    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.statusCode || 500}: ${err.message}`);
  logger.error(err.stack);

  // Prisma errors
  if (err instanceof PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  }

  // Prisma validation errors
  if (err instanceof PrismaClientValidationError) {
    error = new CustomError('Invalid data provided', 400);
  }

  // Validation errors
  if (err.name === 'ValidationError' || err.errors) {
    error = handleValidationError(err);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Cast error to AppError
  const appError: AppError = {
    ...error,
    statusCode: error.statusCode || 500,
    isOperational: error.isOperational !== undefined ? error.isOperational : true,
  };

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(appError, res);
  } else {
    sendErrorProd(appError, res);
  }
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
