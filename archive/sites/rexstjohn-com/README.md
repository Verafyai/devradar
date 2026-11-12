# DevRadar on rexstjohn.com: change package for Verafyai/rexstjohn.com (main @ c4288d8)

Add:
- content/projects/devradar.mdx
- public/logos/devradar.svg        (DevRadar's own live mark, mark only; LogoTile supplies the frame)
- public/images/projects/devradar.webp  (1440x900 screenshot of https://devradar.rexstjohn.com, 2026-10-20)

Replace:
- next.config.mjs  (adds a permanent redirect /projects/agentready -> /projects/devradar)

Delete (AgentReady was absorbed into DevRadar as Stage 2):
- content/projects/agentready.mdx
- public/logos/agentready.svg
- public/images/projects/agentready.webp

Originals of every replaced/deleted file are in backup-from-main/.

Then: npm run build (must be green), commit, open PR, merge to main. Vercel
(verafyai/rexstjohn-com) deploys main automatically.

Verify after deploy:
- https://www.rexstjohn.com/projects shows DevRadar with the radar tile and a "See the demo" link
- https://www.rexstjohn.com/projects/devradar loads, with "Run a free scan" -> https://devradar.rexstjohn.com
- https://www.rexstjohn.com/projects/agentready 308s to /projects/devradar
- AgentReady no longer appears on /projects or the home ship log
