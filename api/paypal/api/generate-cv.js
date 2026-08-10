const OPENAI_API = "https://api.openai.com/v1/responses";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      orderID,
      name,
      email,
      targetRole,
      country,
      profile,
      experience,
      education,
      skills,
      languages,
      jobDescription
    } = req.body || {};

    if (!orderID) {
      return res.status(400).json({
        error: "Verified payment is required"
      });
    }

    if (!name || !email || !targetRole || !experience) {
      return res.status(400).json({
        error: "Required CV information is missing"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "AI service is not configured"
      });
    }

    const prompt = `
Create a professional ATS-friendly CV.

IMPORTANT RULES:
- Do not invent employers, dates, qualifications, achievements or skills.
- Only use information supplied by the customer.
- Improve wording, clarity and professional presentation.
- Use concise achievement-oriented language where supported by the input.
- Tailor the CV toward the target role.
- If a job description is supplied, incorporate relevant keywords naturally.
- Do not include sensitive information unnecessarily.
- Return ONLY valid JSON.
- Do not use markdown.
- If information is unavailable, use an empty array or empty string.

CUSTOMER INFORMATION

Name:
${name}

Target role:
${targetRole}

Target country / market:
${country || "Not specified"}

Existing professional profile:
${profile || "Not provided"}

Work experience:
${experience}

Education:
${education || "Not provided"}

Skills:
${skills || "Not provided"}

Languages:
${languages || "Not provided"}

Target job description:
${jobDescription || "Not provided"}

Return exactly this JSON structure:

{
  "name": "",
  "target_role": "",
  "summary": "",
  "skills": [],
  "experience": [
    {
      "title": "",
      "company": "",
      "dates": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "qualification": "",
      "institution": "",
      "dates": ""
    }
  ],
  "languages": [],
  "ats_keywords": []
}
`;

    const response = await fetch(OPENAI_API, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${process.env.OPENAI_API_KEY}`
      },

      body: JSON.stringify({
        model: "gpt-5-mini",
        input: prompt,
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return res.status(500).json({
        error: "AI CV generation failed"
      });
    }

    let output = "";

    if (data.output_text) {
      output = data.output_text;
    } else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (
            content.type === "output_text" &&
            content.text
          ) {
            output += content.text;
          }
        }
      }
    }

    if (!output) {
      throw new Error("AI returned no CV content");
    }

    let cv;

    try {
      cv = JSON.parse(output);
    } catch (error) {
      console.error("Invalid AI JSON:", output);

      return res.status(500).json({
        error: "AI returned an invalid CV format"
      });
    }

    return res.status(200).json({
      success: true,
      cv
    });

  } catch (error) {
    console.error("Generate CV error:", error);

    return res.status(500).json({
      error: "Could not generate CV"
    });
  }
}
