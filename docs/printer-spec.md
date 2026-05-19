# Spécification des codes RNBP — pour l'imprimeur

Ce document décrit le format des codes RNBP, les règles de génération par feuille, et le contenu à imprimer sur chaque autocollant.

## Format du code

- **Structure** : `RNBP-XXXXXXXX` (13 caractères au total)
- **Préfixe** : `RNBP-` (5 caractères, fixe, en majuscules)
- **Suffixe** : 8 caractères tirés de l'alphabet ci-dessous, en majuscules

## Alphabet autorisé (31 caractères)

```
23456789ABCDEFGHJKMNPQRSTUVWXYZ
```

**Caractères exclus volontairement** pour éviter la confusion humaine lors de la lecture/saisie :

- `0` (zéro) ↔ `O` (lettre o)
- `1` (un) ↔ `I` (lettre i) ↔ `L` (lettre l)

Capacité totale de l'espace : 31⁸ ≈ **852 milliards** de codes uniques.

## Règles par feuille

- **10 codes par feuille**, séquentiels dans l'alphabet ci-dessus
- Exemple de feuille valide : `RNBP-A2222222` → `RNBP-A222222B`
  - Les 10 codes sont : `A2222222`, `A2222223`, `A2222224`, `A2222225`, `A2222226`, `A2222227`, `A2222228`, `A2222229`, `A222222A`, `A222222B`
- Le passage de `9` à `A` est normal (continuité de l'alphabet) — il faut sauter les caractères exclus (`I` entre `H` et `J`, `L` entre `K` et `M`, `O` entre `N` et `P`).

### Ordre de l'alphabet (pour calcul de séquence)

| Pos | Char | | Pos | Char | | Pos | Char |
|---:|---|---|---:|---|---|---:|---|
| 0 | `2` | | 11 | `D` | | 22 | `R` |
| 1 | `3` | | 12 | `E` | | 23 | `S` |
| 2 | `4` | | 13 | `F` | | 24 | `T` |
| 3 | `5` | | 14 | `G` | | 25 | `U` |
| 4 | `6` | | 15 | `H` | | 26 | `V` |
| 5 | `7` | | 16 | `J` (saute `I`) | | 27 | `W` |
| 6 | `8` | | 17 | `K` | | 28 | `X` |
| 7 | `9` | | 18 | `M` (saute `L`) | | 29 | `Y` |
| 8 | `A` | | 19 | `N` | | 30 | `Z` |
| 9 | `B` | | 20 | `P` (saute `O`) | | | |
| 10 | `C` | | 21 | `Q` | | | |

## Unicité

- Chaque code doit être **globalement unique** — pas de réutilisation entre feuilles, jamais.
- **Recommandé** : sauter des plages aléatoires entre commandes (ex. feuille 1 = `A2222222`–`A222222B`, feuille 2 = `M3K5N7P9`–`M3K5N7PJ`). Si on incrémente toujours de +1, un autocollant volé donnerait des indices sur les codes voisins. Ce risque est déjà atténué par un check d'ownership côté serveur (un code ne peut être réclamé que par le client à qui il a été vendu), mais c'est une bonne pratique défense-en-profondeur.

## Ce qui est imprimé sur chaque autocollant

Chaque autocollant porte **deux représentations** du même code :

### 1. Le code en clair

Format `RNBP-XXXXXXXX`, en police lisible humainement. Sert si le QR est endommagé ou mal scanné — le client peut saisir le code manuellement sur le site.

### 2. Un QR code

Encodant l'URL :

```
https://rnbp.ca/c/RNBP-XXXXXXXX
```

(le même code qu'imprimé en clair, préfixé du host)

Paramètres recommandés :

- **Mode QR** : `alphanumeric` (tous les caractères de l'URL sont dans le set alphanumeric standard, ce qui donne la densité minimale)
- **Correction d'erreur** : **M (15 %)** ou **Q (25 %)** — résistance à l'usure et aux marques
- **Taille minimale** : QR Version 2 (25×25 modules) ou plus, selon la dimension physique de l'autocollant

## Exemple complet

Feuille no 1, codes `RNBP-A2222222` à `RNBP-A222222B` :

| Code (clair) | URL encodée dans le QR |
|---|---|
| `RNBP-A2222222` | `https://rnbp.ca/c/RNBP-A2222222` |
| `RNBP-A2222223` | `https://rnbp.ca/c/RNBP-A2222223` |
| `RNBP-A2222224` | `https://rnbp.ca/c/RNBP-A2222224` |
| `RNBP-A2222225` | `https://rnbp.ca/c/RNBP-A2222225` |
| `RNBP-A2222226` | `https://rnbp.ca/c/RNBP-A2222226` |
| `RNBP-A2222227` | `https://rnbp.ca/c/RNBP-A2222227` |
| `RNBP-A2222228` | `https://rnbp.ca/c/RNBP-A2222228` |
| `RNBP-A2222229` | `https://rnbp.ca/c/RNBP-A2222229` |
| `RNBP-A222222A` | `https://rnbp.ca/c/RNBP-A222222A` |
| `RNBP-A222222B` | `https://rnbp.ca/c/RNBP-A222222B` |
