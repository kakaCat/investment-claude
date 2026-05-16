# End-to-End Testing Checklist

## Overview
This checklist covers manual testing procedures for the Evolution System to verify functionality beyond automated tests.

## Test Environment Setup

### Prerequisites
- [ ] Investment-claude project is running
- [ ] `.pi/` directory exists with proper structure
- [ ] Trade log directory exists: `.pi/trade-log/`
- [ ] Evolution directory exists: `.pi/evolution/`
- [ ] Memory directory exists: `.pi/memory/`

### Test Data Preparation
- [ ] Create sample trade logs with realistic data
- [ ] Create experience records in memory/daily/
- [ ] Ensure at least 10 trades spanning 30 days
- [ ] Include both winning and losing trades

---

## 1. Basic Evolution Run

### Test: Run evolution with default parameters
**Steps:**
1. Open investment-claude terminal
2. Execute: `evolution_run` (via tool or command)
3. Wait for analysis to complete

**Expected Results:**
- [ ] Analysis completes without errors
- [ ] Report is generated in `.pi/evolution/reports/`
- [ ] Report contains all required sections:
  - [ ] Timestamp
  - [ ] Period (start/end dates)
  - [ ] Current performance metrics
  - [ ] Target performance metrics
  - [ ] Gap analysis with attribution
  - [ ] Recommendations list
  - [ ] Actions taken (empty if auto_apply=false)
  - [ ] Status: 'success'
- [ ] Report is human-readable and actionable
- [ ] Performance metrics are realistic (not NaN or Infinity)

**Notes:**
_Record any issues or observations_

---

## 2. Custom Period Analysis

### Test: Run evolution with 7-day period
**Steps:**
1. Execute: `evolution_run` with `period_days=7`
2. Review generated report

**Expected Results:**
- [ ] Only trades from last 7 days are analyzed
- [ ] Report period reflects 7-day window
- [ ] Performance metrics match the filtered dataset

### Test: Run evolution with specific date range
**Steps:**
1. Execute: `evolution_run` with custom start/end dates
2. Verify period filtering

**Expected Results:**
- [ ] Only trades within date range are included
- [ ] Report accurately reflects the custom period

**Notes:**
_Record any issues or observations_

---

## 3. Auto-Apply Mode

### Test: Run evolution with auto_apply=true
**Steps:**
1. Execute: `evolution_run` with `auto_apply=true`
2. Check for permission prompt (if configured)
3. Approve the operation
4. Verify actions file creation

**Expected Results:**
- [ ] Permission prompt appears (if not auto-approved)
- [ ] Analysis completes successfully
- [ ] Recommendations are saved to `.pi/evolution/actions/pending.json`
- [ ] Actions file contains:
  - [ ] Timestamp
  - [ ] Recommendations array
  - [ ] Status: 'pending'
- [ ] Report shows actions_taken with confirmation message

### Test: Run evolution with auto_apply=false
**Steps:**
1. Execute: `evolution_run` with `auto_apply=false`
2. Verify no actions file is created

**Expected Results:**
- [ ] No permission prompt
- [ ] No `pending.json` file created
- [ ] Report shows empty actions_taken array

**Notes:**
_Record any issues or observations_

---

## 4. Experience Query Integration

### Test: Query experiences by category
**Steps:**
1. Create experience records in `.pi/memory/daily/`
2. Execute: `query_experience` with query="stock selection" and category="stock_selection"
3. Repeat for other categories: timing, position_sizing, risk_management

**Expected Results:**
- [ ] Relevant experiences are returned
- [ ] Results are filtered by category
- [ ] Content matches the query string
- [ ] Results include source file and timestamp

### Test: Query experiences without category filter
**Steps:**
1. Execute: `query_experience` with query="market" (no category)
2. Review results

**Expected Results:**
- [ ] Results from all categories are returned
- [ ] Results contain the query term

### Test: Query with no results
**Steps:**
1. Execute: `query_experience` with query="nonexistent-term-xyz"

**Expected Results:**
- [ ] Returns empty results (not error)
- [ ] Message indicates no experiences found

**Notes:**
_Record any issues or observations_

---

## 5. Trade Log Tool Integration

### Test: Create trade log
**Steps:**
1. Execute: `trade_log` with action="create"
2. Provide: symbol, name, entry_price, entry_date
3. Note the generated log_id

**Expected Results:**
- [ ] Trade log created successfully
- [ ] File exists in `.pi/trade-log/`
- [ ] Log_id is returned
- [ ] Initial records array is empty

### Test: Append records to trade log
**Steps:**
1. Execute: `trade_log` with action="append"
2. Provide: log_id, record (date, event, price, notes)
3. Repeat with multiple records

**Expected Results:**
- [ ] Records are appended successfully
- [ ] Each record has a timestamp
- [ ] Records are in chronological order

### Test: Retrieve trade log
**Steps:**
1. Execute: `trade_log` with action="get" and log_id
2. Review returned data

**Expected Results:**
- [ ] Trade log is retrieved successfully
- [ ] All fields are present
- [ ] All appended records are included

### Test: List all trade logs
**Steps:**
1. Create multiple trade logs
2. Execute: `trade_log` with action="list"

**Expected Results:**
- [ ] All trade logs are returned
- [ ] Each log shows summary information

### Test: Trade log in evolution analysis
**Steps:**
1. Create trade log with entry and exit
2. Convert to TradeRecord format
3. Run evolution analysis
4. Verify trade is included

**Expected Results:**
- [ ] Trade appears in evolution analysis
- [ ] Performance metrics reflect the trade

**Notes:**
_Record any issues or observations_

---

## 6. CRON Job Execution (Manual Trigger)

### Test: Manually trigger evolution CRON job
**Steps:**
1. Locate CRON configuration (if implemented)
2. Manually execute the scheduled command
3. Verify execution

**Expected Results:**
- [ ] Evolution runs automatically
- [ ] Report is generated
- [ ] No user interaction required
- [ ] Logs show successful execution

**Notes:**
_CRON implementation status: [TODO/IN PROGRESS/COMPLETE]_
_Record any issues or observations_

---

## 7. Error Handling

### Test: Run evolution with no trade data
**Steps:**
1. Clear `.pi/trade-log/` directory
2. Execute: `evolution_run`

**Expected Results:**
- [ ] Analysis completes without crashing
- [ ] Report shows zero metrics
- [ ] Status is 'success' (not 'failed')
- [ ] Recommendations suggest data collection

### Test: Run evolution with corrupted trade file
**Steps:**
1. Create invalid JSON file in `.pi/trade-log/`
2. Execute: `evolution_run`

**Expected Results:**
- [ ] Analysis continues with valid files
- [ ] Corrupted file is skipped
- [ ] Warning logged (if applicable)
- [ ] Report is still generated

### Test: Query experiences with missing memory directory
**Steps:**
1. Temporarily rename `.pi/memory/` directory
2. Execute: `query_experience`
3. Restore directory

**Expected Results:**
- [ ] Error message indicates missing directory
- [ ] No crash or unhandled exception

### Test: Append to non-existent trade log
**Steps:**
1. Execute: `trade_log` with action="append" and invalid log_id

**Expected Results:**
- [ ] Error message: "Trade log not found"
- [ ] No file system corruption

**Notes:**
_Record any issues or observations_

---

## 8. Permission System

### Test: Auto-approve read-only operations
**Steps:**
1. Execute: `evolution_run` with auto_apply=false
2. Execute: `query_experience`
3. Execute: `trade_log` with action="get"

**Expected Results:**
- [ ] No permission prompts for read operations
- [ ] Operations execute immediately

### Test: Confirm write operations
**Steps:**
1. Execute: `evolution_run` with auto_apply=true
2. Execute: `trade_log` with action="create"
3. Execute: `trade_log` with action="append"

**Expected Results:**
- [ ] Permission prompt appears for each write operation
- [ ] Prompt describes the action clearly
- [ ] User can approve or deny
- [ ] Denial prevents the operation

**Notes:**
_Record any issues or observations_

---

## 9. UI Rendering in Terminal

### Test: Evolution report rendering
**Steps:**
1. Execute: `evolution_run`
2. Review terminal output

**Expected Results:**
- [ ] Report is formatted clearly
- [ ] Colors are used appropriately (green for success, red for errors)
- [ ] Sections are visually separated
- [ ] Numbers are formatted with proper precision
- [ ] Chinese characters display correctly (if applicable)
- [ ] No text overflow or wrapping issues

### Test: Experience query results rendering
**Steps:**
1. Execute: `query_experience` with results
2. Review terminal output

**Expected Results:**
- [ ] Results are formatted in a readable list
- [ ] Source files are clearly indicated
- [ ] Content is truncated appropriately (not too long)
- [ ] Timestamps are formatted correctly

### Test: Trade log rendering
**Steps:**
1. Execute: `trade_log` with action="get"
2. Review terminal output

**Expected Results:**
- [ ] Trade log details are clearly displayed
- [ ] Records are formatted chronologically
- [ ] Prices are formatted with currency symbols
- [ ] Dates are formatted consistently

**Notes:**
_Record any issues or observations_

---

## 10. Large Dataset Performance

### Test: Evolution with 100+ trades
**Steps:**
1. Generate or import 100+ trade records
2. Execute: `evolution_run`
3. Measure execution time

**Expected Results:**
- [ ] Analysis completes in reasonable time (< 10 seconds)
- [ ] No memory issues or crashes
- [ ] Report is generated successfully
- [ ] Performance metrics are accurate

### Test: Experience query with large dataset
**Steps:**
1. Create 1000+ experience records
2. Execute: `query_experience` with common term
3. Measure execution time

**Expected Results:**
- [ ] Query completes in reasonable time (< 5 seconds)
- [ ] Results are limited to specified limit
- [ ] No performance degradation

**Notes:**
_Record execution times and any performance issues_

---

## 11. Data Integrity

### Test: Report persistence
**Steps:**
1. Run evolution multiple times
2. Verify all reports are saved
3. Check for file naming conflicts

**Expected Results:**
- [ ] Each report has unique filename (timestamp-based)
- [ ] No reports are overwritten
- [ ] All reports are valid JSON
- [ ] Reports can be retrieved later

### Test: Trade log data consistency
**Steps:**
1. Create trade log
2. Append multiple records
3. Retrieve and verify
4. Use in evolution analysis

**Expected Results:**
- [ ] Data remains consistent across operations
- [ ] No data loss or corruption
- [ ] Timestamps are accurate
- [ ] Calculations are correct

**Notes:**
_Record any data integrity issues_

---

## 12. Edge Cases

### Test: Evolution on single trade
**Steps:**
1. Create single trade record
2. Execute: `evolution_run`

**Expected Results:**
- [ ] Analysis completes successfully
- [ ] Metrics are calculated (may be limited)
- [ ] No division by zero errors

### Test: Evolution with all winning trades
**Steps:**
1. Create dataset with 100% win rate
2. Execute: `evolution_run`

**Expected Results:**
- [ ] Win rate shows 100%
- [ ] Avg_loss is 0 or undefined
- [ ] Recommendations focus on other areas

### Test: Evolution with all losing trades
**Steps:**
1. Create dataset with 0% win rate
2. Execute: `evolution_run`

**Expected Results:**
- [ ] Win rate shows 0%
- [ ] Avg_profit is 0 or undefined
- [ ] Recommendations highlight critical issues

### Test: Query with special characters
**Steps:**
1. Execute: `query_experience` with query containing special chars: "stock@#$%"

**Expected Results:**
- [ ] Query handles special characters gracefully
- [ ] No SQL injection or file system issues

**Notes:**
_Record any edge case issues_

---

## Test Summary

### Test Execution Date: _______________
### Tester Name: _______________
### Environment: _______________

### Results Summary
- Total Tests: _______________
- Passed: _______________
- Failed: _______________
- Blocked: _______________

### Critical Issues Found
1. _______________
2. _______________
3. _______________

### Recommendations
1. _______________
2. _______________
3. _______________

### Sign-off
- [ ] All critical tests passed
- [ ] Known issues documented
- [ ] System ready for production use

**Tester Signature:** _______________
**Date:** _______________
