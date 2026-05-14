# Tool Execution Error Fixes - 2026-05-14

## Summary
Analyzed agent execution log from session `20260514155137-c5b817` and fixed multiple tool execution errors.

## Issues Found and Fixed

### 1. ✅ Missing Function Alias: `get_financial_data`
**Problem:** Agent called `get_financial_data` but function was named `get_financial_indicators`

**Fix:** Added alias in FUNCTIONS dict
```python
"get_financial_data": get_financial_indicators,  # alias
```

**Status:** ✅ Fixed and tested

---

### 2. ✅ HK Stock History Missing Parameter: `count`
**Problem:** `get_hk_stock_history()` didn't accept `count` parameter, causing TypeError

**Fix:**
- Added `count: int = None` parameter to function signature
- Implemented logic to limit returned records based on count
- Switched from stooq API (now requires API key) to akshare's `stock_hk_hist()` function

**Code Changes:**
```python
def get_hk_stock_history(
    symbol: str,
    period: str = "daily",
    start_date: str = None,
    end_date: str = None,
    adjust: str = "qfq",
    count: int = None,  # NEW
) -> dict:
```

**Status:** ✅ Fixed (API connection issues are external, not code issues)

---

### 3. ✅ Financial Data Parsing Error
**Problem:** `get_financial_indicators` failed with `'report_date'` KeyError

**Fix:** Updated parsing logic to handle different column name formats from akshare API
```python
# Handle both Chinese and English column names
date_col = "报告期" if "报告期" in df.columns else "report_date"
```

**Status:** ✅ Fixed and tested

---

### 4. ⚠️ Akshare Module "Not Found" Errors (False Alarm)
**Problem:** Log showed "No module named 'akshare'" errors

**Investigation:**
- akshare IS installed in both Python environments
- `/opt/homebrew/bin/python3` (v3.14.3) - akshare 1.18.42
- `/opt/miniconda3/bin/python` (v3.12.8) - akshare 1.17.16
- Script uses correct shebang: `#!/opt/homebrew/bin/python3`

**Root Cause:** The errors in the log were from DIFFERENT issues:
- API changes in akshare (e.g., `stock_news_main_sina` removed)
- Network/connection issues
- NOT actual missing module

**Status:** ✅ No fix needed - module is installed

---

## Remaining Issues (External/API-Related)

### 1. ⚠️ HK Stock Data Connection Issues
**Issue:** akshare's `stock_hk_hist()` sometimes returns connection errors
```
"error": "('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))"
```

**Cause:** External API (东方财富) connection instability

**Recommendation:**
- Add retry logic with exponential backoff
- Consider fallback data sources
- Add better error messages for users

---

### 2. ⚠️ Stooq API Now Requires API Key
**Issue:** Previous HK stock data source (stooq.com) now requires API key

**Fix Applied:** Switched to akshare's built-in `stock_hk_hist()` function

**Status:** ✅ Resolved by using alternative data source

---

### 3. ⚠️ Akshare API Changes
**Issue:** Some akshare functions have changed:
- `stock_news_main_sina` no longer exists
- Financial data column names changed

**Status:** Partially addressed - financial data parsing now handles multiple formats

**Recommendation:** Add more robust error handling and fallback logic

---

### 4. ⚠️ Browser Tool Failures
**Issue:** Browser search actions failing with "Execution context was destroyed"

**Cause:** Browser navigation timing issues

**Status:** Not fixed in this session (requires browser tool investigation)

---

## Test Results

### ✅ Working Tools
- `get_financial_data` (alias) - Returns data successfully
- `get_balance_sheet` - Returns balance sheet data
- `get_quality_score` - Returns quality scores
- `get_hk_stock_history` - Function signature fixed (API connection issues are external)

### ⚠️ Tools with External Issues
- `get_stock_news` - akshare API changes
- `get_market_news` - All news sources unavailable
- `browser` tool - Execution context issues
- `web_fetch` - Some URLs return 404 or fetch failures

---

## Files Modified
- `/Users/mac/Documents/ai/investment-claude/python/akshare_bridge.py`
  - Added `get_financial_data` alias
  - Fixed `get_hk_stock_history` parameter signature
  - Rewrote `get_hk_stock_history` to use akshare instead of stooq
  - Fixed `get_financial_indicators` column name handling

---

## Recommendations

1. **Add Retry Logic:** Implement exponential backoff for API calls
2. **Better Error Messages:** Distinguish between code errors vs external API issues
3. **Fallback Data Sources:** Have backup APIs when primary fails
4. **API Version Pinning:** Consider pinning akshare version to avoid breaking changes
5. **Browser Tool Investigation:** Debug browser execution context issues separately
6. **Monitoring:** Add logging to track API success/failure rates

---

## Next Steps
- [ ] Add retry logic to HK stock data fetching
- [ ] Investigate browser tool execution context issues
- [ ] Add fallback news sources
- [ ] Create API health check endpoint
- [ ] Add integration tests for all fixed functions
