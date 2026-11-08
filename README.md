# MON ACADÉMIE

Assistant académique personnel : emploi du temps, planning de révision, chronomètre fiable, cours PDF annotés, matières/chapitres, notes, priorités, statistiques. Application web installable (PWA), **locale d'abord** : tes données restent sur ton appareil, sans serveur, sans abonnement, sans IA.

Technologies : Vue 3, Vite, IndexedDB, PDF.js, fflate (sauvegardes ZIP), PWA (hors connexion).

## 1. Installation (une seule fois)

Prérequis : [Node.js 20 ou plus](https://nodejs.org) (version LTS).

```powershell
cd mon-academie
npm install
```

## 2. Lancer l'application

```powershell
npm run dev
```
Ouvre l'adresse affichée (http://localhost:5173). Pour tester sur ton téléphone sur le même Wi-Fi : `npm run dev -- --host`.

## 3. Construire la version installable

```powershell
npm run build
npm run preview
```
Le dossier `dist/` contient l'application finale. Héberge-le sur n'importe quel hébergement statique **en HTTPS** (Vercel, Netlify, GitHub Pages…) ; le navigateur proposera alors « Installer l'application » (Android, Chrome/Edge sur Windows). Après le premier chargement, elle fonctionne sans Internet.
> Les PWA exigent HTTPS (ou `localhost`). Un fichier ouvert directement (`file://`) ne peut pas être installé.

## 4. Tests

```powershell
npm test
```
22 tests automatiques : calculs de notes, chronomètre (pauses exclues, reprise après fermeture), conflits d'emploi du temps, priorités, statistiques, sauvegarde/restauration ZIP avec PDF et contrôle d'intégrité, affichage de toutes les pages.

## 5. Sauvegarde et restauration

**Paramètres → Mes données**
- **Exporter mes données** : télécharge `mon-academie-sauvegarde-AAAA-MM-JJ.zip` (données + tous les PDF + réglages). Range-le hors de l'appareil (clé USB, e-mail, cloud). Le tableau de bord te rappelle de sauvegarder après 30 jours.
- **Restaurer** : choisis le ZIP. L'application vérifie l'intégrité (empreinte SHA-256, version de format) puis te montre le contenu.
  - *Fusionner* : ajoute ce qui manque, n'écrase rien.
  - *Remplacer* : remplace tout en une seule opération « tout ou rien » ; une copie de sécurité de l'état actuel est téléchargée avant.
- **Supprimer toutes les données** : demande de taper SUPPRIMER.

## 6. Organisation du code

```
src/
  db.js              IndexedDB (stockage durable, remplacement atomique)
  store.js           état central + règles métier (chronomètre, cascades, validations)
  notify.js          rappels (application ouverte)
  constants.js       statuts, couleurs d'annotation, accents
  utils/             time, grades, timer, schedule, priorities, stats, backup
  components/        Icon (système d'icônes), Modal, graphiques SVG, grille horaire…
  views/             Dashboard, Timetable, Planning, Timer, Courses, Reader, Subjects, Grades, Priorities, Stats, Settings
tests/               tests Vitest
```
Aide-mémoire : toutes les données passent par `store.js` ; chaque écran lit `state` et appelle `save`/`removeItem`.

## 7. Fonctionnalités terminées

- Matières (couleur, icône, coefficient, objectif) et chapitres (6 statuts, maîtrise, dates de révision, notes). Progression calculée sur l'état réel des chapitres ; jamais « maîtrisé » automatiquement.
- Emploi du temps : semaine/jour, cours et pauses, détection et signalement des chevauchements, périodes libres.
- Planning : jour/semaine/mois, créer, modifier, déplacer, reporter (statut « reportée » ≠ terminée), dupliquer, annuler ; pauses non comptées ; séances refusées pendant un cours ou sur une autre séance ; prévu vs réel ; séances manquées signalées.
- Chronomètre à horodatages persistants : démarrer, pause, reprise, terminer, terminer avant la durée prévue, abandonner ; état conservé si l'appli est fermée ; historique avec observations.
- Cours PDF : import (multiple), rangement par matière/chapitre, recherche, filtres, récents ; lecteur intégré (pages, zoom, plein écran, recherche, signets, reprise exacte page + position) ; surlignage 4 couleurs (jaune à retenir, vert définition, bleu exemple, rouge à revoir), soulignement, notes sur passage et de page ; révision par couleur ; clic → retour à la page.
- Notes : conversion sur 20, moyennes pondérées (matière et générale), validation de la note maximale, évaluations à venir avec préparation, courbe d'évolution.
- Priorités par règles simples (évaluation proche, moyenne faible, chapitres difficiles, matière délaissée, séances reportées, équilibre) + ajustement manuel.
- Statistiques et bilan hebdomadaire sur données réelles uniquement.
- Paramètres : thème clair/sombre/auto, 6 couleurs, taille du texte, densité, objectifs, notifications, espace utilisé, sauvegarde/restauration.
- PWA : installable, hors connexion.

## 8. Limites connues (à lire)

- **Non testé dans un vrai navigateur ni sur téléphone** : les tests automatiques couvrent la logique, la persistance et l'affichage des pages (simulé), mais le rendu visuel, le lecteur PDF (PDF.js) et la sélection tactile n'ont pas pu être vérifiés ici. Fais les scénarios 5 et 6 (PDF) toi-même en premier et signale-moi tout défaut.
- Rappels : uniquement application ouverte (un navigateur ne notifie pas application fermée sans serveur).
- PDF scannés : pas de sélection de texte ni d'OCR (prévu pour plus tard) ; notes de page possibles.
- Recherche PDF : liste les pages ; le surlignage de résultat ne marche que si le mot est dans un seul bloc de texte.
- Déplacement des séances par fenêtre dédiée (pas de glisser-déposer).
- Pas de synchronisation entre appareils (architecture prête, volontairement non développée) ; PDF protégés par mot de passe non pris en charge.
- Les données vivent dans le navigateur : vider les données du site les efface. Sauvegarde régulière indispensable.
