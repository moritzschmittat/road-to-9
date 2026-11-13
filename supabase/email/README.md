# Email templates

Pasted into Supabase → Authentication → Emails → Templates.

| Template | Subject | Body |
|---|---|---|
| Invite user | `{{ if .Data.invited_by_name }}{{ .Data.invited_by_name }} invited you to Road to 9{{ else }}You're invited to Road to 9{{ end }}` | `invite.html` |
| Magic link or OTP | `Your Road to 9 sign-in link` | `magic-link.html` |
