#!/usr/bin/env node

// Keep-alive script for Replit session
// Sends periodic HTTP requests to localhost to prevent session timeout

import http from 'http';

const INTERVAL = 5 * 60 * 1000; // 5 minutes
const PORT = process.env.PORT || 3000;

function pingServer() {
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    console.log(`[${new Date().toISOString()}] Keep-alive ping - Status: ${res.statusCode}`);
  });

  req.on('error', (error) => {
    console.log(`[${new Date().toISOString()}] Keep-alive ping failed:`, error.message);
  });

  req.on('timeout', () => {
    console.log(`[${new Date().toISOString()}] Keep-alive ping timeout`);
    req.destroy();
  });

  req.end();
}

console.log(`Starting keep-alive service (ping every ${INTERVAL / 1000} seconds)`);
console.log(`Targeting localhost:${PORT}`);

// Initial ping
pingServer();

// Set up interval
const intervalId = setInterval(pingServer, INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping keep-alive service...');
  clearInterval(intervalId);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nStopping keep-alive service...');
  clearInterval(intervalId);
  process.exit(0);
});

console.log('Keep-alive service is running. Press Ctrl+C to stop.');