#!/usr/bin/env node

/**
 * Quick Performance Check for MindDouble API
 * Shows current endpoint response times vs targets
 */

import fs from 'fs';
import path from 'path';

const TARGETS = {
  '/api/today/personal-progress': 200,
  '/api/today/personal-progress/week': 500,
  '/api/today/shared': 150,
  '/api/items': 300
};

function getLogFilePath() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(process.cwd(), 'logs', `performance-${today}.log`);
}

function parseLogLine(line) {
  try {
    const log = JSON.parse(line);
    return {
      timestamp: log.timestamp,
      path: log.path,
      duration: log.duration_ms,
      status: log.status_code
    };
  } catch {
    return null;
  }
}

function checkPerformance() {
  const logFile = getLogFilePath();
  
  if (!fs.existsSync(logFile)) {
    console.log('❌ No performance log file found for today');
    console.log(`Expected: ${logFile}`);
    return;
  }
  
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const metrics = {};
  
  // Process recent logs (last 50 lines for speed)
  const recentLines = lines.slice(-50);
  
  recentLines.forEach(line => {
    const metric = parseLogLine(line);
    if (!metric || !TARGETS[metric.path]) return;
    
    if (!metrics[metric.path]) {
      metrics[metric.path] = [];
    }
    metrics[metric.path].push(metric);
  });
  
  console.log('🚀 MindDouble API Performance Check\n');
  console.log('Current Performance vs Targets:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  Object.entries(TARGETS).forEach(([endpoint, target]) => {
    const endpointMetrics = metrics[endpoint] || [];
    
    if (endpointMetrics.length === 0) {
      console.log(`${endpoint}`);
      console.log(`  Status: ⚠️  No recent data`);
      console.log(`  Target: <${target}ms\n`);
      return;
    }
    
    const latest = endpointMetrics[endpointMetrics.length - 1];
    const avg = Math.round(endpointMetrics.reduce((sum, m) => sum + m.duration, 0) / endpointMetrics.length);
    const isUnderTarget = latest.duration <= target;
    
    console.log(`${endpoint}`);
    console.log(`  Latest: ${latest.duration}ms ${isUnderTarget ? '✅' : '❌'}`);
    console.log(`  Average: ${avg}ms (${endpointMetrics.length} samples)`);
    console.log(`  Target: <${target}ms`);
    
    if (isUnderTarget) {
      const improvement = Math.round(((target - latest.duration) / target) * 100);
      console.log(`  Status: 🎯 Target achieved! (${improvement}% under target)`);
    } else {
      const excess = Math.round(((latest.duration - target) / target) * 100);
      console.log(`  Status: ⚠️  ${excess}% over target`);
    }
    console.log('');
  });
  
  // Overall status
  const allEndpoints = Object.keys(TARGETS);
  const testedEndpoints = allEndpoints.filter(endpoint => metrics[endpoint]?.length > 0);
  const passingEndpoints = testedEndpoints.filter(endpoint => {
    const endpointMetrics = metrics[endpoint];
    const latest = endpointMetrics[endpointMetrics.length - 1];
    return latest.duration <= TARGETS[endpoint];
  });
  
  console.log(`Overall Status: ${passingEndpoints.length}/${testedEndpoints.length} endpoints meeting targets`);
  
  if (passingEndpoints.length === testedEndpoints.length && testedEndpoints.length > 0) {
    console.log('🎉 All tested endpoints are meeting performance targets!');
  } else if (passingEndpoints.length > 0) {
    console.log(`✅ Passing: ${passingEndpoints.join(', ')}`);
    const failing = testedEndpoints.filter(e => !passingEndpoints.includes(e));
    if (failing.length > 0) {
      console.log(`❌ Needs improvement: ${failing.join(', ')}`);
    }
  }
}

checkPerformance();