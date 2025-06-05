const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('🔍 Testing Health Check...');
  try {
    const response = await makeRequest(`${BASE_URL}/health`);
    console.log('✅ Health Check:', response.status === 200 ? 'PASSED' : 'FAILED');
    console.log('   Response:', response.data);
  } catch (error) {
    console.log('❌ Health Check: FAILED');
    console.log('   Error:', error.message);
  }
}

async function testWelcomeRoute() {
  console.log('\n🔍 Testing Welcome Route...');
  try {
    const response = await makeRequest(BASE_URL);
    console.log('✅ Welcome Route:', response.status === 200 ? 'PASSED' : 'FAILED');
    console.log('   Response:', response.data);
  } catch (error) {
    console.log('❌ Welcome Route: FAILED');
    console.log('   Error:', error.message);
  }
}

async function testInvestmentPlans() {
  console.log('\n🔍 Testing Investment Plans...');
  try {
    const response = await makeRequest(`${API_BASE}/investments/plans`);
    console.log('✅ Investment Plans:', response.status === 200 ? 'PASSED' : 'FAILED');
    console.log('   Response:', response.data);
  } catch (error) {
    console.log('❌ Investment Plans: FAILED');
    console.log('   Error:', error.message);
  }
}

async function testUserRegistration() {
  console.log('\n🔍 Testing User Registration...');
  try {
    const userData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'User'
    };

    const response = await makeRequest(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: userData
    });

    console.log('✅ User Registration:', response.status === 201 ? 'PASSED' : 'FAILED');
    console.log('   Status:', response.status);
    console.log('   Response:', response.data);
    
    return response.data?.data?.accessToken;
  } catch (error) {
    console.log('❌ User Registration: FAILED');
    console.log('   Error:', error.message);
    return null;
  }
}

async function testUserLogin() {
  console.log('\n🔍 Testing User Login...');
  try {
    const loginData = {
      email: 'demo1@cryptonestle.com',
      password: 'Demo123!@#'
    };

    const response = await makeRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: loginData
    });

    console.log('✅ User Login:', response.status === 200 ? 'PASSED' : 'FAILED');
    console.log('   Status:', response.status);
    console.log('   Response:', response.data);
    
    return response.data?.data?.accessToken;
  } catch (error) {
    console.log('❌ User Login: FAILED');
    console.log('   Error:', error.message);
    return null;
  }
}

async function testProtectedRoute(token) {
  if (!token) {
    console.log('\n⏭️ Skipping Protected Route Test (no token)');
    return;
  }

  console.log('\n🔍 Testing Protected Route (User Profile)...');
  try {
    const response = await makeRequest(`${API_BASE}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    console.log('✅ Protected Route:', response.status === 200 ? 'PASSED' : 'FAILED');
    console.log('   Status:', response.status);
    console.log('   Response:', response.data);
  } catch (error) {
    console.log('❌ Protected Route: FAILED');
    console.log('   Error:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Cryptonestle API Tests...\n');
  
  // Wait a moment for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testHealthCheck();
  await testWelcomeRoute();
  await testInvestmentPlans();
  
  // Test authentication
  const registerToken = await testUserRegistration();
  const loginToken = await testUserLogin();
  
  // Test protected routes
  await testProtectedRoute(loginToken || registerToken);
  
  console.log('\n🎉 API Tests Completed!');
}

// Run tests
runTests().catch(console.error);
