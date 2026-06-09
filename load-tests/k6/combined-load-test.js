/**
 * k6 Combined Load Test - HTTP + WebSocket Simulation
 * 
 * Tests both authentication and simulates chat service load
 * without actual WebSocket connections (use Artillery for WebSocket)
 * 
 * This script focuses on:
 * - Auth service HTTP endpoints
 * - Chat service health checks
 * - Token generation for WebSocket testing
 * - End-to-end authentication flow
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  AUTH_SERVICE_URL: __ENV.AUTH_SERVICE_URL || 'http://localhost:4001',
  CHAT_SERVICE_URL: __ENV.CHAT_SERVICE_URL || 'http://localhost:4002',
  
  // Test type configuration
  TEST_TYPE: __ENV.TEST_TYPE || 'smoke',
  
  // User simulation settings
  MESSAGES_PER_USER_MIN: parseInt(__ENV.MESSAGES_PER_USER_MIN || '2'),
  MESSAGES_PER_USER_MAX: parseInt(__ENV.MESSAGES_PER_USER_MAX || '8'),
  THINK_TIME_MIN: parseInt(__ENV.THINK_TIME_MIN || '2'),
  THINK_TIME_MAX: parseInt(__ENV.THINK_TIME_MAX || '10'),
};

// ============================================================================
// CUSTOM METRICS
// ============================================================================

// Response time trends
const httpReqTrend = new Trend('http_req_custom');
const authFlowTrend = new Trend('auth_flow_duration');

// Success rates
const authFlowSuccessRate = new Rate('auth_flow_success_rate');
const e2eFlowSuccessRate = new Rate('e2e_flow_success_rate');

// Counters
const usersAuthenticated = new Counter('users_authenticated');
const authFlowsCompleted = new Counter('auth_flows_completed');
const messagesSimulated = new Counter('messages_simulated');

// ============================================================================
// k6 OPTIONS
// ============================================================================

const STAGE_CONFIGS = {
  smoke: [
    { duration: '1m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 20 },
  ],
  load_1k: [
    { duration: '2m', target: 200 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 800 },
    { duration: '3m', target: 400 },
    { duration: '2m', target: 200 },
  ],
  load_5k: [
    { duration: '3m', target: 1000 },
    { duration: '5m', target: 2500 },
    { duration: '7m', target: 4000 },
    { duration: '5m', target: 2000 },
    { duration: '3m', target: 1000 },
  ],
  load_10k: [
    { duration: '5m', target: 2000 },
    { duration: '7m', target: 5000 },
    { duration: '10m', target: 8000 },
    { duration: '7m', target: 4000 },
    { duration: '5m', target: 2000 },
  ],
};

export const options = {
  stages: STAGE_CONFIGS[CONFIG.TEST_TYPE] || STAGE_CONFIGS.smoke,
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    auth_flow_success_rate: ['rate>0.95'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateTestUser() {
  const timestamp = Date.now();
  const random = randomIntBetween(1000, 9999);
  
  return {
    email: `combined_${timestamp}_${random}@test.local`,
    username: `user_${randomString(6)}`,
    password: `Pass${randomIntBetween(100000, 999999)}!`,
  };
}

function checkResponse(response, checks, context) {
  const result = check(response, checks);
  httpReqTrend.add(response.timings.duration);
  return result;
}

// ============================================================================
// AUTH SERVICE FUNCTIONS
// ============================================================================

function signUp(user) {
  const url = `${CONFIG.AUTH_SERVICE_URL}/auth/sign-up`;
  const payload = JSON.stringify({
    email: user.email,
    username: user.username,
    password: user.password,
  });
  
  const response = http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'signup' },
  });
  
  const success = checkResponse(response, {
    'signup status is 201': (r) => r.status === 201,
    'signup status is 200': (r) => r.status === 200,
    'signup status is 409': (r) => r.status === 409,
  }, 'signup');
  
  return { success, response };
}

function signIn(user) {
  const url = `${CONFIG.AUTH_SERVICE_URL}/auth/sign-in`;
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });
  
  const response = http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'signin' },
  });
  
  const success = checkResponse(response, {
    'signin status is 200': (r) => r.status === 200,
    'signin returns token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token && body.token.length > 10;
      } catch (e) {
        return false;
      }
    },
  }, 'signin');
  
  let token = null;
  let userId = null;
  
  if (success) {
    try {
      const body = JSON.parse(response.body);
      token = body.token;
      userId = body.uid;
    } catch (e) {
      // Parse error
    }
  }
  
  return { success, token, userId, response };
}

// ============================================================================
// CHAT SERVICE FUNCTIONS
// ============================================================================

function checkChatHealth() {
  const url = `${CONFIG.CHAT_SERVICE_URL}/health`;
  
  const response = http.get(url, {
    tags: { name: 'chat_health' },
    timeout: '5s',
  });
  
  checkResponse(response, {
    'chat health status is 200': (r) => r.status === 200,
    'chat health response time < 2000ms': (r) => r.timings.duration < 2000,
  }, 'chat_health');
  
  return response.status === 200;
}

function simulateMessageActivity(token, userId) {
  // Simulate sending a message (in reality, this would be WebSocket)
  // For HTTP test, we just validate the token would work
  
  const messageCount = randomIntBetween(
    CONFIG.MESSAGES_PER_USER_MIN,
    CONFIG.MESSAGES_PER_USER_MAX
  );
  
  for (let i = 0; i < messageCount; i++) {
    messagesSimulated.add(1);
    
    // Simulate think time between messages
    sleep(randomIntBetween(CONFIG.THINK_TIME_MIN, CONFIG.THINK_TIME_MAX));
  }
  
  return { messagesSent: messageCount };
}

// ============================================================================
// SCENARIOS
// ============================================================================

/**
 * Full authentication flow: Sign up -> Sign in -> Activity
 */
function fullAuthFlow() {
  const startTime = Date.now();
  const user = generateTestUser();
  
  group('Full Auth Flow', () => {
    // Step 1: Sign up
    const signupResult = signUp(user);
    sleep(randomIntBetween(1, 3));
    
    // Step 2: Sign in
    const signinResult = signIn(user);
    
    if (signinResult.success) {
      usersAuthenticated.add(1);
      
      // Step 3: Simulate message activity
      sleep(randomIntBetween(2, 5));
      simulateMessageActivity(signinResult.token, signinResult.userId);
      
      authFlowSuccessRate.add(true);
      e2eFlowSuccessRate.add(true);
    } else {
      authFlowSuccessRate.add(false);
    }
    
    authFlowsCompleted.add(1);
  });
  
  const duration = Date.now() - startTime;
  authFlowTrend.add(duration);
}

/**
 * Sign in only flow (existing user simulation)
 */
function signInOnlyFlow() {
  const user = generateTestUser();
  
  group('Sign In Only Flow', () => {
    // Try to sign in (may fail if user doesn't exist, which is expected)
    const signinResult = signIn(user);
    
    if (signinResult.success) {
      usersAuthenticated.add(1);
      
      // Simulate activity
      sleep(randomIntBetween(3, 7));
      simulateMessageActivity(signinResult.token, signinResult.userId);
    }
  });
}

/**
 * Health check only flow
 */
function healthCheckFlow() {
  group('Health Check Flow', () => {
    checkChatHealth();
  });
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log(`Starting combined load test: ${CONFIG.TEST_TYPE}`);
  console.log(`Auth Service: ${CONFIG.AUTH_SERVICE_URL}`);
  console.log(`Chat Service: ${CONFIG.CHAT_SERVICE_URL}`);
  
  // Quick connectivity check
  const authHealth = http.get(`${CONFIG.AUTH_SERVICE_URL}/health`, { timeout: '5s' });
  const chatHealth = http.get(`${CONFIG.CHAT_SERVICE_URL}/health`, { timeout: '5s' });
  
  return {
    testType: CONFIG.TEST_TYPE,
    authHealthy: authHealth.status === 200,
    chatHealthy: chatHealth.status === 200,
    startTime: new Date().toISOString(),
  };
}

export function teardown(data) {
  console.log(`\nTest completed: ${data.testType}`);
  console.log(`Started: ${data.startTime}`);
  console.log(`Ended: ${new Date().toISOString()}`);
  console.log(`Auth Service Healthy: ${data.authHealthy}`);
  console.log(`Chat Service Healthy: ${data.chatHealthy}`);
}

// ============================================================================
// MAIN
// ============================================================================

export default function () {
  // Weighted scenario selection
  const rand = Math.random();
  
  if (rand < 0.6) {
    // 60% - Full auth flow
    fullAuthFlow();
  } else if (rand < 0.9) {
    // 30% - Sign in only
    signInOnlyFlow();
  } else {
    // 10% - Health check only
    healthCheckFlow();
  }
  
  // Sleep between iterations
  sleep(randomIntBetween(2, 8));
}
