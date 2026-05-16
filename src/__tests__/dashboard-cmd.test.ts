// 快速测试：验证 dashboard 命令注册
import { getRegistry } from '../commands/index.js'
import '../commands/clear.js'
import '../commands/help.js'
import '../commands/compact.js'
import '../commands/report.js'
import '../commands/exit.js'
import '../commands/dream.js'
import '../commands/dashboard.js'

const cmds = getRegistry()
console.log('已注册命令:')
for (const c of cmds) {
  console.log(`  /${c.name} - ${c.description}`)
}

const dashboard = cmds.find(c => c.name === 'dashboard')
if (dashboard) {
  console.log('\n✅ dashboard 命令已注册成功')
} else {
  console.log('\n❌ dashboard 命令未找到！')
  process.exit(1)
}
