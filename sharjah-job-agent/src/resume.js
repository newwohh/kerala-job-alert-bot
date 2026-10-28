import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import OpenAI from 'openai';
import { profile } from './profile.js';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const outDir = path.resolve('output');
fs.mkdirSync(outDir, { recursive: true });

function cleanName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'job';
}

const SYSTEM_PROMPT = `You tailor a resume to a job using only the verified profile below. Never invent tools, certifications, employment, dates, metrics, duties, or skills.
Return JSON only:
{"summary": string (max 60 words, rewritten from the profile summary, only supported claims),
 "skills": int[] (indices into skills, most relevant first, max 12),
 "bullets": int[][] (one array per experience entry in order, indices into its bullets, most relevant first, max 6 each),
 "matchScore": int 0-100,
 "missingRequirements": string[] (job requirements the profile does not support, short phrases)}

PROFILE:
${JSON.stringify({
  summary: profile.summary,
  skills: profile.skills.map((s, i) => `${i}: ${s}`),
  experience: profile.experience.map(e => ({ title: e.title, bullets: (e.bullets || []).map((b, i) => `${i}: ${b}`) })),
  education: profile.education,
  achievements: profile.achievements
})}`;

export async function tailorApplication(job) {
  const base = {
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience,
    emailSubject: `Application for ${job.title} — ${job.location || 'Sharjah, UAE'}`,
    emailBody: `Dear Hiring Team,\n\nI am writing to apply for the ${job.title} position${job.company ? ` at ${job.company}` : ''}. My background includes software quality assurance and testing of web and mobile applications, including manual, functional, regression, integration and API testing.\n\nPlease find my resume attached for your consideration. I would welcome the opportunity to discuss my suitability for the role.\n\nThank you for your time.\n\nBest regards,\n${profile.name}`,
    matchScore: 0,
    missingRequirements: []
  };

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0.2,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          // Static prefix (instructions + profile) first so OpenAI's automatic prompt caching reuses it across jobs.
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ title: job.title, company: job.company, description: String(job.description || '').slice(0, 4000) }) }
        ]
      });
      const parsed = JSON.parse(response.choices[0].message.content);
      // The model only picks indices into the verified profile, so it cannot invent skills or bullets.
      const pick = (list, idx) => [...new Set(Array.isArray(idx) ? idx : [])].filter(i => Number.isInteger(i) && list[i] !== undefined).map(i => list[i]);
      const skills = pick(profile.skills, parsed.skills);
      return {
        ...base,
        summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : base.summary,
        skills: skills.length ? skills : profile.skills,
        experience: profile.experience.map((original, i) => {
          const bullets = pick(original.bullets || [], parsed.bullets?.[i]).slice(0, 6);
          return bullets.length ? { ...original, bullets } : original;
        }),
        matchScore: Math.max(0, Math.min(100, Number(parsed.matchScore) || 0)),
        missingRequirements: Array.isArray(parsed.missingRequirements) ? parsed.missingRequirements.map(String) : []
      };
    } catch (error) {
      console.error('AI tailoring failed; using conservative template:', error.message);
    }
  }
  const text = `${job.title} ${job.description}`.toLowerCase();
  const matched = profile.skills.filter(s => text.includes(s.toLowerCase()));
  const score = Math.round((matched.length / Math.max(1, Math.min(profile.skills.length, 8))) * 100);
  return { ...base, skills: matched.length ? matched : profile.skills, matchScore: Math.min(100, score), missingRequirements: [] };
}

function addSection(doc, title) {
  doc.moveDown(0.55).font('Helvetica-Bold').fontSize(11).fillColor('#172554').text(title.toUpperCase());
  doc.moveTo(doc.page.margins.left, doc.y + 3).lineTo(560, doc.y + 3).strokeColor('#cbd5e1').stroke();
  doc.moveDown(0.45).fillColor('#111827');
}

export async function createResumePdf(job, tailored) {
  const file = path.join(outDir, `${cleanName(profile.name)}-${cleanName(job.title)}-${cleanName(job.company)}.pdf`);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 42, bottom: 42, left: 48, right: 48 }, info: { Title: `${profile.name} - ${job.title}`, Author: profile.name } });
    const stream = fs.createWriteStream(file);
    doc.pipe(stream);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text(profile.name);
    doc.moveDown(0.15).fontSize(10).fillColor('#1d4ed8').text(job.title.toUpperCase());
    doc.moveDown(0.35).font('Helvetica').fontSize(8.5).fillColor('#374151').text(`${profile.location} | ${profile.phone} | ${profile.email} | ${profile.linkedin}`);
    addSection(doc, 'Professional Summary');
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(tailored.summary || profile.summary, { lineGap: 2 });
    addSection(doc, 'Core Skills');
    doc.fontSize(9).text((tailored.skills || profile.skills).join('  •  '), { lineGap: 3 });
    addSection(doc, 'Professional Experience');
    for (const exp of tailored.experience || profile.experience) {
      if (doc.y > 680) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).text(`${exp.title} | ${exp.company}`);
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#4b5563').text(`${exp.location} | ${exp.dates}`);
      doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
      for (const bullet of (exp.bullets || []).slice(0, 6)) doc.text(`• ${bullet}`, { indent: 9, hanging: 3, lineGap: 1.5 });
      doc.moveDown(0.3);
    }
    addSection(doc, 'Education');
    for (const edu of profile.education) {
      doc.font('Helvetica-Bold').fontSize(9).text(`${edu.degree} (${edu.dates})`);
      doc.font('Helvetica').fontSize(8.5).text(edu.institution).moveDown(0.2);
    }
    addSection(doc, 'Achievements');
    for (const achievement of profile.achievements) doc.font('Helvetica').fontSize(8.5).text(`• ${achievement}`, { indent: 9, hanging: 3, lineGap: 1.5 });
    doc.moveDown(0.3).font('Helvetica').fontSize(8.5).text(`Languages: ${profile.languages.join(', ')}`);
    doc.text(`Visa status: ${profile.visaStatus} | ${profile.availability}`);
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return file;
}
