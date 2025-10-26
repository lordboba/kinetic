'use client';

import React, { useState, useEffect } from 'react';
import { Slide } from '@/components/slides/Slide';
import type { PartialSlide } from 'schema';

export default function MDXTestPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Example slides demonstrating all features
  const testSlides: PartialSlide[] = [
    // Slide 1: Simple text slide with markdown formatting
    {
      title: '**Welcome** to LectureGen',
      content: `# Introduction

This is an automated lecture generation system that transforms your content into beautiful presentations.

## Key Features

- **Markdown-based content** - Write naturally
- *Rich formatting* - Style your text
- \`Code support\` - Show technical content
- And much more!

> "Education is the most powerful weapon which you can use to change the world." - Nelson Mandela`,
    },

    // Slide 2: Slide with headers that need downgrading
    {
      title: 'Header Demonstration',
      content: `# This H1 becomes H2

This slide demonstrates the automatic header downgrading feature.

## This H2 stays H2

All H1 headers in the content are automatically converted to H2 to maintain proper hierarchy.

### This H3 stays H3

Lower-level headers remain unchanged.`,
    },

    // Slide 3: Slide with bullet points and numbered lists
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

You can combine **bold**, *italic*, and \`code\` in your lists:

- **Important point** with emphasis
- *Subtle note* in italics
- Technical term: \`react-markdown\``,
    },

    // Slide 4: Slide with an image
    {
      title: 'Visual Content',
      content: `# Working with Images

Images help convey complex ideas quickly and make presentations more engaging.

## When to use images:

1. Illustrating concepts
2. Showing data visualizations
3. Breaking up text-heavy slides
4. Adding visual interest

The image will appear below this content.`,
      image: 'https://via.placeholder.com/800x400/4299e1/ffffff?text=Sample+Presentation+Image',
    },

    // Slide 5: Slide with a mermaid diagram
    {
      title: 'System Architecture',
      content: `# Flow Diagram

This slide demonstrates mermaid diagram support for visualizing system architecture.

## Our Processing Pipeline

The diagram below shows how data flows through the system:`,
      diagram: `graph TD
    A[User Input] --> B[Process Markdown]
    B --> C{Has Image?}
    C -->|Yes| D[Load Image]
    C -->|No| E[Skip Image]
    D --> F[Render Slide]
    E --> F
    F --> G[Display to User]`,
    },

    // Slide 6: Slide with both image and diagram
    {
      title: 'Complete Example',
      content: `# Full-Featured Slide

This slide demonstrates all features working together:

- Markdown content with formatting
- An embedded image
- A mermaid diagram

## Content Section

You can have **bold text**, *italic text*, and even \`inline code\`.

### Subsection

More detailed information can go in subsections.`,
      image: 'https://via.placeholder.com/600x250/48bb78/ffffff?text=Combined+Features',
      diagram: `graph LR
    A[Markdown] --> D[Slide]
    B[Image] --> D
    C[Diagram] --> D
    D --> E[Beautiful Presentation]`,
    },

    // Slide 7: Code block example
    {
      title: 'Code Examples',
      content: `# Displaying Code

You can include code blocks in your slides:

## TypeScript Example

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

## Python Example

\`\`\`python
def hello_world():
    print("Hello from LectureGen!")
    return True
\`\`\`

Inline code works too: \`const x = 5;\``,
    },

    // Slide 8: Complex mermaid diagram
    {
      title: 'Advanced Diagrams',
      content: `# Sequence Diagram

Mermaid supports various diagram types including sequence diagrams, class diagrams, and more.

## User Interaction Flow

Below is a sequence diagram showing the interaction between components:`,
      diagram: `sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant AI

    User->>Frontend: Request Lecture
    Frontend->>Backend: Send Topic
    Backend->>AI: Generate Content
    AI->>Backend: Return Slides
    Backend->>Frontend: Send Slides
    Frontend->>User: Display Presentation`,
    },

    // Slide 9: Title-only slide (minimal content)
    {
      title: 'Thank You!',
      content: `# Questions?

Feel free to explore the code and documentation.

## Resources

- Check out the README in \`frontend/mdx/README.md\`
- View the component source in \`components/slides/Slide.tsx\`
- Explore type definitions in \`types/index.d.ts\`

---

**Built with LectureGen** 🎓`,
    },
  ];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

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

  const openPresentation = () => {
    window.open('/present', '_blank', 'width=1200,height=800');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Slide Display - Takes remaining space */}
      <div className="flex-1 overflow-hidden relative">
        <Slide lectureSlides={testSlides} i={currentSlide} />

        {/* Present Button - Floating */}
        <button
          onClick={openPresentation}
          className="absolute top-4 right-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg font-medium text-sm flex items-center gap-2"
        >
          <span>🎬</span> Open Presentation Mode
        </button>
      </div>

      {/* Navigation Controls - Fixed height at bottom */}
      <div className="bg-gray-800 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Previous Button */}
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            ← Previous
          </button>

          {/* Slide Indicators */}
          <div className="flex items-center gap-2">
            {testSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentSlide
                    ? 'bg-blue-500 w-8'
                    : 'bg-gray-500 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
                title={testSlides[index].title}
              />
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={nextSlide}
            disabled={currentSlide === testSlides.length - 1}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            Next →
          </button>
        </div>

        {/* Slide Counter and Help Text */}
        <div className="max-w-6xl mx-auto mt-2 flex justify-between items-center text-sm text-gray-400">
          <div>
            Use keyboard: <kbd className="px-2 py-1 bg-gray-700 rounded">←</kbd>{' '}
            <kbd className="px-2 py-1 bg-gray-700 rounded">→</kbd> to navigate
          </div>
          <div className="font-medium">
            Slide {currentSlide + 1} of {testSlides.length}
          </div>
        </div>
      </div>

    </div>
  );
}
