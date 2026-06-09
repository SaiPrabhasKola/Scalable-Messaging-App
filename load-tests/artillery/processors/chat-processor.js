/**
 * Artillery Processor for Chat Load Testing
 * 
 * This module provides custom functions for:
 * - JWT token generation
 * - User ID generation
 * - Dynamic message content
 * - Connection lifecycle hooks
 * - Metrics collection
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Auth service configuration
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  CHAT_SERVICE_URL: process.env.CHAT_SERVICE_URL || 'http://localhost:4002',
  
  // JWT configuration - uses the same private key as auth service
  JWT_PRIVATE_KEY_PATH: process.env.JWT_PRIVATE_KEY_PATH || '../../auth-serivce/keys/private.key',
  JWT_EXPIRY: '2h',
  JWT_ALGORITHM: 'RS256',
  
  // Test user configuration
  TEST_USER_PREFIX: 'loadtest_user',
  TEST_USER_DOMAIN: 'loadtest.local',
  
  // Target user for messages (can be overridden)
  DEFAULT_TARGET_USER_ID: process.env.DEFAULT_TARGET_USER_ID || 'cmnah3d5w0000n06f5w7h31e2',
};

// Sample message content for realistic chat simulation
const MESSAGE_TEMPLATES = {
  greetings: [
    "Hey there! How's it going?",
    "Hello! Nice to meet you!",
    "Hi! How are you doing today?",
    "Hey! What's up?",
    "Good morning! Hope you're having a great day!",
    "Hello there! Ready to chat?",
    "Hi friend! Long time no see!",
    "Hey! Just wanted to check in."
  ],
  
  randomMessages: [
    "The weather is really nice today!",
    "Did you see the news this morning?",
    "I'm working on an interesting project.",
    "Have you tried that new restaurant downtown?",
    "Just finished reading a great book!",
    "Can't wait for the weekend!",
    "This chat app is really fast!",
    "Testing message delivery speed...",
    "How's everything on your end?",
    "Just wanted to share an update.",
    "Technology is amazing these days!",
    "Have you traveled anywhere interesting lately?",
    "I'm learning something new today.",
    "Coffee or tea? What's your preference?",
    "Random thought: Clouds are fascinating!",
    "Just checking if messages are delivered quickly.",
    "This is a test message number {{number}}.",
    "Performance testing in progress...",
    "Hope this message finds you well!",
    "Let me know when you receive this!"
  ],
  
  passiveMessages: [
    "I see.",
    "That's interesting.",
    "Hmm, let me think about that.",
    "Right.",
    "Okay.",
    "Understood.",
    "I agree.",
    "Makes sense."
  ],
  
  acknowledgments: [
    "Thanks for letting me know!",
    "Got it, thanks!",
    "Appreciate the update!",
    "Thanks for sharing!",
    "Message received loud and clear!",
    "Thanks for the info!"
  ],
  
  farewells: [
    "Goodbye for now!",
    "Catch you later!",
    "Talk to you soon!",
    "Have a great day!",
    "See you around!",
    "Until next time!"
  ]
};

// Metrics tracking
const metrics = {
  connectionsAttempted: 0,
  connectionsSuccessful: 0,
  connectionsFailed: 0,
  messagesSent: 0,
  messagesReceived: 0,
  messagesFailed: 0,
  totalLatency: 0,
  latencies: []
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique user ID (CUID-like format for compatibility)
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
 * Generate a test user email
 */
function generateUserEmail(scenarioIndex) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${CONFIG.TEST_USER_PREFIX}_${scenarioIndex}_${timestamp}_${random}@${CONFIG.TEST_USER_DOMAIN}`;
}

/**
 * Generate a test username
 */
function generateUsername(scenarioIndex) {
  const adjectives = ['Happy', 'Quick', 'Bright', 'Cool', 'Smart', 'Fast', 'Clever', 'Swift'];
  const nouns = ['Tester', 'User', 'Client', 'Bot', 'Runner', 'Load', 'Stream', 'Chat'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}_${scenarioIndex}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * Get a random message from a category
 */
function getRandomMessage(category, replacements = {}) {
  const messages = MESSAGE_TEMPLATES[category];
  if (!messages || messages.length === 0) {
    return "Test message";
  }
  
  let message = messages[Math.floor(Math.random() * messages.length)];
  
  // Apply replacements
  Object.keys(replacements).forEach(key => {
    message = message.replace(`{{${key}}}`, replacements[key]);
  });
  
  return message;
}

/**
 * Generate JWT token for authentication
 */
function generateJWTToken(userId, username) {
  try {
    // Try to load the private key from auth service
    let privateKey;
    const keyPath = path.resolve(CONFIG.JWT_PRIVATE_KEY_PATH);
    
    if (fs.existsSync(keyPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf-8');
    } else {
      // Fallback: Generate a mock token (will fail auth but useful for testing)
      console.warn(`Private key not found at ${keyPath}. Using mock token.`);
      return `mock_token_${userId}_${Date.now()}`;
    }
    
    const payload = {
      id: userId,
      userName: username,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = jwt.sign(payload, privateKey, {
      algorithm: CONFIG.JWT_ALGORITHM,
      expiresIn: CONFIG.JWT_EXPIRY
    });
    
    return token;
  } catch (error) {
    console.error('Error generating JWT token:', error.message);
    // Return a mock token for testing purposes
    return `mock_token_${userId}_${Date.now()}`;
  }
}

/**
 * Load test users from file or environment
 */
function loadTestUsers() {
  try {
    const usersPath = path.resolve(__dirname, '../data/test-users.json');
    if (fs.existsSync(usersPath)) {
      const data = fs.readFileSync(usersPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Could not load test users:', error.message);
  }
  return [];
}

// ============================================================================
// ARTILLERY HOOKS
// ============================================================================

/**
 * Before scenario hook - Generate authentication token and user data
 */
function generateAuthToken(context, events, done) {
  const scenarioIndex = context.scenario?.index || Math.floor(Math.random() * 10000);
  
  // Generate unique user data
  const userId = generateUserId();
  const username = generateUsername(scenarioIndex);
  const email = generateUserEmail(scenarioIndex);
  
  // Generate JWT token
  const token = generateJWTToken(userId, username);
  
  // Set variables for the scenario
  context.vars.token = token;
  context.vars.userId = userId;
  context.vars.username = username;
  context.vars.email = email;
  context.vars.targetUserId = CONFIG.DEFAULT_TARGET_USER_ID;
  
  // Generate message content
  context.vars.greetingMessage = getRandomMessage('greetings');
  context.vars.randomMessage = getRandomMessage('randomMessages', { 
    number: Math.floor(Math.random() * 1000) 
  });
  context.vars.passiveMessage = getRandomMessage('passiveMessages');
  context.vars.acknowledgmentMessage = getRandomMessage('acknowledgments');
  context.vars.farewellMessage = getRandomMessage('farewells');
  
  // Track metrics
  metrics.connectionsAttempted++;
  
  // Log for debugging (only in verbose mode)
  if (process.env.ARTILLERY_VERBOSE === 'true') {
    console.log(`[Scenario ${scenarioIndex}] Generated user: ${username} (${userId})`);
  }
  
  return done();
}

/**
 * After scenario hook - Cleanup and final metrics
 */
function cleanupScenario(context, events, done) {
  // Log scenario completion metrics
  const scenarioId = context.scenario?.index || 'unknown';
  
  if (process.env.ARTILLERY_VERBOSE === 'true') {
    console.log(`[Scenario ${scenarioId}] Completed for user: ${context.vars.username}`);
  }
  
  return done();
}

/**
 * On WebSocket connecting hook
 */
function onConnecting(context, done) {
  const startTime = Date.now();
  context.vars.connectionStartTime = startTime;
  
  if (process.env.ARTILLERY_VERBOSE === 'true') {
    console.log(`[${context.vars.username}] WebSocket connecting...`);
  }
  
  return done();
}

/**
 * On WebSocket connect hook
 */
function onConnect(context, done) {
  const connectTime = Date.now();
  const connectionLatency = connectTime - (context.vars.connectionStartTime || connectTime);
  
  context.vars.connectionLatency = connectionLatency;
  context.vars.connectedAt = connectTime;
  
  metrics.connectionsSuccessful++;
  
  if (process.env.ARTILLERY_VERBOSE === 'true') {
    console.log(`[${context.vars.username}] WebSocket connected (latency: ${connectionLatency}ms)`);
  }
  
  return done();
}

/**
 * On WebSocket disconnect hook
 */
function onDisconnect(context, done) {
  const disconnectTime = Date.now();
  const connectionDuration = disconnectTime - (context.vars.connectedAt || disconnectTime);
  
  context.vars.connectionDuration = connectionDuration;
  
  if (process.env.ARTILLERY_VERBOSE === 'true') {
    console.log(`[${context.vars.username}] WebSocket disconnected (duration: ${connectionDuration}ms)`);
  }
  
  return done();
}

/**
 * On message received hook
 */
function onMessageReceived(context, done) {
  const receiveTime = Date.now();
  const sentTime = context.vars.sentTimestamp || receiveTime;
  const latency = receiveTime - sentTime;
  
  // Track message metrics
  metrics.messagesReceived++;
  metrics.totalLatency += latency;
  metrics.latencies.push(latency);
  
  context.vars.messageLatency = latency;
  context.vars.lastMessageReceivedAt = receiveTime;
  
  if (process.env.ARTILLERY_VERBOSE === 'true') {
    console.log(`[${context.vars.username}] Message received (latency: ${latency}ms)`);
  }
  
  return done();
}

/**
 * Before request hook - Track message sending
 */
function beforeSendMessage(context, done) {
  context.vars.messageSendStart = Date.now();
  metrics.messagesSent++;
  
  return done();
}

/**
 * After response hook - Calculate end-to-end latency
 */
function afterSendMessage(context, done) {
  const responseTime = Date.now();
  const requestTime = context.vars.messageSendStart || responseTime;
  const roundTripTime = responseTime - requestTime;
  
  context.vars.roundTripTime = roundTripTime;
  
  return done();
}

// ============================================================================
// METRICS FUNCTIONS
// ============================================================================

/**
 * Get current metrics summary
 */
function getMetricsSummary() {
  const avgLatency = metrics.messagesReceived > 0 
    ? metrics.totalLatency / metrics.messagesReceived 
    : 0;
    
  const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
  const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
  const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
  
  return {
    connections: {
      attempted: metrics.connectionsAttempted,
      successful: metrics.connectionsSuccessful,
      failed: metrics.connectionsFailed,
      successRate: metrics.connectionsAttempted > 0 
        ? (metrics.connectionsSuccessful / metrics.connectionsAttempted * 100).toFixed(2) + '%'
        : '0%'
    },
    messages: {
      sent: metrics.messagesSent,
      received: metrics.messagesReceived,
      failed: metrics.messagesFailed,
      deliveryRate: metrics.messagesSent > 0 
        ? (metrics.messagesReceived / metrics.messagesSent * 100).toFixed(2) + '%'
        : '0%'
    },
    latency: {
      average: Math.round(avgLatency),
      p50: p50,
      p95: p95,
      p99: p99,
      min: sortedLatencies[0] || 0,
      max: sortedLatencies[sortedLatencies.length - 1] || 0
    }
  };
}

/**
 * Reset metrics (useful between test runs)
 */
function resetMetrics() {
  metrics.connectionsAttempted = 0;
  metrics.connectionsSuccessful = 0;
  metrics.connectionsFailed = 0;
  metrics.messagesSent = 0;
  metrics.messagesReceived = 0;
  metrics.messagesFailed = 0;
  metrics.totalLatency = 0;
  metrics.latencies = [];
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Scenario hooks
  generateAuthToken,
  cleanupScenario,
  
  // Connection hooks
  onConnecting,
  onConnect,
  onDisconnect,
  
  // Message hooks
  onMessageReceived,
  beforeSendMessage,
  afterSendMessage,
  
  // Metrics
  getMetricsSummary,
  resetMetrics,
  
  // Utilities
  generateUserId,
  generateJWTToken,
  getRandomMessage,
  
  // Configuration
  CONFIG
};
