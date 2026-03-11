# OpenClaw Setup Guide — Desktop PC (RTX 3080 + 32GB RAM)

*A step-by-step guide to install OpenClaw safely on your existing gaming/workstation PC, without risking your personal files.*

---

## Table of Contents

1. [Overview & Safety Philosophy](#1-overview--safety-philosophy)
2. [Prerequisites](#2-prerequisites)
3. [Create a Dedicated Linux User](#3-create-a-dedicated-linux-user)
4. [Install Node.js 22](#4-install-nodejs-22)
5. [Install Docker (for Sandbox Isolation)](#5-install-docker-for-sandbox-isolation)
6. [Install OpenClaw](#6-install-openclaw)
7. [Configure OpenClaw (Security-First)](#7-configure-openclaw-security-first)
8. [Set Up a Communication Channel](#8-set-up-a-communication-channel)
9. [Enable Auto-Start (systemd)](#9-enable-auto-start-systemd)
10. [Verify Everything Works](#10-verify-everything-works)
11. [Daily Usage](#11-daily-usage)
12. [Optional: Raspberry Pi as Backup Node](#12-optional-raspberry-pi-as-backup-node)
13. [Troubleshooting](#13-troubleshooting)
14. [Security Checklist](#14-security-checklist)

---

## 1. Overview & Safety Philosophy

**What is OpenClaw?**
OpenClaw is a local AI assistant that runs on your machine. It connects to AI models (Claude, GPT, Gemini) via API and can read/write files, run commands, and chat with you through Discord/Telegram/WhatsApp.

**Why a separate user?**
OpenClaw's AI can execute commands and modify files. By running it under a **dedicated Linux user**, we ensure:
- It **cannot access** your personal files (photos, documents, games)
- It **cannot delete** anything outside its own workspace
- Even if the AI makes a mistake, your main system is untouched

**Three layers of protection:**
1. **Linux user isolation** — OS-level, cannot be bypassed by software
2. **OpenClaw workspace-only mode** — Software-level restriction to one folder
3. **Docker sandbox** — Commands run inside a container, not on your real system

---

## 2. Prerequisites

**Your system:**
- Desktop PC with RTX 3080 and 32GB RAM ✅
- Linux (Ubuntu, Fedora, Arch, etc.) or Windows with WSL2
- Stable internet connection
- An AI provider API key (at least one):
  - Anthropic (Claude): https://console.anthropic.com/ → API Keys
  - OpenAI (GPT): https://platform.openai.com/api-keys
  - Google (Gemini): https://aistudio.google.com/apikey

**If you're on Windows:**
You need WSL2 first. Open PowerShell as Administrator and run:
```powershell
wsl --install -d Ubuntu-24.04
```
Then restart your PC and open "Ubuntu" from the Start menu. Everything below happens inside that Ubuntu terminal.

**If you're already on Linux:**
Open a terminal and continue.

---

## 3. Create a Dedicated Linux User

This is the most important safety step. We create a user called `openclaw` that is completely isolated from your main account.

```bash
# Create the user with a home directory
sudo useradd -m -s /bin/bash openclaw

# Set a password for the user (you'll need this to switch to it)
sudo passwd openclaw
# Type a password when prompted (it won't show on screen, that's normal)

# Verify the user was created
id openclaw
# Should show: uid=XXXX(openclaw) gid=XXXX(openclaw) groups=XXXX(openclaw)
```

**What this does:**
- Creates `/home/openclaw/` — this is the ONLY directory OpenClaw can write to
- The `openclaw` user has NO access to your `/home/yourusername/` folder
- Your photos, documents, game saves, etc. are completely safe

**Test the isolation (optional but recommended):**
```bash
# Switch to the openclaw user
sudo su - openclaw

# Try to access your files — this should FAIL
ls /home/yourusername/
# Expected output: "ls: cannot open directory '/home/yourusername/': Permission denied"

# Go back to your main user
exit
```

---

## 4. Install Node.js 22

OpenClaw requires Node.js 22 or later.

```bash
# Install Node.js 22 (run as your main user, not openclaw)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v
# Should show: v22.x.x

npm -v
# Should show: 10.x.x or later
```

**For Fedora/RHEL:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
```

**For Arch:**
```bash
sudo pacman -S nodejs npm
```

---

## 5. Install Docker (for Sandbox Isolation)

Docker lets OpenClaw run commands inside an isolated container instead of directly on your system.

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add the openclaw user to the docker group
sudo usermod -aG docker openclaw

# Start Docker and enable auto-start
sudo systemctl start docker
sudo systemctl enable docker

# Verify Docker works
sudo su - openclaw
docker run hello-world
# Should print "Hello from Docker!"
exit
```

---

## 6. Install OpenClaw

Now switch to the `openclaw` user and install:

```bash
# Switch to openclaw user
sudo su - openclaw

# Run the installer
curl -fsSL https://openclaw.ai/install.sh | bash
```

The installer will:
1. Detect Node.js ✅
2. Install the OpenClaw CLI globally
3. Launch the onboarding wizard

**During the wizard, choose:**

| Question | Answer |
|----------|--------|
| Gateway mode | **Local** (this machine) |
| AI Provider | Choose one (Anthropic recommended) |
| API Key | Paste your API key |
| Model | `anthropic/claude-sonnet-4-6` (good balance of speed + quality) |
| Communication channel | Skip for now (we'll set this up next) |
| Daemon | **Yes** (systemd) |

After the wizard finishes:
```bash
# Check status
openclaw status

# Should show:
# Gateway: local · ws://127.0.0.1:18789 · reachable
```

---

## 7. Configure OpenClaw (Security-First)

This is where we lock things down. Edit the config:

```bash
# Still as the openclaw user
nano ~/.openclaw/openclaw.json
```

Find and update these sections (or add them if they don't exist):

```json
{
  "tools": {
    "fs": {
      "workspaceOnly": true
    },
    "elevated": {
      "enabled": false
    }
  },
  "agents": {
    "defaults": {
      "workspace": "/home/openclaw/.openclaw/workspace",
      "sandbox": {
        "mode": "all",
        "scope": "session"
      }
    }
  }
}
```

**What each setting does:**

| Setting | Effect |
|---------|--------|
| `workspaceOnly: true` | AI can ONLY read/write files inside `~/.openclaw/workspace/` |
| `elevated.enabled: false` | AI cannot run commands as root/admin |
| `sandbox.mode: "all"` | ALL commands run inside a Docker container |
| `sandbox.scope: "session"` | Each chat session gets its own container |

Save and exit (`Ctrl+X`, then `Y`, then `Enter`).

Restart the gateway:
```bash
openclaw gateway restart
```

**Lock down file permissions:**
```bash
# Make sure only the openclaw user can access OpenClaw files
chmod 700 /home/openclaw/.openclaw
```

---

## 8. Set Up a Communication Channel

Choose how you want to talk to your AI assistant. Pick ONE to start with.

### Option A: Discord (Recommended)

1. **Create a Discord Bot:**
   - Go to https://discord.com/developers/applications
   - Click "New Application" → Name it (e.g., "My AI Assistant")
   - Go to "Bot" tab → Click "Reset Token" → **Copy the token** (save it!)
   - Enable these under "Privileged Gateway Intents":
     - ✅ Message Content Intent
     - ✅ Server Members Intent (optional)

2. **Invite the Bot to your server:**
   - Go to "OAuth2" → "URL Generator"
   - Check: `bot` + `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Messages/View Channels`, `Add Reactions`, `Manage Messages`
   - Copy the generated URL → Open it in browser → Select your server → Authorize

3. **Configure OpenClaw:**
   ```bash
   # As openclaw user
   nano ~/.openclaw/openclaw.json
   ```

   Add/update the channels section:
   ```json
   {
     "channels": {
       "discord": {
         "enabled": true,
         "token": "YOUR_DISCORD_BOT_TOKEN_HERE",
         "groupPolicy": "allowlist",
         "guilds": {
           "*": {
             "requireMention": true
           }
         }
       }
     }
   }
   ```

   **Important:** Set `groupPolicy: "allowlist"` — this means only approved users can control the AI.

4. **Restart:**
   ```bash
   openclaw gateway restart
   openclaw status
   # Should show Discord: connected
   ```

### Option B: Telegram

1. Open Telegram, search for `@BotFather`
2. Send `/newbot` → follow prompts → get your bot token
3. Configure:
   ```json
   {
     "channels": {
       "telegram": {
         "enabled": true,
         "botToken": "YOUR_TELEGRAM_BOT_TOKEN_HERE",
         "dmPolicy": "pairing"
       }
     }
   }
   ```
4. Restart: `openclaw gateway restart`
5. In Telegram, message your bot and type `/pair` to link

---

## 9. Enable Auto-Start (systemd)

Make OpenClaw start automatically when your PC boots:

```bash
# As openclaw user
openclaw gateway install

# Verify
systemctl --user status openclaw-gateway
# Should show: active (running)

# Enable lingering (so it starts even without logging in)
sudo loginctl enable-linger openclaw
```

**What this does:**
- OpenClaw starts when the PC boots, even if nobody logs in
- It runs as the `openclaw` user (not root)
- If it crashes, systemd restarts it automatically

---

## 10. Verify Everything Works

Run these checks:

```bash
# As openclaw user
# 1. Overall status
openclaw status
# ✅ Gateway: reachable
# ✅ Channel: connected (Discord/Telegram)

# 2. Doctor check
openclaw doctor
# Should show all green

# 3. Security audit
openclaw security audit
# Review any warnings

# 4. Test the sandbox
openclaw security audit --deep
```

**Then test from your chat app:**
- Send a message to your bot: "Hello, what can you do?"
- It should respond! 🎉

**Test the safety:**
- Ask it: "List files in /home" — it should only see `/home/openclaw/`
- Ask it: "Delete /etc/passwd" — it should refuse (workspace-only + sandbox)

---

## 11. Daily Usage

**Talking to your AI:**
- Just message it on Discord/Telegram like you would a friend
- It can help with coding, writing, research, file organization, and more

**Checking on it:**
```bash
sudo su - openclaw
openclaw status          # Quick health check
openclaw security audit  # Security review
```

**Updating OpenClaw:**
```bash
sudo su - openclaw
openclaw update          # Check for and apply updates
```

**Viewing logs:**
```bash
sudo su - openclaw
tail -f ~/.openclaw/logs/gateway.log
```

**Stopping/Starting:**
```bash
sudo su - openclaw
openclaw gateway stop    # Stop
openclaw gateway start   # Start
openclaw gateway restart # Restart
```

---

## 12. Optional: Raspberry Pi as Backup Node

Your Raspberry Pi 3B (1GB) can serve as a lightweight always-on backup.

**On the Pi:**
```bash
# Flash Raspberry Pi OS Lite (64-bit) to SD card
# SSH in, then:

sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential

# Add swap (critical for 1GB RAM)
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install OpenClaw
curl -fsSL https://openclaw.ai/install.sh | bash
```

Use the Pi for:
- 24/7 Discord/Telegram bot (lightweight, always on)
- Scheduled tasks and monitoring
- Backup gateway when your main PC is off

---

## 13. Troubleshooting

### "Command not found: openclaw"
```bash
# The installer puts it in ~/.local/bin or /usr/local/bin
# Add to PATH if needed:
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### "Gateway not reachable"
```bash
# Check if it's running
openclaw gateway status

# Check logs for errors
tail -50 ~/.openclaw/logs/gateway.log

# Restart
openclaw gateway restart
```

### "Docker permission denied"
```bash
# Make sure openclaw user is in docker group
sudo usermod -aG docker openclaw

# Log out and back in (important!)
exit
sudo su - openclaw

# Test
docker ps
```

### "Cannot connect to Discord"
- Double-check the bot token in config
- Make sure Message Content Intent is enabled in Discord Developer Portal
- Check: `openclaw status` — look for Discord connection status

### "Out of memory" or system hangs
- This shouldn't happen with 32GB RAM
- If using Raspberry Pi: make sure swap is enabled (`free -h`)
- Reduce concurrent sessions: set `"maxConcurrent": 2` in config

### Config file syntax error
```bash
# Validate your JSON
cat ~/.openclaw/openclaw.json | python3 -m json.tool
# If there's an error, it'll show you the line number
```

---

## 14. Security Checklist

Before you consider the setup "done," verify each item:

- [ ] OpenClaw runs as `openclaw` user (NOT your main user, NOT root)
- [ ] `workspaceOnly: true` is set in config
- [ ] `sandbox.mode: "all"` is set in config
- [ ] `elevated.enabled: false` is set in config
- [ ] `chmod 700 ~/.openclaw` has been applied
- [ ] Discord `groupPolicy: "allowlist"` (not "open")
- [ ] Docker is installed and working
- [ ] `openclaw security audit` shows no critical issues
- [ ] You tested that the AI cannot access your personal files
- [ ] Systemd auto-start is enabled
- [ ] You have your API key saved somewhere safe (not just in the config)

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Switch to OpenClaw user | `sudo su - openclaw` |
| Check status | `openclaw status` |
| Start gateway | `openclaw gateway start` |
| Stop gateway | `openclaw gateway stop` |
| Restart gateway | `openclaw gateway restart` |
| Update OpenClaw | `openclaw update` |
| Security audit | `openclaw security audit --deep` |
| View logs | `tail -f ~/.openclaw/logs/gateway.log` |
| Edit config | `nano ~/.openclaw/openclaw.json` |

---

*Guide prepared by OpenClaw AI Assistant. Last updated: March 2026.*
*For more info: https://docs.openclaw.ai*
