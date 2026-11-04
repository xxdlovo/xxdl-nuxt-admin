/**
 * 复制文本到剪贴板。
 *
 * `navigator.clipboard` 只在安全上下文（HTTPS / localhost / 127.0.0.1）可用，
 * 通过 `http://IP:端口` 访问后台时不可用，因此保留 textarea + execCommand 回退。
 *
 * 只负责复制本身并返回是否成功；toast、图标反馈等由调用方决定
 * （参考 app/components/base/CopyValueBadge.vue）。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) {
        return false
    }

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        }
        catch {
            // 权限被拒或非安全上下文，继续尝试回退方案
        }
    }

    try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()

        const succeeded = document.execCommand('copy')
        textarea.remove()

        return succeeded
    }
    catch {
        return false
    }
}
