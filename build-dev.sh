#!/bin/bash

# Script d'aide pour générer le build native (APK)
# Ce build est nécessaire pour faire fonctionner Mapbox.

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Assistant de Build Transport App ===${NC}"

# 1. Vérifier EAS CLI
if ! command -v eas &> /dev/null
then
    echo "EAS CLI n'est pas installé. Installation en cours..."
    npm install -g eas-cli
fi

# 2. Vérifier la connexion
echo -e "${BLUE}Vérification de la connexion à Expo...${NC}"
eas whoami || (echo "Veuillez vous connecter à Expo d'abord :" && eas login)

# 3. Lancer le build
echo -e "\n${GREEN}Prêt pour le build !${NC}"
echo "Ce processus va créer un APK de développement qui inclut Mapbox."
echo "Une fois terminé, vous pourrez l'installer sur votre téléphone Android."
echo -e "\n${BLUE}Voulez-vous lancer le build maintenant ? (y/n)${NC}"
read answer

if [ "$answer" != "${answer#[Yy]}" ] ;then
    eas build --profile development --platform android
else
    echo "Opération annulée. Vous pouvez le lancer plus tard avec :"
    echo -e "${GREEN}eas build --profile development --platform android${NC}"
fi
