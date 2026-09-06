import { verifyUser } from "./_lib/verifyUser.js";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { applyCors } from "./_lib/cors.js";
import { logAndFail } from "./_lib/errors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) return logAndFail(res, 500, "delete-account", error, "Couldn't delete your account. Please try again or contact support.");

  return res.status(200).json({ success: true });
}