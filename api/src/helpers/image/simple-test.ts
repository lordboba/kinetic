import { getImageForKeyword } from './image.js';

async function test() {
  console.log('=== Testing Image Search ===\n');

  // Test 1: Without description
  console.log('--- Test 1: Keyword only ---');
  const url1 = await getImageForKeyword(
    'neural network', 
    'a machine learning model inspired by the human brain that uses interconnected layers of artificial neurons to recognize patterns in data'
  );
  console.log(`Keyword: "neural network"`);
  console.log(`Description: "neural network"`);
  console.log(`Result: ${url1}\n`);

  // Test 2: With description for more accuracy
  console.log('--- Test 2: Keyword + Description ---');
  const url2 = await getImageForKeyword(
    'neural network',
    'diagram showing layers of interconnected nodes with input, hidden, and output layers'
  );
  console.log(`Keyword: "neural network"`);
  console.log(`Description: "diagram showing layers of interconnected nodes with input, hidden, and output layers"`);
  console.log(`Result: ${url2}\n`);

  // Test 3: Another example
  console.log('--- Test 3: More specific search ---');
  const url3 = await getImageForKeyword(
    'backpropagation',
    'algorithm visualization showing forward pass and backward gradient flow in neural networks'
  );
  console.log(`Keyword: "backpropagation"`);
  console.log(`Description: "algorithm visualization showing forward pass and backward gradient flow"`);
  console.log(`Result: ${url3}\n`);

  console.log('✓ All tests completed!');
}

test();
