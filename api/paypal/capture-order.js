const PAYPAL_API =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
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
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error("Could not authenticate with PayPal");
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
        error: "Missing PayPal order ID"
      });
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("PayPal capture error:", data);

      return res.status(response.status).json({
        error: "Could not capture PayPal payment"
      });
    }

    const capture =
      data.purchase_units?.[0]?.payments?.captures?.[0];

    const paidAmount = capture?.amount?.value;
    const currency = capture?.amount?.currency_code;

    if (
      data.status !== "COMPLETED" ||
      capture?.status !== "COMPLETED" ||
      paidAmount !== "9.99" ||
      currency !== "EUR"
    ) {
      return res.status(400).json({
        error: "Payment could not be verified"
      });
    }

    return res.status(200).json({
      status: "COMPLETED",
      orderID: data.id
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Payment verification failed"
    });
  }
}
