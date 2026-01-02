/**
 * Configuration globale de l'application Transport
 */

export const SERVICE_AREA = {
    // Bounding box pour le Sud Bénin (Cotonou, Porto-Novo, Abomey-Calavi)
    // Format: [minLon, minLat, maxLon, maxLat]
    BOUNDS: [2.10, 6.30, 2.70, 6.85] as [number, number, number, number],

    // Centre par défaut (Cotonou)
    CENTER: [2.3912, 6.3703] as [number, number],

    // Message d'erreur hors zone
    OUT_OF_ZONE_MESSAGE: "Désolé, nos services ne sont pas encore disponibles dans votre zone. Nous couvrons actuellement Cotonou, Porto-Novo et Abomey-Calavi."
};
