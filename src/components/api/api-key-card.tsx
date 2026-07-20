'use client';

// ApiKeyCard Component
// Displays API key information with actions

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  RefreshCw,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface ApiKeyData {
  id: string;
  name: string;
  prefix: string;
  permissions: ('read' | 'write' | 'admin')[];
  rateLimit: number;
  ipAddressWhitelist?: string[];
  isValid: boolean;
  expiresAt?: Date | string;
  lastUsedAt?: Date | string;
  usageCount: number;
  createdAt: Date | string;
}

interface ApiKeyCardProps {
  apiKey: ApiKeyData;
  fullKey?: string; // Only available right after creation
  onRevoke?: (keyId: string) => void;
  onRegenerate?: (keyId: string) => void;
  onViewStats?: (keyId: string) => void;
  showActions?: boolean;
}

const permissionColors: Record<string, string> = {
  read: 'bg-blue-100 text-blue-800',
  write: 'bg-amber-100 text-amber-800',
  admin: 'bg-red-100 text-red-800',
};

const permissionLabels: Record<string, string> = {
  read: 'Lecture',
  write: 'Écriture',
  admin: 'Admin',
};

export function ApiKeyCard({
  apiKey,
  fullKey,
  onRevoke,
  onRegenerate,
  onViewStats,
  showActions = true,
}: ApiKeyCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayKey = fullKey || apiKey.prefix;
  const maskedKey = showKey ? displayKey : `${apiKey.prefix.substring(0, 12)}${'•'.repeat(20)}${apiKey.prefix.endsWith('...') ? '' : '...'}`;

  const handleCopy = async () => {
    if (fullKey) {
      await navigator.clipboard.writeText(fullKey);
    } else {
      await navigator.clipboard.writeText(apiKey.prefix);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Jamais';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
  const isExpiringSoon = apiKey.expiresAt && !isExpired && 
    (new Date(apiKey.expiresAt).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;

  return (
    <Card className={`transition-all ${!apiKey.isValid ? 'opacity-60 border-destructive/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {apiKey.name}
              {apiKey.isValid ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Créée le {formatDate(apiKey.createdAt)}
            </div>
          </div>
          
          {showActions && (
            <div className="flex items-center gap-1">
              {onViewStats && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewStats(apiKey.id)}
                  title="Voir les statistiques"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Display */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Clé API
          </label>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-sm">
            <code className="flex-1 truncate">{maskedKey}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Masquer' : 'Afficher'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              title="Copier"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          {fullKey && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Sauvegardez cette clé maintenant. Elle ne sera plus affichée.
            </p>
          )}
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Permissions
          </label>
          <div className="flex flex-wrap gap-1.5">
            {apiKey.permissions.map((perm) => (
              <Badge key={perm} variant="secondary" className={permissionColors[perm]}>
                {permissionLabels[perm]}
              </Badge>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 bg-muted/50 rounded-md">
            <div className="text-lg font-semibold text-primary">{apiKey.usageCount}</div>
            <div className="text-xs text-muted-foreground">Utilisations</div>
          </div>
          <div className="p-2 bg-muted/50 rounded-md">
            <div className="text-lg font-semibold text-primary">{apiKey.rateLimit.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Limite/h</div>
          </div>
          <div className="p-2 bg-muted/50 rounded-md">
            <div className="text-sm font-semibold text-primary truncate">
              {Math.round((apiKey.usageCount / Math.max(apiKey.rateLimit, 1)) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Utilisé</div>
          </div>
        </div>

        {/* Expiration */}
        {(apiKey.expiresAt || isExpired) && (
          <div className={`text-xs p-2 rounded-md flex items-center gap-1.5 ${
            isExpired 
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : isExpiringSoon
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-muted text-muted-foreground'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {isExpired 
              ? 'Cette clé a expiré.'
              : `Expire le ${formatDate(apiKey.expiresAt)}`
            }
          </div>
        )}

        {/* Last Used */}
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>Dernière utilisation:</span>
          <span>{formatDate(apiKey.lastUsedAt)}</span>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t">
            {onRegenerate && apiKey.isValid && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegenerate(apiKey.id)}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Régénérer
              </Button>
            )}
            
            {onRevoke && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant={apiKey.isValid ? "destructive" : "outline"} 
                    size="sm"
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    {apiKey.isValid ? 'Révoquer' : 'Supprimer'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {apiKey.isValid ? 'Révoquer la clé API?' : 'Supprimer la clé API?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {apiKey.isValid 
                        ? `La clé "${apiKey.name}" ne pourra plus être utilisée pour accéder à l'API. Cette action est irréversible.`
                        : `Supprimer définitivement la clé "${apiKey.name}" de la liste.`
                      }
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onRevoke(apiKey.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirmer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ApiKeyCard;
