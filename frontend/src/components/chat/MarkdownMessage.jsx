import { Children, isValidElement, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

const REMARK_PLUGINS = [remarkGfm];

function extractText(node) {
  return Children.toArray(node)
    .map((child) => (typeof child === 'string' ? child : isValidElement(child) ? extractText(child.props.children) : ''))
    .join('');
}

/* Defined once at module level so ReactMarkdown does not re-create renderers on each render. */
const MARKDOWN_COMPONENTS = {
  // Fenced code blocks arrive wrapped in <pre><code class="language-x">; render them with our CodeBlock.
  pre({ children }) {
    const codeElement = Children.toArray(children).find(isValidElement);
    const language = /language-([\w+#-]+)/.exec(codeElement?.props?.className ?? '')?.[1];
    const code = extractText(codeElement?.props?.children).replace(/\n$/, '');

    return <CodeBlock code={code} language={language} />;
  },
  // Only inline code reaches this renderer because `pre` consumes block code.
  code({ children }) {
    return <code className="inline-code">{children}</code>;
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="scrollbar-thin my-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table>{children}</table>
      </div>
    );
  }
};

/** Render assistant text as GitHub-flavoured markdown. Memoised: only re-renders when the text changes. */
function MarkdownMessage({ content }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownMessage);
