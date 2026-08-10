export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const {
      fullName,
      email,
      phone,
      location,
      targetRole,
      experience,
      education,
      skills,
      languages,
      summary,
    } = req.body || {};

    if (!fullName || !targetRole) {
      return res.status(400).json({
        success: false,
        error: "Full name and target role are required.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "OPENAI_API_KEY is not configured.",
      });
    }

    const prompt = `
Create a professional, ATS-friendly CV for the Dutch and international job market.

Candidate information:

Full name: ${fullName}
Email: ${email || ""}
Phone: ${phone || ""}
Location: ${location || ""}
Target role: ${targetRole || ""}

Professional summary / additional information:
${summary || ""}

Work experience:
${experience || ""}

Education:
${education || ""}

Skills:
${skills || ""}

Languages:
${languages || ""}

Requirements:
- Write in professional English.
- Do not invent employers, degrees, dates, qualifications, or achievements.
- Improve wording and clarity while preserving the candidate's facts.
- Optimize the CV for ATS systems.
- Use strong, concise professional language.
- Focus on the target role.
- Return a complete CV ready for formatting.
- Use clear sections such as Professional Summary, Work Experience, Education, Skills, and Languages.
`;

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          input: prompt,
        }),
      }
    );

    const data = await openAIResponse.json();

    if (!openAIResponse.ok) {
      console.error("OpenAI API error:", data);

      return res.status(openAIResponse.status).json({
        success: false,
        error:
          data?.error?.message ||
          "AI CV generation failed.",
      });
    }

    let cv = "";

    if (data.output_text) {
      cv = data.output_text;
    } else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {
            cv += content.text;
          }
        }
      }
    }

    if (!cv.trim()) {
      return res.status(500).json({
        success: false,
        error: "AI returned an empty CV.",
      });
    }

    return res.status(200).json({
      success: true,
      cv: cv.trim(),
    });
  } catch (error) {
    console.error("generate-cv error:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error.",
    });
  }
}
