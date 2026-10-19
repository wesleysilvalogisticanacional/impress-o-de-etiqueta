<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Auth is corporate OIDC (ANCORA ID) via a BFF in `src/routes/api/public/oidc/*` (TanStack server routes, not Supabase Edge Functions — this stack runs server logic there); OIDC tokens live only in `app_sessions`, the browser holds just an httpOnly opaque session cookie. Why: client_secret/tokens must never reach the frontend.
- Authorization is `public.users` (active=true); never auto-create users on login. Why: IDP authenticates, the app's table authorizes.
- `users` and `app_sessions` have RLS with no client policies; only server code with the admin client touches them. Why: no anonymous/client access to sessions.
