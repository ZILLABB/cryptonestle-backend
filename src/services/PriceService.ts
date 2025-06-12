import axios from 'axios';
import { logger } from '../utils/logger';

export interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: Date;
}

export interface PortfolioValue {
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  profitPercentage: number;
  breakdown: {
    [currency: string]: {
      amount: number;
      value: number;
      price: number;
    };
  };
}

export interface PriceHistory {
  timestamp: number;
  price: number;
}

export class PriceService {
  private cache: Map<string, { data: CryptoPrice; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute cache
  private readonly SUPPORTED_CURRENCIES = ['ethereum', 'bitcoin', 'binancecoin', 'matic-network'];
  
  // API endpoints
  private readonly COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
  private readonly COINMARKETCAP_BASE = 'https://pro-api.coinmarketcap.com/v1';
  
  constructor() {
    // Start price update interval
    this.startPriceUpdateInterval();
  }

  /**
   * Get current prices for supported cryptocurrencies
   */
  async getCurrentPrices(): Promise<CryptoPrice[]> {
    try {
      // Check cache first
      const cachedPrices = this.getCachedPrices();
      if (cachedPrices.length > 0) {
        return cachedPrices;
      }

      // Fetch from API
      const prices = await this.fetchPricesFromAPI();
      
      // Cache the results
      prices.forEach(price => {
        this.cache.set(price.symbol.toLowerCase(), {
          data: price,
          expiry: Date.now() + this.CACHE_DURATION
        });
      });

      return prices;
    } catch (error) {
      logger.error('Error getting current prices:', error);
      
      // Return cached data even if expired as fallback
      return this.getCachedPrices(true);
    }
  }

  /**
   * Get price for a specific cryptocurrency
   */
  async getPrice(symbol: string): Promise<CryptoPrice | null> {
    try {
      const prices = await this.getCurrentPrices();
      return prices.find(p => p.symbol.toLowerCase() === symbol.toLowerCase()) || null;
    } catch (error) {
      logger.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate portfolio value for a user
   */
  async getPortfolioValue(userId: string): Promise<PortfolioValue> {
    try {
      const { prisma } = await import('../index');
      
      // Get user's investments
      const investments = await prisma.investment.findMany({
        where: {
          userId,
          status: { in: ['ACTIVE', 'COMPLETED'] }
        },
        include: {
          plan: true
        }
      });

      // Get current prices
      const prices = await this.getCurrentPrices();
      const ethPrice = prices.find(p => p.symbol.toLowerCase() === 'eth')?.price || 0;

      let totalInvested = 0;
      let totalCurrentValue = 0;
      const breakdown: PortfolioValue['breakdown'] = {};

      for (const investment of investments) {
        const currency = investment.currency.toLowerCase();
        const amount = investment.amount;
        const currentPrice = currency === 'eth' ? ethPrice : 
          prices.find(p => p.symbol.toLowerCase() === currency)?.price || 0;

        totalInvested += amount * ethPrice; // Convert to USD for comparison
        
        if (investment.status === 'COMPLETED' && investment.actualReturn) {
          totalCurrentValue += investment.actualReturn * ethPrice;
        } else if (investment.status === 'ACTIVE') {
          // Calculate current expected value
          const expectedReturn = investment.expectedReturn || amount;
          totalCurrentValue += expectedReturn * ethPrice;
        }

        // Add to breakdown
        if (!breakdown[currency]) {
          breakdown[currency] = { amount: 0, value: 0, price: currentPrice };
        }
        breakdown[currency].amount += amount;
        breakdown[currency].value += amount * currentPrice;
      }

      const totalProfit = totalCurrentValue - totalInvested;
      const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

      return {
        totalValue: totalCurrentValue,
        totalInvested,
        totalProfit,
        profitPercentage,
        breakdown
      };
    } catch (error) {
      logger.error('Error calculating portfolio value:', error);
      return {
        totalValue: 0,
        totalInvested: 0,
        totalProfit: 0,
        profitPercentage: 0,
        breakdown: {}
      };
    }
  }

  /**
   * Get price history for a cryptocurrency
   */
  async getPriceHistory(symbol: string, days: number = 7): Promise<PriceHistory[]> {
    try {
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) {
        throw new Error(`Unsupported cryptocurrency: ${symbol}`);
      }

      const response = await axios.get(
        `${this.COINGECKO_BASE}/coins/${coinId}/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days: days,
            interval: days <= 1 ? 'hourly' : 'daily'
          },
          headers: this.getAPIHeaders('coingecko')
        }
      );

      return response.data.prices.map(([timestamp, price]: [number, number]) => ({
        timestamp,
        price
      }));
    } catch (error) {
      logger.error(`Error getting price history for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Fetch prices from API (CoinGecko primary, CoinMarketCap fallback)
   */
  private async fetchPricesFromAPI(): Promise<CryptoPrice[]> {
    try {
      // Try CoinGecko first
      return await this.fetchFromCoinGecko();
    } catch (error) {
      logger.warn('CoinGecko API failed, trying CoinMarketCap:', error);
      
      try {
        return await this.fetchFromCoinMarketCap();
      } catch (fallbackError) {
        logger.error('All price APIs failed:', fallbackError);
        throw new Error('Unable to fetch cryptocurrency prices');
      }
    }
  }

  /**
   * Fetch prices from CoinGecko API
   */
  private async fetchFromCoinGecko(): Promise<CryptoPrice[]> {
    const response = await axios.get(
      `${this.COINGECKO_BASE}/simple/price`,
      {
        params: {
          ids: this.SUPPORTED_CURRENCIES.join(','),
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true,
          include_market_cap: true,
          include_last_updated_at: true
        },
        headers: this.getAPIHeaders('coingecko'),
        timeout: 10000
      }
    );

    return this.SUPPORTED_CURRENCIES.map(coinId => {
      const data = response.data[coinId];
      if (!data) return null;

      return {
        symbol: this.getSymbolFromCoinId(coinId),
        name: this.getNameFromCoinId(coinId),
        price: data.usd || 0,
        priceChange24h: data.usd_24h_change || 0,
        priceChangePercentage24h: data.usd_24h_change || 0,
        marketCap: data.usd_market_cap || 0,
        volume24h: data.usd_24h_vol || 0,
        lastUpdated: new Date(data.last_updated_at * 1000 || Date.now())
      };
    }).filter(Boolean) as CryptoPrice[];
  }

  /**
   * Fetch prices from CoinMarketCap API (fallback)
   */
  private async fetchFromCoinMarketCap(): Promise<CryptoPrice[]> {
    if (!process.env.COINMARKETCAP_API_KEY) {
      throw new Error('CoinMarketCap API key not configured');
    }

    const symbols = ['ETH', 'BTC', 'BNB', 'MATIC'];
    const response = await axios.get(
      `${this.COINMARKETCAP_BASE}/cryptocurrency/quotes/latest`,
      {
        params: {
          symbol: symbols.join(','),
          convert: 'USD'
        },
        headers: this.getAPIHeaders('coinmarketcap'),
        timeout: 10000
      }
    );

    return symbols.map(symbol => {
      const data = response.data.data[symbol];
      if (!data) return null;

      const quote = data.quote.USD;
      return {
        symbol: symbol,
        name: data.name,
        price: quote.price || 0,
        priceChange24h: quote.percent_change_24h || 0,
        priceChangePercentage24h: quote.percent_change_24h || 0,
        marketCap: quote.market_cap || 0,
        volume24h: quote.volume_24h || 0,
        lastUpdated: new Date(quote.last_updated || Date.now())
      };
    }).filter(Boolean) as CryptoPrice[];
  }

  /**
   * Get cached prices
   */
  private getCachedPrices(includeExpired: boolean = false): CryptoPrice[] {
    const now = Date.now();
    const prices: CryptoPrice[] = [];

    for (const [symbol, cached] of this.cache.entries()) {
      if (includeExpired || cached.expiry > now) {
        prices.push(cached.data);
      }
    }

    return prices;
  }

  /**
   * Start automatic price update interval
   */
  private startPriceUpdateInterval(): void {
    // Update prices every 2 minutes
    setInterval(async () => {
      try {
        await this.getCurrentPrices();
        logger.info('Price cache updated successfully');
      } catch (error) {
        logger.error('Failed to update price cache:', error);
      }
    }, 120000); // 2 minutes
  }

  /**
   * Get API headers for different services
   */
  private getAPIHeaders(service: 'coingecko' | 'coinmarketcap'): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Cryptonestle/1.0'
    };

    if (service === 'coingecko' && process.env.COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
    } else if (service === 'coinmarketcap' && process.env.COINMARKETCAP_API_KEY) {
      headers['X-CMC_PRO_API_KEY'] = process.env.COINMARKETCAP_API_KEY;
    }

    return headers;
  }

  /**
   * Helper methods for currency mapping
   */
  private getCoinGeckoId(symbol: string): string | null {
    const mapping: Record<string, string> = {
      'eth': 'ethereum',
      'btc': 'bitcoin',
      'bnb': 'binancecoin',
      'matic': 'matic-network'
    };
    return mapping[symbol.toLowerCase()] || null;
  }

  private getSymbolFromCoinId(coinId: string): string {
    const mapping: Record<string, string> = {
      'ethereum': 'ETH',
      'bitcoin': 'BTC',
      'binancecoin': 'BNB',
      'matic-network': 'MATIC'
    };
    return mapping[coinId] || coinId.toUpperCase();
  }

  private getNameFromCoinId(coinId: string): string {
    const mapping: Record<string, string> = {
      'ethereum': 'Ethereum',
      'bitcoin': 'Bitcoin',
      'binancecoin': 'BNB',
      'matic-network': 'Polygon'
    };
    return mapping[coinId] || coinId;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
