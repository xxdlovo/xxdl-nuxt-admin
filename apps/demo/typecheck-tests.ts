#!/usr/bin/env tsx
/**
 * 类型检查测试文件
 * 仅检查 tests 目录，排除 node_modules
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const rootDir = process.cwd()

console.log('🔍 开始检查测试文件类型错误...\n')

// 创建临时的 tsconfig 用于测试类型检查
const testTsconfig = {
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'bundler',
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    noEmit: true,
    skipLibCheck: true,  // 跳过 node_modules 类型检查
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    types: ['node'],
  },
  include: [
    'tests/**/*.ts',
    'tests/**/*.spec.ts',
    'tests/**/*.test.ts',
    'server/**/*.ts',
    'shared/**/*.ts'
  ],
  exclude: [
    'node_modules/**',
    '.nuxt/**',
    'dist/**',
    'output/**'
  ],
  tsconfigRootDir: rootDir
}

// 写入临时配置
const tempConfigPath = path.join(rootDir, 'tsconfig.test.json')
fs.writeFileSync(tempConfigPath, JSON.stringify(testTsconfig, null, 2))

// 使用 tsc 进行类型检查
const tsc = spawn('npx', ['tsc', '--project', tempConfigPath], {
  stdio: 'inherit',
  shell: true
})

tsc.on('close', (code) => {
  // 删除临时配置
  fs.unlinkSync(tempConfigPath)

  if (code === 0) {
    console.log('\n✅ 类型检查通过，没有发现类型错误')
  } else {
    console.log('\n❌ 发现类型错误')
    process.exit(1)
  }
})
