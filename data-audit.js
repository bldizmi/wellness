/**
 * Comprehensive Data Audit Tool
 * FAANG-Level Database Analysis for MindDouble
 * 
 * This script analyzes the current database structure to identify:
 * 1. Schema inconsistencies and missing constraints
 * 2. Data integrity violations
 * 3. Performance bottlenecks in current queries
 * 4. Missing indexes for scale
 * 5. Normalization issues
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';
import fs from 'fs';

class DataAuditService {
  constructor() {
    this.auditResults = {
      schemaIssues: [],
      dataIntegrityViolations: [],
      performanceBottlenecks: [],
      missingIndexes: [],
      recommendations: []
    };
  }

  async runComprehensiveAudit() {
    console.log('🔍 AUDIT: Starting comprehensive database audit...');
    
    await this.auditSchemaStructure();
    await this.auditDataIntegrity();
    await this.auditPerformancePatterns();
    await this.auditIndexOptimization();
    await this.generateRecommendations();
    
    return this.auditResults;
  }

  async auditSchemaStructure() {
    console.log('📊 AUDIT: Analyzing schema structure...');
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const tablePrefix = isDevelopment ? 'dev_' : '';
    
    try {
      // Check table existence and structure
      const tables = ['items', 'item_completions', 'recurring_instances', 'users', 'communities'];
      
      for (const tableName of tables) {
        const fullTableName = `${tablePrefix}${tableName}`;
        
        try {
          // Get table schema information
          const tableInfo = await db.execute(sql`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = ${fullTableName}
            ORDER BY ordinal_position
          `);
          
          console.log(`📋 SCHEMA: Table ${fullTableName} - ${tableInfo.length} columns`);
          
          // Check for critical missing columns
          await this.validateTableStructure(fullTableName, tableInfo);
          
        } catch (error) {
          this.auditResults.schemaIssues.push({
            severity: 'HIGH',
            table: fullTableName,
            issue: 'Table does not exist or is inaccessible',
            error: error.message
          });
        }
      }
      
      // Check foreign key constraints
      await this.auditForeignKeyConstraints(tablePrefix);
      
      // Check indexes
      await this.auditIndexes(tablePrefix);
      
    } catch (error) {
      console.error('❌ AUDIT ERROR: Schema structure analysis failed:', error);
      this.auditResults.schemaIssues.push({
        severity: 'CRITICAL',
        issue: 'Failed to analyze schema structure',
        error: error.message
      });
    }
  }

  async validateTableStructure(tableName, columns) {
    const columnNames = columns.map(col => col.column_name);
    
    // Define expected schema for each table
    const expectedSchemas = {
      items: ['id', 'title', 'item_type', 'recurrence_type', 'created_by', 'assigned_to', 'due_date'],
      item_completions: ['id', 'item_id', 'user_id', 'completion_date', 'completed_at'],
      recurring_instances: ['id', 'item_id', 'user_id', 'instance_date', 'status'],
      users: ['id', 'firebase_uid', 'email', 'display_name'],
      communities: ['id', 'name', 'created_by', 'created_at']
    };
    
    const baseTableName = tableName.replace(/^dev_/, '');
    const expected = expectedSchemas[baseTableName];
    
    if (expected) {
      const missing = expected.filter(col => !columnNames.includes(col));
      if (missing.length > 0) {
        this.auditResults.schemaIssues.push({
          severity: 'HIGH',
          table: tableName,
          issue: 'Missing critical columns',
          missingColumns: missing
        });
      }
    }
  }

  async auditForeignKeyConstraints(tablePrefix) {
    console.log('🔗 AUDIT: Checking foreign key constraints...');
    
    try {
      const constraints = await db.execute(sql`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name LIKE '${tablePrefix}%'
      `);
      
      console.log(`🔗 Found ${constraints.length} foreign key constraints`);
      
      // Check for missing critical foreign keys
      const criticalForeignKeys = [
        { table: `${tablePrefix}items`, column: 'created_by', references: `${tablePrefix}users(firebase_uid)` },
        { table: `${tablePrefix}items`, column: 'assigned_to', references: `${tablePrefix}users(firebase_uid)` },
        { table: `${tablePrefix}item_completions`, column: 'item_id', references: `${tablePrefix}items(id)` },
        { table: `${tablePrefix}item_completions`, column: 'user_id', references: `${tablePrefix}users(firebase_uid)` }
      ];
      
      for (const expectedFK of criticalForeignKeys) {
        const exists = constraints.some(c => 
          c.table_name === expectedFK.table && 
          c.column_name === expectedFK.column
        );
        
        if (!exists) {
          this.auditResults.schemaIssues.push({
            severity: 'MEDIUM',
            table: expectedFK.table,
            issue: 'Missing foreign key constraint',
            missingFK: expectedFK
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Foreign key audit failed:', error);
    }
  }

  async auditIndexes(tablePrefix) {
    console.log('📈 AUDIT: Analyzing database indexes...');
    
    try {
      const indexes = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename LIKE '${tablePrefix}%'
        ORDER BY tablename, indexname
      `);
      
      console.log(`📈 Found ${indexes.length} indexes`);
      
      // Define critical indexes needed for performance
      const criticalIndexes = [
        { table: `${tablePrefix}items`, columns: ['created_by'], purpose: 'User item queries' },
        { table: `${tablePrefix}items`, columns: ['assigned_to'], purpose: 'Assignment queries' },
        { table: `${tablePrefix}items`, columns: ['due_date'], purpose: 'Date-based queries' },
        { table: `${tablePrefix}items`, columns: ['recurrence_type'], purpose: 'Recurring item queries' },
        { table: `${tablePrefix}item_completions`, columns: ['user_id', 'completion_date'], purpose: 'Completion history' },
        { table: `${tablePrefix}item_completions`, columns: ['item_id'], purpose: 'Item completion lookup' }
      ];
      
      for (const criticalIndex of criticalIndexes) {
        const exists = indexes.some(idx => 
          idx.tablename === criticalIndex.table &&
          criticalIndex.columns.every(col => idx.indexdef.includes(col))
        );
        
        if (!exists) {
          this.auditResults.missingIndexes.push({
            severity: 'HIGH',
            table: criticalIndex.table,
            columns: criticalIndex.columns,
            purpose: criticalIndex.purpose,
            estimatedImpact: 'Query performance degradation at scale'
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Index audit failed:', error);
    }
  }

  async auditDataIntegrity() {
    console.log('🔍 AUDIT: Checking data integrity...');
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const tablePrefix = isDevelopment ? 'dev_' : '';
    
    try {
      // Check for orphaned records
      await this.checkOrphanedRecords(tablePrefix);
      
      // Check for inconsistent data types
      await this.checkDataTypeConsistency(tablePrefix);
      
      // Check for missing required fields
      await this.checkRequiredFields(tablePrefix);
      
      // Validate business logic constraints
      await this.validateBusinessLogic(tablePrefix);
      
    } catch (error) {
      console.error('❌ Data integrity audit failed:', error);
    }
  }

  async checkOrphanedRecords(tablePrefix) {
    console.log('🔍 Checking for orphaned records...');
    
    try {
      // Check for items without valid creators
      const orphanedItems = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM ${sql.identifier(`${tablePrefix}items`)} i
        LEFT JOIN ${sql.identifier(`${tablePrefix}users`)} u ON i.created_by = u.firebase_uid
        WHERE u.firebase_uid IS NULL AND i.created_by IS NOT NULL
      `);
      
      if (orphanedItems[0]?.count > 0) {
        this.auditResults.dataIntegrityViolations.push({
          severity: 'HIGH',
          issue: 'Items with invalid creators',
          count: orphanedItems[0].count,
          table: `${tablePrefix}items`
        });
      }
      
      // Check for completions without valid items
      const orphanedCompletions = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM ${sql.identifier(`${tablePrefix}item_completions`)} c
        LEFT JOIN ${sql.identifier(`${tablePrefix}items`)} i ON c.item_id = i.id
        WHERE i.id IS NULL
      `);
      
      if (orphanedCompletions[0]?.count > 0) {
        this.auditResults.dataIntegrityViolations.push({
          severity: 'HIGH',
          issue: 'Completions without valid items',
          count: orphanedCompletions[0].count,
          table: `${tablePrefix}item_completions`
        });
      }
      
    } catch (error) {
      console.error('❌ Orphaned records check failed:', error);
    }
  }

  async checkDataTypeConsistency(tablePrefix) {
    console.log('🔍 Checking data type consistency...');
    
    try {
      // Check for inconsistent item_type values
      const itemTypes = await db.execute(sql`
        SELECT DISTINCT item_type, COUNT(*) as count
        FROM ${sql.identifier(`${tablePrefix}items`)}
        WHERE item_type IS NOT NULL
        GROUP BY item_type
        ORDER BY count DESC
      `);
      
      console.log('📊 Item types found:', itemTypes);
      
      const validItemTypes = ['task', 'habit', 'goal', 'project'];
      const invalidTypes = itemTypes.filter(type => 
        !validItemTypes.includes(type.item_type)
      );
      
      if (invalidTypes.length > 0) {
        this.auditResults.dataIntegrityViolations.push({
          severity: 'MEDIUM',
          issue: 'Invalid item_type values found',
          invalidTypes: invalidTypes,
          table: `${tablePrefix}items`
        });
      }
      
      // Check for inconsistent recurrence_type values
      const recurrenceTypes = await db.execute(sql`
        SELECT DISTINCT recurrence_type, COUNT(*) as count
        FROM ${sql.identifier(`${tablePrefix}items`)}
        WHERE recurrence_type IS NOT NULL
        GROUP BY recurrence_type
        ORDER BY count DESC
      `);
      
      console.log('📊 Recurrence types found:', recurrenceTypes);
      
    } catch (error) {
      console.error('❌ Data type consistency check failed:', error);
    }
  }

  async checkRequiredFields(tablePrefix) {
    console.log('🔍 Checking required fields...');
    
    try {
      // Check for items missing critical fields
      const itemsWithMissingFields = await db.execute(sql`
        SELECT 
          COUNT(CASE WHEN title IS NULL OR title = '' THEN 1 END) as missing_title,
          COUNT(CASE WHEN item_type IS NULL THEN 1 END) as missing_item_type,
          COUNT(CASE WHEN created_by IS NULL THEN 1 END) as missing_created_by,
          COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as missing_assigned_to
        FROM ${sql.identifier(`${tablePrefix}items`)}
      `);
      
      const missing = itemsWithMissingFields[0];
      
      Object.entries(missing).forEach(([field, count]) => {
        if (count > 0) {
          this.auditResults.dataIntegrityViolations.push({
            severity: field === 'missing_title' || field === 'missing_created_by' ? 'HIGH' : 'MEDIUM',
            issue: `Items with missing ${field.replace('missing_', '')}`,
            count: count,
            table: `${tablePrefix}items`
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Required fields check failed:', error);
    }
  }

  async validateBusinessLogic(tablePrefix) {
    console.log('🔍 Validating business logic constraints...');
    
    try {
      // Check for items assigned to users who don't exist
      const invalidAssignments = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM ${sql.identifier(`${tablePrefix}items`)} i
        LEFT JOIN ${sql.identifier(`${tablePrefix}users`)} u ON i.assigned_to = u.firebase_uid
        WHERE i.assigned_to IS NOT NULL AND u.firebase_uid IS NULL
      `);
      
      if (invalidAssignments[0]?.count > 0) {
        this.auditResults.dataIntegrityViolations.push({
          severity: 'HIGH',
          issue: 'Items assigned to non-existent users',
          count: invalidAssignments[0].count,
          table: `${tablePrefix}items`
        });
      }
      
      // Check for duplicate completions on same date
      const duplicateCompletions = await db.execute(sql`
        SELECT item_id, user_id, completion_date, COUNT(*) as duplicate_count
        FROM ${sql.identifier(`${tablePrefix}item_completions`)}
        GROUP BY item_id, user_id, completion_date
        HAVING COUNT(*) > 1
      `);
      
      if (duplicateCompletions.length > 0) {
        this.auditResults.dataIntegrityViolations.push({
          severity: 'MEDIUM',
          issue: 'Duplicate completion records',
          count: duplicateCompletions.length,
          table: `${tablePrefix}item_completions`
        });
      }
      
    } catch (error) {
      console.error('❌ Business logic validation failed:', error);
    }
  }

  async auditPerformancePatterns() {
    console.log('⚡ AUDIT: Analyzing performance patterns...');
    
    try {
      // Simulate common query patterns and measure performance
      const performanceTests = [
        { name: 'Today page personal items', query: this.testTodayPageQuery.bind(this) },
        { name: 'Week calendar data', query: this.testWeekCalendarQuery.bind(this) },
        { name: 'User completion history', query: this.testCompletionHistoryQuery.bind(this) },
        { name: 'Community shared items', query: this.testSharedItemsQuery.bind(this) }
      ];
      
      for (const test of performanceTests) {
        const startTime = Date.now();
        try {
          await test.query();
          const duration = Date.now() - startTime;
          
          if (duration > 1000) { // > 1 second
            this.auditResults.performanceBottlenecks.push({
              severity: 'HIGH',
              query: test.name,
              duration: duration,
              issue: 'Query exceeds 1 second threshold'
            });
          } else if (duration > 500) { // > 500ms
            this.auditResults.performanceBottlenecks.push({
              severity: 'MEDIUM',
              query: test.name,
              duration: duration,
              issue: 'Query exceeds 500ms threshold'
            });
          }
          
          console.log(`⚡ ${test.name}: ${duration}ms`);
          
        } catch (error) {
          this.auditResults.performanceBottlenecks.push({
            severity: 'CRITICAL',
            query: test.name,
            issue: 'Query failed to execute',
            error: error.message
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Performance audit failed:', error);
    }
  }

  async testTodayPageQuery() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const tablePrefix = isDevelopment ? 'dev_' : '';
    const testUserId = 'test-user-performance';
    const testDate = '2025-07-04';
    
    return await db.execute(sql`
      SELECT i.*, ic.completion_date
      FROM ${sql.identifier(`${tablePrefix}items`)} i
      LEFT JOIN ${sql.identifier(`${tablePrefix}item_completions`)} ic 
        ON i.id = ic.item_id AND ic.completion_date = ${testDate}
      WHERE (i.created_by = ${testUserId} OR i.assigned_to = ${testUserId})
        AND (i.due_date = ${testDate} OR i.recurrence_type IS NOT NULL)
      LIMIT 100
    `);
  }

  async testWeekCalendarQuery() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const tablePrefix = isDevelopment ? 'dev_' : '';
    const testUserId = 'test-user-performance';
    
    return await db.execute(sql`
      SELECT 
        i.id,
        i.title,
        i.item_type,
        ic.completion_date,
        COUNT(*) OVER() as total_count
      FROM ${sql.identifier(`${tablePrefix}items`)} i
      LEFT JOIN ${sql.identifier(`${tablePrefix}item_completions`)} ic 
        ON i.id = ic.item_id 
        AND ic.completion_date BETWEEN '2025-07-01' AND '2025-07-07'
      WHERE (i.created_by = ${testUserId} OR i.assigned_to = ${testUserId})
      LIMIT 500
    `);
  }

  async testCompletionHistoryQuery() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const tablePrefix = isDevelopment ? 'dev_' : '';
    const testUserId = 'test-user-performance';
    
    return await db.execute(sql`
      SELECT ic.*, i.title, i.item_type
      FROM ${sql.identifier(`${tablePrefix}item_completions`)} ic
      JOIN ${sql.identifier(`${tablePrefix}items`)} i ON ic.item_id = i.id
      WHERE ic.user_id = ${testUserId}
        AND ic.completion_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY ic.completion_date DESC
      LIMIT 200
    `);
  }

  async testSharedItemsQuery() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const tablePrefix = isDevelopment ? 'dev_' : '';
    const testUserId = 'test-user-performance';
    
    return await db.execute(sql`
      SELECT i.*, u.display_name as creator_name
      FROM ${sql.identifier(`${tablePrefix}items`)} i
      LEFT JOIN ${sql.identifier(`${tablePrefix}users`)} u ON i.created_by = u.firebase_uid
      WHERE (i.shared_with LIKE '%${testUserId}%' OR i.assigned_to = ${testUserId})
        AND i.created_by != ${testUserId}
      LIMIT 100
    `);
  }

  async generateRecommendations() {
    console.log('💡 AUDIT: Generating recommendations...');
    
    // High priority recommendations based on findings
    if (this.auditResults.missingIndexes.length > 0) {
      this.auditResults.recommendations.push({
        priority: 'HIGH',
        category: 'Performance',
        recommendation: 'Add critical database indexes for scale',
        impact: 'Prevents query degradation as data grows',
        effort: 'Low - SQL DDL statements'
      });
    }
    
    if (this.auditResults.dataIntegrityViolations.some(v => v.severity === 'HIGH')) {
      this.auditResults.recommendations.push({
        priority: 'CRITICAL',
        category: 'Data Integrity',
        recommendation: 'Fix data integrity violations before scaling',
        impact: 'Prevents data corruption and user experience issues',
        effort: 'Medium - Data cleanup and constraint addition'
      });
    }
    
    if (this.auditResults.performanceBottlenecks.some(b => b.duration > 1000)) {
      this.auditResults.recommendations.push({
        priority: 'HIGH',
        category: 'Performance',
        recommendation: 'Optimize slow queries for production readiness',
        impact: 'Improves user experience and reduces server load',
        effort: 'Medium - Query optimization and caching'
      });
    }
    
    // FAANG-level architectural recommendations
    this.auditResults.recommendations.push({
      priority: 'HIGH',
      category: 'Architecture',
      recommendation: 'Implement materialized views for calendar aggregations',
      impact: 'Enables sub-100ms calendar responses at scale',
      effort: 'Medium - Database design and refresh triggers'
    });
    
    this.auditResults.recommendations.push({
      priority: 'MEDIUM',
      category: 'Observability',
      recommendation: 'Add structured logging and performance monitoring',
      impact: 'Enables proactive issue detection and debugging',
      effort: 'Medium - Logging framework and dashboard setup'
    });
    
    this.auditResults.recommendations.push({
      priority: 'HIGH',
      category: 'Scalability',
      recommendation: 'Design read replica strategy for calendar queries',
      impact: 'Supports millions of users with geographic distribution',
      effort: 'High - Database architecture and connection management'
    });
  }

  generateReport() {
    console.log('\n🎯 COMPREHENSIVE DATA AUDIT REPORT');
    console.log('===================================');
    
    console.log('\n📊 SCHEMA ISSUES:');
    this.auditResults.schemaIssues.forEach(issue => {
      console.log(`  ${issue.severity}: ${issue.issue}`);
      if (issue.table) console.log(`    Table: ${issue.table}`);
      if (issue.missingColumns) console.log(`    Missing: ${issue.missingColumns.join(', ')}`);
    });
    
    console.log('\n🔍 DATA INTEGRITY VIOLATIONS:');
    this.auditResults.dataIntegrityViolations.forEach(violation => {
      console.log(`  ${violation.severity}: ${violation.issue}`);
      if (violation.count) console.log(`    Count: ${violation.count}`);
      if (violation.table) console.log(`    Table: ${violation.table}`);
    });
    
    console.log('\n⚡ PERFORMANCE BOTTLENECKS:');
    this.auditResults.performanceBottlenecks.forEach(bottleneck => {
      console.log(`  ${bottleneck.severity}: ${bottleneck.query}`);
      if (bottleneck.duration) console.log(`    Duration: ${bottleneck.duration}ms`);
      console.log(`    Issue: ${bottleneck.issue}`);
    });
    
    console.log('\n📈 MISSING INDEXES:');
    this.auditResults.missingIndexes.forEach(index => {
      console.log(`  ${index.severity}: ${index.table}`);
      console.log(`    Columns: ${index.columns.join(', ')}`);
      console.log(`    Purpose: ${index.purpose}`);
    });
    
    console.log('\n💡 RECOMMENDATIONS:');
    this.auditResults.recommendations.forEach(rec => {
      console.log(`  ${rec.priority}: ${rec.recommendation}`);
      console.log(`    Category: ${rec.category}`);
      console.log(`    Impact: ${rec.impact}`);
      console.log(`    Effort: ${rec.effort}`);
    });
    
    console.log('\n✅ AUDIT COMPLETE - Ready for foundation rebuild\n');
    
    return this.auditResults;
  }
}

// Run the audit
async function main() {
  try {
    const auditor = new DataAuditService();
    const results = await auditor.runComprehensiveAudit();
    auditor.generateReport();
    
    // Export results for further analysis
    fs.writeFileSync(
      'audit-results.json', 
      JSON.stringify(results, null, 2)
    );
    
    console.log('📁 Audit results saved to audit-results.json');
    
  } catch (error) {
    console.error('❌ AUDIT FAILED:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main();

export { DataAuditService };