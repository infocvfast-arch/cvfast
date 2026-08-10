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

  const response = await fetch(
    `${PAYPAL_API}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Unable to authenticate with PayPal.");
  }

  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { orderID } = req.body || {};

    if (!orderID) {
      return res.status(400).json({
        error: "Missing PayPal order ID."
      });
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": crypto.randomUUID()
        },
        body: "{}"
      }
    );

    const capture = await response.json();

    if (!response.ok) {
      console.error("PayPal capture error:", capture);

      return res.status(response.status).json({
        error: "Unable to capture payment."
      });
    }

    if (capture.status !== "COMPLETED") {
      return res.status(400).json({
        error: "Payment was not completed.",
        status: capture.status
      });
    }

    const amount =
      capture?.purchase_units?.[0]?.payments?.captures?.[0]?.amount;

    if (
      amount?.currency_code !== "EUR" ||
      amount?.value !== "9.99"
    ) {
      return res.status(400).json({
        error: "Payment amount verification failed."
      });
    }

    return res.status(200).json({
      success: true,
      orderID: capture.id,
      status: capture.status
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to verify payment."
    });
  }
}
