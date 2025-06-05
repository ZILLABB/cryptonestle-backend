#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Setting up Cryptonestle Backend...\n');

// Generate random secrets
const generateSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Skipping environment setup.');
  console.log('   If you want to regenerate, delete .env and run this script again.\n');
} else {
  console.log('📝 Creating .env file from template...');
  
  // Read .env.example
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Replace placeholder values with generated secrets
  envContent = envContent.replace(
    'your-super-secret-jwt-key-here',
    generateSecret(32)
  );
  envContent = envContent.replace(
    'your-refresh-token-secret-here',
    generateSecret(32)
  );
  envContent = envContent.replace(
    'secure-admin-password',
    generateSecret(16)
  );
  
  // Write .env file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!\n');
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('📁 Created logs directory');
}

// Create .gitkeep files for empty directories
const dirsToKeep = ['logs'];
dirsToKeep.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  const gitkeepPath = path.join(dirPath, '.gitkeep');
  
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '');
    console.log(`📁 Created .gitkeep in ${dir} directory`);
  }
});

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Update the .env file with your actual configuration values');
console.log('2. Set up your PostgreSQL database');
console.log('3. Set up your Redis server');
console.log('4. Run: npm run prisma:migrate');
console.log('5. Run: npm run prisma:seed');
console.log('6. Run: npm run dev');
console.log('\n📚 For detailed instructions, see README.md');
console.log('\n🔐 Important: Update the following in your .env file:');
console.log('   - DATABASE_URL (PostgreSQL connection string)');
console.log('   - REDIS_URL (Redis connection string)');
console.log('   - SMTP_* (Email configuration)');
console.log('   - ETH_RPC_URL and other blockchain settings');
console.log('   - ADMIN_EMAIL and ADMIN_PASSWORD');
console.log('\n⚠️  Security reminder:');
console.log('   - Never commit your .env file to version control');
console.log('   - Use strong passwords and secrets in production');
console.log('   - Keep your private keys secure');
console.log('   - Enable HTTPS in production\n');
