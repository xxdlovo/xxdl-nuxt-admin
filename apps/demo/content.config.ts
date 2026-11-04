import { defineContentConfig, defineCollection } from '@nuxt/content'
import { resolve as resolvePath } from 'node:path'
export default defineContentConfig({
    collections: {
        content: defineCollection({
            type: 'page',
            source: {
                // 默认系统文档只从 doc/main/ 读取。业务文档与默认文档各自拥有
                // 独立的源目录，避免一个集合扫描到另一个集合的 Markdown。
                cwd: resolvePath('doc/main'),
                // 同时收集 Markdown 页面与目录导航配置；`.navigation.yml`
                // 只用于生成目录标题、图标和顺序，不会作为普通页面显示。
                include: '**/*.{md,yml}',
            }
        }),
        moduleA: defineCollection({
            type: 'page',
            source: {
                // 业务 A 单独从 doc/moduleA/ 读取，避免与默认系统文档混用路径。
                cwd: resolvePath('doc/moduleA'),
                // 同时收集 Markdown 页面与目录导航配置；`.navigation.yml`
                // 只用于生成目录标题、图标和顺序，不会作为普通页面显示。
                include: '**/*.{md,yml}',
            }
        })
    }
})
