# Tables Fatales - Éditeur de Scénarios Interactifs

Tables Fatales est une application web interactive destinée à la création et à l'édition de scénarios narratifs non linéaires. Elle permet aux utilisateurs de concevoir des expériences immersives et dynamiques avec une forte dimension interactive.

## 🚀 Fonctionnalités

### 📝 Éditeur de Scénarios
- Interface glisser-déposer intuitive basée sur ReactFlow
- Différents types de nœuds :
  - 📄 Nœuds texte pour le contenu narratif
  - 🎥 Nœuds vidéo avec boutons personnalisables
  - 🎮 Nœuds d'interaction
  - 📱 Nœuds voucher (QR code)
  - 🎁 Nœuds de récompense
- Choix multiples : 3 options interactives par nœud

### 🎥 Bibliothèque de Médias
- Gestion complète des médias (images et vidéos)
- Support multiple des sources :
  - Upload local
  - URLs YouTube
  - Bibliothèque intégrée
- Système de tags pour l'organisation
- Prévisualisation des médias
- Extraction automatique des métadonnées

## 🛠 Installation

1. Cloner le repository :
```bash
git clone https://github.com/peopleofverso2/amen.git
cd amen
```

2. Installer les dépendances :
```bash
yarn install
```

3. Lancer le serveur de développement :
```bash
yarn dev
```

## 💻 Technologies Utilisées

- **React** avec **TypeScript** pour le frontend
- **Vite** comme bundler
- **Material-UI** pour l'interface utilisateur
- **ReactFlow** pour l'éditeur de graphes
- **React Player** pour la lecture vidéo
- **IndexedDB** pour le stockage local des médias

## 🏗 Architecture

### Structure du Projet
```
src/
├── components/
│   ├── Editor/           # Composants de l'éditeur
│   │   ├── nodes/       # Types de nœuds
│   │   └── controls/    # Contrôles de l'éditeur
│   └── MediaLibrary/    # Bibliothèque de médias
├── services/
│   └── storage/         # Adaptateurs de stockage
├── types/               # Définitions TypeScript
└── utils/              # Utilitaires
```

### Stockage des Médias
L'application utilise une architecture en couches pour le stockage des médias :
- Interface `MediaStorageAdapter` pour l'abstraction du stockage
- Implémentation locale avec IndexedDB
- Facilement extensible pour un stockage serveur

## 🎯 Utilisation

### Création d'un Scénario
1. Glisser-déposer les nœuds depuis la barre latérale
2. Configurer chaque nœud avec son contenu
3. Connecter les nœuds pour créer le flux narratif
4. Définir les choix et conditions pour chaque nœud

### Gestion des Médias
1. Accéder à la bibliothèque via l'onglet "Bibliothèque"
2. Upload de nouveaux médias avec tags
3. Rechercher et filtrer les médias existants
4. Sélectionner les médias pour les nœuds vidéo

## 🔄 Migration vers un Serveur

Pour migrer vers un stockage serveur :
1. Créer un nouvel adaptateur implémentant `MediaStorageAdapter`
2. Implémenter les méthodes requises avec des appels API
3. Injecter le nouvel adaptateur dans `MediaLibraryService`

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 License

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.

## 📧 Contact

People of Verso 2 - [@peopleofverso2](https://github.com/peopleofverso2)

Lien du projet : [https://github.com/peopleofverso2/amen](https://github.com/peopleofverso2/amen)
