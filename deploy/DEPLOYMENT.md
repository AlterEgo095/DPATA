# 🚀 Guide de Déploiement Production - PlagiatIA

**Université de Kinshasa (UNIKIN)**

Ce guide couvre le déploiement complet de PlagiatIA sur un VPS avec Nginx, SSL (Let's Encrypt), et PM2.

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Architecture de Déploiement](#architecture)
3. [Méthode 1: Déploiement Manuel (Recommandé)](#méthode-1-manuel)
4. [Méthode 2: Script Automatisé](#méthode-2-script)
5. [Méthode 3: Docker](#méthode-3-docker)
6. [Configuration Nginx](#configuration-nginx)
7. [SSL/TLS avec Certbot](#ssl-tls)
8. [Gestion des Mises à Jour](#mises-à-jour)
9. [Monitoring & Maintenance](#monitoring)
10. [Dépannage](#dépannage)

---

## 🔧 Prérequis

### Serveur (VPS)

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 1 vCore | 2+ vCores |
| RAM | 1 GB | 2-4 GB |
| Stockage | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Debian 12 / Ubuntu 22.04 |

### Logiciels serveur

```bash
# Installer les dépendances
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx \
                   build-essential ufw fail2ban
```

### Node.js 20 LTS

```bash
# Via NodeSource (recommandé)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérification
node --version   # v20.x.x
npm --version    # 10.x.x
```

### PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 startup systemd  # Démarrage automatique au boot
```

### Domaine DNS

Configurer votre domaine pour pointer vers l'IP du VPS:

```
A    @           <IP-VPS>
A    www         <IP-VPS>
AAAA @           <IP-V6-SI-DISPONIBLE>
```

---

## 🏗️ Architecture de Déploiment

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                            │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare (optionnel)                  │
│              - CDN / DDoS Protection / Cache               │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Nginx (port 80/443)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Reverse Proxy vers Next.js                       │   │
│  │  • SSL Termination (Let's Encrypt)                 │   │
│  │  • Rate Limiting                                    │   │
│  │  • Cache statique                                   │   │
│  │  • Compression gzip/brotli                          │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                PM2 + Next.js Standalone                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Port 3000 (localhost uniquement)                 │   │
│  │  • Mode standalone (auto-suffisant)                 │   │
│  │  • Gestion mémoire max 512MB                         │   │
│  │  • Redémarrage automatique en cas d'erreur          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ SQLite DB    │  │ Logs        │  │ Uploads       │    │
│  │ data/*.db    │  │ logs/       │  │ data/uploads/ │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Méthode 1: Déploiement Manuel

### Étape 1: Préparer le serveur

```bash
# Se connecter au VPS
ssh root@votre-vps-ip

# Exécuter le script d'installation rapide
curl -fsSL https://raw.githubusercontent.com/votre-repo/plagiatia/main/deploy/scripts/setup-vps.sh | bash -s plagiatia.unikin.ac.cd admin@unikin.ac.cd
```

Ou manuellement:

```bash
# Créer l'utilisateur et répertoires
mkdir -p /var/www/plagiatia/{logs,data,backups}
usermod -a -G www-data $USER  # ou utilisez www-data

# Cloner le repository
cd /var/www/plagiatia
git clone https://github.com/votre-username/plagiatia.git .
git checkout main  # ou la branche de production
```

### Étape 2: Configurer l'environnement

```bash
# Copier le template d'environnement
cp deploy/templates/.env.production.example .env.production

# Éditer avec vos secrets
nano .env.production
```

**Variables obligatoires à modifier:**

```env
JWT_SECRET=openssl rand -base64 64  # Générez un nouveau!
PASSWORD_SALT=openssl rand -hex 32  # Générez un nouveau!
ADMIN_PASSWORD=votre-mot-de-passe-admin
APP_URL=https://plagiatia.unikin.ac.cd
EMAIL=admin@unikin.ac.cd
```

### Étape 3: Build

```bash
# Installation des dépendances
npm ci --production=false

# Build en mode standalone
NODE_ENV=production npm run build

# Le build crée .next/standalone/ qui est auto-suffisant
```

### Étape 4: Configurer PM2

```bash
# Copier la configuration PM2
cp deploy/templates/ecosystem.config.js .

# Adapter si nécessaire (chemins, etc.)
nano ecosystem.config.js

# Démarrer l'application
pm2 start ecosystem.config.js
pm2 save  # Sauvegarder la configuration
```

### Étape 5: Configurer Nginx

```bash
# Copier la configuration
sudo cp deploy/nginx/plagiatia.conf /etc/nginx/sites-available/
sudo cp deploy/nginx/plagiatia-proxy.conf /etc/nginx/snippets/

# Remplacer le domaine
sudo sed -i 's/VOTRE_DOMAINE/plagiatia.unikin.ac.cd/g' \
    /etc/nginx/sites-available/plagiatia.conf

# Activer le site
sudo ln -sf /etc/nginx/sites-available/plagiatia.conf \
    /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Tester et recharger
sudo nginx -t && sudo systemctl reload nginx
```

### Étape 6: Configurer SSL

```bash
# Obtenir le certificat Let's Encrypt
sudo certbot --nginx \
    -d plagiatia.unikin.ac.cd \
    -d www.plagiatia.unikin.ac.cd \
    --email admin@unikin.ac.cd \
    --agree-tos \
    --redirect \
    --hsts

# Tester le renouvellement automatique
sudo certbot renew --dry-run
```

### ✅ Vérification finale

```bash
# Vérifier que tout fonctionne
curl -I https://plagiatia.unikin.ac.cd

# Devrait retourner:
# HTTP/2 200
# server: nginx
# strict-transport-security: ...
```

---

## 🤖 Méthode 2: Script Automatisé

Le script `deploy.sh` automatisent toutes les étapes:

```bash
# Rendre exécutable
chmod +x deploy/scripts/deploy.sh

# Première installation complète
sudo ./deploy/scripts/deploy.sh --setup

# Déploiements ultérieurs
sudo ./deploy/scripts/deploy.sh --deploy

# Uniquement SSL
sudo ./deploy/scripts/deploy.sh --ssl

# Backup de la base de données
sudo ./deploy/scripts/deploy.sh --backup

# Rollback en cas de problème
sudo ./deploy/scripts/deploy.sh --rollback
```

---

## 🐳 Méthode 3: Docker

### Avec Docker Compose (recommandé)

```bash
# Aller dans le répertoire deploy
cd deploy

# Configurer l'environnement
cp ../.env.production.example ../.env
nano ../.env  # Modifier les secrets

# Lancer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f plagiatia

# Arrêter
docker-compose down
```

### Sans Docker Compose

```bash
# Build l'image
docker build -t plagiatia:latest -f deploy/Dockerfile .

# Exécuter
docker run -d \
    --name plagiatia \
    -p 3000:3000 \
    --env-file .env.production \
    -v $(pwd)/data:/app/data \
    -v $(pwd)/logs:/app/logs \
    --restart unless-stopped \
    plagiatia:latest
```

---

## ⚙️ Configuration Nginx

La configuration inclut:

### Rate Limiting

| Endpoint | Limite | But |
|----------|--------|-----|
| `/api/auth/login` | 5 req/min | Anti brute-force |
| `/api/*` | 100 req/s | Protection API générale |
| `/api/documents` | 10 req/5min | Limite uploads |
| Connexions | 20/IP | Anti-DDoS |

### Cache Statique

| Type | Durée | Headers |
|------|-------|---------|
| `_next/static/*` | 1 an | immutable |
| Images | 30 jours | public |
| Fonts | 1 an | immutable |
| API | Pas de cache | no-store |

### Sécurité

- **HSTS**: Strict-Transport-Security avec preload
- **X-Frame-Options**: DENY (anti-clickjacking)
- **XSS Protection**: Mode block
- **Content Security Policy**: Restrictif
- **Referrer Policy**: strict-origin-when-cross-origin

---

## 🔒 SSL/TLS avec Certbot

### Configuration automatique

```bash
# Certificat standard avec redirection HTTP→HTTPS
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com

# Avec HSTS et OCSP Stapling (plus sécurisé)
certbot --nginx \
    -d votre-domaine.com \
    --email admin@example.com \
    --agree-tos \
    --redirect \
    --hsts \
    --staple-ocsp \
    --must-staple
```

### Renouvellement automatique

Certbot configure automatiquement une tâche cron pour renouveler les certificats:

```bash
# Vérifier que le cron est configuré
cat /etc/cron.d/certbot

# Test de renouvellement (sans rien changer)
certbot renew --dry-run
```

### Forcer le renouvellement manuel

```bash
certbot renew --force-renewal
systemctl reload nginx
```

---

## 🔄 Gestion des Mises à Jour

### Workflow recommandé

```bash
#!/bin/bash
# update.sh - Script de mise à jour

cd /var/www/plagiatia

# 1. Backup avant mise à jour
pm2 stop plagiatia
tar -czvf backups/pre-update-$(date +%Y%m%d_%H%M).tar.gz \
    data/ .next/ ecosystem.config.js .env.production

# 2. Récupérer le nouveau code
git fetch origin
git pull origin main

# 3. Mettre à jour les dépendances
npm ci --production=false

# 4. Rebuild
npm run build

# 5. Redémarrer
pm2 restart plagiatia
pm2 save

# 6. Vérifier
sleep 3
pm2 status
curl -s http://localhost:3000/api/health | head
```

### Rollback

Si problème après mise à jour:

```bash
# Arrêter l'application
pm2 stop plagiatia

# Restaurer le backup
tar -xzvf backups/pre-update-YYYYMMDD_HHMM.tar.gz

# Redémarrer
pm2 start plagiatia
```

Ou avec git:

```bash
git log --oneline -10  # Voir les commits précédents
git checkout <commit-précédent>
npm run build
pm2 restart plagiatia
```

---

## 📊 Monitoring & Maintenance

### Commandes PM2 utiles

```bash
pm2 list              # Liste des processus
pm2 show plagiatia   # Détails du processus
pm2 logs plagiatia   # Logs temps réel
pm2 monit             # Monitoring interactif (TUI)

# Gestion mémoire
pm2 info              # Info système
pm2 prettyprint       # Stats formatées

# Redémarrages
pm2 restart plagiatia
pm2 reload plagiatia  # Graceful (zero downtime)
pm2 reset plagiatia   # Reset compteurs
```

### Logs

```bash
# Emplacement des logs
/var/www/plagiatia/logs/pm2-error.log
/var/www/plagiatia/logs/pm2-out.log
/var/log/nginx/plagiatia_access.log
/var/log/nginx/plagiatia_error.log

# Rotation des logs (configurée dans PM2)
pm2 set pm2-logrotate:max_size '10M'
pm2 set pm2-logrotate:retain '30'
pm2 flush            # Vider les logs actuels
```

### Health Checks

```bash
# Local
curl http://localhost:3000/api/health

# Public
curl https://plagiatia.unikin.ac.cd/api/health

# Détail
curl -I https://plagiatia.unikin.ac.cd
```

### Backups Automatisés

Ajouter au cron (`crontab -e`):

```cron
# Backup quotidien à 3h du matin
0 3 * * * cd /var/www/plagiatia && tar -czvf backups/db-$(date +\%Y\%m\%d).tar.gz data/ && find backups/ -name "*.tar.gz" -mtime +30 -delete

# Nettoyage logs anciens (tous les dimanches à 4h)
0 4 * * 0 find /var/www/plagiatia/logs -name "*.log" -mtime +7 -delete
```

---

## 🐛 Dépannage

### Problèmes courants

#### Application ne démarre pas

```bash
# Voir les erreurs récentes
pm2 logs plagiatia --err --lines 50

# Vérifier les ports
ss -tlnp | grep 3000

# Vérifier Node.js
node --version
which node
```

#### Erreur EADDRINUSE (port déjà utilisé)

```bash
# Trouver le processus sur le port 3000
lsof -i :3000
# ou
fuser 3000/tcp

# Tuer le processus
kill -9 <PID>

# Ou redémarrer PM2
pm2 restart plagiatia
```

#### Erreur 502 Bad Gateway (Nginx)

```bash
# Vérifier que Next.js tourne
curl localhost:3000/api/health

# Vérifier la config Nginx
nginx -t
systemctl status nginx

# Voir les logs Nginx
tail -50 /var/log/nginx/error.log
```

#### Erreur SSL/Certificat

```bash
# Vérifier le certificat
openssl s_client -connect plagiatia.unikin.ac.cd:443 -servername plagiatia.unikin.ac.cd </dev/null

# Tester le renouvellement
certbot renew --dry-run

# Re-générer si nécessaire
certbot certonly --force-renewal --nginx -d plagiatia.unikin.ac.cd
```

#### Mémoire insuffisante

```bash
# Voir l'utilisation mémoire
free -h
pm2 show plagiatia | grep memory

# Augmenter la limite dans ecosystem.config.js
max_memory_restart: '512M' -> '1024M'

# Ou ajouter du swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Performance Optimization

```bash
# Activer la compression Brotli dans Nginx (si disponible)
# Ajouter dans le bloc http {}:
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

# Tuning TCP
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_max_syn_backlog=65535
sysctl -w net.ipv4.ip_local_port_range="1024 65535"

# Persister les changements
echo "net.core.somaxconn=65535" >> /etc/sysctl.conf
sysctl -p
```

---

## 📞 Support

Pour toute question ou problème:

- **Documentation**: https://docs.plagiatia.unikin.ac.cd
- **Issues GitHub**: https://github.com/votre-repo/plagiatia/issues
- **Email**: admin@unikin.ac.cd

---

*Dernière mise à jour: Janvier 2025*
*Version: 1.0*
