require("dotenv").config();

const express = require("express");
const supabase = require("./supabaseClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------- Stage 1: Sign up & log in ----------
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ user: data.user });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: "Invalid login credentials" });
  }

  res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user,
  });
});

// ---------- Stage 2: public & protected gates ----------
app.get("/public/info", (req, res) => {
  res.status(200).json({ message: "Welcome stranger! This info is public." });
});

app.get("/protected/profile", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  // Stage 3 will verify this token with Supabase; for now, just requiring
  // a well-formed header is the checkpoint.
  res.status(200).json({ message: "token present, not yet verified" });
});

app.listen(PORT, () => {
  console.log(`Server running and connected to Supabase (port ${PORT})`);
});
