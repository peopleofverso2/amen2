let id = 0;

/**
 * Génère un identifiant unique pour les nœuds
 * @returns Une chaîne de caractères représentant l'ID unique
 */
export const getId = (): string => `node_${id++}`;
