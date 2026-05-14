# 测试文档索引

> 量化项目完整测试文档体系

**版本**: v1.0
**更新日期**: 2026-04-14
**测试覆盖率目标**: 80%+

---

## 📚 文档导航

### 测试策略
- [测试策略](strategy/test-strategy.md) - 测试金字塔、覆盖率目标、测试原则

### 测试指南
- [单元测试指南](guides/unit-testing-guide.md) - 如何编写单元测试、Fixtures、Mock 最佳实践
- [集成测试指南](guides/integration-testing-guide.md) - 如何编写集成测试、数据库测试、API 测试

### 覆盖率报告
- [当前覆盖率](coverage/current-coverage.md) - 各模块覆盖率统计、未覆盖代码分析

---

## 🎯 快速开始

### 运行测试

```bash
# 运行所有测试
pytest

# 运行并显示覆盖率
pytest --cov=python/quant --cov-report=term-missing

# 生成 HTML 覆盖率报告
pytest --cov=python/quant --cov-report=html
open htmlcov/index.html
```

### 编写测试

1. 阅读 [测试策略](strategy/test-strategy.md) 了解整体方法
2. 根据测试类型选择对应指南：
   - 单元测试 → [单元测试指南](guides/unit-testing-guide.md)
   - 集成测试 → [集成测试指南](guides/integration-testing-guide.md)
3. 查看 [当前覆盖率](coverage/current-coverage.md) 确定优先级

---

## 📊 当前状态

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 总体覆盖率 | 34% | 80%+ |
| data_adapter.py | 82% | 85%+ |
| features/technical.py | 0% | 80%+ |
| ml_pipeline.py | 0% | 75%+ |

---

## 🔗 相关资源

- [项目 README](../../README.md)
- [测试框架文档](../../tests/README.md)
- [企业级评估](../QUANT_ENTERPRISE_ASSESSMENT.md)
- [项目计划](../PROJECT_PLAN.md)

---

**维护者**: test-engineer, tech-writer
**最后更新**: 2026-04-14
