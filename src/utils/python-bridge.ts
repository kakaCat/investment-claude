// Python 桥接工具 - 用于调用 Python 脚本（akshare 等）
import { spawn } from 'child_process'
import path from 'path'

/**
 * 调用 Python 脚本并返回结果
 * @param functionName Python 函数名
 * @param args 函数参数
 * @returns Python 函数返回的数据
 */
export async function callPython(functionName: string, args: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    // Python 脚本路径
    const pythonScript = path.join(process.cwd(), 'python', 'akshare_bridge.py')

    // 构造命令参数 - 匹配 Python 脚本的接口
    const argsJson = JSON.stringify(args)

    // 使用 miniconda Python 3.12（已安装 akshare）而非系统 Python 3.8
    const pythonExecutable = '/opt/miniconda3/bin/python3'
    const pythonProcess = spawn(pythonExecutable, [pythonScript, functionName, argsJson])

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}\nStderr: ${stderr}`))
        return
      }

      try {
        const result = JSON.parse(stdout)
        // Python 脚本返回 {error: ...} 或直接返回数据
        resolve(result)
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${stdout}\nError: ${error}`))
      }
    })

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`))
    })
  })
}
