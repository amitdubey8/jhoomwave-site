/* Public settings for the JHOOMWAVE Office. Both values are safe to publish: the key below is Supabase's
   publishable ("anon") key, and every table is protected by row-level security in the database.
   NEVER put the service/secret key here. Filled in once the founder's Supabase project exists. */
window.JW_CONFIG = {
  supabaseUrl: 'https://srcclctqfkagpolhocqf.supabase.co',   // project jhoomwave (Mumbai)
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY2NsY3RxZmthZ3BvbGhvY3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1NDY1OTYsImV4cCI6MjExMTEyMjU5Nn0.0_T3iBE2ssrABWWbL8hkLqOOvpany5uP2LSFlhi0G54', // public anon key
  idleMinutes: 30,            // sign out after this long without activity
  songLinkDays: 7,            // customer download links expire after this many days
};
