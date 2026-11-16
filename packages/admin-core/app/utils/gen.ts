/**
 * 代码生成下载与预览辅助。
 */

import type { GenFile } from '#admin/shared/system/gen'

export type GenFileTreeNode = {
    id: string
    label: string
    path?: string
    icon?: string
    children?: GenFileTreeNode[]
}

function fileIcon(path: string) {
    if (path.endsWith('.vue')) return 'i-lucide-file-code-2'
    if (path.endsWith('.ts')) return 'i-lucide-file-code'
    if (path.endsWith('.json')) return 'i-lucide-file-json'
    if (path.endsWith('.sql')) return 'i-lucide-database'
    if (path.endsWith('.md')) return 'i-lucide-file-text'
    return 'i-lucide-file'
}

/**
 * 把生成器的扁平文件列表转成目录树。
 *
 * - 目录在前、文件在后，各自按名称排序；
 * - 节点 id 使用完整相对路径，避免同名目录/文件冲突。
 */
export function buildGenFileTree(files: GenFile[]): GenFileTreeNode[] {
    const roots: GenFileTreeNode[] = []

    for (const file of files) {
        const segments = file.path.split('/').filter(Boolean)
        let currentLevel = roots
        let currentPath = ''

        segments.forEach((segment, index) => {
            currentPath = currentPath ? `${currentPath}/${segment}` : segment
            const isFile = index === segments.length - 1
            let node = currentLevel.find(item => item.label === segment)

            if (!node) {
                node = {
                    id: currentPath,
                    label: segment,
                    path: isFile ? file.path : undefined,
                    icon: isFile ? fileIcon(segment) : undefined,
                    children: isFile ? undefined : [],
                }
                currentLevel.push(node)
            }

            if (!isFile) {
                currentLevel = node.children!
            }
        })
    }

    const sortNodes = (nodes: GenFileTreeNode[]): GenFileTreeNode[] => {
        return nodes
            .sort((a, b) => {
                const aFolder = a.children ? 0 : 1
                const bFolder = b.children ? 0 : 1
                return aFolder - bFolder || a.label.localeCompare(b.label)
            })
            .map(node => ({
                ...node,
                children: node.children ? sortNodes(node.children) : undefined,
            }))
    }

    return sortNodes(roots)
}

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

export async function downloadGenZip(id: string, filename = 'codegen.zip') {
    const response = await fetch('/api/system/gen/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    })

    if (!response.ok) {
        throw new Error(await response.text() || 'download failed')
    }

    saveBlob(await response.blob(), filename)
}
