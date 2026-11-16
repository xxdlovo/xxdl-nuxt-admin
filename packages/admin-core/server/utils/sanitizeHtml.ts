import sanitizeHtml from 'sanitize-html'

/**
 * 公告富文本清洗。
 *
 * 只允许常见排版标签与安全属性；脚本、样式、iframe、on* 事件和
 * javascript: 链接都会被移除，兼容历史脏数据。
 */
const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div', 'hr',
]

export function sanitizeRichText(content?: string | null) {
    if (!content) {
        return ''
    }

    return sanitizeHtml(content, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {
            a: ['href', 'target', 'rel', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            '*': ['class'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesByTag: {
            img: ['http', 'https'],
        },
        transformTags: {
            a: (tagName, attribs) => ({
                tagName,
                attribs: {
                    ...attribs,
                    rel: 'noopener noreferrer nofollow',
                },
            }),
        },
    })
}
