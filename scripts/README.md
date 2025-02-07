# Scripts de Backup et Restauration

Ces scripts permettent de sauvegarder et restaurer l'intégralité du projet Amen, y compris :
- Les fichiers sources
- Les dépendances (node_modules)
- La base de données IndexedDB
- Les configurations

## Faire un backup

Pour créer un backup complet du projet :

```bash
node scripts/backup.js
```

Le backup sera créé dans le dossier `backups/` avec un nom incluant la date et l'heure.

## Restaurer un backup

Pour restaurer un backup existant :

```bash
node scripts/restore.js chemin/vers/le/backup.zip
```

Par exemple :
```bash
node scripts/restore.js backups/amen-backup-2025-02-07T02-39-00.zip
```

## Contenu du backup

Le backup inclut :
- Tous les fichiers du projet (sauf node_modules, .git, etc.)
- package.json et package-lock.json
- Les dépendances (node_modules)
- Un export complet de la base de données IndexedDB

## Notes importantes

1. Le backup peut prendre quelques minutes selon la taille du projet
2. La restauration réinstallera toutes les dépendances
3. La base de données existante sera écrasée lors de la restauration
4. Assurez-vous d'avoir assez d'espace disque
