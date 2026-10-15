# Read-only archive viewer service

Workstation deployment of `type-blitz review`, independent of game startup and
collection/generation. Uses Fedora's `/usr/bin/node` and the built `dist/` tree.
The service filesystem is read-only; records are rendered in memory, not exported.
Runtime archives remain under `~/runs/type-blitz/`.

```sh
npm run build
ln -s ~/code/dev/type-blitz/systemd/type-blitz-review.service ~/.config/systemd/user/type-blitz-review.service
systemctl --user daemon-reload
systemctl --user enable --now type-blitz-review.service
```

Access: `http://poopship.tail4eec74.ts.net:19829/` or
`http://100.81.85.68:19829/` over Tailscale. The service binds `0.0.0.0` and relies
on the existing workstation firewall/tailnet policy; it does not configure public
exposure or introduce a separate login. Everyone admitted by that network policy
can read these archives. Do not publicly proxy this personal review service.

Host checks allow localhost, the machine hostname/interface addresses, and the
explicit tailnet DNS name in the unit. Origin checks and same-origin framing stay
in place; there are no mutation endpoints, CORS grants or client-IP allowlists.
If moving machines, update the repo paths/DNS name in the unit (or use a systemd
override); arbitrary Host headers are intentionally rejected.

```sh
systemctl --user status type-blitz-review.service
journalctl --user -u type-blitz-review.service
systemctl --user restart type-blitz-review.service  # after rebuilding changed code
systemctl --user disable --now type-blitz-review.service  # stop/remove automatic startup
```

Only enable this unit through its symlink; do not maintain a separate copied unit.
A foreground alternative is `type-blitz review` (Ctrl+C to stop). Neither starts the
game, takes the generation lock, browses sources, calls a model, or writes archives.
