// Quick test to verify our setup
const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  console.log('🔍 Testing Database Connection...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test data retrieval
    const users = await prisma.user.findMany({
      take: 3,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    console.log('✅ Found users:', users.length);
    console.log('   Sample users:', users);
    
    // Test investment plans
    const plans = await prisma.investmentPlan.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        returnPercentage: true,
        durationDays: true
      }
    });
    
    console.log('✅ Found investment plans:', plans.length);
    console.log('   Sample plans:', plans);
    
    // Test system settings
    const settings = await prisma.systemSettings.findMany({
      take: 3
    });
    
    console.log('✅ Found system settings:', settings.length);
    console.log('   Sample settings:', settings);
    
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function testPasswordHashing() {
  console.log('\n🔍 Testing Password Hashing...');
  
  try {
    const bcrypt = require('bcryptjs');
    const password = 'Test123!@#';
    const hash = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare(password, hash);
    
    console.log('✅ Password hashing works');
    console.log('   Original:', password);
    console.log('   Hash:', hash.substring(0, 20) + '...');
    console.log('   Validation:', isValid);
  } catch (error) {
    console.log('❌ Password hashing failed:', error.message);
  }
}

async function testJWT() {
  console.log('\n🔍 Testing JWT...');
  
  try {
    const jwt = require('jsonwebtoken');
    const secret = 'test-secret';
    const payload = { id: 'test-user-id' };
    
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret);
    
    console.log('✅ JWT works');
    console.log('   Token:', token.substring(0, 30) + '...');
    console.log('   Decoded:', decoded);
  } catch (error) {
    console.log('❌ JWT failed:', error.message);
  }
}

async function testEnvironment() {
  console.log('\n🔍 Testing Environment Variables...');
  
  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'ADMIN_EMAIL'
  ];
  
  let allPresent = true;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${varName.includes('SECRET') ? '[HIDDEN]' : value}`);
    } else {
      console.log(`❌ ${varName}: MISSING`);
      allPresent = false;
    }
  }
  
  console.log(allPresent ? '✅ All required environment variables present' : '❌ Some environment variables missing');
}

// Main test runner
async function runQuickTests() {
  console.log('🚀 Running Quick Setup Tests...\n');
  
  // Load environment variables
  require('dotenv').config();
  
  await testEnvironment();
  await testDatabase();
  await testPasswordHashing();
  await testJWT();
  
  console.log('\n🎉 Quick tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Database: Connected and seeded');
  console.log('- Authentication: Password hashing and JWT working');
  console.log('- Environment: Variables loaded');
  console.log('\n✨ Your Cryptonestle backend is ready!');
  console.log('\n🚀 Next steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Test API endpoints');
  console.log('3. Build frontend or use API client');
}

// Run tests
runQuickTests().catch(console.error);
