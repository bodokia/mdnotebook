import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import githubLightUrl from 'highlight.js/styles/github.css?url'
import githubDarkUrl from 'highlight.js/styles/github-dark.css?url'

interface Props {
  content: string
  theme: 'light' | 'dark'
}

export default function Preview({ content, theme }: Props) {
  useEffect(() => {
    let link = document.getElementById('hljs-theme') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = 'hljs-theme'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = theme === 'dark' ? githubDarkUrl : githubLightUrl
  }, [theme])

  return (
    <div
      className="prose max-w-none p-6 pb-16"
      style={{
        '--tw-prose-body': 'var(--text)',
        '--tw-prose-headings': 'var(--text)',
        '--tw-prose-bold': 'var(--text)',
        '--tw-prose-code': 'var(--text)',
        '--tw-prose-pre-bg': 'var(--surface)',
        '--tw-prose-links': 'var(--accent)',
        '--tw-prose-quotes': 'var(--text-muted)',
        '--tw-prose-hr': 'var(--border)',
        '--tw-prose-th-borders': 'var(--border)',
        '--tw-prose-td-borders': 'var(--border)',
        fontFamily: "'Lora', Georgia, serif",
      } as React.CSSProperties}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
