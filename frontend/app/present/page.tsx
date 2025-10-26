'use client';

import React, { useState, useEffect } from 'react';
import { Slide } from '@/components/slides/Slide';
import type { PartialSlide } from 'schema';

export default function PresentPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Example slides - In production, these would come from props/API
  const testSlides: PartialSlide[] = [
    {
      title: '**Welcome** to LectureGen',
      content: `# Introduction

This is an automated lecture generation system that transforms your content into beautiful presentations.

## Key Features

- **Markdown-based content** - Write naturally
- *Rich formatting* - Style your text
- \`Code support\` - Show technical content
- Real-time chat interaction

> "Education is the most powerful weapon which you can use to change the world." - Nelson Mandela`,
    },
    {
      title: 'Header Demonstration',
      content: `# This H1 becomes H2

This slide demonstrates the automatic header downgrading feature.

## This H2 stays H2

All H1 headers in the content are automatically converted to H2 to maintain proper hierarchy.

### This H3 stays H3

Lower-level headers remain unchanged.`,
    },
    {
      title: 'Lists and Formatting',
      content: `# Types of Lists

## Unordered Lists

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

## Ordered Lists

1. First step
2. Second step
3. Third step

## Mixed Formatting

You can combine **bold**, *italic*, and \`code\` in your lists.`,
    },
    {
      title: 'Visual Content',
      content: `# Working with Images

Images help convey complex ideas quickly and make presentations more engaging.

## When to use images:

1. Illustrating concepts
2. Showing data visualizations
3. Breaking up text-heavy slides`,
      image: 'https://via.placeholder.com/800x400/4299e1/ffffff?text=Sample+Image',
    },
    {
      title: 'System Architecture',
      content: `# Flow Diagram

This demonstrates mermaid diagram support for visualizing system architecture.`,
      diagram: `graph TD
    A[User Input] --> B[Process Markdown]
    B --> C{Has Image?}
    C -->|Yes| D[Load Image]
    C -->|No| E[Skip Image]
    D --> F[Render Slide]
    E --> F
    F --> G[Display to User]`,
    },
    {
      title: 'Code Examples',
      content: `# Displaying Code

\`\`\`typescript
interface PartialSlide {
  title: string;
  content?: string;
  diagram?: string;
  image?: string;
}

function renderSlide(slide: PartialSlide) {
  console.log(\`Rendering: \${slide.title}\`);
}
\`\`\`

Inline code: \`const x = 5;\``,
    },
    {
      title: 'Thank You!',
      content: `# Questions?

Feel free to ask questions in the chat!

## Resources

- Check out the documentation
- Explore the codebase
- Try it yourself!

---

**Built with LectureGen** 🎓`,
    },
  ];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        // Exit presentation mode (go back or close)
        window.close();
        // If window.close() doesn't work (not opened by script), navigate back
        if (!window.closed) {
          window.history.back();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlide(testSlides.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, testSlides.length]);

  const nextSlide = () => {
    if (currentSlide < testSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const exitPresentation = () => {
    window.close();
    if (!window.closed) {
      window.location.href = '/mdx/mdx-test';
    }
  };

  return (
    <div className="h-screen w-screen flex bg-gray-900 overflow-hidden">
      {/* Main Presentation Area - Takes remaining space (calc(100% - 200px)) */}
      <div className="flex-1 flex flex-col">
        {/* Slide Display - Takes remaining vertical space */}
        <div className="flex-1 overflow-hidden">
          <Slide lectureSlides={testSlides} i={currentSlide} />
        </div>

        {/* Navigation Controls - Fixed height at bottom */}
        <div className="bg-gray-800 text-white p-3 shadow-lg">
          <div className="max-w-full mx-auto flex items-center justify-between">
            {/* Left: Previous Button */}
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              ← Previous
            </button>

            {/* Center: Slide Indicators */}
            <div className="flex items-center gap-2">
              {testSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? 'bg-blue-500 w-8'
                      : 'bg-gray-500 hover:bg-gray-400 w-2'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                  title={testSlides[index].title}
                />
              ))}
            </div>

            {/* Right: Next Button */}
            <button
              onClick={nextSlide}
              disabled={currentSlide === testSlides.length - 1}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              Next →
            </button>
          </div>

          {/* Slide Info Row */}
          <div className="max-w-full mx-auto mt-2 flex justify-between items-center text-xs text-gray-400">
            <div className="flex gap-4">
              <span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">←</kbd>{' '}
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">→</kbd> Navigate
              </span>
              <span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">ESC</kbd> Exit
              </span>
            </div>
            <div className="font-medium text-white">
              Slide {currentSlide + 1} / {testSlides.length}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - 200px Chat Area (Placeholder for now) */}
      <div className="w-[200px] bg-gray-800 border-l border-gray-700 flex flex-col">
        {/* Chat Header */}
        <div className="p-3 border-b border-gray-700 flex justify-between items-center">
          <h3 className="text-white font-semibold text-sm">Chat</h3>
          <button
            onClick={exitPresentation}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700"
            title="Exit Presentation"
          >
            ✕
          </button>
        </div>

        {/* Chat Content Area - Placeholder */}
        <div className="flex-1 overflow-y-auto p-3 text-gray-400 text-xs">
          <p className="mb-2">Chat will appear here.</p>
          <p className="text-gray-500">Ask questions during the presentation!</p>
        </div>

        {/* Chat Input - Placeholder */}
        <div className="p-2 border-t border-gray-700">
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full px-3 py-2 bg-gray-900 text-white text-xs rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled
          />
        </div>
      </div>
    </div>
  );
}
