# 🚀 Guide de Déploiement VPS - PlagiatIA

## 📋 Informations du déploiement

| Paramètre | Valeur |
|-----------|--------|
| **Domaine** | `plagiatia.aenews.net` |
| **IP Serveur** | `95.111.226.63` |
| **Runtime** | Bun (pas Node.js!) |
| **Framework** | Next.js 16 (standalone output) |
| **Base de données** | SQLite (Prisma) |
| **Reverse Proxy** | Nginx |
| **SSL** | Let's Encrypt (Certbot) |
| **Process Manager** | PM2 |

---

## 🔧 Prérequis

- **Serveur**: Ubuntu 22.04+ ou Debian 12+
- **Accès**: SSH root ou sudo
- **DNS**: Enregistrement A configuré: `plagiatia.aenews.net` → `95.111.226.63`
- **Ports**: 22 (SSH), 80 (HTTP), 443 (HTTPS) ouverts

---

## ⚡ Installation Rapide (Recommandé)

### Étape 1: Copier les fichiers sur le serveur

Depuis votre machine locale:

```bash
# Connectez-vous au serveur
ssh root@95.111.226.63

# Créer le répertoire de déploiement
mkdir -p /opt/plagiatia-deploy
cd /opt/plagiatia-deploy

# Si vous avez cloné le repo, copiez les fichiers de déploiement
# Sinon, clonez d'abord:
git clone https://github.com/AlterEgo095/DPATA.git /opt/plagiatia-deploy
```

### Étape 2: Exécuter le script d'installation

```bash
cd /opt/plagiatia-deploy/deploy

# Rendre exécutable
chmod +x setup-vps.sh deploy.sh

# Lancer l'installation complète
sudo ./setup-vps.sh plagiatia.aenews.net admin@aenews.net
```

Ce script installe automatiquement:
- ✅ Bun Runtime
- ✅ PM2 Process Manager  
- ✅ Nginx + Certbot
- ✅ Pare-feu UFW
- ✅ Fail2Ban (anti brute-force)
- ✅ Fichier `.env.production` avec secrets sécurisés

### Étape 3: Déployer l'application

```bash
cd /var/www/plagiatia

# Première installation
./deploy/deploy.sh --setup
```

### Étape 4: Configurer SSL (Certbot)

```bash
certbot --nginx -d plagiatia.aenews.net \
    --email admin@aenews.net \
    --agree-tos \
    --redirect \
    --no-eff-email
```

### Étape 5: Vérifier le déploiement

```bash
# Statut complet
./deploy/deploy.sh --status

# Ou accéder à https://plagiatia.aenews.net
```

---

## 📝 Installation Manuelle (Pas à pas)

Si vous préférez un contrôle total:

### 1. Mise à jour du système

```bash
apt update && apt upgrade -y
apt install -y curl wget git ufw fail2ban nginx certbot python3-certbot-nginx
```

### 2. Installer Bun

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
```

### 3. Installer PM2

```bash
bun install -g pm2
pm2 startup systemd
pm2 save
```

### 4. Configurer le pare-feu

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 5. Créer les répertoires

```bash
mkdir -p /var/www/plagiatia/{logs,data,backups}
mkdir -p /var/www/certbot
mkdir -p /etc/nginx/snippets
```

### 6. Cloner l'application

```bash
cd /var/www/plagiatia
git clone https://github.com/AlterEgo095/DPATA.git temp
mv temp/* . && mv temp/.* . 2>/dev/null || true
rm -rf temp
```

### 7. Configurer l'environnement

```bash
cp deploy/.env.production.example .env.local
nano .env.local  # Modifier avec vos vrais secrets!
```

Générer des secrets sécurisés:

```bash
openssl rand -base64 64  # JWT_SECRET
openssl rand -hex 32     # PASSWORD_SALT
openssl rand -hex 32     # API_ENCRYPTION_KEY
```

### 8. Installer et build

```bash
bun install
bun run db:push        # Initialiser la BDD
bun run build          # Build Next.js standalone
```

### 9. Configurer PM2

```bash
cp deploy/templates/ecosystem.config.js .
pm2 start ecosystem.config.js
pm2 save
```

### 10. Configurer Nginx

```bash
# Copier la configuration
cp deploy/nginx/plagiatia.aenews.net.conf /etc/nginx/sites-available/

# Activer le site
ln -sf /etc/nginx/sites-available/plagiatia.aenews.net.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Copier le snippet proxy
cp deploy/nginx/plagiatia-proxy.conf /etc/nginx/snippets/

# Tester et recharger
nginx -t && systemctl reload nginx
```

### 11. Configurer SSL

```bash
certbot --nginx -d plagiatia.aenews.net \
    --email admin@aenews.net \
    --agree-tos \
    --redirect \
    --no-eff-email
```

---

## 🔧 Commandes Utiles

### Gestion de l'application

```bash
# Voir les logs en temps réel
pm2 logs plagiatia --lines 100

# Redémarrer l'application
pm2 restart plagiatia

# Arrêter/Démarrer
pm2 stop plagiatia
pm2 start plagiatia

# Voir les statistiques
pm2 monit
```

### Mises à jour

```bash
# Déployer une nouvelle version
cd /var/www/plagiatia
./deploy/deploy.sh --deploy

# Revenir en arrière si problème
./deploy/deploy.sh --rollback

# Backup manuel de la BDD
./deploy/deploy.sh --backup
```

### Nginx

```bash
# Tester la configuration
nginx -t

# Recharger après modification
systemctl reload nginx

# Voir les logs d'accès
tail -f /var/log/nginx/plagiatia_ssl_access.log

# Voir les logs d'erreur
tail -f /var/log/nginx/plagiatia_ssl_error.log
```

### Base de données

```bash
# Emplacement de la BDD
/var/www/plagiatia/data/plagiatia.db

# Backups disponibles
ls -la /var/www/plagiatia/backups/

# Restaurer un backup
gunzip < /var/www/plagiatia/backups/plagiatia_YYYYMMDD_HHMMSS.db.gz > /var/www/plagiatia/data/plagiatia.db
pm2 restart plagiatia
```

### SSL/TLS

```bash
# Vérifier le statut du certificat
certbot certificates

# Renouveler manuellement
certbot renew

# Test de renouvellement (dry-run)
certbot renew --dry-run

# Le renouvellement est automatique via cron (systemd timer)
```

---

## 🔒 Sécurité

### Configuration déjà appliquée par setup-vps.sh:

- [x] Pare-feu UFW (ports 22, 80, 443 uniquement)
- [x] Fail2Ban (protection SSH et Nginx)
- [x] Rate limiting Nginx (API, login, uploads)
- [x] Headers de sécurité (HSTS, X-Frame-Options, CSP)
- [x] TLS 1.2/1.3 uniquement
- [x] OCSP Stapling

### Recommandations supplémentaires:

1. **Changer le port SSH** (optionnel mais recommandé):
   ```bash
   nano /etc/ssh/sshd_config
   # Port 22 -> Port 2222 (par exemple)
   systemctl restart sshd
   ufw allow 2222/tcp
   ```

2. **Authentification SSH par clés uniquement**:
   ```bash
   # Sur votre machine locale
   ssh-copy-id root@95.111.226.63
   
   # Puis sur le serveur
   nano /etc/ssh/sshd_config
   # PasswordAuthentication no
   systemctl restart sshd
   ```

3. **Mises à jour automatiques** (optionnel):
   ```bash
   apt install unattended-upgrades
   dpkg-reconfigure --priority=low unattended-upgrades
   ```

---

## 🐛 Dépannage

### L'application ne démarre pas

```bash
# Voir les logs d'erreur
pm2 logs plagiatia --err --lines 50

# Vérifier que Bun fonctionne
bun --version

# Vérifier le build
ls -la /var/www/plagiatia/.next/standalone/
```

### Erreur 502 Bad Gateway

```bash
# Vérifier si Next.js tourne
curl http://127.0.0.1:3000/api/health

# Vérifier Nginx
nginx -t
systemctl status nginx
```

### Problème SSL

```bash
# Vérifier le certificat
openssl s_client -connect plagiatia.aenews.net:443 -servername plagiatia.aenews.net </dev/null

# Reconfigurer Certbot
certbot --nginx -d plagiatia.aenews.net --force-renewal
```

### Base de données corrompue

```bash
# Restaurer depuis le dernier backup
./deploy/deploy.sh --rollback
```

---

## 📊 Monitoring (Optionnel)

Pour un monitoring avancé, vous pouvez installer:

### PM2 Plus (Monitoring cloud)
```bash
pm2 plus
# Suivre les instructions pour lier votre compte
```

### Logs structurés (Optionnel)
```bash
# Installer pm2-logrotate pour rotation auto des logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 📞 Support

En cas de problème:

1. Consultez les logs: `pm2 logs plagiatia`
2. Vérifiez le statut: `./deploy/deploy.sh --status`
3. Consultez ce guide de dépannage

---

## 📄 Fichiers de déploiement

| Fichier | Description |
|---------|-------------|
| `setup-vps.sh` | Script d'installation initiale du serveur |
| `deploy.sh` | Script de déploiement/mise à jour |
| `nginx/plagiatia.aenews.net.conf` | Configuration Nginx complète |
| `nginx/plagiatia-proxy.conf` | Snippet proxy pour Next.js/Bun |
| `.env.production.example` | Template variables environnement |
| `templates/ecosystem.config.js` | Configuration PM2 |

---

**Dernière mise à jour**: $(date +%Y-%m-%d)
**Version**: 2.0
**Domaine**: plagiatia.aenews.net
