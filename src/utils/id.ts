import { v4 as uuidv4 } from 'uuid';

/**
 * Génère un identifiant de nœud globalement unique.
 * Évite les collisions après rechargement de projet.
 */
export const getId = (): string => `node_${uuidv4()}`;
