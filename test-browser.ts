import { BrowserTool } from './src/tools/BrowserTool/BrowserTool.js'

async function test() {
  console.log('Testing BrowserTool...\n')

  try {
    // 测试 navigate 操作
    console.log('1. Testing navigate action...')
    const result = await BrowserTool.callWithBlocks({
      action: 'navigate',
      url: 'https://example.com'
    })

    console.log('Result:', result)
    console.log('\n✅ Navigate test completed')

    // 关闭浏览器
    console.log('\n2. Closing browser...')
    await BrowserTool.callWithBlocks({
      action: 'close'
    })
    console.log('✅ Browser closed')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

test()
