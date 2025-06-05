# 🚀 Cryptonestle - Crypto Investment Platform Backend

A comprehensive cryptocurrency investment platform backend built with Node.js, TypeScript, and modern blockchain technologies.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication
- Wallet-based login (MetaMask integration)
- Two-factor authentication (2FA)
- Password reset functionality
- Email verification
- Rate limiting and security headers

### 💰 Investment Management
- Multiple investment plans with different ROI rates
- Automated investment tracking
- Maturity date calculations
- Investment history and analytics
- Real-time portfolio monitoring

### 🔗 Blockchain Integration
- Multi-chain support (Ethereum, BSC, Polygon)
- Transaction monitoring and confirmation
- Automated deposit verification
- Smart contract integration ready
- Gas fee estimation

### 💸 Withdrawal System
- Secure withdrawal requests
- Admin approval workflow
- Automated transaction processing
- Withdrawal history tracking
- Multi-currency support

### 👥 User Management
- User profiles and KYC verification
- Referral system with bonuses
- Notification system
- Activity logging
- Role-based access control

### 🛠 Admin Panel
- Comprehensive dashboard
- User management
- Investment plan management
- Transaction monitoring
- System settings configuration
- Analytics and reporting

## 🛠 Tech Stack

- **Runtime**: Node.js 16+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Queue**: Bull (Redis-based)
- **Blockchain**: Ethers.js
- **Authentication**: JWT
- **Email**: Nodemailer
- **Logging**: Winston
- **Testing**: Jest
- **Validation**: Express Validator
- **Security**: Helmet, bcrypt, speakeasy

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Redis (v6 or higher)
- npm or yarn package manager

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/cryptonestle-backend.git
   cd cryptonestle-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```

## ⚙️ Configuration

Edit the `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/cryptonestle_db"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Blockchain Configuration
ETH_RPC_URL=https://mainnet.infura.io/v3/your-infura-project-id
ETH_PRIVATE_KEY=your-private-key-here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🗄️ Database Setup

1. **Create PostgreSQL database**
   ```sql
   CREATE DATABASE cryptonestle_db;
   ```

2. **Generate Prisma client**
   ```bash
   npm run prisma:generate
   ```

3. **Run database migrations**
   ```bash
   npm run prisma:migrate
   ```

4. **Seed the database**
   ```bash
   npm run prisma:seed
   ```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Available Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed database with initial data

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/wallet-login` - Wallet-based login
- `POST /auth/logout` - User logout
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `POST /auth/verify-email` - Verify email address

### Investment Endpoints
- `GET /investments/plans` - Get investment plans
- `POST /investments` - Create new investment
- `GET /investments` - Get user investments
- `GET /investments/:id` - Get specific investment

### User Endpoints
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `GET /users/dashboard` - Get dashboard data
- `GET /users/transactions` - Get user transactions

### Admin Endpoints
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/users` - Manage users
- `POST /admin/investment-plans` - Create investment plan
- `GET /admin/withdrawals` - Manage withdrawals

## 📁 Project Structure

```
cryptonestle-backend/
├── src/
│   ├── controllers/          # Route controllers
│   ├── middleware/           # Custom middleware
│   ├── routes/              # API routes
│   ├── services/            # Business logic services
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript type definitions
│   └── index.ts             # Application entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Database seeding
├── tests/                   # Test files
├── logs/                    # Application logs
├── dist/                    # Compiled JavaScript (production)
└── docs/                    # Documentation
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## 🚀 Deployment

### Using Docker

1. **Build Docker image**
   ```bash
   docker build -t cryptonestle-backend .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**

3. **Run database migrations**
   ```bash
   npm run prisma:migrate
   ```

4. **Start the application**
   ```bash
   npm start
   ```

## 🔒 Security Considerations

- Always use HTTPS in production
- Keep private keys secure and never commit them
- Regularly update dependencies
- Implement proper rate limiting
- Use strong JWT secrets
- Enable 2FA for admin accounts
- Regular security audits

## 📈 Monitoring & Logging

- Application logs are stored in the `logs/` directory
- Use Winston for structured logging
- Monitor queue performance with Bull Dashboard
- Set up alerts for failed transactions
- Track API performance and errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Email: support@cryptonestle.com
- Documentation: [docs.cryptonestle.com](https://docs.cryptonestle.com)

## 🙏 Acknowledgments

- Ethereum Foundation for blockchain infrastructure
- Prisma team for the excellent ORM
- Express.js community
- All contributors and supporters

---

**⚠️ Disclaimer**: This is a cryptocurrency investment platform. Please ensure compliance with local regulations and implement proper security measures before deploying to production.
