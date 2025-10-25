import { generateMermaidDiagram } from './mermaid.js';
import { LLM } from './llm.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testDiagramGeneration() {
  console.log('=== Testing Mermaid Diagram Generation ===\n');

  // Initialize LLM
  const llm = new LLM(process.env.ANTHROPIC_API_KEY!);

  // Test 1: Neural network diagram
  console.log('--- Test 1: Neural Network Flowchart ---');
  const transcript1 = `
    Neural networks process information through layers.
    Data flows from the input layer through hidden layers where
    it's transformed, and finally reaches the output layer for predictions.
  `;
  const description1 = 'Create a flowchart showing the flow of data through a neural network from input to output';

  try {
    const mermaid1 = await generateMermaidDiagram(llm, transcript1, description1);
    console.log('Mermaid Code:');
    console.log(mermaid1);
    console.log();
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 2: Photosynthesis process
  console.log('--- Test 2: Photosynthesis Process ---');
  const transcript2 = `
    Photosynthesis converts light energy into chemical energy in two stages.
    First, light-dependent reactions split water and produce ATP.
    Then, the Calvin cycle uses that ATP to convert CO2 into glucose.
  `;
  const description2 = 'Create a flowchart diagram showing the two-stage process of photosynthesis';

  try {
    const mermaid2 = await generateMermaidDiagram(llm, transcript2, description2);
    console.log('Mermaid Code:');
    console.log(mermaid2);
    console.log();
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 3: Class hierarchy
  console.log('--- Test 3: Programming Class Hierarchy ---');
  const transcript3 = `
    In object-oriented programming, we have a base Animal class.
    Dog and Cat inherit from Animal. Dog has a bark method while Cat has a meow method.
    All animals have an eat method.
  `;
  const description3 = 'Create a class diagram showing the inheritance hierarchy of Animal, Dog, and Cat classes';

  try {
    const mermaid3 = await generateMermaidDiagram(llm, transcript3, description3);
    console.log('Mermaid Code:');
    console.log(mermaid3);
    console.log();
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('✓ All tests completed!');
}

testDiagramGeneration();
