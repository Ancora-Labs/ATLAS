import { app } from 'electron';
import path from 'path';

export function resolveAtlasDesktopResourcePaths() {
  const isPackaged = app.isPackaged;
  const basePath = isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
  return {
    icon: path.join(basePath, 'atlaslogoii.png'),
  };
}