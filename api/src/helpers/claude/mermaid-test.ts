// import { generateMermaidDiagram } from './mermaid.js';
// import { LLM } from './llm.js';
// import * as dotenv from 'dotenv';

// dotenv.config();

// async function testDiagramGeneration() {
//   console.log('=== Testing Mermaid Diagram Generation ===\n');

//   // Initialize LLM
//   const llm = new LLM(process.env.ANTHROPIC_API_KEY!);

//   // Test 1: Neural network diagram
//   console.log('--- Test 1: Neural Network Flowchart ---');
//   try {
//     const mermaid1 = await generateMermaidDiagram(llm, {
//       diagram_type: 'flowchart-LR',
//       extended_description: 'Create a flowchart showing the flow of data through a neural network from input layer through hidden layers to output layer for predictions'
//     });
//     console.log('Mermaid Code:');
//     console.log(mermaid1);
//     console.log();
//   } catch (error) {
//     console.error('Error:', error);
//   }

//   // Test 2: Photosynthesis process
//   console.log('--- Test 2: Photosynthesis Process ---');
//   try {
//     const mermaid2 = await generateMermaidDiagram(llm, {
//       transcript: `
//         Photosynthesis converts light energy into chemical energy in two stages.
//         First, light-dependent reactions split water and produce ATP.
//         Then, the Calvin cycle uses that ATP to convert CO2 into glucose.
//       `,
//       diagram_type: 'flowchart-TB',
//       extended_description: 'Create a flowchart diagram showing the two-stage process of photosynthesis'
//     });
//     console.log('Mermaid Code:');
//     console.log(mermaid2);
//     console.log();
//   } catch (error) {
//     console.error('Error:', error);
//   }

//   // Test 3: Class hierarchy
//   console.log('--- Test 3: Programming Class Hierarchy ---');
//   try {
//     const mermaid3 = await generateMermaidDiagram(llm, {
//       transcript: `
//         In object-oriented programming, we have a base Animal class.
//         Dog and Cat inherit from Animal. Dog has a bark method while Cat has a meow method.
//         All animals have an eat method.
//       `,
//       diagram_type: 'classDiagram',
//       extended_description: 'Create a class diagram showing the inheritance hierarchy of Animal, Dog, and Cat classes'
//     });
//     console.log('Mermaid Code:');
//     console.log(mermaid3);
//     console.log();
//   } catch (error) {
//     console.error('Error:', error);
//   }

//   console.log('✓ All tests completed!');
// }

// testDiagramGeneration();
