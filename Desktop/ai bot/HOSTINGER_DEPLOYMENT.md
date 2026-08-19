# 🚀 Hostinger Deployment Guide — Appointment Management System

This guide walks you through deploying the **Hospital Appointment System** on **Hostinger VPS** (Ubuntu 22.04/24.04) or **Hostinger Node.js Hosting**.

---

## Option 1: Hostinger VPS (Recommended)

Hostinger VPS allows you to run both the **Node.js Express Server** (Port 4000) and the **Python LangGraph AI Agent** (Port 8000) with PM2 process manager and Nginx reverse proxy.

---

### Step 1: Connect to Your Hostinger VPS via SSH

Open your terminal on your computer and connect to your VPS:

```bash
ssh root@YOUR_HOSTINGER_SERVER_IP
```

---

### Step 2: Install Node.js, Python, Git, and Nginx

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x & npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Install Python 3, pip, and virtualenv
sudo apt install -y python3 python3-pip python3-venv

# Install PM2 process manager globally
sudo npm install -g pm2
```

---

### Step 3: Clone Your GitHub Repository

```bash
cd /var/www
sudo git clone https://github.com/aashrithkarri/hospital-management-system.git
sudo chown -R $USER:$USER /var/www/hospital-management-system
cd /var/www/hospital-management-system
```

---

### Step 4: Setup Node.js & Python Environments

#### 1. Setup Node.js Dependencies:
```bash
npm install
cd backend
npm install
cd ..
```

#### 2. Setup Python Virtual Environment:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
deactivate
```

#### 3. Configure Environment Variables:
Create `.env` inside `/var/www/hospital-management-system/backend/.env`:
```bash
nano backend/.env
```
Add your production variables:
```env
PORT=4000
PYTHON_AGENT_URL=http://127.0.0.1:8000
GEMINI_API_KEY=your_gemini_api_key_here
SESSION_SECRET=your_secure_session_secret
```

---

### Step 5: Start Services with PM2

```bash
# 1. Start Python LangGraph Agent
pm2 start /var/www/hospital-management-system/venv/bin/python3 --name "hospital-python-agent" -- backend/langgraph_agent.py

# 2. Start Node.js Web Server & Bridge
pm2 start backend/chatbot-server.js --name "hospital-node-server"

# 3. Save PM2 startup script so services restart on reboot
pm2 save
pm2 startup
```

Verify that both services are online:
```bash
pm2 status
```

---

### Step 6: Configure Nginx as Reverse Proxy

Create an Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/hospital-system
```

Paste the following configuration (replace `yourdomain.com` with your Hostinger domain or IP):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/hospital-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Step 7: Secure with Free SSL (Let's Encrypt / Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🔄 Deploying Future Updates

Whenever you make changes and push to GitHub, update your live Hostinger server in 1 minute:

```bash
cd /var/www/hospital-management-system
git pull origin main
npm install
pm2 restart all
```
