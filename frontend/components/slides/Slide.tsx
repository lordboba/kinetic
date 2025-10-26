'use client';

import React, { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import mermaid from 'mermaid';
import type { PartialSlide } from 'schema';

interface SlideProps {
  lectureSlides: PartialSlide[];
  i: number;
}

export function Slide({ lectureSlides, i }: SlideProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const slide = lectureSlides[i];

  // Initialize mermaid on component mount
  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  }, []);

  // Render mermaid diagram when slide changes
  useEffect(() => {
    if (slide.diagram && mermaidRef.current) {
      // Clear previous diagram
      mermaidRef.current.innerHTML = '';

      // Create a unique ID for this diagram
      const id = `mermaid-${i}-${Date.now()}`;

      // Render the mermaid diagram
      mermaid.render(id, slide.diagram).then(({ svg }) => {
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = svg;
        }
      }).catch((error) => {
        console.error('Mermaid rendering error:', error);
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `<pre class="text-red-600 p-4 bg-red-50 rounded">${error.message}</pre>`;
        }
      });
    }
  }, [slide.diagram, i]);

  /**
   * Downgrade all H1 headers to H2 in the content
   * Regex explanation: ^# (.+)$ matches lines starting with "# " (H1)
   * and replaces them with "## " (H2)
   */
  function downgradeHeaders(markdown: string): string {
    return markdown.replace(/^# (.+)$/gm, '## $1');
  }

  // Process the content: downgrade H1 to H2
  const processedContent = slide.content ? downgradeHeaders(slide.content) : '';

  // Combine title (as H1) with processed content
  const fullMarkdown = `# ${slide.title}\n\n${processedContent}`;

  return (
    <div className="slide relative w-full h-full bg-white p-12 overflow-auto">
      {/* Markdown Content */}
      <div className="markdown-content prose prose-lg max-w-none">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-5xl font-bold text-gray-900 mb-6 border-b-4 border-blue-600 pb-4">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-3xl font-semibold text-gray-800 mb-4 mt-8">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-2xl font-semibold text-gray-700 mb-3 mt-6">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-xl font-semibold text-gray-600 mb-2 mt-4">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="text-lg text-gray-700 mb-4 leading-relaxed">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-2 mb-4 text-lg ml-6">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-2 mb-4 text-lg ml-6">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-gray-700">{children}</li>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              return isInline ? (
                <code className="bg-gray-100 text-red-600 px-2 py-1 rounded text-sm font-mono">
                  {children}
                </code>
              ) : (
                <code className={className}>{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4 text-sm">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-blue-500 pl-6 py-2 italic text-gray-600 mb-4 bg-blue-50">
                {children}
              </blockquote>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-gray-900">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-gray-700">{children}</em>
            ),
            table: ({ children }) => (
              <table className="min-w-full border-collapse border border-gray-300 mb-4">
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 px-4 py-2">
                {children}
              </td>
            ),
          }}
        >
          {fullMarkdown}
        </Markdown>
      </div>

      {/* Image (if exists) */}
      {slide.image && (
        <div className="slide-image mt-8 mb-8">
          <img
            src={slide.image}
            alt={slide.title}
            className="rounded-lg shadow-lg max-w-full h-auto mx-auto"
          />
        </div>
      )}

      {/* Mermaid Diagram (if exists) */}
      {slide.diagram && (
        <div className="slide-diagram mt-8 mb-8">
          <div
            ref={mermaidRef}
            className="mermaid-container p-6 bg-gray-50 rounded-lg border-2 border-gray-200 flex justify-center items-center"
          />
        </div>
      )}
    </div>
  );
}
