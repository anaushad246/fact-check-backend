import AIService from './services/ai.service.js';

async function runTest() {
  const claim = "5G technology causes cancer according to recent studies.";
  const analysis = await AIService.analyzeClaim(claim);
  const categorization = await AIService.categorizeClaim(claim);

  console.log('--- AI Analysis ---\n', analysis);
  console.log('--- Categorization ---\n', categorization);
}

runTest();
