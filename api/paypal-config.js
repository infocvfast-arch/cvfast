export default function handler(req, res) {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({
      error: "PayPal is not configured"
    });
  }

  res.status(200).json({
    clientId
  });
}
