# RegieWave

Logiciel tout-en-un pour Windows : **direct** (comme OBS), **régie**,
**montage**, **composition** et **son**.

Ce dépôt sert seulement à **publier les versions** de RegieWave : les
installateurs sont dans [Releases](https://github.com/faelnor92/regiewave/releases).
RegieWave y cherche lui-même ses mises à jour (Outils → Mises à jour…), les
télécharge, vérifie leur empreinte SHA-256 donnée par GitHub, puis les
installe en gardant la version précédente pour pouvoir y revenir.

## Installer

1. Dans la [dernière version](https://github.com/faelnor92/regiewave/releases/latest),
   téléchargez `RegieWave-<version>-installation.exe`.
2. Lancez-le et choisissez :
   - **pour tous les utilisateurs** (conseillé) : droits d'administrateur,
     caméra virtuelle comprise ;
   - **pour moi seulement** : sans droits d'administrateur ni caméra
     virtuelle.

Windows 10 (version 1809) ou plus récent, 64 bits. Tout ce dont RegieWave a
besoin est inclus (FFmpeg, Chromium pour les pages web, runtime Visual C++).
L'installateur n'est pas encore signé : Windows SmartScreen peut afficher un
avertissement au premier lancement (« Informations complémentaires » →
« Exécuter quand même »).

## Logiciels inclus et licences

Leurs licences sont dans le dossier `licences` de l'installation.

- **FFmpeg 7.1** (LGPL 3), en bibliothèques séparées (`av*.dll`, `sw*.dll`)
  que l'on peut remplacer, et `ffmpeg.exe`. Version `n7.1-214-g71889a8437`,
  compilée par [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)
  (`autobuild-2025-02-28-13-02`, variante `win64-lgpl-shared-7.1`). Code
  source : [FFmpeg 71889a8437](https://github.com/FFmpeg/FFmpeg/tree/71889a8437).
- **Chromium Embedded Framework** et **Chromium** (licence BSD et licences
  des composants de Chromium : `licences/Chromium.html`).
- **Runtime Visual C++** de Microsoft (redistribuable).
- **DeepFilterNet** (isolation de la voix), **YuNet** (suivi du visage),
  **pyaaf2** (dictionnaire AAF) : licence MIT.
