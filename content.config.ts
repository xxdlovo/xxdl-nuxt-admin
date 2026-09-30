import { defineContentConfig, defineCollection } from '@nuxt/content'
import { resolve as resolvePath } from 'node:path'
export default defineContentConfig({
    collections: {
        content: defineCollection({
            type: 'page',
            source: {
                // 将项目根目录下的 doc/ 转成绝对路径，保证 Nuxt Content
                // 在不同启动目录和 Windows 路径分隔符下都能稳定读取 Markdown。
                cwd: resolvePath('doc'),
                // 同时收集 Markdown 页面与目录导航配置；`.navigation.yml`
                // 只用于生成目录标题、图标和顺序，不会作为普通页面显示。
                include: '**/*.{md,yml}',
            }
        })
    }
})
