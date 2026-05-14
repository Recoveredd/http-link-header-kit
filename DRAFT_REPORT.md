# Draft report: http-link-header-kit

## Verdict

GO local plus tard. Le brouillon est petit, clean-room, browser-friendly et limité au parsing/formatage des en-têtes HTTP `Link`. Après requalification, il est nettement moins fragile: entrées runtime non-string, relations case-insensitive et paramètres dupliqués sont maintenant couverts.

## Candidat source

- Package signal: `parse-link-header`
- Version actuelle observée: `2.0.0`
- Dernière publication: `2021-12-16`
- Licence: MIT
- Dépendance runtime: `xtend`
- Usage observé: environ 1,29M téléchargements hebdomadaires et 337 dépendants sur npm.
- Abandon/faible maintenance: aucune publication depuis plus de 4 ans; metadata npm modifiée en 2022 mais pas de version plus récente.

## Grille anti-emballement

- Usage actuel vérifié: 2/2, téléchargements et dépendants élevés.
- Abandon ou maintenance faible: 2/2, dernière version 2021.
- Scope livrable en 1 journée: 2/2, parser/formatter d'un seul header.
- Douleur utilisateur visible: 2/2, pagination API, valeurs `rel` multiples, erreurs de syntaxe et limites d'entrée.
- Différenciation non triviale: 2/2, résultat structuré, diagnostics, formatage intégré, helpers de relations.

Score: 10/10.

Différenciation en 1 journée: fournir un parseur/formatter `Link` sans dépendance runtime qui retourne un tableau préservant les doublons, des diagnostics non-throwing avec offsets, un index par `rel`, des helpers de pagination et une limite explicite configurable sans variable d'environnement.

## Alternatives maintenues

- `http-link-header`: package maintenu, dernière publication observée en 2024, API plus complète autour de RFC 8288.
- `format-link-header`: complément de formatage, dernière publication ancienne.
- `github-parse-link`: ciblé GitHub, dernière publication ancienne.

Le brouillon n'essaie pas de battre `http-link-header` sur l'exhaustivité RFC. L'angle est une surface plus petite et fonctionnelle, sans classe, avec diagnostics directs et helpers prêts pour pagination/fetch.

## Nom retenu

`http-link-header-kit`

Justification: nom explicite, descriptif, cohérent avec les noms `*-kit`, immédiatement lisible dans npm/GitHub, et suffisamment distinct de `parse-link-header` comme de `http-link-header`.

## Browser-friendly

Le coeur ne dépend que de chaînes, tableaux et objets JavaScript standards. Il n'utilise pas `fs`, `path`, `node:url`, `Buffer`, `process`, modules natifs, ni accès réseau implicite.

## CLI

Pas de CLI dans ce brouillon. Une CLI ne serait pas naturellement utile pour l'usage principal, qui est l'inspection d'en-têtes reçus dans du code applicatif, navigateur, edge ou serveur.

## API proposée

- `parseLinkHeader(input, options?)`
- `formatLinkHeader(links)`
- `indexLinksByRel(links)`
- `findLinkByRel(links, rel)`
- `paginationLinks(links)`

## Risques et limites

- Couverture RFC volontairement conservatrice; les paramètres étendus très spécialisés ne sont pas encore décodés.
- Le parser tolère les cas courants mais doit être relu avant publication pour conformité plus stricte.
- Aucun benchmark ajouté.
- Aucun test browser bundler ajouté.

## Manques avant publication

- Relecture humaine de la conformité RFC 8288.
- Ajouter des cas de tests plus poussés pour paramètres étendus RFC 5987/8187 si on veut les promettre.
- Vérifier le nom une seconde fois juste avant publication éventuelle.
- Ajouter l'hygiène repo complète si le projet devient une vraie lib: CI, badges README, `CONTRIBUTING.md`, `SECURITY.md`.

## Requalification 2026-05-14

Décision: GO local plus tard, mais ne pas le positionner comme parseur RFC 8288 exhaustif. Le bon angle reste: petit parser/formatter fonctionnel, diagnostics directs, helpers prêts pour pagination API.

Passe utilisateur avancé 1: client API paginé. Les tokens `rel` sont maintenant indexés en minuscules et `findLinkByRel` est case-insensitive, ce qui évite les surprises avec `rel="Next Prev"`.

Passe utilisateur avancé 2: inspection d'un header externe mal formé. Les paramètres dupliqués sont diagnostiqués avec `duplicate-parameter` et la première valeur est conservée au lieu d'être écrasée silencieusement.

Passe robustesse: `parseLinkHeader` accepte les entrées runtime `unknown`, retourne `expected-string` sans throw, et ignore les `maxLength` invalides au lieu de rendre la lib inutilisable.

## État Git local

Validations exécutées:

- `npm install`: OK, avec 4 vulnérabilités modérées signalées dans les dépendances de développement.
- `npm run typecheck`: OK après requalification.
- `npm test`: OK, 11 tests passent.
- `npm run build`: OK.
- `npm pack --dry-run`: premier essai bloqué par un cache npm global non inscriptible; essai OK avec `npm_config_cache=/private/tmp/http-link-header-kit-npm-cache`, 11.1 kB packed.
- Smoke `dist`: OK, duplicate param diagnostiqué et rel lookup case-insensitive.

Git local: initialisé dans le dossier du brouillon uniquement. `git branch -M main` a affiché un message `HEAD.lock`, mais le dépôt est bien sur `main`. Aucun remote ajouté.

## Verdict humain recommandé

Relire comme draft prometteur, surtout l'ergonomie du résultat et la stratégie face au concurrent maintenu `http-link-header`.
