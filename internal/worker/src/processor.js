import { PrismaClient } from '@prisma/client';
import { searchJobs, searchQueries, extractEmail, findCompanyEmail } from './search.js';
import { tailorApplication, createResumePdf } from './resume.js';
import { sendApplicationPreview } from './telegram.js';

const prisma = new PrismaClient();

export async function processNextJob({ maxJobs, requireEmail } = {}) {
  const limit = maxJobs ?? Number(process.env.MAX_JOBS_PER_RUN || 1);
  const onlyWithEmail = requireEmail ?? (process.env.REQUIRE_EMAIL !== 'false'); // Default to true
  // Each company lookup costs one SerpAPI search; cap it so the free plan lasts.
  let lookupsLeft = process.env.COMPANY_EMAIL_LOOKUP === 'false' ? 0 : Number(process.env.MAX_EMAIL_LOOKUPS_PER_RUN || 5);
  // Each results page costs one SerpAPI search; only fetch more (next page, then next query) while nothing new has been added.
  const maxPages = Number(process.env.MAX_SEARCH_PAGES || 4);
  let queryIndex = 0;

  let added = 0;
  let discovered = 0;
  let skippedDuplicates = 0;
  let skippedNoEmail = 0;
  let errors = 0;
  const processedJobs = [];
  let pageToken;

  for (let page = 0; page < maxPages && added < limit; page++) {
    const { jobs: found, nextPageToken } = await searchJobs({ query: searchQueries[queryIndex], pageToken });
    discovered += found.length;
    pageToken = nextPageToken;

    for (const item of found) {
      if (added >= limit) {
        break;
      }

      try {
        // Duplicate check first so already-seen jobs never spend a company lookup.
        const existing = await prisma.job.findFirst({
          where: {
            OR: [
              { jobUrl: item.jobUrl },
              ...(item.externalId ? [{ externalId: item.externalId }] : [])
            ]
          }
        });

        if (existing) {
          skippedDuplicates++;
          continue;
        }

        let recipientEmail = extractEmail(item.description);
        let recipientSource = recipientEmail ? 'job listing' : null;
        if (!recipientEmail && lookupsLeft > 0) {
          lookupsLeft--;
          const fromSite = await findCompanyEmail(item.company);
          if (fromSite) ({ email: recipientEmail, source: recipientSource } = fromSite);
        }

        // If requireEmail is active, skip any listing with no usable email
        if (onlyWithEmail && !recipientEmail) {
          skippedNoEmail++;
          continue;
        }

        const job = await prisma.job.create({
          data: { ...item, source: 'Google Jobs via SerpAPI' }
        });

        const tailored = await tailorApplication(job);
        const resumeFile = await createResumePdf(job, tailored);

        const application = await prisma.application.create({
          data: {
            jobId: job.id,
            recipientEmail,
            recipientSource,
            emailSubject: tailored.emailSubject,
            emailBody: tailored.emailBody,
            tailoredResume: JSON.stringify({
              summary: tailored.summary,
              skills: tailored.skills,
              experience: tailored.experience,
              missingRequirements: tailored.missingRequirements
            }),
            resumeFile,
            matchScore: tailored.matchScore
          }
        });

        await sendApplicationPreview(application, job);
        added++;
        processedJobs.push({
          id: job.id,
          title: job.title,
          company: job.company,
          recipientEmail,
          matchScore: tailored.matchScore
        });
      } catch (e) {
        errors++;
        console.error('Could not process job:', item.title, e.message);
      }
    }

    // Empty page or no more pages: move on to the next query.
    if (!pageToken || found.length === 0) {
      pageToken = undefined;
      if (++queryIndex >= searchQueries.length) break;
    }
  }

  return {
    discovered,
    added,
    skippedDuplicates,
    skippedNoEmail,
    errors,
    limit,
    jobs: processedJobs
  };
}

export { prisma };
