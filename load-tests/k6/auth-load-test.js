/**
 * k6 Load Test - Authentication Service HTTP Endpoints
 * 
 * Tests:
 * - POST /auth/sign-up - User registration
 * - POST /auth/sign-in - User authentication
 * 
 * Target: http://localhost:4001 (Auth Service)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  AUTH_SERVICE_URL: __ENV.AUTH_SERVICE_URL || 'http://localhost:4001',
  CHAT_SERVICE_URL: __ENV.CHAT_SERVICE_URL || 'http://localhost:4002',
  
  // Test stages configuration
  STAGES: {
    smoke: [
      { duration: '1m', target: 10 },
      { duration: '1m', target: 20 },
      { duration: '1m', target: 10 },
    ],
    load_1k: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 300 },
      { duration: '5m', target: 500 },
      { duration: '3m', target: 200 },
      { duration: '2m', target: 100 },
    ],
    load_5k: [
      { duration: '3m', target: 500 },
      { duration: '5m', target: 1500 },
      { duration: '7m', target: 2500 },
      { duration: '5m', target: 1000 },
      { duration: '3m', target: 500 },
    ],
    load_10k: [
      { duration: '5m', target: 1000 },
      { duration: '7m', target: 3000 },
      { duration: '10m', target: 5000 },
      { duration: '7m', target: 2000 },
      { duration: '5m', target: 1000 },
    ],
    stress: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 500 },
      { duration: '5m', target: 1000 },
      { duration: '10m', target: 2000 },
      { duration: '5m', target: 1000 },
      { duration: '5m', target: 500 },
      { duration: '2m', target: 100 },
    ],
    spike: [
      { duration: '1m', target: 100 },
      { duration: '30s', target: 2000 },
      { duration: '2m', target: 2000 },
      { duration: '30s', target: 100 },
      { duration: '2m', target: 100 },
    ]
  },
  
  // Thresholds
  THRESHOLDS: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.1'],
    signup_success_rate: ['rate>0.95'],
    signin_success_rate: ['rate>0.95'],
  }
};

// ============================================================================
// CUSTOM METRICS
// ============================================================================

// Response time trends
const signupResponseTime = new Trend('signup_response_time');
const signinResponseTime = new Trend('signin_response_time');

// Success rates
const signupSuccessRate = new Rate('signup_success_rate');
const signinSuccessRate = new Rate('signin_success_rate');

// Counters
const successfulSignups = new Counter('successful_signups');
const failedSignups = new Counter('failed_signups');
const successfulSignins = new Counter('successful_signins');
const failedSignins = new Counter('failed_signins');

// Active users gauge
const activeUsers = new Gauge('active_users');

// Message metrics (for coordination with WebSocket tests)
const tokensGenerated = new Counter('tokens_generated');

// ============================================================================
// k6 OPTIONS
// ============================================================================

// Get test type from environment variable
const TEST_TYPE = __ENV.TEST_TYPE || 'smoke';

export const options = {
  stages: CONFIG.STAGES[TEST_TYPE] || CONFIG.STAGES.smoke,
  thresholds: CONFIG.THRESHOLDS,
  
  // Cloud execution settings
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 },
      },
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique test user
 */
function generateTestUser() {
  const timestamp = Date.now();
  const random = randomIntBetween(1000, 9999);
  const uniqueId = `${timestamp}_${random}`;
  
  return {
    email: `k6_user_${uniqueId}@loadtest.local`,
    username: `k6_tester_${randomString(8)}`,
    password: `TestPass${randomIntBetween(100000, 999999)}!`,
  };
}

/**
 * Generate a valid CUID-like ID
 */
function generateUserId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cm';
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check HTTP response for common issues
 */
function checkResponse(response, expectedStatus, context) {
  const checks = {
    [`${context} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${context} response time < 5000ms`]: (r) => r.timings.duration < 5000,
    [`${context} no server error`]: (r) => r.status < 500,
  };
  
  return check(response, checks);
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test user registration (sign-up)
 */
function testSignUp() {
  const user = generateTestUser();
  const url = `${CONFIG.AUTH_SERVICE_URL}/auth/sign-up`;
  
  const payload = JSON.stringify({
    email: user.email,
    username: user.username,
    password: user.password,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    tags: {
      name: 'signup',
    },
  };
  
  const response = http.post(url, payload, params);
  
  // Record metrics
  signupResponseTime.add(response.timings.duration);
  
  // Check response
  const success = checkResponse(response, 201, 'signup') || 
                  check(response, {
                    'signup status is 200': (r) => r.status === 200,
                    'signup status is 409 (user exists)': (r) => r.status === 409,
                  });
  
  if (success) {
    signupSuccessRate.add(true);
    successfulSignups.add(1);
    
    // Store user data for potential sign-in test
    if (response.status === 201 || response.status === 200) {
      try {
        const responseData = JSON.parse(response.body);
        return {
          success: true,
          user: {
            ...user,
            id: responseData.id || generateUserId(),
          },
        };
      } catch (e) {
        return { success: true, user };
      }
    }
  } else {
    signupSuccessRate.add(false);
    failedSignups.add(1);
  }
  
  return { success: false, user: null };
}

/**
 * Test user authentication (sign-in)
 */
function testSignIn(user = null) {
  // Generate a user if not provided
  const testUser = user || generateTestUser();
  
  const url = `${CONFIG.AUTH_SERVICE_URL}/auth/sign-in`;
  
  const payload = JSON.stringify({
    email: testUser.email,
    password: testUser.password,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    tags: {
      name: 'signin',
    },
  };
  
  const response = http.post(url, payload, params);
  
  // Record metrics
  signinResponseTime.add(response.timings.duration);
  
  // Check response
  const success = checkResponse(response, 200, 'signin') ||
                  check(response, {
                    'signin returns token': (r) => {
                      try {
                        const body = JSON.parse(r.body);
                        return body.token && body.token.length > 0;
                      } catch (e) {
                        return false;
                      }
                    },
                    'signin returns user id': (r) => {
                      try {
                        const body = JSON.parse(r.body);
                        return body.uid && body.uid.length > 0;
                      } catch (e) {
                        return false;
                      }
                    },
                  });
  
  if (success) {
    signinSuccessRate.add(true);
    successfulSignins.add(1);
    
    try {
      const responseData = JSON.parse(response.body);
      tokensGenerated.add(1);
      
      return {
        success: true,
        token: responseData.token,
        userId: responseData.uid,
        username: responseData.message,
      };
    } catch (e) {
      return { success: true };
    }
  } else {
    signinSuccessRate.add(false);
    failedSignins.add(1);
    
    return { success: false };
  }
}

/**
 * Test health check endpoint (if available)
 */
function testHealthCheck() {
  const url = `${CONFIG.AUTH_SERVICE_URL}/health`;
  
  const response = http.get(url, {
    tags: { name: 'health_check' },
  });
  
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

// ============================================================================
// SETUP AND TEARDOWN
// ============================================================================

/**
 * Setup function - runs once at the beginning
 */
export function setup() {
  console.log(`Starting k6 ${TEST_TYPE} test on Auth Service`);
  console.log(`Target URL: ${CONFIG.AUTH_SERVICE_URL}`);
  console.log(`Stages: ${JSON.stringify(options.stages)}`);
  
  // Perform a quick health check
  testHealthCheck();
  
  return {
    testType: TEST_TYPE,
    startTime: new Date().toISOString(),
  };
}

/**
 * Teardown function - runs once at the end
 */
export function teardown(data) {
  console.log(`\nTest completed: ${data.testType}`);
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}

// ============================================================================
// MAIN TEST SCENARIO
// ============================================================================

export default function () {
  // Update active users gauge
  activeUsers.add(__VU);
  
  group('Authentication Flow', () => {
    // Scenario 1: Sign up new user (40% of requests)
    if (Math.random() < 0.4) {
      const signupResult = testSignUp();
      
      // If signup succeeded, try to sign in (30% of successful signups)
      if (signupResult.success && Math.random() < 0.3) {
        sleep(randomIntBetween(1, 3));
        testSignIn(signupResult.user);
      }
    }
    
    // Scenario 2: Sign in existing user (50% of requests)
    else if (Math.random() < 0.5) {
      testSignIn();
    }
    
    // Scenario 3: Sign up then immediately sign in (10% of requests)
    else {
      const signupResult = testSignUp();
      if (signupResult.success) {
        sleep(randomIntBetween(1, 2));
        testSignIn(signupResult.user);
      }
    }
  });
  
  // Random sleep between iterations to simulate realistic user behavior
  sleep(randomIntBetween(1, 5));
}
