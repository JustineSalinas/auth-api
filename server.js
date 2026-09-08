require("dotenv").config();

const express = require("express");
const supabase = require("./supabaseClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server running and connected to Supabase (port ${PORT})`);
});
