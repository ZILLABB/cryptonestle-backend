"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Global test setup
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/cryptonestle_test',
        },
    },
});
exports.prisma = prisma;
// Setup before all tests
beforeAll(async () => {
    // Connect to test database
    await prisma.$connect();
    // Clean up database
    await cleanDatabase();
});
// Cleanup after all tests
afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
});
// Clean database function
async function cleanDatabase() {
    const tablenames = await prisma.$queryRaw `SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');
    try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
    catch (error) {
        console.log({ error });
    }
}
