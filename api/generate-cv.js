const PAYPAL_API =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials are not configured");
  }

  const auth = Buffer.from(
    `${clientId}:${secret}`
  ).toString("base64");

  const response = await fetch(
    `${PAYPAL_API}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      "Could not authenticate with PayPal"
    );
  }

  return data.access_token;
}


async function verifyPayment(orderID) {
  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      "Could not verify PayPal payment"
    );
  }

  const purchaseUnit =
    data.purchase_units?.[0];

  const amount =
    purchaseUnit?.amount;

  if (
    data.status !== "COMPLETED" ||
    amount?.currency_code !== "EUR" ||
    amount?.value !== "9.99"
  ) {
    throw new Error(
      "Valid €9.99 payment was not found"
    );
  }

  return true;
}


function getOutputText(data) {
  let output = "";

  if (data.output_text) {
    return data.output_text;
  }

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item.content)) {
        continue;
      }

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

  return output;
}


export default async function handler(
  req,
  res
) {
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
        error: "Payment verification required"
      });
    }


    if (
      !name ||
      !email ||
      !targetRole ||
      !experience
    ) {
      return res.status(400).json({
        error:
          "Required CV information is missing"
      });
    }


    await verifyPayment(orderID);


    const apiKey =
      process.env.OPENAI_API_KEY;


    if (!apiKey) {
      return res.status(500).json({
        error:
          "OpenAI API is not configured"
      });
    }


    const prompt = `
You are CVFAST AI.

Create a professional ATS-friendly CV draft
for the Dutch and international job market.

STRICT RULES:

- Never invent employers.
- Never invent employment dates.
- Never invent qualifications.
- Never invent certifications.
- Never invent achievements or numerical results.
- Never invent skills or languages.
- Use only information provided by the customer.
- Improve wording and clarity.
- Use concise professional language.
- Tailor the wording toward the target role.
- If a job description is supplied,
  incorporate relevant keywords naturally.
- Do not include unnecessary personal information.

CUSTOMER INFORMATION

Name:
${name}

Target role:
${targetRole}

Target country / market:
${country || "Not specified"}

Professional profile:
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
`;


    const schema = {
      type: "object",

      additionalProperties: false,

      properties: {
        name: {
          type: "string"
        },

        target_role: {
          type: "string"
        },

        summary: {
          type: "string"
        },

        skills: {
          type: "array",
          items: {
            type: "string"
          }
        },

        experience: {
          type: "array",

          items: {
            type: "object",

            additionalProperties:
              false,

            properties: {
              title: {
                type: "string"
              },

              company: {
                type: "string"
              },

              dates: {
                type: "string"
              },

              bullets: {
                type: "array",

                items: {
                  type: "string"
                }
              }
            },

            required: [
              "title",
              "company",
              "dates",
              "bullets"
            ]
          }
        },

        education: {
          type: "array",

          items: {
            type: "object",

            additionalProperties:
              false,

            properties: {
              qualification: {
                type: "string"
              },

              institution: {
                type: "string"
              },

              dates: {
                type: "string"
              }
            },

            required: [
              "qualification",
              "institution",
              "dates"
            ]
          }
        },

        languages: {
          type: "array",

          items: {
            type: "string"
          }
        },

        ats_keywords: {
          type: "array",

          items: {
            type: "string"
          }
        }
      },

      required: [
        "name",
        "target_role",
        "summary",
        "skills",
        "experience",
        "education",
        "languages",
        "ats_keywords"
      ]
    };


    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          model: "gpt-5-mini",

          input: [
            {
              role: "system",

              content: [
                {
                  type: "input_text",

                  text:
                    "Create accurate, concise, ATS-friendly CV drafts. Never invent factual career information."
                }
              ]
            },

            {
              role: "user",

              content: [
                {
                  type: "input_text",
                  text: prompt
                }
              ]
            }
          ],

          text: {
            format: {
              type: "json_schema",

              name: "cvfast_cv",

              strict: true,

              schema
            }
          }
        })
      }
    );


    const data =
      await response.json();


    if (!response.ok) {
      console.error(
        "OpenAI error:",
        data
      );

      return res.status(
        response.status
      ).json({
        error:
          "AI CV generation failed"
      });
    }


    const output =
      getOutputText(data);


    if (!output) {
      throw new Error(
        "AI returned no CV content"
      );
    }


    let cv;

    try {
      cv = JSON.parse(output);
    } catch {
      throw new Error(
        "Could not parse AI CV"
      );
    }


    return res.status(200).json({
      success: true,
      cv
    });

  } catch (error) {
    console.error(
      "Generate CV error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Could not generate CV"
    });
  }
}
