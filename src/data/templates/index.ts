import cubesat3u from './cubesat3u.json';

/** Starter models offered by the "Modelos" menu. The demo is loaded by the store itself. */
export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  fileName: string;
  data: unknown;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'cubesat3u',
    name: 'CubeSat 3U ambiental',
    description: 'Câmera RGB + coleta IoT por LoRa, 500 km SSO, 3 anos',
    fileName: 'cubesat3u.json',
    data: cubesat3u,
  },
];
