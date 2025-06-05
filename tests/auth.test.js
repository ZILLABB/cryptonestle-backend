"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../src/index"));
describe('Authentication', () => {
    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Test123!@#',
                firstName: 'Test',
                lastName: 'User',
            };
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);
            expect(response.body.status).toBe('success');
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.body.data.refreshToken).toBeDefined();
        });
        it('should not register user with invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'Test123!@#',
                firstName: 'Test',
                lastName: 'User',
            };
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400);
            expect(response.body.status).toBe('error');
        });
        it('should not register user with weak password', async () => {
            const userData = {
                email: 'test2@example.com',
                password: '123',
                firstName: 'Test',
                lastName: 'User',
            };
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400);
            expect(response.body.status).toBe('error');
        });
        it('should not register user with duplicate email', async () => {
            const userData = {
                email: 'duplicate@example.com',
                password: 'Test123!@#',
                firstName: 'Test',
                lastName: 'User',
            };
            // First registration
            await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);
            // Second registration with same email
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(409);
            expect(response.body.status).toBe('error');
        });
    });
    describe('POST /api/v1/auth/login', () => {
        beforeEach(async () => {
            // Create a test user
            await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/register')
                .send({
                email: 'login@example.com',
                password: 'Test123!@#',
                firstName: 'Login',
                lastName: 'User',
            });
        });
        it('should login user with valid credentials', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/login')
                .send({
                email: 'login@example.com',
                password: 'Test123!@#',
            })
                .expect(200);
            expect(response.body.status).toBe('success');
            expect(response.body.data.user.email).toBe('login@example.com');
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.body.data.refreshToken).toBeDefined();
        });
        it('should not login user with invalid email', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/login')
                .send({
                email: 'nonexistent@example.com',
                password: 'Test123!@#',
            })
                .expect(401);
            expect(response.body.status).toBe('error');
        });
        it('should not login user with invalid password', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/login')
                .send({
                email: 'login@example.com',
                password: 'wrongpassword',
            })
                .expect(401);
            expect(response.body.status).toBe('error');
        });
    });
    describe('GET /api/v1/users/profile', () => {
        let accessToken;
        beforeEach(async () => {
            // Register and login to get access token
            const registerResponse = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/auth/register')
                .send({
                email: 'profile@example.com',
                password: 'Test123!@#',
                firstName: 'Profile',
                lastName: 'User',
            });
            accessToken = registerResponse.body.data.accessToken;
        });
        it('should get user profile with valid token', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get('/api/v1/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);
            expect(response.body.status).toBe('success');
            expect(response.body.data.user.email).toBe('profile@example.com');
        });
        it('should not get user profile without token', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get('/api/v1/users/profile')
                .expect(401);
            expect(response.body.status).toBe('error');
        });
        it('should not get user profile with invalid token', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get('/api/v1/users/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
            expect(response.body.status).toBe('error');
        });
    });
});
