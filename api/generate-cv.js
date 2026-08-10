import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      fullName,
      email,
      phone,
      location,
      targetRole,
      summary,
      experience,
      education,
      skills,
      languages,
      achievements
    } = req.body || {};

    if (!fullName || !targetRole) {
      return res.status(400).json({
        error: "Full name and target role are required."
      });
    }

    const prompt = `
Create a professional ATS-friendly CV for the Dutch and international job market.

Candidate information:

Full name: ${fullName}
Email: ${email || ""}
Phone: ${phone || ""}
Location: ${location || ""}
Target role: ${targetRole}

Professional summary / background:
${summary || ""}

Work experience:
${experience || ""}

Education:
${education || ""}

Skills:
${skills || ""}

Languages:
${languages || ""}

Achievements:
${achievements || ""}

Requirements:
- Write in professional English.
- Make the CV ATS-friendly.
- Use clear section headings.
- Do not invent companies, dates, qualifications, metrics, or experience.
- Improve wording while preserving facts.
- Use achievement-focused bullet points where supported.
- Keep the CV concise and recruiter-friendly.
- Suitable for the Dutch and international job market.

Return only the finished CV text.
`;

    const response = await openai.responses.create({
      model: "gpt-5",
      input: prompt
    });

    const cv = response.output_text?.trim();

    if (!cv) {
      return res.status(500).json({
        error: "AI did not return CV content."
      });
    }

    return res.status(200).json({
      success: true,
      cv
    });

  } catch (error) {
    console.error("CV generation error:", error);

    return res.status(500).json({
      error: "Unable to generate CV right now."
    });
  }
}
