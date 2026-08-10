const PAYPAL_API =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials are missing.");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("PayPal token error:", data);
    throw new Error("Unable to authenticate with PayPal.");
  }

  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: "CVFAST_AI_CV",
            description: "CVFAST AI CV Generator",
            amount: {
              currency_code: "EUR",
              value: "9.99"
            }
          }
        ]
      })
    });

    const order = await response.json();

    if (!response.ok) {
      console.error("PayPal create order error:", order);

      return res.status(response.status).json({
        success: false,
        error: "Unable to create PayPal order."
      });
    }

    return res.status(200).json({
      success: true,
      id: order.id,
      status: order.status
    });

  } catch (error) {
    console.error("create-order error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to create payment."
    });
  }
}
