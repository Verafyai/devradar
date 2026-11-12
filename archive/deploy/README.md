# DevRadar deploy (2026-10-20)
- Project: devradar (scope verafyai), domain devradar.rexstjohn.com. Deploy: ./deploy.sh <site.tgz> (archive with top-level site/).
- Env: BLOB_READ_WRITE_TOKEN via connected Blob store agentready-blob (store_T8WrVKduFUZGI7mY), Production+Preview; shared with project agentready.
- agentready.rexstjohn.com: project agentready now serves only a 308 catch-all redirect (agentready-redirect/vercel.json) to devradar.rexstjohn.com, keeping path and query.
- Rollback: the previous agentready prod deployment was https://agentready-aj4jofgg4-verafyai.vercel.app (`vercel promote` it, or redeploy agentready-redirect/).
- Warning: running /workspace/agentready/deploy.sh again would replace the redirect with the old AgentReady site.
