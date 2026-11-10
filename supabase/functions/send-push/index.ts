import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }

  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@classboardx.in";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured in Edge Function environment" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Supabase service role credentials not configured" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await request.json().catch(() => ({}));

    // Support both direct payload or Supabase Database Webhook payload
    let classId = body.class_id;
    let title = body.title;
    let message = body.body || body.message;
    let url = body.url || "./#updates";

    // Handle Supabase Webhook payload: { type: 'INSERT', table: 'updates', record: { ... } }
    if (body.record) {
      const record = body.record;
      classId = record.class_id;
      if (body.table === "updates") {
        title = record.title ? `Update: ${record.title}` : "New Class Update";
        message = record.body ? record.body.slice(0, 120) : "A new update has been posted.";
        url = "./#updates";
      } else if (body.table === "reminders") {
        title = record.title ? `Reminder: ${record.title}` : "Class Reminder";
        message = record.body ? record.body.slice(0, 120) : "You have an upcoming deadline.";
        url = "./#updates";
      }
    }

    if (!classId) {
      return new Response(
        JSON.stringify({ error: "class_id is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Fetch all active push subscriptions for this class
    const { data: subscriptions, error: dbError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("class_id", classId);

    if (dbError) {
      return new Response(
        JSON.stringify({ error: dbError.message }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscribers found for this class", sent: 0 }),
        { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const notificationPayload = JSON.stringify({
      title: title || "ClassBoard Update",
      body: message || "New update available for your class.",
      url: url,
      icon: "./classboard-pwa-icon.svg",
      badge: "./classboard-logo.svg"
    });

    let sent = 0;
    const deadSubscriptionIds: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload);
          sent++;
        } catch (err: any) {
          // If the subscription has expired or unsubscribed, remove it
          if (err.statusCode === 404 || err.statusCode === 410) {
            deadSubscriptionIds.push(sub.id);
          } else {
            console.error(`Failed to send push to ${sub.endpoint}:`, err.message);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (deadSubscriptionIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
    }

    return new Response(
      JSON.stringify({ success: true, sent, total: subscriptions.length, expiredRemoved: deadSubscriptionIds.length }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});

