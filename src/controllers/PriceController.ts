import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { PriceService } from '../services/PriceService';
import { logger } from '../utils/logger';

export class PriceController {
  private priceService: PriceService;

  constructor() {
    this.priceService = new PriceService();
  }

  /**
   * Get current cryptocurrency prices
   */
  getCurrentPrices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prices = await this.priceService.getCurrentPrices();

    res.json({
      status: 'success',
      message: 'Current prices retrieved successfully',
      data: {
        prices,
        lastUpdated: new Date(),
        count: prices.length
      },
    });
  });

  /**
   * Get price for a specific cryptocurrency
   */
  getPrice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { symbol } = req.params;

    if (!symbol) {
      throw new CustomError('Cryptocurrency symbol is required', 400);
    }

    const price = await this.priceService.getPrice(symbol);

    if (!price) {
      throw new CustomError(`Price not found for cryptocurrency: ${symbol}`, 404);
    }

    res.json({
      status: 'success',
      message: `Price for ${symbol} retrieved successfully`,
      data: price,
    });
  });

  /**
   * Get price history for a cryptocurrency
   */
  getPriceHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { symbol } = req.params;
    const { days = '7' } = req.query;

    if (!symbol) {
      throw new CustomError('Cryptocurrency symbol is required', 400);
    }

    const daysNumber = parseInt(days as string);
    if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
      throw new CustomError('Days must be a number between 1 and 365', 400);
    }

    const history = await this.priceService.getPriceHistory(symbol, daysNumber);

    res.json({
      status: 'success',
      message: `Price history for ${symbol} retrieved successfully`,
      data: {
        symbol: symbol.toUpperCase(),
        days: daysNumber,
        history,
        count: history.length
      },
    });
  });

  /**
   * Get user's portfolio value
   */
  getPortfolioValue = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const portfolio = await this.priceService.getPortfolioValue(userId);

    res.json({
      status: 'success',
      message: 'Portfolio value retrieved successfully',
      data: portfolio,
    });
  });

  /**
   * Get portfolio analytics
   */
  getPortfolioAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { period = '30' } = req.query;

    const periodDays = parseInt(period as string);
    if (isNaN(periodDays) || periodDays < 1 || periodDays > 365) {
      throw new CustomError('Period must be a number between 1 and 365 days', 400);
    }

    // Get portfolio value
    const portfolio = await this.priceService.getPortfolioValue(userId);

    // Get user's investment history for analytics
    const { prisma } = await import('../index');
    const investments = await prisma.investment.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        plan: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate analytics
    const analytics = {
      portfolio,
      period: periodDays,
      investmentCount: investments.length,
      averageInvestment: investments.length > 0 
        ? investments.reduce((sum, inv) => sum + inv.amount, 0) / investments.length 
        : 0,
      activeInvestments: investments.filter(inv => inv.status === 'ACTIVE').length,
      completedInvestments: investments.filter(inv => inv.status === 'COMPLETED').length,
      totalInvestedInPeriod: investments.reduce((sum, inv) => sum + inv.amount, 0),
      investmentsByPlan: investments.reduce((acc, inv) => {
        const planName = inv.plan?.name || 'Unknown';
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      investmentTimeline: investments.map(inv => ({
        date: inv.createdAt,
        amount: inv.amount,
        planName: inv.plan?.name,
        status: inv.status
      }))
    };

    res.json({
      status: 'success',
      message: 'Portfolio analytics retrieved successfully',
      data: analytics,
    });
  });

  /**
   * Get market overview
   */
  getMarketOverview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prices = await this.priceService.getCurrentPrices();

    // Calculate market overview
    const totalMarketCap = prices.reduce((sum, price) => sum + price.marketCap, 0);
    const totalVolume24h = prices.reduce((sum, price) => sum + price.volume24h, 0);
    const gainers = prices.filter(price => price.priceChangePercentage24h > 0);
    const losers = prices.filter(price => price.priceChangePercentage24h < 0);

    const overview = {
      totalMarketCap,
      totalVolume24h,
      cryptocurrencyCount: prices.length,
      gainersCount: gainers.length,
      losersCount: losers.length,
      topGainer: gainers.length > 0 
        ? gainers.reduce((max, price) => 
            price.priceChangePercentage24h > max.priceChangePercentage24h ? price : max
          )
        : null,
      topLoser: losers.length > 0 
        ? losers.reduce((min, price) => 
            price.priceChangePercentage24h < min.priceChangePercentage24h ? price : min
          )
        : null,
      prices: prices.map(price => ({
        symbol: price.symbol,
        name: price.name,
        price: price.price,
        priceChangePercentage24h: price.priceChangePercentage24h,
        marketCap: price.marketCap,
        volume24h: price.volume24h
      }))
    };

    res.json({
      status: 'success',
      message: 'Market overview retrieved successfully',
      data: overview,
    });
  });

  /**
   * Get supported cryptocurrencies
   */
  getSupportedCurrencies = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supportedCurrencies = [
      { symbol: 'ETH', name: 'Ethereum', coinGeckoId: 'ethereum' },
      { symbol: 'BTC', name: 'Bitcoin', coinGeckoId: 'bitcoin' },
      { symbol: 'BNB', name: 'BNB', coinGeckoId: 'binancecoin' },
      { symbol: 'MATIC', name: 'Polygon', coinGeckoId: 'matic-network' }
    ];

    res.json({
      status: 'success',
      message: 'Supported cryptocurrencies retrieved successfully',
      data: {
        currencies: supportedCurrencies,
        count: supportedCurrencies.length
      },
    });
  });

  /**
   * Get price alerts for user (placeholder for future implementation)
   */
  getPriceAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // This would be implemented with a price alerts system
    const alerts: any[] = []; // Placeholder

    res.json({
      status: 'success',
      message: 'Price alerts retrieved successfully',
      data: {
        alerts,
        count: alerts.length
      },
    });
  });

  /**
   * Create price alert (placeholder for future implementation)
   */
  createPriceAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { symbol, targetPrice, condition } = req.body;

    if (!symbol || !targetPrice || !condition) {
      throw new CustomError('Symbol, target price, and condition are required', 400);
    }

    // This would be implemented with a price alerts system
    logger.info(`Price alert creation requested by user ${userId} for ${symbol}`);

    res.json({
      status: 'success',
      message: 'Price alert created successfully (feature coming soon)',
      data: {
        symbol,
        targetPrice,
        condition,
        status: 'pending_implementation'
      },
    });
  });

  /**
   * Clear price cache (admin only)
   */
  clearPriceCache = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Check if user is admin
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new CustomError('Insufficient permissions', 403);
    }

    this.priceService.clearCache();

    res.json({
      status: 'success',
      message: 'Price cache cleared successfully',
      data: {
        clearedAt: new Date()
      },
    });
  });

  /**
   * Get price service statistics (admin only)
   */
  getPriceServiceStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Check if user is admin
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new CustomError('Insufficient permissions', 403);
    }

    // This would include cache hit rates, API call counts, etc.
    const stats = {
      cacheStatus: 'active',
      supportedCurrencies: 4,
      lastUpdate: new Date(),
      apiProvider: 'CoinGecko',
      updateInterval: '2 minutes'
    };

    res.json({
      status: 'success',
      message: 'Price service statistics retrieved successfully',
      data: stats,
    });
  });
}
