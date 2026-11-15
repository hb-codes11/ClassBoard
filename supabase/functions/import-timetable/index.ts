// Supabase still serves the deployed function when its source is removed.
// Keep this retired endpoint inert without loading credentials or calling an API.
Deno.serve(() => Response.json({ error: "Timetable import is disabled." }, { status: 410 }));
