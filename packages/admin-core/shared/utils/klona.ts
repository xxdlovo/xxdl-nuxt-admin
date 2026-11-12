// 直接 re-export：先 `import ... as` 再 `export` 会让 Vite 的 tree-shaking 分析
// 误判为「导入了但未使用」，构建时刷一条 klona 未使用的外部模块警告。
// 这种写法对打包器是透明的，不会再提示。
export { klona as jsonClone } from 'klona/json'
