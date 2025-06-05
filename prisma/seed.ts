import { PrismaClient, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!@#', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@cryptonestle.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@cryptonestle.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      isEmailVerified: true,
      referralCode: 'ADMIN001',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create sample investment plans
  const investmentPlans = [
    {
      name: 'Starter Plan',
      description: 'Perfect for beginners looking to start their crypto investment journey',
      durationDays: 7,
      returnPercentage: 5.0,
      minAmount: 0.01,
      maxAmount: 1.0,
      isActive: true,
    },
    {
      name: 'Growth Plan',
      description: 'Ideal for investors seeking moderate returns with balanced risk',
      durationDays: 14,
      returnPercentage: 12.0,
      minAmount: 0.1,
      maxAmount: 5.0,
      isActive: true,
    },
    {
      name: 'Premium Plan',
      description: 'High-yield investment plan for experienced investors',
      durationDays: 30,
      returnPercentage: 25.0,
      minAmount: 1.0,
      maxAmount: 10.0,
      isActive: true,
    },
    {
      name: 'Elite Plan',
      description: 'Exclusive plan with maximum returns for elite investors',
      durationDays: 60,
      returnPercentage: 50.0,
      minAmount: 5.0,
      maxAmount: 50.0,
      isActive: true,
    },
    {
      name: 'Diamond Plan',
      description: 'Ultimate investment plan with the highest returns',
      durationDays: 90,
      returnPercentage: 100.0,
      minAmount: 10.0,
      maxAmount: 100.0,
      isActive: true,
    },
  ];

  for (const plan of investmentPlans) {
    const existingPlan = await prisma.investmentPlan.findFirst({
      where: { name: plan.name },
    });

    if (!existingPlan) {
      const createdPlan = await prisma.investmentPlan.create({
        data: plan,
      });
      console.log('✅ Investment plan created:', createdPlan.name);
    } else {
      console.log('⏭️ Investment plan already exists:', plan.name);
    }
  }

  // Create sample demo users
  const demoUsers = [
    {
      email: 'demo1@cryptonestle.com',
      password: await bcrypt.hash('Demo123!@#', 12),
      firstName: 'John',
      lastName: 'Doe',
      walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d4d4',
      isEmailVerified: true,
      referralCode: 'DEMO001',
    },
    {
      email: 'demo2@cryptonestle.com',
      password: await bcrypt.hash('Demo123!@#', 12),
      firstName: 'Jane',
      lastName: 'Smith',
      walletAddress: '0x8ba1f109551bD432803012645Hac136c22C177e9',
      isEmailVerified: true,
      referralCode: 'DEMO002',
    },
    {
      email: 'demo3@cryptonestle.com',
      password: await bcrypt.hash('Demo123!@#', 12),
      firstName: 'Mike',
      lastName: 'Johnson',
      walletAddress: '0x1234567890123456789012345678901234567890',
      isEmailVerified: true,
      referralCode: 'DEMO003',
    },
  ];

  for (const user of demoUsers) {
    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
    console.log('✅ Demo user created:', createdUser.email);
  }

  // Create system settings
  const systemSettings = [
    {
      key: 'PLATFORM_FEE_PERCENTAGE',
      value: '2.5',
      description: 'Platform fee percentage for investments',
    },
    {
      key: 'MIN_WITHDRAWAL_AMOUNT',
      value: '0.001',
      description: 'Minimum withdrawal amount in ETH',
    },
    {
      key: 'MAX_WITHDRAWAL_AMOUNT',
      value: '100',
      description: 'Maximum withdrawal amount in ETH',
    },
    {
      key: 'WITHDRAWAL_FEE_PERCENTAGE',
      value: '1.0',
      description: 'Withdrawal fee percentage',
    },
    {
      key: 'REFERRAL_BONUS_PERCENTAGE',
      value: '5.0',
      description: 'Referral bonus percentage',
    },
    {
      key: 'EMAIL_NOTIFICATIONS_ENABLED',
      value: 'true',
      description: 'Enable email notifications',
    },
    {
      key: 'MAINTENANCE_MODE',
      value: 'false',
      description: 'Enable maintenance mode',
    },
    {
      key: 'REGISTRATION_ENABLED',
      value: 'true',
      description: 'Enable user registration',
    },
    {
      key: 'KYC_REQUIRED',
      value: 'false',
      description: 'Require KYC verification',
    },
    {
      key: 'TWO_FACTOR_REQUIRED',
      value: 'false',
      description: 'Require two-factor authentication',
    },
  ];

  for (const setting of systemSettings) {
    const createdSetting = await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
    console.log('✅ System setting created:', createdSetting.key);
  }

  // Create sample notifications for admin
  const notifications = [
    {
      userId: admin.id,
      title: 'Welcome to Cryptonestle',
      message: 'Welcome to the Cryptonestle admin panel. Your platform is ready to go!',
      type: NotificationType.SYSTEM,
    },
    {
      userId: admin.id,
      title: 'Platform Setup Complete',
      message: 'All initial setup has been completed. You can now start managing investments.',
      type: NotificationType.SYSTEM,
    },
  ];

  for (const notification of notifications) {
    const createdNotification = await prisma.notification.create({
      data: notification,
    });
    console.log('✅ Notification created:', createdNotification.title);
  }

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`- Admin user: ${admin.email}`);
  console.log(`- Investment plans: ${investmentPlans.length}`);
  console.log(`- Demo users: ${demoUsers.length}`);
  console.log(`- System settings: ${systemSettings.length}`);
  console.log(`- Notifications: ${notifications.length}`);
  console.log('\n🔐 Default Credentials:');
  console.log(`Admin: ${admin.email} / ${process.env.ADMIN_PASSWORD || 'Admin123!@#'}`);
  console.log('Demo users: demo1@cryptonestle.com / Demo123!@#');
  console.log('Demo users: demo2@cryptonestle.com / Demo123!@#');
  console.log('Demo users: demo3@cryptonestle.com / Demo123!@#');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
