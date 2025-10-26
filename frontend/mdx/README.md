# Slide Rendering System

Documentation for the LectureGen slide rendering system.

## Overview

Two modes for viewing slides:
1. **Test/Browse Mode** (`/mdx/mdx-test`) - With navbar/footer
2. **Presentation Mode** (`/present`) - Fullscreen, no navbar/footer

## Presentation Mode Features

### Layout
- **100vh fullscreen** - No scrolling, fits entire viewport
- **200px chat sidebar** on right (placeholder for future chat)
- **No navbar/footer** - Clean presentation view
- **Opens in new tab/window**

### Keyboard Shortcuts
- `←` `→` Navigate between slides
- `Space` Next slide
- `Home` Go to first slide
- `End` Go to last slide
- `ESC` Exit presentation mode

### Access
```
http://localhost:3000/present           # Direct access
http://localhost:3000/mdx/mdx-test      # Click "Open Presentation Mode" button
```

## File Structure

```
frontend/
├── app/
│   ├── mdx/
│   │   └── mdx-test/
│   │       └── page.tsx        # Test/Browse mode
│   └── present/
│       └── page.tsx            # Presentation mode (fullscreen)
├── components/
│   └── slides/
│       └── Slide.tsx           # Slide rendering component
└── mdx/
    └── README.md               # This file
```

## Component Usage

```tsx
import { Slide } from '@/components/slides/Slide';
import type { PartialSlide } from 'schema';

const slides: PartialSlide[] = [
  {
    title: "My Title",
    content: "# Content here",
    image: "https://...",
    diagram: "graph TD\nA-->B"
  }
];

<Slide lectureSlides={slides} i={0} />
```

## Type Definition

From `/types/index.d.ts`:

```typescript
type PartialSlide = Omit<LectureSlide, "transcript" | "audio_transcription_link">

// Expands to:
type PartialSlide = {
  title: string;        // Required
  content?: string;     // Optional markdown
  diagram?: string;     // Optional mermaid diagram
  image?: string;       // Optional image URL
}
```

## Future: Chat Integration

The 200px sidebar in presentation mode is reserved for real-time chat functionality where users can ask questions during the presentation.
