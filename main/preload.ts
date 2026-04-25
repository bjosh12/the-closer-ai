import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  db: {
    getSessions: () => ipcRenderer.invoke('db:getSessions'),
    createSession: (session: any) => ipcRenderer.invoke('db:createSession', session),
    getSession: (id: string) => ipcRenderer.invoke('db:getSession', id),
    saveTranscript: (transcript: any) => ipcRenderer.invoke('db:saveTranscript', transcript),
    getTranscripts: (sessionId: string) => ipcRenderer.invoke('db:getTranscripts', sessionId),
    saveAnswer: (answer: any) => ipcRenderer.invoke('db:saveAnswer', answer),
    getAnswers: (sessionId: string) => ipcRenderer.invoke('db:getAnswers', sessionId),
    getProfile: (userId: string) => ipcRenderer.invoke('db:getProfile', userId),
    saveProfile: (profile: any) => ipcRenderer.invoke('db:saveProfile', profile),
    getTemplates: () => ipcRenderer.invoke('db:getTemplates'),
    saveTemplate: (template: any) => ipcRenderer.invoke('db:saveTemplate', template),
    deleteTemplate: (id: string) => ipcRenderer.invoke('db:deleteTemplate', id),
    getDocuments: () => ipcRenderer.invoke('db:getDocuments'),
    saveDocument: (doc: any) => ipcRenderer.invoke('db:saveDocument', doc),
    deleteDocument: (id: string) => ipcRenderer.invoke('db:deleteDocument', id),
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
  },
  file: {
    parsePdf: (filePath: string) => ipcRenderer.invoke('file:parsePdf', filePath),
  },
  url: {
    fetch: (url: string) => ipcRenderer.invoke('url:fetch', url),
  },
  widget: {
    open: () => ipcRenderer.invoke('widget:open'),
    close: () => ipcRenderer.invoke('widget:close'),
    update: (text: string) => ipcRenderer.send('widget:update', text),
    onUpdate: (callback: (text: string) => void) => {
      ipcRenderer.on('widget:onUpdate', (_, text) => callback(text));
    },
    setOpacity: (opacity: number) => ipcRenderer.send('widget:setOpacity', opacity),
    setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('widget:setIgnoreMouseEvents', ignore),
  },
  windowAPI: {
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize')
  },
  cloud: {
    signIn: (email: string, password: string) => ipcRenderer.invoke('cloud:signIn', email, password),
    signUp: (email: string, password: string, metadata?: any) => ipcRenderer.invoke('cloud:signUp', email, password, metadata),
    signOut: () => ipcRenderer.invoke('cloud:signOut'),
    getUser: () => ipcRenderer.invoke('cloud:getUser'),
    getProfile: (userId: string) => ipcRenderer.invoke('cloud:getProfile', userId),
    getDocuments: (userId: string) => ipcRenderer.invoke('cloud:getDocuments', userId),
    syncDocument: (doc: any, userId: string) => ipcRenderer.invoke('cloud:syncDocument', doc, userId),
    deleteDocument: (id: string) => ipcRenderer.invoke('cloud:deleteDocument', id),
    syncSession: (session: any, userId: string) => ipcRenderer.invoke('cloud:syncSession', session, userId),
    incrementMinutes: (userId: string, minutes: number) => ipcRenderer.invoke('cloud:incrementMinutes', userId, minutes),
    checkTrial: (userId: string) => ipcRenderer.invoke('cloud:checkTrial', userId),
    verifyLicense: (key: string, machineId: string, userId?: string) => ipcRenderer.invoke('cloud:verifyLicense', key, machineId, userId),
  },
  license: {
    verify: (key: string) => ipcRenderer.invoke('license:verify', key),
    getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    getLaunchAtStartup: () => ipcRenderer.invoke('app:getLaunchAtStartup'),
    setLaunchAtStartup: (enabled: boolean) => ipcRenderer.invoke('app:setLaunchAtStartup', enabled),
    isFirstRun: () => ipcRenderer.invoke('app:isFirstRun'),
    completeOnboarding: () => ipcRenderer.invoke('app:completeOnboarding'),
    getWhatsNew: () => ipcRenderer.invoke('app:getWhatsNew'),
    onUpdateStatus: (callback: (status: string) => void) => {
      ipcRenderer.on('app:updateStatus', (_, status) => callback(status));
    },
  },
});
