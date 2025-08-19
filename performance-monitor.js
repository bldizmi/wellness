#!/usr/bin/env node

/**
 * Real-time Performance Monitor for MindDouble API Optimization
 * Tracks endpoint response times and shows progress toward targets
 */

import fs from 'fs';
import path from 'path';

const PERFORMANCE_TARGETS = {
  '/api/today/personal-progress': 200,
  '/api/today/personal-progress/week': 500,
  '/api/today/shared': 150,
  '/api/items': 300
};

const BASELINE_TIMES = {
  '/api/today/personal-progress': 1551,
  '/api/today/personal-progress/week': 1978,
  '/api/today/shared': 1356,
  '/api/items': 1948
};

function getLogFilePath() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(__dirname, 'logs', `performance-${today}.log`);
}

function parseLogLine(line) {
  try {
    const log = JSON.parse(line);
    return {
      timestamp: log.timestamp,
      path: log.path,
      duration: log.duration_ms,
      status: log.status_code,
      correlationId: log.correlationId
    };
  } catch {
    return null;
  }
}

function calculateImprovement(current, baseline) {
  if (!baseline || baseline === 0) return 0;
  return Math.round(((baseline - current) / baseline) * 100);
}

function getStatusColor(duration, target) {
  if (duration <= target) return '\x1b[32m'; // Green
  if (duration <= target * 1.5) return '\x1b[33m'; // Yellow
  return '\x1b[31m'; // Red
}

function formatDuration(ms) {
  return `${ms}ms`;
}

function displayPerformanceMetrics(recentMetrics) {
  console.clear();
  console.log('\x1b[1m=== MindDouble API Performance Monitor ===\x1b[0m\n');
  console.log(`Last updated: ${new Date().toLocaleTimeString()}\n`);
  
  console.log('\x1b[1mEndpoint Performance Summary:\x1b[0m');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  Object.entries(PERFORMANCE_TARGETS).forEach(([endpoint, target]) => {
    const metrics = recentMetrics[endpoint] || [];
    const baseline = BASELINE_TIMES[endpoint];
    
    if (metrics.length === 0) {
      console.log(`${endpoint.padEnd(40)} │ No recent data`);
      return;
    }
    
    const latest = metrics[metrics.length - 1];
    const avg = Math.round(metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length);
    const improvement = calculateImprovement(latest.duration, baseline);
    
    const statusColor = getStatusColor(latest.duration, target);
    const targetStatus = latest.duration <= target ? '✓ TARGET' : '✗ SLOW';
    
    console.log(
      `${endpoint.padEnd(40)} │ ` +
      `${statusColor}${formatDuration(latest.duration).padEnd(8)}\x1b[0m │ ` +
      `Avg: ${formatDuration(avg).padEnd(8)} │ ` +
      `Target: ${formatDuration(target).padEnd(8)} │ ` +
      `${improvement > 0 ? '+' : ''}${improvement}% │ ` +
      `${statusColor}${targetStatus}\x1b[0m`
    );
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Show recent activity
  const allRecent = Object.values(recentMetrics).flat().sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  ).slice(0, 5);
  
  if (allRecent.length > 0) {
    console.log('\n\x1b[1mRecent API Calls:\x1b[0m');
    allRecent.forEach(metric => {
      const target = PERFORMANCE_TARGETS[metric.path];
      const color = getStatusColor(metric.duration, target);
      const time = new Date(metric.timestamp).toLocaleTimeString();
      
      console.log(
        `${time} │ ${metric.path.padEnd(40)} │ ` +
        `${color}${formatDuration(metric.duration)}\x1b[0m │ ` +
        `${metric.correlationId?.slice(-8) || 'N/A'}`
      );
    });
  }
  
  console.log('\n\x1b[2mPress Ctrl+C to stop monitoring...\x1b[0m');
}

function monitorPerformance() {
  const logFile = getLogFilePath();
  
  if (!fs.existsSync(logFile)) {
    console.log(`Waiting for log file: ${logFile}`);
    setTimeout(monitorPerformance, 1000);
    return;
  }
  
  let lastPosition = 0;
  const recentMetrics = {};
  
  // Initialize metric arrays
  Object.keys(PERFORMANCE_TARGETS).forEach(endpoint => {
    recentMetrics[endpoint] = [];
  });
  
  function readNewLines() {
    const stats = fs.statSync(logFile);
    if (stats.size <= lastPosition) return;
    
    const buffer = Buffer.alloc(stats.size - lastPosition);
    const fd = fs.openSync(logFile, 'r');
    fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
    fs.closeSync(fd);
    
    const newContent = buffer.toString();
    lastPosition = stats.size;
    
    const lines = newContent.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const metric = parseLogLine(line);
      if (!metric || !PERFORMANCE_TARGETS[metric.path]) return;
      
      // Keep only last 10 measurements per endpoint
      recentMetrics[metric.path].push(metric);
      if (recentMetrics[metric.path].length > 10) {
        recentMetrics[metric.path].shift();
      }
    });
    
    displayPerformanceMetrics(recentMetrics);
  }
  
  // Initial read
  readNewLines();
  
  // Monitor for changes
  const interval = setInterval(readNewLines, 1000);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\nPerformance monitoring stopped.');
    process.exit(0);
  });
}

console.log('Starting MindDouble API Performance Monitor...\n');
console.log('Optimization Targets:');
Object.entries(PERFORMANCE_TARGETS).forEach(([endpoint, target]) => {
  console.log(`  ${endpoint}: <${target}ms`);
});
console.log('\n');

monitorPerformance();