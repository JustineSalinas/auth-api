const supabase = require("../supabaseClient");

// Verifies the Authorization: Bearer <token> header against Supabase and
// attaches the resolved user + raw token to the request. Any route behind
// this middleware can assume req.user and req.token are already valid.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = data.user;
  req.token = token;
  next();
}

module.exports = requireAuth;
