# ExportNavi Backend EC2 Docker Deploy

## 1. EC2 prerequisites

- Ubuntu 22.04 or 24.04
- Security group open ports:
  - `22` SSH
  - `80` HTTP
  - `443` HTTPS
  - temporary only: `8082` backend direct test
- Docker and Docker Compose plugin installed

## 2. Clone repository

```bash
git clone https://github.com/wonu1016/ExportNavi.git
cd ExportNavi/Backend
```

## 3. Create production env

```bash
cp .env.production.example .env.production
nano .env.production
```

Required values:

```txt
FRONTEND_URL=https://export-navi-8ham.vercel.app
CORS_ALLOWED_ORIGINS=https://export-navi-8ham.vercel.app
MYSQL_ROOT_PASSWORD=...
MYSQL_PASSWORD=...
JWT_SECRET=...
GOOGLE_CLIENT_SECRET=...
OPENAI_API_KEY=...
```

## 4. Start backend and MySQL

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -i http://localhost:8082/api/me
```

`/api/me` should return `401` before login.

## 5. Vercel frontend environment variable

After the backend domain is ready, set this in Vercel:

```txt
VITE_API_BASE_URL=https://api.exportnavi.com/api
```

Then redeploy the frontend.

## 6. Google OAuth redirect URI

Add this to Google Cloud OAuth authorized redirect URIs:

```txt
https://api.exportnavi.com/login/oauth2/code/google
```

For temporary direct EC2 testing without HTTPS, OAuth will usually be painful. Use the API domain with HTTPS for the final login flow.

## 7. GitHub Actions backend deploy

The repository includes a manual deploy workflow:

```txt
.github/workflows/deploy-backend-ec2.yml
```

Add these GitHub repository secrets before running it:

```txt
EC2_HOST=your-ec2-public-ip-or-domain
EC2_USER=ubuntu
EC2_SSH_KEY=your-private-ssh-key
```

The workflow uploads the project to:

```txt
~/exportnavi
```

Before the first workflow deploy, create the production env file on EC2:

```bash
mkdir -p ~/exportnavi/Backend
cd ~/exportnavi/Backend
nano .env.production
```

Use the same values from `Backend/.env.production.example`.
