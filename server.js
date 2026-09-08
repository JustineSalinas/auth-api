require("dotenv").config();

const express = require("express");
const supabase = require("./supabaseClient");
const requireAuth = require("./middleware/requireAuth");

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

app.get("/protected/profile", requireAuth, (req, res) => {
  res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at,
  });
});

// ---------- Stage 4: middleware protection & logout ----------
app.get("/protected/dashboard", requireAuth, (req, res) => {
  res.status(200).json({ message: `Welcome to your dashboard, ${req.user.email}.` });
});

app.post("/auth/logout", requireAuth, async (req, res) => {
  // supabase-js v2's signOut() operates on the session held by the client
  // instance, not an arbitrary bearer token passed in from a stateless
  // server — see the README for why, and what fully revoking a specific
  // token would require (the service_role key's admin API).
  await supabase.auth.signOut();
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running and connected to Supabase (port ${PORT})`);
});
