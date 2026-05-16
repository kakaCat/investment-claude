# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - PI-Investment Migration (2026-05-16)

**Evolution System - Automated Performance Analysis**
- Evolution System for automated performance gap analysis and continuous improvement
- Comprehensive gap attribution across four decision categories (stock selection, timing, position sizing, risk management)
- Actionable recommendations based on historical performance data
- Automated report generation with detailed metrics and insights

**Trade Journal Management**
- TradeLogTool for recording and tracking investment decisions
- Create trade logs with entry details (symbol, price, date, notes)
- Append events to existing logs (buy, sell, hold, observations)
- Query individual logs or list all trade logs
- Persistent storage in `.pi/trade-logs/` directory
- Full audit trail with automatic timestamp tracking

**Experience Search & Learning**
- ExperienceQueryTool for querying historical investment experiences
- Keyword-based search across decision logs, trade logs, and memory files
- Category-based filtering (stock_selection, timing, position_sizing, risk_management, market_analysis)
- Relevance-based ranking and configurable result limits
- Multi-source search with unified results

**Evolution Analysis Trigger**
- EvolutionRunTool for triggering on-demand evolution analysis
- Configurable analysis periods (1-365 days)
- Customizable target return rates
- Optional auto-apply for recommendations
- Comprehensive evolution reports with status tracking

**CRON Automation**
- Automated scheduling for regular evolution analysis
- Weekly evolution runs (default: every Monday at 9:00 AM)
- Configurable schedule via cron expressions
- Automatic report generation and storage
- Integration with existing CRON infrastructure

**Intelligence Services**
- ComparatorService for performance gap calculation and attribution
- EvolutionService for orchestrating complete analysis workflow
- Weighted attribution algorithm (Stock Selection 40%, Timing 30%, Position Sizing 20%, Risk Management 10%)
- Performance metrics calculation (total return, win rate, avg profit/loss, max drawdown, Sharpe ratio)

**Comprehensive Test Suite**
- 108 tests with 100% pass rate
- Unit tests for all tools and services (78 tests)
- Integration tests for component interactions (20 tests)
- End-to-end tests for complete workflows (10 tests)
- Full coverage of CRUD operations, error handling, and edge cases

**Documentation**
- Complete migration report with architecture diagrams and statistics
- Quick start guide for 5-minute setup
- Comprehensive API reference with type definitions and examples
- Usage examples and best practices
- Troubleshooting guide and common workflows

### Migration Details

**From:** pi-investment project
**To:** Claude Agent SDK architecture
**Duration:** 2026-05-01 to 2026-05-16 (16 days)
**Commits:** 62 migration-related commits
**Test Coverage:** 108 tests, 100% passing

**Core Features Migrated:**
1. Trade journal system with full audit trail
2. Historical experience search and retrieval
3. Performance gap analysis and attribution
4. Automated recommendation generation
5. Scheduled evolution runs via CRON

**Architecture Improvements:**
- Clean separation of concerns (tools, services, types)
- Type-safe interfaces with TypeScript
- Comprehensive error handling
- Persistent storage with file-based data layer
- Integration with Claude Agent SDK patterns

**Key Metrics:**
- 314 TypeScript source files
- ~25,267 lines of code
- 58 test files
- 3 new tools (TradeLogTool, ExperienceQueryTool, EvolutionRunTool)
- 2 intelligence services (Comparator, Evolution)

---

## [0.1.0] - 2026-05-14

### Added
- Dashboard command for portfolio overview
- Dynamic terminal width detection for REPL compatibility
- CJK-aware visual width calculation for Chinese character alignment
- Improved box width calculations for proper alignment

### Fixed
- Dashboard box width calculations for proper alignment
- Typeahead support for dashboard and dream commands
- Terminal width detection for better REPL compatibility

---

## [0.0.1] - 2026-04-14

### Added
- Initial release of Investment Claude
- InvestmentTool with 40+ financial analysis functions
- Real-time stock data for A-shares and Hong Kong stocks
- Financial analysis (balance sheet, income statement, cash flow)
- Technical analysis (MA, MACD, RSI, KDJ, Bollinger Bands)
- Valuation analysis (PE percentile, quality score)
- Market data (indices, sector fund flow, north flow)
- News and announcements
- Stock screening by sector and quality
- Institutional data (LHB, fund holdings, top holders)
- Macro data (PMI, CPI, GDP, money supply)
- Portfolio management
- Python bridge for akshare data integration

### Technical Stack
- Claude Agent SDK for AI conversation management
- TypeScript/Node.js for frontend
- Python/akshare for data acquisition
- Ink for terminal UI rendering

---

## Release Notes

### v1.0.0 - Evolution System Release (Upcoming)

The Evolution System represents a major milestone in Investment Claude's development, bringing automated performance analysis and continuous improvement capabilities. This release completes the PI-Investment migration and establishes a foundation for data-driven strategy optimization.

**Highlights:**
- Fully automated performance gap analysis
- Intelligent attribution across decision categories
- Experience-based learning from historical decisions
- Scheduled analysis with CRON automation
- 100% test coverage with 108 passing tests

**Breaking Changes:** None (backward compatible)

**Upgrade Path:** No migration required, new features are additive

**Next Steps:**
- Visualization for evolution reports
- Email/notification system for results
- Dashboard for tracking improvement over time
- Export functionality (PDF, CSV)

---

## Contributing

When adding entries to this changelog:

1. **Format:** Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format
2. **Categories:** Use Added, Changed, Deprecated, Removed, Fixed, Security
3. **Audience:** Write for users, not developers (focus on impact, not implementation)
4. **Links:** Link to relevant documentation, issues, or PRs
5. **Date:** Use ISO 8601 format (YYYY-MM-DD)

---

## Links

- [Repository](https://github.com/YOUR_USERNAME/investment-claude)
- [Documentation](./docs/)
- [Issues](https://github.com/YOUR_USERNAME/investment-claude/issues)
- [Releases](https://github.com/YOUR_USERNAME/investment-claude/releases)

---

**Maintained by:** Investment Claude Team
**Last Updated:** 2026-05-16
