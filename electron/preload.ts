import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('atlasDesktop', {
  getBootstrap: () => ipcRenderer.invoke('atlas:get-bootstrap'),
  submitClarification: (data: any) => ipcRenderer.invoke('atlas:submit-clarification', data),
});