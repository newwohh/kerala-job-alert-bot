import 'dotenv/config';
import { processNextJob, prisma } from './processor.js';

async function main() {
  console.log('🔍 Searching for jobs (max 1 job per run)...');
  try {
    const result = await processNextJob({ maxJobs: 1 });
    console.log(`\nResults:`);
    console.log(`  Discovered online: ${result.discovered}`);
    if (result.skippedNoEmail) {
      console.log(`  Skipped (no email in listing or on company site): ${result.skippedNoEmail}`);
    }
    console.log(`  Skipped (already in database): ${result.skippedDuplicates}`);
    console.log(`  Added & Sent to Telegram: ${result.added}`);
    if (result.errors) console.log(`  Errors: ${result.errors}`);

    if (result.jobs.length > 0) {
      console.log('\nProcessed Job:');
      for (const j of result.jobs) {
        console.log(`  - Title: ${j.title}`);
        console.log(`    Company: ${j.company}`);
        console.log(`    Email: ${j.recipientEmail}`);
        console.log(`    Match: ${j.matchScore}%`);
      }
      console.log('\nPreview sent to Telegram for approval.');
    } else if (result.skippedNoEmail > 0 && result.added === 0) {
      console.log('\nAll discovered listings require manual portal application (no email found in descriptions).');
      console.log('To include jobs without email (portal-only), set REQUIRE_EMAIL=false in .env');
    } else if (result.discovered > 0) {
      console.log('\nNo new jobs to process (all found jobs have already been saved).');
    } else {
      console.log('\nNo jobs found matching the search criteria.');
    }
  } catch (err) {
    console.error('Execution error:', err.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
