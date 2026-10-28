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

function pick(original, candidate) {
  if (!Array.isArray(candidate)) return original;
  const set = new Set(original.map(b => b.trim().toLowerCase()));
  const chosen = candidate.filter(b => typeof b === 'string' && set.has(b.trim().toLowerCase()));
  return chosen.length ? chosen : original;
}

export async function tailorApplication(job) {
  const base = {
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience,
    emailSubject: `Application for ${job.title} — Merin Raju`,
    emailBody: `Dear Hiring Team,\n\nI am writing to express my strong interest in the ${job.title} role${job.company ? ` at ${job.company}` : ''}. With over 5 years of software quality assurance experience, I specialize in manual, functional, regression, integration, and API testing across web and mobile platforms.\n\nPlease find my resume attached for your consideration. I am based in Sharjah, holding a valid residency visa, and available to join immediately.\n\nThank you for your time and consideration.\n\nBest regards,\n${profile.name}`,
    matchScore: 0,
    missingRequirements: []
  };

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You tailor resumes strictly using verified facts from a source profile. Never invent employers, tools, dates, duties, metrics, or certifications. Output JSON: summary (string, professional paragraph), skills (string[] drawn only from profile skills, prioritized by relevance to the job), bullets (array of arrays: one array of strings per experience entry, choosing the most relevant existing bullets from the source), emailSubject (string), emailBody (string, polite and concise cover letter), matchScore (0-100 integer), missingRequirements (string[]).` },
          { role: 'user', content: JSON.stringify({ sourceProfile: profile, job: { title: job.title, company: job.company, location: job.location, description: job.description } }) }
        ]
      });
      const parsed = JSON.parse(response.choices[0].message.content);
      const skills = (parsed.skills || []).filter(s => profile.skills.some(ps => ps.toLowerCase() === String(s).toLowerCase()));
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

export async function createResumePdf(job, tailored) {
  const file = path.join(outDir, `${cleanName(profile.name)}-${cleanName(job.title)}-${cleanName(job.company)}.pdf`);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 36, left: 45, right: 45 },
      info: {
        Title: `${profile.name} - ${job.title}`,
        Author: profile.name,
        Creator: 'LaTeX with hyperref'
      }
    });

    const stream = fs.createWriteStream(file);
    doc.pipe(stream);

    const left = 45;
    const right = 550;
    const contentWidth = right - left;

    function drawSectionHeader(title) {
      doc.moveDown(0.65);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(title.toUpperCase(), left);
      const lineY = doc.y + 2;
      doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(0.75).strokeColor('#000000').stroke();
      doc.y = lineY + 6;
    }

    // ==========================================
    // PAGE 1: Header, Summary, Experience
    // ==========================================

    // Header (Centered LaTeX Style)
    doc.font('Helvetica-Bold').fontSize(19).fillColor('#000000').text(profile.name.toUpperCase(), { align: 'center' });
    doc.moveDown(0.15);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#222222').text(profile.headline, { align: 'center' });
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(9).fillColor('#333333').text(`${profile.location} (${profile.visaStatus})`, { align: 'center' });
    doc.moveDown(0.12);
    doc.font('Helvetica').fontSize(8.5).fillColor('#333333').text(`Mobile: ${profile.phone}   |   Email: ${profile.email}`, { align: 'center' });
    doc.moveDown(0.1);
    doc.font('Helvetica').fontSize(8.5).fillColor('#0044cc').text(profile.linkedin.replace(/^https?:\/\//, ''), { align: 'center' });

    // Professional Summary
    drawSectionHeader('Professional Summary');
    doc.font('Helvetica').fontSize(8.5).fillColor('#111111').text(
      tailored.summary || profile.summary,
      left,
      doc.y,
      { width: contentWidth, align: 'justify', lineGap: 2.2 }
    );

    // Professional Experience
    drawSectionHeader('Professional Experience');
    const experiences = tailored.experience || profile.experience;

    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];
      if (i > 0) doc.moveDown(0.55);

      const startY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text(exp.title.toUpperCase(), left, startY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(exp.dates, left, startY, { width: contentWidth, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#333333').text(`${exp.company.toUpperCase()}, ${exp.location.toUpperCase()}`, left);
      doc.moveDown(0.25);

      for (const bullet of exp.bullets || []) {
        const bulletY = doc.y;
        doc.font('Helvetica').fontSize(8.5).fillColor('#000000').text('•', left + 4, bulletY);
        doc.font('Helvetica').fontSize(8.5).fillColor('#111111').text(bullet, left + 16, bulletY, {
          width: contentWidth - 16,
          lineGap: 1.8
        });
        doc.moveDown(0.25);
      }
    }

    // ==========================================
    // PAGE 2: Competencies, Education, Skills, Achievements, Additional Info
    // ==========================================
    doc.addPage();

    // Core Competencies (Two Columns)
    drawSectionHeader('Core Competencies');
    const competencies = [
      'Manual, Functional & Regression Testing',
      'Integration & API Testing',
      'Mobile & Web Application Testing',
      'Test Case Design & Execution',
      'Defect Tracking & Bug Reporting',
      'SDLC & STLC',
      'Agile Scrum Methodology',
      'JIRA & Test Documentation',
      'Flight Booking Systems',
      'Hotel Booking Systems'
    ];
    const colWidth = (contentWidth - 20) / 2;
    const midComp = Math.ceil(competencies.length / 2);
    const col1Comp = competencies.slice(0, midComp);
    const col2Comp = competencies.slice(midComp);

    let compStartY = doc.y;
    for (const c of col1Comp) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(8.5).text('•', left + 4, y);
      doc.font('Helvetica').fontSize(8.5).text(c, left + 16, y, { width: colWidth - 16 });
      doc.moveDown(0.35);
    }
    const compEndCol1 = doc.y;

    doc.y = compStartY;
    for (const c of col2Comp) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(8.5).text('•', left + colWidth + 24, y);
      doc.font('Helvetica').fontSize(8.5).text(c, left + colWidth + 36, y, { width: colWidth - 16 });
      doc.moveDown(0.35);
    }
    doc.y = Math.max(compEndCol1, doc.y);

    // Education
    drawSectionHeader('Education');
    for (const edu of profile.education) {
      const eduY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(edu.degree, left, eduY);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000').text(edu.dates, left, eduY, { width: contentWidth, align: 'right' });
      doc.font('Helvetica').fontSize(8.5).fillColor('#333333').text(edu.institution, left);
      doc.moveDown(0.35);
    }

    // Technical Skills (Two Columns)
    drawSectionHeader('Technical Skills');
    const skillsList = tailored.skills && tailored.skills.length ? tailored.skills : profile.skills;
    const midSkills = Math.ceil(skillsList.length / 2);
    const col1Skills = skillsList.slice(0, midSkills);
    const col2Skills = skillsList.slice(midSkills);

    let skillsStartY = doc.y;
    for (const s of col1Skills) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(8.5).text('•', left + 4, y);
      doc.font('Helvetica').fontSize(8.5).text(s, left + 16, y, { width: colWidth - 16 });
      doc.moveDown(0.3);
    }
    const skillsEndCol1 = doc.y;

    doc.y = skillsStartY;
    for (const s of col2Skills) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(8.5).text('•', left + colWidth + 24, y);
      doc.font('Helvetica').fontSize(8.5).text(s, left + colWidth + 36, y, { width: colWidth - 16 });
      doc.moveDown(0.3);
    }
    doc.y = Math.max(skillsEndCol1, doc.y);

    // Key Achievements
    drawSectionHeader('Key Achievements');
    for (const ach of profile.achievements) {
      const achY = doc.y;
      doc.font('Helvetica').fontSize(8.5).fillColor('#000000').text('•', left + 4, achY);
      doc.font('Helvetica').fontSize(8.5).fillColor('#111111').text(ach, left + 16, achY, { width: contentWidth - 16, lineGap: 1.5 });
      doc.moveDown(0.3);
    }

    // Additional Information
    drawSectionHeader('Additional Information');
    const additional = [
      `Languages: ${profile.languages.join(', ')}`,
      `Visa Status: ${profile.visaStatus}`,
      'Nationality: Indian',
      `Availability: ${profile.availability}`
    ];
    for (const item of additional) {
      const addY = doc.y;
      doc.font('Helvetica').fontSize(8.5).fillColor('#000000').text('•', left + 4, addY);
      doc.font('Helvetica').fontSize(8.5).fillColor('#111111').text(item, left + 16, addY, { width: contentWidth - 16 });
      doc.moveDown(0.25);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return file;
}
