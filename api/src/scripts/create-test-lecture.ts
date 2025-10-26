import { lectureDoc } from "../lib/firebase_admin.js";
import type { Lecture } from "schema";

async function createTestLecture() {
  const testLectureId = "test-lecture-123";

  console.log('[TEST-SCRIPT] Starting test lecture creation...');
  console.log(`[TEST-SCRIPT] Lecture ID: ${testLectureId}`);

  const sampleLecture: Lecture = {
    version: 1,
    permitted_users: ["test-user"],
    slides: [
      {
        transcript: "Welcome to our first slide about neural networks",
        audio_transcription_link: "",
        title: "Introduction to Neural Networks",
        content: `## What are Neural Networks?

Neural networks are computing systems inspired by biological neural networks.

### Key Components:
- **Input Layer**: Receives data
- **Hidden Layers**: Process information
- **Output Layer**: Produces results

> Neural networks learn from experience, just like humans do.`,
        diagram: `graph LR
    A[Input Layer] --> B[Hidden Layer 1]
    B --> C[Hidden Layer 2]
    C --> D[Output Layer]
    D --> E[Prediction]`,
        image: "https://via.placeholder.com/800x400/4299e1/ffffff?text=Neural+Network+Architecture",
      },
      {
        transcript: "Now let's look at how data flows through the network",
        audio_transcription_link: "",
        title: "Data Flow Process",
        content: `## Forward Propagation

Data flows from input to output through multiple layers.

### Steps:
1. Input data enters the network
2. Each layer applies weights and activation functions
3. Information passes to the next layer
4. Final layer produces the prediction

\`\`\`python
def forward_pass(input_data, weights):
    activation = input_data
    for layer_weights in weights:
        activation = activate(layer_weights @ activation)
    return activation
\`\`\``,
        diagram: `sequenceDiagram
    participant Input
    participant Layer1
    participant Layer2
    participant Output

    Input->>Layer1: Forward pass
    Layer1->>Layer2: Activated values
    Layer2->>Output: Final prediction`,
      },
      {
        transcript: "Training involves adjusting weights to minimize errors",
        audio_transcription_link: "",
        title: "Training Process",
        content: `## Backpropagation

The network learns by adjusting weights based on errors.

### Training Loop:
1. **Forward pass**: Make a prediction
2. **Calculate loss**: Compare to actual value
3. **Backward pass**: Compute gradients
4. **Update weights**: Adjust to reduce error
5. **Repeat**: Until convergence

The learning rate determines how quickly the network adapts.`,
        image: "https://via.placeholder.com/800x400/48bb78/ffffff?text=Training+Process",
      },
      {
        transcript: "Let's see a complete example with code",
        audio_transcription_link: "",
        title: "Code Example",
        content: `## Simple Neural Network in Python

Here's a minimal implementation:

\`\`\`python
import numpy as np

class NeuralNetwork:
    def __init__(self, layers):
        self.weights = [np.random.randn(y, x)
                       for x, y in zip(layers[:-1], layers[1:])]

    def forward(self, x):
        for w in self.weights:
            x = self.sigmoid(w @ x)
        return x

    def sigmoid(self, x):
        return 1 / (1 + np.exp(-x))

# Create a 3-layer network
nn = NeuralNetwork([784, 128, 10])
prediction = nn.forward(input_data)
\`\`\`

This creates a network with:
- **784** input neurons (28x28 image)
- **128** hidden neurons
- **10** output neurons (digits 0-9)`,
      },
      {
        transcript: "Summary of what we learned today",
        audio_transcription_link: "",
        title: "Summary",
        content: `## Key Takeaways

We covered the fundamentals of neural networks:

### Main Concepts:
- ✅ Network architecture (layers and neurons)
- ✅ Forward propagation (making predictions)
- ✅ Backpropagation (learning from errors)
- ✅ Practical implementation in Python

### Next Steps:
1. Practice with different architectures
2. Experiment with learning rates
3. Try real datasets
4. Explore deep learning frameworks

---

**Thank you for learning with us!** 🎓

*Questions? Feel free to explore the code examples.*`,
        diagram: `graph TD
    A[Neural Networks] --> B[Architecture]
    A --> C[Forward Pass]
    A --> D[Backpropagation]
    A --> E[Implementation]

    B --> F[Layers & Neurons]
    C --> G[Making Predictions]
    D --> H[Learning]
    E --> I[Python Code]`,
      },
    ],
  };

  try {
    console.log('[TEST-SCRIPT] Connecting to Firebase...');
    const lectureRef = lectureDoc(testLectureId);

    console.log('[TEST-SCRIPT] Writing lecture to Firebase...');
    console.log(`[TEST-SCRIPT] Document path: lectures/${testLectureId}`);
    console.log(`[TEST-SCRIPT] Lecture data:`, {
      version: sampleLecture.version,
      slideCount: sampleLecture.slides.length,
      permittedUsers: sampleLecture.permitted_users
    });

    await lectureRef.set(sampleLecture);

    console.log(`\n✅ Test lecture created successfully!`);
    console.log(`📝 Lecture ID: ${testLectureId}`);
    console.log(`🔗 View at: http://localhost:3000/mdx?id=${testLectureId}`);
    console.log(`\n📊 Lecture contains ${sampleLecture.slides.length} slides:`);
    sampleLecture.slides.forEach((slide, idx) => {
      console.log(`  ${idx + 1}. ${slide.title}`);
      if (slide.content) console.log(`     └─ Has content (${slide.content.length} chars) ✓`);
      if (slide.diagram) console.log(`     └─ Has diagram ✓`);
      if (slide.image) console.log(`     └─ Has image ✓`);
      if (slide.transcript) console.log(`     └─ Has transcript (${slide.transcript.length} chars) ✓`);
    });

    console.log(`\n[TEST-SCRIPT] Firebase write completed successfully`);
  } catch (error) {
    console.error("[TEST-SCRIPT] ❌ Error creating test lecture:", error);
    if (error instanceof Error) {
      console.error("[TEST-SCRIPT] Error message:", error.message);
      console.error("[TEST-SCRIPT] Error stack:", error.stack);
    }
    process.exit(1);
  }
}

createTestLecture()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
