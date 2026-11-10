// Konfigurasi Supabase untuk riwayat pick (js/pick-history.js). Anon key memang publik; akses dibatasi RLS
// (supabase/schema.sql): hanya user yang login, hanya baris miliknya sendiri.
window.SUPABASE_CONFIG = {
  url: "https://dnkqzlnhgtmshysxaypq.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRua3F6bG5oZ3Rtc2h5c3hheXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyOTgxNDYsImV4cCI6MjEwOTg3NDE0Nn0.yNb0607iG6e6KLK5qZn_afHHCMfZEA5gK5AJyDVagSw",
  table: "pick_history",
};
