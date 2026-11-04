Nuxt Icon 本地 SVG 格式说明

本目录用于 nuxt.config.ts 中的 icon.customCollections 配置：

icon: {
  provider: 'server',
  customCollections: [{
    prefix: 'custom',
    dir: './app/assets/icons'
  }]
}

SVG 文件要求：

1. 文件扩展名必须是 .svg。
2. 文件名建议使用小写字母、数字和短横线，例如 zledu.svg、menu-logo.svg。
3. 根节点必须是 <svg>。
4. <svg> 必须包含 viewBox，例如：

   <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
     <path d="..." fill="currentColor"/>
   </svg>

5. width 和 height 可以保留，但不能替代 viewBox。
6. 不要只依赖 <?xml ...?>、DOCTYPE 或外部资源；图形内容应直接写在 SVG 内部。
7. 图标如果希望跟随文字颜色变化，fill/stroke 使用 currentColor；如果是品牌彩色图标，可以保留固定色值。
8. 不建议在 SVG 中引用外部图片、字体、CSS 文件或脚本。

使用方式：

文件 app/assets/icons/zledu.svg 对应图标名：

custom:zledu

在组件中可写：

<UIcon name="custom:zledu" />

如果使用 i- 前缀形式，可写：

<UIcon name="i-custom-zledu" />

常见错误：

如果缺少 viewBox，Nuxt Icon 可能无法解析 SVG，生成的 custom collection 会是空的，并可能在页面中出现：

Failed to load custom icons Error: Invalid dataundefined
