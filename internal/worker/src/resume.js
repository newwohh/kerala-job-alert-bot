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

function prioritizeBullets(original, candidate) {
  if (!Array.isArray(candidate) || !candidate.length) return original;
  const reordered = [];
  for (const c of candidate) {
    if (typeof c !== 'string') continue;
    const match = original.find(orig => orig.trim().toLowerCase() === c.trim().toLowerCase());
    if (match && !reordered.includes(match)) reordered.push(match);
  }
  for (const orig of original) {
    if (!reordered.includes(orig)) reordered.push(orig);
  }
  return reordered.length ? reordered : original;
}

export async function tailorApplication(job) {
  const base = {
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience,
    emailSubject: `Application for ${job.title} — ${profile.name}`,
    emailBody: `Dear Hiring Team,\n\nI am writing to express my strong interest in the ${job.title} role${job.company ? ` at ${job.company}` : ''}. With over 5 years of software quality assurance experience, I specialize in manual, functional, regression, integration, and API testing across web and mobile platforms.\n\nPlease find my resume attached for your consideration. I am based in ${profile.location || 'UAE'}, holding a valid residency visa, and available to join immediately.\n\nThank you for your time and consideration.\n\nBest regards,\n${profile.name}`,
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
          {
            role: 'system',
            content: `You tailor resumes strictly using verified facts from a source profile. Never invent employers, tools, dates, duties, metrics, or certifications. Output JSON: summary (string, professional paragraph), skills (string[] drawn only from profile skills, prioritized by relevance to the job), bullets (array of arrays: one array of strings per experience entry, prioritizing the most relevant existing bullets first from the source), emailSubject (string), emailBody (string, polite and concise cover letter), matchScore (0-100 integer), missingRequirements (string[]).`
          },
          {
            role: 'user',
            content: JSON.stringify({
              sourceProfile: profile,
              job: { title: job.title, company: job.company, location: job.location, description: job.description }
            })
          }
        ]
      });
      const parsed = JSON.parse(response.choices[0].message.content);
      const skills = (parsed.skills || []).filter(s => profile.skills.some(ps => ps.toLowerCase() === String(s).toLowerCase()));
      return {
        ...base,
        summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : base.summary,
        skills: skills.length ? skills : profile.skills,
        experience: profile.experience.map((original, i) => {
          const bullets = prioritizeBullets(original.bullets || [], parsed.bullets?.[i]);
          return { ...original, bullets };
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
      margins: { top: 30, bottom: 30, left: 34, right: 34 },
      info: {
        Title: `${profile.name} - ${job.title}`,
        Author: profile.name,
        Creator: 'LaTeX with hyperref'
      }
    });

    const stream = fs.createWriteStream(file);
    doc.pipe(stream);

    const left = 34;
    const right = 561; // 595.28 - 34
    const contentWidth = right - left; // 527

    function drawSectionHeader(title, isFirstOnPage = false, spaceBefore = 20) {
      if (!isFirstOnPage) {
        doc.y += spaceBefore;
      }
      const textY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#000000').text(title.toUpperCase(), left, textY);
      const lineY = doc.y + 2.5;
      doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(0.65).strokeColor('#000000').stroke();
      doc.y = lineY + 12; // generous breathing room below horizontal line
    }

    // ==========================================
    // PAGE 1: Header, Summary, Experience
    // ==========================================
    doc.font('Helvetica-Bold').fontSize(19.5).fillColor('#000000').text(profile.name.toUpperCase(), { align: 'center' });
    doc.y += 3;
    doc.font('Helvetica-Bold').fontSize(10.2).fillColor('#222222').text(profile.headline, { align: 'center' });
    doc.y += 3;
    doc.font('Helvetica').fontSize(9.5).fillColor('#333333').text(`${profile.location} (${profile.visaStatus})`, { align: 'center' });
    doc.y += 2.5;
    doc.font('Helvetica').fontSize(9.5).fillColor('#333333').text(`Mobile: ${profile.phone}`, { align: 'center' });
    doc.y += 2.5;
    doc.font('Helvetica').fontSize(9.5).fillColor('#333333').text(`Email: ${profile.email}`, { align: 'center' });
    doc.y += 2.5;
    doc.font('Helvetica').fontSize(9.5).fillColor('#0044cc').text(
      `LinkedIn: ${profile.linkedin.replace(/^https?:\/\//, '')}`,
      { align: 'center' }
    );

    // Professional Summary
    drawSectionHeader('Professional Summary', false, 15);
    doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(
      tailored.summary || profile.summary,
      left,
      doc.y,
      { width: contentWidth, align: 'justify', lineGap: 3.2 }
    );

    // Professional Experience
    drawSectionHeader('Professional Experience', false, 16);
    const experiences = tailored.experience || profile.experience;

    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];
      if (i > 0) doc.y += 15;

      const startY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(exp.title.toUpperCase(), left, startY);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text(exp.dates, left, startY, { width: contentWidth, align: 'right' });
      doc.y += 3; // spacing between Job Title and Company line
      doc.font('Helvetica-Bold').fontSize(9.2).fillColor('#222222').text(`${exp.company.toUpperCase()}, ${exp.location.toUpperCase()}`, left);
      doc.y += 7.5; // spacing between Company line and first bullet

      for (const bullet of exp.bullets || []) {
        const bulletY = doc.y;
        doc.font('Helvetica').fontSize(9.3).fillColor('#000000').text('•', left + 4, bulletY);
        doc.font('Helvetica').fontSize(9.3).fillColor('#111111').text(bullet, left + 16, bulletY, {
          width: contentWidth - 16,
          lineGap: 2.8
        });
        doc.y += 6.5;
      }
    }

    // ==========================================
    // PAGE 2: Competencies, Education, Skills, Achievements, Additional Info
    // ==========================================
    doc.addPage();

    // Core Competencies
    drawSectionHeader('Core Competencies', true);
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

    const compStartY = doc.y;
    const compRowStep = 23;
    for (let i = 0; i < col1Comp.length; i++) {
      const rowY = compStartY + (i * compRowStep);
      doc.font('Helvetica').fontSize(9.6).text('•', left + 4, rowY);
      doc.font('Helvetica').fontSize(9.6).text(col1Comp[i], left + 18, rowY, { width: colWidth - 18 });
      doc.font('Helvetica').fontSize(9.6).text('•', left + colWidth + 20, rowY);
      doc.font('Helvetica').fontSize(9.6).text(col2Comp[i], left + colWidth + 34, rowY, { width: colWidth - 18 });
    }
    doc.y = compStartY + (col1Comp.length * compRowStep) + 4;

    // Education
    drawSectionHeader('Education', false, 22);
    for (let i = 0; i < profile.education.length; i++) {
      const edu = profile.education[i];
      if (i > 0) doc.y += 12;
      const eduY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9.8).fillColor('#000000').text(edu.degree, left, eduY);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text(edu.dates, left, eduY, { width: contentWidth, align: 'right' });
      doc.y += 2.5;
      doc.font('Helvetica').fontSize(9.2).fillColor('#333333').text(edu.institution, left);
    }
    doc.y += 4;

    // Technical Skills
    drawSectionHeader('Technical Skills', false, 22);
    const defaultSkills = [
      'JIRA', 'Postman', 'Manual Testing', 'API Testing', 'Regression Testing', 'Functional Testing',
      'Integration Testing', 'Test Case Design', 'Defect Tracking', 'Agile Scrum', 'Microsoft Excel', 'Microsoft Office'
    ];
    const skillsList = tailored.skills && tailored.skills.length >= 10 ? tailored.skills.slice(0, 12) : defaultSkills;
    const midSkills = Math.ceil(skillsList.length / 2);
    const col1Skills = skillsList.slice(0, midSkills);
    const col2Skills = skillsList.slice(midSkills);

    const skillsStartY = doc.y;
    const skillsRowStep = 23;
    for (let i = 0; i < col1Skills.length; i++) {
      const rowY = skillsStartY + (i * skillsRowStep);
      doc.font('Helvetica').fontSize(9.6).text('•', left + 4, rowY);
      doc.font('Helvetica').fontSize(9.6).text(col1Skills[i], left + 18, rowY, { width: colWidth - 18 });
      doc.font('Helvetica').fontSize(9.6).text('•', left + colWidth + 20, rowY);
      if (col2Skills[i]) {
        doc.font('Helvetica').fontSize(9.6).text(col2Skills[i], left + colWidth + 34, rowY, { width: colWidth - 18 });
      }
    }
    doc.y = skillsStartY + (col1Skills.length * skillsRowStep) + 4;

    // Key Achievements
    drawSectionHeader('Key Achievements', false, 22);
    for (const ach of profile.achievements) {
      const achY = doc.y;
      doc.font('Helvetica').fontSize(9.6).fillColor('#000000').text('•', left + 4, achY);
      doc.font('Helvetica').fontSize(9.6).fillColor('#111111').text(ach, left + 18, achY, { width: contentWidth - 18, lineGap: 2.8 });
      doc.y += 9;
    }

    // Additional Information
    drawSectionHeader('Additional Information', false, 22);
    const additional = [
      `Languages: ${profile.languages.join(', ')}`,
      `Visa Status: ${profile.visaStatus}`,
      'Nationality: Indian',
      `Availability: ${profile.availability}`
    ];
    for (const item of additional) {
      const addY = doc.y;
      doc.font('Helvetica').fontSize(9.6).fillColor('#000000').text('•', left + 4, addY);
      doc.font('Helvetica').fontSize(9.6).fillColor('#111111').text(item, left + 18, addY, { width: contentWidth - 18 });
      doc.y += 8;
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return file;
}
